import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import { requireApiPermission } from "@/lib/rbac";
import { validateInjury } from "@/lib/injuries/injury-validation";
import { LegalCauseType, InjuryOutcome } from "@prisma/client";
import { logEvent } from "@/lib/activity-log";

const updateInjurySchema = z.object({
  // 必須項目
  injuryDate: z.string().min(1, "負傷日は必須です").optional(),
  injuryName: z.string().min(1, "負傷名は必須です").optional(),
  firstVisitDate: z.string().min(1, "初検日は必須です").optional(),
  // 任意項目
  memo: z.string().nullable().optional(),
  injuryTime: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  outcome: z
    .enum(["CURED", "IMPROVED", "UNCHANGED", "TRANSFERRED", "DISCONTINUED"])
    .nullable()
    .optional(),
  outcomeDate: z.string().nullable().optional(),
  legalCauseType: z
    .enum(["NORMAL", "WORK_ACCIDENT", "COMMUTING", "TRAFFIC", "OTHER"])
    .nullable()
    .optional(),
  // 同意医師
  consentDoctor: z.string().nullable().optional(),
  consentDate: z.string().nullable().optional(),
  consentDocId: z.string().nullable().optional(),
});

/**
 * GET /api/injuries/[id]
 * 負傷エピソード詳細取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "INJURY", "READ");

    const injury = await prisma.injury.findUnique({
      where: { id: params.id },
      include: {
        patient: {
          select: { id: true, name: true, kana: true },
        },
        treatmentRecords: {
          where: { isDeleted: false },
          orderBy: { createdAt: "desc" },
          include: {
            visit: {
              select: { id: true, visitDate: true },
            },
          },
        },
        _count: {
          select: { treatmentRecords: true },
        },
      },
    });

    if (!injury) {
      return NextResponse.json(
        { error: "負傷エピソードが見つかりません" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ...injury,
      treatmentCount: injury._count.treatmentRecords,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Injury detail error:", error);
    return NextResponse.json(
      { error: "負傷エピソードの取得に失敗しました" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/injuries/[id]
 * 負傷エピソード更新
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "INJURY", "UPDATE");

    const existingInjury = await prisma.injury.findUnique({
      where: { id: params.id },
    });

    if (!existingInjury) {
      return NextResponse.json(
        { error: "負傷エピソードが見つかりません" },
        { status: 404 },
      );
    }

    if (existingInjury.isDeleted) {
      return NextResponse.json(
        { error: "削除された負傷エピソードは編集できません" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validatedData = updateInjurySchema.parse(body);

    // バリデーション用データを構築
    const injuryDate = validatedData.injuryDate
      ? new Date(validatedData.injuryDate)
      : existingInjury.injuryDate;
    const firstVisitDate = validatedData.firstVisitDate
      ? new Date(validatedData.firstVisitDate)
      : existingInjury.firstVisitDate;
    // バリデーション（サーバ側）
    const validationResult = validateInjury({
      injuryDate,
      firstVisitDate,
    });

    if (!validationResult.isValid) {
      return NextResponse.json(
        {
          error: validationResult.errors.join(", "),
          warnings: validationResult.warnings,
        },
        { status: 400 },
      );
    }

    // 更新データを構築
    const updateData: Record<string, unknown> = {};

    if (validatedData.injuryDate !== undefined)
      updateData.injuryDate = injuryDate;
    if (validatedData.memo !== undefined) updateData.memo = validatedData.memo;
    if (validatedData.injuryName !== undefined)
      updateData.injuryName = validatedData.injuryName;
    if (validatedData.firstVisitDate !== undefined)
      updateData.firstVisitDate = firstVisitDate;
    if (validatedData.injuryTime !== undefined)
      updateData.injuryTime = validatedData.injuryTime;
    if (validatedData.endDate !== undefined) {
      updateData.endDate = validatedData.endDate
        ? new Date(validatedData.endDate)
        : null;
    }
    if (validatedData.outcome !== undefined)
      updateData.outcome = validatedData.outcome as InjuryOutcome | null;
    if (validatedData.outcomeDate !== undefined) {
      updateData.outcomeDate = validatedData.outcomeDate
        ? new Date(validatedData.outcomeDate)
        : null;
    }
    if (validatedData.legalCauseType !== undefined) {
      updateData.legalCauseType =
        validatedData.legalCauseType as LegalCauseType | null;
    }
    if (validatedData.consentDoctor !== undefined)
      updateData.consentDoctor = validatedData.consentDoctor;
    if (validatedData.consentDate !== undefined) {
      updateData.consentDate = validatedData.consentDate
        ? new Date(validatedData.consentDate)
        : null;
    }
    if (validatedData.consentDocId !== undefined)
      updateData.consentDocId = validatedData.consentDocId;

    const injury = await prisma.injury.update({
      where: { id: params.id },
      data: updateData,
    });

    // 監査ログを記録
    const auditData = getAuditLogData(
      request,
      user.id,
      "UPDATE",
      "INJURY",
      injury.id,
    );
    await createAuditLog({
      ...auditData,
      action: "UPDATE",
      entityType: "INJURY",
      entityId: injury.id,
      category: "DATA_MODIFICATION",
      metadata: {
        changes: Object.keys(updateData),
        warnings: validationResult.warnings,
      },
    }).catch((error) => {
      console.error("Failed to create audit log:", error);
    });

    await logEvent("CRUD", { entity: "INJURY", action: "UPDATE" }, user.id);

    return NextResponse.json({
      ...injury,
      warnings: validationResult.warnings,
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
    console.error("Injury update error:", error);
    return NextResponse.json(
      { error: "負傷エピソードの更新に失敗しました" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/injuries/[id]
 * 負傷エピソード削除（論理削除のみ）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "INJURY", "DELETE");

    const existingInjury = await prisma.injury.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { treatmentRecords: { where: { isDeleted: false } } },
        },
      },
    });

    if (!existingInjury) {
      return NextResponse.json(
        { error: "負傷エピソードが見つかりません" },
        { status: 404 },
      );
    }

    if (existingInjury.isDeleted) {
      return NextResponse.json(
        { error: "既に削除されています" },
        { status: 400 },
      );
    }

    // 紐づく施術記録がある場合は警告
    if (existingInjury._count.treatmentRecords > 0) {
      // 削除は許可するが、紐づきは解除しない（施術記録は残る）
      console.warn(
        `Injury ${params.id} has ${existingInjury._count.treatmentRecords} treatment records`,
      );
    }

    // 論理削除
    const injury = await prisma.injury.update({
      where: { id: params.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    // 監査ログを記録
    const auditData = getAuditLogData(
      request,
      user.id,
      "DELETE",
      "INJURY",
      injury.id,
    );
    await createAuditLog({
      ...auditData,
      action: "DELETE",
      entityType: "INJURY",
      entityId: injury.id,
      category: "DATA_MODIFICATION",
      metadata: {
        injuryName: existingInjury.injuryName,
        patientId: existingInjury.patientId,
        linkedTreatmentRecords: existingInjury._count.treatmentRecords,
      },
    }).catch((error) => {
      console.error("Failed to create audit log:", error);
    });

    await logEvent("CRUD", { entity: "INJURY", action: "DELETE" }, user.id);

    return NextResponse.json({ success: true, id: injury.id });
  } catch (error) {
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Injury deletion error:", error);
    return NextResponse.json(
      { error: "負傷エピソードの削除に失敗しました" },
      { status: 500 },
    );
  }
}
