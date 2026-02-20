"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { RoleBadge } from "./RoleBadge";
import { useUser } from "@/hooks/useUser";

export function UserMenu() {
  const { user } = useUser();
  const router = useRouter();

  const role = useMemo(() => user?.role, [user]);

  const userName = useMemo(() => {
    return user?.name || user?.email || "ユーザー";
  }, [user]);

  // ユーザーがない場合は表示しない
  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/auth/signin");
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* ユーザー名 */}
      <span className="text-base font-semibold text-slate-900">{userName}</span>
      {/* ロール */}
      <RoleBadge role={role} />
      {/* ログアウトボタン */}
      <button
        onClick={handleLogout}
        className="px-3 py-1.5 rounded-md text-sm text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
        aria-label="ログアウト"
      >
        ログアウト
      </button>
    </div>
  );
}
