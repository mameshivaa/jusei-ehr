import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/security/password";
import { logFeatureAction } from "@/lib/activity-log";
import { createAuditLog, getAuditLogData } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * ユーザー一覧取得（管理者のみ）
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireRole("ADMIN");

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const role = searchParams.get("role");

    const where: Record<string, string> = {};
    if (status) where.status = status;
    if (role) where.role = role;

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        mfaEnabled: true,
        failedLoginCount: true,
        lockedUntil: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const auditData = getAuditLogData(request, admin.id, "READ", "USER");
    await createAuditLog({
      ...auditData,
      action: "READ",
      entityType: "USER",
      category: "SYSTEM",
      metadata: {
        filters: { status: status || "", role: role || "" },
        recordCount: users.length,
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("User list error:", error);
    if (error instanceof Error && error.message === "権限が不足しています") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "ユーザー一覧の取得に失敗しました" },
      { status: 500 },
    );
  }
}

/**
 * ユーザー追加（管理者のみ）
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireRole("ADMIN");

    const body = await request.json();
    const { name, email, password, role } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "氏名・ログインID・パスワードは必須です" },
        { status: 400 },
      );
    }

    if (email.length < 4) {
      return NextResponse.json(
        { error: "ログインIDは4文字以上にしてください" },
        { status: 400 },
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: "パスワードは4文字以上にしてください" },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "このログインIDは既に登録されています" },
        { status: 400 },
      );
    }

    const requestedRole = role || "RECEPTION";
    if (requestedRole === "ADMIN") {
      const adminCount = await prisma.user.count({
        where: { role: "ADMIN" },
      });
      if (adminCount >= 1) {
        return NextResponse.json(
          { error: "管理者は1人のみ作成できます" },
          { status: 400 },
        );
      }
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        role: requestedRole,
        status: "ACTIVE",
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        mfaEnabled: true,
        failedLoginCount: true,
        lockedUntil: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const auditData = getAuditLogData(
      request,
      admin.id,
      "CREATE",
      "USER",
      user.id,
    );
    await createAuditLog({
      ...auditData,
      action: "CREATE",
      entityType: "USER",
      entityId: user.id,
      category: "SYSTEM",
      metadata: {
        role: user.role,
        status: user.status,
      },
    });

    await logFeatureAction("admin.user.create", admin.id);

    return NextResponse.json(user);
  } catch (error) {
    console.error("User create error:", error);
    if (error instanceof Error && error.message === "権限が不足しています") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "ユーザーの追加に失敗しました" },
      { status: 500 },
    );
  }
}
