/**
 * 拡張機能 - ローダー
 *
 * extensions/ ディレクトリ配下の拡張を読み込み、
 * レジストリに登録する
 */

import "server-only";

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { extensionRegistry } from "./registry";
import { parseManifestFromJson } from "./manifest";
import type { ExtensionCapabilities, InstalledExtension } from "./types";
import { validateAllLicenses } from "./marketplace/license-enforcer";

// =============================================================================
// 設定
// =============================================================================

/**
 * 拡張ディレクトリのベースパス
 * プロジェクトルートの extensions/ を参照
 */
function getExtensionsBasePath(): string {
  // Next.js環境では process.cwd() がプロジェクトルート
  return path.join(process.cwd(), "extensions");
}

/**
 * 永続化ファイルのパス（有効化状態・権限を保存）
 */
function getExtensionStatePath(): string {
  return path.join(process.cwd(), "extensions", ".extension-state.json");
}

// =============================================================================
// 永続化状態の型
// =============================================================================

interface PersistedExtensionState {
  /** 拡張ID */
  extensionId: string;
  /** 有効化されているか */
  enabled: boolean;
  /** 付与された権限 */
  grantedCapabilities: ExtensionCapabilities;
  /** 有効化日時 */
  enabledAt?: string;
}

interface PersistedState {
  version: number;
  extensions: PersistedExtensionState[];
}

// =============================================================================
// ローダー関数
// =============================================================================

/**
 * 拡張をディスカバリーして一覧を返す
 * （インストールはしない、情報取得のみ）
 */
export async function discoverExtensions(): Promise<DiscoveredExtension[]> {
  const basePath = getExtensionsBasePath();
  const discovered: DiscoveredExtension[] = [];

  try {
    const entries = await readdir(basePath, { withFileTypes: true });

    for (const entry of entries) {
      // ディレクトリのみ、隠しディレクトリは除外
      if (!entry.isDirectory() || entry.name.startsWith(".")) {
        continue;
      }

      const extensionPath = path.join(basePath, entry.name);
      const manifestPath = path.join(extensionPath, "manifest.json");

      try {
        // manifest.json の存在確認
        await stat(manifestPath);

        // manifest.json を読み込み・パース
        const manifestContent = await readFile(manifestPath, "utf-8");
        const parseResult = parseManifestFromJson(manifestContent);

        if (parseResult.success && parseResult.manifest) {
          discovered.push({
            path: extensionPath,
            manifest: parseResult.manifest,
            valid: true,
          });
        } else {
          discovered.push({
            path: extensionPath,
            valid: false,
            errors: parseResult.errors?.map((e) => e.message) || [
              "不明なエラー",
            ],
          });
        }
      } catch (error) {
        // manifest.json が存在しない、または読み込めない
        discovered.push({
          path: extensionPath,
          valid: false,
          errors: [
            `manifest.json の読み込みに失敗: ${error instanceof Error ? error.message : "不明なエラー"}`,
          ],
        });
      }
    }
  } catch (error) {
    // extensions/ ディレクトリが存在しない場合は空配列
    console.warn(
      `拡張ディレクトリの読み込みに失敗: ${error instanceof Error ? error.message : "不明なエラー"}`,
    );
  }

  return discovered;
}

/**
 * 全拡張をロードしてレジストリに登録
 *
 * @param systemUserId システム操作として記録するユーザーID
 */
export async function loadAllExtensions(
  systemUserId: string = "system",
): Promise<LoadResult> {
  const result: LoadResult = {
    loaded: [],
    failed: [],
  };

  // 1. 拡張をディスカバリー
  const discovered = await discoverExtensions();

  // 2. 永続化状態を読み込み
  const persistedState = await loadPersistedState();
  const stateMap = new Map(
    persistedState.extensions.map((s) => [s.extensionId, s]),
  );

  // 3. 有効な拡張をレジストリに登録
  for (const ext of discovered) {
    if (!ext.valid || !ext.manifest) {
      result.failed.push({
        path: ext.path,
        errors: ext.errors || ["マニフェストが無効"],
      });
      continue;
    }

    // インストール
    const installResult = await extensionRegistry.install(
      ext.manifest,
      ext.path,
      systemUserId,
    );

    if (!installResult.success) {
      result.failed.push({
        path: ext.path,
        errors: installResult.errors?.map((e) => e.message) || [
          "インストール失敗",
        ],
      });
      continue;
    }

    // 永続化状態があれば適用
    const persisted = stateMap.get(ext.manifest.id);
    if (persisted) {
      // 権限を付与
      if (Object.keys(persisted.grantedCapabilities).length > 0) {
        await extensionRegistry.grantCapabilities(
          ext.manifest.id,
          persisted.grantedCapabilities,
          systemUserId,
        );
      }

      // 有効化
      if (persisted.enabled) {
        await extensionRegistry.enable(ext.manifest.id, systemUserId);
      }
    }

    result.loaded.push({
      extensionId: ext.manifest.id,
      name: ext.manifest.name,
      version: ext.manifest.version,
      enabled: persisted?.enabled || false,
    });
  }

  return result;
}

/**
 * 拡張の状態を永続化
 */
export async function persistExtensionState(): Promise<void> {
  const extensions = extensionRegistry.getAll();
  const state: PersistedState = {
    version: 1,
    extensions: extensions.map((ext) => ({
      extensionId: ext.manifest.id,
      enabled: ext.state === "enabled",
      grantedCapabilities: ext.grantedCapabilities,
      enabledAt: ext.enabledAt?.toISOString(),
    })),
  };

  const statePath = getExtensionStatePath();
  const { writeFile, mkdir } = await import("node:fs/promises");

  try {
    await mkdir(path.dirname(statePath), { recursive: true });
    await writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
  } catch (error) {
    console.error(
      `拡張状態の永続化に失敗: ${error instanceof Error ? error.message : "不明なエラー"}`,
    );
  }
}

/**
 * 永続化状態を読み込み
 */
async function loadPersistedState(): Promise<PersistedState> {
  const statePath = getExtensionStatePath();

  try {
    const content = await readFile(statePath, "utf-8");
    const state = JSON.parse(content) as PersistedState;

    // バージョンチェック（将来のマイグレーション用）
    if (state.version !== 1) {
      console.warn(`拡張状態のバージョンが不明: ${state.version}`);
      return { version: 1, extensions: [] };
    }

    return state;
  } catch {
    // ファイルが存在しない場合は空の状態を返す
    return { version: 1, extensions: [] };
  }
}

/**
 * 拡張を有効化して永続化
 */
export async function enableExtensionAndPersist(
  extensionId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const result = await extensionRegistry.enable(extensionId, userId);
  if (result.success) {
    await persistExtensionState();
  }
  return result;
}

/**
 * 拡張を無効化して永続化
 */
export async function disableExtensionAndPersist(
  extensionId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const result = await extensionRegistry.disable(extensionId, userId);
  if (result.success) {
    await persistExtensionState();
  }
  return result;
}

/**
 * 拡張に権限を付与して永続化
 */
export async function grantCapabilitiesAndPersist(
  extensionId: string,
  capabilities: ExtensionCapabilities,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const result = await extensionRegistry.grantCapabilities(
    extensionId,
    capabilities,
    userId,
  );
  if (result.success) {
    await persistExtensionState();
  }
  return result;
}

/**
 * 拡張の権限を剥奪して永続化
 */
export async function revokeCapabilitiesAndPersist(
  extensionId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const result = await extensionRegistry.revokeCapabilities(
    extensionId,
    userId,
  );
  if (result.success) {
    await persistExtensionState();
  }
  return result;
}

// =============================================================================
// 型定義
// =============================================================================

export interface DiscoveredExtension {
  /** 拡張ディレクトリのパス */
  path: string;
  /** マニフェストが有効か */
  valid: boolean;
  /** パース済みマニフェスト（valid === true の場合のみ） */
  manifest?: InstalledExtension["manifest"];
  /** エラーメッセージ（valid === false の場合） */
  errors?: string[];
}

export interface LoadResult {
  /** ロード成功した拡張 */
  loaded: Array<{
    extensionId: string;
    name: string;
    version: string;
    enabled: boolean;
  }>;
  /** ロード失敗した拡張 */
  failed: Array<{
    path: string;
    errors: string[];
  }>;
}

// =============================================================================
// 初期化（アプリ起動時に呼び出す）
// =============================================================================

let initialized = false;

/**
 * 拡張システムを初期化
 * アプリ起動時に一度だけ呼び出す
 */
export async function initializeExtensions(
  systemUserId: string = "system",
): Promise<LoadResult> {
  if (initialized) {
    console.warn("拡張システムは既に初期化されています");
    return { loaded: [], failed: [] };
  }

  const result = await loadAllExtensions(systemUserId);

  await validateAllLicenses();

  initialized = true;

  console.log(
    `拡張システム初期化完了: ${result.loaded.length}件ロード, ${result.failed.length}件失敗`,
  );

  return result;
}

/**
 * 初期化状態をリセット（テスト用）
 */
export function _resetInitialized(): void {
  initialized = false;
}
