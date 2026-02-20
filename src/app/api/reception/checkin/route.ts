import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import { requireApiPermission } from "@/lib/rbac";
import { getOrCreateDefaultChart } from "@/lib/charts/get-default-chart";
import { ACTIVE_CHART_STATUS, normalizeChartStatus } from "@/lib/charts/status";
import { logEvent, logFeatureAction } from "@/lib/activity-log";
import { getJstDayRangeFromDate } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

const checkinSchema = z.object({
  patientId: z.string().min(1, "患者IDは必須です"),
  chartId: z.string().optional(),
  visitDate: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "VISIT", "CREATE");

    const body = await request.json();
    const input = checkinSchema.parse(body);

    // 存在確認
    const patient = await prisma.patient.findUnique({
      where: { id: input.patientId, isDeleted: false },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json(
        { error: "患者が見つかりません" },
        { status: 404 },
      );
    }

    // chartId指定があれば存在チェック、なければデフォルト生成
    const chart = input.chartId
      ? await prisma.chart.findFirst({
          where: { id: input.chartId, patientId: input.patientId },
          select: { id: true, patientId: true, status: true },
        })
      : await getOrCreateDefaultChart(input.patientId);

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

    const visitDate = input.visitDate ? new Date(input.visitDate) : new Date();
    if (Number.isNaN(visitDate.getTime())) {
      return NextResponse.json(
        { error: "visitDateの形式が不正です" },
        { status: 400 },
      );
    }

    const { startUtc: startOfDay, endUtc: endOfDay } =
      getJstDayRangeFromDate(visitDate);

    const existing = await prisma.visit.findFirst({
      where: {
        chartId: chart.id,
        visitDate: { gte: startOfDay, lte: endOfDay },
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "同一カルテの同一日の受付は既に登録されています" },
        { status: 409 },
      );
    }

    // 記載待ち・受付一覧の日付範囲と一致させるため、その日の JST 0 時に正規化して保存
    const visitDateToStore = startOfDay;

    const visit = await prisma.visit.create({
      data: {
        patientId: input.patientId,
        chartId: chart.id,
        visitDate: visitDateToStore,
      },
      include: {
        patient: {
          select: { name: true, kana: true },
        },
      },
    });

    if (process.env.DEV_BYPASS_AUTH !== "true") {
      const audit = getAuditLogData(
        request,
        user.id,
        "CREATE",
        "VISIT",
        visit.id,
      );
      await createAuditLog({
        ...audit,
        action: "CREATE",
        entityType: "VISIT",
        entityId: visit.id,
        category: "DATA_MODIFICATION",
        metadata: { patientId: input.patientId, visitDate: visit.visitDate },
      }).catch((e) => console.error("audit log failed", e));
    }

    await Promise.all([
      logEvent("CRUD", { entity: "VISIT", action: "CREATE" }, user.id),
      logFeatureAction("reception.checkin", user.id),
    ]).catch((error) => {
      console.error("Failed to log reception checkin event:", error);
    });

    return NextResponse.json(visit);
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
    console.error("reception checkin error", error);
    return NextResponse.json({ error: "受付に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "VISIT", "DELETE");

    const { searchParams } = new URL(request.url);
    const visitId = searchParams.get("id");
    if (!visitId) {
      return NextResponse.json(
        { error: "visit id が必要です" },
        { status: 400 },
      );
    }

    const existing = await prisma.visit.findUnique({ where: { id: visitId } });
    if (!existing) {
      return NextResponse.json(
        { error: "来院記録が見つかりません" },
        { status: 404 },
      );
    }

    await prisma.visit.delete({ where: { id: visitId } });

    if (process.env.DEV_BYPASS_AUTH !== "true") {
      const audit = getAuditLogData(
        request,
        user.id,
        "DELETE",
        "VISIT",
        visitId,
      );
      await createAuditLog({
        ...audit,
        action: "DELETE",
        entityType: "VISIT",
        entityId: visitId,
        category: "DATA_MODIFICATION",
        metadata: {
          patientId: existing.patientId,
          visitDate: existing.visitDate,
        },
      }).catch((e) => console.error("audit log failed", e));
    }

    await Promise.all([
      logEvent("CRUD", { entity: "VISIT", action: "DELETE" }, user.id),
      logFeatureAction("reception.cancel", user.id),
    ]).catch((error) => {
      console.error("Failed to log reception cancel event:", error);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("reception cancel error", error);
    return NextResponse.json(
      { error: "受付取り消しに失敗しました" },
      { status: 500 },
    );
  }
}
