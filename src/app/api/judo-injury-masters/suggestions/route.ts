import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getSafeErrorMessage } from "@/lib/security/error-sanitizer";
import { JUDO_INJURY_MASTER } from "@/lib/judo-injury-master-data";

const CATEGORY_LABELS = {
  FRACTURE: "骨折",
  INCOMPLETE_FRACTURE: "不全骨折",
  DISLOCATION: "脱臼",
  CONTUSION: "打撲",
  SPRAIN: "捻挫",
  STRAIN: "挫傷",
} as const;

const CATEGORY_ORDER = [
  "INCOMPLETE_FRACTURE",
  "FRACTURE",
  "DISLOCATION",
  "CONTUSION",
  "SPRAIN",
  "STRAIN",
] as const;

const normalize = (text: string) =>
  text
    .replace(/\s+/g, "")
    .replace(/[‐‑‒–—―－]/g, "-")
    .replace(/[（）]/g, (m) => (m === "（" ? "(" : ")"))
    .toLowerCase();

const detectCategory = (raw: string) => {
  if (raw.includes("不全骨折")) return "INCOMPLETE_FRACTURE";
  if (raw.includes("骨折")) return "FRACTURE";
  if (raw.includes("脱臼")) return "DISLOCATION";
  if (raw.includes("捻挫")) return "SPRAIN";
  if (raw.includes("打撲")) return "CONTUSION";
  if (raw.includes("挫傷")) return "STRAIN";
  return null;
};

const detectLaterality = (raw: string) => {
  if (raw.includes("右")) return "右";
  if (raw.includes("左")) return "左";
  return "";
};

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const existingMaster = await prisma.judoInjuryMaster.findFirst({
      select: { id: true },
    });
    if (!existingMaster) {
      await prisma.judoInjuryMaster.createMany({
        data: JUDO_INJURY_MASTER,
      });
    }
    const legacyBackLabel = await prisma.judoInjuryMaster.findFirst({
      where: { category: "CONTUSION", partLabel: "背部（肩部を含む）" },
      select: { id: true },
    });
    if (legacyBackLabel) {
      const newBackLabel = await prisma.judoInjuryMaster.findFirst({
        where: { category: "CONTUSION", partLabel: "背部" },
        select: { id: true },
      });
      if (!newBackLabel) {
        await prisma.judoInjuryMaster.updateMany({
          where: { category: "CONTUSION", partLabel: "背部（肩部を含む）" },
          data: { partLabel: "背部" },
        });
      }
    }
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) {
      return NextResponse.json({ suggestions: [] });
    }

    const normalized = normalize(q);
    const categoryFilter = detectCategory(q);
    const laterality = detectLaterality(q);

    const masters = await prisma.judoInjuryMaster.findMany({
      where: {
        isActive: true,
        ...(categoryFilter ? { category: categoryFilter } : {}),
      },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    });

    const suggestions = masters
      .flatMap((master) => {
        const partNorm = normalize(master.partLabel);
        const matched =
          normalized.includes(partNorm) || partNorm.includes(normalized);
        if (!matched) return null;
        const categoryLabel =
          CATEGORY_LABELS[master.category as keyof typeof CATEGORY_LABELS];
        const baseLabel = `${master.partLabel}${categoryLabel}`;
        if (!laterality && master.lateralityRule === "REQUIRED") {
          return [
            {
              id: master.id,
              label: `右${baseLabel}`,
              category: master.category,
              categoryLabel,
              partLabel: master.partLabel,
              sortOrder: master.sortOrder,
              lateralityRule: master.lateralityRule,
            },
            {
              id: master.id,
              label: `左${baseLabel}`,
              category: master.category,
              categoryLabel,
              partLabel: master.partLabel,
              sortOrder: master.sortOrder,
              lateralityRule: master.lateralityRule,
            },
          ];
        }
        const label = `${laterality}${baseLabel}`;
        return [
          {
            id: master.id,
            label,
            category: master.category,
            categoryLabel,
            partLabel: master.partLabel,
            sortOrder: master.sortOrder,
            lateralityRule: master.lateralityRule,
          },
        ];
      })
      .filter(Boolean);

    const sorted = suggestions.sort((a, b) => {
      const aIdx = CATEGORY_ORDER.indexOf(
        a!.category as (typeof CATEGORY_ORDER)[number],
      );
      const bIdx = CATEGORY_ORDER.indexOf(
        b!.category as (typeof CATEGORY_ORDER)[number],
      );
      if (aIdx !== bIdx) return aIdx - bIdx;
      return (a!.sortOrder ?? 0) - (b!.sortOrder ?? 0);
    });

    return NextResponse.json({ suggestions: sorted.slice(0, 12) });
  } catch (error) {
    return NextResponse.json(
      { error: getSafeErrorMessage(error) },
      { status: 500 },
    );
  }
}
