import { requireRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProxyOperationsClient } from "@/components/settings/ProxyOperationsClient";

export default async function ProxyOperationsPage() {
  try {
    await requireRole("ADMIN");
  } catch {
    redirect("/patients");
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">
          代行操作の承認
        </h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <ProxyOperationsClient />
        </div>
      </div>
    </main>
  );
}
