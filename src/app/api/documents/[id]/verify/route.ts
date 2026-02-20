import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { verifyDocument } from "@/lib/documents/document-manager";
import { requireApiPermission } from "@/lib/rbac";
import { z } from "zod";

const verifySchema = z.object({
  note: z.string().optional(),
});

/**
 * 文書の原本照合を実行（ガイドライン準拠）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();

    // 権限チェック
    await requireApiPermission(user.id, "SCANNED_DOCUMENT", "UPDATE");

    const body = await request.json().catch(() => ({}));
    const { note } = verifySchema.parse(body);

    const success = await verifyDocument(params.id, user.id, note);

    if (!success) {
      return NextResponse.json(
        { error: "文書が見つかりません" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "原本照合を記録しました",
      verifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Document verification error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "原本照合の記録に失敗しました" },
      { status: 500 },
    );
  }
}
