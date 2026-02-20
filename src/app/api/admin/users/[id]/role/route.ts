import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { changeUserRole } from "@/lib/security/account-manager";
import { canChangeRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { logFeatureAction } from "@/lib/activity-log";

const roleSchema = z.object({
  role: z.enum(["ADMIN", "PRACTITIONER", "RECEPTION"]),
  reason: z.string().optional(),
});

/**
 * ユーザーロール変更（管理者のみ）
 * ロール階層に基づき、自分より上位のロールへの変更は禁止
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const admin = await requireRole("ADMIN");

    // 自分自身のロールは変更不可
    if (params.id === admin.id) {
      return NextResponse.json(
        { error: "自分自身のロールは変更できません" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { role, reason } = roleSchema.parse(body);

    // 対象ユーザーの現在のロールを取得
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { role: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "ユーザーが見つかりません" },
        { status: 404 },
      );
    }

    if (role === "ADMIN") {
      const adminCount = await prisma.user.count({
        where: { role: "ADMIN" },
      });
      if (adminCount >= 1) {
        return NextResponse.json(
          { error: "管理者は1人のみ設定できます" },
          { status: 400 },
        );
      }
    }

    // ロール階層チェック
    if (!canChangeRole(admin.role as UserRole, targetUser.role, role)) {
      return NextResponse.json(
        {
          error:
            "自分と同等以上のロールへの変更、または自分より上位のユーザーの変更はできません",
        },
        { status: 403 },
      );
    }

    await changeUserRole(params.id, role, admin.id, reason);

    await logFeatureAction("admin.user.role.update", admin.id);

    return NextResponse.json({
      success: true,
      message: "ユーザーロールを変更しました",
      role,
    });
  } catch (error) {
    console.error("Role change error:", error);
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
      { error: "ロールの変更に失敗しました" },
      { status: 500 },
    );
  }
}
