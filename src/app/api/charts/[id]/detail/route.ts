import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requireApiPermission } from "@/lib/rbac";
import { normalizeChartStatus } from "@/lib/charts/status";
import { createAuditLog, getAuditLogData } from "@/lib/audit";

export const dynamic = "force-dynamic";

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
          select: {
            id: true,
            injuryName: true,
            medicalInjuryName: true,
            injuryDate: true,
            firstVisitDate: true,
          },
        },
        _count: {
          select: { visits: true, injuries: true },
        },
      },
    });

    if (!chart) {
      return NextResponse.json(
        { error: "カルテが見つかりません" },
        { status: 404 },
      );
    }

    const records = await prisma.treatmentRecord.findMany({
      where: {
        visit: {
          chartId: chart.id,
        },
      },
      orderBy: { updatedAt: "asc" },
      select: {
        id: true,
        visitId: true,
        updatedAt: true,
        narrative: true,
        visit: {
          select: { visitDate: true },
        },
        updatedByUser: {
          select: { name: true },
        },
        history: {
          select: {
            id: true,
            changedAt: true,
            changeType: true,
            changeReason: true,
            beforeData: true,
            afterData: true,
            changedByUser: {
              select: { name: true },
            },
          },
          orderBy: { changedAt: "desc" },
        },
      },
    });

    const recordsCount = await prisma.treatmentRecord.count({
      where: { visit: { chartId: chart.id } },
    });

    const getNarrative = (value: unknown): string | null => {
      if (!value || typeof value !== "object") return null;
      if (Array.isArray(value)) return null;
      const maybe = value as { narrative?: unknown };
      return typeof maybe.narrative === "string" ? maybe.narrative : null;
    };

    const recentRecords = records.map((record) => {
      const narrative = record.narrative;
      const previewSource = narrative ?? "";
      const preview = previewSource
        ? previewSource.length > 160
          ? `${previewSource.slice(0, 160)}…`
          : previewSource
        : null;

      return {
        id: record.id,
        visitId: record.visitId,
        visitDate: record.visit?.visitDate ?? null,
        updatedAt: record.updatedAt,
        practitioner: null,
        updatedBy: record.updatedByUser?.name ?? null,
        narrative,
        narrativePreview: preview,
        history: record.history.map((h) => ({
          id: h.id,
          changedAt: h.changedAt,
          changeType: h.changeType,
          changeReason: h.changeReason,
          changedBy: h.changedByUser?.name ?? null,
          beforeNarrative: getNarrative(h.beforeData),
          afterNarrative: getNarrative(h.afterData),
        })),
      };
    });

    const payload = {
      id: chart.id,
      status: normalizeChartStatus(chart.status),
      insuranceType: chart.insuranceType,
      startDate: chart.firstVisitDate,
      endDate: chart.lastVisitDate,
      closedAt: null as null,
      closureReason: null as null,
      recordsCount,
      injuriesCount: chart._count.injuries,
      visitsCount: chart._count.visits,
      recentRecords,
      injuries: chart.injuries,
      patient: chart.patient,
    };

    // 閲覧ログ（開いたが更新していないケースも記録）
    const auditData = getAuditLogData(
      request,
      user.id,
      "READ",
      "CHART",
      chart.id,
    );
    await createAuditLog({
      ...auditData,
      action: "READ",
      entityType: "CHART",
      entityId: chart.id,
      category: "DATA_ACCESS",
      metadata: {
        recordsCount,
        injuriesCount: chart._count.injuries,
        visitsCount: chart._count.visits,
        previewedRecordIds: recentRecords.map((r) => r.id),
      },
    }).catch((error) => console.error("Failed to create audit log:", error));

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("chart detail error", error);
    return NextResponse.json(
      { error: "カルテ概要の取得に失敗しました" },
      { status: 500 },
    );
  }
}
