import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { prisma } from "@/lib/prisma";

type RecordRow = {
  id: string;
  narrative: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
};

const trimOrNull = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildSoapLines = (row: RecordRow): string[] => {
  const lines: string[] = [];
  const subjective = trimOrNull(row.subjective);
  const objective = trimOrNull(row.objective);
  const assessment = trimOrNull(row.assessment);
  const plan = trimOrNull(row.plan);
  if (subjective) lines.push(`S: ${subjective}`);
  if (objective) lines.push(`O: ${objective}`);
  if (assessment) lines.push(`A: ${assessment}`);
  if (plan) lines.push(`P: ${plan}`);
  return lines;
};

const mergeNarrative = (row: RecordRow): string | null => {
  const narrative = trimOrNull(row.narrative);
  const soapLines = buildSoapLines(row);

  if (!narrative && soapLines.length === 0) {
    return null;
  }
  if (!narrative) {
    return soapLines.join("\n");
  }
  if (soapLines.length === 0) {
    return narrative;
  }

  const hasAll = soapLines.every((line) => narrative.includes(line));
  if (hasAll) {
    return narrative;
  }
  return [narrative, "", ...soapLines].join("\n");
};

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitArg = args.findIndex((arg) => arg === "--limit");
  const limit = limitArg !== -1 ? parseNumber(args[limitArg + 1], 0) : 0;

  let rows: RecordRow[] = [];
  try {
    rows = await prisma.$queryRawUnsafe<RecordRow[]>(
      `
      SELECT id, narrative, subjective, objective, assessment, plan
      FROM treatment_records
      ORDER BY updatedAt DESC
      ${limit > 0 ? `LIMIT ${limit}` : ""}
      `,
    );
  } catch (error) {
    console.error(
      "Failed to load treatment_records with SOAP columns. Run this before the schema migration.",
    );
    throw error;
  }

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const nextNarrative = mergeNarrative(row);
    const current = trimOrNull(row.narrative);
    const next = trimOrNull(nextNarrative);

    if (current === next) {
      skipped += 1;
      continue;
    }

    if (!dryRun) {
      await prisma.$executeRaw`
        UPDATE treatment_records
        SET narrative = ${next}
        WHERE id = ${row.id}
      `;
    }
    updated += 1;
  }

  console.log("SOAP -> narrative migration summary");
  console.log("records:", rows.length);
  console.log("updated:", updated);
  console.log("skipped:", skipped);
  if (dryRun) {
    console.log("dry-run: no changes were written");
  }
}

main()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
