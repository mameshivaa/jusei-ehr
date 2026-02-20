import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { unlockAllUsers } from "@/lib/security/account-manager";
import { verifyMfaCode, getMfaStatus } from "@/lib/security/mfa";
import { prisma } from "@/lib/prisma";
import { getAuditLogData } from "@/lib/audit";
import { z } from "zod";

const unlockAllSchema = z.object({
  reason: z.string().min(1, "理由を入力してください"),
  confirm: z.literal(true, {
    errorMap: () => ({ message: "確認パラメータ（confirm: true）が必要です" }),
  }),
  mfaCode: z.string().optional(),
});

/**
 * 全ユーザー一括ロック解除（緊急対応後・管理者のみ）
 *
 * ガイドライン準拠：
 * - 確認パラメータ（confirm: true）必須
 * - MFA有効時はMFAコード検証必須
 * - EmergencyLogに記録
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireRole("ADMIN");

    const body = await request.json();
    const { reason, mfaCode } = unlockAllSchema.parse(body);

    // MFA検証（MFA有効な管理者の場合）
    const mfaStatus = await getMfaStatus(admin.id);
    if (mfaStatus.enabled) {
      if (!mfaCode) {
        return NextResponse.json(
          { error: "MFAが有効なため、MFAコードが必要です", requireMfa: true },
          { status: 400 },
        );
      }
      const mfaValid = await verifyMfaCode(admin.id, mfaCode);
      if (!mfaValid) {
        return NextResponse.json(
          { error: "MFAコードが無効です" },
          { status: 401 },
        );
      }
    }

    const unlockedCount = await unlockAllUsers(admin.id, reason);

    // EmergencyLogに記録
    const auditData = getAuditLogData(
      request,
      admin.id,
      "UNLOCK_ALL",
      "EMERGENCY",
    );
    await prisma.emergencyLog.create({
      data: {
        userId: admin.id,
        action: "UNLOCK_ALL",
        affectedCount: unlockedCount,
        ipAddress: auditData.ipAddress || null,
        userAgent: auditData.userAgent || null,
        reason,
        confirmed: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `全ユーザーのロックを解除しました`,
      unlockedUsers: unlockedCount,
    });
  } catch (error) {
    console.error("Emergency unlock error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "ロック解除の実行に失敗しました" },
      { status: 500 },
    );
  }
}
