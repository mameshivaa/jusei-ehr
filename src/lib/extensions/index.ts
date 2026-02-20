/**
 * 拡張機能システム - エントリーポイント
 *
 * VS Code風の寄与点（contribution points）方式
 * 医療データを扱うため、安全性を最優先に設計
 */

// 型定義
export type {
  // リソース・アクション
  ExtensionResource,
  ExtensionAction,
  ExtensionCapabilities,
  // 寄与点
  CommandContribution,
  CommandContext,
  TemplateContribution,
  ExporterContribution,
  IntegrationContribution,
  IntegrationTrigger,
  ViewContribution,
  ViewLocation,
  ExtensionContributions,
  // マニフェスト
  ExtensionMetadata,
  ExtensionManifest,
  // ランタイム
  ExtensionState,
  InstalledExtension,
  // コマンド実行
  CommandExecutionContext,
  CommandHandler,
  CommandResult,
  // 監査ログ
  ExtensionAuditAction,
  ExtensionAuditLogData,
} from "./types";

// マニフェスト
export {
  parseManifest,
  parseManifestFromJson,
  compareSemver,
  isCompatibleWithAppVersion,
  isCommandContribution,
  isTemplateContribution,
  isExporterContribution,
  isIntegrationContribution,
  isViewContribution,
} from "./manifest";
export type {
  ManifestValidationResult,
  ManifestValidationError,
} from "./manifest";

// レジストリ
export { extensionRegistry, ExtensionRegistry } from "./registry";
export type {
  InstallResult,
  UninstallResult,
  EnableResult,
  DisableResult,
  GrantResult,
  RevokeResult,
} from "./registry";

// 権限
export {
  canExtensionAccess,
  canExtensionAccessNetwork,
  checkExtensionCapability,
  getUnGrantedCapabilities,
  formatCapabilitiesForDisplay,
  assessCapabilityRisk,
} from "./capabilities";
export type {
  CapabilityCheckResult,
  RiskLevel,
  CapabilityRiskAssessment,
} from "./capabilities";

// 監査ログ
export {
  createExtensionAuditLog,
  logExtensionDataAccess,
  logExtensionCommandExecution,
  logExtensionIntegration,
} from "./audit-extension";

// コマンド
export {
  registerCommandHandler,
  unregisterCommandHandler,
  clearAllCommandHandlers,
  executeCommand,
  getAvailableCommands,
  getCommandByKeybinding,
  registerBuiltinCommands,
} from "./contributions/commands";
export type {
  ExecuteCommandResult,
  ContextualCommand,
} from "./contributions/commands";

// テンプレート
export {
  getAvailableTemplates,
  renderTemplate,
  clearTemplateCache,
  registerTemplateHelper,
} from "./contributions/templates";
export type {
  ContextualTemplate,
  RenderResult,
} from "./contributions/templates";

// ローダー
export {
  discoverExtensions,
  loadAllExtensions,
  persistExtensionState,
  enableExtensionAndPersist,
  disableExtensionAndPersist,
  grantCapabilitiesAndPersist,
  revokeCapabilitiesAndPersist,
  initializeExtensions,
} from "./loader";
export type { DiscoveredExtension, LoadResult } from "./loader";

// App API
export { createAppApi } from "./api/app-api";
export type {
  AppApiContext,
  AppApiResult,
  AppApi,
  PatientForExtension,
  ChartForExtension,
  TreatmentRecordForExtension,
  VisitForExtension,
  ProcedureForExtension,
} from "./api/app-api";
