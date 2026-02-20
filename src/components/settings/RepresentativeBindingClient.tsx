"use client";

import { useEffect, useState } from "react";

type BindingState =
  | { status: "loading" }
  | { status: "loaded"; email: string | null }
  | { status: "error"; message: string };

export function RepresentativeBindingClient() {
  const [state, setState] = useState<BindingState>({ status: "loading" });
  const [email, setEmail] = useState("");
  const [transfer, setTransfer] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchCurrent = async () => {
    try {
      const res = await fetch("/api/settings/representative");
      if (!res.ok) throw new Error("取得に失敗しました");
      const data = await res.json();
      setState({ status: "loaded", email: data.email ?? null });
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "取得に失敗しました",
      });
    }
  };

  useEffect(() => {
    fetchCurrent();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setToast(null);
    try {
      const res = await fetch("/api/settings/representative", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, transferRequested: transfer }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "更新に失敗しました");
      }
      setToast(
        "代表アカウントを更新しました。旧アカウントのセッションを無効化しました。",
      );
      setEmail("");
      fetchCurrent();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {state.status === "loaded" && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-700">現在の代表Googleアカウント</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            {state.email || "未設定（初回ログイン時に設定されます）"}
          </p>
        </div>
      )}
      {state.status === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            新しい代表Googleアカウントのメールアドレス
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400"
            placeholder="example@gmail.com"
          />
          <p className="text-xs text-slate-500 mt-1">
            代表アカウントを変更すると、以前のアカウントのセッションは無効化されます。
          </p>
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={transfer}
            onChange={(e) => setTransfer(e.target.checked)}
            className="h-4 w-4"
          />
          代表アカウントを上書きする（交代時は必ずチェック）
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? "保存中..." : "代表アカウントを更新"}
        </button>
      </form>

      {toast && (
        <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
          {toast}
        </div>
      )}
    </div>
  );
}
