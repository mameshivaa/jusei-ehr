import { NextRequest, NextResponse } from "next/server";
import { ChartStatus, Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac";
import { normalizeChartStatus } from "@/lib/charts/status";
import { createAuditLog, getAuditLogData } from "@/lib/audit";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

export async function GET(request: NextRequest) {
  let userId: string | undefined;
  let query = "";
  let statusFilterForLog: string | null = null;
  let takeForLog = DEFAULT_LIMIT;
  try {
    const user = await requireAuth();
    userId = user.id;
    await requireApiPermission(user.id, "CHART", "READ");

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    query = q;
    const rawStatus = searchParams.get("status");
    const limitParam = Number(searchParams.get("limit"));
    const take = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;
    takeForLog = take;

    const statusFilter =
      rawStatus && rawStatus.toUpperCase() in ChartStatus
        ? normalizeChartStatus(rawStatus)
        : null;
    statusFilterForLog = statusFilter;

    const where: Prisma.ChartWhereInput = {
      ...(statusFilter ? { status: statusFilter } : {}),
      AND: [
        { patient: { isDeleted: false } },
        ...(q
          ? [
              {
                OR: [
                  { insuranceType: { contains: q } },
                  {
                    patient: {
                      OR: [
                        { name: { contains: q } },
                        { kana: { contains: q } },
                        { patientNumber: { contains: q } },
                      ],
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };

    const charts = await prisma.chart.findMany({
      where,
      include: {
        patient: {
          select: { id: true, name: true, kana: true, patientNumber: true },
        },
        _count: {
          select: { injuries: true, visits: true },
        },
        visits: {
          orderBy: { visitDate: "desc" },
          take: 1,
          select: { visitDate: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take,
    });

    const payload = charts.map((chart) => ({
      id: chart.id,
      status: normalizeChartStatus(chart.status),
      patient: chart.patient,
      insuranceType: chart.insuranceType,
      firstVisitDate: chart.firstVisitDate,
      lastVisitDate: chart.visits[0]?.visitDate ?? chart.lastVisitDate ?? null,
      injuriesCount: chart._count.injuries,
      visitsCount: chart._count.visits,
      updatedAt: chart.updatedAt,
      createdAt: chart.createdAt,
    }));

    const auditData = getAuditLogData(request, userId, "READ", "CHART");
    await createAuditLog({
      ...auditData,
      action: "READ",
      entityType: "CHART",
      category: "DATA_ACCESS",
      metadata: {
        view: "CHARTS_ALL",
        q: query || null,
        status: statusFilterForLog,
        take: takeForLog,
        resultCount: payload.length,
      },
    });

    return NextResponse.json(payload);
  } catch (error) {
    const auditData = getAuditLogData(request, userId, "READ", "CHART");
    await createAuditLog({
      ...auditData,
      action: "READ",
      entityType: "CHART",
      category: "SYSTEM",
      severity: "ERROR",
      metadata: {
        success: false,
        view: "CHARTS_ALL",
        q: query || null,
        status: statusFilterForLog,
        take: takeForLog,
        reason: error instanceof Error ? error.message : String(error),
      },
    });
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("charts/all error", error);
    return NextResponse.json(
      { error: "カルテ一覧の取得に失敗しました" },
      { status: 500 },
    );
  }
}
