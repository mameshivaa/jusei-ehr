import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac";
import {
  getJstDayRangeFromDateKey,
  getTodayDateKeyJst,
} from "@/lib/utils/date";
import { createAuditLog, getAuditLogData } from "@/lib/audit";

export async function GET(request: NextRequest) {
  let userId: string | undefined;
  let dateKey: string | null = null;
  try {
    const user = await requireAuth();
    userId = user.id;
    await requireApiPermission(user.id, "VISIT", "READ");

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    dateKey = dateParam;
    let start: Date;
    let end: Date;

    if (dateParam) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return NextResponse.json(
          { error: "dateの形式が不正です" },
          { status: 400 },
        );
      }
      const { startUtc, endUtc } = getJstDayRangeFromDateKey(dateParam);
      start = startUtc;
      end = endUtc;
    } else {
      const { startUtc, endUtc } =
        getJstDayRangeFromDateKey(getTodayDateKeyJst());
      start = startUtc;
      end = endUtc;
    }

    const visits = await prisma.visit.findMany({
      where: {
        visitDate: { gte: start, lte: end },
      },
      orderBy: { visitDate: "desc" },
      include: {
        patient: {
          select: { id: true, name: true, kana: true, patientNumber: true },
        },
        chart: { select: { id: true, insuranceType: true } },
        _count: { select: { treatmentRecords: true } },
      },
      take: 200,
    });

    const auditData = getAuditLogData(request, userId, "READ", "VISIT");
    await createAuditLog({
      ...auditData,
      action: "READ",
      entityType: "VISIT",
      category: "DATA_ACCESS",
      metadata: {
        view: "RECEPTION_TODAY",
        date: dateKey,
        resultCount: visits.length,
      },
    });

    return NextResponse.json(
      visits.map((v) => ({
        id: v.id,
        visitDate: v.visitDate,
        patient: v.patient,
        chart: v.chart,
        chartId: v.chart?.id ?? null,
        recordCount: v._count?.treatmentRecords ?? 0,
      })),
    );
  } catch (error) {
    const auditData = getAuditLogData(request, userId, "READ", "VISIT");
    await createAuditLog({
      ...auditData,
      action: "READ",
      entityType: "VISIT",
      category: "SYSTEM",
      severity: "ERROR",
      metadata: {
        success: false,
        view: "RECEPTION_TODAY",
        date: dateKey,
        reason: error instanceof Error ? error.message : String(error),
      },
    });
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("reception today error", error);
    return NextResponse.json(
      { error: "受付一覧の取得に失敗しました" },
      { status: 500 },
    );
  }
}
