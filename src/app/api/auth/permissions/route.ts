import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getUserPermissions,
  getAvailableRoles,
  getRoleDisplayName,
} from "@/lib/rbac";
import { UserRole } from "@prisma/client";

/**
 * 現在のユーザーの権限を取得
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const permissions = getUserPermissions(user.role as UserRole);
    const roleDisplayName = getRoleDisplayName(user.role as UserRole);

    return NextResponse.json({
      userId: user.id,
      role: user.role,
      roleDisplayName,
      permissions,
      availableRoles: getAvailableRoles(),
    });
  } catch (error) {
    console.error("Permissions fetch error:", error);
    return NextResponse.json(
      { error: "権限情報の取得に失敗しました" },
      { status: 500 },
    );
  }
}
