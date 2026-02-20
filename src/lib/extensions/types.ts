/**
 * 拡張機能システム - 型定義
 *
 * VS Code風の寄与点（contribution points）方式を採用
 * 医療データを扱うため、安全性を最優先に設計
 *
 * 寄与点（最小セット）:
 * - commands: ユーザーアクション起点のコマンド
 * - templates: 印刷/出力テンプレート
 * - exporters: データエクスポート形式
 * - integrations: 外部サービス連携
 * - views: UIパネル/タブ追加
 */

// =============================================================================
// Capability（権限）定義
// =============================================================================

/**
 * 拡張がアクセス可能なリソース
 * 既存のRBAC Resourceと対応
 */
export type ExtensionResource =
  | "patient"
  | "chart"
  | "visit"
  | "treatmentRecord"
  | "injury"
  | "treatmentDetail"
  | "procedureMaster"
  | "scannedDocument";

/**
 * リソースに対するアクション
 */
export type ExtensionAction = "read" | "create" | "update" | "delete";

/**
 * 拡張の権限定義
 */
export type ExtensionCapabilities = {
  /** リソース別アクセス権限 */
  [K in ExtensionResource]?: ExtensionAction[];
} & {
  /**
   * ネットワークアクセス許可
   * 空配列 = ネットワーク禁止
   * ["https://api.example.com"] = 特定ホストのみ許可
   */
  network?: string[];
};

// =============================================================================
// Contribution Point（寄与点）定義
// =============================================================================

/**
 * コマンド寄与点
 * ユーザーが明示的に実行するアクション
 */
export interface CommandContribution {
  /** 一意識別子（例: "myExtension.printReport"） */
  id: string;
  /** 表示名 */
  title: string;
  /** アイコン名（Lucide icons） */
  icon?: string;
  /**
   * コマンドが表示されるコンテキスト
   * - "global": どこでも表示
   * - "patient": 患者詳細画面
   * - "chart": カルテ画面
   * - "visit": 来院記録画面
   * - "treatmentRecord": 施術記録画面
   */
  context: CommandContext[];
  /** ショートカットキー（例: "ctrl+shift+p"） */
  keybinding?: string;
  /** 必要な権限（この権限がない場合は非表示） */
  requiredCapabilities?: Partial<ExtensionCapabilities>;
}

export type CommandContext =
  | "global"
  | "patient"
  | "chart"
  | "visit"
  | "treatmentRecord"
  | "settings";

/**
 * テンプレート寄与点
 * 印刷/出力用のテンプレート
 */
export interface TemplateContribution {
  /** 一意識別子 */
  id: string;
  /** 表示名 */
  name: string;
  /** テンプレートの種類 */
  type: "print" | "export" | "report";
  /** テンプレートの種類 */
  file: string;
  /** 対象エンティティ */
  targetEntity: "patient" | "chart" | "visit" | "treatmentRecord";
  /** 説明 */
  description?: string;
}

/**
 * エクスポーター寄与点
 * データ出力形式の追加
 */
export interface ExporterContribution {
  /** 一意識別子 */
  id: string;
  /** 表示名 */
  name: string;
  /** ファイル拡張子（例: "xlsx"） */
  extension: string;
  /** MIMEタイプ */
  mimeType: string;
  /** エクスポート処理ファイル（拡張パッケージ内の相対パス） */
  file: string;
  /** 対象エンティティ */
  targetEntities: Array<"patient" | "chart" | "visit" | "treatmentRecord">;
  /** 説明 */
  description?: string;
}

/**
 * 連携寄与点
 * 外部サービスとの連携
 */
export interface IntegrationContribution {
  /** 一意識別子 */
  id: string;
  /** 表示名 */
  name: string;
  /** 連携先の種類 */
  type: "webhook" | "api" | "mcp";
  /** 接続先URL（manifestで宣言、管理画面で許可） */
  endpoint: string;
  /** トリガー（どのタイミングで実行されるか） */
  triggers: IntegrationTrigger[];
  /** 送信前確認を必要とするか（デフォルト: true） */
  requireConfirmation?: boolean;
  /** 説明 */
  description?: string;
}

export type IntegrationTrigger =
  | "manual"
  | "patient.created"
  | "patient.updated"
  | "visit.created"
  | "treatmentRecord.confirmed";

/**
 * ビュー寄与点
 * UIパネル/タブの追加
 */
export interface ViewContribution {
  /** 一意識別子 */
  id: string;
  /** 表示名 */
  name: string;
  /** ビューの配置場所 */
  location: ViewLocation;
  /** ビューファイル（拡張パッケージ内の相対パス、HTMLまたはReactコンポーネント） */
  file: string;
  /** アイコン名 */
  icon?: string;
  /** 説明 */
  description?: string;
}

export type ViewLocation =
  | "sidebar"
  | "patient.tab"
  | "chart.tab"
  | "dashboard.widget"
  | "settings.section";

/**
 * 全寄与点をまとめた型
 */
export interface ExtensionContributions {
  commands?: CommandContribution[];
  templates?: TemplateContribution[];
  exporters?: ExporterContribution[];
  integrations?: IntegrationContribution[];
  views?: ViewContribution[];
}

// =============================================================================
// Manifest（拡張定義ファイル）
// =============================================================================

/**
 * 拡張のメタデータ
 */
export interface ExtensionMetadata {
  /** 一意識別子（逆ドメイン形式推奨: "com.example.my-extension"） */
  id: string;
  /** 表示名 */
  name: string;
  /** バージョン（semver形式） */
  version: string;
  /** 必要な最小アプリバージョン */
  minAppVersion: string;
  /** 発行者 */
  publisher: string;
  /** 説明 */
  description?: string;
  /** ライセンス */
  license?: string;
  /** リポジトリURL */
  repository?: string;
  /** アイコンファイルパス */
  icon?: string;
}

/**
 * manifest.json の完全な型
 */
export interface ExtensionManifest extends ExtensionMetadata {
  /** スキーマバージョン */
  $schema?: string;
  /** 必要な権限 */
  capabilities: ExtensionCapabilities;
  /** 寄与点 */
  contributes: ExtensionContributions;
}

// =============================================================================
// ランタイム状態
// =============================================================================

/**
 * 拡張の状態
 */
export type ExtensionState = "installed" | "enabled" | "disabled" | "error";

/**
 * インストール済み拡張の情報
 */
export interface InstalledExtension {
  /** マニフェスト情報 */
  manifest: ExtensionManifest;
  /** 現在の状態 */
  state: ExtensionState;
  /** 拡張パッケージのパス */
  path: string;
  /** インストール日時 */
  installedAt: Date;
  /** 有効化日時 */
  enabledAt?: Date;
  /** 承認された権限（管理者が許可した権限のみ） */
  grantedCapabilities: ExtensionCapabilities;
  /** エラーメッセージ（state === "error" の場合） */
  errorMessage?: string;
}

// =============================================================================
// App API（拡張がアプリと通信するためのAPI）
// =============================================================================

/**
 * App APIのコンテキスト
 * コマンド実行時に渡される情報
 */
export interface CommandExecutionContext {
  /** 実行したユーザーのID */
  userId: string;
  /** 現在のコンテキスト */
  context: CommandContext;
  /** コンテキストに応じたエンティティID */
  entityId?: string;
  /** 拡張に許可された権限 */
  grantedCapabilities: ExtensionCapabilities;
}

/**
 * コマンドハンドラーの型
 */
export type CommandHandler = (
  context: CommandExecutionContext,
) => Promise<CommandResult>;

/**
 * コマンド実行結果
 */
export interface CommandResult {
  /** 成功したか */
  success: boolean;
  /** メッセージ（UIに表示） */
  message?: string;
  /** 追加データ */
  data?: unknown;
}

// =============================================================================
// 監査ログ用の型
// =============================================================================

/**
 * 拡張操作の種類
 */
export type ExtensionAuditAction =
  | "extension.installed"
  | "extension.uninstalled"
  | "extension.enabled"
  | "extension.disabled"
  | "extension.capabilities_granted"
  | "extension.capabilities_revoked"
  | "extension.command_executed"
  | "extension.integration_triggered"
  | "extension.data_accessed";

/**
 * 拡張操作の監査ログデータ
 */
export interface ExtensionAuditLogData {
  /** 操作種類 */
  action: ExtensionAuditAction;
  /** 対象拡張ID */
  extensionId: string;
  /** 対象拡張バージョン */
  extensionVersion: string;
  /** 実行ユーザーID */
  userId: string;
  /** 追加情報 */
  metadata?: {
    /** 実行されたコマンドID */
    commandId?: string;
    /** アクセスされたリソース */
    accessedResource?: string;
    /** アクセスされたエンティティID */
    accessedEntityId?: string;
    /** 連携先 */
    integrationEndpoint?: string;
    /** その他 */
    [key: string]: unknown;
  };
}
