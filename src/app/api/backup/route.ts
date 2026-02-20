import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  createBackup,
  createEncryptedBackup,
  listBackups,
  deleteBackup,
} from "@/lib/backup/backup-manager";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import { getSetting } from "@/lib/settings";
import {
  getBackupLocationStatus,
  getBackupMissingStatus,
} from "@/lib/backup/backup-manager";
import { logFeatureAction } from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";
import path from "path";
import { normalizeBackupFileName } from "@/lib/backup/backup-file-name";

export const dynamic = "force-dynamic";

/**
 * バックアップ一覧取得・作成（ガイドライン準拠：バックアップ機能）
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole("ADMIN");

    const result = await listBackups();
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    const lastBackupAt = await getSetting("lastBackupAt");
    const [
      locationStatus,
      missingStatus,
      externalBackupMissingAt,
      lastExternalBackupAt,
      customBackupMissingAt,
      lastCustomBackupAt,
    ] = await Promise.all([
      getBackupLocationStatus(),
      getBackupMissingStatus(),
      getSetting("externalBackupMissingAt"),
      getSetting("lastExternalBackupAt"),
      getSetting("customBackupMissingAt"),
      getSetting("lastCustomBackupAt"),
    ]);

    return NextResponse.json({
      backups: result.backups || [],
      lastBackupAt: lastBackupAt || "",
      locationStatus,
      missingStatus,
      externalBackupMissingAt: externalBackupMissingAt || "",
      lastExternalBackupAt: lastExternalBackupAt || "",
      customBackupMissingAt: customBackupMissingAt || "",
      lastCustomBackupAt: lastCustomBackupAt || "",
    });
  } catch (error) {
    console.error("Backup list error:", error);
    return NextResponse.json(
      { error: "バックアップ一覧の取得に失敗しました" },
      { status: 500 },
    );
  }
}

/**
 * バックアップ作成
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("ADMIN");

    const body = (await request.json().catch(() => ({}))) as {
      description?: unknown;
      encrypted?: unknown;
      password?: unknown;
    };
    const description =
      typeof body.description === "string" ? body.description : "";
    const encrypted = body.encrypted === true;
    if (typeof body.password !== "undefined") {
      return NextResponse.json(
        {
          error:
            "個別パスワード指定は廃止されました。暗号化バックアップはBACKUP_SECRETを使用します。",
        },
        { status: 400 },
      );
    }

    const startedAt = Date.now();
    const result = encrypted
      ? await createEncryptedBackup(description)
      : await createBackup(description);
    const durationMs = Date.now() - startedAt;
    const finishedAt = new Date();
    const startedAtDate = new Date(finishedAt.getTime() - durationMs);
    const backupFileName = result.backupPath
      ? path.basename(result.backupPath)
      : null;

    if (!result.success) {
      await prisma.backupRunLog.create({
        data: {
          runType: "MANUAL",
          success: false,
          startedAt: startedAtDate,
          finishedAt,
          durationMs,
          backupFileName,
          encrypted: encrypted || false,
          description: description || "",
          error: result.error || "backup_failed",
          createdBy: user.id,
        },
      });
      const auditData = getAuditLogData(request, user.id, "CREATE", "BACKUP");
      await createAuditLog({
        userId: auditData.userId,
        sessionId: auditData.sessionId,
        action: "CREATE",
        entityType: "BACKUP",
        resourcePath: auditData.resourcePath,
        ipAddress: auditData.ipAddress,
        userAgent: auditData.userAgent,
        category: "SYSTEM",
        severity: "ERROR",
        metadata: {
          success: false,
          encrypted: encrypted || false,
          description: description || "",
          durationMs,
          error: result.error || "backup_failed",
        },
      });
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    await prisma.backupRunLog.create({
      data: {
        runType: "MANUAL",
        success: true,
        startedAt: startedAtDate,
        finishedAt,
        durationMs,
        backupFileName,
        encrypted: encrypted || false,
        description: description || "",
        createdBy: user.id,
      },
    });

    // 監査ログを記録
    const auditData = getAuditLogData(request, user.id, "CREATE", "BACKUP");
    await createAuditLog({
      userId: auditData.userId,
      sessionId: auditData.sessionId,
      action: "CREATE",
      entityType: "BACKUP",
      resourcePath: auditData.resourcePath,
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
      category: "SYSTEM",
      severity: "INFO",
      metadata: {
        backupPath: result.backupPath,
        encrypted: encrypted || false,
        description: description || "",
        durationMs,
        success: true,
      },
    });

    await logFeatureAction(
      encrypted ? "backup.create.encrypted" : "backup.create",
      user.id,
    );

    return NextResponse.json({
      success: true,
      backupPath: result.backupPath,
    });
  } catch (error) {
    console.error("Backup creation error:", error);
    return NextResponse.json(
      { error: "バックアップの作成に失敗しました" },
      { status: 500 },
    );
  }
}

/**
 * バックアップ削除
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireRole("ADMIN");

    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get("fileName");

    if (!fileName) {
      return NextResponse.json(
        { error: "fileNameが必要です" },
        { status: 400 },
      );
    }
    const safeFileName = normalizeBackupFileName(fileName);
    if (!safeFileName) {
      return NextResponse.json(
        { error: "不正なバックアップファイル名です" },
        { status: 400 },
      );
    }

    const startedAt = Date.now();
    const result = await deleteBackup(safeFileName);
    const durationMs = Date.now() - startedAt;
    const finishedAt = new Date();
    const startedAtDate = new Date(finishedAt.getTime() - durationMs);
    if (!result.success) {
      await prisma.backupRunLog.create({
        data: {
          runType: "MANUAL",
          success: false,
          startedAt: startedAtDate,
          finishedAt,
          durationMs,
          backupFileName: safeFileName,
          encrypted: false,
          description: "delete",
          error: result.error || "backup_delete_failed",
          createdBy: user.id,
        },
      });
      const auditData = getAuditLogData(request, user.id, "DELETE", "BACKUP");
      await createAuditLog({
        userId: auditData.userId,
        sessionId: auditData.sessionId,
        action: "DELETE",
        entityType: "BACKUP",
        resourcePath: auditData.resourcePath,
        ipAddress: auditData.ipAddress,
        userAgent: auditData.userAgent,
        category: "SYSTEM",
        severity: "ERROR",
        metadata: {
          fileName: safeFileName,
          durationMs,
          success: false,
          error: result.error || "backup_delete_failed",
        },
      });
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    await prisma.backupRunLog.create({
      data: {
        runType: "MANUAL",
        success: true,
        startedAt: startedAtDate,
        finishedAt,
        durationMs,
        backupFileName: safeFileName,
        encrypted: false,
        description: "delete",
        createdBy: user.id,
      },
    });

    // 監査ログを記録
    const auditData = getAuditLogData(request, user.id, "DELETE", "BACKUP");
    await createAuditLog({
      userId: auditData.userId,
      sessionId: auditData.sessionId,
      action: "DELETE",
      entityType: "BACKUP",
      resourcePath: auditData.resourcePath,
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
      category: "SYSTEM",
      severity: "INFO",
      metadata: {
        fileName: safeFileName,
        durationMs,
        success: true,
      },
    });

    await logFeatureAction("backup.delete", user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Backup delete error:", error);
    return NextResponse.json(
      { error: "バックアップの削除に失敗しました" },
      { status: 500 },
    );
  }
}
