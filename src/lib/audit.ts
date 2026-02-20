import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/**
 * 監査ログ（ガイドライン準拠：改ざん防止・削除禁止）
 *
 * 重要: 監査ログは削除・更新禁止
 * - prisma.auditLog.delete() や prisma.auditLog.update() は使用禁止
 * - DELETEやPUTエンドポイントを作成しないこと
 * - 記録されたログはチェックサムで整合性を検証可能
 */

type AuditLogData = {
  userId?: string;
  sessionId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  resourcePath?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  severity?: string;
  category: string;
};

/**
 * 監査ログを記録します（ガイドライン準拠）
 */
export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    const createdAt = new Date();
    // チェックサムを計算（改ざん防止）
    const logData = JSON.stringify({
      userId: data.userId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      timestamp: createdAt.toISOString(),
    });
    const checksum = crypto.createHash("sha256").update(logData).digest("hex");

    await prisma.auditLog.create({
      data: {
        userId: data.userId || null,
        sessionId: data.sessionId || null,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId || null,
        resourcePath: data.resourcePath || null,
        metadata: data.metadata ? (data.metadata as any) : null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        severity: data.severity || "INFO",
        category: data.category,
        checksum,
        createdAt,
      },
    });
  } catch (error) {
    // 監査ログの記録失敗はシステムの動作に影響しない
    console.error("Failed to create audit log:", error);
  }
}

/**
 * リクエスト情報から監査ログデータを作成
 */
export function getAuditLogData(
  request: Request,
  userId?: string,
  action?: string,
  entityType?: string,
  entityId?: string,
): Partial<AuditLogData> {
  const url = new URL(request.url);
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor
    ? forwardedFor.split(",")[0].trim()
    : request.headers.get("x-real-ip") || "unknown";

  return {
    userId,
    sessionId: request.headers.get("x-session-id") || undefined,
    action: action || request.method,
    entityType: entityType || "UNKNOWN",
    entityId,
    resourcePath: url.pathname,
    ipAddress,
    userAgent: request.headers.get("user-agent") || undefined,
  };
}

/**
 * 監査ログのチェックサムを検証
 */
export function verifyAuditLogChecksum(log: {
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: Date;
  checksum: string | null;
}): boolean {
  if (!log.checksum) {
    return false;
  }

  const logData = JSON.stringify({
    userId: log.userId,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    timestamp: log.createdAt.toISOString(),
  });
  const expectedChecksum = crypto
    .createHash("sha256")
    .update(logData)
    .digest("hex");

  return log.checksum === expectedChecksum;
}

/**
 * 監査ログの整合性を一括検証
 */
export async function verifyAuditLogIntegrity(options?: {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): Promise<{
  total: number;
  valid: number;
  invalid: number;
  invalidIds: string[];
}> {
  const where: any = {};
  if (options?.startDate || options?.endDate) {
    where.createdAt = {};
    if (options.startDate) where.createdAt.gte = options.startDate;
    if (options.endDate) where.createdAt.lte = options.endDate;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    select: {
      id: true,
      userId: true,
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      checksum: true,
    },
    take: options?.limit || 10000,
    orderBy: { createdAt: "desc" },
  });

  let valid = 0;
  let invalid = 0;
  const invalidIds: string[] = [];

  for (const log of logs) {
    if (verifyAuditLogChecksum(log)) {
      valid++;
    } else {
      invalid++;
      invalidIds.push(log.id);
    }
  }

  return {
    total: logs.length,
    valid,
    invalid,
    invalidIds,
  };
}

/**
 * 監査ログの削除は禁止（このfunctionは呼び出してはならない）
 * @deprecated 監査ログは削除禁止です
 */
export function deleteAuditLog(): never {
  throw new Error("監査ログの削除は禁止されています（ガイドライン準拠）");
}

/**
 * 監査ログの更新は禁止（このfunctionは呼び出してはならない）
 * @deprecated 監査ログは更新禁止です
 */
export function updateAuditLog(): never {
  throw new Error("監査ログの更新は禁止されています（ガイドライン準拠）");
}
