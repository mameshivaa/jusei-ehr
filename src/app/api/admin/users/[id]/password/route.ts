import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { resetUserPassword } from "@/lib/security/account-manager";
import { z } from "zod";
import { logFeatureAction } from "@/lib/activity-log";
import {
  getPasswordPolicyErrors,
  PASSWORD_MAX_LENGTH,
} from "@/lib/security/password-policy";

const passwordSchema = z.object({
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
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
    const passwordPolicyErrors = getPasswordPolicyErrors(password);
    if (passwordPolicyErrors.length > 0) {
      return NextResponse.json(
        { error: passwordPolicyErrors[0] },
        { status: 400 },
      );
    }

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
