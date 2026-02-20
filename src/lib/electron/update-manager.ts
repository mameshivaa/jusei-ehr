/**
 * Electron Update Manager
 * 自動更新機能のクライアントサイド管理
 */

import type {
  UpdateInfo,
  DownloadProgress,
  ElectronAPI,
} from "@/types/electron";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface UpdateState {
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  downloadProgress: DownloadProgress | null;
  error: string | null;
}

type UpdateListener = (state: UpdateState) => void;

/**
 * Electron環境かどうかを判定
 */
export function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.electronAPI?.isElectron;
}

/**
 * ElectronAPIを取得（型安全）
 */
export function getElectronAPI(): ElectronAPI | null {
  if (isElectron()) {
    return window.electronAPI ?? null;
  }
  return null;
}

/**
 * 更新状態管理クラス
 */
class UpdateManager {
  private state: UpdateState = {
    status: "idle",
    updateInfo: null,
    downloadProgress: null,
    error: null,
  };

  private listeners: Set<UpdateListener> = new Set();
  private initialized = false;

  /**
   * 初期化（イベントリスナー設定）
   */
  initialize(): void {
    if (this.initialized || !isElectron()) {
      return;
    }

    const api = getElectronAPI();
    if (!api) return;

    // 更新チェック中
    api.onUpdateChecking(() => {
      this.updateState({ status: "checking", error: null });
    });

    // 更新利用可能
    api.onUpdateAvailable((info) => {
      this.updateState({
        status: "available",
        updateInfo: info,
        error: null,
      });
    });

    // 更新なし
    api.onUpdateNotAvailable(() => {
      this.updateState({ status: "not-available", error: null });
    });

    // ダウンロード進捗
    api.onUpdateDownloadProgress((progress) => {
      this.updateState({
        status: "downloading",
        downloadProgress: progress,
      });
    });

    // ダウンロード完了
    api.onUpdateDownloaded((info) => {
      this.updateState({
        status: "downloaded",
        updateInfo: info,
        downloadProgress: null,
      });
    });

    // エラー
    api.onUpdateError((error) => {
      this.updateState({
        status: "error",
        error,
      });
    });

    this.initialized = true;
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    const api = getElectronAPI();
    if (api) {
      api.removeAllUpdateListeners();
    }
    this.listeners.clear();
    this.initialized = false;
  }

  /**
   * 状態を更新し、リスナーに通知
   */
  private updateState(partial: Partial<UpdateState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener(this.state));
  }

  /**
   * 現在の状態を取得
   */
  getState(): UpdateState {
    return this.state;
  }

  /**
   * 状態変更リスナーを追加
   */
  subscribe(listener: UpdateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 更新チェック
   */
  async checkForUpdates(): Promise<void> {
    const api = getElectronAPI();
    if (!api) {
      console.warn("Not running in Electron environment");
      return;
    }

    this.updateState({ status: "checking", error: null });

    const result = await api.checkForUpdates();
    if (!result.success && result.error) {
      this.updateState({ status: "error", error: result.error });
    }
  }

  /**
   * 更新ダウンロード
   */
  async downloadUpdate(): Promise<void> {
    const api = getElectronAPI();
    if (!api) return;

    const result = await api.downloadUpdate();
    if (!result.success && result.error) {
      this.updateState({ status: "error", error: result.error });
    }
  }

  /**
   * 更新インストール（再起動）
   */
  installUpdate(): void {
    const api = getElectronAPI();
    if (!api) return;

    api.installUpdate();
  }

  /**
   * アプリバージョン取得
   */
  async getAppVersion(): Promise<string> {
    const api = getElectronAPI();
    if (!api) return "web";

    return api.getAppVersion();
  }
}

// シングルトンインスタンス
export const updateManager = new UpdateManager();
