/**
 * 拡張機能 - マニフェストパーサー/バリデーター
 *
 * manifest.jsonの検証とパースを行う
 * Zodによる厳格なスキーマ検証
 */

import { z } from "zod";
import type {
  ExtensionManifest,
  ExtensionCapabilities,
  ExtensionContributions,
  CommandContribution,
  TemplateContribution,
  ExporterContribution,
  IntegrationContribution,
  ViewContribution,
} from "./types";

// =============================================================================
// Zodスキーマ定義
// =============================================================================

/**
 * 拡張リソーススキーマ
 */
const ExtensionResourceSchema = z.enum([
  "patient",
  "chart",
  "visit",
  "treatmentRecord",
  "injury",
  "treatmentDetail",
  "procedureMaster",
  "scannedDocument",
]);

/**
 * 拡張アクションスキーマ
 */
const ExtensionActionSchema = z.enum(["read", "create", "update", "delete"]);

/**
 * 権限スキーマ
 */
const ExtensionCapabilitiesSchema = z
  .object({
    patient: z.array(ExtensionActionSchema).optional(),
    chart: z.array(ExtensionActionSchema).optional(),
    visit: z.array(ExtensionActionSchema).optional(),
    treatmentRecord: z.array(ExtensionActionSchema).optional(),
    injury: z.array(ExtensionActionSchema).optional(),
    treatmentDetail: z.array(ExtensionActionSchema).optional(),
    procedureMaster: z.array(ExtensionActionSchema).optional(),
    scannedDocument: z.array(ExtensionActionSchema).optional(),
    network: z
      .array(
        z.string().url({
          message: "ネットワーク許可は有効なURLである必要があります",
        }),
      )
      .optional(),
  })
  .strict();

/**
 * コマンドコンテキストスキーマ
 */
const CommandContextSchema = z.enum([
  "global",
  "patient",
  "chart",
  "visit",
  "treatmentRecord",
  "settings",
]);

/**
 * コマンド寄与点スキーマ
 */
const CommandContributionSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z][a-zA-Z0-9._-]*$/, {
      message:
        "コマンドIDは英字で始まり、英数字・ドット・アンダースコア・ハイフンのみ使用可能",
    }),
  title: z.string().min(1).max(100),
  icon: z.string().optional(),
  context: z.array(CommandContextSchema).min(1),
  keybinding: z
    .string()
    .regex(/^(ctrl|alt|shift|meta)(\+(ctrl|alt|shift|meta))*\+[a-z0-9]$/i)
    .optional(),
  requiredCapabilities: ExtensionCapabilitiesSchema.optional(),
});

/**
 * テンプレート寄与点スキーマ
 */
const TemplateContributionSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z][a-zA-Z0-9._-]*$/),
  name: z.string().min(1).max(100),
  type: z.enum(["print", "export", "report"]),
  file: z
    .string()
    .min(1)
    .regex(/^[^/].*\.(html|hbs|mustache)$/, {
      message:
        "テンプレートファイルは相対パスで、.html/.hbs/.mustache形式である必要があります",
    }),
  targetEntity: z.enum(["patient", "chart", "visit", "treatmentRecord"]),
  description: z.string().max(500).optional(),
});

/**
 * エクスポーター寄与点スキーマ
 */
const ExporterContributionSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z][a-zA-Z0-9._-]*$/),
  name: z.string().min(1).max(100),
  extension: z.string().min(1).max(10),
  mimeType: z.string().min(1),
  file: z
    .string()
    .min(1)
    .regex(/^[^/].*\.(js|ts)$/, {
      message:
        "エクスポーターファイルは相対パスで、.js/.ts形式である必要があります",
    }),
  targetEntities: z
    .array(z.enum(["patient", "chart", "visit", "treatmentRecord"]))
    .min(1),
  description: z.string().max(500).optional(),
});

/**
 * 連携トリガースキーマ
 */
const IntegrationTriggerSchema = z.enum([
  "manual",
  "patient.created",
  "patient.updated",
  "visit.created",
  "treatmentRecord.confirmed",
]);

/**
 * 連携寄与点スキーマ
 */
const IntegrationContributionSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z][a-zA-Z0-9._-]*$/),
  name: z.string().min(1).max(100),
  type: z.enum(["webhook", "api", "mcp"]),
  endpoint: z.string().url(),
  triggers: z.array(IntegrationTriggerSchema).min(1),
  requireConfirmation: z.boolean().default(true),
  description: z.string().max(500).optional(),
});

/**
 * ビュー配置場所スキーマ
 */
const ViewLocationSchema = z.enum([
  "sidebar",
  "patient.tab",
  "chart.tab",
  "dashboard.widget",
  "settings.section",
]);

/**
 * ビュー寄与点スキーマ
 */
const ViewContributionSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z][a-zA-Z0-9._-]*$/),
  name: z.string().min(1).max(100),
  location: ViewLocationSchema,
  file: z
    .string()
    .min(1)
    .regex(/^[^/].*\.(html|tsx|jsx)$/, {
      message:
        "ビューファイルは相対パスで、.html/.tsx/.jsx形式である必要があります",
    }),
  icon: z.string().optional(),
  description: z.string().max(500).optional(),
});

/**
 * 寄与点スキーマ
 */
const ExtensionContributionsSchema = z
  .object({
    commands: z.array(CommandContributionSchema).optional(),
    templates: z.array(TemplateContributionSchema).optional(),
    exporters: z.array(ExporterContributionSchema).optional(),
    integrations: z.array(IntegrationContributionSchema).optional(),
    views: z.array(ViewContributionSchema).optional(),
  })
  .refine(
    (data) => {
      // 少なくとも1つの寄与点が必要
      return (
        (data.commands?.length ?? 0) > 0 ||
        (data.templates?.length ?? 0) > 0 ||
        (data.exporters?.length ?? 0) > 0 ||
        (data.integrations?.length ?? 0) > 0 ||
        (data.views?.length ?? 0) > 0
      );
    },
    {
      message: "拡張には少なくとも1つの寄与点（contribution）が必要です",
    },
  );

/**
 * 拡張IDスキーマ（逆ドメイン形式推奨）
 */
const ExtensionIdSchema = z
  .string()
  .min(3)
  .max(100)
  .regex(/^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*(-[a-zA-Z0-9]+)*$/, {
    message:
      "拡張IDは逆ドメイン形式（例: com.example.my-extension）である必要があります",
  });

/**
 * セマンティックバージョンスキーマ
 */
const SemverSchema = z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/, {
  message: "バージョンはsemver形式（例: 1.0.0）である必要があります",
});

/**
 * 完全なマニフェストスキーマ
 */
const ExtensionManifestSchema = z
  .object({
    $schema: z.string().optional(),
    id: ExtensionIdSchema,
    name: z.string().min(1).max(100),
    version: SemverSchema,
    minAppVersion: SemverSchema,
    publisher: z.string().min(1).max(100),
    description: z.string().max(1000).optional(),
    license: z.string().max(50).optional(),
    repository: z.string().url().optional(),
    icon: z
      .string()
      .regex(/^[^/].*\.(png|jpg|svg)$/)
      .optional(),
    capabilities: ExtensionCapabilitiesSchema,
    contributes: ExtensionContributionsSchema,
  })
  .strict();

// =============================================================================
// パース/検証関数
// =============================================================================

/**
 * マニフェスト検証結果
 */
export interface ManifestValidationResult {
  success: boolean;
  manifest?: ExtensionManifest;
  errors?: ManifestValidationError[];
}

/**
 * マニフェスト検証エラー
 */
export interface ManifestValidationError {
  path: string;
  message: string;
}

/**
 * マニフェストをパースして検証
 */
export function parseManifest(data: unknown): ManifestValidationResult {
  const result = ExtensionManifestSchema.safeParse(data);

  if (result.success) {
    // 追加の検証: integrationの接続先がnetwork権限に含まれているか
    const manifest = result.data as ExtensionManifest;
    const additionalErrors = validateIntegrationEndpoints(manifest);

    if (additionalErrors.length > 0) {
      return {
        success: false,
        errors: additionalErrors,
      };
    }

    return {
      success: true,
      manifest,
    };
  }

  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}

/**
 * JSON文字列からマニフェストをパース
 */
export function parseManifestFromJson(
  jsonString: string,
): ManifestValidationResult {
  try {
    const data = JSON.parse(jsonString);
    return parseManifest(data);
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          path: "",
          message: `JSONのパースに失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
        },
      ],
    };
  }
}

/**
 * 連携の接続先がnetwork権限に含まれているか検証
 */
function validateIntegrationEndpoints(
  manifest: ExtensionManifest,
): ManifestValidationError[] {
  const errors: ManifestValidationError[] = [];
  const integrations = manifest.contributes.integrations || [];
  const allowedHosts = manifest.capabilities.network || [];

  for (const integration of integrations) {
    const endpointUrl = new URL(integration.endpoint);
    const endpointOrigin = endpointUrl.origin;

    const isAllowed = allowedHosts.some((allowed) => {
      try {
        const allowedUrl = new URL(allowed);
        return allowedUrl.origin === endpointOrigin;
      } catch {
        return false;
      }
    });

    if (!isAllowed) {
      errors.push({
        path: `contributes.integrations.${integration.id}.endpoint`,
        message: `連携先 "${integration.endpoint}" はcapabilities.networkで許可されていません。"${endpointOrigin}" を追加してください`,
      });
    }
  }

  return errors;
}

/**
 * バージョン比較（semver）
 * @returns -1: v1 < v2, 0: v1 === v2, 1: v1 > v2
 */
export function compareSemver(v1: string, v2: string): number {
  const parts1 = v1.split("-")[0].split(".").map(Number);
  const parts2 = v2.split("-")[0].split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }

  return 0;
}

/**
 * 拡張が指定のアプリバージョンと互換性があるか確認
 */
export function isCompatibleWithAppVersion(
  manifest: ExtensionManifest,
  appVersion: string,
): boolean {
  return compareSemver(manifest.minAppVersion, appVersion) <= 0;
}

// =============================================================================
// エクスポート（型ガード）
// =============================================================================

export function isCommandContribution(
  obj: unknown,
): obj is CommandContribution {
  return CommandContributionSchema.safeParse(obj).success;
}

export function isTemplateContribution(
  obj: unknown,
): obj is TemplateContribution {
  return TemplateContributionSchema.safeParse(obj).success;
}

export function isExporterContribution(
  obj: unknown,
): obj is ExporterContribution {
  return ExporterContributionSchema.safeParse(obj).success;
}

export function isIntegrationContribution(
  obj: unknown,
): obj is IntegrationContribution {
  return IntegrationContributionSchema.safeParse(obj).success;
}

export function isViewContribution(obj: unknown): obj is ViewContribution {
  return ViewContributionSchema.safeParse(obj).success;
}

// Re-export types for convenience
export type {
  ExtensionManifest,
  ExtensionCapabilities,
  ExtensionContributions,
  CommandContribution,
  TemplateContribution,
  ExporterContribution,
  IntegrationContribution,
  ViewContribution,
};
