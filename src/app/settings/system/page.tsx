import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notFound } from "next/navigation";
import { SystemSettingsClient } from "@/components/settings/SystemSettingsClient";

export default async function SystemSettingsPage() {
  const user = await requireRole("ADMIN");

  const clinic = await prisma.clinic.findFirst();

  if (!clinic) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">システム設定</h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <SystemSettingsClient clinic={clinic} />
        </div>
      </div>
    </main>
  );
}
