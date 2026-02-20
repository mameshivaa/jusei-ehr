import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TreatmentRecordForm } from "@/components/records/TreatmentRecordForm";

export default async function NewRecordPage({
  params,
}: {
  params: { id: string; visitId: string };
}) {
  await requireAuth();

  const visit = await prisma.visit.findUnique({
    where: { id: params.visitId },
    include: { patient: true },
  });

  if (!visit || visit.patientId !== params.id) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href={`/patients/${params.id}/visits/${params.visitId}`}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            来院記録に戻る
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">
            新規施術記録 - {visit.patient.name}
          </h1>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <TreatmentRecordForm visitId={params.visitId} patientId={params.id} />
        </div>
      </div>
    </main>
  );
}
