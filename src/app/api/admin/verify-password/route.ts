import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { verifyPassword } from "@/lib/security/password";
import { prisma } from "@/lib/prisma";
import { logAdminAuthFailed } from "@/lib/extensions/marketplace/audit-events";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const { password } = (await request.json()) as { password?: string };

    if (!password) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: admin.id },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);

    if (!valid) {
      await logAdminAuthFailed(admin.id, "verify_password");
    }

    return NextResponse.json({ valid });
  } catch (error) {
    console.error("Verify password error:", error);
    if (error instanceof Error && error.message === "権限が不足しています") {
      return NextResponse.json({ valid: false }, { status: 403 });
    }
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
