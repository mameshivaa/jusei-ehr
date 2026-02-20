import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import { createAccessLog } from "@/lib/security/access-log";
import { getOrCreateDefaultChart } from "@/lib/charts/get-default-chart";
import { logEvent } from "@/lib/activity-log";

const visitSchema = z.object({
  patientId: z.string().min(1, "患者IDは必須です"),
  chartId: z.string().optional(),
  visitDate: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const validatedData = visitSchema.parse(body);

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

    // chartIdが指定されている場合はそのカルテを使用、なければデフォルトカルテ
    let chartId = validatedData.chartId;
    if (!chartId) {
      const chart = await getOrCreateDefaultChart(validatedData.patientId);
      chartId = chart.id;
    } else {
      // 指定されたカルテの存在確認
      const chart = await prisma.chart.findUnique({
        where: { id: chartId },
        select: { patientId: true },
      });
      if (!chart || chart.patientId !== validatedData.patientId) {
        return NextResponse.json(
          { error: "カルテが見つかりません" },
          { status: 404 },
        );
      }
    }

    const visit = await prisma.visit.create({
      data: {
        patientId: validatedData.patientId,
        chartId,
        visitDate: validatedData.visitDate
          ? new Date(validatedData.visitDate)
          : new Date(),
      },
    });

    // 監査ログを記録
    const auditData = getAuditLogData(
      request,
      user.id,
      "CREATE",
      "VISIT",
      visit.id,
    );
    await createAuditLog({
      ...auditData,
      action: "CREATE",
      entityType: "VISIT",
      entityId: visit.id,
      category: "DATA_MODIFICATION",
      metadata: {
        patientId: validatedData.patientId,
        visitDate: visit.visitDate,
      },
    });
    await logEvent("CRUD", { entity: "VISIT", action: "CREATE" }, user.id);

    return NextResponse.json(visit);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 },
      );
    }
    console.error("Visit creation error:", error);
    return NextResponse.json(
      { error: "来院記録の作成に失敗しました" },
      { status: 500 },
    );
  }
}
