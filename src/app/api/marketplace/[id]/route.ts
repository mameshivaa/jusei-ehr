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
import {
  logAdminAuthFailed,
  logExtensionUninstall,
} from "@/lib/extensions/marketplace/audit-events";
import { removeLicenseCache } from "@/lib/extensions/marketplace/license-enforcer";
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

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const admin = await requireAdmin();
    const { password } = (await request.json()) as { password?: string };

    if (!password) {
      return NextResponse.json(
        { error: "パスワードが必要です" },
        { status: 400 },
      );
    }

    const passwordValid = await verifyAdminPassword(admin.id, password);
    if (!passwordValid) {
      await logAdminAuthFailed(admin.id, "marketplace_uninstall");
      return NextResponse.json(
        { error: "パスワードが違います" },
        { status: 401 },
      );
    }

    if (extensionRegistry.getAll().length === 0) {
      await initializeExtensions("system");
    }

    const extensionId = params.id;
    const existing = extensionRegistry.get(extensionId);
    if (!existing) {
      return NextResponse.json(
        { error: "拡張が見つかりません" },
        { status: 404 },
      );
    }

    await extensionRegistry.uninstall(extensionId, admin.id);
    await fs.rm(path.join(EXTENSIONS_DIR, extensionId), {
      recursive: true,
      force: true,
    });
    await removeLicenseCache(extensionId);
    await persistExtensionState();
    await logExtensionUninstall(
      admin.id,
      extensionId,
      existing.manifest.version,
    );
    await logFeatureAction("extension.uninstall", admin.id);

    return NextResponse.json({ success: true, extensionId });
  } catch (error) {
    console.error("Marketplace uninstall error:", error);
    if (error instanceof Error && error.message === "権限が不足しています") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "アンインストールに失敗しました" },
      { status: 500 },
    );
  }
}
