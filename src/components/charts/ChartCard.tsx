"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { ChartStatus } from "@prisma/client";
import { ChartStatusBadge } from "./ChartStatusBadge";
import { FileText, Calendar, Activity } from "lucide-react";

export type ChartCardData = {
  id: string;
  patientId: string;
  status: ChartStatus;
  insuranceType: string | null;
  firstVisitDate: Date | string | null;
  lastVisitDate: Date | string | null;
  injuryCount: number;
  visitCount: number;
  injuries?: Array<{ id: string; injuryName: string }>;
};

type ChartCardProps = {
  chart: ChartCardData;
  showLink?: boolean;
};

export function ChartCard({ chart, showLink = true }: ChartCardProps) {
  const firstVisit = chart.firstVisitDate
    ? format(new Date(chart.firstVisitDate), "yyyy/MM/dd", { locale: ja })
    : "—";
  const lastVisit = chart.lastVisitDate
    ? format(new Date(chart.lastVisitDate), "yyyy/MM/dd", { locale: ja })
    : "—";

  const content = (
    <div className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-slate-400" />
          <span className="font-medium text-slate-900">
            {chart.insuranceType || "カルテ"}
          </span>
        </div>
        <ChartStatusBadge status={chart.status} />
      </div>

      {/* 傷病一覧 */}
      {chart.injuries && chart.injuries.length > 0 && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-1">
            {chart.injuries.slice(0, 3).map((injury) => (
              <span
                key={injury.id}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700"
              >
                {injury.injuryName}
              </span>
            ))}
            {chart.injuries.length > 3 && (
              <span className="text-xs text-slate-500">
                +{chart.injuries.length - 3}件
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 text-sm text-slate-500">
        <div className="flex items-center gap-1">
          <Activity className="h-4 w-4" />
          <span>傷病 {chart.injuryCount}件</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          <span>来院 {chart.visitCount}回</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>初診: {firstVisit}</span>
        <span>最終: {lastVisit}</span>
      </div>
    </div>
  );

  if (showLink) {
    return (
      <Link href={`/patients/${chart.patientId}/charts/${chart.id}`}>
        {content}
      </Link>
    );
  }

  return content;
}
