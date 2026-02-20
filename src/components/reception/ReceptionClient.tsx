"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Search, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListPanel, ListHeader } from "@/components/ui/ListPanel";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import Toolbar from "@/components/ui/Toolbar";
import { cn } from "@/lib/utils/cn";
import { getChartStatusLabel } from "@/lib/charts/status";

type PatientItem = {
  id: string;
  name: string;
  kana: string | null;
  patientNumber: string | null;
  birthDate: string | null;
  charts: {
    id: string;
    status: string;
    insuranceType: string | null;
    injuriesCount: number;
    visitsCount: number;
    lastVisit: string | null;
  }[];
};

type QueueItem = {
  id: string;
  visitDate: string;
  patient: {
    id: string;
    name: string;
    kana: string | null;
    patientNumber: string | null;
  };
};

const fmtDateTime = (value: string) =>
  format(new Date(value), "MM/dd HH:mm", { locale: ja });
const fmtDate = (value: string) =>
  format(new Date(value), "yyyy/MM/dd", { locale: ja });

export default function ReceptionClient() {
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 250);

  const fetchPatients = async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reception/all-charts${q ? `?q=${encodeURIComponent(q)}` : ""}`,
      );
      if (res.ok) {
        setPatients(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const res = await fetch("/api/reception/today");
      if (res.ok) setQueue(await res.json());
    } finally {
      setQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  useEffect(() => {
    fetchPatients(debouncedQuery);
  }, [debouncedQuery]);

  const handleCheckin = useCallback(
    async (patientId: string, chartId?: string) => {
      const res = await fetch("/api/reception/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, chartId }),
      });
      if (!res.ok) {
        alert("受付に失敗しました");
        return;
      }
      await fetchQueue();
      alert("受付しました");
    },
    [fetchQueue],
  );

  const handleCancel = useCallback(
    async (visitId: string) => {
      const ok = window.confirm("この受付を取り消しますか？");
      if (!ok) return;
      const res = await fetch(`/api/reception/checkin?id=${visitId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        alert("取り消しに失敗しました");
        return;
      }
      await fetchQueue();
    },
    [fetchQueue],
  );

  const queueRows = useMemo(
    () =>
      queue.map((item) => [
        <div key="name" className="space-y-0.5">
          <div className="font-medium text-slate-900">{item.patient.name}</div>
          <div className="text-xs text-slate-500">{item.patient.kana}</div>
        </div>,
        <div key="karte" className="text-sm text-slate-700">
          {item.patient.patientNumber || "—"}
        </div>,
        <div key="time" className="text-sm text-slate-900">
          {fmtDateTime(item.visitDate)}
        </div>,
        <div key="action" className="flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleCancel(item.id)}
          >
            <X className="h-4 w-4" />
            <span className="ml-1">取り消し</span>
          </Button>
        </div>,
      ]),
    [queue, handleCancel],
  );

  return (
    <div className="space-y-6">
      <ListPanel scroll="y" size="medium" className="p-0">
        <ListHeader className="px-4 py-3">
          <Toolbar className="mb-0">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-500" />
              <div className="text-sm font-semibold text-slate-800">
                患者検索
              </div>
            </div>
            <div className="text-xs text-slate-500">氏名/カナ/患者IDで検索</div>
          </Toolbar>
        </ListHeader>
        <div className="space-y-3 px-4 py-4">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="例: 山田 / ヤマダ / 12345"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchPatients(query)}
              loading={loading}
            >
              検索
            </Button>
          </div>

          {patients.length === 0 && !loading ? (
            <EmptyState
              title="患者が見つかりません"
              description="キーワードを変更して検索してください"
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {patients.map((p) => (
                <article
                  key={p.id}
                  className={cn(
                    "rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-slate-900">
                        {p.name}
                      </div>
                      <div className="text-xs text-slate-500">{p.kana}</div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleCheckin(p.id, p.charts[0]?.id)}
                    >
                      <Check className="h-4 w-4" />
                      <span className="ml-1">受付</span>
                    </Button>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-slate-600">
                    <div>患者ID: {p.patientNumber || "—"}</div>
                    {p.charts.length === 0 ? (
                      <div className="text-red-600">
                        カルテ未作成（受付時に自動作成）
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div>
                          カルテ: {p.charts.length}件 / 直近:{" "}
                          {p.charts[0].insuranceType || "標準カルテ"}
                        </div>
                        <div>
                          負傷: {p.charts[0].injuriesCount} 件 / 来院:{" "}
                          {p.charts[0].visitsCount} 回
                        </div>
                        {p.charts[0].lastVisit && (
                          <div>最終来院: {fmtDate(p.charts[0].lastVisit)}</div>
                        )}
                      </div>
                    )}
                    {p.charts.length > 1 && (
                      <div className="pt-1 text-[11px] text-slate-500">
                        他のカルテ:
                        {p.charts
                          .slice(1, 3)
                          .map(
                            (c) =>
                              ` ${c.insuranceType || "標準"}(${c.visitsCount}回)`,
                          )}
                        {p.charts.length > 3 && " …"}
                      </div>
                    )}
                  </div>
                  {p.charts.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-700">
                      {p.charts.map((c) => (
                        <button
                          key={c.id}
                          className="rounded-full border border-slate-200 px-3 py-1 hover:border-slate-300"
                          onClick={() => handleCheckin(p.id, c.id)}
                        >
                          {c.insuranceType || "標準"} / {c.visitsCount}回 /{" "}
                          {getChartStatusLabel(c.status)}
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </ListPanel>

      <ListPanel scroll="y" size="medium" className="p-0">
        <ListHeader className="px-4 py-3">
          <div className="text-sm font-semibold text-slate-800">
            本日の受付一覧
          </div>
        </ListHeader>
        <div className="px-2 py-3">
          {queueLoading ? (
            <div className="px-4 py-6 text-sm text-slate-500">
              読み込み中...
            </div>
          ) : queue.length === 0 ? (
            <EmptyState
              title="受付はまだありません"
              description="患者を検索して受付を登録してください"
            />
          ) : (
            <div className="overflow-x-auto">
              <DataTable
                density="compact"
                headers={["患者", "患者ID", "受付時刻", "操作"]}
                columnClasses={["w-2/5", "w-1/5", "w-1/5", "w-1/5 text-right"]}
                rows={queueRows}
              />
            </div>
          )}
        </div>
      </ListPanel>
    </div>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
