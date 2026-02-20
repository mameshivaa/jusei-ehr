import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAvailableDocumentTypes } from "@/lib/documents/document-manager";

/**
 * 利用可能な文書タイプ一覧を取得
 */
export async function GET() {
  try {
    await requireAuth();

    const types = getAvailableDocumentTypes();

    return NextResponse.json({ types });
  } catch (error) {
    console.error("Document types error:", error);
    return NextResponse.json(
      { error: "文書タイプの取得に失敗しました" },
      { status: 500 },
    );
  }
}
