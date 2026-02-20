import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * カルテ関連監査ログの取得（管理者のみ）
 * - 監査ログのうち entityType === "CHART" を対象
 * - 付加情報としてカルテに紐づく患者情報を返す
 */
export async function GET(request: NextRequest) {
  let userId: string | undefined;
  let requestedFilters: {
    action: string | null;
    startDate: string | null;
    endDate: string | null;
  } | null = null;
  let page = 1;
  let limit = 50;
  try {
    const user = await requireAuth();
    userId = user.id;

    const { searchParams } = new URL(request.url);
    page = parseInt(searchParams.get("page") || "1", 10);
    limit = parseInt(searchParams.get("limit") || "50", 10);
    const action = searchParams.get("action");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    requestedFilters = { action, startDate, endDate };

    const where: any = { entityType: "CHART" };
    if (action) where.action = action;
    if (startDate || endDate) {
      where.createdAt = {} as any;
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
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
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    // 関連カルテ+患者情報をまとめて取得
    const chartIds = Array.from(
      new Set(logs.map((log) => log.entityId).filter(Boolean)),
    ) as string[];

    const charts = await prisma.chart.findMany({
      where: { id: { in: chartIds } },
      select: {
        id: true,
        patient: {
          select: {
            id: true,
            name: true,
            kana: true,
            patientNumber: true,
          },
        },
      },
    });

    const chartMap = new Map(charts.map((c) => [c.id, c.patient]));

    const enrichedLogs = logs.map((log) => ({
      ...log,
      chartPatient: log.entityId ? chartMap.get(log.entityId) || null : null,
    }));

    const auditData = getAuditLogData(request, userId, "READ", "AUDIT_LOG");
    await createAuditLog({
      ...auditData,
      action: "READ",
      entityType: "AUDIT_LOG",
      category: "DATA_ACCESS",
      metadata: {
        view: "CHART_LOGS",
        filters: requestedFilters,
        page,
        limit,
        resultCount: enrichedLogs.length,
      },
    });

    return NextResponse.json({
      logs: enrichedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Chart audit log fetch error:", error);
    const message = error instanceof Error ? error.message : "unknown";
    const isAuthError = error instanceof AuthError;
    const isForbidden =
      (isAuthError && error.code === "FORBIDDEN") || message.includes("権限");
    const isUnauthorized =
      (isAuthError && error.code === "UNAUTHENTICATED") ||
      message.includes("認証");
    const auditData = getAuditLogData(request, userId, "READ", "AUDIT_LOG");
    await createAuditLog({
      ...auditData,
      action: "READ",
      entityType: "AUDIT_LOG",
      category: isForbidden || isUnauthorized ? "AUTHENTICATION" : "SYSTEM",
      severity: isForbidden || isUnauthorized ? "WARNING" : "ERROR",
      metadata: {
        success: false,
        view: "CHART_LOGS",
        reason: message,
        filters: requestedFilters,
        page,
        limit,
      },
    });
    if (isAuthError) {
      const status = isUnauthorized ? 401 : 403;
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json(
      { error: "カルテ操作ログの取得に失敗しました" },
      { status: 500 },
    );
  }
}
