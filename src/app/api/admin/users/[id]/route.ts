import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logFeatureAction } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/**
 * ユーザー削除（管理者のみ）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireRole("ADMIN");
    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json(
        { error: "ユーザーが見つかりません" },
        { status: 404 },
      );
    }

    // 物理削除ではなく論理削除（ステータスをDELETEDに変更）
    await prisma.user.update({
      where: { id },
      data: { status: "DELETED" },
    });

    await logFeatureAction("admin.user.delete", admin.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("User delete error:", error);
    if (error instanceof Error && error.message === "権限が不足しています") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "ユーザーの削除に失敗しました" },
      { status: 500 },
    );
  }
}
