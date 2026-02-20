import Link from "next/link";

const companyInfo = {
  name: "Your Company Name",
  tagline: "医療現場を支えるソフトウェア開発",
};

export default function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 py-10 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-6 px-4 text-sm text-slate-500 md:flex-row">
        <div>
          <p className="font-semibold text-slate-700">{companyInfo.name}</p>
          <p className="mt-1">{companyInfo.tagline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <Link
            href="/privacy"
            className="hover:text-slate-900 transition-colors"
          >
            プライバシーポリシー
          </Link>
          <Link
            href="/terms"
            className="hover:text-slate-900 transition-colors"
          >
            利用規約
          </Link>
          <Link href="/blog" className="hover:text-slate-900 transition-colors">
            コラム
          </Link>
          <Link
            href="/landing"
            className="hover:text-slate-900 transition-colors"
          >
            ホーム
          </Link>
        </div>
      </div>
    </footer>
  );
}
