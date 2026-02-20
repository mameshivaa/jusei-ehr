import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, getAuditLogData } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * 代行操作一覧取得（ガイドライン準拠：代行操作の承認機能）
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRole("ADMIN");

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // "PENDING", "APPROVED", "REJECTED", または null（全て）

    const where: {
      status?: string;
    } = {};

    if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      where.status = status;
    }

    const operations = await prisma.proxyOperation.findMany({
      where,
      include: {
        operator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 監査ログを記録
    const auditData = getAuditLogData(
      request,
      user.id,
      "READ",
      "PROXY_OPERATION",
    );
    await createAuditLog({
      userId: auditData.userId,
      sessionId: auditData.sessionId,
      action: auditData.action || "READ",
      entityType: auditData.entityType || "PROXY_OPERATION",
      resourcePath: auditData.resourcePath,
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
      category: "DATA_ACCESS",
      severity: "INFO",
      metadata: {
        status: status || "ALL",
        count: operations.length,
      },
    });

    return NextResponse.json(operations);
  } catch (error) {
    console.error("Proxy operations list error:", error);
    return NextResponse.json(
      { error: "代行操作一覧の取得に失敗しました" },
      { status: 500 },
    );
  }
}
