import { ChartStatus, Prisma, $Enums } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac";
import { normalizeChartStatus } from "@/lib/charts/status";
import { createAuditLog, getAuditLogData } from "@/lib/audit";

export const dynamic = "force-dynamic";

const CLOSED_CHART_STATUSES: ChartStatus[] = [
  $Enums.ChartStatus.HEALED,
  $Enums.ChartStatus.DISCONTINUED,
  $Enums.ChartStatus.TRANSFERRED,
];
const ACTIVE_CHART_FILTER: Prisma.EnumChartStatusFilter<"Chart"> = {
  notIn: CLOSED_CHART_STATUSES,
};

// Chart を Injury に読み替えた一覧（受付検索用）
export async function GET(request: NextRequest) {
  let userId: string | undefined;
  let query = "";
  try {
    const user = await requireAuth();
    userId = user.id;
    await requireApiPermission(user.id, "PATIENT", "READ");

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    query = q;

    const where = Prisma.validator<Prisma.PatientWhereInput>()({
      isDeleted: false,
      charts: {
        some: {
          status: ACTIVE_CHART_FILTER,
        },
      },
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { kana: { contains: q } },
              { patientNumber: { contains: q } },
            ],
          }
        : {}),
    });

    const patientQuery = Prisma.validator<Prisma.PatientFindManyArgs>()({
      where,
      orderBy: [{ updatedAt: "desc" }],
      take: 50,
      select: {
        id: true,
        name: true,
        kana: true,
        patientNumber: true,
        birthDate: true,
        charts: {
          where: {
            status: ACTIVE_CHART_FILTER,
          },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            status: true,
            insuranceType: true,
            firstVisitDate: true,
            lastVisitDate: true,
            _count: { select: { injuries: true, visits: true } },
            visits: {
              orderBy: { visitDate: "desc" },
              take: 1,
              select: { visitDate: true },
            },
          },
        },
      },
    });

    const patients = await prisma.patient.findMany(patientQuery);

    const auditData = getAuditLogData(request, userId, "READ", "PATIENT");
    await createAuditLog({
      ...auditData,
      action: "READ",
      entityType: "PATIENT",
      category: "DATA_ACCESS",
      metadata: {
        view: "RECEPTION_ALL_CHARTS",
        q: query || null,
        resultCount: patients.length,
      },
    });

    return NextResponse.json(
      patients.map((p) => ({
        id: p.id,
        name: p.name,
        kana: p.kana,
        patientNumber: p.patientNumber,
        birthDate: p.birthDate,
        charts: (p.charts ?? []).map((c) => ({
          id: c.id,
          status: normalizeChartStatus(c.status),
          insuranceType: c.insuranceType,
          firstVisitDate: c.firstVisitDate,
          injuriesCount: c._count.injuries,
          visitsCount: c._count.visits,
          lastVisit: c.visits[0]?.visitDate ?? c.lastVisitDate ?? null,
        })),
      })),
    );
  } catch (error) {
    const auditData = getAuditLogData(request, userId, "READ", "PATIENT");
    await createAuditLog({
      ...auditData,
      action: "READ",
      entityType: "PATIENT",
      category: "SYSTEM",
      severity: "ERROR",
      metadata: {
        success: false,
        view: "RECEPTION_ALL_CHARTS",
        q: query || null,
        reason: error instanceof Error ? error.message : String(error),
      },
    });
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("reception all-charts error", error);
    return NextResponse.json(
      { error: "受付データの取得に失敗しました" },
      { status: 500 },
    );
  }
}
