import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireAuth } from "@/lib/auth";
import { getSystemMode, setSystemMode, SystemMode } from "@/lib/system-mode";
import { verifyMfaCode, getMfaStatus } from "@/lib/security/mfa";
import { prisma } from "@/lib/prisma";
import { getAuditLogData } from "@/lib/audit";
import { z } from "zod";

const modeSchema = z.object({
  mode: z.enum(["NORMAL", "READ_ONLY", "MAINTENANCE"]),
  reason: z.string().min(1, "理由を入力してください"),
  confirm: z.literal(true, {
    errorMap: () => ({ message: "確認パラメータ（confirm: true）が必要です" }),
  }),
  mfaCode: z.string().optional(),
});

/**
 * システムモードを取得
 */
export async function GET() {
  try {
    // 認証は必要だが、ロールは問わない
    await requireAuth();

    const status = await getSystemMode();

    return NextResponse.json(status);
  } catch (error) {
    console.error("System mode get error:", error);
    return NextResponse.json(
      { error: "システムモードの取得に失敗しました" },
      { status: 500 },
    );
  }
}

/**
 * システムモードを変更（管理者のみ）
 *
 * ガイドライン準拠：
 * - 確認パラメータ（confirm: true）必須
 * - MFA有効時はMFAコード検証必須
 * - EmergencyLogに記録
 */
export async function PUT(request: NextRequest) {
  try {
    const admin = await requireRole("ADMIN");

    const body = await request.json();
    const { mode, reason, mfaCode } = modeSchema.parse(body);

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

    const previousStatus = await getSystemMode();
    await setSystemMode(mode as SystemMode, admin.id, reason);
    const newStatus = await getSystemMode();

    // EmergencyLogに記録
    const auditData = getAuditLogData(
      request,
      admin.id,
      "MODE_CHANGE",
      "EMERGENCY",
    );
    await prisma.emergencyLog.create({
      data: {
        userId: admin.id,
        action: "MODE_CHANGE",
        previousState: previousStatus.mode,
        newState: mode,
        ipAddress: auditData.ipAddress || null,
        userAgent: auditData.userAgent || null,
        reason,
        confirmed: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `システムモードを「${getModeName(mode)}」に変更しました`,
      ...newStatus,
    });
  } catch (error) {
    console.error("System mode change error:", error);
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
      { error: "システムモードの変更に失敗しました" },
      { status: 500 },
    );
  }
}

function getModeName(mode: string): string {
  switch (mode) {
    case "NORMAL":
      return "通常";
    case "READ_ONLY":
      return "読み取り専用";
    case "MAINTENANCE":
      return "メンテナンス";
    default:
      return mode;
  }
}
