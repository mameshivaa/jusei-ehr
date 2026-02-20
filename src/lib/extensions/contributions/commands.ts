/**
 * 拡張機能 - コマンド寄与点
 *
 * コマンドの登録、実行、コンテキストフィルタリング
 */

import type {
  CommandContribution,
  CommandContext,
  CommandExecutionContext,
  CommandHandler,
  CommandResult,
  InstalledExtension,
} from "../types";
import { extensionRegistry } from "../registry";
import { canExtensionAccess } from "../capabilities";
import { logExtensionCommandExecution } from "../audit-extension";
import {
  checkLicenseForExecution,
  resolveClinicId,
} from "../marketplace/license-enforcer";
import type { UserRole } from "@prisma/client";

// =============================================================================
// コマンドハンドラー管理
// =============================================================================

/**
 * 登録されたコマンドハンドラー
 */
const commandHandlers = new Map<string, CommandHandler>();

/**
 * コマンドハンドラーを登録
 *
 * @param commandId コマンドID（manifest.json の contributes.commands[].id）
 * @param handler ハンドラー関数
 */
export function registerCommandHandler(
  commandId: string,
  handler: CommandHandler,
): void {
  if (commandHandlers.has(commandId)) {
    console.warn(
      `コマンド "${commandId}" は既に登録されています。上書きします。`,
    );
  }
  commandHandlers.set(commandId, handler);
}

/**
 * コマンドハンドラーを削除
 */
export function unregisterCommandHandler(commandId: string): void {
  commandHandlers.delete(commandId);
}

/**
 * 全コマンドハンドラーをクリア（テスト用）
 */
export function clearAllCommandHandlers(): void {
  commandHandlers.clear();
}

// =============================================================================
// コマンド実行
// =============================================================================

/**
 * コマンド実行結果（拡張情報付き）
 */
export interface ExecuteCommandResult extends CommandResult {
  extensionId: string;
  commandId: string;
}

/**
 * コマンドを実行
 *
 * @param commandId 実行するコマンドのID
 * @param userId 実行ユーザーID
 * @param userRole 実行ユーザーのロール
 * @param context 現在のコンテキスト
 * @param entityId コンテキストに応じたエンティティID
 */
export async function executeCommand(
  commandId: string,
  userId: string,
  userRole: UserRole,
  context: CommandContext,
  entityId?: string,
): Promise<ExecuteCommandResult> {
  // コマンドを持つ拡張を探す
  const allCommands = extensionRegistry.getAllCommands();
  const commandInfo = allCommands.find((cmd) => cmd.id === commandId);

  if (!commandInfo) {
    return {
      success: false,
      message: `コマンド "${commandId}" は見つかりません`,
      extensionId: "",
      commandId,
    };
  }

  const extension = extensionRegistry.get(commandInfo.extensionId);
  if (!extension) {
    return {
      success: false,
      message: `拡張 "${commandInfo.extensionId}" は見つかりません`,
      extensionId: commandInfo.extensionId,
      commandId,
    };
  }

  // 拡張が有効かチェック
  if (extension.state !== "enabled") {
    return {
      success: false,
      message: `拡張 "${extension.manifest.name}" は有効ではありません`,
      extensionId: extension.manifest.id,
      commandId,
    };
  }

  // コンテキストチェック
  if (
    !commandInfo.context.includes(context) &&
    !commandInfo.context.includes("global")
  ) {
    return {
      success: false,
      message: `コマンド "${commandInfo.title}" はこの画面では実行できません`,
      extensionId: extension.manifest.id,
      commandId,
    };
  }

  // 必要な権限チェック
  if (commandInfo.requiredCapabilities) {
    const requiredCaps = commandInfo.requiredCapabilities;
    for (const [resource, actions] of Object.entries(requiredCaps)) {
      if (resource === "network") continue;
      for (const action of actions || []) {
        if (
          !canExtensionAccess(
            extension,
            resource as any,
            action as any,
            userRole,
          )
        ) {
          return {
            success: false,
            message: `このコマンドの実行には "${resource}" への "${action}" 権限が必要です`,
            extensionId: extension.manifest.id,
            commandId,
          };
        }
      }
    }
  }

  // ハンドラーを取得
  const handler = commandHandlers.get(commandId);
  if (!handler) {
    return {
      success: false,
      message: `コマンド "${commandId}" のハンドラーが登録されていません`,
      extensionId: extension.manifest.id,
      commandId,
    };
  }

  const clinicId = await resolveClinicId();
  if (!clinicId) {
    return {
      success: false,
      message: "クリニック情報が取得できないため、コマンドを実行できません",
      extensionId: extension.manifest.id,
      commandId,
    };
  }

  const licenseCheck = await checkLicenseForExecution(
    extension.manifest.id,
    clinicId,
  );
  if (!licenseCheck.allowed) {
    return {
      success: false,
      message: "ライセンスの検証に失敗したため、コマンドを実行できません",
      extensionId: extension.manifest.id,
      commandId,
    };
  }

  // 実行コンテキストを構築
  const executionContext: CommandExecutionContext = {
    userId,
    context,
    entityId,
    grantedCapabilities: extension.grantedCapabilities,
  };

  // 監査ログ
  await logExtensionCommandExecution(
    extension.manifest.id,
    extension.manifest.version,
    userId,
    commandId,
    context,
    entityId,
  );

  // ハンドラー実行
  try {
    const result = await handler(executionContext);
    return {
      ...result,
      extensionId: extension.manifest.id,
      commandId,
    };
  } catch (error) {
    return {
      success: false,
      message: `コマンド実行中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
      extensionId: extension.manifest.id,
      commandId,
    };
  }
}

// =============================================================================
// コマンド取得
// =============================================================================

/**
 * コンテキスト付きコマンド情報
 */
export interface ContextualCommand {
  id: string;
  title: string;
  icon?: string;
  extensionId: string;
  extensionName: string;
  keybinding?: string;
}

/**
 * 指定コンテキストで利用可能なコマンドを取得
 *
 * @param context 現在のコンテキスト
 * @param userRole ユーザーのロール（権限チェック用）
 */
export function getAvailableCommands(
  context: CommandContext,
  userRole: UserRole,
): ContextualCommand[] {
  const result: ContextualCommand[] = [];

  for (const ext of extensionRegistry.getEnabled()) {
    const commands = ext.manifest.contributes.commands || [];

    for (const cmd of commands) {
      // コンテキストチェック
      if (!cmd.context.includes(context) && !cmd.context.includes("global")) {
        continue;
      }

      // 権限チェック
      if (cmd.requiredCapabilities) {
        let hasAllPermissions = true;
        for (const [resource, actions] of Object.entries(
          cmd.requiredCapabilities,
        )) {
          if (resource === "network") continue;
          for (const action of actions || []) {
            if (
              !canExtensionAccess(ext, resource as any, action as any, userRole)
            ) {
              hasAllPermissions = false;
              break;
            }
          }
          if (!hasAllPermissions) break;
        }
        if (!hasAllPermissions) continue;
      }

      result.push({
        id: cmd.id,
        title: cmd.title,
        icon: cmd.icon,
        extensionId: ext.manifest.id,
        extensionName: ext.manifest.name,
        keybinding: cmd.keybinding,
      });
    }
  }

  return result;
}

/**
 * キーバインディングからコマンドを検索
 */
export function getCommandByKeybinding(
  keybinding: string,
  context: CommandContext,
  userRole: UserRole,
): ContextualCommand | undefined {
  const normalizedKeybinding = normalizeKeybinding(keybinding);
  const availableCommands = getAvailableCommands(context, userRole);

  return availableCommands.find(
    (cmd) =>
      cmd.keybinding &&
      normalizeKeybinding(cmd.keybinding) === normalizedKeybinding,
  );
}

/**
 * キーバインディングを正規化（大文字小文字、順序の正規化）
 */
function normalizeKeybinding(keybinding: string): string {
  const parts = keybinding.toLowerCase().split("+");
  const modifiers = parts.slice(0, -1).sort();
  const key = parts[parts.length - 1];
  return [...modifiers, key].join("+");
}

// =============================================================================
// ビルトインコマンド（アプリ本体が提供するコマンド）
// =============================================================================

/**
 * ビルトインコマンドを登録
 * アプリ起動時に呼び出す
 */
export function registerBuiltinCommands(): void {
  // 例: 印刷コマンド
  registerCommandHandler("app.print", async (ctx) => {
    // 実際の印刷処理はここに実装
    return {
      success: true,
      message: "印刷ダイアログを開きました",
    };
  });

  // 例: エクスポートコマンド
  registerCommandHandler("app.export", async (ctx) => {
    return {
      success: true,
      message: "エクスポートダイアログを開きました",
    };
  });
}
