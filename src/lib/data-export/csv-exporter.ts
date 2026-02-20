/**
 * CSV形式エクスポート機能
 * ガイドライン「システム設計の見直し（標準化対応）」遵守事項①に対応
 * 標準形式が存在する項目は標準形式で、標準形式が存在しない項目は変換が容易なデータ形式で出力
 */

import { prisma } from "@/lib/prisma";
import { PersonalInfoEncryption } from "@/lib/security/encryption";
import { createExportMetadata, ExportMetadata } from "./metadata";
import { decryptInsuranceFields } from "@/lib/charts/insurance";

export interface CsvExportOptions {
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

export interface CsvExportResult {
  metadata: ExportMetadata;
  files: {
    filename: string;
    content: string;
  }[];
}

/**
 * CSV形式でデータをエクスポート
 */
export async function exportToCsv(
  exportedBy: string,
  options: CsvExportOptions = {},
): Promise<CsvExportResult> {
  const {
    includePatients = true,
    includeVisits = true,
    includeTreatmentRecords = true,
    dateRange,
    minimal = true, // デフォルトは最小限フィールドのみ
  } = options;

  const files: CsvExportResult["files"] = [];
  const recordCounts: Record<string, number> = {};

  // 患者データのCSVエクスポート
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
      include: {
        charts: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    // CSVヘッダー（最小限モードではPIIフィールドを除外）
    const headers = minimal
      ? [
          "ID",
          "氏名",
          "フリガナ",
          "生年月日",
          "性別",
          "患者ID",
          "メモ",
          "作成日時",
          "更新日時",
        ]
      : [
          "ID",
          "氏名",
          "フリガナ",
          "生年月日",
          "性別",
          "電話番号",
          "メールアドレス",
          "住所",
          "患者ID",
          "保険証番号（最新カルテ）",
          "メモ",
          "作成日時",
          "更新日時",
        ];

    // CSVデータ行
    const rows = patients.map((patient) => {
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

      const baseFields = [
        patient.id,
        patient.name,
        patient.kana,
        patient.birthDate ? patient.birthDate.toISOString() : "",
        patient.gender || "",
      ];

      const piiFields = minimal
        ? []
        : [phone || "", email || "", address || ""];

      const restFields = [
        patient.patientNumber || "",
        ...(minimal ? [] : [insuranceNumber || ""]),
        patient.memo || "",
        patient.createdAt.toISOString(),
        patient.updatedAt.toISOString(),
      ];

      return [...baseFields, ...piiFields, ...restFields].map((field) => {
        // CSVエスケープ（カンマ、ダブルクォート、改行を含む場合）
        const str = String(field || "");
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
    });

    // CSVコンテンツの生成
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    files.push({
      filename: "patients.csv",
      content: csvContent,
    });

    recordCounts.patients = patients.length;
  }

  // 来院記録のCSVエクスポート
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

    const headers = [
      "ID",
      "患者ID",
      "患者名",
      "患者フリガナ",
      "来院日時",
      "作成日時",
      "更新日時",
    ];
    const rows = visits.map((visit) =>
      [
        visit.id,
        visit.patientId,
        visit.patient.name,
        visit.patient.kana,
        visit.visitDate.toISOString(),
        visit.createdAt.toISOString(),
        visit.updatedAt.toISOString(),
      ].map((field) => {
        const str = String(field || "");
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }),
    );

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    files.push({
      filename: "visits.csv",
      content: csvContent,
    });

    recordCounts.visits = visits.length;
  }

  // 施術記録のCSVエクスポート
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

    const headers = [
      "ID",
      "来院ID",
      "患者ID",
      "患者名",
      "内容",
      "バージョン",
      "更新者",
      "確定済み",
      "確定者",
      "確定日時",
      "作成日時",
      "更新日時",
    ];

    const rows = treatmentRecords.map((record) =>
      [
        record.id,
        record.visitId,
        record.visit.patient.id,
        record.visit.patient.name,
        record.narrative || "",
        record.version.toString(),
        record.updatedByUser.name,
        record.isConfirmed ? "はい" : "いいえ",
        record.confirmedByUser?.name || "",
        record.confirmedAt ? record.confirmedAt.toISOString() : "",
        record.createdAt.toISOString(),
        record.updatedAt.toISOString(),
      ].map((field) => {
        const str = String(field || "");
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }),
    );

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    files.push({
      filename: "treatment_records.csv",
      content: csvContent,
    });

    recordCounts.treatmentRecords = treatmentRecords.length;
  }

  // メタデータの生成
  const dataTypes = files.map((f) => f.filename.replace(".csv", ""));
  const metadata = createExportMetadata(exportedBy, dataTypes, recordCounts);

  return {
    metadata,
    files,
  };
}
