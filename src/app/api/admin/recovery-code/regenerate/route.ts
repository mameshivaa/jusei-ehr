import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import {
  generateRecoveryCode,
  formatRecoveryCode,
  hashRecoveryCode,
  saveRecoveryCodeHash,
} from "@/lib/security/recovery-code";
import { getMfaStatus, verifyMfaCode } from "@/lib/security/mfa";

const regenerateSchema = z.object({
  mfaCode: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const { mfaCode } = regenerateSchema.parse(body);

    const mfaStatus = await getMfaStatus(admin.id);
    if (!mfaStatus.enabled) {
      return NextResponse.json(
        { error: "MFAを有効化してください" },
        { status: 400 },
      );
    }

    if (!mfaCode) {
      return NextResponse.json(
        { error: "MFAコードが必要です" },
        { status: 400 },
      );
    }

    const mfaValid = await verifyMfaCode(admin.id, mfaCode);
    if (!mfaValid) {
      return NextResponse.json(
        { error: "認証コードが正しくありません" },
        { status: 401 },
      );
    }

    const recoveryCode = generateRecoveryCode();
    const recoveryHash = await hashRecoveryCode(recoveryCode);
    await saveRecoveryCodeHash(recoveryHash, admin.id);

    const auditData = getAuditLogData(
      request,
      admin.id,
      "RECOVERY_CODE_REGENERATED",
      "SYSTEM",
      admin.id,
    );
    await createAuditLog({
      ...auditData,
      action: "RECOVERY_CODE_REGENERATED",
      entityType: "SYSTEM",
      entityId: admin.id,
      category: "AUTHENTICATION",
      severity: "WARNING",
      metadata: { mfaRequired: true },
    });

    return NextResponse.json({
      recoveryCode: formatRecoveryCode(recoveryCode),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Recovery code regenerate error:", error);
    return NextResponse.json(
      { error: "復旧コードの再発行に失敗しました" },
      { status: 500 },
    );
  }
}
