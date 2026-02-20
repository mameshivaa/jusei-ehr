/**
 * Electron Preload Script
 * レンダラープロセスとメインプロセス間の安全な通信を提供
 */

import { contextBridge, ipcRenderer } from "electron";

// 更新情報の型定義
interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
}

interface DownloadProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

// レンダラープロセスに公開するAPI
const electronAPI = {
  // アプリ情報
  getAppVersion: (): Promise<string> => ipcRenderer.invoke("get-app-version"),

  // 更新関連
  checkForUpdates: (): Promise<{
    success: boolean;
    result?: unknown;
    error?: string;
  }> => ipcRenderer.invoke("check-for-updates"),

  downloadUpdate: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("download-update"),

  installUpdate: (): void => {
    ipcRenderer.invoke("install-update");
  },

  // 更新イベントリスナー
  onUpdateChecking: (callback: () => void): void => {
    ipcRenderer.on("update-checking", callback);
  },

  onUpdateAvailable: (callback: (info: UpdateInfo) => void): void => {
    ipcRenderer.on("update-available", (_, info) => callback(info));
  },

  onUpdateNotAvailable: (callback: () => void): void => {
    ipcRenderer.on("update-not-available", callback);
  },

  onUpdateDownloadProgress: (
    callback: (progress: DownloadProgress) => void,
  ): void => {
    ipcRenderer.on("update-download-progress", (_, progress) =>
      callback(progress),
    );
  },

  onUpdateDownloaded: (callback: (info: UpdateInfo) => void): void => {
    ipcRenderer.on("update-downloaded", (_, info) => callback(info));
  },

  onUpdateError: (callback: (error: string) => void): void => {
    ipcRenderer.on("update-error", (_, error) => callback(error));
  },

  // イベントリスナー削除
  removeAllUpdateListeners: (): void => {
    ipcRenderer.removeAllListeners("update-checking");
    ipcRenderer.removeAllListeners("update-available");
    ipcRenderer.removeAllListeners("update-not-available");
    ipcRenderer.removeAllListeners("update-download-progress");
    ipcRenderer.removeAllListeners("update-downloaded");
    ipcRenderer.removeAllListeners("update-error");
  },

  // ダイアログ
  showMessageBox: (
    options: Electron.MessageBoxOptions,
  ): Promise<Electron.MessageBoxReturnValue | null> =>
    ipcRenderer.invoke("show-message-box", options),

  showOpenDialog: (
    options: Electron.OpenDialogOptions,
  ): Promise<Electron.OpenDialogReturnValue | null> =>
    ipcRenderer.invoke("show-open-dialog", options),

  showSaveDialog: (
    options: Electron.SaveDialogOptions,
  ): Promise<Electron.SaveDialogReturnValue | null> =>
    ipcRenderer.invoke("show-save-dialog", options),

  saveFile: (payload: {
    filePath: string;
    data: ArrayBuffer;
  }): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("save-file", payload),

  restartApp: (): void => {
    ipcRenderer.invoke("restart-app");
  },

  // セットアップ文書読了通知
  notifyOpsDocRead: (): void => {
    ipcRenderer.send("setup:ops-doc-read");
  },
  onOpsDocRead: (callback: () => void): void => {
    ipcRenderer.on("setup:ops-doc-read", callback);
  },

  // プラットフォーム情報
  platform: process.platform,
  isElectron: true,
};

// windowオブジェクトにAPIを公開
contextBridge.exposeInMainWorld("electronAPI", electronAPI);

// 型定義はsrc/types/electron.d.tsで定義
