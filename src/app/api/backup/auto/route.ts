import { NextRequest, NextResponse } from "next/server";
import { runAutoBackupWithCooldown } from "@/lib/backup/backup-manager";
import { getBackupSecret } from "@/lib/backup/backup-secret";
import { logFeatureAction } from "@/lib/activity-log";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import path from "path";

export const dynamic = "force-dynamic";

const normalizeBearerToken = (value: string | null): string =>
  (value || "").replace(/^Bearer\\s+/i, "").trim();

/**
 * 自動バックアップAPI（内部用またはcronから呼び出し）
 *
 * 認証: BACKUP_SECRET と同じ値をAuthorizationヘッダーに設定
 */
export async function POST(request: NextRequest) {
  try {
    // 簡易認証（BACKUP_SECRETと一致するか確認）
    const authHeader = request.headers.get("Authorization");
    const expectedSecret = normalizeBearerToken(await getBackupSecret());

    if (!expectedSecret || expectedSecret.length < 8) {
      return NextResponse.json(
        { error: "BACKUP_SECRET が設定されていません" },
        { status: 500 },
      );
    }

    // Bearer token形式または直接シークレット
    const providedSecret = normalizeBearerToken(authHeader);
    if (providedSecret !== expectedSecret) {
      return NextResponse.json({ error: "認証失敗" }, { status: 401 });
    }

    const startedAt = Date.now();
    const result = await runAutoBackupWithCooldown(12);
    const durationMs = Date.now() - startedAt;
    const finishedAt = new Date();
    const startedAtDate = new Date(finishedAt.getTime() - durationMs);
    const backupFileName = result.backupPath
      ? path.basename(result.backupPath)
      : null;

    if (!result.success) {
      await prisma.backupRunLog.create({
        data: {
          runType: "AUTO",
          success: false,
          startedAt: startedAtDate,
          finishedAt,
          durationMs,
          backupFileName,
          encrypted: true,
          deletedCount: result.deletedCount ?? null,
          error: result.error || "auto_backup_failed",
        },
      });
      const auditData = getAuditLogData(
        request,
        undefined,
        "AUTO_BACKUP",
        "BACKUP",
      );
      await createAuditLog({
        ...auditData,
        action: "AUTO_BACKUP",
        entityType: "BACKUP",
        category: "SYSTEM",
        severity: "ERROR",
        metadata: {
          success: false,
          durationMs,
          error: result.error || "auto_backup_failed",
        },
      });
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    if (!result.skipped) {
      await logFeatureAction("backup.auto");
    }

    if (!result.skipped) {
      await prisma.backupRunLog.create({
        data: {
          runType: "AUTO",
          success: true,
          startedAt: startedAtDate,
          finishedAt,
          durationMs,
          backupFileName,
          encrypted: true,
          deletedCount: result.deletedCount ?? null,
        },
      });
    }

    const auditData = getAuditLogData(
      request,
      undefined,
      "AUTO_BACKUP",
      "BACKUP",
    );
    await createAuditLog({
      ...auditData,
      action: "AUTO_BACKUP",
      entityType: "BACKUP",
      category: "SYSTEM",
      severity: "INFO",
      metadata: {
        success: true,
        skipped: result.skipped ?? false,
        durationMs,
        backupPath: result.backupPath || "",
        deletedCount: result.deletedCount ?? 0,
      },
    });

    return NextResponse.json({
      success: true,
      skipped: result.skipped ?? false,
      backupPath: result.backupPath,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Auto backup API error:", error);
    return NextResponse.json(
      { error: "自動バックアップに失敗しました" },
      { status: 500 },
    );
  }
}
