import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac";
import { createAccessLog } from "@/lib/security/access-log";
import { getAuditLogData } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * 文書一覧取得
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // 権限チェック
    await requireApiPermission(user.id, "SCANNED_DOCUMENT", "READ");

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");
    const documentType = searchParams.get("documentType");

    if (!patientId) {
      return NextResponse.json(
        { error: "patientIdが必要です" },
        { status: 400 },
      );
    }

    const documents = await prisma.scannedDocument.findMany({
      where: {
        patientId,
        isDeleted: false,
        ...(documentType && { documentType }),
      },
      include: {
        scannedByUser: {
          select: { id: true, name: true },
        },
      },
      orderBy: { scannedAt: "desc" },
    });

    // アクセスログを記録
    const auditData = getAuditLogData(
      request,
      user.id,
      "READ",
      "SCANNED_DOCUMENT",
    );
    await createAccessLog({
      userId: user.id,
      entityType: "SCANNED_DOCUMENT",
      entityId: patientId,
      action: "VIEW",
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Document list error:", error);
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "文書一覧の取得に失敗しました" },
      { status: 500 },
    );
  }
}
