import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ChartForm } from "@/components/charts/ChartForm";
import { hasPermission } from "@/lib/rbac";
import { UserRole } from "@prisma/client";
import { decryptInsuranceFields } from "@/lib/charts/insurance";

export default async function NewChartPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireAuth();

  // 権限チェック
  if (!hasPermission(user.role as UserRole, "CHART", "CREATE")) {
    redirect(`/patients/${params.id}`);
  }

  // 患者の存在確認
  const patient = await prisma.patient.findUnique({
    where: { id: params.id, isDeleted: false },
    select: { id: true, name: true, kana: true },
  });

  if (!patient) {
    notFound();
  }

  const latestChart = await prisma.chart.findFirst({
    where: { patientId: patient.id },
    orderBy: { createdAt: "desc" },
  });

  const previousInsurance = latestChart
    ? decryptInsuranceFields(latestChart)
    : null;
  const previousInsuranceForForm = previousInsurance
    ? {
        insuranceNumber: previousInsurance.insuranceNumber ?? undefined,
        insuranceInsurerNumber:
          previousInsurance.insuranceInsurerNumber ?? undefined,
        insuranceCertificateSymbol:
          previousInsurance.insuranceCertificateSymbol ?? undefined,
        insuranceCertificateNumber:
          previousInsurance.insuranceCertificateNumber ?? undefined,
        insuranceExpiryDate: previousInsurance.insuranceExpiryDate ?? undefined,
        insuranceEffectiveFrom:
          previousInsurance.insuranceEffectiveFrom ?? undefined,
        insuranceCopaymentRate:
          previousInsurance.insuranceCopaymentRate ?? undefined,
        publicAssistanceNumber:
          previousInsurance.publicAssistanceNumber ?? undefined,
        publicAssistanceRecipient:
          previousInsurance.publicAssistanceRecipient ?? undefined,
      }
    : null;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <Link
            href={`/patients/${patient.id}`}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            患者詳細に戻る
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">新規カルテ作成</h1>
          <p className="text-slate-500 mt-1">
            {patient.name}（{patient.kana}）
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <ChartForm
            patientId={patient.id}
            previousInsurance={previousInsuranceForForm}
          />
        </div>
      </div>
    </main>
  );
}
