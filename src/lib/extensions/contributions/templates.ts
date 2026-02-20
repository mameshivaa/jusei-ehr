/**
 * 拡張機能 - テンプレート寄与点
 *
 * 印刷/出力テンプレートの管理
 * シンプルなテンプレートエンジン（Mustache風）を内蔵
 */

import "server-only";

import type { TemplateContribution, InstalledExtension } from "../types";
import { extensionRegistry } from "../registry";
import { canExtensionAccess } from "../capabilities";
import type { UserRole } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  checkLicenseForRender,
  resolveClinicId,
} from "../marketplace/license-enforcer";

// =============================================================================
// シンプルテンプレートエンジン
// =============================================================================

/**
 * テンプレートのコンパイル済みキャッシュ
 */
const compiledTemplates = new Map<string, CompiledTemplate>();

type CompiledTemplate = (data: Record<string, unknown>) => string;

/**
 * 組み込みヘルパー関数
 */
const templateHelpers: Record<string, (...args: unknown[]) => string> = {
  formatDate: (date: unknown, format?: unknown) => {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : (date as Date);
    if (isNaN(d.getTime())) return "";
    const fmt = typeof format === "string" ? format : "yyyy/MM/dd";
    return formatDateString(d, fmt);
  },

  formatGender: (gender: unknown) => {
    switch (gender) {
      case "MALE":
        return "男性";
      case "FEMALE":
        return "女性";
      case "OTHER":
        return "その他";
      default:
        return String(gender || "");
    }
  },

  calculateAge: (birthDate: unknown) => {
    if (!birthDate) return "";
    const birth =
      typeof birthDate === "string" ? new Date(birthDate) : (birthDate as Date);
    if (isNaN(birth.getTime())) return "";
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }
    return String(age);
  },

  formatCurrency: (amount: unknown) => {
    if (typeof amount !== "number") return "";
    return `¥${amount.toLocaleString()}`;
  },
};

/**
 * 日付文字列フォーマット
 */
function formatDateString(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return format
    .replace("yyyy", String(year))
    .replace("MM", month)
    .replace("dd", day)
    .replace("HH", hours)
    .replace("mm", minutes);
}

/**
 * シンプルなテンプレートエンジン
 * Mustache風の構文をサポート:
 * - {{variable}} - 変数展開（HTMLエスケープ）
 * - {{{variable}}} - 変数展開（エスケープなし）
 * - {{helper arg1 arg2}} - ヘルパー関数呼び出し
 * - {{#if condition}}...{{/if}} - 条件分岐
 * - {{#each array}}...{{/each}} - ループ
 */
function compileTemplate(template: string): CompiledTemplate {
  return (data: Record<string, unknown>): string => {
    let result = template;

    // {{#each array}}...{{/each}} 処理
    result = result.replace(
      /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
      (_, arrayName, content) => {
        const array = data[arrayName];
        if (!Array.isArray(array)) return "";
        return array
          .map((item, index) => {
            // 配列アイテム用のコンテキストを作成
            const itemContext = {
              ...data,
              this: item,
              "@index": index,
              "@first": index === 0,
              "@last": index === array.length - 1,
              ...(typeof item === "object" && item !== null ? item : {}),
            };
            return compileTemplate(content)(
              itemContext as Record<string, unknown>,
            );
          })
          .join("");
      },
    );

    // {{#if condition}}...{{/if}} 処理
    result = result.replace(
      /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (_, conditionName, content) => {
        const condition = data[conditionName];
        if (condition) {
          return compileTemplate(content)(data);
        }
        return "";
      },
    );

    // {{{variable}}} 処理（エスケープなし）
    result = result.replace(/\{\{\{(\w+)\}\}\}/g, (_, varName) => {
      const value = data[varName];
      return value !== undefined && value !== null ? String(value) : "";
    });

    // {{helper arg1 arg2}} 処理
    result = result.replace(
      /\{\{(\w+)\s+([^}]+)\}\}/g,
      (_, helperName, argsStr) => {
        const helper = templateHelpers[helperName];
        if (helper) {
          // 引数をパース（スペース区切り、引用符考慮）
          const args = parseHelperArgs(argsStr, data);
          return helper(...args);
        }
        // ヘルパーでない場合は変数として処理
        return "";
      },
    );

    // {{variable}} 処理（HTMLエスケープ）
    result = result.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
      const value = data[varName];
      if (value === undefined || value === null) return "";
      return escapeHtml(String(value));
    });

    return result;
  };
}

/**
 * ヘルパー引数をパース
 */
function parseHelperArgs(
  argsStr: string,
  data: Record<string, unknown>,
): unknown[] {
  const args: unknown[] = [];
  const tokens = argsStr.trim().split(/\s+/);

  for (const token of tokens) {
    if (token.startsWith('"') && token.endsWith('"')) {
      // 文字列リテラル
      args.push(token.slice(1, -1));
    } else if (token.startsWith("'") && token.endsWith("'")) {
      // 文字列リテラル（シングルクォート）
      args.push(token.slice(1, -1));
    } else if (!isNaN(Number(token))) {
      // 数値
      args.push(Number(token));
    } else {
      // 変数参照
      args.push(data[token]);
    }
  }

  return args;
}

/**
 * HTMLエスケープ
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// =============================================================================
// テンプレート取得
// =============================================================================

/**
 * コンテキスト付きテンプレート情報
 */
export interface ContextualTemplate {
  id: string;
  name: string;
  type: "print" | "export" | "report";
  extensionId: string;
  extensionName: string;
  description?: string;
}

/**
 * 指定エンティティ用のテンプレートを取得
 *
 * @param targetEntity 対象エンティティ
 * @param userRole ユーザーのロール
 * @param type テンプレートの種類（オプション）
 */
export function getAvailableTemplates(
  targetEntity: "patient" | "chart" | "visit" | "treatmentRecord",
  userRole: UserRole,
  type?: "print" | "export" | "report",
): ContextualTemplate[] {
  const result: ContextualTemplate[] = [];

  for (const ext of extensionRegistry.getEnabled()) {
    const templates = ext.manifest.contributes.templates || [];

    for (const tpl of templates) {
      // エンティティチェック
      if (tpl.targetEntity !== targetEntity) {
        continue;
      }

      // 種類チェック
      if (type && tpl.type !== type) {
        continue;
      }

      // 権限チェック（対象エンティティの読み取り権限が必要）
      const resourceMap: Record<
        string,
        "patient" | "chart" | "visit" | "treatmentRecord"
      > = {
        patient: "patient",
        chart: "chart",
        visit: "visit",
        treatmentRecord: "treatmentRecord",
      };
      const resource = resourceMap[targetEntity];
      if (!canExtensionAccess(ext, resource, "read", userRole)) {
        continue;
      }

      result.push({
        id: tpl.id,
        name: tpl.name,
        type: tpl.type,
        extensionId: ext.manifest.id,
        extensionName: ext.manifest.name,
        description: tpl.description,
      });
    }
  }

  return result;
}

// =============================================================================
// テンプレートレンダリング
// =============================================================================

/**
 * テンプレートレンダリング結果
 */
export interface RenderResult {
  success: boolean;
  html?: string;
  error?: string;
}

/**
 * テンプレートをレンダリング
 *
 * @param templateId テンプレートID
 * @param data レンダリングに使用するデータ
 * @param userId 実行ユーザーID
 * @param userRole ユーザーのロール
 */
export async function renderTemplate(
  templateId: string,
  data: Record<string, unknown>,
  userId: string,
  userRole: UserRole,
): Promise<RenderResult> {
  // テンプレートを持つ拡張を探す
  const allTemplates = extensionRegistry.getAllTemplates();
  const templateInfo = allTemplates.find((tpl) => tpl.id === templateId);

  if (!templateInfo) {
    return {
      success: false,
      error: `テンプレート "${templateId}" は見つかりません`,
    };
  }

  const extension = extensionRegistry.get(templateInfo.extensionId);
  if (!extension) {
    return {
      success: false,
      error: `拡張 "${templateInfo.extensionId}" は見つかりません`,
    };
  }

  // 拡張が有効かチェック
  if (extension.state !== "enabled") {
    return {
      success: false,
      error: `拡張 "${extension.manifest.name}" は有効ではありません`,
    };
  }

  // 権限チェック
  const resourceMap: Record<
    string,
    "patient" | "chart" | "visit" | "treatmentRecord"
  > = {
    patient: "patient",
    chart: "chart",
    visit: "visit",
    treatmentRecord: "treatmentRecord",
  };
  const resource = resourceMap[templateInfo.targetEntity];
  if (!canExtensionAccess(extension, resource, "read", userRole)) {
    return {
      success: false,
      error: `このテンプレートの使用には "${templateInfo.targetEntity}" への読み取り権限が必要です`,
    };
  }

  const clinicId = await resolveClinicId();
  if (!clinicId) {
    return {
      success: false,
      error: "クリニック情報が取得できないため、テンプレートを使用できません",
    };
  }

  const licenseCheck = await checkLicenseForRender(
    extension.manifest.id,
    clinicId,
  );
  if (!licenseCheck.allowed) {
    return {
      success: false,
      error: "ライセンスの検証に失敗したため、テンプレートを使用できません",
    };
  }

  // テンプレートをロード
  const templateContent = await loadTemplateContent(
    extension,
    templateInfo.file,
  );
  if (!templateContent) {
    return {
      success: false,
      error: `テンプレートファイル "${templateInfo.file}" の読み込みに失敗しました`,
    };
  }

  // テンプレートをコンパイル（キャッシュ）
  const cacheKey = `${extension.manifest.id}:${templateInfo.id}:${extension.manifest.version}`;
  let compiled = compiledTemplates.get(cacheKey);
  if (!compiled) {
    try {
      compiled = compileTemplate(templateContent);
      compiledTemplates.set(cacheKey, compiled);
    } catch (error) {
      return {
        success: false,
        error: `テンプレートのコンパイルに失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
      };
    }
  }

  // レンダリング
  try {
    const html = compiled(data);
    return {
      success: true,
      html,
    };
  } catch (error) {
    return {
      success: false,
      error: `テンプレートのレンダリングに失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    };
  }
}

/**
 * テンプレートファイルを読み込む
 * TODO: 実際のファイルシステムからの読み込みを実装
 */
async function loadTemplateContent(
  extension: InstalledExtension,
  filePath: string,
): Promise<string | null> {
  // 1) 拡張パッケージ（extension.path）から安全に読み込む（本番想定）
  //    - path traversal を防ぐため、extension.path配下に収まることを検証する
  try {
    const baseDir = path.resolve(extension.path);
    const resolved = path.resolve(baseDir, filePath);
    if (!resolved.startsWith(baseDir + path.sep)) {
      return null;
    }
    return await readFile(resolved, "utf-8");
  } catch {
    // fallthrough
  }

  // 2) 開発段階では、組み込みテンプレートを返す（PoC向け）
  const builtinTemplates: Record<string, string> = {
    "templates/patient-info.html": `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>患者情報</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    h1 { font-size: 24px; margin-bottom: 20px; }
    .info-row { display: flex; margin-bottom: 8px; }
    .label { width: 100px; font-weight: bold; }
    .value { flex: 1; }
  </style>
</head>
<body>
  <h1>患者情報</h1>
  <div class="info-row">
    <span class="label">氏名:</span>
    <span class="value">{{name}}</span>
  </div>
  <div class="info-row">
    <span class="label">フリガナ:</span>
    <span class="value">{{kana}}</span>
  </div>
  <div class="info-row">
    <span class="label">生年月日:</span>
    <span class="value">{{formatDate birthDate "yyyy/MM/dd"}} ({{calculateAge birthDate}}歳)</span>
  </div>
  <div class="info-row">
    <span class="label">性別:</span>
    <span class="value">{{formatGender gender}}</span>
  </div>
</body>
</html>
    `,
  };

  return builtinTemplates[filePath] || null;
}

/**
 * テンプレートキャッシュをクリア
 */
export function clearTemplateCache(): void {
  compiledTemplates.clear();
}

/**
 * カスタムヘルパーを登録
 */
export function registerTemplateHelper(
  name: string,
  fn: (...args: unknown[]) => string,
): void {
  templateHelpers[name] = fn;
}
