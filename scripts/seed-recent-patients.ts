import { prisma } from "@/lib/prisma";
import { ChartStatus } from "@prisma/client";

type NameSet = {
  kanji: string;
  kana: string;
};

const lastNames: NameSet[] = [
  { kanji: "佐藤", kana: "サトウ" },
  { kanji: "鈴木", kana: "スズキ" },
  { kanji: "高橋", kana: "タカハシ" },
  { kanji: "田中", kana: "タナカ" },
  { kanji: "伊藤", kana: "イトウ" },
  { kanji: "渡辺", kana: "ワタナベ" },
  { kanji: "山本", kana: "ヤマモト" },
  { kanji: "中村", kana: "ナカムラ" },
  { kanji: "小林", kana: "コバヤシ" },
  { kanji: "加藤", kana: "カトウ" },
  { kanji: "吉田", kana: "ヨシダ" },
  { kanji: "山田", kana: "ヤマダ" },
];

const firstNames: NameSet[] = [
  { kanji: "太郎", kana: "タロウ" },
  { kanji: "花子", kana: "ハナコ" },
  { kanji: "健", kana: "ケン" },
  { kanji: "美咲", kana: "ミサキ" },
  { kanji: "翔", kana: "ショウ" },
  { kanji: "愛", kana: "アイ" },
  { kanji: "大輔", kana: "ダイスケ" },
  { kanji: "結衣", kana: "ユイ" },
  { kanji: "悠真", kana: "ユウマ" },
  { kanji: "彩", kana: "アヤ" },
  { kanji: "颯太", kana: "ソウタ" },
  { kanji: "結菜", kana: "ユナ" },
];

const genders = ["男性", "女性", "その他", "未回答"] as const;

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const pick = <T>(items: T[]) => items[randomInt(0, items.length - 1)];

const toDateWithinDays = (days: number) => {
  const offset = randomInt(0, days);
  const date = new Date();
  date.setDate(date.getDate() - offset);
  date.setHours(randomInt(9, 18), randomInt(0, 59), 0, 0);
  return date;
};

const randomBirthDate = () => {
  const age = randomInt(18, 80);
  const year = new Date().getFullYear() - age;
  const month = randomInt(0, 11);
  const day = randomInt(1, 28);
  return new Date(year, month, day);
};

async function main() {
  const prefix = "DEMO-RECENT-";

  // 既存のデモデータだけ削除して重複を防ぐ
  await prisma.patient.deleteMany({
    where: {
      patientNumber: { startsWith: prefix },
    },
  });

  const patientsToCreate = 20;

  for (let i = 0; i < patientsToCreate; i += 1) {
    const last = pick(lastNames);
    const first = pick(firstNames);
    const patientNumber = `${prefix}${String(i + 1).padStart(3, "0")}`;
    const birthDate = randomBirthDate();
    const gender = pick([...genders]);

    const visitCount = randomInt(1, 3);
    const visits = Array.from({ length: visitCount }, () =>
      toDateWithinDays(30),
    ).sort((a, b) => a.getTime() - b.getTime());

    const firstVisit = visits[0];
    const lastVisit = visits[visits.length - 1];

    const patient = await prisma.patient.create({
      data: {
        lastName: last.kanji,
        firstName: first.kanji,
        lastKana: last.kana,
        firstKana: first.kana,
        name: `${last.kanji}${first.kanji}`,
        kana: `${last.kana}${first.kana}`,
        patientNumber,
        birthDate,
        gender,
      },
    });

    const chart = await prisma.chart.create({
      data: {
        patientId: patient.id,
        status: ChartStatus.IN_TREATMENT,
        insuranceType: "標準カルテ",
        firstVisitDate: firstVisit,
        lastVisitDate: lastVisit,
      },
    });

    await prisma.visit.createMany({
      data: visits.map((visitDate) => ({
        patientId: patient.id,
        chartId: chart.id,
        visitDate,
      })),
    });

    await prisma.patient.update({
      where: { id: patient.id },
      data: { updatedAt: lastVisit },
    });
  }

  console.log("Seeded recent patients:", patientsToCreate);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
