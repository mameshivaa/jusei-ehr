import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getRecoveryCodeHash,
  verifyRecoveryCode,
} from "@/lib/security/recovery-code";
import {
  recordLoginFailure,
  resetUserPassword,
} from "@/lib/security/account-manager";
import { createAuditLog, getAuditLogData } from "@/lib/audit";

const recoverSchema = z.object({
  email: z.string().min(1).optional(),
  recoveryCode: z.string().min(1, "復旧コードを入力してください"),
  newPassword: z
    .string()
    .min(4, "パスワードは4文字以上にしてください")
    .max(256),
});

function getClientIp(request: NextRequest): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim();
  }
  return request.headers.get("x-real-ip") || request.ip || undefined;
}

export async function POST(request: NextRequest) {
  let body: z.infer<typeof recoverSchema>;
  try {
    const raw = await request.json();
    body = recoverSchema.parse(raw);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "復旧に失敗しました" }, { status: 400 });
  }

  const clientIp = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || undefined;

  let user: {
    id: string;
    email: string;
    role: string;
    status: string;
    lockedUntil: Date | null;
  } | null = null;

  if (body.email) {
    const identifier = body.email.trim().toLowerCase();
    user = await prisma.user.findUnique({
      where: { email: identifier },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        lockedUntil: true,
      },
    });
  } else {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        lockedUntil: true,
      },
      orderBy: { createdAt: "asc" },
      take: 1,
    });
    if (admins.length >= 1) {
      user = admins[0];
    }
  }

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "復旧に失敗しました" }, { status: 401 });
  }

  if (user.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "アカウントが利用できません" },
      { status: 403 },
    );
  }

  if (user.lockedUntil && new Date() < user.lockedUntil) {
    return NextResponse.json(
      {
        error: "アカウントがロックされています",
        lockedUntil: user.lockedUntil,
      },
      { status: 423 },
    );
  }

  const recoveryHash = await getRecoveryCodeHash();
  if (!recoveryHash) {
    return NextResponse.json({ error: "復旧に失敗しました" }, { status: 500 });
  }

  const ok = await verifyRecoveryCode(body.recoveryCode, recoveryHash);
  if (!ok) {
    await recordLoginFailure(user.id, clientIp);
    return NextResponse.json({ error: "復旧に失敗しました" }, { status: 401 });
  }

  await resetUserPassword(user.id, body.newPassword, user.id);

  const auditData = getAuditLogData(
    request,
    user.id,
    "PASSWORD_RECOVERY",
    "USER",
    user.id,
  );
  await createAuditLog({
    ...auditData,
    action: "PASSWORD_RECOVERY",
    entityType: "USER",
    entityId: user.id,
    category: "AUTHENTICATION",
    severity: "WARNING",
    ipAddress: clientIp,
    userAgent,
  });

  return NextResponse.json({ success: true, adminId: user.email });
}
