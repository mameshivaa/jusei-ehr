import React from "react";

type SummaryMetric = {
  label: string;
  value: React.ReactNode;
  hint?: string;
};

type PatientSummaryProps = {
  name: string;
  kana?: string | null;
  patientId: string;
  ageLabel: string;
  dup?: boolean | null;
  chartsCount?: number | null;
  injuriesCount?: number | null;
  visitsCount?: number | null;
  lastVisitLabel?: string | null;
};

export default function PatientDetailSummary({
  name,
  kana,
  patientId,
  ageLabel,
  dup,
  chartsCount,
  injuriesCount,
  visitsCount,
  lastVisitLabel,
}: PatientSummaryProps) {
  const metrics: SummaryMetric[] = [
    { label: "カルテ数", value: chartsCount ?? "—" },
    { label: "負傷エピソード", value: injuriesCount ?? "—" },
    { label: "来院回数", value: visitsCount ?? "—" },
    lastVisitLabel ? { label: "最終来院", value: lastVisitLabel } : null,
  ].filter(Boolean) as SummaryMetric[];

  return (
    <section className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-5 py-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-xl font-semibold text-slate-900">{name}</h2>
            {dup && (
              <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                重複の可能性
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            {kana && <span>{kana}</span>}
            <span>年齢: {ageLabel}</span>
            <span className="font-mono text-xs text-slate-500">
              ID: {patientId}
            </span>
          </div>
        </div>
        {metrics.length > 0 && (
          <div className="grid w-full gap-3 sm:grid-cols-3 md:w-auto">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm"
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {metric.label}
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {metric.value}
                </div>
                {metric.hint && (
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    {metric.hint}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
