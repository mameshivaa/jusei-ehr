import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

/**
 * システムモード管理（ガイドライン準拠：読み取り専用モード）
 */

export type SystemMode = "NORMAL" | "READ_ONLY" | "MAINTENANCE";

const SYSTEM_MODE_KEY = "system_mode";
const SYSTEM_MODE_REASON_KEY = "system_mode_reason";
const SYSTEM_MODE_CHANGED_BY_KEY = "system_mode_changed_by";
const SYSTEM_MODE_CHANGED_AT_KEY = "system_mode_changed_at";

/**
 * システム設定を取得または初期化
 */
async function getOrCreateSetting(
  key: string,
  defaultValue: string,
): Promise<string> {
  const setting = await prisma.systemSettings.findUnique({
    where: { key },
  });

  if (setting) {
    return setting.value;
  }

  await prisma.systemSettings.create({
    data: {
      key,
      value: defaultValue,
      description: `System setting: ${key}`,
    },
  });

  return defaultValue;
}

/**
 * システム設定を更新
 */
async function updateSetting(
  key: string,
  value: string,
  updatedBy?: string,
): Promise<void> {
  await prisma.systemSettings.upsert({
    where: { key },
    update: { value, updatedBy },
    create: { key, value, updatedBy, description: `System setting: ${key}` },
  });
}

/**
 * 現在のシステムモードを取得
 */
export async function getSystemMode(): Promise<{
  mode: SystemMode;
  reason?: string;
  changedBy?: string;
  changedAt?: string;
}> {
  const mode = (await getOrCreateSetting(
    SYSTEM_MODE_KEY,
    "NORMAL",
  )) as SystemMode;

  const [reason, changedBy, changedAt] = await Promise.all([
    prisma.systemSettings.findUnique({
      where: { key: SYSTEM_MODE_REASON_KEY },
    }),
    prisma.systemSettings.findUnique({
      where: { key: SYSTEM_MODE_CHANGED_BY_KEY },
    }),
    prisma.systemSettings.findUnique({
      where: { key: SYSTEM_MODE_CHANGED_AT_KEY },
    }),
  ]);

  return {
    mode,
    reason: reason?.value,
    changedBy: changedBy?.value,
    changedAt: changedAt?.value,
  };
}

/**
 * システムモードを変更
 */
export async function setSystemMode(
  mode: SystemMode,
  changedBy: string,
  reason?: string,
): Promise<void> {
  const currentMode = await getSystemMode();

  if (currentMode.mode === mode) {
    return; // 変更なし
  }

  const changedAt = new Date().toISOString();

  await Promise.all([
    updateSetting(SYSTEM_MODE_KEY, mode, changedBy),
    updateSetting(SYSTEM_MODE_REASON_KEY, reason || "", changedBy),
    updateSetting(SYSTEM_MODE_CHANGED_BY_KEY, changedBy),
    updateSetting(SYSTEM_MODE_CHANGED_AT_KEY, changedAt, changedBy),
  ]);

  // 監査ログを記録
  await createAuditLog({
    userId: changedBy,
    action: "SYSTEM_MODE_CHANGE",
    entityType: "SYSTEM",
    category: "SYSTEM",
    severity: mode === "NORMAL" ? "INFO" : "CRITICAL",
    metadata: {
      previousMode: currentMode.mode,
      newMode: mode,
      reason,
    },
  });
}

/**
 * 読み取り専用モードかどうかをチェック
 */
export async function isReadOnlyMode(): Promise<boolean> {
  const { mode } = await getSystemMode();
  return mode === "READ_ONLY";
}

/**
 * メンテナンスモードかどうかをチェック
 */
export async function isMaintenanceMode(): Promise<boolean> {
  const { mode } = await getSystemMode();
  return mode === "MAINTENANCE";
}

/**
 * 読み取り専用モードを有効化（インシデント対応時）
 */
export async function enableReadOnlyMode(
  changedBy: string,
  reason: string,
): Promise<void> {
  await setSystemMode("READ_ONLY", changedBy, reason);
}

/**
 * 読み取り専用モードを解除
 */
export async function disableReadOnlyMode(
  changedBy: string,
  reason?: string,
): Promise<void> {
  await setSystemMode("NORMAL", changedBy, reason || "読み取り専用モード解除");
}

/**
 * メンテナンスモードを有効化
 */
export async function enableMaintenanceMode(
  changedBy: string,
  reason: string,
): Promise<void> {
  await setSystemMode("MAINTENANCE", changedBy, reason);
}

/**
 * メンテナンスモードを解除
 */
export async function disableMaintenanceMode(
  changedBy: string,
  reason?: string,
): Promise<void> {
  await setSystemMode("NORMAL", changedBy, reason || "メンテナンスモード解除");
}

/**
 * 書き込み操作が許可されているかチェック
 */
export async function canWrite(): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const { mode, reason } = await getSystemMode();

  if (mode === "READ_ONLY") {
    return {
      allowed: false,
      reason: reason || "システムは現在読み取り専用モードです",
    };
  }

  if (mode === "MAINTENANCE") {
    return {
      allowed: false,
      reason: reason || "システムは現在メンテナンス中です",
    };
  }

  return { allowed: true };
}
