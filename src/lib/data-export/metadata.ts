/**
 * エクスポートデータのメタデータ管理
 * ガイドライン「システム設計の見直し（標準化対応）」遵守事項④に対応
 * 電子媒体保存情報と見読化手段の対応付け管理
 */

import { createVersionInfo, VersionInfo } from "./version";

/**
 * 見読化手段の要件
 */
export interface ReadabilityRequirements {
  software: string[];
  versions: Record<string, string>;
  dependencies: string[];
  additionalInfo?: string;
}

/**
 * エクスポートデータのメタデータ
 */
export interface ExportMetadata {
  version: VersionInfo;
  readability: ReadabilityRequirements;
  dataTypes: string[];
  recordCounts: Record<string, number>;
  exportedAt: string;
  exportedBy: string;
}

/**
 * 見読化手段の要件を取得
 */
export function getReadabilityRequirements(): ReadabilityRequirements {
  return {
    software: [
      "Next.js",
      "Node.js",
      "SQLite",
      "Prisma",
      "モダンブラウザ（Chrome、Firefox、Safari、Edge）",
    ],
    versions: {
      "Next.js": "14.2.30",
      "Node.js": "^20.0.0",
      SQLite: "3.0.0",
      Prisma: "6.11.0",
    },
    dependencies: ["React 18.3.1", "TypeScript 5.6.3", "date-fns 3.6.0"],
    additionalInfo:
      "データベースファイル（SQLite）とエクスポートファイル（JSON/CSV/XML/SQL）を読み込むには、上記のソフトウェアが必要です。",
  };
}

/**
 * エクスポートメタデータを生成
 */
export function createExportMetadata(
  exportedBy: string,
  dataTypes: string[],
  recordCounts: Record<string, number>,
): ExportMetadata {
  return {
    version: createVersionInfo(exportedBy),
    readability: getReadabilityRequirements(),
    dataTypes,
    recordCounts,
    exportedAt: new Date().toISOString(),
    exportedBy,
  };
}
