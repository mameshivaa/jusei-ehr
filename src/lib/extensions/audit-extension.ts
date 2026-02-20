/**
 * 拡張機能 - 監査ログ
 *
 * 拡張操作に特化した監査ログ機能
 * 既存のaudit.tsをラップして拡張固有のデータを記録
 */

import { createAuditLog } from "@/lib/audit";
import type { ExtensionAuditLogData, ExtensionAuditAction } from "./types";

/**
 * 拡張操作の監査ログを記録
 */
export async function createExtensionAuditLog(
  data: ExtensionAuditLogData,
): Promise<void> {
  const category = getAuditCategory(data.action);
  const severity = getAuditSeverity(data.action);

  await createAuditLog({
    userId: data.userId,
    action: data.action,
    entityType: "EXTENSION",
    entityId: data.extensionId,
    category,
    severity,
    metadata: {
      extensionVersion: data.extensionVersion,
      ...data.metadata,
    },
  });
}

/**
 * アクションからカテゴリを決定
 */
function getAuditCategory(action: ExtensionAuditAction): string {
  switch (action) {
    case "extension.installed":
    case "extension.uninstalled":
      return "EXTENSION_LIFECYCLE";
    case "extension.enabled":
    case "extension.disabled":
      return "EXTENSION_STATE";
    case "extension.capabilities_granted":
    case "extension.capabilities_revoked":
      return "EXTENSION_SECURITY";
    case "extension.command_executed":
      return "EXTENSION_EXECUTION";
    case "extension.integration_triggered":
      return "EXTENSION_INTEGRATION";
    case "extension.data_accessed":
      return "EXTENSION_DATA_ACCESS";
    default:
      return "EXTENSION_OTHER";
  }
}

/**
 * アクションから重要度を決定
 */
function getAuditSeverity(action: ExtensionAuditAction): string {
  switch (action) {
    // セキュリティ関連は高重要度
    case "extension.capabilities_granted":
    case "extension.capabilities_revoked":
    case "extension.integration_triggered":
    case "extension.data_accessed":
      return "WARNING";
    // ライフサイクル操作は中重要度
    case "extension.installed":
    case "extension.uninstalled":
    case "extension.enabled":
    case "extension.disabled":
      return "INFO";
    // コマンド実行は通常
    case "extension.command_executed":
      return "INFO";
    default:
      return "INFO";
  }
}

/**
 * 拡張によるデータアクセスを記録
 * App API経由でデータアクセスする際に呼び出す
 */
export async function logExtensionDataAccess(
  extensionId: string,
  extensionVersion: string,
  userId: string,
  resource: string,
  entityId?: string,
  action: "read" | "create" | "update" | "delete" = "read",
): Promise<void> {
  await createExtensionAuditLog({
    action: "extension.data_accessed",
    extensionId,
    extensionVersion,
    userId,
    metadata: {
      accessedResource: resource,
      accessedEntityId: entityId,
      dataAction: action,
    },
  });
}

/**
 * 拡張コマンドの実行を記録
 */
export async function logExtensionCommandExecution(
  extensionId: string,
  extensionVersion: string,
  userId: string,
  commandId: string,
  context?: string,
  entityId?: string,
): Promise<void> {
  await createExtensionAuditLog({
    action: "extension.command_executed",
    extensionId,
    extensionVersion,
    userId,
    metadata: {
      commandId,
      executionContext: context,
      contextEntityId: entityId,
    },
  });
}

/**
 * 拡張連携の実行を記録
 */
export async function logExtensionIntegration(
  extensionId: string,
  extensionVersion: string,
  userId: string,
  integrationId: string,
  endpoint: string,
  trigger: string,
  success: boolean,
  errorMessage?: string,
): Promise<void> {
  await createExtensionAuditLog({
    action: "extension.integration_triggered",
    extensionId,
    extensionVersion,
    userId,
    metadata: {
      integrationId,
      integrationEndpoint: endpoint,
      trigger,
      success,
      errorMessage,
    },
  });
}
