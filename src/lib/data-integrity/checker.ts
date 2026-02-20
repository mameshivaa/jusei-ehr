/**
 * データ整合性チェック機能
 * ガイドライン「システム設計の見直し（標準化対応）」遵守事項②に対応
 * マスタデータベース変更時に、過去の診療録等の情報に対する内容の変更が起こらない機能
 */

import { prisma } from "@/lib/prisma";

export interface IntegrityCheckResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * データ整合性チェック
 */
export async function checkDataIntegrity(): Promise<IntegrityCheckResult> {
  const result: IntegrityCheckResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  try {
    // 来院記録に対応する患者が存在するか
    const allVisits = await prisma.visit.findMany({
      include: { patient: true },
    });
    const orphanVisits = allVisits.filter((visit) => !visit.patient);

    if (orphanVisits.length > 0) {
      result.isValid = false;
      result.errors.push(
        `来院記録に対応する患者が存在しません: ${orphanVisits.length}件`,
      );
    }

    // 施術記録に対応する来院記録が存在するか
    const allRecords = await prisma.treatmentRecord.findMany({
      include: { visit: true },
    });
    const orphanRecords = allRecords.filter((record) => !record.visit);

    if (orphanRecords.length > 0) {
      result.isValid = false;
      result.errors.push(
        `施術記録に対応する来院記録が存在しません: ${orphanRecords.length}件`,
      );
    }

    // 施術記録の更新者（User）が存在するか
    const allRecordsWithUser = await prisma.treatmentRecord.findMany({
      include: { updatedByUser: true },
    });
    const recordsWithInvalidUser = allRecordsWithUser.filter(
      (record) => !record.updatedByUser,
    );

    if (recordsWithInvalidUser.length > 0) {
      result.isValid = false;
      result.errors.push(
        `施術記録の更新者が存在しません: ${recordsWithInvalidUser.length}件`,
      );
    }

    // 確定済み記録の確定者（User）が存在するか
    const confirmedRecordsWithInvalidUser =
      await prisma.treatmentRecord.findMany({
        where: {
          isConfirmed: true,
          confirmedBy: { not: null },
          confirmedByUser: null,
        },
      });

    if (confirmedRecordsWithInvalidUser.length > 0) {
      result.warnings.push(
        `確定済み記録の確定者が存在しません: ${confirmedRecordsWithInvalidUser.length}件`,
      );
    }

    // データベースの整合性チェック（SQLite）
    try {
      const integrityCheck = await prisma.$queryRaw<
        Array<{ integrity_check: string }>
      >`
        PRAGMA integrity_check;
      `;

      if (
        integrityCheck.length > 0 &&
        integrityCheck[0].integrity_check !== "ok"
      ) {
        result.isValid = false;
        result.errors.push(
          `データベースの整合性チェックに失敗しました: ${integrityCheck[0].integrity_check}`,
        );
      }
    } catch (error) {
      result.warnings.push(
        `データベースの整合性チェックを実行できませんでした: ${error instanceof Error ? error.message : "不明なエラー"}`,
      );
    }

    return result;
  } catch (error) {
    result.isValid = false;
    result.errors.push(
      `整合性チェックエラー: ${error instanceof Error ? error.message : "不明なエラー"}`,
    );
    return result;
  }
}
