import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  regenerateBackupCodes,
  verifyMfaCode,
  getMfaStatus,
} from "@/lib/security/mfa";
import { z } from "zod";

const regenerateSchema = z.object({
  code: z.string().min(6).max(6),
});

/**
 * バックアップコード再生成
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // MFAが有効かチェック
    const status = await getMfaStatus(user.id);
    if (!status.enabled) {
      return NextResponse.json(
        { error: "MFAが有効化されていません" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { code } = regenerateSchema.parse(body);

    // 現在のMFAコードを検証
    const valid = await verifyMfaCode(user.id, code);
    if (!valid) {
      return NextResponse.json(
        { error: "認証コードが正しくありません" },
        { status: 400 },
      );
    }

    const backupCodes = await regenerateBackupCodes(user.id);

    return NextResponse.json({
      backupCodes,
      message:
        "新しいバックアップコードを生成しました。安全な場所に保管してください。",
    });
  } catch (error) {
    console.error("Backup codes regenerate error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "バックアップコードの再生成に失敗しました" },
      { status: 500 },
    );
  }
}
