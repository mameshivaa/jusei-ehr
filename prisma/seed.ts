import { PrismaClient } from "@prisma/client";
import { JUDO_INJURY_MASTER } from "../src/lib/judo-injury-master-data";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 シードデータを作成中...");

  const existingJudoMaster = await prisma.judoInjuryMaster.findFirst({
    select: { id: true },
  });
  if (!existingJudoMaster) {
    await prisma.judoInjuryMaster.createMany({
      data: JUDO_INJURY_MASTER,
    });
  }

  // 既にセットアップ済みかチェック
  const existingClinic = await prisma.clinic.findFirst();
  if (existingClinic) {
    console.log(
      "⚠️  既にセットアップが完了しています。シードデータは作成されません。",
    );
    return;
  }

  // 既にユーザーが存在するかチェック
  const existingUser = await prisma.user.findFirst();
  if (existingUser) {
    console.log("⚠️  既にユーザーが存在します。シードデータは作成されません。");
    return;
  }

  // デフォルト管理者ユーザーはここでは作成しない
  // 実際の使用時は初回セットアップ/ログイン時に作成してください
  console.log("⚠️  管理者ユーザーはシードで作成しません。");
  console.log(
    "   実際の使用時は初回セットアップ/ログイン時に作成してください。",
  );
}

main()
  .catch((e) => {
    console.error("❌ シードエラー:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
