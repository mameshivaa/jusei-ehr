import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { logLogout } from "@/lib/activity-log";
import { clearLocalSessionCookie } from "@/lib/auth/local-session";
import { cookies } from "next/headers";
import { LOCAL_SESSION_COOKIE } from "@/lib/config/env";
import { invalidateSession } from "@/lib/security/session-manager";
import { createAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * ログアウトAPI
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const cookieStore = cookies();
    const localSessionToken = cookieStore.get(LOCAL_SESSION_COOKIE)?.value;

    // ログアウトイベントを記録
    if (user?.id) {
      await logLogout(user.id, { email: user.email });
      await createAuditLog({
        userId: user.id,
        action: "LOGOUT",
        entityType: "USER",
        entityId: user.id,
        category: "AUTHENTICATION",
        severity: "INFO",
      });
    }

    const response = NextResponse.json({ success: true });

    // ローカルセッションを無効化
    if (localSessionToken) {
      await invalidateSession(localSessionToken);
    }
    clearLocalSessionCookie(response);

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "ログアウトに失敗しました" },
      { status: 500 },
    );
  }
}
