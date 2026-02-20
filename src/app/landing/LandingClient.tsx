"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Noto_Sans_JP } from "next/font/google";
import { motion, useReducedMotion, type Transition } from "framer-motion";
import { ArrowRight, Building2, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarketingHeader from "@/components/marketing/Header";
import MarketingFooter from "@/components/marketing/Footer";

const notoSans = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// 企業情報（後で変更可能）
const companyInfo = {
  name: "Your Company Name", // 企業名を設定してください
  tagline: "医療現場を支えるソフトウェア開発",
  description:
    "私たちは、医療現場の課題を解決するソフトウェアを開発しています。シンプルで使いやすく、現場に寄り添う製品づくりを心がけています。",
};

// 企業の価値観
const values = [
  {
    icon: Target,
    title: "現場第一",
    description:
      "実際の利用者の声を大切にし、現場で本当に必要な機能を提供します。",
  },
  {
    icon: Users,
    title: "シンプルさ",
    description: "複雑な機能を削ぎ落とし、必要十分な機能だけを提供します。",
  },
  {
    icon: Building2,
    title: "ローカル完結",
    description: "データを院内で管理できる、安心・安全なシステムを提供します。",
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

export default function LandingClient() {
  const shouldReduceMotion = useReducedMotion();
  const transition: Transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.6, ease: [0.16, 1, 0.3, 1] };

  const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(null);

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
      }
    }
    fetchLatestRelease();
  }, []);

  const sectionMotion = {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0 },
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

      {/* ヒーローセクション（企業紹介） */}
      <motion.section
        className="mx-auto w-full max-w-6xl px-4 py-24 text-center md:py-32"
        initial="hidden"
        animate="show"
        variants={sectionMotion}
        transition={transition}
      >
        <div className="mx-auto max-w-3xl">
          <h2 className="text-5xl font-bold leading-tight text-slate-900 md:text-7xl">
            {companyInfo.name}
          </h2>
          <p className="mt-8 text-xl leading-relaxed text-slate-600 md:text-2xl">
            {companyInfo.description}
          </p>
        </div>
      </motion.section>

      {/* 企業の価値観 */}
      <motion.section
        id="about"
        className="mx-auto w-full max-w-6xl px-4 py-12 md:py-16"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={sectionMotion}
        transition={transition}
      >
        <div className="border-t border-slate-200 pt-10 text-center">
          <p className="text-xs font-semibold tracking-[0.3em] text-slate-400">
            OUR VALUES
          </p>
          <h3 className="mt-4 text-3xl font-semibold md:text-4xl">
            私たちの価値観
          </h3>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 md:text-lg">
            私たちが大切にしている3つの価値観
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {values.map((value) => {
              const Icon = value.icon;
              return (
                <div
                  key={value.title}
                  className="rounded-2xl p-6 text-left bg-white/80 backdrop-blur-sm hover:bg-white transition-all shadow-sm hover:shadow-md"
                >
                  <div className="mb-4 inline-flex rounded-lg bg-slate-50 p-3">
                    <Icon className="h-6 w-6 text-slate-700" />
                  </div>
                  <h4 className="text-xl font-semibold text-slate-900">
                    {value.title}
                  </h4>
                  <p className="mt-3 text-base leading-relaxed text-slate-600">
                    {value.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* プロダクトセクション */}
      <motion.section
        id="products"
        className="mx-auto w-full max-w-6xl px-4 py-12 md:py-16"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={sectionMotion}
        transition={transition}
      >
        <div className="border-t border-slate-200 pt-10 text-center">
          <p className="text-xs font-semibold tracking-[0.3em] text-slate-400">
            PRODUCTS
          </p>
          <h3 className="mt-4 text-3xl font-semibold md:text-4xl">
            プロダクト
          </h3>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 md:text-lg">
            私たちが提供するソフトウェア製品
          </p>
        </div>

        {/* 柔整電子施術録の紹介カード */}
        <div className="mt-12 rounded-2xl bg-white p-8 md:p-12 transition-all hover:shadow-xl border border-slate-100">
          <div className="text-center">
            <p className="text-base font-semibold text-slate-500">
              無料配布版（ソース非公開）
            </p>
            <h4 className="mt-4 text-3xl font-semibold leading-tight text-slate-900 md:text-4xl">
              柔整電子施術録
            </h4>
            <p className="mt-4 text-lg text-slate-600">
              ローカル1台で完結する接骨院向け電子カルテ
            </p>
            <p className="mt-2 text-base text-slate-600">
              患者管理・施術記録・受付フローを必要十分に。
              迷わず使えて、院内のPCだけで運用できます。
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/products/judo-therapy-record">
                <Button
                  size="lg"
                  className="bg-slate-900 text-white hover:bg-slate-800 shadow-lg"
                >
                  詳細を見る
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
            {releaseInfo && (
              <p className="mt-4 text-sm text-slate-500">
                最新バージョン: {releaseInfo.version} (
                {new Date(releaseInfo.publishedAt).toLocaleDateString("ja-JP")})
              </p>
            )}
            <div className="mt-8 grid gap-6 text-base text-slate-600 sm:grid-cols-3">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-slate-400">
                  導入コスト
                </p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">¥0</p>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-slate-400">
                  動作環境
                </p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  1台のPC
                </p>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-slate-400">
                  データ保存
                </p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  ローカル
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* お問い合わせセクション */}
      <motion.section
        id="contact"
        className="mx-auto w-full max-w-6xl px-4 py-16 text-center"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={sectionMotion}
        transition={transition}
      >
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 px-8 py-16 text-white">
          <h3 className="text-4xl font-bold">お問い合わせ</h3>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
            製品に関するご質問やお問い合わせは、GitHubのIssuesまたはリリースページからお願いいたします。
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/products/judo-therapy-record">
              <Button
                size="lg"
                className="bg-white text-slate-900 hover:bg-slate-100 shadow-xl px-8 py-6 text-lg"
              >
                プロダクト詳細を見る
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            {releaseInfo && (
              <Button
                variant="outline"
                size="lg"
                className="border-slate-300 text-white hover:bg-white/10 px-8 py-6 text-lg"
                onClick={() => window.open(releaseInfo.releaseUrl, "_blank")}
              >
                GitHub Releases
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </motion.section>

      <MarketingFooter />
    </main>
  );
}
