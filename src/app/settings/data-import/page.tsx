import { requireRole } from "@/lib/auth";
import { DataImportClient } from "@/components/settings/DataImportClient";

export default async function DataImportPage() {
  await requireRole("ADMIN");

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">
          データインポート
        </h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <DataImportClient />
        </div>
      </div>
    </main>
  );
}
