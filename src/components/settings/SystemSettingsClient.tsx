"use client";

import Link from "next/link";
import { UpdateChecker } from "@/components/ui/UpdateNotification";

type Clinic = {
  id: string;
};

export function SystemSettingsClient({ clinic: _clinic }: { clinic: Clinic }) {
  return (
    <div className="space-y-8">
      {/* システム文書へのリンク */}
      <section>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">
          システム文書
        </h2>
        <div className="space-y-2">
          <Link
            href="/docs"
            className="block text-slate-600 hover:text-slate-900 text-sm font-medium"
          >
            システム文書一覧 →
          </Link>
          <Link
            href="/docs/current-master-index"
            className="block text-slate-600 hover:text-slate-900 text-sm font-medium"
          >
            Current統合索引
          </Link>
          <Link
            href="/docs/current-operations"
            className="block text-slate-600 hover:text-slate-900 text-sm"
          >
            Current運用仕様
          </Link>
          <Link
            href="/docs/current-change-and-release-control"
            className="block text-slate-600 hover:text-slate-900 text-sm"
          >
            変更管理・リリース統制
          </Link>
          <Link
            href="/docs/current-raci"
            className="block text-slate-600 hover:text-slate-900 text-sm"
          >
            RACI（責任分担）
          </Link>
          <Link
            href="/docs/current-vendor-handover-checklist"
            className="block text-slate-600 hover:text-slate-900 text-sm"
          >
            委託先引継ぎチェックリスト
          </Link>
          <Link
            href="/docs/current-security-baseline"
            className="block text-slate-600 hover:text-slate-900 text-sm"
          >
            セキュリティ基準
          </Link>
          <Link
            href="/docs/current-incident-response-playbook"
            className="block text-slate-600 hover:text-slate-900 text-sm"
          >
            インシデント対応手順
          </Link>
          <Link
            href="/docs/current-document-control-policy"
            className="block text-slate-600 hover:text-slate-900 text-sm"
          >
            文書統制規程
          </Link>
          <Link
            href="/docs/current-traceability-matrix"
            className="block text-slate-600 hover:text-slate-900 text-sm"
          >
            トレーサビリティマトリクス
          </Link>
        </div>
      </section>

      {/* データエクスポート・インポート */}
      <section className="mt-8 pt-6 border-t border-slate-200">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">
          データエクスポート・インポート
        </h2>
        <p className="text-sm text-slate-600 mb-4">
          ガイドライン「システム設計の見直し（標準化対応）」に準拠し、標準形式または変換が容易な形式でデータをエクスポート・インポートできます。
        </p>
        <div className="space-y-2">
          <Link
            href="/settings/data-export"
            className="block text-slate-600 hover:text-slate-900 text-sm font-medium"
          >
            データエクスポート →
          </Link>
          <Link
            href="/settings/data-import"
            className="block text-slate-600 hover:text-slate-900 text-sm font-medium"
          >
            データインポート →
          </Link>
        </div>
      </section>

      {/* バージョン情報・自動更新 */}
      <section className="mt-8 pt-6 border-t border-slate-200">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">
          バージョン情報
        </h2>
        <UpdateChecker />
      </section>
    </div>
  );
}
