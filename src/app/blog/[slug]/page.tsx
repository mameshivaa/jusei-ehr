import Link from "next/link";
import { Noto_Sans_JP } from "next/font/google";
import { ArrowLeft, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";
import MarketingHeader from "@/components/marketing/Header";
import MarketingFooter from "@/components/marketing/Footer";

const notoSans = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

interface BlogPost {
  id: string;
  title: string;
  content: string;
  publishedAt: string;
  category: string;
  slug: string;
}

// サンプル記事データ（後でAPIやCMSから取得するように変更可能）
const blogPosts: Record<string, BlogPost> = {
  "benefits-of-electronic-medical-records": {
    id: "1",
    title: "接骨院における電子カルテ導入のメリット",
    content: `
# 接骨院における電子カルテ導入のメリット

電子カルテの導入により、接骨院の運営は大きく変わります。本記事では、具体的なメリットと導入時の注意点について解説します。

## 主なメリット

### 1. 記録の効率化

紙のカルテから電子カルテに移行することで、記録作成の時間を大幅に短縮できます。特に、よく使うフレーズやテンプレートを活用することで、記録作成が格段に速くなります。

### 2. 情報の検索が容易に

患者情報や過去の記録を瞬時に検索できるようになります。紙のカルテでは時間がかかっていた情報の確認が、数秒で完了します。

### 3. データのバックアップ

電子カルテでは、定期的なバックアップにより、データの紛失リスクを大幅に低減できます。ローカル完結型のシステムであれば、データを院内で管理できるため、セキュリティ面でも安心です。

## 導入時の注意点

- スタッフへの教育とトレーニング
- データ移行の計画
- セキュリティ対策の徹底

電子カルテの導入は、接骨院の運営を効率化し、患者サービスの向上につながります。
    `,
    publishedAt: "2025-01-20",
    category: "導入ガイド",
    slug: "benefits-of-electronic-medical-records",
  },
  "soap-recording-guide": {
    id: "2",
    title: "SOAP記録の書き方とポイント",
    content: `
# SOAP記録の書き方とポイント

SOAP形式での記録作成は、診療の質を向上させる重要な要素です。本記事では、効果的なSOAP記録の書き方と、よくある間違いを避けるポイントを紹介します。

## SOAPとは

SOAPは、以下の4つの要素で構成されます：

- **S (Subjective)**: 主観的情報 - 患者の訴えや症状
- **O (Objective)**: 客観的情報 - 検査所見や観察結果
- **A (Assessment)**: 評価 - 診断や問題点の整理
- **P (Plan)**: 計画 - 治療方針や次回の予定

## 効果的な書き方

各セクションで必要な情報を漏れなく記録することが重要です。特に、主観的情報と客観的情報を明確に分けることで、診療の質が向上します。
    `,
    publishedAt: "2025-01-15",
    category: "使い方",
    slug: "soap-recording-guide",
  },
  "local-system-security": {
    id: "3",
    title: "ローカル完結型システムのセキュリティ対策",
    content: `
# ローカル完結型システムのセキュリティ対策

データを院内のPCに保存するローカル完結型システムでは、適切なセキュリティ対策が重要です。本記事では、実践的なセキュリティ対策の方法を解説します。

## 基本的な対策

1. **定期的なバックアップ**: データの紛失に備えて、定期的なバックアップを実施
2. **アクセス制御**: 適切なユーザー権限の設定
3. **パスワード管理**: 強固なパスワードの使用と定期的な変更

これらの対策により、安全にシステムを運用できます。
    `,
    publishedAt: "2025-01-10",
    category: "セキュリティ",
    slug: "local-system-security",
  },
};

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = blogPosts[params.slug];

  if (!post) {
    notFound();
  }

  return (
    <main
      className={`${notoSans.className} min-h-screen bg-white text-slate-900`}
    >
      <MarketingHeader />

      <article className="mx-auto w-full max-w-6xl px-4 py-12">
        <div className="mb-8">
          <Link href="/blog">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4" />
              コラム一覧に戻る
            </Button>
          </Link>
          <div className="mb-4 flex items-center gap-4 text-sm text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {post.category}
            </span>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <time dateTime={post.publishedAt}>
                {new Date(post.publishedAt).toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-slate-900">{post.title}</h1>
        </div>

        <div className="prose prose-slate max-w-none">
          <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">
            {post.content.split("\n").map((line, i) => {
              if (line.startsWith("# ")) {
                return (
                  <h2
                    key={i}
                    className="mt-8 mb-4 text-2xl font-semibold text-slate-900"
                  >
                    {line.replace("# ", "")}
                  </h2>
                );
              }
              if (line.startsWith("## ")) {
                return (
                  <h3
                    key={i}
                    className="mt-6 mb-3 text-xl font-semibold text-slate-900"
                  >
                    {line.replace("## ", "")}
                  </h3>
                );
              }
              if (line.startsWith("- ")) {
                return (
                  <li key={i} className="ml-6 list-disc">
                    {line.replace("- ", "")}
                  </li>
                );
              }
              if (line.trim() === "") {
                return <br key={i} />;
              }
              return (
                <p key={i} className="mb-4">
                  {line}
                </p>
              );
            })}
          </div>
        </div>
      </article>

      <MarketingFooter />
    </main>
  );
}
