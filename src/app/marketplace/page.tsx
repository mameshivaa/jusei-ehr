import { requireAuth } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
import MarketplaceClient from "@/components/settings/MarketplaceClient";

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  await requireAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        <PageHeader
          title="拡張マーケットプレイス"
          description="公式カタログから拡張機能を検索・導入できます"
          contentOnly
        />
        <MarketplaceClient />
      </div>
    </div>
  );
}
