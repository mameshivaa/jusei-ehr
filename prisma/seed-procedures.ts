import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * 施術マスタの初期データ
 *
 * コード命名規則: JX-{部位}-{施術種別}-{連番}
 * JX = Judo therapy (柔道整復)
 */
const INITIAL_PROCEDURES = [
  // 手技療法
  {
    code: "JX-MAN-001",
    name: "手技療法（基本）",
    category: "手技療法",
    defaultPrice: 780,
  },
  {
    code: "JX-MAN-002",
    name: "手技療法（長時間）",
    category: "手技療法",
    defaultPrice: 1170,
  },

  // 物理療法
  {
    code: "JX-PHY-ELE-001",
    name: "電気療法",
    category: "物理療法",
    defaultPrice: 300,
  },
  {
    code: "JX-PHY-HOT-001",
    name: "温熱療法",
    category: "物理療法",
    defaultPrice: 300,
  },
  {
    code: "JX-PHY-COL-001",
    name: "冷却療法",
    category: "物理療法",
    defaultPrice: 300,
  },
  {
    code: "JX-PHY-ULT-001",
    name: "超音波療法",
    category: "物理療法",
    defaultPrice: 400,
  },

  // 運動療法
  {
    code: "JX-EXE-001",
    name: "運動療法（基本）",
    category: "運動療法",
    defaultPrice: 500,
  },
  {
    code: "JX-EXE-002",
    name: "運動療法（複合）",
    category: "運動療法",
    defaultPrice: 750,
  },

  // 固定・包帯
  {
    code: "JX-FIX-BAN-001",
    name: "包帯固定",
    category: "固定",
    defaultPrice: 200,
  },
  {
    code: "JX-FIX-TAP-001",
    name: "テーピング固定",
    category: "固定",
    defaultPrice: 350,
  },
  {
    code: "JX-FIX-SPL-001",
    name: "副子固定",
    category: "固定",
    defaultPrice: 500,
  },

  // 初検・再検
  {
    code: "JX-INIT-001",
    name: "初検料",
    category: "初検・再検",
    defaultPrice: 1500,
  },
  {
    code: "JX-REXM-001",
    name: "再検料",
    category: "初検・再検",
    defaultPrice: 500,
  },

  // 往療
  {
    code: "JX-HOME-001",
    name: "往療料（基本）",
    category: "往療",
    defaultPrice: 2000,
  },
  {
    code: "JX-HOME-002",
    name: "往療料（遠距離）",
    category: "往療",
    defaultPrice: 3000,
  },
];

async function seedProcedures() {
  console.log("施術マスタの初期データを投入します...");

  for (const procedure of INITIAL_PROCEDURES) {
    const existing = await prisma.procedureMaster.findUnique({
      where: { code: procedure.code },
    });

    if (!existing) {
      await prisma.procedureMaster.create({
        data: procedure,
      });
      console.log(`  作成: ${procedure.code} - ${procedure.name}`);
    } else {
      console.log(`  スキップ（既存）: ${procedure.code}`);
    }
  }

  console.log("施術マスタの初期データ投入が完了しました。");
}

seedProcedures()
  .catch((e) => {
    console.error("シード実行エラー:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
