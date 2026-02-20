/**
 * Export API Guards
 *
 * データエクスポートAPI用の権限チェック
 * - ADMIN権限必須
 * - エクスポート目的の記録
 *
 * 注意: v-ossにはMFA機能がないため、ADMIN権限チェックのみ実装
 */

import { requireRole } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export interface ExportRequest {
  purpose: string; // エクスポート目的（必須）
}

/**
 * エクスポートAPI用の権限チェック
 *
 * @param request リクエストオブジェクト
 * @param exportType エクスポートタイプ（'PATIENT', 'DATA', etc.）
 * @returns ユーザー情報またはエラーレスポンス
 */
export async function requireExportPermission(
  request: NextRequest,
  exportType: string,
): Promise<{ user: any; purpose: string } | NextResponse> {
  try {
    // 1. ADMIN権限チェック
    const user = await requireRole("ADMIN");

    // 2. リクエストボディからエクスポート目的を取得
    let body: ExportRequest;
    try {
      body = await request.json();
    } catch {
      // GETリクエストの場合はクエリパラメータから取得
      const { searchParams } = new URL(request.url);
      body = {
        purpose: searchParams.get("purpose") || "",
      };
    }

    // 3. エクスポート目的の検証
    if (!body.purpose || body.purpose.trim().length < 10) {
      return NextResponse.json(
        {
          code: "INVALID_REQUEST",
          reason: "PURPOSE_REQUIRED",
          hint: "エクスポート目的を10文字以上で入力してください",
        },
        { status: 400 },
      );
    }

    return { user, purpose: body.purpose };
  } catch (error: any) {
    if (error.message === "認証が必要です") {
      return NextResponse.json(
        {
          code: "UNAUTHORIZED",
          reason: "NO_SESSION",
          hint: "ログインしてください",
        },
        { status: 401 },
      );
    }
    if (error.message === "権限が不足しています") {
      return NextResponse.json(
        {
          code: "FORBIDDEN",
          reason: "ADMIN_REQUIRED",
          hint: "管理者権限が必要です",
        },
        { status: 403 },
      );
    }
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        hint: error.message || "エクスポート権限の確認に失敗しました",
      },
      { status: 500 },
    );
  }
}

/**
 * 最小限のフィールドのみをエクスポートするかどうかを判定
 *
 * @param request リクエストオブジェクト
 * @returns 最小限フィールドのみの場合はtrue
 */
export function shouldExportMinimalFields(request: NextRequest): boolean {
  const { searchParams } = new URL(request.url);
  const minimal = searchParams.get("minimal");
  // デフォルトは最小限フィールドのみ
  return minimal !== "0" && minimal !== "false";
}
