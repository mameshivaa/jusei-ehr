"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { UserMenu } from "./UserMenu";
import { useUser } from "@/hooks/useUser";
import type { Route } from "next";

// ナビゲーションタブの型定義
type NavTab = {
  href: Route;
  label: string;
};

export default function TopNav() {
  const pathname = usePathname();
  const { user, loading } = useUser();
  const role = useMemo(() => user?.role, [user]);

  // ロールに応じたナビゲーションタブ
  const tabs: NavTab[] = useMemo(() => {
    const home: NavTab = { href: "/home" as Route, label: "ホーム" };
    const reception: NavTab = {
      href: "/reception" as Route,
      label: "来院受付",
    };
    const charts: NavTab = { href: "/charts" as Route, label: "カルテ管理" };
    const patients: NavTab = { href: "/patients" as Route, label: "患者管理" };
    const logs: NavTab = { href: "/logs" as Route, label: "ログ" };
    const settings: NavTab = { href: "/settings" as Route, label: "設定" };

    // ロール別ナビゲーション
    if (role === "RECEPTION")
      return [home, reception, charts, patients, logs, settings];
    if (role === "PRACTITIONER")
      return [home, reception, charts, patients, logs, settings];
    if (role === "ADMIN")
      return [home, reception, charts, patients, logs, settings];
    // 未ログイン/ロール不明（開発モード含む）
    return [home, reception, charts, patients, logs, settings];
  }, [role]);

  return (
    <header
      className="sticky top-0 z-30 bg-white border-b border-slate-200"
      role="banner"
    >
      <div className="h-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Left: Logo + Tabs */}
        <div className="flex items-center gap-6">
          <Link
            href={"/home" as Route}
            className="text-xl font-bold text-slate-900 tracking-wide"
            aria-label="柔整電子施術録（β版） ホーム"
          >
            柔整電子施術録（β版）
          </Link>

          {/* Navigation Tabs */}
          <nav
            aria-label="主要ナビ"
            className="flex items-center gap-1 overflow-x-auto whitespace-nowrap min-w-0"
          >
            {tabs.map((t) => {
              const basePath = t.href;
              const currentPath = pathname || "/";
              const active =
                currentPath === basePath ||
                (basePath !== "/" && currentPath.startsWith(basePath));
              // 認証必須ページはプレフェッチしない（プレフェッチ時にCookieが送られずログインに飛ぶ問題を防ぐ）
              const skipPrefetch = t.href === "/logs" || t.href === "/settings";
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  prefetch={!skipPrefetch}
                  aria-current={active ? "page" : undefined}
                  className={
                    `text-sm px-3.5 py-2 transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 ` +
                    (active
                      ? "text-slate-900 bg-slate-100 font-medium"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50")
                  }
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: User Menu */}
        <div className="flex items-center gap-2">
          {user ? (
            <UserMenu />
          ) : loading ? (
            <span className="text-xs text-slate-500">読み込み中...</span>
          ) : (
            <Link
              href={"/auth/signin" as Route}
              className="text-sm px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              ログイン
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
