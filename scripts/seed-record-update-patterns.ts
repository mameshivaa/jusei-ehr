/**
 * 小林 愛（P008）の施術録に複数パターンの更新履歴を作るスクリプト。
 * 実行: npx tsx scripts/seed-record-update-patterns.ts
 */
import { prisma } from "@/lib/prisma";
import { createTreatmentRecordHistory } from "@/lib/treatment-record-history";

type Pattern = {
  label: string;
  reason: string;
  apply: (current: string) => string;
};

const patterns: Pattern[] = [
  {
    label: "追記",
    reason: "追記",
    apply: (current) =>
      `${current}\n\n【追記】夜間痛の有無を再確認。自宅でのストレッチ継続を依頼。`,
  },
  {
    label: "一部書き換え",
    reason: "一部書き換え",
    apply: (current) => current.replace(/可動域/g, "可動域（自覚値）"),
  },
  {
    label: "末尾削除",
    reason: "末尾削除",
    apply: (current) => {
      const trimmed = current.trimEnd();
      const cut = trimmed.slice(0, Math.max(0, trimmed.length - 40));
      return cut.endsWith("…") ? cut : `${cut}…`;
    },
  },
  {
    label: "1行変更",
    reason: "1行変更",
    apply: (current) => {
      const lines = current.split("\n");
      if (lines.length === 0) return "痛みは軽度、日常動作で悪化。";
      lines[0] = `${lines[0]}（修正）`;
      return lines.join("\n");
    },
  },
  {
    label: "段落追加",
    reason: "段落追加",
    apply: (current) =>
      `${current}\n\n【評価】疼痛スケールは前回より改善。可動域は伸展で改善傾向。`,
  },
];

async function main() {
  const chartIdArgIndex = process.argv.findIndex((arg) =>
    arg.startsWith("--chart-id="),
  );
  const chartIdArg =
    chartIdArgIndex >= 0 ? process.argv[chartIdArgIndex].split("=")[1] : null;

  const patient = await prisma.patient.findFirst({
    where: {
      OR: [
        { name: "小林 愛" },
        { kana: "コバヤシ アイ" },
        { patientNumber: "P008" },
      ],
    },
    include: {
      charts: { take: 1 },
    },
  });

  if (!patient || patient.charts.length === 0) {
    console.log("小林 愛（P008）の患者/カルテが見つかりません。");
    process.exit(1);
  }

  const chartId = chartIdArg || patient.charts[0].id;

  const record = await prisma.treatmentRecord.findFirst({
    where: { visit: { chartId } },
    orderBy: { updatedAt: "desc" },
  });

  if (!record) {
    console.log("施術録が見つかりません。");
    process.exit(1);
  }

  const user =
    (await prisma.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    })) ||
    (await prisma.user.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }));

  if (!user) {
    console.log("更新者ユーザーが見つかりません。");
    process.exit(1);
  }

  let current = record.narrative || "（内容なし）";
  let version = record.version;

  console.log(`対象chartId: ${chartId}`);
  console.log(`対象recordId: ${record.id}`);
  console.log(`更新者: ${user.name || user.id}`);

  for (const pattern of patterns) {
    const next = pattern.apply(current);
    const nextVersion = version + 1;

    await createTreatmentRecordHistory(
      record.id,
      { narrative: current, injuryId: record.injuryId },
      { narrative: next, injuryId: record.injuryId },
      user.id,
      "UPDATE",
      nextVersion,
      pattern.reason,
    );

    await prisma.treatmentRecord.update({
      where: { id: record.id },
      data: {
        narrative: next,
        version: nextVersion,
        updatedBy: user.id,
      },
    });

    console.log(`- ${pattern.label} 完了 (v${nextVersion})`);
    current = next;
    version = nextVersion;
  }

  console.log("完了。プレビューで履歴を確認してください。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
