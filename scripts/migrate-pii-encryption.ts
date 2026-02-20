/**
 * PII暗号化移行スクリプト (v-oss版)
 *
 * 既存の患者データの個人情報（PII）を平文から暗号化形式に移行する
 *
 * 使用方法:
 *   npx tsx scripts/migrate-pii-encryption.ts
 *
 * 注意:
 * - 本番環境で実行する前に、必ずデータベースのバックアップを取得してください
 * - 移行は不可逆です（平文データは削除されます）
 * - 移行中はアプリケーションを停止してください
 */

import { PrismaClient } from "@prisma/client";
import { PersonalInfoEncryption } from "../src/lib/security/encryption";

const prisma = new PrismaClient();

interface PatientPII {
  id: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

async function migratePatientPII() {
  console.log("PII暗号化移行を開始します...");
  console.log(
    "注意: 本番環境では必ずバックアップを取得してから実行してください。\n",
  );

  // 全患者を取得
  const patients = await prisma.patient.findMany({
    where: {
      isDeleted: false,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
    },
  });

  console.log(`対象患者数: ${patients.length}`);

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const patient of patients) {
    try {
      // 既に暗号化されているかチェック
      const needsEncryption = [
        patient.phone,
        patient.email,
        patient.address,
      ].some((value) => {
        if (!value) return false;
        // 暗号化されたデータは通常、特定の形式（iv.tag.ciphertext）を持つ
        return !value.includes(".") || value.split(".").length !== 3;
      });

      if (!needsEncryption) {
        skippedCount++;
        continue;
      }

      // PIIを暗号化
      const plainPII: PatientPII = {
        id: patient.id,
        phone: patient.phone,
        email: patient.email,
        address: patient.address,
      };

      const encryptedPII = {
        phone: plainPII.phone
          ? PersonalInfoEncryption.encrypt(plainPII.phone)
          : null,
        email: plainPII.email
          ? PersonalInfoEncryption.encrypt(plainPII.email)
          : null,
        address: plainPII.address
          ? PersonalInfoEncryption.encrypt(plainPII.address)
          : null,
      };

      // データベースを更新
      await prisma.patient.update({
        where: { id: patient.id },
        data: {
          phone: encryptedPII.phone,
          email: encryptedPII.email,
          address: encryptedPII.address,
        },
      });

      migratedCount++;
      if (migratedCount % 100 === 0) {
        console.log(
          `進捗: ${migratedCount}/${patients.length} 件を移行しました`,
        );
      }
    } catch (error) {
      errorCount++;
      console.error(
        `患者ID ${patient.id} (${patient.name}) の移行に失敗:`,
        error,
      );
    }
  }

  console.log("\n移行完了:");
  console.log(`  - 移行済み: ${migratedCount} 件`);
  console.log(`  - スキップ: ${skippedCount} 件（既に暗号化済み）`);
  console.log(`  - エラー: ${errorCount} 件`);
}

async function main() {
  try {
    await migratePatientPII();
  } catch (error) {
    console.error("移行中にエラーが発生しました:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 実行確認
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes("--dry-run")) {
    console.log("ドライランモード: 実際の更新は行いません");
    // TODO: ドライラン実装
  } else {
    console.log("本番モード: データベースを更新します");
    console.log(
      "続行するには Ctrl+C でキャンセルしてください（10秒後に自動開始）",
    );
    setTimeout(() => {
      main();
    }, 10000);
  }
}

export { migratePatientPII };
