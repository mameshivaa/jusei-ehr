import Link from "next/link";
import { Noto_Sans_JP } from "next/font/google";
import { ArrowLeft, Calendar } from "lucide-react";
import MarketingHeader from "@/components/marketing/Header";
import MarketingFooter from "@/components/marketing/Footer";

const notoSans = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// コラム記事の型定義
interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  category: string;
  slug: string;
}

// サンプル記事データ（後でAPIやCMSから取得するように変更可能）
const blogPosts: BlogPost[] = [
  {
    id: "1",
    title: "接骨院における電子カルテ導入のメリット",
    excerpt:
      "接骨院での電子カルテ導入により、記録の効率化や患者情報の管理が大幅に改善されます。本記事では、具体的なメリットと導入時の注意点について解説します。",
    publishedAt: "2025-01-20",
    category: "導入ガイド",
    slug: "benefits-of-electronic-medical-records",
  },
  {
    id: "2",
    title: "SOAP記録の書き方とポイント",
    excerpt:
      "SOAP形式での記録作成は、診療の質を向上させる重要な要素です。本記事では、効果的なSOAP記録の書き方と、よくある間違いを避けるポイントを紹介します。",
    publishedAt: "2025-01-15",
    category: "使い方",
    slug: "soap-recording-guide",
  },
  {
    id: "3",
    title: "ローカル完結型システムのセキュリティ対策",
    excerpt:
      "データを院内のPCに保存するローカル完結型システムでは、適切なセキュリティ対策が重要です。本記事では、実践的なセキュリティ対策の方法を解説します。",
    publishedAt: "2025-01-10",
    category: "セキュリティ",
    slug: "local-system-security",
  },
];

export default function BlogPage() {
  return (
    <main
      className={`${notoSans.className} min-h-screen bg-white text-slate-900`}
    >
      <MarketingHeader />

      <div className="mx-auto w-full max-w-6xl px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">コラム</h1>
          <p className="mt-4 text-lg text-slate-600">
            電子カルテの使い方や導入に関する情報、接骨院運営のヒントなどをお届けします。
          </p>
        </div>

        <div className="space-y-8">
          {blogPosts.map((post) => (
            <article
              key={post.id}
              className="rounded-2xl bg-white/80 backdrop-blur-sm p-6 hover:bg-white transition-all shadow-sm hover:shadow-md"
            >
              <div className="mb-3 flex items-center gap-4 text-sm text-slate-500">
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
              <h2 className="mb-2 text-2xl font-semibold text-slate-900">
                {post.title}
              </h2>
              <p className="mb-4 text-slate-600">{post.excerpt}</p>
              <Link
                href={`/blog/${post.slug}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-900 hover:text-slate-700"
              >
                続きを読む
                <ArrowLeft className="h-4 w-4 rotate-180" />
              </Link>
            </article>
          ))}
        </div>

        {blogPosts.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-slate-500">記事はまだ公開されていません。</p>
          </div>
        )}
      </div>

      <MarketingFooter />
    </main>
  );
}
