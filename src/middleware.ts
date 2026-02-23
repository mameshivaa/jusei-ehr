import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LOCAL_SESSION_COOKIE } from "@/lib/config/env";

/**
 * ミドルウェア（ガイドライン準拠：セキュリティ制御）
 *
 * - 認証チェック
 * - 読み取り専用モードの強制
 * - セッション検証
 */

// 認証不要のパス
const PUBLIC_PATHS = [
  "/",
  "/auth/signin",
  "/auth/recover",
  "/auth/error",
  "/api/auth",
  "/api/cron",
  "/api/backup/location",
  "/api/system/client-logs",
  "/api/system/health",
  "/landing",
  "/privacy",
  "/terms",
  "/docs",
  "/blog",
  "/products",
  "/setup",
  "/welcome",
  "/api/setup",
  "/api/releases",
];

// 読み取り専用モードでも許可するAPIパス（GET以外）
const READ_ONLY_ALLOWED_PATHS = [
  "/api/auth",
  "/api/admin/system-mode",
  "/api/admin/emergency",
];

// 書き込み操作のHTTPメソッド
const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

const isDev = process.env.NODE_ENV === "development";

const buildCsp = (frameAncestors: string) =>
  [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'" + (isDev ? " 'unsafe-eval'" : ""),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    `frame-ancestors ${frameAncestors}`,
  ].join("; ");

const isPdfPreviewPath = (pathname: string) =>
  (pathname.startsWith("/api/charts/") ||
    pathname.startsWith("/api/records/")) &&
  pathname.endsWith("/pdf");

const withCsp = (response: NextResponse, pathname: string) => {
  const allowFrame = isPdfPreviewPath(pathname);
  response.headers.set(
    "Content-Security-Policy",
    buildCsp(allowFrame ? "'self'" : "'none'"),
  );
  response.headers.set("X-Frame-Options", allowFrame ? "SAMEORIGIN" : "DENY");
  return response;
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 静的ファイルは無視
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const isRootPath = pathname === "/";

  // ルートアクセスは認証済みならホームへリダイレクト
  if (isRootPath) {
    const hasLocalSession = request.cookies.has(LOCAL_SESSION_COOKIE);
    if (hasLocalSession) {
      return withCsp(
        NextResponse.redirect(new URL("/home", request.url)),
        pathname,
      );
    }

    // 未認証は既存のトップページのロジックに委ねる
    return withCsp(NextResponse.next(), pathname);
  }

  // セットアップのバックアップ先検出は常に公開（middlewareはedgeでDB非対応）

  // NOTE: middleware runs on edge runtime, so DB access (Prisma) is not allowed here.

  // 公開パスのチェック
  const isPublicPath = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (isPublicPath) {
    return withCsp(NextResponse.next(), pathname);
  }

  const hasLocalSession = request.cookies.has(LOCAL_SESSION_COOKIE);
  if (!hasLocalSession) {
    // APIリクエストの場合は401を返す
    if (pathname.startsWith("/api/")) {
      return withCsp(
        NextResponse.json({ error: "認証が必要です" }, { status: 401 }),
        pathname,
      );
    }
    // それ以外はログインページにリダイレクト
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", request.url);
    return withCsp(NextResponse.redirect(signInUrl), pathname);
  }

  // 読み取り専用モードのチェック
  return withCsp(await checkReadOnlyMode(request), pathname);
}

async function checkReadOnlyMode(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // 書き込み操作でない場合はスキップ
  if (!WRITE_METHODS.includes(method)) {
    return NextResponse.next();
  }

  // 許可されたパスはスキップ
  const isAllowed = READ_ONLY_ALLOWED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (isAllowed) {
    return NextResponse.next();
  }

  // システムモードをチェック（DBアクセスが必要なため、APIで確認）
  // ミドルウェアでは直接DBにアクセスできないため、ヘッダーで通知
  // 実際のチェックは各APIで行う
  const response = NextResponse.next();
  response.headers.set("X-Check-System-Mode", "true");
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
