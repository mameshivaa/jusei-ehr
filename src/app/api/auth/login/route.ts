import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/security/session-manager";
import {
  recordLoginFailure,
  recordLoginSuccess,
} from "@/lib/security/account-manager";
import { setLocalSessionCookie } from "@/lib/auth/local-session";
import { logLogin } from "@/lib/activity-log";
import { ensureDevAdmin } from "@/lib/dev/ensure-dev-admin";

const IDENTIFIER_MAX = 320;
const PASSWORD_MAX = 256;

function getClientIp(request: NextRequest): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim();
  }
  return request.ip ?? undefined;
}

export async function POST(request: NextRequest) {
  await ensureDevAdmin();

  let body: { identifier?: unknown; email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "無効なJSONです" }, { status: 400 });
  }

  const identifier = (body.identifier ?? body.email ?? "")
    .toString()
    .trim()
    .toLowerCase();
  const password = (body.password ?? "").toString();

  if (!identifier || !password) {
    return NextResponse.json(
      { error: "IDとパスワードが必要です" },
      { status: 400 },
    );
  }

  if (identifier.length > IDENTIFIER_MAX || password.length > PASSWORD_MAX) {
    return NextResponse.json({ error: "入力値が長すぎます" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: identifier },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      passwordHash: true,
      lockedUntil: true,
    },
  });

  // 認証可否は曖昧に応答して列挙を避ける
  if (!user || !user.passwordHash) {
    return NextResponse.json(
      { error: "IDまたはパスワードが違います" },
      { status: 401 },
    );
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

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  const clientIp = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || undefined;

  if (!passwordOk) {
    await recordLoginFailure(user.id, clientIp);
    return NextResponse.json(
      { error: "IDまたはパスワードが違います" },
      { status: 401 },
    );
  }

  await recordLoginSuccess(user.id, clientIp, userAgent);
  const sessionToken = await createSession(user.id, clientIp, userAgent);

  const response = NextResponse.json({
    success: true,
    user: { id: user.id, email: user.email },
  });
  setLocalSessionCookie(sessionToken, response);

  await logLogin(user.id, { method: "local" });
  // 監査ログのLOGINは recordLoginSuccess() 内で1件だけ記録（重複防止）

  return response;
}
