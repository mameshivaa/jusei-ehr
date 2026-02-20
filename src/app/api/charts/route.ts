import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import { requireApiPermission } from "@/lib/rbac";
import { ChartStatus } from "@prisma/client";
import { getSafeErrorMessage } from "@/lib/security/error-sanitizer";
import {
  decryptInsuranceFields,
  encryptInsuranceFields,
  mergeInsuranceDefaults,
  normalizeInsuranceInput,
} from "@/lib/charts/insurance";
import { ACTIVE_CHART_STATUS, normalizeChartStatus } from "@/lib/charts/status";
import { INSURANCE_OPTIONS } from "@/lib/charts/insurance-options";
import { validateInjury } from "@/lib/injuries/injury-validation";
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

const sharedInjurySchema = z.object({
  injuryDate: z.string().min(1, "負傷日は必須です"),
  firstVisitDate: z.string().min(1, "初検日は必須です"),
  memo: z.string().nullable().optional(),
});

const chartSchema = z.object({
  patientId: z.string().min(1, "患者IDは必須です"),
  insuranceType: z.enum(INSURANCE_OPTIONS, {
    errorMap: () => ({ message: "保険種別を選択してください" }),
  }),
  insuranceNumber: z.string().nullable().optional(),
  insuranceInsurerNumber: z.string().nullable().optional(),
  insuranceCertificateSymbol: z.string().nullable().optional(),
  insuranceCertificateNumber: z.string().nullable().optional(),
  insuranceExpiryDate: z.string().nullable().optional(),
  insuranceEffectiveFrom: z.string().nullable().optional(),
  insuranceCopaymentRate: z.string().nullable().optional(),
  publicAssistanceNumber: z.string().nullable().optional(),
  publicAssistanceRecipient: z.string().nullable().optional(),
  status: z
    .union([
      z.nativeEnum(ChartStatus),
      z.literal("ACTIVE"),
      z.literal("FOLLOW_UP"),
    ])
    .transform((value) => normalizeChartStatus(value))
    .optional(),
  sharedInjury: sharedInjurySchema,
  injuryNames: z
    .array(z.string().trim().min(1, "傷病名は必須です"))
    .min(1, "傷病名は必須です"),
  injuryMasterIds: z.array(z.string().nullable()).optional(),
  medicalInjuryNames: z.array(z.string().nullable()).optional(),
});

/**
 * GET /api/charts
 * カルテ一覧取得
 * クエリパラメータ:
 *   - patientId: 患者ID（必須）
 *   - status: ステータスフィルタ（オプション）
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "CHART", "READ");

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");
    const rawStatus = searchParams.get("status");
    const status = rawStatus ? normalizeChartStatus(rawStatus) : null;

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

    const charts = await prisma.chart.findMany({
      where: {
        patientId,
        ...(status ? { status } : {}),
      },
      include: {
        _count: {
          select: { injuries: true, visits: true },
        },
        injuries: {
          where: { isDeleted: false },
          select: { id: true, injuryName: true },
          take: 5,
        },
        visits: {
          orderBy: { visitDate: "desc" },
          take: 1,
          select: { visitDate: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // 件数情報を付加
    const chartsWithCounts = charts.map((chart) => {
      const insurance = decryptInsuranceFields(chart);
      return {
        id: chart.id,
        patientId: chart.patientId,
        status: normalizeChartStatus(chart.status),
        insuranceType: chart.insuranceType,
        insuranceNumber: insurance.insuranceNumber,
        insuranceInsurerNumber: insurance.insuranceInsurerNumber,
        insuranceCertificateSymbol: insurance.insuranceCertificateSymbol,
        insuranceCertificateNumber: insurance.insuranceCertificateNumber,
        insuranceExpiryDate: insurance.insuranceExpiryDate,
        insuranceEffectiveFrom: insurance.insuranceEffectiveFrom,
        insuranceCopaymentRate: insurance.insuranceCopaymentRate,
        publicAssistanceNumber: insurance.publicAssistanceNumber,
        publicAssistanceRecipient: insurance.publicAssistanceRecipient,
        firstVisitDate: chart.firstVisitDate,
        lastVisitDate:
          chart.visits[0]?.visitDate || chart.lastVisitDate || null,
        createdAt: chart.createdAt,
        updatedAt: chart.updatedAt,
        injuryCount: chart._count.injuries,
        visitCount: chart._count.visits,
        injuries: chart.injuries,
        visits: chart.visits,
      };
    });

    // 閲覧ログ（カルテ一覧）
    const auditData = getAuditLogData(
      request,
      user.id,
      "READ",
      "CHART",
      undefined,
    );
    await createAuditLog({
      ...auditData,
      action: "READ",
      entityType: "CHART",
      entityId: undefined,
      category: "DATA_ACCESS",
      metadata: {
        patientId,
        statusFilter: status || null,
        resultCount: chartsWithCounts.length,
      },
    }).catch((error) => console.error("Failed to create audit log:", error));

    return NextResponse.json(chartsWithCounts);
  } catch (error) {
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json(
        { error: getSafeErrorMessage(error) },
        { status: 403 },
      );
    }
    console.error("Charts list error:", error);
    return NextResponse.json(
      { error: "カルテ一覧の取得に失敗しました" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/charts
 * カルテ作成
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "CHART", "CREATE");

    const body = await request.json();
    const validatedData = chartSchema.parse(body);
    const { sharedInjury, injuryNames, injuryMasterIds, medicalInjuryNames } =
      validatedData;

    await requireApiPermission(user.id, "INJURY", "CREATE");

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

    const latestChart = await prisma.chart.findFirst({
      where: { patientId: validatedData.patientId },
      orderBy: { createdAt: "desc" },
    });

    const fallbackInsurance = latestChart
      ? decryptInsuranceFields(latestChart)
      : null;
    const incomingInsurance = normalizeInsuranceInput(validatedData);
    const mergedInsurance = mergeInsuranceDefaults(
      incomingInsurance,
      fallbackInsurance,
    );
    const encryptedInsurance = encryptInsuranceFields(mergedInsurance);

    const injuryDate = new Date(sharedInjury.injuryDate);
    const firstVisitDate = new Date(sharedInjury.firstVisitDate);
    const validationResult = validateInjury({
      injuryDate,
      firstVisitDate,
    });

    for (const [index, injuryName] of injuryNames.entries()) {
      const masterId =
        injuryMasterIds && injuryMasterIds.length > index
          ? injuryMasterIds[index]
          : null;
      const missingLaterality = await findMissingLaterality(
        injuryName,
        masterId,
      );
      if (missingLaterality) {
        return NextResponse.json(
          { error: `左右（右/左）を入力してください: ${missingLaterality}` },
          { status: 400 },
        );
      }
    }

    if (!validationResult.isValid) {
      return NextResponse.json(
        {
          error: validationResult.errors.join("、"),
          warnings: validationResult.warnings,
        },
        { status: 400 },
      );
    }

    const { chart, createdInjuries } = await prisma.$transaction(async (tx) => {
      const chart = await tx.chart.create({
        data: {
          patientId: validatedData.patientId,
          insuranceType: validatedData.insuranceType || null,
          status: validatedData.status || ACTIVE_CHART_STATUS,
          firstVisitDate,
          ...encryptedInsurance,
        },
      });

      const createdInjuries = [];
      for (const [index, injuryName] of injuryNames.entries()) {
        const judoInjuryMasterId =
          injuryMasterIds && injuryMasterIds.length > index
            ? injuryMasterIds[index]
            : null;
        const medicalInjuryName =
          medicalInjuryNames && medicalInjuryNames.length > index
            ? medicalInjuryNames[index]
            : null;
        const injury = await tx.injury.create({
          data: {
            patientId: validatedData.patientId,
            chartId: chart.id,
            injuryDate,
            memo: sharedInjury.memo || null,
            injuryName,
            medicalInjuryName: medicalInjuryName || null,
            firstVisitDate,
            judoInjuryMasterId,
          },
        });
        createdInjuries.push(injury);
      }

      return { chart, createdInjuries };
    });

    // 監査ログを記録
    const auditData = getAuditLogData(
      request,
      user.id,
      "CREATE",
      "CHART",
      chart.id,
    );
    await createAuditLog({
      ...auditData,
      action: "CREATE",
      entityType: "CHART",
      entityId: chart.id,
      category: "DATA_MODIFICATION",
      metadata: {
        patientId: validatedData.patientId,
        insuranceType: validatedData.insuranceType,
      },
    }).catch((error) => {
      console.error("Failed to create audit log:", error);
    });

    for (const entry of createdInjuries) {
      const injuryAuditData = getAuditLogData(
        request,
        user.id,
        "CREATE",
        "INJURY",
        entry.id,
      );
      await createAuditLog({
        ...injuryAuditData,
        action: "CREATE",
        entityType: "INJURY",
        entityId: entry.id,
        category: "DATA_MODIFICATION",
        metadata: {
          patientId: validatedData.patientId,
          injuryName: entry.injuryName,
        },
      }).catch((error) => {
        console.error("Failed to create injury audit log:", error);
      });
    }

    await Promise.all([
      logEvent("CRUD", { entity: "CHART", action: "CREATE" }, user.id),
      ...createdInjuries.map(() =>
        logEvent("CRUD", { entity: "INJURY", action: "CREATE" }, user.id),
      ),
    ]).catch((error) => {
      console.error("Failed to log chart/injury CRUD events:", error);
    });

    const insurance = decryptInsuranceFields(chart);
    return NextResponse.json({
      ...chart,
      ...insurance,
      warnings:
        validationResult.warnings.length > 0
          ? validationResult.warnings
          : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: getSafeErrorMessage(error.errors[0].message) },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json(
        { error: getSafeErrorMessage(error) },
        { status: 403 },
      );
    }
    console.error("Chart creation error:", error);
    return NextResponse.json(
      { error: "カルテの作成に失敗しました" },
      { status: 500 },
    );
  }
}
