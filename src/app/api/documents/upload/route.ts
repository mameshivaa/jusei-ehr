import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  uploadDocument,
  DocumentType,
  validateMimeType,
  validateFileSize,
} from "@/lib/documents/document-manager";
import { requireApiPermission } from "@/lib/rbac";

/**
 * 文書アップロード（ガイドライン準拠：スキャナ取り込み）
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // 権限チェック
    await requireApiPermission(user.id, "SCANNED_DOCUMENT", "CREATE");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const patientId = formData.get("patientId") as string | null;
    const documentType = formData.get("documentType") as DocumentType | null;
    const title = formData.get("title") as string | null;
    const description = formData.get("description") as string | null;
    const originalExists = formData.get("originalExists") === "true";
    const isReference = formData.get("isReference") === "true";
    const originalDate = formData.get("originalDate") as string | null;
    const resolution = formData.get("resolution");
    const colorMode = formData.get("colorMode") as
      | "COLOR"
      | "GRAYSCALE"
      | "MONOCHROME"
      | null;

    // バリデーション
    if (!file) {
      return NextResponse.json(
        { error: "ファイルが必要です" },
        { status: 400 },
      );
    }

    if (!patientId) {
      return NextResponse.json({ error: "患者IDが必要です" }, { status: 400 });
    }

    if (!documentType) {
      return NextResponse.json(
        { error: "文書種別が必要です" },
        { status: 400 },
      );
    }

    // MIMEタイプチェック
    if (!validateMimeType(file.type)) {
      return NextResponse.json(
        {
          error:
            "許可されていないファイル形式です。PDF、JPEG、PNG、TIFFのみ許可されています。",
        },
        { status: 400 },
      );
    }

    // ファイルサイズチェック
    if (!validateFileSize(file.size)) {
      return NextResponse.json(
        { error: "ファイルサイズが上限（20MB）を超えています" },
        { status: 400 },
      );
    }

    // ファイルをBufferに変換
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // アップロード処理
    const result = await uploadDocument(
      buffer,
      file.name,
      file.type,
      {
        patientId,
        documentType,
        title: title || undefined,
        description: description || undefined,
        originalExists,
        isReference,
        originalDate: originalDate ? new Date(originalDate) : undefined,
        resolution: resolution ? parseInt(resolution as string, 10) : undefined,
        colorMode: colorMode || undefined,
      },
      user.id,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      documentId: result.documentId,
      warning: result.warning,
    });
  } catch (error) {
    console.error("Document upload error:", error);
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "文書のアップロードに失敗しました" },
      { status: 500 },
    );
  }
}
