import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { setupMfa, getMfaStatus } from "@/lib/security/mfa";

/**
 * MFAセットアップ開始
 */
export async function POST() {
  try {
    const user = await requireAuth();

    // 既にMFAが有効かチェック
    const status = await getMfaStatus(user.id);
    if (status.enabled) {
      return NextResponse.json(
        { error: "MFAは既に有効化されています" },
        { status: 400 },
      );
    }

    const { secret, backupCodes, uri } = await setupMfa(user.id);

    return NextResponse.json({
      secret,
      backupCodes,
      uri,
      message:
        "MFAのセットアップを開始しました。認証アプリでQRコードをスキャンし、コードを入力して有効化してください。",
    });
  } catch (error) {
    console.error("MFA setup error:", error);
    return NextResponse.json(
      { error: "MFAのセットアップに失敗しました" },
      { status: 500 },
    );
  }
}

/**
 * MFA状態を取得
 */
export async function GET() {
  try {
    const user = await requireAuth();
    const status = await getMfaStatus(user.id);
    return NextResponse.json(status);
  } catch (error) {
    console.error("MFA status error:", error);
    return NextResponse.json(
      { error: "MFA状態の取得に失敗しました" },
      { status: 500 },
    );
  }
}
