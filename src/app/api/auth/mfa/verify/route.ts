import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enableMfa, verifyMfaCode } from "@/lib/security/mfa";
import { z } from "zod";

const verifySchema = z.object({
  code: z.string().min(6).max(8),
  action: z.enum(["enable", "verify"]).default("verify"),
});

/**
 * MFAコード検証
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const { code, action } = verifySchema.parse(body);

    if (action === "enable") {
      // MFAを有効化（セットアップ後の初回検証）
      const success = await enableMfa(user.id, code);
      if (!success) {
        return NextResponse.json(
          { error: "認証コードが正しくありません" },
          { status: 400 },
        );
      }
      return NextResponse.json({
        success: true,
        message: "MFAを有効化しました",
      });
    } else {
      // MFAコードを検証（ログイン時など）
      const valid = await verifyMfaCode(user.id, code);
      if (!valid) {
        return NextResponse.json(
          { error: "認証コードが正しくありません" },
          { status: 400 },
        );
      }
      return NextResponse.json({
        success: true,
        message: "MFA認証に成功しました",
      });
    }
  } catch (error) {
    console.error("MFA verify error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "MFA検証に失敗しました" },
      { status: 500 },
    );
  }
}
