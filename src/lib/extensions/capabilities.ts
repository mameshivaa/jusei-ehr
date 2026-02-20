/**
 * 拡張機能 - 権限システム
 *
 * 拡張の権限チェックを行う
 * 既存のRBACシステム（rbac.ts）と連携
 */

import type {
  ExtensionCapabilities,
  ExtensionResource,
  ExtensionAction,
  InstalledExtension,
} from "./types";
import { hasPermission, type Resource, type Action } from "@/lib/rbac";
import type { UserRole } from "@prisma/client";

// =============================================================================
// 拡張リソース → RBACリソース マッピング
// =============================================================================

const RESOURCE_MAPPING: Record<ExtensionResource, Resource> = {
  patient: "PATIENT",
  chart: "CHART",
  visit: "VISIT",
  treatmentRecord: "TREATMENT_RECORD",
  injury: "INJURY",
  treatmentDetail: "TREATMENT_DETAIL",
  procedureMaster: "PROCEDURE_MASTER",
  scannedDocument: "SCANNED_DOCUMENT",
};

const ACTION_MAPPING: Record<ExtensionAction, Action> = {
  read: "READ",
  create: "CREATE",
  update: "UPDATE",
  delete: "DELETE",
};

// =============================================================================
// 権限チェック関数
// =============================================================================

/**
 * 拡張が指定のリソース・アクションにアクセスできるかチェック
 *
 * 条件:
 * 1. 拡張に権限が付与されている（grantedCapabilities）
 * 2. 実行ユーザーのRBACロールでもアクセス可能
 *
 * 両方を満たす場合のみtrue
 */
export function canExtensionAccess(
  extension: InstalledExtension,
  resource: ExtensionResource,
  action: ExtensionAction,
  userRole: UserRole,
): boolean {
  // 拡張が有効でない場合はアクセス不可
  if (extension.state !== "enabled") {
    return false;
  }

  // 拡張に権限が付与されているかチェック
  const grantedActions = extension.grantedCapabilities[resource];
  if (!grantedActions || !grantedActions.includes(action)) {
    return false;
  }

  // ユーザーのRBACロールでもアクセス可能かチェック
  const rbacResource = RESOURCE_MAPPING[resource];
  const rbacAction = ACTION_MAPPING[action];
  if (!hasPermission(userRole, rbacResource, rbacAction)) {
    return false;
  }

  return true;
}

/**
 * 拡張がネットワークアクセスできるかチェック
 */
export function canExtensionAccessNetwork(
  extension: InstalledExtension,
  url: string,
): boolean {
  if (extension.state !== "enabled") {
    return false;
  }

  const allowedHosts = extension.grantedCapabilities.network;
  if (!allowedHosts || allowedHosts.length === 0) {
    return false;
  }

  try {
    const targetUrl = new URL(url);
    const targetOrigin = targetUrl.origin;

    return allowedHosts.some((allowed) => {
      try {
        const allowedUrl = new URL(allowed);
        return allowedUrl.origin === targetOrigin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * 権限チェック結果
 */
export interface CapabilityCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * 詳細な権限チェック（理由付き）
 */
export function checkExtensionCapability(
  extension: InstalledExtension,
  resource: ExtensionResource,
  action: ExtensionAction,
  userRole: UserRole,
): CapabilityCheckResult {
  // 拡張が有効でない場合
  if (extension.state !== "enabled") {
    return {
      allowed: false,
      reason: `拡張 "${extension.manifest.name}" は有効ではありません`,
    };
  }

  // 拡張に権限が付与されているかチェック
  const grantedActions = extension.grantedCapabilities[resource];
  if (!grantedActions || !grantedActions.includes(action)) {
    return {
      allowed: false,
      reason: `拡張 "${extension.manifest.name}" には "${resource}" への "${action}" 権限が付与されていません`,
    };
  }

  // ユーザーのRBACロールでもアクセス可能かチェック
  const rbacResource = RESOURCE_MAPPING[resource];
  const rbacAction = ACTION_MAPPING[action];
  if (!hasPermission(userRole, rbacResource, rbacAction)) {
    return {
      allowed: false,
      reason: `あなたのロールでは "${resource}" への "${action}" は許可されていません`,
    };
  }

  return { allowed: true };
}

/**
 * 要求された権限と付与された権限の差分を計算
 * 管理画面で「まだ許可されていない権限」を表示するため
 */
export function getUnGrantedCapabilities(
  requested: ExtensionCapabilities,
  granted: ExtensionCapabilities,
): ExtensionCapabilities {
  const result: ExtensionCapabilities = {};

  // リソース権限
  const resourceKeys: ExtensionResource[] = [
    "patient",
    "chart",
    "visit",
    "treatmentRecord",
    "injury",
    "treatmentDetail",
    "procedureMaster",
    "scannedDocument",
  ];

  for (const key of resourceKeys) {
    const requestedActions = requested[key] || [];
    const grantedActions = granted[key] || [];
    const ungrantedActions = requestedActions.filter(
      (action) => !grantedActions.includes(action),
    );
    if (ungrantedActions.length > 0) {
      result[key] = ungrantedActions;
    }
  }

  // ネットワーク権限
  if (requested.network && requested.network.length > 0) {
    const grantedNetwork = granted.network || [];
    const ungrantedNetwork = requested.network.filter(
      (host) => !grantedNetwork.includes(host),
    );
    if (ungrantedNetwork.length > 0) {
      result.network = ungrantedNetwork;
    }
  }

  return result;
}

/**
 * 権限を人間が読みやすい形式に変換
 */
export function formatCapabilitiesForDisplay(
  capabilities: ExtensionCapabilities,
): string[] {
  const result: string[] = [];

  const resourceLabels: Record<ExtensionResource, string> = {
    patient: "患者情報",
    chart: "カルテ",
    visit: "来院記録",
    treatmentRecord: "施術記録",
    injury: "負傷情報",
    treatmentDetail: "施術詳細",
    procedureMaster: "施術マスタ",
    scannedDocument: "スキャン文書",
  };

  const actionLabels: Record<ExtensionAction, string> = {
    read: "読み取り",
    create: "作成",
    update: "更新",
    delete: "削除",
  };

  const resourceKeys: ExtensionResource[] = [
    "patient",
    "chart",
    "visit",
    "treatmentRecord",
    "injury",
    "treatmentDetail",
    "procedureMaster",
    "scannedDocument",
  ];

  for (const key of resourceKeys) {
    const actions = capabilities[key];
    if (actions && actions.length > 0) {
      const actionStr = actions.map((a) => actionLabels[a]).join("、");
      result.push(`${resourceLabels[key]}: ${actionStr}`);
    }
  }

  if (capabilities.network && capabilities.network.length > 0) {
    result.push(`ネットワーク: ${capabilities.network.join(", ")}`);
  }

  return result;
}

/**
 * 権限のリスクレベルを評価
 * 管理画面で警告表示するため
 */
export type RiskLevel = "low" | "medium" | "high";

export interface CapabilityRiskAssessment {
  overall: RiskLevel;
  details: Array<{
    capability: string;
    risk: RiskLevel;
    reason: string;
  }>;
}

export function assessCapabilityRisk(
  capabilities: ExtensionCapabilities,
): CapabilityRiskAssessment {
  const details: CapabilityRiskAssessment["details"] = [];
  let maxRisk: RiskLevel = "low";

  // 高リスク: 削除権限
  const resourcesWithDelete: ExtensionResource[] = [
    "patient",
    "chart",
    "treatmentRecord",
  ];
  for (const resource of resourcesWithDelete) {
    if (capabilities[resource]?.includes("delete")) {
      details.push({
        capability: `${resource}.delete`,
        risk: "high",
        reason: `${resource}の削除は取り消しできない操作です`,
      });
      maxRisk = "high";
    }
  }

  // 高リスク: ネットワークアクセス
  if (capabilities.network && capabilities.network.length > 0) {
    details.push({
      capability: "network",
      risk: "high",
      reason: "外部サーバーへのデータ送信が可能になります",
    });
    maxRisk = "high";
  }

  // 中リスク: 更新権限
  const resourcesWithUpdate: ExtensionResource[] = [
    "patient",
    "chart",
    "treatmentRecord",
  ];
  for (const resource of resourcesWithUpdate) {
    if (
      capabilities[resource]?.includes("update") &&
      !capabilities[resource]?.includes("delete")
    ) {
      details.push({
        capability: `${resource}.update`,
        risk: "medium",
        reason: `${resource}の内容を変更できます`,
      });
      if (maxRisk === "low") maxRisk = "medium";
    }
  }

  // 中リスク: 作成権限
  for (const resource of resourcesWithUpdate) {
    if (capabilities[resource]?.includes("create")) {
      details.push({
        capability: `${resource}.create`,
        risk: "medium",
        reason: `新しい${resource}を作成できます`,
      });
      if (maxRisk === "low") maxRisk = "medium";
    }
  }

  return {
    overall: maxRisk,
    details,
  };
}
