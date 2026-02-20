import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateSession } from "@/lib/security/session-manager";
import { LOCAL_SESSION_COOKIE } from "@/lib/config/env";

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

/** 本番のみ Secure。開発（http://localhost）では Secure にすると Cookie が保存されない場合がある */
const COOKIE_SECURE = process.env.NODE_ENV === "production";

export function setLocalSessionCookie(token: string, response: NextResponse) {
  response.cookies.set({
    name: LOCAL_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    path: "/",
    maxAge: THIRTY_DAYS_SECONDS,
  });
}

export function clearLocalSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: LOCAL_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    path: "/",
    maxAge: 0,
  });
}

export async function getLocalSessionUser() {
  const cookieStore = cookies();
  const token = cookieStore.get(LOCAL_SESSION_COOKIE)?.value;
  if (!token) return null;

  const validation = await validateSession(token);
  if (!validation.valid || !validation.userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: validation.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
    },
  });

  if (!user) {
    return null;
  }

  return user;
}
