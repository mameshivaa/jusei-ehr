import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { requireApiPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import { ACTIVE_CHART_STATUS, normalizeChartStatus } from "@/lib/charts/status";

export const dynamic = "force-dynamic";

const recordSchema = z.object({
  narrative: z.string().nullable().optional(),
  isLegacyData: z.boolean().optional(), // injuryなしを許容するフラグ
});

const requestSchema = z.object({
  patientId: z.string().min(1, "patientIdは必須です"),
  chartId: z.string().min(1, "chartIdは必須です"),
  injuryId: z.string().nullable().optional(),
  visitDate: z.string().nullable().optional(),
  record: recordSchema,
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "VISIT", "CREATE");
    await requireApiPermission(user.id, "TREATMENT_RECORD", "CREATE");

    const body = await request.json();
    const input = requestSchema.parse(body);

    if (process.env.DEV_BYPASS_AUTH !== "true") {
      const operator = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true },
      });
      if (!operator) {
        return NextResponse.json(
          {
            error:
              "操作ユーザーが登録されていません。管理者に連絡してください。",
          },
          { status: 403 },
        );
      }
    }

    const patient = await prisma.patient.findUnique({
      where: { id: input.patientId, isDeleted: false },
    });
    if (!patient) {
      return NextResponse.json(
        { error: "患者が見つかりません" },
        { status: 404 },
      );
    }

    const chart = await prisma.chart.findUnique({
      where: { id: input.chartId, patientId: input.patientId },
      select: { id: true, patientId: true, status: true, firstVisitDate: true },
    });
    if (!chart) {
      return NextResponse.json(
        { error: "カルテが見つかりません" },
        { status: 404 },
      );
    }

    if (normalizeChartStatus(chart.status) !== ACTIVE_CHART_STATUS) {
      return NextResponse.json(
        { error: "通院中のカルテのみ受付できます。状態を確認してください。" },
        { status: 400 },
      );
    }

    // visitDate をパース（省略時は現在時刻）
    const visitDate = input.visitDate ? new Date(input.visitDate) : new Date();
    if (Number.isNaN(visitDate.getTime())) {
      return NextResponse.json(
        { error: "visitDateの形式が不正です" },
        { status: 400 },
      );
    }

    // injuryの存在チェック（任意指定）
    if (input.injuryId) {
      const injury = await prisma.injury.findUnique({
        where: { id: input.injuryId },
        select: { patientId: true, injuryDate: true, isDeleted: true },
      });
      if (!injury) {
        return NextResponse.json(
          { error: "負傷エピソードが見つかりません" },
          { status: 404 },
        );
      }
      if (injury.isDeleted) {
        return NextResponse.json(
          { error: "削除された負傷エピソードは選択できません" },
          { status: 400 },
        );
      }
      if (injury.patientId !== patient.id) {
        return NextResponse.json(
          { error: "負傷エピソードと患者が一致しません" },
          { status: 400 },
        );
      }
      if (visitDate < injury.injuryDate) {
        return NextResponse.json(
          { error: "来院日は負傷日以降である必要があります" },
          { status: 400 },
        );
      }
    }

    const { record } = input;
    const allowNoInjury = record.isLegacyData === true || !input.injuryId;

    if (!allowNoInjury && !input.injuryId) {
      return NextResponse.json(
        { error: "負傷エピソードの選択は必須です" },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const visit = await tx.visit.create({
        data: {
          patientId: patient.id,
          chartId: chart.id,
          visitDate,
        },
      });

      const treatmentRecord = await tx.treatmentRecord.create({
        data: {
          visitId: visit.id,
          injuryId: input.injuryId ?? null,
          narrative: record.narrative ?? null,
          updatedBy: user.id,
          isConfirmed: false,
        },
      });

      return { visit, treatmentRecord };
    });

    const audit = getAuditLogData(
      request,
      user.id,
      "CREATE",
      "VISIT",
      result.visit.id,
    );
    await createAuditLog({
      ...audit,
      action: "CREATE",
      entityType: "VISIT",
      entityId: result.visit.id,
      category: "DATA_MODIFICATION",
      metadata: { patientId: patient.id, visitDate: result.visit.visitDate },
    }).catch((e) => console.error("audit log failed", e));

    return NextResponse.json({
      visitId: result.visit.id,
      recordId: result.treatmentRecord.id,
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
    console.error("visit with record error", error);
    return NextResponse.json(
      { error: "施術録の登録に失敗しました" },
      { status: 500 },
    );
  }
}
