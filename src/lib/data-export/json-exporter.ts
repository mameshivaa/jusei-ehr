/**
 * JSON形式エクスポート機能
 * ガイドライン「システム設計の見直し（標準化対応）」遵守事項①に対応
 * 標準形式が存在する項目は標準形式で、標準形式が存在しない項目は変換が容易なデータ形式で出力
 */

import { prisma } from "@/lib/prisma";
import { PersonalInfoEncryption } from "@/lib/security/encryption";
import { createExportMetadata, ExportMetadata } from "./metadata";
import { decryptInsuranceFields } from "@/lib/charts/insurance";

export interface ExportOptions {
  includePatients?: boolean;
  includeVisits?: boolean;
  includeTreatmentRecords?: boolean;
  includeUsers?: boolean;
  includeAuditLogs?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  minimal?: boolean; // 最小限フィールドのみ（PIIを除外）
  purpose?: string; // エクスポート目的（監査用）
}

export interface JsonExportData {
  metadata: ExportMetadata;
  data: {
    patients?: any[];
    visits?: any[];
    treatmentRecords?: any[];
    users?: any[];
    auditLogs?: any[];
  };
}

/**
 * JSON形式でデータをエクスポート
 */
export async function exportToJson(
  exportedBy: string,
  options: ExportOptions = {},
): Promise<JsonExportData> {
  const {
    includePatients = true,
    includeVisits = true,
    includeTreatmentRecords = true,
    includeUsers = false,
    includeAuditLogs = false,
    dateRange,
  } = options;

  const data: JsonExportData["data"] = {};
  const recordCounts: Record<string, number> = {};

  // 患者データのエクスポート
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

    // 患者データを復号化（暗号化されている場合）
    const minimal = options.minimal ?? true; // デフォルトは最小限フィールドのみ
    const decryptedPatients = patients.map((patient) => {
      const base = {
        id: patient.id,
        name: patient.name,
        kana: patient.kana,
        birthDate: patient.birthDate,
        gender: patient.gender,
        patientNumber: patient.patientNumber,
        memo: patient.memo,
        createdAt: patient.createdAt,
        updatedAt: patient.updatedAt,
      };

      // PIIフィールドは最小限モードでは除外
      if (!minimal) {
        try {
          const latestChart = patient.charts[0];
          const insurance = latestChart
            ? decryptInsuranceFields(latestChart)
            : null;
          return {
            ...base,
            phone: patient.phone
              ? PersonalInfoEncryption.decrypt(patient.phone)
              : null,
            email: patient.email
              ? PersonalInfoEncryption.decrypt(patient.email)
              : null,
            address: patient.address
              ? PersonalInfoEncryption.decrypt(patient.address)
              : null,
            insuranceNumber: insurance?.insuranceNumber ?? null,
          };
        } catch {
          // 復号化に失敗した場合は既に平文の可能性がある（移行前のデータ）
          const latestChart = patient.charts[0];
          const insurance = latestChart
            ? decryptInsuranceFields(latestChart)
            : null;
          return {
            ...base,
            phone: patient.phone,
            email: patient.email,
            address: patient.address,
            insuranceNumber: insurance?.insuranceNumber ?? null,
          };
        }
      }

      return base;
    });

    data.patients = decryptedPatients;
    recordCounts.patients = decryptedPatients.length;
  }

  // 来院記録のエクスポート
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

    data.visits = visits;
    recordCounts.visits = visits.length;
  }

  // 施術記録のエクスポート
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
            id: true,
            name: true,
            email: true,
          },
        },
        confirmedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    data.treatmentRecords = treatmentRecords;
    recordCounts.treatmentRecords = treatmentRecords.length;
  }

  // ユーザーデータのエクスポート（オプション）
  if (includeUsers) {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    data.users = users;
    recordCounts.users = users.length;
  }

  // 監査ログのエクスポート（オプション）
  if (includeAuditLogs) {
    const auditLogs = await prisma.auditLog.findMany({
      where: dateRange
        ? {
            createdAt: {
              gte: dateRange.start,
              lte: dateRange.end,
            },
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 10000, // パフォーマンスのため制限
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    data.auditLogs = auditLogs;
    recordCounts.auditLogs = auditLogs.length;
  }

  // メタデータの生成
  const dataTypes = Object.keys(data).filter(
    (key) => data[key as keyof typeof data] !== undefined,
  );
  const metadata = createExportMetadata(exportedBy, dataTypes, recordCounts);

  return {
    metadata,
    data,
  };
}
