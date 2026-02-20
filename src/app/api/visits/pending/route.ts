import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac";
import {
  getJstDayRangeFromDateKey,
  getTodayDateKeyJst,
} from "@/lib/utils/date";

/**
 * 指定日の「施術録未記載」来院一覧を返す（date未指定時は本日）。
 * 条件: visitDate が対象日 & treatmentRecords が 0 件。
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "VISIT", "READ");

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
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
        treatmentRecords: { none: { isDeleted: false } },
      },
      orderBy: { visitDate: "asc" },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            kana: true,
            patientNumber: true,
          },
        },
        chart: {
          select: { id: true, insuranceType: true },
        },
      },
      take: 200,
    });

    return NextResponse.json(
      visits.map((v) => ({
        id: v.id,
        chartId: v.chart?.id ?? null,
        chartInsuranceType: v.chart?.insuranceType ?? null,
        visitDate: v.visitDate,
        patient: v.patient,
      })),
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("pending visits error", error);
    return NextResponse.json(
      { error: "記載待ち一覧の取得に失敗しました" },
      { status: 500 },
    );
  }
}
