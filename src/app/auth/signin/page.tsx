"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { useEffect, useState, Suspense } from "react";

function SignInContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveredNotice, setRecoveredNotice] = useState<string | null>(null);
  const callbackUrl = searchParams?.get("callbackUrl") || "/patients";

  const handleLocalSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setRecoveredNotice(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier, password }),
      });
      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({ error: "認証に失敗しました" }));
        setError(data.error || "認証に失敗しました");
        return;
      }
      router.push(callbackUrl as Route);
    } catch (err) {
      console.error("Local sign in error:", err);
      setError("ログインエラーが発生しました。再度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkSetup = async () => {
      try {
        const response = await fetch("/api/setup/status");
        if (!response.ok) return;
        const data = (await response.json()) as { isSetupComplete?: boolean };
        if (data?.isSetupComplete === false) {
          const setupUrl = new URL("/setup", window.location.origin);
          setupUrl.searchParams.set("callbackUrl", window.location.href);
          window.location.replace(setupUrl.toString());
        }
      } catch {
        // ignore
      }
    };
    void checkSetup();
    const needsSave = sessionStorage.getItem("recoveredNeedsSave");
    const recoveredId = sessionStorage.getItem("recoveredAdminId");
    if (needsSave && recoveredId) {
      setRecoveredNotice("管理者IDと変更後のPWを忘れないよう控えてください。");
      sessionStorage.removeItem("recoveredNeedsSave");
    }
  }, []);

  const handleRecoverySubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setRecoveryLoading(true);
    setRecoveryError(null);
    try {
      const response = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recoveryCode,
          newPassword: recoveryPassword,
        }),
      });
      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({ error: "復旧に失敗しました" }));
        setRecoveryError(
          data.error || "復旧コードが正しいか確認してください。",
        );
        return;
      }
      const data = await response.json().catch(() => ({}));
      const adminId = (data as { adminId?: string }).adminId;
      if (adminId) {
        setIdentifier(adminId);
        sessionStorage.setItem("recoveredAdminId", adminId);
        sessionStorage.setItem("recoveredNeedsSave", "true");
      }
      setRecoveryCode("");
      setRecoveryPassword("");
      setShowRecovery(false);
    } catch (err) {
      console.error("Recovery error:", err);
      setRecoveryError("復旧コードが正しいか確認してください。");
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-3xl px-4 py-3 flex flex-col items-center gap-4 -translate-y-4 sm:-translate-y-6">
        <div className="text-3xl sm:text-4xl font-semibold text-slate-800 -mt-12 sm:-mt-14 mb-4 sm:mb-5 text-center leading-tight">
          ログイン
        </div>

        <div className="w-full max-w-sm flex flex-col items-center gap-4 mt-1 sm:mt-2">
          <div className="w-full max-w-lg space-y-4">
            <div
              className={`transition-all duration-300 ease-out overflow-hidden ${
                showRecovery
                  ? "max-h-0 opacity-0 -translate-y-2"
                  : "max-h-[520px] opacity-100 translate-y-0"
              }`}
            >
              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              )}
              {recoveredNotice && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {recoveredNotice}
                </div>
              )}
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-800">
                    ログイン
                  </div>
                  <div className="text-[11px] text-slate-500">
                    ユーザーID / パスワード
                  </div>
                </div>
                <form onSubmit={handleLocalSignIn} className="w-full space-y-3">
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="ユーザーID"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-inner focus:border-slate-400 focus:outline-none"
                      autoComplete="username"
                      required
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="パスワード"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-inner focus:border-slate-400 focus:outline-none"
                      autoComplete="current-password"
                      required
                    />
                  </div>
                  <div className="text-[11px] text-slate-500">
                    IDを忘れた場合は管理者へ確認してください。
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-slate-800 text-white rounded-xl py-3 text-sm font-semibold shadow hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
                  >
                    {loading ? "ログイン中..." : "ログイン"}
                  </button>
                </form>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-2 space-y-2">
              <button
                type="button"
                onClick={() => {
                  const next = !showRecovery;
                  setShowRecovery(next);
                  if (!next) {
                    setRecoveryCode("");
                    setRecoveryPassword("");
                  }
                  setRecoveryError(null);
                  setError(null);
                }}
                className="w-full grid grid-cols-[1fr_auto] items-center gap-2 py-1"
              >
                <span className="text-sm font-semibold text-slate-800 text-left leading-5">
                  管理者パスワードの再設定
                </span>
                <span className="text-[11px] text-slate-500 leading-4">
                  {showRecovery ? "閉じる" : "開く"}
                </span>
              </button>
              <div
                className={`transition-all duration-300 ease-out overflow-hidden ${
                  showRecovery
                    ? "max-h-[560px] opacity-100 translate-y-0"
                    : "max-h-0 opacity-0 -translate-y-2"
                }`}
              >
                <form onSubmit={handleRecoverySubmit} className="space-y-3">
                  <div className="text-[11px] text-slate-500">
                    復旧コードを使って管理者パスワードを再設定します。
                  </div>
                  <div className="text-[11px] text-slate-500">
                    管理者アカウントは1人のみ作成できます。
                  </div>
                  {recoveryError && (
                    <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      {recoveryError}
                    </div>
                  )}
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value)}
                      placeholder="復旧コード（例: ABCD-EFGH-...）"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-inner focus:border-slate-400 focus:outline-none"
                      required
                    />
                    <input
                      type="password"
                      value={recoveryPassword}
                      onChange={(e) => setRecoveryPassword(e.target.value)}
                      placeholder="新しいパスワード（4文字以上）"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-inner focus:border-slate-400 focus:outline-none"
                      autoComplete="new-password"
                      minLength={4}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={recoveryLoading}
                    className="w-full bg-slate-800 text-white rounded-xl py-3 text-sm font-semibold shadow hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
                  >
                    {recoveryLoading ? "再設定中..." : "再設定"}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-400">
            柔道整復施術所向け電子施術録 v0.1.0
          </div>
        </div>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-rose-50/30">
          <div className="w-full max-w-md px-4">
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl p-8 h-32" />
          </div>
        </main>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
