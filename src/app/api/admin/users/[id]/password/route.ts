import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { resetUserPassword } from "@/lib/security/account-manager";
import { z } from "zod";
import { logFeatureAction } from "@/lib/activity-log";

const passwordSchema = z.object({
  // スタッフ用は簡易パスワードを許容（最低4文字、上限128）
  password: z.string().min(4).max(128),
});

/**
 * パスワードリセット（管理者のみ）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const admin = await requireRole("ADMIN");

    if (params.id === admin.id) {
      return NextResponse.json(
        { error: "自分自身のパスワードはここでは変更できません" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { password } = passwordSchema.parse(body);

    await resetUserPassword(params.id, password, admin.id);

    await logFeatureAction("admin.user.password.reset", admin.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Password reset error:", error);
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
      { error: "パスワードの更新に失敗しました" },
      { status: 500 },
    );
  }
}
