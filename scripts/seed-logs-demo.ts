import { prisma } from "@/lib/prisma";
import { ChartStatus } from "@prisma/client";

async function main() {
  const operator = await prisma.user.findFirst();
  const userId = operator?.id ?? null;

  // 患者とカルテを用意（既存なら再利用）
  const patient = await prisma.patient.upsert({
    where: { patientNumber: "D-LOG-DEMO-001" },
    update: {},
    create: {
      lastName: "田中",
      firstName: "太郎",
      lastKana: "タナカ",
      firstKana: "タロウ",
      name: "田中太郎",
      kana: "タナカタロウ",
      patientNumber: "D-LOG-DEMO-001",
      birthDate: new Date("1990-04-12"),
      gender: "男性",
    },
    include: { charts: { take: 1 } },
  });

  const chart =
    patient.charts[0] ||
    (await prisma.chart.create({
      data: {
        patientId: patient.id,
        status: ChartStatus.IN_TREATMENT,
        insuranceType: "標準カルテ",
        firstVisitDate: new Date(),
        lastVisitDate: new Date(),
      },
    }));

  const base = Date.now();
  const entries = [
    {
      action: "CREATE",
      category: "DATA_MODIFICATION",
      severity: "INFO",
      resourcePath: "/api/charts",
      minutesAgo: 120,
      metadata: { note: "初回作成", patientId: patient.id },
    },
    {
      action: "READ",
      category: "DATA_ACCESS",
      severity: "INFO",
      resourcePath: `/api/charts/${chart.id}/detail`,
      minutesAgo: 80,
      metadata: { previewedRecordIds: ["rec-a", "rec-b"], recordsCount: 2 },
    },
    {
      action: "UPDATE",
      category: "DATA_MODIFICATION",
      severity: "WARNING",
      resourcePath: `/api/charts/${chart.id}`,
      minutesAgo: 50,
      metadata: { changed: { status: "FOLLOW_UP" } },
    },
    {
      action: "READ",
      category: "DATA_ACCESS",
      severity: "INFO",
      resourcePath: `/api/treatment-records/abc123`,
      minutesAgo: 30,
      metadata: { visitId: "visit-123", detailCount: 3 },
    },
    {
      action: "CONFIRM",
      category: "DATA_MODIFICATION",
      severity: "INFO",
      resourcePath: `/api/treatment-records/abc123/confirm`,
      minutesAgo: 20,
      metadata: { version: 3, changeReason: "内容確定" },
    },
    {
      action: "DELETE",
      category: "DATA_MODIFICATION",
      severity: "CRITICAL",
      resourcePath: `/api/charts/${chart.id}`,
      minutesAgo: 10,
      metadata: { reason: "テスト削除", safeguard: "ロールバック前提" },
    },
  ];

  // 既存デモログを削除（同一chartIdのみ）
  await prisma.auditLog.deleteMany({
    where: {
      entityId: chart.id,
      resourcePath: { startsWith: "/api" },
    },
  });

  await prisma.auditLog.createMany({
    data: entries.map((e, idx) => ({
      userId,
      action: e.action,
      entityType: "CHART",
      entityId: chart.id,
      resourcePath: e.resourcePath,
      metadata: e.metadata as any,
      ipAddress: "127.0.0.1",
      userAgent: "demo-script",
      severity: e.severity,
      category: e.category,
      // 時間をずらして並べる
      createdAt: new Date(base - e.minutesAgo * 60_000 - idx * 5000),
    })),
  });

  console.log(
    "Demo logs injected for chart",
    chart.id,
    "patient",
    patient.patientNumber,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
