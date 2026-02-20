import path from "node:path";
import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/security/password";
import { extensionRegistry } from "@/lib/extensions/registry";
import {
  initializeExtensions,
  persistExtensionState,
} from "@/lib/extensions/loader";
import { safeInstall } from "@/lib/extensions/marketplace/safe-installer";
import { downloadExtensionPackage } from "@/lib/extensions/marketplace/marketplace-client";
import {
  logAdminAuthFailed,
  logExtensionInstall,
  logSignatureInvalid,
} from "@/lib/extensions/marketplace/audit-events";
import { logFeatureAction } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const EXTENSIONS_DIR = path.join(process.cwd(), "extensions");

async function verifyAdminPassword(
  userId: string,
  password: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) {
    return false;
  }
  return verifyPassword(password, user.passwordHash);
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const { extensionId, version, password } = (await request.json()) as {
      extensionId?: string;
      version?: string;
      password?: string;
    };

    if (!extensionId || !password) {
      return NextResponse.json(
        { error: "拡張IDとパスワードが必要です" },
        { status: 400 },
      );
    }

    const passwordValid = await verifyAdminPassword(admin.id, password);
    if (!passwordValid) {
      await logAdminAuthFailed(admin.id, "marketplace_install");
      return NextResponse.json(
        { error: "パスワードが違います" },
        { status: 401 },
      );
    }

    if (extensionRegistry.getAll().length === 0) {
      await initializeExtensions("system");
    }

    if (extensionRegistry.get(extensionId)) {
      return NextResponse.json(
        { error: "既にインストールされています" },
        { status: 409 },
      );
    }

    const { buffer, packageHash, signature } = await downloadExtensionPackage(
      extensionId,
      version,
    );

    const installResult = await safeInstall(
      buffer,
      { packageHash, signature },
      admin.id,
    );

    if (!installResult.success) {
      if (installResult.error?.includes("signature")) {
        await logSignatureInvalid(
          admin.id,
          extensionId,
          installResult.version,
          installResult.error,
        );
      }
      await logExtensionInstall(
        admin.id,
        extensionId,
        installResult.version,
        false,
        installResult.error,
      );
      return NextResponse.json(
        { error: installResult.error || "インストールに失敗しました" },
        { status: 500 },
      );
    }

    const manifestPath = path.join(
      EXTENSIONS_DIR,
      installResult.extensionId,
      "manifest.json",
    );
    const manifestData = JSON.parse(await fs.readFile(manifestPath, "utf-8"));

    if (manifestData.id !== extensionId) {
      await fs.rm(path.join(EXTENSIONS_DIR, installResult.extensionId), {
        recursive: true,
        force: true,
      });
      await logExtensionInstall(
        admin.id,
        extensionId,
        installResult.version,
        false,
        "manifest_id_mismatch",
      );
      return NextResponse.json(
        { error: "マニフェストIDが一致しません" },
        { status: 400 },
      );
    }

    const registryResult = await extensionRegistry.install(
      manifestData,
      path.join(EXTENSIONS_DIR, installResult.extensionId),
      admin.id,
    );

    if (!registryResult.success) {
      await logExtensionInstall(
        admin.id,
        extensionId,
        installResult.version,
        false,
        registryResult.errors?.[0]?.message,
      );
      return NextResponse.json(
        { error: registryResult.errors?.[0]?.message || "登録に失敗しました" },
        { status: 500 },
      );
    }

    await persistExtensionState();
    await logExtensionInstall(
      admin.id,
      extensionId,
      installResult.version,
      true,
    );
    await logFeatureAction("extension.install", admin.id);

    return NextResponse.json({
      success: true,
      extensionId,
      version: installResult.version,
    });
  } catch (error) {
    console.error("Marketplace install error:", error);
    if (error instanceof Error && error.message === "権限が不足しています") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "インストールに失敗しました" },
      { status: 500 },
    );
  }
}
