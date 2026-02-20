import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDocument, deleteDocument } from "@/lib/documents/document-manager";
import { createAccessLog } from "@/lib/security/access-log";
import { getAuditLogData } from "@/lib/audit";
import { requireApiPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/**
 * 文書詳細取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();

    // 権限チェック
    await requireApiPermission(user.id, "SCANNED_DOCUMENT", "READ");

    const result = await getDocument(params.id);

    if (!result) {
      return NextResponse.json(
        { error: "文書が見つかりません" },
        { status: 404 },
      );
    }

    // 閲覧ログを記録
    const auditData = getAuditLogData(
      request,
      user.id,
      "READ",
      "SCANNED_DOCUMENT",
      params.id,
    );
    await createAccessLog({
      userId: user.id,
      entityType: "SCANNED_DOCUMENT",
      entityId: params.id,
      action: "VIEW",
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
      metadata: {
        patientId: result.document.patientId,
        documentType: result.document.documentType,
      },
    });

    // ファイルダウンロードの場合
    const { searchParams } = new URL(request.url);
    if (searchParams.get("download") === "true" && result.fileBuffer) {
      return new NextResponse(result.fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": result.document.mimeType,
          "Content-Disposition": `attachment; filename="${encodeURIComponent(result.document.fileName)}"`,
          "Content-Length": result.fileBuffer.length.toString(),
        },
      });
    }

    // メタデータのみを返す
    return NextResponse.json({
      document: {
        id: result.document.id,
        patientId: result.document.patientId,
        documentType: result.document.documentType,
        title: result.document.title,
        description: result.document.description,
        originalExists: result.document.originalExists,
        isReference: result.document.isReference,
        originalDate: result.document.originalDate,
        scannedAt: result.document.scannedAt,
        fileName: result.document.fileName,
        fileSize: result.document.fileSize,
        mimeType: result.document.mimeType,
        resolution: result.document.resolution,
        colorMode: result.document.colorMode,
        patient: result.document.patient,
        scannedByUser: result.document.scannedByUser,
      },
    });
  } catch (error) {
    console.error("Document fetch error:", error);
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "文書の取得に失敗しました" },
      { status: 500 },
    );
  }
}

/**
 * 文書削除（論理削除）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();

    // 権限チェック
    await requireApiPermission(user.id, "SCANNED_DOCUMENT", "DELETE");

    const body = await request.json().catch(() => ({}));
    const reason = body.reason || "削除理由未指定";

    const success = await deleteDocument(params.id, user.id, reason);

    if (!success) {
      return NextResponse.json(
        { error: "文書が見つかりません" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "文書を削除しました",
    });
  } catch (error) {
    console.error("Document delete error:", error);
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "文書の削除に失敗しました" },
      { status: 500 },
    );
  }
}
