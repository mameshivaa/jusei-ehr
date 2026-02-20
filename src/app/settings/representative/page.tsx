import { requireRole } from "@/lib/auth";
import { RepresentativeBindingClient } from "@/components/settings/RepresentativeBindingClient";
import { redirect } from "next/navigation";

export default async function RepresentativePage() {
  try {
    await requireRole("ADMIN");
  } catch {
    redirect("/patients");
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">
          代表Googleアカウント
        </h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <RepresentativeBindingClient />
        </div>
      </div>
    </main>
  );
}
