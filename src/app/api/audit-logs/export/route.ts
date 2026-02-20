import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import { logFeatureAction } from "@/lib/activity-log";
import { EXPORT_TEMPLATE_VERSIONS } from "@/lib/export/template-versions";

export const dynamic = "force-dynamic";

/**
 * 監査ログのエクスポート（ガイドライン準拠：監査用エクスポート）
 */
export async function GET(request: NextRequest) {
  let auditData: ReturnType<typeof getAuditLogData> | null = null;
  let adminId: string | undefined;
  let format = "csv";
  let filters: Record<string, string | null> | null = null;
  try {
    const user = await requireRole("ADMIN");
    adminId = user.id;
    auditData = getAuditLogData(request, user.id, "EXPORT", "AUDIT_LOG");

    const { searchParams } = new URL(request.url);
    format = searchParams.get("format") || "csv";
    const entityType = searchParams.get("entityType");
    const action = searchParams.get("action");
    const userId = searchParams.get("userId");
    const patientId = searchParams.get("patientId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const severity = searchParams.get("severity");
    const category = searchParams.get("category");

    // フィルタ条件を構築
    const where: any = {};
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (severity) where.severity = severity;
    if (category) where.category = category;

    // 患者IDでフィルタ（entityIdが患者IDの場合）
    if (patientId) {
      where.OR = [
        { entityId: patientId },
        { metadata: { path: ["patientId"], equals: patientId } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    filters = { entityType, action, userId, patientId, startDate, endDate };

    // ログを取得
    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // エクスポート操作をログに記録
    if (auditData) {
      await createAuditLog({
        ...auditData,
        action: "EXPORT",
        entityType: "AUDIT_LOG",
        category: "DATA_ACCESS",
        metadata: {
          format,
          templateVersion: EXPORT_TEMPLATE_VERSIONS.auditLogCsv,
          filters,
          recordCount: logs.length,
        },
      });
    }

    await logFeatureAction("audit.export", user.id);

    if (format === "json") {
      return NextResponse.json({
        exportedAt: new Date().toISOString(),
        exportedBy: user.email,
        recordCount: logs.length,
        filters: { entityType, action, userId, patientId, startDate, endDate },
        logs: logs.map(formatLogForExport),
      });
    }

    // CSV形式
    const csvContent = generateCsv(logs);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    console.error("Audit log export error:", error);
    const message = error instanceof Error ? error.message : "unknown";
    const isAuthError = error instanceof AuthError;
    const isForbidden =
      (isAuthError && error.code === "FORBIDDEN") || message.includes("権限");
    const isUnauthorized =
      (isAuthError && error.code === "UNAUTHENTICATED") ||
      message.includes("認証");
    if (auditData && adminId) {
      await createAuditLog({
        ...auditData,
        action: "EXPORT",
        entityType: "AUDIT_LOG",
        category: "DATA_ACCESS",
        severity: "ERROR",
        metadata: {
          format,
          templateVersion: EXPORT_TEMPLATE_VERSIONS.auditLogCsv,
          filters: filters ?? {},
          success: false,
          error: message,
        },
      });
    } else {
      const fallbackAuditData = getAuditLogData(
        request,
        undefined,
        "EXPORT",
        "AUDIT_LOG",
      );
      await createAuditLog({
        ...fallbackAuditData,
        action: "EXPORT",
        entityType: "AUDIT_LOG",
        category: isForbidden || isUnauthorized ? "AUTHENTICATION" : "SYSTEM",
        severity: isForbidden || isUnauthorized ? "WARNING" : "ERROR",
        metadata: {
          format,
          templateVersion: EXPORT_TEMPLATE_VERSIONS.auditLogCsv,
          filters: filters ?? {},
          success: false,
          error: message,
        },
      });
    }
    if (isAuthError) {
      const status = isUnauthorized ? 401 : 403;
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json(
      { error: "監査ログのエクスポートに失敗しました" },
      { status: 500 },
    );
  }
}

function formatLogForExport(log: any) {
  return {
    id: log.id,
    timestamp: log.createdAt.toISOString(),
    userId: log.userId,
    userName: log.user?.name || "システム",
    userEmail: log.user?.email || "-",
    userRole: log.user?.role || "-",
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId || "-",
    resourcePath: log.resourcePath || "-",
    ipAddress: log.ipAddress || "-",
    userAgent: log.userAgent || "-",
    severity: log.severity,
    category: log.category,
    checksum: log.checksum || "-",
    metadata: log.metadata ? JSON.stringify(log.metadata) : "-",
  };
}

function generateCsv(logs: any[]): string {
  const headers = [
    "ID",
    "日時",
    "ユーザーID",
    "ユーザー名",
    "メールアドレス",
    "ロール",
    "操作",
    "対象種別",
    "対象ID",
    "リソースパス",
    "IPアドレス",
    "ユーザーエージェント",
    "重要度",
    "カテゴリ",
    "チェックサム",
    "メタデータ",
  ];

  const rows = logs.map((log) => {
    const formatted = formatLogForExport(log);
    return [
      formatted.id,
      formatted.timestamp,
      formatted.userId,
      formatted.userName,
      formatted.userEmail,
      formatted.userRole,
      formatted.action,
      formatted.entityType,
      formatted.entityId,
      formatted.resourcePath,
      formatted.ipAddress,
      escapeForCsv(formatted.userAgent),
      formatted.severity,
      formatted.category,
      formatted.checksum,
      escapeForCsv(formatted.metadata),
    ].map((v) => escapeForCsv(String(v)));
  });

  // BOM + ヘッダー + データ
  const bom = "\uFEFF";
  return (
    bom + [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
  );
}

function escapeForCsv(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
