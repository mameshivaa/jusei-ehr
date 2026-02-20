/**
 * JSON形式インポート機能
 * ガイドライン「システム設計の見直し（標準化対応）」遵守事項①に対応
 */

import { prisma } from "@/lib/prisma";
import { PersonalInfoEncryption } from "@/lib/security/encryption";
import { z } from "zod";
import { isVersionCompatible } from "../data-export/version";
import { ACTIVE_CHART_STATUS } from "../charts/status";

const PatientSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  kana: z.string(),
  birthDate: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  patientNumber: z.string().nullable().optional(),
  memo: z.string().nullable().optional(),
});

const VisitSchema = z.object({
  id: z.string().optional(),
  patientId: z.string(),
  visitDate: z.string(),
});

const TreatmentRecordSchema = z.object({
  id: z.string().optional(),
  visitId: z.string(),
  subjective: z.string().nullable().optional(),
  objective: z.string().nullable().optional(),
  assessment: z.string().nullable().optional(),
  plan: z.string().nullable().optional(),
  narrative: z.string().nullable().optional(),
});

const JsonImportSchema = z.object({
  metadata: z.object({
    version: z.object({
      dataFormatVersion: z.string(),
      schemaVersion: z.string(),
      appVersion: z.string().optional(),
      exportedAt: z.string(),
      exportedBy: z.string(),
    }),
  }),
  data: z.object({
    patients: z.array(PatientSchema).optional(),
    visits: z.array(VisitSchema).optional(),
    treatmentRecords: z.array(TreatmentRecordSchema).optional(),
  }),
});

export interface ImportResult {
  success: boolean;
  imported: {
    patients: number;
    visits: number;
    treatmentRecords: number;
  };
  errors: string[];
}

/**
 * JSON形式でデータをインポート
 */
export async function importFromJson(
  jsonData: unknown,
  importedBy: string,
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: {
      patients: 0,
      visits: 0,
      treatmentRecords: 0,
    },
    errors: [],
  };

  try {
    // バリデーション
    const validated = JsonImportSchema.parse(jsonData);

    // バージョン互換性チェック
    if (
      !isVersionCompatible(
        validated.metadata.version.dataFormatVersion,
        "1.0.0",
      )
    ) {
      result.errors.push(
        `データ形式のバージョンが互換性がありません: ${validated.metadata.version.dataFormatVersion}`,
      );
      result.success = false;
      return result;
    }

    // トランザクションでインポート
    await prisma.$transaction(async (tx) => {
      // 患者データのインポート
      if (validated.data.patients) {
        for (const patientData of validated.data.patients) {
          try {
            // 個人情報はそのまま保存（暗号化フィールドはスキーマに存在しないため）
            // 将来的に暗号化が必要な場合は、スキーマを更新してから実装

            // 患者IDの重複チェック
            if (patientData.patientNumber) {
              const existing = await tx.patient.findUnique({
                where: { patientNumber: patientData.patientNumber },
              });
              if (existing) {
                result.errors.push(
                  `患者IDが重複しています: ${patientData.patientNumber}`,
                );
                continue;
              }
            }

            // 個人情報フィールドを暗号化
            const encryptedPII = {
              phone: patientData.phone
                ? PersonalInfoEncryption.encrypt(patientData.phone)
                : null,
              email: patientData.email
                ? PersonalInfoEncryption.encrypt(patientData.email)
                : null,
              address: patientData.address
                ? PersonalInfoEncryption.encrypt(patientData.address)
                : null,
            };

            await tx.patient.create({
              data: {
                name: patientData.name,
                kana: patientData.kana,
                birthDate: patientData.birthDate
                  ? new Date(patientData.birthDate)
                  : null,
                gender: patientData.gender || null,
                patientNumber: patientData.patientNumber || null,
                memo: patientData.memo || null,
                phone: encryptedPII.phone,
                email: encryptedPII.email,
                address: encryptedPII.address,
              },
            });

            result.imported.patients++;
          } catch (error) {
            result.errors.push(
              `患者データのインポートエラー: ${error instanceof Error ? error.message : "不明なエラー"}`,
            );
          }
        }
      }

      // 来院記録のインポート
      if (validated.data.visits) {
        for (const visitData of validated.data.visits) {
          try {
            // 患者が存在するか確認
            const patient = await tx.patient.findFirst({
              where: {
                OR: [
                  { id: visitData.patientId },
                  { patientNumber: visitData.patientId },
                ],
              },
            });

            if (!patient) {
              result.errors.push(
                `患者が見つかりません: ${visitData.patientId}`,
              );
              continue;
            }

            const chart =
              (await tx.chart.findFirst({
                where: { patientId: patient.id },
                orderBy: { createdAt: "asc" },
              })) ||
              (await tx.chart.create({
                data: {
                  patientId: patient.id,
                  status: ACTIVE_CHART_STATUS,
                },
              }));

            await tx.visit.create({
              data: {
                patientId: patient.id,
                chartId: chart.id,
                visitDate: new Date(visitData.visitDate),
              },
            });

            result.imported.visits++;
          } catch (error) {
            result.errors.push(
              `来院記録のインポートエラー: ${error instanceof Error ? error.message : "不明なエラー"}`,
            );
          }
        }
      }

      // 施術記録のインポート
      if (validated.data.treatmentRecords) {
        for (const recordData of validated.data.treatmentRecords) {
          try {
            // 来院記録が存在するか確認
            const visit = await tx.visit.findFirst({
              where: {
                OR: [{ id: recordData.visitId }],
              },
            });

            if (!visit) {
              result.errors.push(
                `来院記録が見つかりません: ${recordData.visitId}`,
              );
              continue;
            }

            const narrativeParts: string[] = [];
            if (recordData.subjective) {
              narrativeParts.push(`S: ${recordData.subjective}`);
            }
            if (recordData.objective) {
              narrativeParts.push(`O: ${recordData.objective}`);
            }
            if (recordData.assessment) {
              narrativeParts.push(`A: ${recordData.assessment}`);
            }
            if (recordData.plan) {
              narrativeParts.push(`P: ${recordData.plan}`);
            }
            if (recordData.narrative) {
              narrativeParts.push(recordData.narrative);
            }

            const narrative =
              narrativeParts.length > 0 ? narrativeParts.join("\n") : null;

            await tx.treatmentRecord.create({
              data: {
                visitId: visit.id,
                narrative,
                updatedBy: importedBy,
              },
            });

            result.imported.treatmentRecords++;
          } catch (error) {
            result.errors.push(
              `施術記録のインポートエラー: ${error instanceof Error ? error.message : "不明なエラー"}`,
            );
          }
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
      `インポートエラー: ${error instanceof Error ? error.message : "不明なエラー"}`,
    );
    return result;
  }
}
