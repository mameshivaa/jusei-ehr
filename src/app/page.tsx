import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import DownloadLandingClient from "./landing/LandingClient";

const isDevBypassAuth = process.env.DEV_BYPASS_AUTH === "true";
const isElectronBuild = process.env.ELECTRON_BUILD === "true";
const isElectronRuntime = process.env.ELECTRON_RUNTIME === "true";

export default async function Home() {
  // Webでは配布LPを表示し、Electron実行時のみ既存アプリ導線を維持する
  if (!isElectronBuild && !isElectronRuntime) {
    return <DownloadLandingClient />;
  }

  // 開発環境で認証をスキップする場合はセットアップもスキップ
  if (isDevBypassAuth) {
    // 開発用ダミークリニックを自動作成
    const clinic = await prisma.clinic.findFirst();
    if (!clinic) {
      await prisma.clinic.create({
        data: {},
      });
    }
    redirect("/patients");
  }

  // セットアップチェック
  const clinic = await prisma.clinic.findFirst();
  if (!clinic) {
    // セットアップ未完了の場合はセットアップページへ
    redirect("/setup");
  }

  const user = await getCurrentUser();
  if (!user) {
    // 未ログインの場合はログインページへ
    redirect("/auth/signin");
  }

  // ログイン済みの場合は患者管理へ
  redirect("/patients");
}
