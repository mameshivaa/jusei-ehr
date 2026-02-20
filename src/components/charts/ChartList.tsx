"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { ChartCard, ChartCardData } from "./ChartCard";

type ChartListProps = {
  patientId: string;
  charts: ChartCardData[];
  canCreate?: boolean;
};

export function ChartList({
  patientId,
  charts,
  canCreate = true,
}: ChartListProps) {
  if (charts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 mb-4">カルテがありません</p>
        {canCreate && (
          <Link
            href={`/patients/${patientId}/charts/new`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            新規カルテ作成
          </Link>
        )}
      </div>
    );
  }

  return (
    <div>
      {canCreate && (
        <div className="flex justify-end mb-4">
          <Link
            href={`/patients/${patientId}/charts/new`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm"
          >
            <Plus className="h-4 w-4" />
            新規カルテ
          </Link>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {charts.map((chart) => (
          <ChartCard key={chart.id} chart={chart} />
        ))}
      </div>
    </div>
  );
}
