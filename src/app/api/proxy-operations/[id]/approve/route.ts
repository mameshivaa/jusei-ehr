import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, getAuditLogData } from "@/lib/audit";

/**
 * 代行操作の承認（ガイドライン準拠：代行操作の承認機能）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireRole("ADMIN");

    const operation = await prisma.proxyOperation.findUnique({
      where: { id: params.id },
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
    });

    if (!operation) {
      return NextResponse.json(
        { error: "代行操作が見つかりません" },
        { status: 404 },
      );
    }

    if (operation.status !== "PENDING") {
      return NextResponse.json(
        { error: "この代行操作は既に承認または却下されています" },
        { status: 400 },
      );
    }

    // 承認者は自分自身でなければならない
    if (operation.approverId !== user.id) {
      return NextResponse.json(
        { error: "この代行操作の承認権限がありません" },
        { status: 403 },
      );
    }

    // 代行操作を承認
    const updated = await prisma.proxyOperation.update({
      where: { id: params.id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
      },
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
    });

    // 監査ログを記録
    const auditData = getAuditLogData(
      request,
      user.id,
      "APPROVE",
      "PROXY_OPERATION",
      operation.id,
    );
    await createAuditLog({
      userId: auditData.userId,
      sessionId: auditData.sessionId,
      action: auditData.action || "APPROVE",
      entityType: auditData.entityType || "PROXY_OPERATION",
      entityId: auditData.entityId,
      resourcePath: auditData.resourcePath,
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
      category: "DATA_MODIFICATION",
      severity: "INFO",
      metadata: {
        operationId: operation.id,
        operatorId: operation.operatorId,
        entityType: operation.entityType,
        entityId: operation.entityId,
        action: operation.action,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Proxy operation approve error:", error);
    return NextResponse.json(
      { error: "代行操作の承認に失敗しました" },
      { status: 500 },
    );
  }
}
