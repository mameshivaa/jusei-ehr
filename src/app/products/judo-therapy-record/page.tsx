"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Noto_Sans_JP } from "next/font/google";
import { motion, useReducedMotion, type Transition } from "framer-motion";
import { ArrowLeft, Download, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarketingHeader from "@/components/marketing/Header";
import MarketingFooter from "@/components/marketing/Footer";

const notoSans = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const features = [
  {
    title: "ローカル完結",
    description:
      "データは院内のPCに保存。インターネット接続不要で運用できます。",
  },
  {
    title: "迷わない操作",
    description: "受付からSOAP記録まで、必要な導線だけに整理。",
  },
  {
    title: "無料で導入",
    description: "初期費用・月額費用なし。1台のPCから始められます。",
  },
];

const functions = [
  {
    title: "患者管理",
    items: ["患者情報の登録・検索・編集", "保険証番号の管理", "来院履歴の確認"],
  },
  {
    title: "施術記録",
    items: ["SOAP形式での記録作成", "記録の編集・参照", "シンプルな入力導線"],
  },
  {
    title: "ユーザー管理",
    items: ["複数ユーザーの登録", "ロールベース権限", "スタッフ運用に対応"],
  },
];

interface ReleaseInfo {
  version: string;
  name: string;
  publishedAt: string;
  assets: {
    mac?: { name: string; browser_download_url: string; size: number };
    windows?: { name: string; browser_download_url: string; size: number };
    linux?: { name: string; browser_download_url: string; size: number };
  };
  releaseUrl: string;
}

export default function JudoTherapyRecordPage() {
  const shouldReduceMotion = useReducedMotion();
  const transition: Transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.6, ease: [0.16, 1, 0.3, 1] };

  const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(null);
  const [isLoadingRelease, setIsLoadingRelease] = useState(true);

  useEffect(() => {
    async function fetchLatestRelease() {
      try {
        const response = await fetch("/api/releases/latest");
        if (response.ok) {
          const data = await response.json();
          setReleaseInfo(data);
        }
      } catch (error) {
        console.error("Failed to fetch latest release:", error);
      } finally {
        setIsLoadingRelease(false);
      }
    }
    fetchLatestRelease();
  }, []);

  const sectionMotion = {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0 },
  };

  const handleDownload = (platform?: "mac" | "windows" | "linux") => {
    if (!releaseInfo) {
      window.open("https://github.com/mameshivaa/v-oss/releases", "_blank");
      return;
    }

    const asset = platform
      ? releaseInfo.assets[platform]
      : (() => {
          const userAgent = navigator.userAgent.toLowerCase();
          if (userAgent.includes("mac")) return releaseInfo.assets.mac;
          if (userAgent.includes("win")) return releaseInfo.assets.windows;
          if (userAgent.includes("linux")) return releaseInfo.assets.linux;
          return null;
        })();

    if (asset) {
      window.open(asset.browser_download_url, "_blank");
    } else {
      window.open(releaseInfo.releaseUrl, "_blank");
    }
  };

  const scrollTo = (id: string) => {
    const target = document.getElementById(id);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main
      className={`${notoSans.className} min-h-screen bg-white text-slate-900`}
    >
      <MarketingHeader />

      {/* ヒーローセクション */}
      <motion.section
        className="mx-auto w-full max-w-6xl px-4 py-20 text-center md:py-32"
        initial="hidden"
        animate="show"
        variants={sectionMotion}
        transition={transition}
      >
        <div className="mx-auto max-w-3xl">
          <Link href="/landing">
            <Button variant="ghost" size="sm" className="mb-8">
              <ArrowLeft className="h-4 w-4" />
              企業サイトに戻る
            </Button>
          </Link>

          <p className="text-base font-semibold text-slate-500 uppercase tracking-wider">
            無料配布版（ソース非公開）
          </p>
          <h1 className="mt-6 text-5xl font-bold leading-tight text-slate-900 md:text-7xl">
            柔整電子施術録
          </h1>
          <p className="mt-8 text-xl leading-relaxed text-slate-600 md:text-2xl">
            ローカル1台で完結する接骨院向け電子カルテ
          </p>
          <p className="mt-4 text-lg text-slate-600">
            患者管理・施術記録・受付フローを必要十分に。
            迷わず使えて、院内のPCだけで運用できます。
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="bg-slate-900 text-white hover:bg-slate-800 shadow-xl px-8 py-6 text-lg"
              onClick={() => handleDownload()}
              disabled={isLoadingRelease}
            >
              <Download className="h-5 w-5" />
              {isLoadingRelease ? "読み込み中..." : "ダウンロード"}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-slate-300 text-slate-700 hover:bg-slate-50 px-8 py-6 text-lg"
              onClick={() => scrollTo("features")}
            >
              特徴を見る
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {releaseInfo && (
            <p className="mt-6 text-sm text-slate-500">
              最新バージョン: {releaseInfo.version} (
              {new Date(releaseInfo.publishedAt).toLocaleDateString("ja-JP")})
            </p>
          )}

          <div className="mt-16 grid gap-8 text-base text-slate-600 sm:grid-cols-3 border-t border-slate-200 pt-12">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400 font-semibold">
                導入コスト
              </p>
              <p className="mt-4 text-3xl font-bold text-slate-900">¥0</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400 font-semibold">
                動作環境
              </p>
              <p className="mt-4 text-3xl font-bold text-slate-900">1台のPC</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400 font-semibold">
                データ保存
              </p>
              <p className="mt-4 text-3xl font-bold text-slate-900">ローカル</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 特徴セクション */}
      <motion.section
        id="features"
        className="mx-auto w-full max-w-6xl px-4 py-12 md:py-16"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={sectionMotion}
        transition={transition}
      >
        <div className="border-t border-slate-200 pt-10 text-center">
          <p className="text-xs font-semibold tracking-[0.3em] text-slate-400">
            FEATURES
          </p>
          <h2 className="mt-4 text-3xl font-semibold md:text-4xl">特徴</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 md:text-lg">
            余計な機能を削ぎ落とし、院内の流れに必要な要素だけを整えました。
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl bg-white/80 backdrop-blur-sm p-6 text-left hover:bg-white transition-all shadow-sm hover:shadow-md"
              >
                <h3 className="text-xl font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-slate-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* 機能セクション */}
      <motion.section
        id="functions"
        className="mx-auto w-full max-w-6xl px-4 py-12 md:py-16"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={sectionMotion}
        transition={transition}
      >
        <div className="border-t border-slate-200 pt-10 text-center">
          <p className="text-xs font-semibold tracking-[0.3em] text-slate-400">
            FUNCTIONS
          </p>
          <h2 className="mt-4 text-3xl font-semibold md:text-4xl">主な機能</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 md:text-lg">
            診療に必要なコア機能を3領域に整理しています。
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {functions.map((block) => (
              <div
                key={block.title}
                className="rounded-2xl bg-white/80 backdrop-blur-sm p-6 text-left hover:bg-white transition-all shadow-sm hover:shadow-md"
              >
                <h3 className="text-xl font-semibold text-slate-900">
                  {block.title}
                </h3>
                <ul className="mt-4 space-y-2 text-base text-slate-600">
                  {block.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* 料金セクション */}
      <motion.section
        id="pricing"
        className="mx-auto w-full max-w-6xl px-4 py-12 md:py-16"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={sectionMotion}
        transition={transition}
      >
        <div className="border-t border-slate-200 pt-10 text-center">
          <p className="text-xs font-semibold tracking-[0.3em] text-slate-400">
            PRICING
          </p>
          <h2 className="mt-4 text-3xl font-semibold md:text-4xl">料金</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 md:text-lg">
            柔整電子施術録は無料で提供されています。運用コストを抑えたい院のための
            ローカル完結型ソリューションです。
          </p>
          <div className="mx-auto mt-10 max-w-md rounded-2xl bg-white p-8 text-left shadow-xl border border-slate-100">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              柔整電子施術録
            </p>
            <p className="mt-4 text-5xl font-bold text-slate-900">
              ¥0
              <span className="text-xl font-medium text-slate-500 ml-2">
                / 永久無料
              </span>
            </p>
            <ul className="mt-6 space-y-3 text-base text-slate-600">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                <span>患者管理・施術記録・ユーザー管理</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                <span>ローカル保存で安心運用</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                <span>アップデートは配布版で対応</span>
              </li>
            </ul>
            <Button
              className="mt-8 w-full bg-slate-900 text-white hover:bg-slate-800 shadow-lg py-6 text-lg"
              onClick={() => handleDownload()}
              disabled={isLoadingRelease}
            >
              {isLoadingRelease ? "読み込み中..." : "ダウンロード"}
            </Button>
            <p className="mt-4 text-xs text-slate-500 text-center">
              ※ 配布版のためソースコードは非公開です。
            </p>
          </div>
        </div>
      </motion.section>

      {/* CTAセクション */}
      <motion.section
        className="mx-auto w-full max-w-6xl px-4 py-16 text-center"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={sectionMotion}
        transition={transition}
      >
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 px-8 py-16 text-white">
          <h2 className="text-4xl font-bold">今すぐ始める</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
            必要十分な機能だけを、シンプルに。まずは無料配布版で体験してください。
          </p>
          <Button
            size="lg"
            className="mt-8 bg-white text-slate-900 hover:bg-slate-100 shadow-xl px-8 py-6 text-lg"
            onClick={() => handleDownload()}
            disabled={isLoadingRelease}
          >
            <Download className="h-5 w-5" />
            {isLoadingRelease ? "読み込み中..." : "ダウンロード"}
          </Button>
        </div>
      </motion.section>

      <MarketingFooter />
    </main>
  );
}
