/**
 * 拡張機能 - レジストリ
 *
 * インストール済み拡張の管理
 * シングルトンパターンで実装
 */

import type {
  ExtensionManifest,
  ExtensionCapabilities,
  InstalledExtension,
  ExtensionState,
  CommandContribution,
  TemplateContribution,
  ExporterContribution,
  IntegrationContribution,
  ViewContribution,
} from "./types";
import { parseManifest, isCompatibleWithAppVersion } from "./manifest";
import { createExtensionAuditLog } from "./audit-extension";
import {
  checkLicenseForEnable,
  hasValidCachedLicense,
  resolveClinicId,
} from "./marketplace/license-enforcer";

// =============================================================================
// アプリバージョン（package.jsonから取得すべきだが、ここでは定数）
// =============================================================================

const APP_VERSION = "1.0.0";

// =============================================================================
// レジストリクラス
// =============================================================================

/**
 * 拡張レジストリ
 * シングルトン
 */
class ExtensionRegistry {
  private extensions: Map<string, InstalledExtension> = new Map();
  private commandHandlers: Map<string, () => Promise<void>> = new Map();

  /**
   * 拡張をインストール（メモリ上に登録）
   */
  async install(
    manifestData: unknown,
    extensionPath: string,
    installedBy: string,
  ): Promise<InstallResult> {
    // マニフェスト検証
    const validationResult = parseManifest(manifestData);
    if (!validationResult.success || !validationResult.manifest) {
      return {
        success: false,
        errors: validationResult.errors || [
          { message: "マニフェストの検証に失敗" },
        ],
      };
    }

    const manifest = validationResult.manifest;

    // 互換性チェック
    if (!isCompatibleWithAppVersion(manifest, APP_VERSION)) {
      return {
        success: false,
        errors: [
          {
            message: `この拡張はアプリバージョン ${manifest.minAppVersion} 以上が必要です（現在: ${APP_VERSION}）`,
          },
        ],
      };
    }

    // 既存の拡張チェック
    const existing = this.extensions.get(manifest.id);
    if (existing) {
      return {
        success: false,
        errors: [
          {
            message: `拡張 "${manifest.id}" は既にインストールされています（バージョン: ${existing.manifest.version}）`,
          },
        ],
      };
    }

    // インストール
    const installedExtension: InstalledExtension = {
      manifest,
      state: "installed",
      path: extensionPath,
      installedAt: new Date(),
      grantedCapabilities: {}, // 権限は後で管理者が付与
    };

    this.extensions.set(manifest.id, installedExtension);

    // 監査ログ
    await createExtensionAuditLog({
      action: "extension.installed",
      extensionId: manifest.id,
      extensionVersion: manifest.version,
      userId: installedBy,
      metadata: {
        requestedCapabilities: manifest.capabilities,
      },
    });

    return {
      success: true,
      extension: installedExtension,
    };
  }

  /**
   * 拡張をアンインストール
   */
  async uninstall(
    extensionId: string,
    uninstalledBy: string,
  ): Promise<UninstallResult> {
    const extension = this.extensions.get(extensionId);
    if (!extension) {
      return {
        success: false,
        error: `拡張 "${extensionId}" は見つかりません`,
      };
    }

    // 有効な場合は先に無効化
    if (extension.state === "enabled") {
      await this.disable(extensionId, uninstalledBy);
    }

    this.extensions.delete(extensionId);

    // 監査ログ
    await createExtensionAuditLog({
      action: "extension.uninstalled",
      extensionId: extension.manifest.id,
      extensionVersion: extension.manifest.version,
      userId: uninstalledBy,
    });

    return { success: true };
  }

  /**
   * 拡張を有効化
   */
  async enable(extensionId: string, enabledBy: string): Promise<EnableResult> {
    const extension = this.extensions.get(extensionId);
    if (!extension) {
      return {
        success: false,
        error: `拡張 "${extensionId}" は見つかりません`,
      };
    }

    if (extension.state === "enabled") {
      return {
        success: false,
        error: `拡張 "${extensionId}" は既に有効です`,
      };
    }

    // 権限が付与されているか確認
    if (Object.keys(extension.grantedCapabilities).length === 0) {
      return {
        success: false,
        error: `拡張 "${extensionId}" には権限が付与されていません。先に権限を付与してください`,
      };
    }

    const clinicId = await resolveClinicId();
    if (!clinicId) {
      return {
        success: false,
        error: "クリニック情報が取得できないため、拡張を有効化できません",
      };
    }

    const licenseCheck = await checkLicenseForEnable(extensionId, clinicId);
    if (!licenseCheck.allowed) {
      if (enabledBy === "system") {
        const cachedOk = await hasValidCachedLicense(extensionId);
        if (cachedOk) {
          extension.state = "enabled";
          extension.enabledAt = new Date();

          await createExtensionAuditLog({
            action: "extension.enabled",
            extensionId: extension.manifest.id,
            extensionVersion: extension.manifest.version,
            userId: enabledBy,
          });

          return { success: true };
        }
      }
      return {
        success: false,
        error: "ライセンスの検証に失敗したため、有効化できません",
      };
    }

    extension.state = "enabled";
    extension.enabledAt = new Date();

    // 監査ログ
    await createExtensionAuditLog({
      action: "extension.enabled",
      extensionId: extension.manifest.id,
      extensionVersion: extension.manifest.version,
      userId: enabledBy,
    });

    return { success: true };
  }

  /**
   * 拡張を無効化
   */
  async disable(
    extensionId: string,
    disabledBy: string,
  ): Promise<DisableResult> {
    const extension = this.extensions.get(extensionId);
    if (!extension) {
      return {
        success: false,
        error: `拡張 "${extensionId}" は見つかりません`,
      };
    }

    if (extension.state !== "enabled") {
      return {
        success: false,
        error: `拡張 "${extensionId}" は有効ではありません`,
      };
    }

    // コマンドハンドラーの登録解除
    const commands = extension.manifest.contributes.commands || [];
    for (const command of commands) {
      this.commandHandlers.delete(command.id);
    }

    extension.state = "disabled";
    extension.enabledAt = undefined;

    // 監査ログ
    await createExtensionAuditLog({
      action: "extension.disabled",
      extensionId: extension.manifest.id,
      extensionVersion: extension.manifest.version,
      userId: disabledBy,
    });

    return { success: true };
  }

  /**
   * 拡張に権限を付与
   */
  async grantCapabilities(
    extensionId: string,
    capabilities: ExtensionCapabilities,
    grantedBy: string,
  ): Promise<GrantResult> {
    const extension = this.extensions.get(extensionId);
    if (!extension) {
      return {
        success: false,
        error: `拡張 "${extensionId}" は見つかりません`,
      };
    }

    // 要求された権限の範囲内かチェック
    const requestedCapabilities = extension.manifest.capabilities;
    const validationErrors = validateGrantedCapabilities(
      capabilities,
      requestedCapabilities,
    );

    if (validationErrors.length > 0) {
      return {
        success: false,
        error: `無効な権限付与: ${validationErrors.join(", ")}`,
      };
    }

    extension.grantedCapabilities = capabilities;

    // 監査ログ
    await createExtensionAuditLog({
      action: "extension.capabilities_granted",
      extensionId: extension.manifest.id,
      extensionVersion: extension.manifest.version,
      userId: grantedBy,
      metadata: {
        grantedCapabilities: capabilities,
      },
    });

    return { success: true };
  }

  /**
   * 拡張の権限を剥奪
   */
  async revokeCapabilities(
    extensionId: string,
    revokedBy: string,
  ): Promise<RevokeResult> {
    const extension = this.extensions.get(extensionId);
    if (!extension) {
      return {
        success: false,
        error: `拡張 "${extensionId}" は見つかりません`,
      };
    }

    // 有効な場合は先に無効化
    if (extension.state === "enabled") {
      await this.disable(extensionId, revokedBy);
    }

    const previousCapabilities = extension.grantedCapabilities;
    extension.grantedCapabilities = {};

    // 監査ログ
    await createExtensionAuditLog({
      action: "extension.capabilities_revoked",
      extensionId: extension.manifest.id,
      extensionVersion: extension.manifest.version,
      userId: revokedBy,
      metadata: {
        previousCapabilities,
      },
    });

    return { success: true };
  }

  // ===========================================================================
  // 取得系メソッド
  // ===========================================================================

  /**
   * 拡張を取得
   */
  get(extensionId: string): InstalledExtension | undefined {
    return this.extensions.get(extensionId);
  }

  /**
   * 全拡張を取得
   */
  getAll(): InstalledExtension[] {
    return Array.from(this.extensions.values());
  }

  /**
   * 有効な拡張のみ取得
   */
  getEnabled(): InstalledExtension[] {
    return this.getAll().filter((ext) => ext.state === "enabled");
  }

  /**
   * 特定の寄与点を持つ有効な拡張を取得
   */
  getEnabledWithContribution(
    contributionType: keyof InstalledExtension["manifest"]["contributes"],
  ): InstalledExtension[] {
    return this.getEnabled().filter(
      (ext) => (ext.manifest.contributes[contributionType]?.length ?? 0) > 0,
    );
  }

  // ===========================================================================
  // 寄与点の集約メソッド
  // ===========================================================================

  /**
   * 全有効拡張のコマンドを取得
   */
  getAllCommands(): Array<CommandContribution & { extensionId: string }> {
    const commands: Array<CommandContribution & { extensionId: string }> = [];
    for (const ext of this.getEnabled()) {
      for (const cmd of ext.manifest.contributes.commands || []) {
        commands.push({ ...cmd, extensionId: ext.manifest.id });
      }
    }
    return commands;
  }

  /**
   * 全有効拡張のテンプレートを取得
   */
  getAllTemplates(): Array<TemplateContribution & { extensionId: string }> {
    const templates: Array<TemplateContribution & { extensionId: string }> = [];
    for (const ext of this.getEnabled()) {
      for (const tpl of ext.manifest.contributes.templates || []) {
        templates.push({ ...tpl, extensionId: ext.manifest.id });
      }
    }
    return templates;
  }

  /**
   * 全有効拡張のエクスポーターを取得
   */
  getAllExporters(): Array<ExporterContribution & { extensionId: string }> {
    const exporters: Array<ExporterContribution & { extensionId: string }> = [];
    for (const ext of this.getEnabled()) {
      for (const exp of ext.manifest.contributes.exporters || []) {
        exporters.push({ ...exp, extensionId: ext.manifest.id });
      }
    }
    return exporters;
  }

  /**
   * 全有効拡張の連携を取得
   */
  getAllIntegrations(): Array<
    IntegrationContribution & { extensionId: string }
  > {
    const integrations: Array<
      IntegrationContribution & { extensionId: string }
    > = [];
    for (const ext of this.getEnabled()) {
      for (const int of ext.manifest.contributes.integrations || []) {
        integrations.push({ ...int, extensionId: ext.manifest.id });
      }
    }
    return integrations;
  }

  /**
   * 全有効拡張のビューを取得
   */
  getAllViews(): Array<ViewContribution & { extensionId: string }> {
    const views: Array<ViewContribution & { extensionId: string }> = [];
    for (const ext of this.getEnabled()) {
      for (const view of ext.manifest.contributes.views || []) {
        views.push({ ...view, extensionId: ext.manifest.id });
      }
    }
    return views;
  }

  // ===========================================================================
  // 内部状態のリセット（テスト用）
  // ===========================================================================

  /**
   * @internal テスト用
   */
  _reset(): void {
    this.extensions.clear();
    this.commandHandlers.clear();
  }
}

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * 付与された権限が要求された範囲内かチェック
 */
function validateGrantedCapabilities(
  granted: ExtensionCapabilities,
  requested: ExtensionCapabilities,
): string[] {
  const errors: string[] = [];

  // リソース権限のチェック
  const resourceKeys: (keyof ExtensionCapabilities)[] = [
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
    const grantedActions = granted[key] as string[] | undefined;
    const requestedActions = requested[key] as string[] | undefined;

    if (grantedActions && grantedActions.length > 0) {
      if (!requestedActions || requestedActions.length === 0) {
        errors.push(`"${key}" は要求されていません`);
        continue;
      }

      for (const action of grantedActions) {
        if (!requestedActions.includes(action)) {
          errors.push(`"${key}.${action}" は要求されていません`);
        }
      }
    }
  }

  // ネットワーク権限のチェック
  if (granted.network && granted.network.length > 0) {
    if (!requested.network || requested.network.length === 0) {
      errors.push("ネットワークアクセスは要求されていません");
    } else {
      for (const host of granted.network) {
        if (!requested.network.includes(host)) {
          errors.push(`ネットワーク "${host}" は要求されていません`);
        }
      }
    }
  }

  return errors;
}

// =============================================================================
// 結果型
// =============================================================================

export interface InstallResult {
  success: boolean;
  extension?: InstalledExtension;
  errors?: Array<{ message: string; path?: string }>;
}

export interface UninstallResult {
  success: boolean;
  error?: string;
}

export interface EnableResult {
  success: boolean;
  error?: string;
}

export interface DisableResult {
  success: boolean;
  error?: string;
}

export interface GrantResult {
  success: boolean;
  error?: string;
}

export interface RevokeResult {
  success: boolean;
  error?: string;
}

// =============================================================================
// シングルトンエクスポート
// =============================================================================

export const extensionRegistry = new ExtensionRegistry();

// クラスもエクスポート（テスト用）
export { ExtensionRegistry };
