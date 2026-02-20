import { requireAuth } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function ExtensionsLandingPage() {
  await requireAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        <PageHeader
          title="拡張機能"
          description="拡張機能ストアは現在準備中です"
          contentOnly
        />
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-600">
            拡張機能の配布・インストール機能は今後提供予定です。
          </p>
          <p className="mt-2 text-xs text-slate-500">
            本番運用ではカルテ機能を中心にご利用ください。
          </p>
        </div>
      </div>
    </div>
  );
}
