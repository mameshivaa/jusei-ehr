"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useSystemMode } from "@/components/providers/SystemModeProvider";
import { Lock, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";

const TopNav = dynamic(() => import("@/components/layout/TopNav"), {
  ssr: false,
});

/**
 * 読み取り専用モードのオーバーレイ
 */
function ReadOnlyOverlay() {
  const { isReadOnly, isMaintenance, reason, isLoading } = useSystemMode();
  const pathname = usePathname();

  // 認証ページ・セットアップページ・ウェルカムページ・マーケティングサイトでは表示しない
  const hiddenPaths = [
    "/auth",
    "/setup",
    "/welcome",
    "/landing",
    "/products",
    "/blog",
    "/privacy",
    "/terms",
    "/",
  ];
  const shouldHide = hiddenPaths.some(
    (path) => pathname === path || pathname?.startsWith(`${path}/`),
  );

  if (shouldHide || isLoading || (!isReadOnly && !isMaintenance)) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] flex items-center justify-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="readonly-overlay-title"
    >
      <div className="text-center px-4 max-w-md">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-4">
          {isMaintenance ? (
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          ) : (
            <Lock className="h-6 w-6 text-slate-600" />
          )}
        </div>
        <h3
          id="readonly-overlay-title"
          className="text-lg font-semibold text-slate-900 mb-2"
        >
          {isMaintenance ? "メンテナンス中" : "読み取り専用モード"}
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          {reason ||
            (isMaintenance
              ? "システムはメンテナンス中です。しばらくお待ちください。"
              : "現在、閲覧のみ可能です。編集や保存はできません。")}
        </p>
        <div className="mt-4 pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-500">管理者にお問い合わせください</p>
        </div>
      </div>
    </div>
  );
}

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [backupBanner, setBackupBanner] = useState<string | null>(null);
  const [backupBannerLevel, setBackupBannerLevel] = useState<
    "warning" | "danger"
  >("warning");
  const [restoreBannerVisible, setRestoreBannerVisible] = useState(false);

  // 認証・セットアップ・ウェルカムページではナビを非表示
  const hideNav =
    pathname?.startsWith("/auth") ||
    pathname?.startsWith("/setup") ||
    pathname?.startsWith("/welcome") ||
    pathname === "/";

  const isLanding = pathname === "/" || pathname?.startsWith("/landing");

  // マーケティングサイトのページではAppShellを完全にスキップ
  const isMarketingSite =
    pathname?.startsWith("/landing") ||
    pathname?.startsWith("/products") ||
    pathname?.startsWith("/blog") ||
    pathname === "/privacy" ||
    pathname === "/terms";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "voss_restore_completed_at";
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    window.localStorage.removeItem(key);
    const ts = Date.parse(raw);
    if (!Number.isFinite(ts)) return;
    const ageMs = Date.now() - ts;
    if (ageMs > 10 * 60 * 1000) return;
    setRestoreBannerVisible(true);
    const timer = setTimeout(() => setRestoreBannerVisible(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!pathname) return;
    const shouldHide =
      isMarketingSite ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/setup") ||
      pathname === "/" ||
      pathname.startsWith("/landing");
    if (shouldHide) {
      setBackupBanner(null);
      return;
    }

    const fetchBackupStatus = async () => {
      try {
        const response = await fetch("/api/backup");
        if (!response.ok) return;
        const data = await response.json();
        const missingStatus = data?.missingStatus as
          | {
              required?: boolean;
              isMissing?: boolean;
              daysMissing?: number;
              alertAfterDays?: number;
            }
          | undefined;
        if (
          missingStatus?.required &&
          missingStatus.isMissing &&
          typeof missingStatus.daysMissing === "number" &&
          typeof missingStatus.alertAfterDays === "number" &&
          missingStatus.daysMissing >= missingStatus.alertAfterDays
        ) {
          setBackupBannerLevel("danger");
          setBackupBanner(
            `外部保存が${missingStatus.daysMissing}日以上行われていません。バックアップ先の接続状況を確認してください。`,
          );
          return;
        }
        setBackupBanner(null);
      } catch {
        // ignore
      }
    };

    fetchBackupStatus();
  }, [isMarketingSite, pathname]);

  // マーケティングサイトの場合はAppShellをスキップ
  if (isMarketingSite) {
    return <>{children}</>;
  }

  if (isLanding) {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  if (hideNav) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TopNav />
      {restoreBannerVisible && (
        <div className="border-b border-emerald-200 bg-emerald-50 text-emerald-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 text-sm flex items-center justify-between gap-3">
            <span>復元が完了しました。最新のデータが反映されています。</span>
            <button
              type="button"
              onClick={() => setRestoreBannerVisible(false)}
              className="text-xs font-semibold underline"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
      {backupBanner && (
        <div
          className={
            backupBannerLevel === "danger"
              ? "border-b border-red-200 bg-red-50 text-red-800"
              : "border-b border-amber-200 bg-amber-50 text-amber-800"
          }
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 text-sm flex items-center justify-between gap-3">
            <span>{backupBanner}</span>
            <Link
              href="/settings?tab=backup"
              className="text-xs font-semibold underline"
            >
              設定へ
            </Link>
          </div>
        </div>
      )}
      <main id="main-content" role="main" className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
          {children}
        </div>
      </main>
      <ReadOnlyOverlay />
    </div>
  );
}
