import { PrismaClient } from "@prisma/client";
import { ACTIVE_CHART_STATUS } from "../src/lib/charts/status";

const prisma = new PrismaClient();

async function backfillChartStatus() {
  const updated = await prisma.$executeRaw`
    UPDATE charts
    SET status = ${ACTIVE_CHART_STATUS}
    WHERE status IN ('ACTIVE', 'FOLLOW_UP')
  `;

  const remaining = await prisma.$queryRaw<
    Array<{ count: number }>
  >`SELECT COUNT(*) as count FROM charts WHERE status IN ('ACTIVE', 'FOLLOW_UP')`;

  const updatedCount =
    typeof updated === "bigint" ? Number(updated) : Number(updated || 0);
  const remainingCount =
    Array.isArray(remaining) && remaining[0]?.count
      ? Number(remaining[0].count)
      : 0;

  console.log(
    `Chart status backfill complete. Updated ${updatedCount} rows. Remaining legacy rows: ${remainingCount}`,
  );
}

async function main() {
  try {
    await backfillChartStatus();
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Backfill failed", error);
    process.exit(1);
  });
}
