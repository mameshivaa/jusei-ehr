import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format, differenceInYears } from "date-fns";
import { ja } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import { AddVisitButton } from "@/components/patients/AddVisitButton";
import { createAccessLog } from "@/lib/security/access-log";
import { InjuryList } from "@/components/injuries/InjuryList";
import { InjuryCardData } from "@/components/injuries/InjuryCard";
import PatientDetailSection from "@/components/patients/detail/PatientDetailSection";
import PatientDetailSummary from "@/components/patients/detail/PatientDetailSummary";
import { ListHeader, ListPanel } from "@/components/ui/ListPanel";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import Toolbar from "@/components/ui/Toolbar";
import { getOrCreateDefaultChart } from "@/lib/charts/get-default-chart";
import { decryptInsuranceFields } from "@/lib/charts/insurance";
import { getChartStatusLabel, normalizeChartStatus } from "@/lib/charts/status";

export default async function PatientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireAuth();

  let patient = await prisma.patient.findUnique({
    where: { id: params.id, isDeleted: false },
    include: {
      _count: {
        select: { visits: true, injuries: true, charts: true },
      },
      visits: {
        orderBy: { visitDate: "desc" },
        take: 10,
      },
      injuries: {
        where: { isDeleted: false },
        orderBy: { injuryDate: "desc" },
        include: {
          _count: {
            select: { treatmentRecords: true },
          },
        },
      },
      charts: {
        orderBy: { updatedAt: "desc" },
        include: {
          _count: {
            select: { injuries: true, visits: true },
          },
          injuries: {
            where: { isDeleted: false },
            select: { id: true },
          },
          visits: {
            orderBy: { visitDate: "desc" },
            take: 1,
            select: { visitDate: true },
          },
        },
      },
    },
  });

  // カルテが存在しない場合はデフォルトカルテを作成して再取得
  if (patient && patient.charts.length === 0) {
    await getOrCreateDefaultChart(patient.id);
    patient = await prisma.patient.findUnique({
      where: { id: params.id, isDeleted: false },
      include: {
        _count: {
          select: { visits: true, injuries: true, charts: true },
        },
        visits: { orderBy: { visitDate: "desc" }, take: 10 },
        injuries: {
          where: { isDeleted: false },
          orderBy: { injuryDate: "desc" },
          include: { _count: { select: { treatmentRecords: true } } },
        },
        charts: {
          orderBy: { updatedAt: "desc" },
          include: {
            _count: { select: { injuries: true, visits: true } },
            injuries: { where: { isDeleted: false }, select: { id: true } },
            visits: {
              orderBy: { visitDate: "desc" },
              take: 1,
              select: { visitDate: true },
            },
          },
        },
      },
    });
  }

  if (!patient) {
    notFound();
  }

  // 負傷エピソードを整形
  const injuries: InjuryCardData[] = patient.injuries.map((injury) => ({
    ...injury,
    treatmentCount: injury._count.treatmentRecords,
  }));

  const charts = patient.charts.map((chart) => {
    const insurance = decryptInsuranceFields(chart);
    const visitsCount = chart._count?.visits ?? chart.visits.length ?? 0;
    const injuriesCount = chart._count?.injuries ?? chart.injuries.length ?? 0;
    const lastVisit = chart.visits[0]?.visitDate ?? chart.lastVisitDate ?? null;
    return {
      id: chart.id,
      status: normalizeChartStatus(chart.status),
      insuranceType: chart.insuranceType,
      insuranceNumber: insurance.insuranceNumber,
      insuranceInsurerNumber: insurance.insuranceInsurerNumber,
      firstVisitDate: chart.firstVisitDate,
      lastVisitDate: lastVisit,
      visitsCount,
      injuriesCount,
    };
  });

  const latestInsurance = patient.charts[0]
    ? decryptInsuranceFields(patient.charts[0])
    : null;

  const ageLabel = patient.birthDate
    ? `${differenceInYears(new Date(), new Date(patient.birthDate))}歳`
    : "—";
  const lastVisitLabel = patient.visits[0]
    ? format(new Date(patient.visits[0].visitDate), "yyyy年MM月dd日", {
        locale: ja,
      })
    : null;

  // 個人情報保護法対応：アクセスログを記録
  await createAccessLog({
    userId: user.id,
    entityType: "PATIENT",
    entityId: params.id,
    action: "VIEW",
  });

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/patients"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            患者一覧に戻る
          </Link>
        </div>

        <PatientDetailSummary
          name={patient.name}
          kana={patient.kana}
          patientId={patient.id}
          ageLabel={ageLabel}
          chartsCount={patient._count?.charts ?? charts.length}
          injuriesCount={patient._count?.injuries ?? patient.injuries.length}
          visitsCount={patient._count?.visits ?? patient.visits.length}
          lastVisitLabel={lastVisitLabel}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PatientDetailSection title="基本情報">
            <dl className="space-y-2">
              <DetailItem label="氏名" value={patient.name} />
              <DetailItem label="フリガナ" value={patient.kana} />
              {patient.birthDate && (
                <DetailItem
                  label="生年月日"
                  value={format(new Date(patient.birthDate), "yyyy年MM月dd日", {
                    locale: ja,
                  })}
                />
              )}
              <DetailItem label="性別" value={patient.gender} />
              <DetailItem label="患者ID" value={patient.patientNumber} />
              <DetailItem
                label="保険証番号（最新カルテ）"
                value={latestInsurance?.insuranceNumber ?? "—"}
              />
            </dl>
          </PatientDetailSection>

          <PatientDetailSection title="連絡先・住所" columns="one">
            <dl className="space-y-2">
              <DetailItem label="電話番号" value={patient.phone} />
              <DetailItem label="メールアドレス" value={patient.email} />
              <DetailItem label="住所" value={patient.address} />
              {patient.memo && (
                <DetailItem label="メモ" value={patient.memo} multiline />
              )}
            </dl>
          </PatientDetailSection>
        </div>

        <ListPanel scroll="y" size="medium" className="p-0">
          <ListHeader className="px-4 py-3">
            <div className="text-sm font-semibold text-slate-800">カルテ</div>
          </ListHeader>
          <div className="px-2 py-3">
            {charts.length === 0 ? (
              <EmptyState
                title="カルテがありません"
                description="来院や負傷登録を行うとカルテが作成されます"
              />
            ) : (
              <div className="overflow-x-auto">
                <DataTable
                  density="compact"
                  headers={["概要", "負傷", "来院", "開始", "最終", "状態"]}
                  rows={charts.map((chart) => [
                    <div key="summary" className="space-y-0.5">
                      <div className="font-medium text-slate-900">
                        {chart.insuranceType || "標準カルテ"}
                      </div>
                    </div>,
                    <div key="inj" className="text-sm text-slate-700">
                      {chart.injuriesCount}
                    </div>,
                    <div key="vis" className="text-sm text-slate-700">
                      {chart.visitsCount}
                    </div>,
                    <div key="first" className="text-sm text-slate-700">
                      {chart.firstVisitDate
                        ? format(new Date(chart.firstVisitDate), "yyyy/MM/dd", {
                            locale: ja,
                          })
                        : "—"}
                    </div>,
                    <div key="last" className="text-sm text-slate-700">
                      {chart.lastVisitDate
                        ? format(new Date(chart.lastVisitDate), "yyyy/MM/dd", {
                            locale: ja,
                          })
                        : "—"}
                    </div>,
                    <div key="status" className="text-sm text-slate-700">
                      {getChartStatusLabel(chart.status)}
                    </div>,
                  ])}
                />
              </div>
            )}
          </div>
        </ListPanel>

        <ListPanel scroll="y" size="medium" className="p-0">
          <ListHeader className="px-4 py-3">
            <Toolbar
              className="mb-0"
              right={<AddVisitButton patientId={patient.id} />}
            >
              <div className="text-sm font-semibold text-slate-800">
                来院履歴
              </div>
              <div className="text-xs text-slate-500">直近10件を表示</div>
            </Toolbar>
          </ListHeader>
          <div className="px-2 py-3">
            {patient.visits.length === 0 ? (
              <EmptyState
                title="来院履歴がありません"
                description="来院記録を追加してください"
              />
            ) : (
              <div className="overflow-x-auto">
                <DataTable
                  density="compact"
                  headers={["来院日", "施術録"]}
                  rows={patient.visits.map((visit) => [
                    <Link
                      key="date"
                      href={`/patients/${patient.id}/visits/${visit.id}`}
                      className="text-slate-900 underline decoration-slate-200 underline-offset-4 hover:text-slate-600"
                    >
                      {format(
                        new Date(visit.visitDate),
                        "yyyy年MM月dd日 HH:mm",
                        { locale: ja },
                      )}
                    </Link>,
                    <Link
                      key="record"
                      href={`/patients/${patient.id}/visits/${visit.id}/records/new`}
                      className="text-sm text-slate-600 hover:text-slate-800"
                    >
                      記録追加
                    </Link>,
                  ])}
                />
              </div>
            )}
          </div>
        </ListPanel>

        <ListPanel scroll="y" size="medium" className="p-0">
          <ListHeader className="px-4 py-3">
            <div className="text-sm font-semibold text-slate-800">
              負傷エピソード
            </div>
          </ListHeader>
          <div className="p-4">
            <InjuryList patientId={patient.id} initialInjuries={injuries} />
          </div>
        </ListPanel>
      </div>
    </main>
  );
}

function DetailItem({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value?: string | null;
  multiline?: boolean;
}) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd
        className={`text-sm text-slate-900 ${multiline ? "whitespace-pre-wrap" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
