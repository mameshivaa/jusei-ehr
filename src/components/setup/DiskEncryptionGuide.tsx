"use client";

import { useState, useEffect } from "react";

type OS = "macos" | "windows" | "linux" | "unknown";

interface DiskEncryptionGuideProps {
  onConfirmedChange?: (confirmed: boolean) => void;
  variant?: "full" | "compact";
  showTitle?: boolean;
  invalid?: boolean;
}

export function DiskEncryptionGuide({
  onConfirmedChange,
  variant = "full",
  showTitle = true,
  invalid = false,
}: DiskEncryptionGuideProps) {
  const [os, setOs] = useState<OS>("unknown");
  const [confirmed, setConfirmed] = useState(false);
  const isCompact = variant === "compact";

  const handleConfirmedChange = (value: boolean) => {
    setConfirmed(value);
    onConfirmedChange?.(value);
  };

  useEffect(() => {
    // User-AgentからOSを判定
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes("mac")) {
      setOs("macos");
    } else if (userAgent.includes("win")) {
      setOs("windows");
    } else if (userAgent.includes("linux")) {
      setOs("linux");
    } else {
      setOs("unknown");
    }
  }, []);

  const renderGuide = () => {
    switch (os) {
      case "macos":
        return (
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h3 className="font-semibold text-slate-900 mb-2">
                macOS: FileVaultの有効化
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-slate-800">
                <li>
                  Appleメニュー → システム設定（またはシステム環境設定）を開く
                </li>
                <li>「プライバシーとセキュリティ」を選択</li>
                <li>
                  「FileVault」セクションで「FileVaultをオンにする」をクリック
                </li>
                <li>管理者パスワードを入力して確認</li>
                <li>復旧キーを安全な場所に保管（重要）</li>
                <li>暗号化が完了するまで数時間かかる場合があります</li>
              </ol>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                FileVaultが有効になっていない場合、個人情報を含むデータベースファイルが平文で保存される可能性があります。
                必ずFileVaultを有効にしてください。
              </p>
            </div>
          </div>
        );

      case "windows":
        return (
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h3 className="font-semibold text-slate-900 mb-2">
                Windows: BitLockerの有効化
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-slate-800">
                <li>
                  「設定」→「プライバシーとセキュリティ」→「デバイスの暗号化」を開く
                </li>
                <li>「デバイスの暗号化」が「オン」になっているか確認</li>
                <li>
                  オフの場合は、コントロールパネル →
                  「BitLockerドライブ暗号化」から有効化
                </li>
                <li>管理者権限が必要な場合があります</li>
                <li>復旧キーを安全な場所に保管（重要）</li>
                <li>暗号化が完了するまで数時間かかる場合があります</li>
              </ol>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                BitLockerが有効になっていない場合、個人情報を含むデータベースファイルが平文で保存される可能性があります。
                必ずBitLockerを有効にしてください。
              </p>
            </div>
          </div>
        );

      case "linux":
        return (
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h3 className="font-semibold text-slate-900 mb-2">
                Linux: ディスク暗号化の設定
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-slate-800">
                <li>
                  LUKS（Linux Unified Key Setup）を使用したディスク暗号化を推奨
                </li>
                <li>インストール時に暗号化を有効にするか、後から設定</li>
                <li>復旧キーを安全な場所に保管（重要）</li>
                <li>
                  詳細は、使用しているディストリビューションのドキュメントを参照してください
                </li>
              </ol>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                ディスク暗号化が有効になっていない場合、個人情報を含むデータベースファイルが平文で保存される可能性があります。
                必ずディスク暗号化を有効にしてください。
              </p>
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="text-sm text-slate-700">
              お使いのOSを自動検出できませんでした。macOSの場合はFileVault、Windowsの場合はBitLockerを有効にしてください。
            </p>
          </div>
        );
    }
  };

  if (isCompact) {
    const getConfirmationText = () => {
      switch (os) {
        case "macos":
          return "OSの設定でFileVaultが有効になっていることを確認しました";
        case "windows":
          return "OSの設定でBitLockerが有効になっていることを確認しました";
        case "linux":
          return "OSの設定でディスク暗号化が有効になっていることを確認しました";
        default:
          return "OSの設定でディスク暗号化（FileVault/BitLocker）が有効になっていることを確認しました";
      }
    };

    return (
      <label
        htmlFor="encryption-confirmed"
        className={`inline-flex items-center gap-3 text-sm text-slate-700 ${
          invalid
            ? "bg-red-50/40 border border-red-200 rounded-md px-2 py-1"
            : ""
        }`}
      >
        <input
          id="encryption-confirmed"
          type="checkbox"
          checked={confirmed}
          onChange={(e) => handleConfirmedChange(e.target.checked)}
          className={`h-4 w-4 rounded border appearance-none relative focus:outline-none focus:ring-2 focus:ring-slate-500 ${
            invalid
              ? "border-red-500 bg-red-50/40"
              : "border-slate-300 bg-white"
          } checked:border-slate-900 checked:bg-slate-900 before:content-[''] before:absolute before:left-1/2 before:top-1/2 before:h-2 before:w-1 before:-translate-x-1/2 before:-translate-y-1/2 before:rotate-45 before:border-b-2 before:border-r-2 before:border-white before:opacity-0 checked:before:opacity-100`}
          required
        />
        <span className="font-medium">{getConfirmationText()}</span>
      </label>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">
          ディスク暗号化（必須）
        </h2>
        <p className="text-sm text-slate-600">
          端末のディスク暗号化を有効にしてください。
        </p>
        <div className="mt-4">{renderGuide()}</div>
      </div>

      <div
        className={`flex items-start gap-3 ${
          invalid
            ? "bg-red-50/40 border border-red-200 rounded-md px-2 py-1"
            : ""
        }`}
      >
        <input
          id="encryption-confirmed"
          type="checkbox"
          checked={confirmed}
          onChange={(e) => handleConfirmedChange(e.target.checked)}
          className={`mt-1 h-4 w-4 rounded border appearance-none relative focus:outline-none focus:ring-2 focus:ring-slate-500 ${
            invalid
              ? "border-red-500 bg-red-50/40"
              : "border-slate-300 bg-white"
          } checked:border-slate-900 checked:bg-slate-900 before:content-[''] before:absolute before:left-1/2 before:top-1/2 before:h-2 before:w-1 before:-translate-x-1/2 before:-translate-y-1/2 before:rotate-45 before:border-b-2 before:border-r-2 before:border-white before:opacity-0 checked:before:opacity-100`}
          required
        />
        <label
          htmlFor="encryption-confirmed"
          className="text-sm text-slate-700"
        >
          <span className="font-medium">
            ディスク暗号化（FileVault/BitLocker）が有効になっていることを確認しました
          </span>
          <span className="text-red-500 ml-1">*</span>
          <p className="text-xs text-slate-500 mt-1">
            このチェックを外すとセットアップを完了できません
          </p>
        </label>
      </div>
    </div>
  );
}

export function useEncryptionConfirmed(): boolean {
  const [confirmed, setConfirmed] = useState(false);
  return confirmed;
}
