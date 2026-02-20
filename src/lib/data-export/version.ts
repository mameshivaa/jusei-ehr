/**
 * データ形式バージョン管理
 * ガイドライン「システム設計の見直し（標準化対応）」遵守事項③に対応
 */

export const DATA_FORMAT_VERSION = "1.0.0";

export const SCHEMA_VERSION = "1.0.0";

/**
 * エクスポートデータのメタデータに含めるバージョン情報
 */
export interface VersionInfo {
  dataFormatVersion: string;
  schemaVersion: string;
  appVersion: string;
  exportedAt: string;
  exportedBy: string;
}

/**
 * バージョン情報を生成
 */
export function createVersionInfo(exportedBy: string): VersionInfo {
  return {
    dataFormatVersion: DATA_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    appVersion: process.env.npm_package_version || "0.1.0",
    exportedAt: new Date().toISOString(),
    exportedBy,
  };
}

/**
 * バージョン互換性チェック
 */
export function isVersionCompatible(
  exportedVersion: string,
  currentVersion: string = DATA_FORMAT_VERSION,
): boolean {
  // メジャーバージョンが同じであれば互換性あり
  const exportedMajor = exportedVersion.split(".")[0];
  const currentMajor = currentVersion.split(".")[0];
  return exportedMajor === currentMajor;
}
