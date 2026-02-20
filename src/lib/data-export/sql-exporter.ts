/**
 * SQL形式エクスポート機能
 * ガイドライン「システム設計の見直し（標準化対応）」遵守事項①に対応
 * データベース移行向けのSQL形式エクスポート
 */

import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";
import { createExportMetadata, ExportMetadata } from "./metadata";

export interface SqlExportOptions {
  includeSchema?: boolean;
  includeData?: boolean;
  minimal?: boolean; // 最小限フィールドのみ（PIIを除外）
  purpose?: string; // エクスポート目的（監査用）
}

export interface SqlExportResult {
  metadata: ExportMetadata;
  content: string;
}

/**
 * SQLエスケープ
 */
function escapeSql(str: string): string {
  return str.replace(/'/g, "''");
}

/**
 * SQL形式でデータベースをエクスポート
 */
export async function exportToSql(
  exportedBy: string,
  options: SqlExportOptions = {},
): Promise<SqlExportResult> {
  const { includeSchema = true, includeData = true } = options;

  const sqlParts: string[] = [];
  const recordCounts: Record<string, number> = {};

  // SQLiteのダンプを取得
  const dbPath = process.env.DATABASE_URL?.replace(/^file:/, "");
  if (!dbPath) {
    throw new Error("DATABASE_URL is not set or not a file path");
  }

  // SQLiteの.dumpコマンドを実行（簡易版）
  // 実際の実装では、sqlite3コマンドを実行するか、Prismaの機能を使用
  sqlParts.push("-- 柔道整復施術所向け電子施術録 Database Export");
  sqlParts.push(`-- Exported at: ${new Date().toISOString()}`);
  sqlParts.push(`-- Exported by: ${exportedBy}`);
  sqlParts.push("");

  if (includeSchema) {
    sqlParts.push("-- Schema");
    sqlParts.push("BEGIN TRANSACTION;");
    sqlParts.push("");

    // テーブル作成文（簡易版、実際にはPrismaスキーマから生成）
    sqlParts.push("-- Patients table");
    sqlParts.push(
      `
CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kana TEXT NOT NULL,
  birthDate TEXT,
  gender TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  patientNumber TEXT UNIQUE,
  memo TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  isDeleted INTEGER DEFAULT 0,
  deletedAt TEXT,
  encryptedPhone TEXT,
  encryptedEmail TEXT,
  encryptedAddress TEXT
);
    `.trim(),
    );

    sqlParts.push("");
    sqlParts.push("-- Visits table");
    sqlParts.push(
      `
CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL,
  visitDate TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
);
    `.trim(),
    );

    sqlParts.push("");
    sqlParts.push("-- TreatmentRecords table");
    sqlParts.push(
      `
CREATE TABLE IF NOT EXISTS treatment_records (
  id TEXT PRIMARY KEY,
  visitId TEXT NOT NULL,
  narrative TEXT,
  version INTEGER DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  updatedBy TEXT NOT NULL,
  isDeleted INTEGER DEFAULT 0,
  deletedAt TEXT,
  isConfirmed INTEGER DEFAULT 0,
  confirmedBy TEXT,
  confirmedAt TEXT,
  digitalSignature TEXT,
  timestampHash TEXT,
  timestampSource TEXT,
  FOREIGN KEY (visitId) REFERENCES visits(id) ON DELETE CASCADE,
  FOREIGN KEY (updatedBy) REFERENCES users(id) ON DELETE RESTRICT
);
    `.trim(),
    );

    sqlParts.push("");
    sqlParts.push("COMMIT;");
    sqlParts.push("");
  }

  if (includeData) {
    sqlParts.push("-- Data");
    sqlParts.push("BEGIN TRANSACTION;");
    sqlParts.push("");

    // 患者データのエクスポート
    const patients = await prisma.patient.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: "desc" },
    });

    for (const patient of patients) {
      const values = [
        `'${escapeSql(patient.id)}'`,
        `'${escapeSql(patient.name)}'`,
        `'${escapeSql(patient.kana)}'`,
        patient.birthDate ? `'${patient.birthDate.toISOString()}'` : "NULL",
        patient.gender ? `'${escapeSql(patient.gender)}'` : "NULL",
        patient.phone ? `'${escapeSql(patient.phone)}'` : "NULL",
        patient.email ? `'${escapeSql(patient.email)}'` : "NULL",
        patient.address ? `'${escapeSql(patient.address)}'` : "NULL",
        patient.patientNumber
          ? `'${escapeSql(patient.patientNumber)}'`
          : "NULL",
        patient.memo ? `'${escapeSql(patient.memo)}'` : "NULL",
        `'${patient.createdAt.toISOString()}'`,
        `'${patient.updatedAt.toISOString()}'`,
        patient.isDeleted ? "1" : "0",
        patient.deletedAt ? `'${patient.deletedAt.toISOString()}'` : "NULL",
      ];

      sqlParts.push(
        `INSERT INTO patients (id, name, kana, birthDate, gender, phone, email, address, patientNumber, memo, createdAt, updatedAt, isDeleted, deletedAt) VALUES (${values.join(", ")});`,
      );
    }

    recordCounts.patients = patients.length;

    // 来院記録のエクスポート
    const visits = await prisma.visit.findMany({
      orderBy: { visitDate: "desc" },
    });

    for (const visit of visits) {
      const values = [
        `'${escapeSql(visit.id)}'`,
        `'${escapeSql(visit.patientId)}'`,
        `'${visit.visitDate.toISOString()}'`,
        `'${visit.createdAt.toISOString()}'`,
        `'${visit.updatedAt.toISOString()}'`,
      ];

      sqlParts.push(
        `INSERT INTO visits (id, patientId, visitDate, createdAt, updatedAt) VALUES (${values.join(", ")});`,
      );
    }

    recordCounts.visits = visits.length;

    // 施術記録のエクスポート
    const treatmentRecords = await prisma.treatmentRecord.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: "desc" },
    });

    for (const record of treatmentRecords) {
      const values = [
        `'${escapeSql(record.id)}'`,
        `'${escapeSql(record.visitId)}'`,
        record.narrative ? `'${escapeSql(record.narrative)}'` : "NULL",
        record.version.toString(),
        `'${record.createdAt.toISOString()}'`,
        `'${record.updatedAt.toISOString()}'`,
        `'${escapeSql(record.updatedBy)}'`,
        record.isDeleted ? "1" : "0",
        record.deletedAt ? `'${record.deletedAt.toISOString()}'` : "NULL",
        record.isConfirmed ? "1" : "0",
        record.confirmedBy ? `'${escapeSql(record.confirmedBy)}'` : "NULL",
        record.confirmedAt ? `'${record.confirmedAt.toISOString()}'` : "NULL",
        record.digitalSignature
          ? `'${escapeSql(record.digitalSignature)}'`
          : "NULL",
        record.timestampHash ? `'${escapeSql(record.timestampHash)}'` : "NULL",
        record.timestampSource
          ? `'${escapeSql(record.timestampSource)}'`
          : "NULL",
      ];

      sqlParts.push(
        `INSERT INTO treatment_records (id, visitId, narrative, version, createdAt, updatedAt, updatedBy, isDeleted, deletedAt, isConfirmed, confirmedBy, confirmedAt, digitalSignature, timestampHash, timestampSource) VALUES (${values.join(", ")});`,
      );
    }

    recordCounts.treatmentRecords = treatmentRecords.length;

    sqlParts.push("");
    sqlParts.push("COMMIT;");
  }

  // メタデータの生成
  const dataTypes = Object.keys(recordCounts);
  const metadata = createExportMetadata(exportedBy, dataTypes, recordCounts);

  // メタデータをSQLコメントとして追加
  sqlParts.unshift("-- Metadata:");
  sqlParts.unshift(
    `-- Data Format Version: ${metadata.version.dataFormatVersion}`,
  );
  sqlParts.unshift(`-- Schema Version: ${metadata.version.schemaVersion}`);
  sqlParts.unshift(`-- App Version: ${metadata.version.appVersion}`);
  sqlParts.unshift(`-- Exported At: ${metadata.exportedAt}`);
  sqlParts.unshift(`-- Exported By: ${metadata.exportedBy}`);
  sqlParts.unshift("-- Readability Requirements:");
  for (const software of metadata.readability.software) {
    sqlParts.unshift(`--   - ${software}`);
  }

  return {
    metadata,
    content: sqlParts.join("\n"),
  };
}
