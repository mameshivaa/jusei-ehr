import "server-only";

import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { MARKETPLACE_CONFIG } from "./config";
import type { LicenseCache, LicenseVerificationResponse } from "./types";
import { logLicenseDisabled, logLicenseExpired } from "./audit-events";

const OFFLINE_GRACE_PERIOD_DAYS = 14;
const LICENSE_CACHE_PATH = path.join(
  process.cwd(),
  "extensions",
  ".license-cache.json",
);

type LicenseCacheFile = {
  version: number;
  licenses: LicenseCache[];
};

let cachedAppVersion: string | null = null;
let cachedClinicId: string | null | undefined = undefined;

function getAppVersion(): string {
  if (cachedAppVersion) return cachedAppVersion;
  try {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
      version?: string;
    };
    cachedAppVersion = packageJson.version || "0.0.0";
    return cachedAppVersion;
  } catch {
    cachedAppVersion = "0.0.0";
    return cachedAppVersion;
  }
}

async function getClinicId(): Promise<string | null> {
  if (cachedClinicId !== undefined) {
    return cachedClinicId;
  }
  const clinic = await prisma.clinic.findFirst({
    select: { id: true },
  });
  cachedClinicId = clinic?.id || null;
  return cachedClinicId;
}

async function loadLicenseCache(): Promise<LicenseCacheFile> {
  try {
    const content = await fs.readFile(LICENSE_CACHE_PATH, "utf-8");
    const data = JSON.parse(content) as LicenseCacheFile;
    if (data.version !== 1) {
      return { version: 1, licenses: [] };
    }
    return data;
  } catch {
    return { version: 1, licenses: [] };
  }
}

async function saveLicenseCache(file: LicenseCacheFile): Promise<void> {
  await fs.mkdir(path.dirname(LICENSE_CACHE_PATH), { recursive: true });
  await fs.writeFile(
    LICENSE_CACHE_PATH,
    JSON.stringify(file, null, 2),
    "utf-8",
  );
}

async function upsertLicenseCache(record: LicenseCache): Promise<void> {
  const file = await loadLicenseCache();
  const index = file.licenses.findIndex(
    (license) => license.extensionId === record.extensionId,
  );
  if (index >= 0) {
    file.licenses[index] = record;
  } else {
    file.licenses.push(record);
  }
  await saveLicenseCache(file);
}

export async function removeLicenseCache(extensionId: string): Promise<void> {
  const file = await loadLicenseCache();
  file.licenses = file.licenses.filter((l) => l.extensionId !== extensionId);
  await saveLicenseCache(file);
}

async function fetchLicenseOnline(
  extensionId: string,
  clinicId: string,
): Promise<LicenseVerificationResponse | null> {
  if (!MARKETPLACE_CONFIG.apiUrl || !MARKETPLACE_CONFIG.apiKey) {
    return null;
  }

  const response = await fetch(
    `${MARKETPLACE_CONFIG.apiUrl}/api/v1/licenses/verify`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MARKETPLACE_CONFIG.apiKey}`,
      },
      body: JSON.stringify({
        extensionId,
        clinicId,
        appVersion: getAppVersion(),
      }),
    },
  );

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as LicenseVerificationResponse;
}

function isWithinGracePeriod(lastVerifiedAt: string): boolean {
  const last = new Date(lastVerifiedAt);
  if (isNaN(last.getTime())) return false;
  const now = new Date();
  const diffDays = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= OFFLINE_GRACE_PERIOD_DAYS;
}

function isExpired(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  const exp = new Date(expiresAt);
  return !isNaN(exp.getTime()) && exp.getTime() < Date.now();
}

// 1. extensionRegistry.enable() から呼び出し
export async function checkLicenseForEnable(
  extensionId: string,
  clinicId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const verified = await fetchLicenseOnline(extensionId, clinicId);
  if (!verified) {
    return { allowed: false, reason: "offline_or_unverified" };
  }

  const record: LicenseCache = {
    extensionId,
    clinicId,
    type: verified.type,
    status: verified.valid ? "valid" : "expired",
    lastVerifiedAt: new Date().toISOString(),
    expiresAt: verified.expiresAt,
  };
  await upsertLicenseCache(record);

  if (!verified.valid || isExpired(verified.expiresAt)) {
    await logLicenseExpired("system", extensionId, "enable_check_failed");
    return { allowed: false, reason: "license_invalid" };
  }

  return { allowed: true };
}

// 2. commandRegistry.execute() から呼び出し
export async function checkLicenseForExecution(
  extensionId: string,
  clinicId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const file = await loadLicenseCache();
  const cached = file.licenses.find((l) => l.extensionId === extensionId);
  if (!cached) {
    return { allowed: false, reason: "license_not_verified" };
  }

  // まずオフライン猶予期間をチェック（14日）
  if (!isWithinGracePeriod(cached.lastVerifiedAt)) {
    await logLicenseExpired(
      "system",
      extensionId,
      "execution_check_offline_grace_expired",
    );
    return { allowed: false, reason: "offline_grace_period_expired" };
  }

  // 猶予期間内でライセンスが有効なら許可
  if (cached.status === "valid" && !isExpired(cached.expiresAt)) {
    return { allowed: true };
  }

  // ライセンス自体は期限切れだが猶予期間内
  if (cached.status === "expired" || isExpired(cached.expiresAt)) {
    return { allowed: true, reason: "grace_period" };
  }

  await logLicenseExpired("system", extensionId, "execution_check_expired");
  return { allowed: false, reason: "license_expired" };
}

// 3. templateRegistry.render() から呼び出し
export async function checkLicenseForRender(
  extensionId: string,
  clinicId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const file = await loadLicenseCache();
  const cached = file.licenses.find((l) => l.extensionId === extensionId);
  if (!cached) {
    return { allowed: false, reason: "license_not_verified" };
  }

  // まずオフライン猶予期間をチェック（14日）
  if (!isWithinGracePeriod(cached.lastVerifiedAt)) {
    await logLicenseExpired(
      "system",
      extensionId,
      "render_check_offline_grace_expired",
    );
    return { allowed: false, reason: "offline_grace_period_expired" };
  }

  // 猶予期間内でライセンスが有効なら許可
  if (cached.status === "valid" && !isExpired(cached.expiresAt)) {
    return { allowed: true };
  }

  // ライセンス自体は期限切れだが猶予期間内
  if (cached.status === "expired" || isExpired(cached.expiresAt)) {
    return { allowed: true, reason: "grace_period" };
  }

  await logLicenseExpired("system", extensionId, "render_check_expired");
  return { allowed: false, reason: "license_expired" };
}

// 4. アプリ起動時に呼び出し
export async function validateAllLicenses(
  clinicId?: string,
): Promise<{ disabled: string[] }> {
  const disabled: string[] = [];
  const resolvedClinicId = clinicId || (await getClinicId());
  if (!resolvedClinicId) return { disabled };

  const { extensionRegistry } = await import("../registry");
  const { disableExtensionAndPersist } = await import("../loader");

  const enabled = extensionRegistry.getEnabled();
  for (const ext of enabled) {
    const verified = await fetchLicenseOnline(
      ext.manifest.id,
      resolvedClinicId,
    );
    if (!verified) {
      // オンライン検証不可の場合は終了
      break;
    }

    const record: LicenseCache = {
      extensionId: ext.manifest.id,
      clinicId: resolvedClinicId,
      type: verified.type,
      status: verified.valid ? "valid" : "expired",
      lastVerifiedAt: new Date().toISOString(),
      expiresAt: verified.expiresAt,
    };
    await upsertLicenseCache(record);

    if (!verified.valid || isExpired(verified.expiresAt)) {
      await disableExtensionAndPersist(ext.manifest.id, "system");
      await logLicenseDisabled("system", ext.manifest.id, "startup_validation");
      disabled.push(ext.manifest.id);
    }
  }

  return { disabled };
}

export async function getLicenseCache(): Promise<LicenseCache[]> {
  const file = await loadLicenseCache();
  return file.licenses;
}

export async function hasValidCachedLicense(
  extensionId: string,
): Promise<boolean> {
  const file = await loadLicenseCache();
  const cached = file.licenses.find((l) => l.extensionId === extensionId);
  if (!cached) return false;
  if (cached.status === "valid" && !isExpired(cached.expiresAt)) {
    return true;
  }
  return isWithinGracePeriod(cached.lastVerifiedAt);
}

export async function resolveClinicId(): Promise<string | null> {
  return getClinicId();
}
