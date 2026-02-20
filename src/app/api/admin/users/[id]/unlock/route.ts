import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { unlockAccount } from "@/lib/security/account-manager";
import { z } from "zod";
import { logFeatureAction } from "@/lib/activity-log";

const unlockSchema = z.object({
  reason: z.string().optional(),
});

/**
 * アカウントロック解除（管理者のみ）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const admin = await requireRole("ADMIN");

    const body = await request.json().catch(() => ({}));
    const { reason } = unlockSchema.parse(body);

    await unlockAccount(params.id, admin.id, reason);

    await logFeatureAction("admin.user.unlock", admin.id);

    return NextResponse.json({
      success: true,
      message: "アカウントのロックを解除しました",
    });
  } catch (error) {
    console.error("Account unlock error:", error);
    if (error instanceof Error && error.message === "権限が不足しています") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "アカウントのロック解除に失敗しました" },
      { status: 500 },
    );
  }
}
