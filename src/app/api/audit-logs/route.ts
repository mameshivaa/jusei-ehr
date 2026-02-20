import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * 監査ログの取得（管理者のみ）
 */
export async function GET(request: NextRequest) {
  let userId: string | undefined;
  let requestedFilters: {
    entityType: string | null;
    action: string | null;
    startDate: string | null;
    endDate: string | null;
  } | null = null;
  let page = 1;
  let limit = 50;
  try {
    const user = await requireRole("ADMIN");
    userId = user.id;

    const { searchParams } = new URL(request.url);
    page = parseInt(searchParams.get("page") || "1");
    limit = parseInt(searchParams.get("limit") || "50");
    const entityType = searchParams.get("entityType");
    const action = searchParams.get("action");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    requestedFilters = { entityType, action, startDate, endDate };

    const where: any = {};
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;
    if (startDate || endDate) {
      where.createdAt = {};
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
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const auditData = getAuditLogData(request, userId, "READ", "AUDIT_LOG");
    await createAuditLog({
      ...auditData,
      action: "READ",
      entityType: "AUDIT_LOG",
      category: "DATA_ACCESS",
      metadata: {
        filters: requestedFilters,
        page,
        limit,
        resultCount: logs.length,
      },
    });

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Audit log fetch error:", error);
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
      { error: "監査ログの取得に失敗しました" },
      { status: 500 },
    );
  }
}
