"use client";

import { useRouter } from "next/navigation";

export default function WelcomePage() {
  const router = useRouter();

  const handleStartLogin = () => {
    router.push("/auth/signin?from=setup");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-3xl px-4 py-3 flex flex-col items-center gap-4 -translate-y-4 sm:-translate-y-6">
        {/* タイトル - ログインページと同じスタイル */}
        <div className="text-3xl sm:text-4xl font-semibold text-slate-800 -mt-12 sm:-mt-14 mb-4 sm:mb-5 text-center leading-tight">
          ようこそ！
        </div>

        <div className="w-full max-w-md flex flex-col items-center gap-6 mt-1 sm:mt-2">
          {/* メッセージ - シンプルに */}
          <div className="text-center space-y-2">
            <p className="text-lg text-slate-700 font-medium">
              初回セットアップが完了しました
            </p>
            <p className="text-sm text-slate-600">
              セットアップ時に登録したIDとパスワードでログインしてください
            </p>
          </div>

          {/* ログインボタン - ログインページと同じスタイル */}
          <div className="w-full max-w-sm pt-2">
            <button
              onClick={handleStartLogin}
              className="w-full bg-slate-800 text-white rounded-xl py-3 text-sm font-semibold shadow hover:bg-slate-700 transition-colors"
            >
              ログイン開始
            </button>
          </div>

          <div className="text-xs text-slate-400">
            柔道整復施術所向け電子施術録 v0.1.0
          </div>
        </div>
      </div>
    </main>
  );
}
