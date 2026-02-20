import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TreatmentRecordForm } from "@/components/records/TreatmentRecordForm";

export default async function EditRecordPage({
  params,
}: {
  params: { id: string; visitId: string; recordId: string };
}) {
  await requireAuth();

  const record = await prisma.treatmentRecord.findUnique({
    where: { id: params.recordId, isDeleted: false },
    include: {
      visit: {
        include: {
          patient: true,
        },
      },
      treatmentDetails: {
        include: {
          procedure: {
            select: { id: true, code: true, name: true, defaultPrice: true },
          },
        },
      },
    },
  });

  if (!record || record.visit.patientId !== params.id) {
    notFound();
  }

  // 施術明細を整形
  const formattedRecord = {
    ...record,
    treatmentDetails: record.treatmentDetails.map((d) => ({
      id: d.id,
      procedureId: d.procedureId,
      procedureName: d.procedure.name,
      bodyPart: d.bodyPart,
      quantity: d.quantity,
      unitPrice: d.unitPrice,
    })),
  };

  // 既存データ（injuryIdがnull）の場合はisLegacyData
  const isLegacyData = !record.injuryId;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href={`/patients/${params.id}/visits/${params.visitId}/records/${params.recordId}`}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            施術記録に戻る
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">
            施術記録編集 - {record.visit.patient.name}
          </h1>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <TreatmentRecordForm
            record={formattedRecord}
            visitId={params.visitId}
            patientId={params.id}
            isLegacyData={isLegacyData}
          />
        </div>
      </div>
    </main>
  );
}
