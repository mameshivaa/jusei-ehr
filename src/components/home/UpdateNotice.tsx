"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isElectron,
  updateManager,
  type UpdateState,
} from "@/lib/electron/update-manager";
import AccessibleModal from "@/components/ui/AccessibleModal";

function formatPercent(value: number | null | undefined): string | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return `${Math.round(value)}%`;
}

const isDev = process.env.NODE_ENV === "development";

export function UpdateNotice() {
  const [isClient, setIsClient] = useState(false);
  const [state, setState] = useState<UpdateState | null>(null);
  const [appVersion, setAppVersion] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mockState, setMockState] = useState<UpdateState | null>(null);
  const [mockVersion, setMockVersion] = useState("1.2.3");
  const [mockTargetVersion] = useState("1.3.0");

  useEffect(() => {
    setIsClient(true);
  }, []);

  const isElectronClient = isClient && isElectron();
  const isDevPreview = isClient && isDev && !isElectronClient;

  useEffect(() => {
    if (!isElectronClient) return;

    updateManager.initialize();
    setState(updateManager.getState());

    const unsubscribe = updateManager.subscribe(setState);
    updateManager.getAppVersion().then(setAppVersion);

    return () => {
      unsubscribe();
    };
  }, [isElectronClient]);

  useEffect(() => {
    if (!isDevPreview) return;
    setMockState({
      status: "available",
      updateInfo: {
        version: mockTargetVersion,
        releaseDate: new Date().toISOString(),
        releaseNotes:
          "・ホームのお知らせ欄の表示改善\n・施術録検索の速度向上\n・軽微な不具合修正",
      },
      downloadProgress: null,
      error: null,
    });
  }, [isDevPreview, mockTargetVersion]);

  const handleCheckUpdate = useCallback(() => {
    updateManager.checkForUpdates();
  }, []);

  const handleDownload = useCallback(() => {
    updateManager.downloadUpdate();
  }, []);

  const handleInstall = useCallback(() => {
    updateManager.installUpdate();
  }, []);

  const effectiveState = isDevPreview ? mockState : state;
  const effectiveVersion = isDevPreview ? mockVersion : appVersion;

  const status = effectiveState?.status ?? "idle";
  const updateInfo = effectiveState?.updateInfo ?? null;
  const downloadPercent = formatPercent(
    effectiveState?.downloadProgress?.percent,
  );

  const handleMockDownload = useCallback(() => {
    setMockState((prev) =>
      prev
        ? {
            ...prev,
            status: "downloading",
            downloadProgress: {
              bytesPerSecond: 0,
              percent: 0,
              transferred: 0,
              total: 100,
            },
            error: null,
          }
        : prev,
    );
  }, []);

  useEffect(() => {
    if (!isDevPreview || status !== "downloading") return;
    const timer = setInterval(() => {
      setMockState((prev) => {
        if (!prev?.downloadProgress) return prev;
        const nextPercent = Math.min(100, prev.downloadProgress.percent + 12);
        if (nextPercent >= 100) {
          return {
            ...prev,
            status: "downloaded",
            downloadProgress: null,
          };
        }
        return {
          ...prev,
          downloadProgress: {
            ...prev.downloadProgress,
            percent: nextPercent,
          },
        };
      });
    }, 600);
    return () => clearInterval(timer);
  }, [isDevPreview, status]);

  const handleMockInstall = useCallback(() => {
    setMockVersion(mockTargetVersion);
    setMockState((prev) =>
      prev
        ? {
            ...prev,
            status: "not-available",
            updateInfo: null,
            downloadProgress: null,
            error: null,
          }
        : prev,
    );
  }, [mockTargetVersion]);

  const content = useMemo(() => {
    if (!isClient) {
      return null;
    }
    if (!isElectronClient && !isDevPreview) {
      return null;
    }

    switch (status) {
      case "checking":
        return {
          text: "アプリの更新を確認中です",
          detail: effectiveVersion
            ? `現在のバージョン: v${effectiveVersion}`
            : null,
          action: null,
        };
      case "available":
        return {
          text: "新しいバージョンが利用可能です",
          detail: updateInfo
            ? `v${effectiveVersion || "?"} → v${updateInfo.version}`
            : null,
          action: { label: "更新", onClick: () => setIsModalOpen(true) },
        };
      case "downloading":
        return {
          text: "更新をダウンロード中です",
          detail: downloadPercent ? `${downloadPercent} 完了` : null,
          action: null,
        };
      case "downloaded":
        return {
          text: "更新の準備が完了しました",
          detail: "再起動すると更新が適用されます",
          action: { label: "再起動して更新", onClick: handleInstall },
        };
      case "not-available":
        return {
          text: "アプリは最新です",
          detail: effectiveVersion
            ? `現在のバージョン: v${effectiveVersion}`
            : null,
          action: null,
        };
      case "error":
        return {
          text: "更新の確認でエラーが発生しました",
          detail: state?.error ?? null,
          action: { label: "再試行", onClick: handleCheckUpdate },
        };
      case "idle":
      default:
        return {
          text: "更新状況を確認できます",
          detail: effectiveVersion
            ? `現在のバージョン: v${effectiveVersion}`
            : null,
          action: isDevPreview
            ? { label: "更新を確認", onClick: () => setIsModalOpen(true) }
            : { label: "更新を確認", onClick: handleCheckUpdate },
        };
    }
  }, [
    downloadPercent,
    handleCheckUpdate,
    handleInstall,
    isClient,
    isElectronClient,
    isDevPreview,
    effectiveVersion,
    updateInfo,
    status,
    state?.error,
  ]);

  if (!content) return null;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 bg-slate-300" />
          <div className="text-sm text-slate-600 leading-relaxed">
            <div>{content.text}</div>
            {content.detail && (
              <div className="text-xs text-slate-500 mt-0.5">
                {content.detail}
              </div>
            )}
          </div>
        </div>
        {content.action && (
          <button
            type="button"
            onClick={content.action.onClick}
            className="flex-shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {content.action.label}
          </button>
        )}
      </div>

      <AccessibleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="アップデート"
        description="更新内容の確認とアップデートを行います。"
        size="md"
      >
        <div className="pt-4 text-sm text-slate-700 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs text-slate-500">バージョン</div>
            <div className="mt-1 font-medium text-slate-900">
              v{effectiveVersion || "読み込み中..."}
              {updateInfo?.version ? ` → v${updateInfo.version}` : ""}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs text-slate-500">変更点</div>
            <div className="mt-1 text-slate-600 whitespace-pre-wrap leading-relaxed">
              {updateInfo?.releaseNotes?.trim()
                ? updateInfo.releaseNotes
                : "変更内容はありません。"}
            </div>
          </div>

          {status === "downloading" && (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs text-slate-500">
                ダウンロード中
                {downloadPercent ? ` (${downloadPercent})` : ""}
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-slate-600 transition-all"
                  style={{ width: downloadPercent ?? "0%" }}
                />
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="text-red-700">
              {effectiveState?.error || "更新の確認中にエラーが発生しました。"}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              閉じる
            </button>
            {status === "available" && (
              <button
                type="button"
                onClick={isDevPreview ? handleMockDownload : handleDownload}
                className="rounded-lg bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:brightness-110 transition"
              >
                アップデートを開始
              </button>
            )}
            {status === "downloading" && (
              <button
                type="button"
                disabled
                className="rounded-md bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500"
              >
                ダウンロード中
              </button>
            )}
            {status === "downloaded" && (
              <button
                type="button"
                onClick={isDevPreview ? handleMockInstall : handleInstall}
                className="rounded-lg bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:brightness-110 transition"
              >
                再起動して更新
              </button>
            )}
            {status === "error" && (
              <button
                type="button"
                onClick={handleCheckUpdate}
                className="rounded-lg bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:brightness-110 transition"
              >
                再試行
              </button>
            )}
          </div>
        </div>
      </AccessibleModal>
    </>
  );
}
