import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import { createTreatmentRecordHistory } from "@/lib/treatment-record-history";
import { DigitalSignature } from "@/lib/security/digital-signature";
import { logEvent } from "@/lib/activity-log";

/**
 * 施術記録の確定（ガイドライン準拠：記録の確定手順の確立）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();

    const body = await request.json().catch(() => ({}));

    const record = await prisma.treatmentRecord.findUnique({
      where: { id: params.id, isDeleted: false },
    });

    if (!record) {
      return NextResponse.json(
        { error: "施術記録が見つかりません" },
        { status: 404 },
      );
    }

    if (record.isConfirmed) {
      return NextResponse.json(
        { error: "既に確定されています" },
        { status: 400 },
      );
    }

    // 記録内容を文字列化（電子署名用）
    const recordContent = JSON.stringify({
      id: record.id,
      visitId: record.visitId,
      narrative: record.narrative,
      version: record.version,
    });

    // e-文書法対応：電子署名とタイムスタンプを生成
    const signature = DigitalSignature.sign(recordContent);
    const timestamp = DigitalSignature.generateTimestamp();

    // 記録を確定（電子署名・タイムスタンプ付き）
    const updated = await prisma.treatmentRecord.update({
      where: { id: params.id },
      data: {
        isConfirmed: true,
        confirmedBy: user.id,
        confirmedAt: new Date(),
        digitalSignature: JSON.stringify(signature),
        timestampHash: timestamp.timestampHash,
        timestampSource: timestamp.source,
      },
    });

    // 更新履歴を記録（確定理由を残す）
    const changeReason =
      typeof body?.changeReason === "string" &&
      body.changeReason.trim().length > 0
        ? body.changeReason.trim()
        : "記録を確定";

    await createTreatmentRecordHistory(
      record.id,
      {
        narrative: record.narrative,
      },
      {
        narrative: record.narrative,
      },
      user.id,
      "CONFIRM",
      record.version,
      changeReason,
    );

    // 監査ログを記録
    const auditData = getAuditLogData(
      request,
      user.id,
      "CONFIRM",
      "TREATMENT_RECORD",
      record.id,
    );
    await createAuditLog({
      userId: auditData.userId,
      sessionId: auditData.sessionId,
      action: auditData.action || "CONFIRM",
      entityType: auditData.entityType || "TREATMENT_RECORD",
      entityId: auditData.entityId,
      resourcePath: auditData.resourcePath,
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
      category: "DATA_MODIFICATION",
      severity: "INFO",
      metadata: {
        recordId: record.id,
        confirmedBy: user.id,
      },
    });

    await logEvent(
      "CRUD",
      { entity: "TREATMENT_RECORD", action: "CONFIRM" },
      user.id,
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Treatment record confirm error:", error);
    return NextResponse.json(
      { error: "施術記録の確定に失敗しました" },
      { status: 500 },
    );
  }
}
