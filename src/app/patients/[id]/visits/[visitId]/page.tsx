import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { ArrowLeft, Plus, Edit } from "lucide-react";
import { TreatmentRecordList } from "@/components/records/TreatmentRecordList";

export default async function VisitDetailPage({
  params,
}: {
  params: { id: string; visitId: string };
}) {
  await requireAuth();

  const visit = await prisma.visit.findUnique({
    where: { id: params.visitId },
    include: {
      patient: true,
      treatmentRecords: {
        where: { isDeleted: false },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          narrative: true,
          createdAt: true,
          updatedAt: true,
          isConfirmed: true,
          confirmedAt: true,
          digitalSignature: true,
          updatedByUser: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (!visit) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href={`/patients/${params.id}`}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            患者詳細に戻る
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                {visit.patient.name} - 来院記録
              </h1>
              <p className="text-slate-600 mt-1">
                {format(new Date(visit.visitDate), "yyyy年MM月dd日 HH:mm", {
                  locale: ja,
                })}
              </p>
            </div>
            <Link
              href={`/patients/${params.id}/visits/${params.visitId}/records/new`}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              施術記録を追加
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md">
          <TreatmentRecordList
            records={visit.treatmentRecords}
            visitId={params.visitId}
            patientId={params.id}
          />
        </div>
      </div>
    </main>
  );
}
