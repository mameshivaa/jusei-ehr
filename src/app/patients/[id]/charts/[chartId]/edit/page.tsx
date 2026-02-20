import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ChartForm } from "@/components/charts/ChartForm";
import { hasPermission } from "@/lib/rbac";
import { UserRole } from "@prisma/client";
import { decryptInsuranceFields } from "@/lib/charts/insurance";

export default async function EditChartPage({
  params,
}: {
  params: { id: string; chartId: string };
}) {
  const user = await requireAuth();

  // 権限チェック
  if (!hasPermission(user.role as UserRole, "CHART", "UPDATE")) {
    redirect(`/patients/${params.id}/charts/${params.chartId}`);
  }

  // カルテ取得
  const chart = await prisma.chart.findUnique({
    where: { id: params.chartId },
    include: {
      patient: {
        select: { id: true, name: true, kana: true },
      },
    },
  });

  if (!chart || chart.patientId !== params.id) {
    notFound();
  }

  const insurance = decryptInsuranceFields(chart);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <Link
            href={`/patients/${chart.patientId}/charts/${chart.id}`}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            カルテ概要に戻る
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">カルテ編集</h1>
          <p className="text-slate-500 mt-1">
            {chart.patient.name}（{chart.patient.kana}）
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <ChartForm
            patientId={chart.patientId}
            initialData={{
              id: chart.id,
              insuranceType: chart.insuranceType,
              status: chart.status,
              insuranceNumber: insurance.insuranceNumber ?? "",
              insuranceInsurerNumber: insurance.insuranceInsurerNumber ?? "",
              insuranceCertificateSymbol:
                insurance.insuranceCertificateSymbol ?? "",
              insuranceCertificateNumber:
                insurance.insuranceCertificateNumber ?? "",
              insuranceExpiryDate: insurance.insuranceExpiryDate ?? "",
              insuranceEffectiveFrom: insurance.insuranceEffectiveFrom ?? "",
              insuranceCopaymentRate: insurance.insuranceCopaymentRate ?? "",
              publicAssistanceNumber: insurance.publicAssistanceNumber ?? "",
              publicAssistanceRecipient:
                insurance.publicAssistanceRecipient ?? "",
            }}
            isEdit
            previousInsurance={{
              insuranceNumber: insurance.insuranceNumber ?? undefined,
              insuranceInsurerNumber:
                insurance.insuranceInsurerNumber ?? undefined,
              insuranceCertificateSymbol:
                insurance.insuranceCertificateSymbol ?? undefined,
              insuranceCertificateNumber:
                insurance.insuranceCertificateNumber ?? undefined,
              insuranceExpiryDate: insurance.insuranceExpiryDate ?? undefined,
              insuranceEffectiveFrom:
                insurance.insuranceEffectiveFrom ?? undefined,
              insuranceCopaymentRate:
                insurance.insuranceCopaymentRate ?? undefined,
              publicAssistanceNumber:
                insurance.publicAssistanceNumber ?? undefined,
              publicAssistanceRecipient:
                insurance.publicAssistanceRecipient ?? undefined,
            }}
          />
        </div>
      </div>
    </main>
  );
}
