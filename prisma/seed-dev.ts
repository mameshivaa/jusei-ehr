import {
  PrismaClient,
  InjuryOutcome,
  LegalCauseType,
  ChartStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

const ACTIVE_CHART_STATUS = "IN_TREATMENT" as ChartStatus;
const RANDOM_CHART_STATUSES = [
  "IN_TREATMENT",
  "HEALED",
  "DISCONTINUED",
] as ChartStatus[];

async function main() {
  console.log("🌱 開発用テストデータを作成中...");

  // クリニックがなければ作成
  let clinic = await prisma.clinic.findFirst();
  if (!clinic) {
    clinic = await prisma.clinic.create({
      data: {},
    });
    console.log("✅ クリニックを作成しました");
  }

  // 開発用ユーザーがなければ作成
  let devUser = await prisma.user.findFirst({
    where: { email: "dev@example.com" },
  });
  if (!devUser) {
    devUser = await prisma.user.create({
      data: {
        email: "dev@example.com",
        name: "開発ユーザー",
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    console.log("✅ 開発ユーザーを作成しました");
  }

  // 患者データ
  const patientsData = [
    {
      name: "山田 太郎",
      kana: "ヤマダ タロウ",
      patientNumber: "P001",
      gender: "男性",
      birthDate: new Date("1985-03-15"),
      phone: "090-1111-2222",
      address: "東京都新宿区新宿1-1-1",
    },
    {
      name: "佐藤 花子",
      kana: "サトウ ハナコ",
      patientNumber: "P002",
      gender: "女性",
      birthDate: new Date("1990-07-22"),
      phone: "090-3333-4444",
      address: "東京都渋谷区渋谷2-2-2",
    },
    {
      name: "鈴木 一郎",
      kana: "スズキ イチロウ",
      patientNumber: "P003",
      gender: "男性",
      birthDate: new Date("1978-11-08"),
      phone: "090-5555-6666",
      address: "東京都港区港3-3-3",
    },
    {
      name: "田中 美咲",
      kana: "タナカ ミサキ",
      patientNumber: "P004",
      gender: "女性",
      birthDate: new Date("1995-01-30"),
      phone: "090-7777-8888",
      address: "東京都品川区品川4-4-4",
    },
    {
      name: "高橋 健太",
      kana: "タカハシ ケンタ",
      patientNumber: "P005",
      gender: "男性",
      birthDate: new Date("1982-09-12"),
      phone: "090-9999-0000",
      address: "東京都目黒区目黒5-5-5",
    },
    {
      name: "伊藤 さくら",
      kana: "イトウ サクラ",
      patientNumber: "P006",
      gender: "女性",
      birthDate: new Date("2000-04-05"),
      phone: "080-1234-5678",
      address: "東京都世田谷区世田谷6-6-6",
    },
    {
      name: "渡辺 大輔",
      kana: "ワタナベ ダイスケ",
      patientNumber: "P007",
      gender: "男性",
      birthDate: new Date("1970-12-25"),
      phone: "080-8765-4321",
      address: "東京都杉並区杉並7-7-7",
    },
    {
      name: "小林 愛",
      kana: "コバヤシ アイ",
      patientNumber: "P008",
      gender: "女性",
      birthDate: new Date("1988-06-18"),
      phone: "070-1111-3333",
      address: "東京都中野区中野8-8-8",
    },
  ];

  for (const patientData of patientsData) {
    const existingPatient = await prisma.patient.findFirst({
      where: { patientNumber: patientData.patientNumber },
    });
    if (existingPatient) {
      console.log(`⏭️  患者 ${patientData.name} は既に存在します`);
      continue;
    }

    const patient = await prisma.patient.create({
      data: patientData,
    });
    console.log(`✅ 患者 ${patient.name} を作成しました`);

    // 各患者にカルテを作成
    const chartCount = Math.floor(Math.random() * 2) + 1; // 1-2件
    for (let c = 0; c < chartCount; c++) {
      const insuranceTypes = ["健康保険", "労災保険", "自賠責保険", "自費"];
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/88659fb4-5b95-4f23-96d3-eef325768374",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "debug-session",
            runId: "pre-fix",
            hypothesisId: "H1",
            location: "prisma/seed-dev.ts:chart-status-selection",
            message: "Chart status candidates before create",
            data: {
              cIndex: c,
              chartCount,
              enumValues: Object.values(ChartStatus),
            },
            timestamp: Date.now(),
          }),
        },
      ).catch(() => {});
      // #endregion
      const chart = await prisma.chart.create({
        data: {
          patientId: patient.id,
          status:
            c === 0
              ? ACTIVE_CHART_STATUS
              : RANDOM_CHART_STATUSES[
                  Math.floor(Math.random() * RANDOM_CHART_STATUSES.length)
                ],
          insuranceType:
            insuranceTypes[Math.floor(Math.random() * insuranceTypes.length)],
          firstVisitDate: new Date(
            Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000,
          ), // 過去180日以内
        },
      });
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/88659fb4-5b95-4f23-96d3-eef325768374",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "debug-session",
            runId: "pre-fix",
            hypothesisId: "H2",
            location: "prisma/seed-dev.ts:chart-created",
            message: "Chart created status snapshot",
            data: {
              cIndex: c,
              chartId: chart.id,
              status: chart.status,
            },
            timestamp: Date.now(),
          }),
        },
      ).catch(() => {});
      // #endregion

      // 各カルテに負傷エピソードを作成
      const injuryCount = Math.floor(Math.random() * 3) + 1; // 1-3件
      for (let i = 0; i < injuryCount; i++) {
        const injuryDate = new Date(
          Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000,
        );
        const firstVisitDate = new Date(
          injuryDate.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000,
        );

        const injuryNames = ["捻挫", "打撲", "骨折", "脱臼", "筋肉痛"];
        const isHealed = Math.random() > 0.6;
        const outcomes: InjuryOutcome[] = ["CURED", "IMPROVED", "UNCHANGED"];

        const injury = await prisma.injury.create({
          data: {
            patientId: patient.id,
            chartId: chart.id,
            injuryDate,
            memo: [
              "階段で転倒",
              "スポーツ中の接触",
              "重い荷物を持ち上げた際",
              "自転車での転倒",
              "歩行中につまずいた",
            ][Math.floor(Math.random() * 5)],
            injuryName:
              injuryNames[Math.floor(Math.random() * injuryNames.length)],
            firstVisitDate,
            endDate: isHealed
              ? new Date(
                  firstVisitDate.getTime() +
                    Math.random() * 60 * 24 * 60 * 60 * 1000,
                )
              : null,
            outcome: isHealed
              ? outcomes[Math.floor(Math.random() * outcomes.length)]
              : null,
            outcomeDate: isHealed ? new Date() : null,
            legalCauseType: ["NORMAL", "WORK_ACCIDENT", "TRAFFIC"][
              Math.floor(Math.random() * 3)
            ] as LegalCauseType,
            requiresConsent: false,
            consentDoctor: null,
            consentDate: null,
          },
        });

        // 各負傷に来院と施術記録を作成
        const visitCount = Math.floor(Math.random() * 5) + 1; // 1-5回
        for (let v = 0; v < visitCount; v++) {
          const visitDate = new Date(
            firstVisitDate.getTime() + v * 7 * 24 * 60 * 60 * 1000,
          );
          if (visitDate > new Date()) break;

          const visit = await prisma.visit.create({
            data: {
              patientId: patient.id,
              chartId: chart.id,
              visitDate,
            },
          });

          // 施術記録
          const subjective = [
            "痛みが続いている",
            "少し楽になった",
            "しびれがある",
            "動かしにくい",
          ][Math.floor(Math.random() * 4)];
          const objective = [
            "腫脹あり",
            "圧痛(+)",
            "可動域制限あり",
            "熱感なし",
          ][Math.floor(Math.random() * 4)];
          const assessment = ["改善傾向", "経過観察", "要注意", "順調に回復中"][
            Math.floor(Math.random() * 4)
          ];
          const plan = [
            "マッサージ継続",
            "電気治療追加",
            "安静指示",
            "ストレッチ指導",
          ][Math.floor(Math.random() * 4)];

          await prisma.treatmentRecord.create({
            data: {
              visitId: visit.id,
              injuryId: injury.id,
              narrative: [
                `S: ${subjective}`,
                `O: ${objective}`,
                `A: ${assessment}`,
                `P: ${plan}`,
              ].join("\n"),
              isConfirmed: v < visitCount - 1, // 最後の来院以外は確定済み
              updatedBy: devUser.id,
            },
          });
        }
      }
    }
  }

  // 本日の受付データを追加（記載待ち用）
  const todayPatients = await prisma.patient.findMany({ take: 3 });
  for (const patient of todayPatients) {
    const chart = await prisma.chart.findFirst({
      where: { patientId: patient.id },
    });
    if (!chart) continue;

    // 既に今日の来院があるかチェック
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existingVisit = await prisma.visit.findFirst({
      where: {
        patientId: patient.id,
        visitDate: { gte: today },
      },
    });
    if (existingVisit) continue;

    await prisma.visit.create({
      data: {
        patientId: patient.id,
        chartId: chart.id,
        visitDate: new Date(),
      },
    });
    console.log(`✅ ${patient.name} の本日来院を作成しました`);
  }

  console.log("🎉 テストデータの作成が完了しました！");
}

main()
  .catch((e) => {
    console.error("❌ シードエラー:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
