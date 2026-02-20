/**
 * XML形式インポート機能
 * ガイドライン「システム設計の見直し（標準化対応）」遵守事項①に対応
 */

import { prisma } from "@/lib/prisma";
import { PersonalInfoEncryption } from "@/lib/security/encryption";
import { ACTIVE_CHART_STATUS } from "../charts/status";

export interface XmlImportResult {
  success: boolean;
  imported: {
    patients: number;
    visits: number;
    treatmentRecords: number;
  };
  errors: string[];
}

/**
 * XMLをパース（簡易版）
 * 本番環境では、xml2jsなどのライブラリを使用することを推奨
 */
function parseXml(xmlContent: string): any {
  // 簡易的なXMLパーサー（本番環境では適切なライブラリを使用）
  const result: any = {
    patients: [],
    visits: [],
    treatmentRecords: [],
  };

  // 患者データの抽出
  const patientMatches = xmlContent.matchAll(/<patient>([\s\S]*?)<\/patient>/g);
  for (const match of patientMatches) {
    const patientXml = match[1];
    const patient: any = {};

    const nameMatch = patientXml.match(/<name>(.*?)<\/name>/);
    if (nameMatch) patient.name = nameMatch[1];

    const kanaMatch = patientXml.match(/<kana>(.*?)<\/kana>/);
    if (kanaMatch) patient.kana = kanaMatch[1];

    const birthDateMatch = patientXml.match(/<birthDate>(.*?)<\/birthDate>/);
    if (birthDateMatch) patient.birthDate = birthDateMatch[1];

    const genderMatch = patientXml.match(/<gender>(.*?)<\/gender>/);
    if (genderMatch) patient.gender = genderMatch[1];

    const phoneMatch = patientXml.match(/<phone>(.*?)<\/phone>/);
    if (phoneMatch) patient.phone = phoneMatch[1];

    const emailMatch = patientXml.match(/<email>(.*?)<\/email>/);
    if (emailMatch) patient.email = emailMatch[1];

    const addressMatch = patientXml.match(/<address>(.*?)<\/address>/);
    if (addressMatch) patient.address = addressMatch[1];

    const patientNumberMatch = patientXml.match(
      /<patientNumber>(.*?)<\/patientNumber>/,
    );
    if (patientNumberMatch) patient.patientNumber = patientNumberMatch[1];

    const memoMatch = patientXml.match(/<memo>(.*?)<\/memo>/);
    if (memoMatch) patient.memo = memoMatch[1];

    result.patients.push(patient);
  }

  // 来院記録の抽出
  const visitMatches = xmlContent.matchAll(/<visit>([\s\S]*?)<\/visit>/g);
  for (const match of visitMatches) {
    const visitXml = match[1];
    const visit: any = {};

    const patientIdMatch = visitXml.match(/<patientId>(.*?)<\/patientId>/);
    if (patientIdMatch) visit.patientId = patientIdMatch[1];

    const visitDateMatch = visitXml.match(/<visitDate>(.*?)<\/visitDate>/);
    if (visitDateMatch) visit.visitDate = visitDateMatch[1];

    result.visits.push(visit);
  }

  // 施術記録の抽出
  const recordMatches = xmlContent.matchAll(
    /<treatmentRecord>([\s\S]*?)<\/treatmentRecord>/g,
  );
  for (const match of recordMatches) {
    const recordXml = match[1];
    const record: any = {};

    const visitIdMatch = recordXml.match(/<visitId>(.*?)<\/visitId>/);
    if (visitIdMatch) record.visitId = visitIdMatch[1];

    const subjectiveMatch = recordXml.match(/<subjective>(.*?)<\/subjective>/);
    if (subjectiveMatch) record.subjective = subjectiveMatch[1];

    const objectiveMatch = recordXml.match(/<objective>(.*?)<\/objective>/);
    if (objectiveMatch) record.objective = objectiveMatch[1];

    const assessmentMatch = recordXml.match(/<assessment>(.*?)<\/assessment>/);
    if (assessmentMatch) record.assessment = assessmentMatch[1];

    const planMatch = recordXml.match(/<plan>(.*?)<\/plan>/);
    if (planMatch) record.plan = planMatch[1];

    const narrativeMatch = recordXml.match(/<narrative>(.*?)<\/narrative>/);
    if (narrativeMatch) record.narrative = narrativeMatch[1];

    result.treatmentRecords.push(record);
  }

  return result;
}

/**
 * XML形式でデータをインポート
 */
export async function importFromXml(
  xmlContent: string,
  importedBy: string,
): Promise<XmlImportResult> {
  const result: XmlImportResult = {
    success: true,
    imported: {
      patients: 0,
      visits: 0,
      treatmentRecords: 0,
    },
    errors: [],
  };

  try {
    const parsed = parseXml(xmlContent);

    await prisma.$transaction(async (tx) => {
      // 患者データのインポート
      for (const patientData of parsed.patients) {
        try {
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

      // 来院記録のインポート
      for (const visitData of parsed.visits) {
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
            result.errors.push(`患者が見つかりません: ${visitData.patientId}`);
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

      // 施術記録のインポート
      for (const recordData of parsed.treatmentRecords) {
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
    });

    if (result.errors.length > 0) {
      result.success = false;
    }

    return result;
  } catch (error) {
    result.success = false;
    result.errors.push(
      `XMLインポートエラー: ${error instanceof Error ? error.message : "不明なエラー"}`,
    );
    return result;
  }
}
