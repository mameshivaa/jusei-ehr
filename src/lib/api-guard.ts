import { NextRequest, NextResponse } from "next/server";
import { canWrite, getSystemMode } from "@/lib/system-mode";

/**
 * API保護ユーティリティ（ガイドライン準拠：書き込み制御）
 */

/**
 * 書き込み操作のガード
 * 読み取り専用モードまたはメンテナンスモードの場合はエラーを返す
 */
export async function guardWriteOperation(): Promise<{
  allowed: boolean;
  response?: NextResponse;
}> {
  const { allowed, reason } = await canWrite();

  if (!allowed) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: reason || "システムは現在書き込み操作を受け付けていません",
          code: "WRITE_NOT_ALLOWED",
        },
        { status: 503 },
      ),
    };
  }

  return { allowed: true };
}

/**
 * 書き込みAPIハンドラをラップするヘルパー
 */
export function withWriteGuard<
  T extends (...args: any[]) => Promise<NextResponse>,
>(handler: T): T {
  return (async (...args: Parameters<T>) => {
    const guard = await guardWriteOperation();
    if (!guard.allowed && guard.response) {
      return guard.response;
    }
    return handler(...args);
  }) as T;
}

/**
 * リクエストにシステムモードチェックが必要か確認
 */
export function shouldCheckSystemMode(request: NextRequest): boolean {
  return request.headers.get("X-Check-System-Mode") === "true";
}

/**
 * システムモード情報をレスポンスヘッダーに追加
 */
export async function addSystemModeHeaders(
  response: NextResponse,
): Promise<NextResponse> {
  const { mode, reason } = await getSystemMode();

  response.headers.set("X-System-Mode", mode);
  if (reason) {
    response.headers.set("X-System-Mode-Reason", encodeURIComponent(reason));
  }

  return response;
}
