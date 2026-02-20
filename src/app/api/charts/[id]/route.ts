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
  normalizeInsuranceInput,
} from "@/lib/charts/insurance";
import { normalizeChartStatus } from "@/lib/charts/status";
import { INSURANCE_OPTIONS } from "@/lib/charts/insurance-options";
import { logEvent } from "@/lib/activity-log";

const updateChartSchema = z.object({
  insuranceType: z
    .enum(INSURANCE_OPTIONS, {
      errorMap: () => ({ message: "保険種別を選択してください" }),
    })
    .optional(),
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
});

/**
 * GET /api/charts/[id]
 * カルテ概要取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "CHART", "READ");

    const chart = await prisma.chart.findUnique({
      where: { id: params.id },
      include: {
        patient: {
          select: { id: true, name: true, kana: true, patientNumber: true },
        },
        injuries: {
          where: { isDeleted: false },
          orderBy: { injuryDate: "desc" },
          include: {
            _count: {
              select: { treatmentRecords: true },
            },
          },
        },
        visits: {
          orderBy: { visitDate: "desc" },
          take: 20,
          include: {
            treatmentRecords: {
              select: { id: true },
            },
          },
        },
        _count: {
          select: { injuries: true, visits: true },
        },
      },
    });

    if (!chart) {
      return NextResponse.json(
        { error: "カルテが見つかりません" },
        { status: 404 },
      );
    }

    const insurance = decryptInsuranceFields(chart);
    return NextResponse.json({
      ...chart,
      ...insurance,
      status: normalizeChartStatus(chart.status),
      injuryCount: chart._count.injuries,
      visitCount: chart._count.visits,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json(
        { error: getSafeErrorMessage(error) },
        { status: 403 },
      );
    }
    console.error("Chart fetch error:", error);
    return NextResponse.json(
      { error: "カルテの取得に失敗しました" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/charts/[id]
 * カルテ更新
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "CHART", "UPDATE");

    const body = await request.json();
    const validatedData = updateChartSchema.parse(body);

    // カルテの存在確認
    const existingChart = await prisma.chart.findUnique({
      where: { id: params.id },
    });
    if (!existingChart) {
      return NextResponse.json(
        { error: "カルテが見つかりません" },
        { status: 404 },
      );
    }

    const oldData = {
      insuranceType: existingChart.insuranceType,
      status: existingChart.status,
      insurance: decryptInsuranceFields(existingChart),
    };

    const chart = await prisma.chart.update({
      where: { id: params.id },
      data: {
        ...(validatedData.insuranceType !== undefined && {
          insuranceType: validatedData.insuranceType,
        }),
        ...(validatedData.status !== undefined && {
          status: validatedData.status,
        }),
        ...encryptInsuranceFields(normalizeInsuranceInput(validatedData)),
      },
    });

    const decryptedInsurance = decryptInsuranceFields(chart);
    // 監査ログを記録
    const auditData = getAuditLogData(
      request,
      user.id,
      "UPDATE",
      "CHART",
      chart.id,
    );
    await createAuditLog({
      ...auditData,
      action: "UPDATE",
      entityType: "CHART",
      entityId: chart.id,
      category: "DATA_MODIFICATION",
      metadata: {
        oldData,
        newData: {
          insuranceType: chart.insuranceType,
          status: chart.status,
          insurance: decryptedInsurance,
        },
      },
    }).catch((error) => {
      console.error("Failed to create audit log:", error);
    });

    await logEvent("CRUD", { entity: "CHART", action: "UPDATE" }, user.id);

    return NextResponse.json({
      ...chart,
      ...decryptedInsurance,
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
    console.error("Chart update error:", error);
    return NextResponse.json(
      { error: "カルテの更新に失敗しました" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/charts/[id]
 * カルテ削除（傷病や来院がある場合は削除不可）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "CHART", "DELETE");

    // カルテの存在確認と関連データのチェック
    const chart = await prisma.chart.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { injuries: true, visits: true },
        },
      },
    });

    if (!chart) {
      return NextResponse.json(
        { error: "カルテが見つかりません" },
        { status: 404 },
      );
    }

    // 傷病や来院がある場合は削除不可
    if (chart._count.injuries > 0 || chart._count.visits > 0) {
      return NextResponse.json(
        {
          error:
            "傷病または来院記録が存在するカルテは削除できません。先に関連データを削除または移動してください。",
        },
        { status: 400 },
      );
    }

    await prisma.chart.delete({
      where: { id: params.id },
    });

    // 監査ログを記録
    const auditData = getAuditLogData(
      request,
      user.id,
      "DELETE",
      "CHART",
      params.id,
    );
    await createAuditLog({
      ...auditData,
      action: "DELETE",
      entityType: "CHART",
      entityId: params.id,
      category: "DATA_MODIFICATION",
      metadata: {
        patientId: chart.patientId,
        insuranceType: chart.insuranceType,
      },
    }).catch((error) => {
      console.error("Failed to create audit log:", error);
    });

    await logEvent("CRUD", { entity: "CHART", action: "DELETE" }, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json(
        { error: getSafeErrorMessage(error) },
        { status: 403 },
      );
    }
    console.error("Chart deletion error:", error);
    return NextResponse.json(
      { error: "カルテの削除に失敗しました" },
      { status: 500 },
    );
  }
}
