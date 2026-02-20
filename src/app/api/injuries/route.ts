import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import { requireApiPermission } from "@/lib/rbac";
import { validateInjury } from "@/lib/injuries/injury-validation";
import { LegalCauseType, InjuryOutcome } from "@prisma/client";
import { getOrCreateDefaultChart } from "@/lib/charts/get-default-chart";
import { logEvent } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS = {
  FRACTURE: "骨折",
  INCOMPLETE_FRACTURE: "不全骨折",
  DISLOCATION: "脱臼",
  CONTUSION: "打撲",
  SPRAIN: "捻挫",
  STRAIN: "挫傷",
} as const;

const detectCategory = (raw: string) => {
  if (raw.includes("不全骨折")) return "INCOMPLETE_FRACTURE";
  if (raw.includes("骨折")) return "FRACTURE";
  if (raw.includes("脱臼")) return "DISLOCATION";
  if (raw.includes("捻挫")) return "SPRAIN";
  if (raw.includes("打撲")) return "CONTUSION";
  if (raw.includes("挫傷")) return "STRAIN";
  return null;
};

const hasLaterality = (raw: string) => raw.includes("右") || raw.includes("左");

async function findMissingLaterality(
  injuryName: string,
  judoInjuryMasterId?: string | null,
) {
  if (hasLaterality(injuryName)) return null;
  if (judoInjuryMasterId) {
    const master = await prisma.judoInjuryMaster.findUnique({
      where: { id: judoInjuryMasterId },
      select: { partLabel: true, category: true, lateralityRule: true },
    });
    if (master && master.lateralityRule === "REQUIRED") {
      const label =
        CATEGORY_LABELS[master.category as keyof typeof CATEGORY_LABELS];
      return `${master.partLabel}${label}`;
    }
    return null;
  }
  const category = detectCategory(injuryName);
  if (!category) return null;
  const masters = await prisma.judoInjuryMaster.findMany({
    where: { category, lateralityRule: "REQUIRED", isActive: true },
    select: { partLabel: true },
  });
  const matched = masters.find((m) => injuryName.includes(m.partLabel));
  return matched
    ? `${matched.partLabel}${CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}`
    : null;
}

const injurySchema = z.object({
  patientId: z.string().min(1, "患者IDは必須です"),
  chartId: z.string().nullable().optional(),
  // 必須項目
  injuryDate: z.string().min(1, "負傷日は必須です"),
  injuryName: z.string().min(1, "負傷名は必須です"),
  firstVisitDate: z.string().min(1, "初検日は必須です"),
  // 任意項目
  memo: z.string().nullable().optional(),
  judoInjuryMasterId: z.string().nullable().optional(),
  medicalInjuryName: z.string().nullable().optional(),
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
 * GET /api/injuries
 * 負傷エピソード一覧取得
 * クエリパラメータ:
 *   - patientId: 患者ID（必須）
 *   - includeDeleted: 削除済みを含めるか（デフォルト: false）
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "INJURY", "READ");

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");
    const includeDeleted = searchParams.get("includeDeleted") === "true";

    if (!patientId) {
      return NextResponse.json({ error: "患者IDは必須です" }, { status: 400 });
    }

    // 患者の存在確認
    const patient = await prisma.patient.findUnique({
      where: { id: patientId, isDeleted: false },
    });
    if (!patient) {
      return NextResponse.json(
        { error: "患者が見つかりません" },
        { status: 404 },
      );
    }

    const injuries = await prisma.injury.findMany({
      where: {
        patientId,
        ...(includeDeleted ? {} : { isDeleted: false }),
      },
      include: {
        _count: {
          select: { treatmentRecords: true },
        },
      },
      orderBy: { injuryDate: "desc" },
    });

    // 施術回数を付加
    const injuriesWithCount = injuries.map((injury) => ({
      ...injury,
      treatmentCount: injury._count.treatmentRecords,
    }));

    return NextResponse.json(injuriesWithCount);
  } catch (error) {
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Injuries list error:", error);
    return NextResponse.json(
      { error: "負傷エピソードの取得に失敗しました" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/injuries
 * 負傷エピソード作成
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "INJURY", "CREATE");

    const body = await request.json();
    const validatedData = injurySchema.parse(body);

    // 患者の存在確認
    const patient = await prisma.patient.findUnique({
      where: { id: validatedData.patientId, isDeleted: false },
    });
    if (!patient) {
      return NextResponse.json(
        { error: "患者が見つかりません" },
        { status: 404 },
      );
    }

    const injuryDate = new Date(validatedData.injuryDate);
    const firstVisitDate = new Date(validatedData.firstVisitDate);

    // バリデーション（サーバ側）
    const validationResult = validateInjury({
      injuryDate,
      firstVisitDate,
    });

    const missingLaterality = await findMissingLaterality(
      validatedData.injuryName,
      validatedData.judoInjuryMasterId,
    );
    if (missingLaterality) {
      return NextResponse.json(
        { error: `左右（右/左）を入力してください: ${missingLaterality}` },
        { status: 400 },
      );
    }

    if (!validationResult.isValid) {
      return NextResponse.json(
        {
          error: validationResult.errors.join(", "),
          warnings: validationResult.warnings,
        },
        { status: 400 },
      );
    }

    let chart = null;
    if (validatedData.chartId) {
      chart = await prisma.chart.findUnique({
        where: { id: validatedData.chartId },
      });
      if (!chart || chart.patientId !== validatedData.patientId) {
        return NextResponse.json(
          { error: "カルテが見つかりません" },
          { status: 404 },
        );
      }
    } else {
      chart = await getOrCreateDefaultChart(validatedData.patientId);
    }
    if (!chart.firstVisitDate || firstVisitDate < chart.firstVisitDate) {
      await prisma.chart.update({
        where: { id: chart.id },
        data: { firstVisitDate },
      });
    }

    const injury = await prisma.injury.create({
      data: {
        patientId: validatedData.patientId,
        chartId: chart.id,
        injuryDate,
        memo: validatedData.memo || null,
        injuryName: validatedData.injuryName,
        medicalInjuryName: validatedData.medicalInjuryName || null,
        firstVisitDate,
        judoInjuryMasterId: validatedData.judoInjuryMasterId || null,
        injuryTime: validatedData.injuryTime || null,
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
        outcome: validatedData.outcome as InjuryOutcome | null,
        outcomeDate: validatedData.outcomeDate
          ? new Date(validatedData.outcomeDate)
          : null,
        legalCauseType: validatedData.legalCauseType as LegalCauseType | null,
        consentDoctor: validatedData.consentDoctor || null,
        consentDate: validatedData.consentDate
          ? new Date(validatedData.consentDate)
          : null,
        consentDocId: validatedData.consentDocId || null,
      },
    });

    // 監査ログを記録
    const auditData = getAuditLogData(
      request,
      user.id,
      "CREATE",
      "INJURY",
      injury.id,
    );
    await createAuditLog({
      ...auditData,
      action: "CREATE",
      entityType: "INJURY",
      entityId: injury.id,
      category: "DATA_MODIFICATION",
      metadata: {
        patientId: validatedData.patientId,
        injuryName: validatedData.injuryName,
        warnings: validationResult.warnings,
      },
    }).catch((error) => {
      console.error("Failed to create audit log:", error);
    });

    await logEvent("CRUD", { entity: "INJURY", action: "CREATE" }, user.id);

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
    console.error("Injury creation error:", error);
    return NextResponse.json(
      { error: "負傷エピソードの登録に失敗しました" },
      { status: 500 },
    );
  }
}
