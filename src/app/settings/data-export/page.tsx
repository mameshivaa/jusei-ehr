import { requireRole } from "@/lib/auth";
import { DataExportClient } from "@/components/settings/DataExportClient";

export default async function DataExportPage() {
  await requireRole("ADMIN");

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">
          データエクスポート
        </h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <DataExportClient />
        </div>
      </div>
    </main>
  );
}
