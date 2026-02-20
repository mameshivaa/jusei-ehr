/**
 * XML形式エクスポート機能
 * ガイドライン「システム設計の見直し（標準化対応）」遵守事項①に対応
 * 標準形式が存在する項目は標準形式で、標準形式が存在しない項目は変換が容易なデータ形式で出力
 */

import { prisma } from "@/lib/prisma";
import { PersonalInfoEncryption } from "@/lib/security/encryption";
import { createExportMetadata, ExportMetadata } from "./metadata";
import { decryptInsuranceFields } from "@/lib/charts/insurance";

export interface XmlExportOptions {
  includePatients?: boolean;
  includeVisits?: boolean;
  includeTreatmentRecords?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  minimal?: boolean; // 最小限フィールドのみ（PIIを除外）
  purpose?: string; // エクスポート目的（監査用）
}

export interface XmlExportResult {
  metadata: ExportMetadata;
  content: string;
}

/**
 * XMLエスケープ
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * XML形式でデータをエクスポート
 */
export async function exportToXml(
  exportedBy: string,
  options: XmlExportOptions = {},
): Promise<XmlExportResult> {
  const {
    includePatients = true,
    includeVisits = true,
    includeTreatmentRecords = true,
    dateRange,
    minimal = true, // デフォルトは最小限フィールドのみ
  } = options;

  const recordCounts: Record<string, number> = {};
  const xmlParts: string[] = [];

  xmlParts.push('<?xml version="1.0" encoding="UTF-8"?>');
  xmlParts.push("<voss-export>");

  // 患者データのXMLエクスポート
  if (includePatients) {
    const patients = await prisma.patient.findMany({
      where: {
        isDeleted: false,
        ...(dateRange && {
          createdAt: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        }),
      },
      orderBy: { createdAt: "desc" },
      include: { charts: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    xmlParts.push("  <patients>");
    for (const patient of patients) {
      // PII復号化（最小限モードでは除外）
      let phone: string | null = null;
      let email: string | null = null;
      let address: string | null = null;
      let insuranceNumber: string | null = null;

      if (!minimal) {
        try {
          phone = patient.phone
            ? PersonalInfoEncryption.decrypt(patient.phone)
            : null;
          email = patient.email
            ? PersonalInfoEncryption.decrypt(patient.email)
            : null;
          address = patient.address
            ? PersonalInfoEncryption.decrypt(patient.address)
            : null;
          const latestChart = patient.charts[0];
          if (latestChart) {
            const insurance = decryptInsuranceFields(latestChart);
            insuranceNumber = insurance.insuranceNumber;
          }
        } catch {
          // 復号化に失敗した場合は既に平文の可能性がある（移行前のデータ）
          phone = patient.phone;
          email = patient.email;
          address = patient.address;
          const latestChart = patient.charts[0];
          if (latestChart) {
            const insurance = decryptInsuranceFields(latestChart);
            insuranceNumber = insurance.insuranceNumber;
          }
        }
      }

      xmlParts.push("    <patient>");
      xmlParts.push(`      <id>${escapeXml(patient.id)}</id>`);
      xmlParts.push(`      <name>${escapeXml(patient.name)}</name>`);
      xmlParts.push(`      <kana>${escapeXml(patient.kana)}</kana>`);
      if (patient.birthDate) {
        xmlParts.push(
          `      <birthDate>${patient.birthDate.toISOString()}</birthDate>`,
        );
      }
      if (patient.gender) {
        xmlParts.push(`      <gender>${escapeXml(patient.gender)}</gender>`);
      }
      if (!minimal) {
        if (phone) {
          xmlParts.push(`      <phone>${escapeXml(phone)}</phone>`);
        }
        if (email) {
          xmlParts.push(`      <email>${escapeXml(email)}</email>`);
        }
        if (address) {
          xmlParts.push(`      <address>${escapeXml(address)}</address>`);
        }
        if (insuranceNumber) {
          xmlParts.push(
            `      <insuranceNumber>${escapeXml(insuranceNumber)}</insuranceNumber>`,
          );
        }
      }
      if (patient.patientNumber) {
        xmlParts.push(
          `      <patientNumber>${escapeXml(patient.patientNumber)}</patientNumber>`,
        );
      }
      if (patient.memo) {
        xmlParts.push(`      <memo>${escapeXml(patient.memo)}</memo>`);
      }
      xmlParts.push(
        `      <createdAt>${patient.createdAt.toISOString()}</createdAt>`,
      );
      xmlParts.push(
        `      <updatedAt>${patient.updatedAt.toISOString()}</updatedAt>`,
      );
      xmlParts.push("    </patient>");
    }
    xmlParts.push("  </patients>");
    recordCounts.patients = patients.length;
  }

  // 来院記録のXMLエクスポート
  if (includeVisits) {
    const visits = await prisma.visit.findMany({
      where: dateRange
        ? {
            visitDate: {
              gte: dateRange.start,
              lte: dateRange.end,
            },
          }
        : undefined,
      orderBy: { visitDate: "desc" },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            kana: true,
          },
        },
      },
    });

    xmlParts.push("  <visits>");
    for (const visit of visits) {
      xmlParts.push("    <visit>");
      xmlParts.push(`      <id>${escapeXml(visit.id)}</id>`);
      xmlParts.push(
        `      <patientId>${escapeXml(visit.patientId)}</patientId>`,
      );
      xmlParts.push(
        `      <patientName>${escapeXml(visit.patient.name)}</patientName>`,
      );
      xmlParts.push(
        `      <patientKana>${escapeXml(visit.patient.kana)}</patientKana>`,
      );
      xmlParts.push(
        `      <visitDate>${visit.visitDate.toISOString()}</visitDate>`,
      );
      xmlParts.push(
        `      <createdAt>${visit.createdAt.toISOString()}</createdAt>`,
      );
      xmlParts.push(
        `      <updatedAt>${visit.updatedAt.toISOString()}</updatedAt>`,
      );
      xmlParts.push("    </visit>");
    }
    xmlParts.push("  </visits>");
    recordCounts.visits = visits.length;
  }

  // 施術記録のXMLエクスポート
  if (includeTreatmentRecords) {
    const treatmentRecords = await prisma.treatmentRecord.findMany({
      where: {
        isDeleted: false,
        ...(dateRange && {
          createdAt: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        visit: {
          include: {
            patient: {
              select: {
                id: true,
                name: true,
                kana: true,
              },
            },
          },
        },
        updatedByUser: {
          select: {
            name: true,
          },
        },
        confirmedByUser: {
          select: {
            name: true,
          },
        },
      },
    });

    xmlParts.push("  <treatmentRecords>");
    for (const record of treatmentRecords) {
      xmlParts.push("    <treatmentRecord>");
      xmlParts.push(`      <id>${escapeXml(record.id)}</id>`);
      xmlParts.push(`      <visitId>${escapeXml(record.visitId)}</visitId>`);
      xmlParts.push(
        `      <patientId>${escapeXml(record.visit.patient.id)}</patientId>`,
      );
      xmlParts.push(
        `      <patientName>${escapeXml(record.visit.patient.name)}</patientName>`,
      );
      if (record.narrative) {
        xmlParts.push(
          `      <narrative>${escapeXml(record.narrative)}</narrative>`,
        );
      }
      xmlParts.push(`      <version>${record.version}</version>`);
      xmlParts.push(
        `      <updatedBy>${escapeXml(record.updatedByUser.name)}</updatedBy>`,
      );
      xmlParts.push(`      <isConfirmed>${record.isConfirmed}</isConfirmed>`);
      if (record.confirmedByUser) {
        xmlParts.push(
          `      <confirmedBy>${escapeXml(record.confirmedByUser.name)}</confirmedBy>`,
        );
      }
      if (record.confirmedAt) {
        xmlParts.push(
          `      <confirmedAt>${record.confirmedAt.toISOString()}</confirmedAt>`,
        );
      }
      xmlParts.push(
        `      <createdAt>${record.createdAt.toISOString()}</createdAt>`,
      );
      xmlParts.push(
        `      <updatedAt>${record.updatedAt.toISOString()}</updatedAt>`,
      );
      xmlParts.push("    </treatmentRecord>");
    }
    xmlParts.push("  </treatmentRecords>");
    recordCounts.treatmentRecords = treatmentRecords.length;
  }

  xmlParts.push("</voss-export>");

  // メタデータの生成
  const dataTypes = Object.keys(recordCounts);
  const metadata = createExportMetadata(exportedBy, dataTypes, recordCounts);

  // メタデータをXMLに追加
  const metadataXml = [
    "  <metadata>",
    `    <version>${metadata.version.dataFormatVersion}</version>`,
    `    <schemaVersion>${metadata.version.schemaVersion}</schemaVersion>`,
    `    <appVersion>${metadata.version.appVersion}</appVersion>`,
    `    <exportedAt>${metadata.exportedAt}</exportedAt>`,
    `    <exportedBy>${escapeXml(metadata.exportedBy)}</exportedBy>`,
    "    <readability>",
    ...metadata.readability.software.map(
      (s) => `      <software>${escapeXml(s)}</software>`,
    ),
    "    </readability>",
    "    <recordCounts>",
    ...Object.entries(metadata.recordCounts).map(
      ([type, count]) => `      <${type}>${count}</${type}>`,
    ),
    "    </recordCounts>",
    "  </metadata>",
  ];

  // メタデータを先頭に挿入
  xmlParts.splice(1, 0, ...metadataXml);

  return {
    metadata,
    content: xmlParts.join("\n"),
  };
}
