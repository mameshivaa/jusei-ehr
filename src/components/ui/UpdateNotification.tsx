"use client";

/**
 * UpdateNotification Component
 * デスクトップアプリの自動更新通知UI
 */

import { useEffect, useState, useCallback } from "react";
import {
  updateManager,
  isElectron,
  type UpdateState,
} from "@/lib/electron/update-manager";
import {
  X,
  Download,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";

export function UpdateNotification() {
  const [state, setState] = useState<UpdateState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [appVersion, setAppVersion] = useState<string>("");

  useEffect(() => {
    if (!isElectron()) return;

    // 更新マネージャー初期化
    updateManager.initialize();
    setState(updateManager.getState());

    // 状態変更を購読
    const unsubscribe = updateManager.subscribe(setState);

    // アプリバージョン取得
    updateManager.getAppVersion().then(setAppVersion);

    return () => {
      unsubscribe();
    };
  }, []);

  const handleCheckUpdate = useCallback(() => {
    updateManager.checkForUpdates();
    setDismissed(false);
  }, []);

  const handleDownload = useCallback(() => {
    updateManager.downloadUpdate();
  }, []);

  const handleInstall = useCallback(() => {
    updateManager.installUpdate();
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  // Electron環境でない、または状態がない場合は何も表示しない
  if (!isElectron() || !state) {
    return null;
  }

  // 非表示にした場合、または特に表示するものがない場合
  if (
    dismissed ||
    state.status === "idle" ||
    state.status === "not-available"
  ) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-white shadow-lg dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-start justify-between p-4">
        <div className="flex-1">
          {/* 更新チェック中 */}
          {state.status === "checking" && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">更新を確認中...</span>
            </div>
          )}

          {/* 更新利用可能 */}
          {state.status === "available" && state.updateInfo && (
            <div>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Download className="h-4 w-4" />
                <span className="font-medium text-sm">
                  新しいバージョンがあります
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                v{appVersion} → v{state.updateInfo.version}
              </p>
              {state.updateInfo.releaseNotes && (
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                  {state.updateInfo.releaseNotes}
                </p>
              )}
              <button
                onClick={handleDownload}
                className="mt-3 w-full rounded bg-slate-600 px-3 py-1.5 text-sm text-white hover:bg-slate-700 transition-colors"
              >
                ダウンロード
              </button>
            </div>
          )}

          {/* ダウンロード中 */}
          {state.status === "downloading" && state.downloadProgress && (
            <div>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="font-medium text-sm">ダウンロード中...</span>
              </div>
              <div className="mt-2">
                <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-2 rounded-full bg-slate-600 transition-all"
                    style={{ width: `${state.downloadProgress.percent}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {Math.round(state.downloadProgress.percent)}% 完了
                </p>
              </div>
            </div>
          )}

          {/* ダウンロード完了 */}
          {state.status === "downloaded" && (
            <div>
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium text-sm">更新の準備完了</span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                再起動すると更新が適用されます
              </p>
              <button
                onClick={handleInstall}
                className="mt-3 w-full rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 transition-colors"
              >
                再起動して更新
              </button>
            </div>
          )}

          {/* エラー */}
          {state.status === "error" && (
            <div>
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium text-sm">更新エラー</span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {state.error || "更新の確認中にエラーが発生しました"}
              </p>
              <button
                onClick={handleCheckUpdate}
                className="mt-3 flex w-full items-center justify-center gap-1 rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 transition-colors dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                <RefreshCw className="h-3 w-3" />
                再試行
              </button>
            </div>
          )}
        </div>

        {/* 閉じるボタン */}
        {state.status !== "checking" && state.status !== "downloading" && (
          <button
            onClick={handleDismiss}
            className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * 設定画面用の更新チェックコンポーネント
 */
export function UpdateChecker() {
  const [state, setState] = useState<UpdateState | null>(null);
  const [appVersion, setAppVersion] = useState<string>("");
  const [isElectronEnv, setIsElectronEnv] = useState(false);

  useEffect(() => {
    const electronEnv = isElectron();
    setIsElectronEnv(electronEnv);

    if (!electronEnv) return;

    updateManager.initialize();
    setState(updateManager.getState());

    const unsubscribe = updateManager.subscribe(setState);
    updateManager.getAppVersion().then(setAppVersion);

    return () => {
      unsubscribe();
    };
  }, []);

  const handleCheckUpdate = useCallback(() => {
    updateManager.checkForUpdates();
  }, []);

  // Web版の場合
  if (!isElectronEnv) {
    return (
      <div className="rounded-lg border p-4 bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">
          バージョン情報
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Web版では自動更新機能は利用できません。
        </p>
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          デスクトップアプリ版をご利用ください。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 bg-white dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            バージョン情報
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            現在のバージョン: v{appVersion || "読み込み中..."}
          </p>
        </div>

        <button
          onClick={handleCheckUpdate}
          disabled={
            state?.status === "checking" || state?.status === "downloading"
          }
          className="flex items-center gap-2 rounded-lg bg-slate-600 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {state?.status === "checking" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              確認中...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              更新を確認
            </>
          )}
        </button>
      </div>

      {/* 更新ステータス表示 */}
      {state && state.status !== "idle" && state.status !== "checking" && (
        <div className="mt-4 pt-4 border-t dark:border-gray-700">
          {state.status === "available" && state.updateInfo && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  新バージョン v{state.updateInfo.version} が利用可能です
                </p>
                {state.updateInfo.releaseNotes && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {state.updateInfo.releaseNotes}
                  </p>
                )}
              </div>
              <button
                onClick={() => updateManager.downloadUpdate()}
                className="rounded bg-slate-600 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
              >
                ダウンロード
              </button>
            </div>
          )}

          {state.status === "not-available" && (
            <p className="text-sm text-green-600 dark:text-green-400">
              ✓ 最新バージョンです
            </p>
          )}

          {state.status === "downloading" && state.downloadProgress && (
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                ダウンロード中: {Math.round(state.downloadProgress.percent)}%
              </p>
              <div className="mt-2 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-2 rounded-full bg-slate-600 transition-all"
                  style={{ width: `${state.downloadProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {state.status === "downloaded" && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-green-600 dark:text-green-400">
                更新の準備完了
              </p>
              <button
                onClick={() => updateManager.installUpdate()}
                className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
              >
                再起動して更新
              </button>
            </div>
          )}

          {state.status === "error" && (
            <p className="text-sm text-red-600 dark:text-red-400">
              エラー: {state.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
