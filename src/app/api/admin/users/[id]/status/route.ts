import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { changeAccountStatus } from "@/lib/security/account-manager";
import { z } from "zod";
import { logFeatureAction } from "@/lib/activity-log";

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]),
  reason: z.string().optional(),
});

/**
 * アカウント状態変更（管理者のみ）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const admin = await requireRole("ADMIN");

    // 自分自身のステータスは変更不可
    if (params.id === admin.id) {
      return NextResponse.json(
        { error: "自分自身のステータスは変更できません" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { status, reason } = statusSchema.parse(body);

    await changeAccountStatus(params.id, status, admin.id, reason);

    await logFeatureAction("admin.user.status.update", admin.id);

    return NextResponse.json({
      success: true,
      message: "アカウントステータスを変更しました",
      status,
    });
  } catch (error) {
    console.error("Account status change error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "権限が不足しています") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "ステータスの変更に失敗しました" },
      { status: 500 },
    );
  }
}
