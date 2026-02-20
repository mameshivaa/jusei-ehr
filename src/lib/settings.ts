import { prisma } from "@/lib/prisma";
import { getDefaultBackupDirectory } from "@/lib/backup/default-backup-dir";
import { createAuditLog } from "@/lib/audit";

/**
 * システム設定管理（ガイドライン準拠：設定の一元管理）
 *
 * 型安全性:
 * - SafeSettingKey: 公開可能な設定キー
 * - SecretSettingKey: 秘密情報キー（マスク必須）
 */

// =============================================================================
// 型定義（型安全な設定キー管理）
// =============================================================================

/**
 * 公開可能な設定キー（監査ダンプに平文で出力可能）
 */
export type SafeSettingKey =
  // 認証・ロックアウト設定
  | "maxFailedLogins"
  | "lockoutMinutes"
  | "sessionExpiryDays"
  // 安全管理責任者
  | "securityOfficerRole"
  | "securityOfficerName"
  // ガイドライン確認
  | "incidentContactConfirmed"
  | "backupPolicyConfirmed"
  | "bcpConfirmed"
  | "accessLogConfirmed"
  | "operationPolicyConfirmed"
  // MFA設定
  | "mfaEnabled"
  | "mfaRequired"
  | "mfaRateLimitAttempts"
  | "mfaRateLimitMinutes"
  // ログ設定
  | "auditLogRetentionDays"
  | "accessLogRetentionDays"
  // バックアップ設定
  | "backupDirectory"
  | "backupDirectorySource"
  | "backupRetentionCount"
  | "backupRetentionDays"
  | "customBackupMissingAt"
  | "externalBackupWeeklyConfirmedAt"
  | "externalBackupMissingAt"
  | "lastBackupAt"
  | "lastBackupSource"
  | "lastCustomBackupAt"
  | "lastExternalBackupAt"
  | "backupMissingAlertDays"
  // 文書設定
  | "unscanAlertHours"
  | "minDocumentDpi"
  | "maxDocumentSizeMb"
  // パスワードポリシー
  | "passwordMinLength"
  | "passwordRequireUppercase"
  | "passwordRequireLowercase"
  | "passwordRequireNumbers"
  | "passwordRequireSymbols"
  // PDFプレビュー設定
  | "pdfPreviewIncludeOutputTimestamp"
  | "pdfPreviewIncludePatientName"
  | "pdfPreviewIncludePatientId"
  | "pdfPreviewIncludeInsurance"
  | "pdfPreviewIncludeStatus"
  | "pdfPreviewIncludeFirstVisitDate"
  | "pdfPreviewIncludeRecordHeaderDate"
  | "pdfPreviewIncludeRecordHeaderMilestone"
  | "pdfPreviewIncludeRecordHeaderUpdatedAt"
  | "pdfPreviewIncludeRecordHeaderAuthor"
  | "pdfPreviewIncludeRecordContent"
  | "pdfPreviewIncludeRecordHistory"
  | "pdfPreviewIncludeRecordInjury"
  | "pdfPreviewIncludeRecordInjuryDate"
  | "pdfPreviewIncludeTreatmentDetails";

/**
 * 秘密情報キー（監査ダンプ時は必ずマスク）
 */
export type SecretSettingKey =
  | "encryptionKey"
  | "signingKey"
  | "backupSecret"
  | "apiKey"
  | "smtpPassword"
  | "webhookSecret"
  | "systemRecoveryCodeHash";

/**
 * 全ての設定キー
 */
export type SettingKey = SafeSettingKey | SecretSettingKey;

// =============================================================================
// 定数定義
// =============================================================================

// デフォルト値の定義（SafeSettingKeyのみ）
const DEFAULT_SAFE_SETTINGS: Record<SafeSettingKey, string> = {
  // 認証・ロックアウト設定
  maxFailedLogins: "5",
  lockoutMinutes: "30",
  sessionExpiryDays: "30",

  // 安全管理責任者
  securityOfficerRole: "",
  securityOfficerName: "",

  // ガイドライン確認
  incidentContactConfirmed: "false",
  backupPolicyConfirmed: "false",
  bcpConfirmed: "false",
  accessLogConfirmed: "false",
  operationPolicyConfirmed: "false",

  // MFA設定
  mfaEnabled: "true",
  mfaRequired: "false",
  mfaRateLimitAttempts: "5",
  mfaRateLimitMinutes: "15",

  // ログ設定
  auditLogRetentionDays: "365",
  accessLogRetentionDays: "365",

  // バックアップ設定
  backupDirectory: getDefaultBackupDirectory(),
  backupDirectorySource: "default",
  backupRetentionCount: "5",
  backupRetentionDays: "14",
  customBackupMissingAt: "",
  externalBackupWeeklyConfirmedAt: "",
  externalBackupMissingAt: "",
  lastBackupAt: "",
  lastBackupSource: "",
  lastCustomBackupAt: "",
  lastExternalBackupAt: "",
  backupMissingAlertDays: "3",

  // 文書設定
  unscanAlertHours: "168", // 7日 = 168時間
  minDocumentDpi: "200",
  maxDocumentSizeMb: "20",

  // セキュリティ設定
  passwordMinLength: "8",
  passwordRequireUppercase: "true",
  passwordRequireLowercase: "true",
  passwordRequireNumbers: "true",
  passwordRequireSymbols: "false",
  // PDFプレビュー設定
  pdfPreviewIncludeOutputTimestamp: "true",
  pdfPreviewIncludePatientName: "true",
  pdfPreviewIncludePatientId: "true",
  pdfPreviewIncludeInsurance: "true",
  pdfPreviewIncludeStatus: "true",
  pdfPreviewIncludeFirstVisitDate: "true",
  pdfPreviewIncludeRecordHeaderDate: "true",
  pdfPreviewIncludeRecordHeaderMilestone: "true",
  pdfPreviewIncludeRecordHeaderUpdatedAt: "true",
  pdfPreviewIncludeRecordHeaderAuthor: "true",
  pdfPreviewIncludeRecordContent: "true",
  pdfPreviewIncludeRecordHistory: "true",
  pdfPreviewIncludeRecordInjury: "false",
  pdfPreviewIncludeRecordInjuryDate: "false",
  pdfPreviewIncludeTreatmentDetails: "false",
};

// 後方互換性のためのエイリアス
const DEFAULT_SETTINGS: Record<string, string> = DEFAULT_SAFE_SETTINGS;

/**
 * 秘密情報として扱うキー（ダンプ時にマスク）
 * 型レベルでSecretSettingKeyと一致することを保証
 */
export const SECRET_SETTING_KEYS: SecretSettingKey[] = [
  "encryptionKey",
  "signingKey",
  "backupSecret",
  "apiKey",
  "smtpPassword",
  "webhookSecret",
  "systemRecoveryCodeHash",
];

/**
 * キーが秘密情報かどうかを型安全にチェック
 */
export function isSecretKey(key: string): key is SecretSettingKey {
  return (SECRET_SETTING_KEYS as string[]).includes(key);
}

/**
 * キーが安全な設定かどうかを型安全にチェック
 */
export function isSafeKey(key: string): key is SafeSettingKey {
  return key in DEFAULT_SAFE_SETTINGS;
}

/**
 * 設定値を取得（キャッシュなし）
 */
export async function getSetting(key: string): Promise<string> {
  const setting = await prisma.systemSettings.findUnique({
    where: { key },
  });

  if (setting) {
    return setting.value;
  }

  // デフォルト値を返す
  return DEFAULT_SETTINGS[key] ?? "";
}

/**
 * 設定値を数値として取得
 */
export async function getSettingAsNumber(
  key: string,
  defaultValue: number,
): Promise<number> {
  const value = await getSetting(key);
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 設定値を真偽値として取得
 */
export async function getSettingAsBoolean(
  key: string,
  defaultValue: boolean,
): Promise<boolean> {
  const value = await getSetting(key);
  if (value === "") return defaultValue;
  return value === "true" || value === "1";
}

/**
 * 設定値を設定
 */
export async function setSetting(
  key: string,
  value: string,
  updatedBy?: string,
  description?: string,
): Promise<void> {
  const previous = await prisma.systemSettings.findUnique({
    where: { key },
    select: { value: true },
  });

  await prisma.systemSettings.upsert({
    where: { key },
    update: { value, updatedBy },
    create: { key, value, updatedBy, description },
  });

  if (updatedBy) {
    const secret = isSecretKey(key);
    const previousValue = previous?.value ?? null;
    const action = previous ? "UPDATE" : "CREATE";
    await createAuditLog({
      userId: updatedBy,
      action,
      entityType: "SYSTEM_SETTING",
      entityId: key,
      category: "DATA_MODIFICATION",
      severity: "INFO",
      metadata: {
        key,
        secret,
        previousValue: secret
          ? previousValue
            ? "[MASKED]"
            : null
          : previousValue,
        newValue: secret ? "[MASKED]" : value,
      },
    });
  }
}

/**
 * 複数の設定値を一括取得
 */
export async function getSettings(
  keys: string[],
): Promise<Record<string, string>> {
  const settings = await prisma.systemSettings.findMany({
    where: { key: { in: keys } },
  });

  const result: Record<string, string> = {};
  for (const key of keys) {
    const setting = settings.find((s) => s.key === key);
    result[key] = setting?.value ?? DEFAULT_SETTINGS[key] ?? "";
  }

  return result;
}

/**
 * 全設定を取得（監査用・秘密情報はマスク）
 */
export async function getAllSettings(maskSecrets: boolean = true): Promise<
  Array<{
    key: string;
    value: string;
    description: string | null;
    updatedAt: Date;
  }>
> {
  const settings = await prisma.systemSettings.findMany({
    orderBy: { key: "asc" },
  });

  // デフォルト設定も含める
  const allKeys = new Set([
    ...Object.keys(DEFAULT_SETTINGS),
    ...settings.map((s) => s.key),
  ]);

  const result: Array<{
    key: string;
    value: string;
    description: string | null;
    updatedAt: Date;
  }> = [];

  for (const key of allKeys) {
    const setting = settings.find((s) => s.key === key);
    let value = setting?.value ?? DEFAULT_SETTINGS[key] ?? "";

    // 秘密情報をマスク
    if (maskSecrets && isSecretKey(key)) {
      value = value ? "*****" : "";
    }

    result.push({
      key,
      value,
      description: setting?.description ?? null,
      updatedAt: setting?.updatedAt ?? new Date(),
    });
  }

  return result.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * 安全な設定のみを取得（秘密情報を含まない、型安全）
 */
export async function getSafeSettings(): Promise<
  Record<SafeSettingKey, string>
> {
  const keys = Object.keys(DEFAULT_SAFE_SETTINGS) as SafeSettingKey[];
  const settings = await getSettings(keys);
  return settings as Record<SafeSettingKey, string>;
}

/**
 * 全設定を取得（秘密情報は必ずマスク、監査ダンプ用）
 */
export async function getAllSettingsForAudit(): Promise<
  Array<{
    key: string;
    value: string;
    isSecret: boolean;
    description: string | null;
    updatedAt: Date;
  }>
> {
  const settings = await prisma.systemSettings.findMany({
    orderBy: { key: "asc" },
  });

  const allKeys = new Set([
    ...Object.keys(DEFAULT_SETTINGS),
    ...settings.map((s) => s.key),
  ]);

  const result: Array<{
    key: string;
    value: string;
    isSecret: boolean;
    description: string | null;
    updatedAt: Date;
  }> = [];

  for (const key of allKeys) {
    const setting = settings.find((s) => s.key === key);
    const isSecret = isSecretKey(key);
    const rawValue = setting?.value ?? DEFAULT_SETTINGS[key] ?? "";

    result.push({
      key,
      value: isSecret && rawValue ? "*****" : rawValue,
      isSecret,
      description: setting?.description ?? null,
      updatedAt: setting?.updatedAt ?? new Date(),
    });
  }

  return result.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * ロックアウト設定を取得
 */
export async function getLockoutSettings(): Promise<{
  maxFailedLogins: number;
  lockoutMinutes: number;
}> {
  const settings = await getSettings(["maxFailedLogins", "lockoutMinutes"]);
  return {
    maxFailedLogins: parseInt(settings.maxFailedLogins, 10) || 5,
    lockoutMinutes: parseInt(settings.lockoutMinutes, 10) || 30,
  };
}

/**
 * MFA設定を取得
 */
export async function getMfaSettings(): Promise<{
  enabled: boolean;
  required: boolean;
  rateLimitAttempts: number;
  rateLimitMinutes: number;
}> {
  const settings = await getSettings([
    "mfaEnabled",
    "mfaRequired",
    "mfaRateLimitAttempts",
    "mfaRateLimitMinutes",
  ]);
  return {
    enabled: settings.mfaEnabled === "true",
    required: settings.mfaRequired === "true",
    rateLimitAttempts: parseInt(settings.mfaRateLimitAttempts, 10) || 5,
    rateLimitMinutes: parseInt(settings.mfaRateLimitMinutes, 10) || 15,
  };
}

/**
 * 文書設定を取得
 */
export async function getDocumentSettings(): Promise<{
  unscanAlertHours: number;
  minDpi: number;
  maxSizeMb: number;
}> {
  const settings = await getSettings([
    "unscanAlertHours",
    "minDocumentDpi",
    "maxDocumentSizeMb",
  ]);
  return {
    unscanAlertHours: parseInt(settings.unscanAlertHours, 10) || 168,
    minDpi: parseInt(settings.minDocumentDpi, 10) || 200,
    maxSizeMb: parseInt(settings.maxDocumentSizeMb, 10) || 20,
  };
}

/**
 * デフォルト設定を初期化（初回セットアップ用）
 */
export async function initializeDefaultSettings(): Promise<void> {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = await prisma.systemSettings.findUnique({ where: { key } });
    if (!existing) {
      await prisma.systemSettings.create({
        data: {
          key,
          value,
          description: `Default setting for ${key}`,
        },
      });
    }
  }
}
