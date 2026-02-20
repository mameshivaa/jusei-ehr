import { prisma } from "@/lib/prisma";

import { ACTIVE_CHART_STATUS } from "@/lib/charts/status";

/**
 * 患者ごとのデフォルトChartを取得（存在しなければ作成）。
 * 既存データ後方互換のためのヘルパー。
 */
export async function getOrCreateDefaultChart(patientId: string) {
  await prisma.$executeRaw`
    UPDATE charts
    SET status = ${ACTIVE_CHART_STATUS}
    WHERE patientId = ${patientId}
      AND status IN ('ACTIVE', 'FOLLOW_UP')
  `;

  const existing = await prisma.chart.findFirst({
    where: { patientId, status: ACTIVE_CHART_STATUS },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  return prisma.chart.create({
    data: {
      patientId,
      status: ACTIVE_CHART_STATUS,
    },
  });
}
