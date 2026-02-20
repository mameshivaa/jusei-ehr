import { prisma } from "@/lib/prisma";
import crypto from "crypto";

type AccessLogData = {
  userId: string;
  entityType: string;
  entityId: string;
  action: "VIEW" | "EXPORT" | "PRINT" | "READ";
  ipAddress?: string;
  userAgent?: string;
  resourcePath?: string;
  metadata?: Record<string, unknown>;
};

/**
 * 個人情報保護法対応：個人情報へのアクセスログを記録（ガイドライン準拠：閲覧ログ）
 */
export async function createAccessLog(data: AccessLogData): Promise<void> {
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

    // 監査ログに記録
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action === "VIEW" ? "READ" : data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        resourcePath: data.resourcePath || null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        severity: "INFO",
        category: "DATA_ACCESS",
        checksum,
        metadata: data.metadata ? (data.metadata as any) : null,
        createdAt,
      },
    });
  } catch (error) {
    console.error("Failed to create access log:", error);
  }
}

/**
 * 施術記録の閲覧ログを記録
 */
export async function logTreatmentRecordView(
  userId: string,
  recordId: string,
  visitId: string,
  patientId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  await createAccessLog({
    userId,
    entityType: "TREATMENT_RECORD",
    entityId: recordId,
    action: "VIEW",
    ipAddress,
    userAgent,
    metadata: {
      visitId,
      patientId,
    },
  });
}

/**
 * 来院記録の閲覧ログを記録
 */
export async function logVisitView(
  userId: string,
  visitId: string,
  patientId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  await createAccessLog({
    userId,
    entityType: "VISIT",
    entityId: visitId,
    action: "VIEW",
    ipAddress,
    userAgent,
    metadata: {
      patientId,
    },
  });
}

/**
 * 患者情報の閲覧ログを記録
 */
export async function logPatientView(
  userId: string,
  patientId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  await createAccessLog({
    userId,
    entityType: "PATIENT",
    entityId: patientId,
    action: "VIEW",
    ipAddress,
    userAgent,
  });
}

/**
 * エクスポート操作のログを記録
 */
export async function logExportOperation(
  userId: string,
  exportType: string,
  recordCount: number,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  await createAccessLog({
    userId,
    entityType: "EXPORT",
    entityId: exportType,
    action: "EXPORT",
    ipAddress,
    userAgent,
    metadata: {
      exportType,
      recordCount,
      exportedAt: new Date().toISOString(),
    },
  });
}
