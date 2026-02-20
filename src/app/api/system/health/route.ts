import { NextRequest, NextResponse } from "next/server";
import { LOCAL_SESSION_COOKIE } from "@/lib/config/env";

export const runtime = "nodejs";

function toErrorDetail(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name || "unknown_error";
  }
  return String(error ?? "unknown_error");
}

/**
 * ヘルスチェックAPI
 *
 * ガイドライン準拠：
 * - 無認証アクセス時は最小限の情報のみ（status: ok/ng）
 * - 認証済みの場合は詳細情報を返す
 */
export async function GET(request: NextRequest) {
  try {
    const { prisma } = await import("@/lib/prisma");

    // データベース接続チェック
    let dbStatus = "ok";
    let dbErrorDetail: string | null = null;
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      dbStatus = "error";
      dbErrorDetail =
        error instanceof Error ? error.message : String(error ?? "unknown");
      console.error("Health check DB query failed:", error);
    }

    const isHealthy = dbStatus === "ok";
    const statusCode = isHealthy ? 200 : 503;

    // 認証チェック（セッションCookieがある場合のみ評価）
    let user = null;
    let hasSessionCookie = false;
    try {
      hasSessionCookie = Boolean(
        request.cookies?.get?.(LOCAL_SESSION_COOKIE)?.value,
      );
    } catch {
      hasSessionCookie = false;
    }
    if (hasSessionCookie) {
      try {
        const { getCurrentUser } = await import("@/lib/auth");
        user = await getCurrentUser();
      } catch {
        // 認証失敗時は無視（ヘルスチェックは継続）
      }
    }

    // 無認証アクセス時は最小限の情報のみ
    if (!user) {
      const includeDetail = process.env.ELECTRON_RUNTIME === "true";
      return NextResponse.json(
        {
          status: isHealthy ? "ok" : "ng",
          reason: isHealthy ? undefined : "database_unavailable",
          detail:
            !isHealthy && includeDetail && dbErrorDetail
              ? dbErrorDetail.slice(0, 240)
              : undefined,
        },
        { status: statusCode },
      );
    }

    // 認証済みの場合は詳細情報を返す
    const { getSystemMode } = await import("@/lib/system-mode");

    const systemMode = await getSystemMode();
    const readOnlyMode = systemMode.mode === "READ_ONLY";

    const health = {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      readOnlyMode,
      checks: {
        database: dbStatus,
        systemMode: systemMode.mode,
        systemModeReason: systemMode.reason || null,
      },
    };

    return NextResponse.json(health, { status: statusCode });
  } catch (error) {
    console.error("Health check error:", error);
    const includeDetail = process.env.ELECTRON_RUNTIME === "true";
    return NextResponse.json(
      {
        status: "ng",
        reason: "health_check_exception",
        detail: includeDetail ? toErrorDetail(error).slice(0, 240) : undefined,
      },
      { status: 503 },
    );
  }
}
