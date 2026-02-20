/**
 * CSV形式インポート機能
 * ガイドライン「システム設計の見直し（標準化対応）」遵守事項①に対応
 */

import { prisma } from "@/lib/prisma";
import { PersonalInfoEncryption } from "@/lib/security/encryption";

export interface CsvImportResult {
  success: boolean;
  imported: {
    patients: number;
    visits: number;
    treatmentRecords: number;
  };
  errors: string[];
}

/**
 * CSV行をパース
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // 次の文字をスキップ
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * CSV形式で患者データをインポート
 */
export async function importPatientsFromCsv(
  csvContent: string,
  importedBy: string,
): Promise<CsvImportResult> {
  const result: CsvImportResult = {
    success: true,
    imported: {
      patients: 0,
      visits: 0,
      treatmentRecords: 0,
    },
    errors: [],
  };

  try {
    const lines = csvContent.split("\n").filter((line) => line.trim());
    if (lines.length < 2) {
      result.success = false;
      result.errors.push("CSVファイルが空か、ヘッダーのみです");
      return result;
    }

    const headers = parseCsvLine(lines[0]);
    const expectedHeaders = [
      "ID",
      "氏名",
      "フリガナ",
      "生年月日",
      "性別",
      "電話番号",
      "メールアドレス",
      "住所",
      "患者ID",
      "保険証番号",
      "メモ",
      "作成日時",
      "更新日時",
    ];

    // ヘッダーの検証
    if (headers.length !== expectedHeaders.length) {
      result.success = false;
      result.errors.push(
        `ヘッダーの数が一致しません。期待: ${expectedHeaders.length}, 実際: ${headers.length}`,
      );
      return result;
    }

    await prisma.$transaction(async (tx) => {
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = parseCsvLine(lines[i]);
          if (values.length !== headers.length) {
            result.errors.push(`行 ${i + 1}: 列数が一致しません`);
            continue;
          }

          const [
            id,
            name,
            kana,
            birthDateStr,
            gender,
            phone,
            email,
            address,
            patientNumber,
            _insuranceNumber,
            memo,
            createdAtStr,
            updatedAtStr,
          ] = values;

          // 患者IDの重複チェック
          if (patientNumber && patientNumber.trim()) {
            const existing = await tx.patient.findUnique({
              where: { patientNumber: patientNumber.trim() },
            });
            if (existing) {
              result.errors.push(
                `行 ${i + 1}: 患者IDが重複しています: ${patientNumber}`,
              );
              continue;
            }
          }

          // 個人情報フィールドを暗号化
          const encryptedPII = {
            phone:
              phone && phone.trim()
                ? PersonalInfoEncryption.encrypt(phone.trim())
                : null,
            email:
              email && email.trim()
                ? PersonalInfoEncryption.encrypt(email.trim())
                : null,
            address:
              address && address.trim()
                ? PersonalInfoEncryption.encrypt(address.trim())
                : null,
          };

          await tx.patient.create({
            data: {
              name: name.trim(),
              kana: kana.trim(),
              birthDate:
                birthDateStr && birthDateStr.trim()
                  ? new Date(birthDateStr.trim())
                  : null,
              gender: gender && gender.trim() ? gender.trim() : null,
              patientNumber:
                patientNumber && patientNumber.trim()
                  ? patientNumber.trim()
                  : null,
              memo: memo && memo.trim() ? memo.trim() : null,
              phone: encryptedPII.phone,
              email: encryptedPII.email,
              address: encryptedPII.address,
            },
          });

          result.imported.patients++;
        } catch (error) {
          result.errors.push(
            `行 ${i + 1}: ${error instanceof Error ? error.message : "不明なエラー"}`,
          );
        }
      }
    });

    if (result.errors.length > 0) {
      result.success = false;
    }

    return result;
  } catch (error) {
    result.success = false;
    result.errors.push(
      `CSVインポートエラー: ${error instanceof Error ? error.message : "不明なエラー"}`,
    );
    return result;
  }
}
