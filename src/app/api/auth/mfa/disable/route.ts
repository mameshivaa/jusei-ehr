import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { disableMfa, verifyMfaCode } from "@/lib/security/mfa";
import { z } from "zod";

const disableSchema = z.object({
  code: z.string().min(6).max(8).optional(),
  userId: z.string().optional(), // 管理者が他ユーザーのMFAを無効化する場合
  reason: z.string().optional(),
});

/**
 * MFA無効化
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAuth();

    const body = await request.json();
    const { code, userId, reason } = disableSchema.parse(body);

    // 他ユーザーのMFAを無効化する場合は管理者権限が必要
    if (userId && userId !== currentUser.id) {
      await requireRole("ADMIN");
      await disableMfa(userId, currentUser.id, reason);
      return NextResponse.json({
        success: true,
        message: "ユーザーのMFAを無効化しました",
      });
    }

    // 自分のMFAを無効化する場合はコードが必要
    if (!code) {
      return NextResponse.json(
        { error: "MFAコードを入力してください" },
        { status: 400 },
      );
    }

    const valid = await verifyMfaCode(currentUser.id, code);
    if (!valid) {
      return NextResponse.json(
        { error: "認証コードが正しくありません" },
        { status: 400 },
      );
    }

    await disableMfa(currentUser.id, currentUser.id, reason);

    return NextResponse.json({
      success: true,
      message: "MFAを無効化しました",
    });
  } catch (error) {
    console.error("MFA disable error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "MFAの無効化に失敗しました" },
      { status: 500 },
    );
  }
}
