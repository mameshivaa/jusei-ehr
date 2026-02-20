/**
 * Electron API 型定義
 * window.electronAPI の型安全性を提供
 */

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
}

export interface DownloadProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export interface MessageBoxOptions {
  type?: "none" | "info" | "error" | "question" | "warning";
  buttons?: string[];
  defaultId?: number;
  title?: string;
  message: string;
  detail?: string;
  checkboxLabel?: string;
  checkboxChecked?: boolean;
  cancelId?: number;
  noLink?: boolean;
}

export interface MessageBoxReturnValue {
  response: number;
  checkboxChecked: boolean;
}

export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  properties?: Array<
    | "openFile"
    | "openDirectory"
    | "multiSelections"
    | "showHiddenFiles"
    | "createDirectory"
    | "promptToCreate"
    | "noResolveAliases"
    | "treatPackageAsDirectory"
    | "dontAddToRecent"
  >;
  message?: string;
}

export interface OpenDialogReturnValue {
  canceled: boolean;
  filePaths: string[];
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  message?: string;
  nameFieldLabel?: string;
  showsTagField?: boolean;
  properties?: Array<
    | "showHiddenFiles"
    | "createDirectory"
    | "treatPackageAsDirectory"
    | "showOverwriteConfirmation"
    | "dontAddToRecent"
  >;
}

export interface SaveDialogReturnValue {
  canceled: boolean;
  filePath?: string;
}

export interface ElectronAPI {
  // アプリ情報
  getAppVersion: () => Promise<string>;

  // 更新関連
  checkForUpdates: () => Promise<{
    success: boolean;
    result?: unknown;
    error?: string;
  }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => void;

  // 更新イベントリスナー
  onUpdateChecking: (callback: () => void) => void;
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => void;
  onUpdateNotAvailable: (callback: () => void) => void;
  onUpdateDownloadProgress: (
    callback: (progress: DownloadProgress) => void,
  ) => void;
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => void;
  onUpdateError: (callback: (error: string) => void) => void;
  removeAllUpdateListeners: () => void;

  // ダイアログ
  showMessageBox: (
    options: MessageBoxOptions,
  ) => Promise<MessageBoxReturnValue | null>;
  showOpenDialog: (
    options: OpenDialogOptions,
  ) => Promise<OpenDialogReturnValue | null>;
  showSaveDialog: (
    options: SaveDialogOptions,
  ) => Promise<SaveDialogReturnValue | null>;
  saveFile: (payload: {
    filePath: string;
    data: ArrayBuffer;
  }) => Promise<{ success: boolean; error?: string }>;
  restartApp: () => void;

  // セットアップ文書読了通知
  notifyOpsDocRead: () => void;
  onOpsDocRead: (callback: () => void) => void;

  // プラットフォーム情報
  platform: NodeJS.Platform;
  isElectron: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
