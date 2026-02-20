import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { restoreBackup } from "@/lib/backup/backup-manager";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import { logFeatureAction } from "@/lib/activity-log";
import { normalizeBackupFileName } from "@/lib/backup/backup-file-name";

/**
 * バックアップ復元（ガイドライン準拠：バックアップ機能）
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("ADMIN");

    const body = await request.json();
    const { fileName, e2eForceFailAfterMove } = body ?? {};

    if (!fileName) {
      return NextResponse.json(
        { error: "fileNameが必要です" },
        { status: 400 },
      );
    }
    const isE2E =
      process.env.E2E_MODE === "true" && process.env.NODE_ENV !== "production";
    const forceFailAfterMove = isE2E && e2eForceFailAfterMove === true;
    const safeFileName = normalizeBackupFileName(String(fileName));
    if (!safeFileName) {
      return NextResponse.json(
        { error: "不正なバックアップファイル名です" },
        { status: 400 },
      );
    }

    const startedAt = Date.now();
    const result = await restoreBackup(safeFileName, {
      e2eForceFailAfterMove: forceFailAfterMove,
    });
    const durationMs = Date.now() - startedAt;
    const rpoSeconds =
      result.backupCreatedAt &&
      !Number.isNaN(Date.parse(result.backupCreatedAt))
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - Date.parse(result.backupCreatedAt)) / 1000,
            ),
          )
        : null;

    if (!result.success) {
      const auditData = getAuditLogData(request, user.id, "RESTORE", "BACKUP");
      await createAuditLog({
        userId: auditData.userId,
        sessionId: auditData.sessionId,
        action: "RESTORE",
        entityType: "BACKUP",
        resourcePath: auditData.resourcePath,
        ipAddress: auditData.ipAddress,
        userAgent: auditData.userAgent,
        category: "SYSTEM",
        severity: "ERROR",
        metadata: {
          fileName: safeFileName,
          success: false,
          durationMs,
          backupCreatedAt: result.backupCreatedAt || null,
          rpoSeconds,
          error: result.error || "restore_failed",
        },
      });

      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // 監査ログを記録
    const auditData = getAuditLogData(request, user.id, "RESTORE", "BACKUP");
    await createAuditLog({
      userId: auditData.userId,
      sessionId: auditData.sessionId,
      action: "RESTORE",
      entityType: "BACKUP",
      resourcePath: auditData.resourcePath,
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
      category: "SYSTEM",
      severity: "WARNING",
      metadata: {
        fileName: safeFileName,
        success: true,
        durationMs,
        backupCreatedAt: result.backupCreatedAt || null,
        rpoSeconds,
      },
    });

    await logFeatureAction("backup.restore", user.id);

    return NextResponse.json({ success: true, restartRequired: true });
  } catch (error) {
    console.error("Backup restore error:", error);
    return NextResponse.json(
      { error: "バックアップの復元に失敗しました" },
      { status: 500 },
    );
  }
}
