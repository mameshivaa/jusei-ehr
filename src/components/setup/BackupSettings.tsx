"use client";

import { useState } from "react";
import {
  Usb,
  FolderOpen,
  CheckCircle2,
  Loader2,
  Copy,
  RefreshCw,
} from "lucide-react";
import { getDefaultBackupDirectory } from "@/lib/backup/default-backup-dir";

type BackupSource = "external" | "default" | "custom";

interface BackupSettingsProps {
  directory: string;
  source: BackupSource;
  loading: boolean;
  directoryValidation: "idle" | "checking" | "valid" | "invalid";
  directoryValidationMessage?: string;
  externalAvailable?: boolean;
  secret: string;
  secretConfirmed: boolean;
  secretConfirmInvalid?: boolean;
  onSecretChange: (secret: string) => void;
  onSecretConfirmedChange: (confirmed: boolean) => void;
  secretInvalid?: boolean;
  onDirectoryChange: (directory: string) => void;
  onDetectRequested: () => void;
  onValidateDirectory: () => void;
  onSourceChange?: (source: BackupSource) => void;
}

export function BackupSettings({
  directory,
  source,
  loading,
  directoryValidation,
  directoryValidationMessage = "",
  externalAvailable = true,
  secret,
  secretConfirmed,
  secretConfirmInvalid = false,
  onSecretChange,
  onSecretConfirmedChange,
  secretInvalid = false,
  onDirectoryChange,
  onDetectRequested,
  onValidateDirectory,
  onSourceChange,
}: BackupSettingsProps) {
  const isElectron =
    typeof window !== "undefined" && !!window.electronAPI?.isElectron;
  const [copied, setCopied] = useState(false);

  const generateSecret = () => {
    const cryptoObj = typeof window !== "undefined" ? window.crypto : undefined;
    if (!cryptoObj?.getRandomValues) return;
    const bytes = new Uint8Array(24);
    cryptoObj.getRandomValues(bytes);
    const base64 = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    onSecretChange(base64);
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handlePickDirectory = async () => {
    if (!isElectron || !window.electronAPI?.showOpenDialog) return;
    const result = await window.electronAPI.showOpenDialog({
      title: "バックアップ保存先を選択",
      properties: ["openDirectory", "createDirectory"],
    });
    if (result && !result.canceled && result.filePaths?.[0]) {
      onDirectoryChange(result.filePaths[0]);
    }
  };

  const directoryStatusText =
    directoryValidation === "checking"
      ? "確認中"
      : directoryValidation === "valid"
        ? "確認済み"
        : directoryValidation === "invalid"
          ? "要確認"
          : "未確認";

  const keyReady = secret.trim().length >= 8;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          アプリの起動・終了・アップデート時に自動バックアップします。
        </p>
        <ul className="space-y-1 text-sm text-slate-600">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
            外部ストレージへの保存を推奨します
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
            バックアップ暗号化用の秘密鍵（BACKUP_SECRET）を設定します
          </li>
        </ul>
        <div className="border-t border-slate-200" />
        <div className="pt-1 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
              <div className="text-sm text-slate-600">保存先を検出中...</div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-700 mb-2">
                保存先を選択
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* ローカル保存オプション */}
                <button
                  type="button"
                  onClick={() => {
                    onSourceChange?.("default");
                    onDirectoryChange(getDefaultBackupDirectory());
                  }}
                  className={`flex flex-col items-start gap-2 p-4 rounded-lg border-2 transition-all text-left ${
                    source === "default" || source === "custom"
                      ? "border-slate-900 bg-slate-50"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2 w-full">
                    <FolderOpen
                      className={`w-5 h-5 flex-shrink-0 ${
                        source === "default" || source === "custom"
                          ? "text-slate-900"
                          : "text-slate-600"
                      }`}
                    />
                    <span
                      className={`font-medium ${
                        source === "default" || source === "custom"
                          ? "text-slate-900"
                          : "text-slate-700"
                      }`}
                    >
                      ローカルに保存
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 font-mono break-all">
                    {directory}
                  </div>
                  {(source === "default" || source === "custom") && (
                    <div className="text-xs text-slate-500 mt-1">
                      現在選択中
                    </div>
                  )}
                </button>

                {/* 外部ストレージ保存オプション */}
                <button
                  type="button"
                  onClick={() => {
                    onSourceChange?.("external");
                    onDetectRequested();
                  }}
                  disabled={loading}
                  className={`flex flex-col items-start gap-2 p-4 rounded-lg border-2 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                    source === "external"
                      ? "border-slate-900 bg-slate-50"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Usb
                      className={`w-5 h-5 flex-shrink-0 ${
                        source === "external"
                          ? "text-slate-900"
                          : "text-slate-600"
                      }`}
                    />
                    <span
                      className={`font-medium ${
                        source === "external"
                          ? "text-slate-900"
                          : "text-slate-700"
                      }`}
                    >
                      外部ストレージに保存
                    </span>
                    <span className="ml-auto text-xs text-slate-500">推奨</span>
                  </div>
                  {source === "external" ? (
                    <>
                      <div className="text-xs text-slate-600 font-mono break-all">
                        {directory}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        現在選択中
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-600">
                      USBメモリや外付けHDDを接続してからクリック
                    </div>
                  )}
                </button>
              </div>

              {source === "external" && !externalAvailable && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  外部ストレージが検出されていません。接続後に再検出してください。
                </div>
              )}

              {isElectron && (
                <button
                  type="button"
                  onClick={handlePickDirectory}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  <FolderOpen className="w-4 h-4" />
                  手動でフォルダを選択
                </button>
              )}

              <button
                type="button"
                onClick={onValidateDirectory}
                disabled={loading || directoryValidation === "checking"}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                {directoryValidation === "checking" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    保存先を確認中...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    保存先を確認
                  </>
                )}
              </button>

              {directoryValidationMessage ? (
                <div
                  className={`rounded-md border px-3 py-2 text-xs ${
                    directoryValidation === "valid"
                      ? "border-green-200 bg-green-50 text-green-800"
                      : directoryValidation === "invalid"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}
                >
                  {directoryValidationMessage}
                </div>
              ) : null}
            </div>
          )}

          <div
            className={`rounded-md border px-3 py-3 ${
              secretInvalid
                ? "border-red-200 bg-red-50/40"
                : "border-slate-200 bg-white"
            }`}
          >
            <label className="block text-sm font-medium text-slate-700 mb-1">
              復元キー（必須）
            </label>
            <p className="text-xs text-slate-500 mb-2">
              内部設定名: <code>BACKUP_SECRET</code>
            </p>
            <div className="flex flex-col gap-2">
              <input
                type="password"
                value={secret}
                readOnly
                placeholder="自動生成してください"
                className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                  secretInvalid
                    ? "border-red-400 bg-white focus:ring-red-400"
                    : "border-slate-300 bg-white focus:ring-slate-500"
                }`}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={generateSecret}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  自動生成
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!secret}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "コピーしました" : "コピー"}
                </button>
              </div>
            </div>
            <p
              className={`mt-1 text-xs ${secretInvalid ? "text-red-600" : "text-slate-500"}`}
            >
              {secretInvalid
                ? "自動生成ボタンで復元キーを作成してください。"
                : "自動バックアップの暗号化に使用します。忘れると復元できません。"}
            </p>

            <label
              className={`mt-2 flex items-start gap-2 text-xs ${
                secretConfirmInvalid
                  ? "rounded-md border border-red-200 bg-red-50 px-2 py-2 text-red-700"
                  : "text-slate-700"
              }`}
            >
              <input
                type="checkbox"
                checked={secretConfirmed}
                onChange={(e) => onSecretConfirmedChange(e.target.checked)}
                className="mt-0.5"
              />
              <span>復元キーを安全な場所に保存しました</span>
            </label>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700 space-y-1">
            <div className="font-medium text-slate-800">現在の設定</div>
            <div className="break-all">
              保存先: {directory || "未選択"}
            </div>
            <div>保存先チェック: {directoryStatusText}</div>
            <div>復元キー: {keyReady ? "生成済み" : "未生成"}</div>
            <div>保管確認: {secretConfirmed ? "確認済み" : "未確認"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
