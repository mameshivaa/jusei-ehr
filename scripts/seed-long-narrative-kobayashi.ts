/**
 * 小林 愛（コバヤシ アイ）の施術録に長文データを入れるワンショットスクリプト。
 * 長文表示の確認用。npx tsx scripts/seed-long-narrative-kobayashi.ts で実行。
 */
import { prisma } from "@/lib/prisma";

const LONG_NARRATIVE = `来院時、右膝の腫脹と熱感が著明。階段の昇り降りで疼痛増強。
可動域は屈曲120度まで可能だが、伸展で5度の制限あり。
前十字靱帯のストレステストは陽性。内側側副靱帯は軽度の弛緩を認める。
MRI所見（別途）と合わせ、前十字靱帯部分損傷＋内側側副靱帯損傷の診断。
アイシング・圧迫・挙上を指導。荷重は痛みのない範囲で許可。
次回1週間後に再来院予定。激しい運動は2週間禁止。`;

async function main() {
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

  if (!patient) {
    console.log(
      "小林 愛（P008 / コバヤシ アイ）が見つかりません。seed-dev を先に実行してください。",
    );
    process.exit(1);
  }

  const chartId = patient.charts[0]?.id;
  if (!chartId) {
    console.log("小林 愛のカルテが見つかりません。");
    process.exit(1);
  }

  const record = await prisma.treatmentRecord.findFirst({
    where: { visit: { chartId } },
    orderBy: { updatedAt: "desc" },
  });

  if (!record) {
    console.log("小林 愛の施術録が1件もありません。");
    process.exit(1);
  }

  await prisma.treatmentRecord.update({
    where: { id: record.id },
    data: {
      narrative: LONG_NARRATIVE,
    },
  });

  console.log(
    "✅ 小林 愛の施術録に長文を入れました（recordId:",
    record.id,
    "）",
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
