"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import PageHeader from "@/components/layout/PageHeader";
import ListEmptyState from "@/components/ui/ListEmptyState";
import { ListPanel } from "@/components/ui/ListPanel";
import { ListSearchBar } from "@/components/ui/ListSearchBar";
import {
  ListGridColumn,
  ListGridHeader,
  ListGridRow,
} from "@/components/ui/ListGrid";
import { Button } from "@/components/ui/button";
import { ChartStatusBadge } from "@/components/charts/ChartStatusBadge";
import ChartCreateModal from "@/components/charts/ChartCreateModal";
import {
  ChartDetailPayload,
  ChartDetailView,
} from "@/components/charts/ChartDetailView";
import {
  ACTIVE_CHART_STATUS,
  getChartStatusOptions,
  normalizeChartStatus,
} from "@/lib/charts/status";
import {
  daysSince,
  formatSlash,
  formatWeeksOnly,
  normalizeDate,
} from "@/lib/utils/date";
import { startOfMonth } from "date-fns";
import { ChartStatusValue } from "@/domain/entities/chart";
import RecordModal, {
  PatientDisplay,
  RecordHistoryEntry,
  RecordModalChart,
} from "@/components/records/RecordModal";

type ChartListItem = RecordModalChart;

type PatientDetail = {
  id: string;
  name: string;
  kana: string | null;
  patientNumber: string | null;
  gender: string | null;
  birthDate: string | null;
  phone?: string | null;
  email?: string | null;
  postalCode?: string | null;
  prefecture?: string | null;
  city?: string | null;
  address1?: string | null;
  address2?: string | null;
};

type StatusFilter = "ALL" | ChartStatusValue;
type DetailTab = "overview" | "pdf";

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "全件" },
  ...getChartStatusOptions().map((opt) => ({
    value: opt.value,
    label: opt.label,
  })),
];

const GRID_GAP = "gap-x-1.5 md:gap-x-2";
// compact: ID / 患者 / カルテ / 状態 / 操作 (5列)
// 操作列は2つのボタンを収容するため、十分な幅を確保
const GRID_COMPACT = [
  `grid-cols-[minmax(5.75rem,max-content)_minmax(8rem,0.85fr)_minmax(6rem,0.65fr)_minmax(7.5rem,0.85fr)_minmax(20rem,max-content)]`,
  GRID_GAP,
].join(" ");
// full: ID / 患者 / カルテ / 状態 / 初検日 / 操作 (6列)
const GRID_FULL = [
  `grid-cols-[minmax(5.75rem,max-content)_minmax(8rem,0.85fr)_minmax(6rem,0.65fr)_minmax(7.5rem,0.85fr)_minmax(7.5rem,0.75fr)_minmax(20rem,max-content)]`,
  GRID_GAP,
].join(" ");

const FIRST_VISIT_HIDE_WIDTH = 1100;

export default function ChartsPageClient() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const calendarRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | undefined>(
    undefined,
  );
  const [charts, setCharts] = useState<ChartListItem[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<Record<string, string>>({});
  const [selectedChart, setSelectedChart] = useState<ChartListItem | null>(
    null,
  );
  const [showModal, setShowModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [recordModal, setRecordModal] = useState<ChartListItem | null>(null);
  const [narrative, setNarrative] = useState("");
  const [visitDateStr, setVisitDateStr] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [recordSaving, setRecordSaving] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordDraftLoaded, setRecordDraftLoaded] = useState(false);
  const [recordHistory, setRecordHistory] = useState<RecordHistoryEntry[]>([]);
  const [recordHistoryLoading, setRecordHistoryLoading] = useState(false);
  const [recordHistoryError, setRecordHistoryError] = useState<string | null>(
    null,
  );
  const [scrollHistoryToken, setScrollHistoryToken] = useState(0);
  const [patientDetail, setPatientDetail] = useState<PatientDetail | null>(
    null,
  );
  const [patientDetailError, setPatientDetailError] = useState<string | null>(
    null,
  );
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);

  const mapRecordHistory = useCallback((detail: ChartDetailPayload) => {
    return (detail.recentRecords || []).map((rec) => {
      return {
        ...rec,
        milestoneLabel: (rec as any).milestoneLabel ?? null,
        updatedLabel: rec.updatedAt
          ? formatSlash(rec.updatedAt) || rec.updatedAt
          : "",
      } satisfies RecordHistoryEntry;
    });
  }, []);

  const fetchRecordHistory = useCallback(
    async (chartId: string) => {
      const res = await fetch(`/api/charts/${chartId}/detail`, {
        cache: "no-store",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (payload as any)?.error || "施術録の取得に失敗しました",
        );
      }
      const detail = payload as ChartDetailPayload;
      return mapRecordHistory(detail);
    },
    [mapRecordHistory],
  );

  const openRecordForChart = useCallback(async (chartId: string) => {
    setRecordError(null);
    try {
      const res = await fetch(`/api/charts/${chartId}/detail`, {
        cache: "no-store",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (payload as any)?.error || "カルテ概要の取得に失敗しました",
        );
      }
      const detail = payload as ChartDetailPayload;
      const normalizedStatus = normalizeChartStatus(
        detail.status ?? ACTIVE_CHART_STATUS,
      ) as ChartStatusValue;
      const normalizedStart = normalizeDate(detail.startDate || null);
      const normalizedEnd = normalizeDate(detail.endDate || null);
      const elapsed = normalizedStart
        ? (() => {
            const days = daysSince(normalizedStart);
            return `${Math.floor(days / 7)}w${days % 7}d`;
          })()
        : null;
      const chartItem: ChartListItem = {
        id: detail.id,
        status: normalizedStatus,
        insuranceType: detail.insuranceType ?? null,
        firstVisitDate: normalizedStart,
        lastVisitDate: normalizedEnd,
        elapsed,
        injuriesCount: detail.injuriesCount ?? 0,
        visitsCount: detail.visitsCount ?? 0,
        patient: {
          id: detail.patient.id,
          name: detail.patient.name,
          kana: detail.patient.kana ?? null,
          patientNumber: detail.patient.patientNumber ?? null,
        },
      };
      setRecordModal(chartItem);
    } catch (e) {
      setRecordError(
        e instanceof Error ? e.message : "カルテ概要の取得に失敗しました",
      );
    }
  }, []);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() =>
    startOfMonth(new Date()),
  );
  const [detail, setDetail] = useState<ChartDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const patientDisplay: PatientDisplay | null = useMemo(() => {
    if (!recordModal) return null;
    const p = patientDetail || {
      id: recordModal.patient.id,
      name: recordModal.patient.name,
      kana: recordModal.patient.kana,
      patientNumber: recordModal.patient.patientNumber,
      gender: null,
      birthDate: null,
    };
    const birth = p.birthDate ? new Date(p.birthDate) : null;
    const age =
      birth && !Number.isNaN(birth.getTime())
        ? Math.floor(
            (Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25),
          )
        : null;
    const addressParts = [
      p.postalCode ? `〒${p.postalCode}` : null,
      p.prefecture,
      p.city,
      p.address1,
      p.address2,
    ].filter(Boolean);
    return { ...p, age, addressText: addressParts.join(" ") };
  }, [patientDetail, recordModal]);

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;

    // 初期値を設定（DOM更新後、ペイント前に実行される）
    // useLayoutEffect内で直接呼び出すことで、確実にレイアウト後に実行される
    const width = node.getBoundingClientRect().width;
    if (width > 0) {
      setContainerWidth(width);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry?.contentRect?.width) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const setRowBusy = useCallback((chartId: string, next: boolean) => {
    setActionBusy((prev) => ({ ...prev, [chartId]: next }));
  }, []);

  const clearRowError = useCallback((chartId: string) => {
    setActionError((prev) => {
      const next = { ...prev };
      delete next[chartId];
      return next;
    });
  }, []);

  const setRowError = useCallback(
    (chartId: string, message: string | null | undefined) => {
      setActionError((prev) => {
        const next = { ...prev };
        if (typeof message === "string") {
          next[chartId] = message;
        } else {
          delete next[chartId];
        }
        return next;
      });
    },
    [],
  );

  const fetchCharts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status !== "ALL") params.set("status", status);
      const res = await fetch(
        `/api/charts/all${params.toString() ? `?${params.toString()}` : ""}`,
        { cache: "no-store" },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (payload as any)?.error || "カルテ一覧の取得に失敗しました",
        );
      }
      const data = Array.isArray(payload) ? (payload as ChartListItem[]) : [];
      setCharts(
        data.map((item) => {
          const normalizedStatus = normalizeChartStatus(
            item.status ?? ACTIVE_CHART_STATUS,
          ) as ChartStatusValue;
          return {
            ...item,
            status: normalizedStatus,
            firstVisitDate: normalizeDate(item.firstVisitDate || null),
            lastVisitDate: normalizeDate(item.lastVisitDate || null),
            elapsed: item.firstVisitDate
              ? (() => {
                  const normalized = normalizeDate(item.firstVisitDate);
                  if (!normalized) return null;
                  const days = daysSince(normalized);
                  return `${Math.floor(days / 7)}w${days % 7}d`;
                })()
              : null,
            patient: {
              ...item.patient,
              patientNumber: item.patient.patientNumber ?? null,
            },
          };
        }),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "カルテ一覧の取得に失敗しました",
      );
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    fetchCharts();
  }, [fetchCharts]);

  // URLパラメータからchartIdを取得してモーダルを開く
  useEffect(() => {
    const chartId = searchParams?.get("chartId");
    if (chartId && charts.length > 0 && !showModal) {
      const chart = charts.find((c) => c.id === chartId);
      if (chart) {
        setSelectedChart(chart);
        setDetailTab("overview");
        setShowModal(true);
        // URLからchartIdパラメータを削除
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        params.delete("chartId");
        const newSearch = params.toString();
        const newPath = `/charts${newSearch ? `?${newSearch}` : ""}`;
        router.replace(newPath as Route, { scroll: false });
      }
    }
  }, [charts, searchParams, showModal, router]);

  const loadDetail = useCallback(async () => {
    if (!selectedChart) return;
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/charts/${selectedChart.id}/detail`, {
        cache: "no-store",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (payload as any)?.error || "カルテ概要の取得に失敗しました",
        );
      }
      setDetail(payload as ChartDetailPayload);
    } catch (e) {
      setDetailError(
        e instanceof Error ? e.message : "カルテ概要の取得に失敗しました",
      );
    } finally {
      setDetailLoading(false);
    }
  }, [selectedChart]);

  useEffect(() => {
    if (showModal && selectedChart) {
      loadDetail();
    }
  }, [loadDetail, showModal, selectedChart]);

  // カレンダーポップアップを外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        calendarRef.current &&
        !calendarRef.current.contains(event.target as Node)
      ) {
        setCalendarOpen(false);
      }
    };
    if (calendarOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [calendarOpen]);

  // 選択された日付に合わせてカレンダーの月を更新
  useEffect(() => {
    if (visitDateStr) {
      try {
        const date = new Date(visitDateStr);
        if (!Number.isNaN(date.getTime())) {
          setCalendarMonth(startOfMonth(date));
        }
      } catch {
        // 無視
      }
    }
  }, [visitDateStr]);

  // draft load/save for modal記載
  useEffect(() => {
    if (!recordModal) {
      setRecordDraftLoaded(false);
      setRecordHistory([]);
      setRecordHistoryError(null);
      setRecordHistoryLoading(false);
      setPatientDetail(null);
      setPatientDetailError(null);
      return;
    }
    const key = `recordDraft-${recordModal.id}`;
    const saved =
      typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNarrative(parsed.narrative || "");
        setVisitDateStr(
          parsed.visitDateStr || new Date().toISOString().slice(0, 10),
        );
      } catch {
        setNarrative("");
        setVisitDateStr(new Date().toISOString().slice(0, 10));
      }
    } else {
      setNarrative("");
      setVisitDateStr(new Date().toISOString().slice(0, 10));
    }
    setRecordDraftLoaded(true);
  }, [recordModal]);

  useEffect(() => {
    if (!recordModal || !recordDraftLoaded) return;
    const key = `recordDraft-${recordModal.id}`;
    const payload = {
      narrative,
      visitDateStr,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  }, [narrative, recordModal, recordDraftLoaded, visitDateStr]);

  // load existing treatment records for modal
  useEffect(() => {
    if (!recordModal) return;
    let cancelled = false;
    const fetchHistory = async () => {
      setRecordHistoryLoading(true);
      setRecordHistoryError(null);
      try {
        const mapped = await fetchRecordHistory(recordModal.id);
        if (cancelled) return;
        setRecordHistory(mapped);
      } catch (e) {
        if (cancelled) return;
        setRecordHistoryError(
          e instanceof Error ? e.message : "施術録の取得に失敗しました",
        );
      } finally {
        if (!cancelled) setRecordHistoryLoading(false);
      }
    };
    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [fetchRecordHistory, recordModal]);

  // load patient detail for richer header
  useEffect(() => {
    if (!recordModal) return;
    let cancelled = false;
    const fetchPatientDetail = async () => {
      setPatientDetail(null);
      setPatientDetailError(null);
      try {
        const res = await fetch(`/api/patients/${recordModal.patient.id}`, {
          cache: "no-store",
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            (payload as any)?.error || "患者情報の取得に失敗しました",
          );
        }
        if (cancelled) return;
        setPatientDetail(payload as PatientDetail);
      } catch (e) {
        if (cancelled) return;
        setPatientDetailError(
          e instanceof Error ? e.message : "患者情報の取得に失敗しました",
        );
      }
    };
    fetchPatientDetail();
    return () => {
      cancelled = true;
    };
  }, [recordModal]);

  // load current user name
  useEffect(() => {
    let cancelled = false;
    const fetchMe = async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        const j = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error((j as any)?.error || "current user fetch failed");
        if (!cancelled) setCurrentUserName((j as any)?.name ?? null);
      } catch {
        if (!cancelled) setCurrentUserName(null);
      }
    };
    fetchMe();
    return () => {
      cancelled = true;
    };
  }, []);

  const closeRecordModal = useCallback(
    (force = false) => {
      if (!recordModal) return;
      const hasInput = narrative.trim();
      if (!force && hasInput && !recordSaving) {
        const ok = window.confirm("保存せずに閉じますか？");
        if (!ok) return;
      }
      const key = `recordDraft-${recordModal.id}`;
      localStorage.removeItem(key);
      setRecordModal(null);
      setNarrative("");
      setRecordError(null);
      setCalendarOpen(false);
      setCalendarMonth(startOfMonth(new Date()));
    },
    [narrative, recordModal, recordSaving],
  );

  const handleSubmitRecordModal = useCallback(
    async (chart: ChartListItem | null) => {
      if (!chart) return;
      setRecordSaving(true);
      setRecordError(null);
      const visitDate = new Date(visitDateStr);
      if (Number.isNaN(visitDate.getTime())) {
        setRecordError("日付の形式が不正です");
        setRecordSaving(false);
        return;
      }
      try {
        const res = await fetch("/api/visits/with-record", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: chart.patient.id,
            chartId: chart.id,
            injuryId: null,
            visitDate: visitDate.toISOString(),
            record: {
              narrative: narrative || null,
              isLegacyData: true,
            },
          }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            (payload as any)?.error || "施術録の登録に失敗しました",
          );
        }
        setNarrative("");
        setRecordHistoryLoading(true);
        setRecordHistoryError(null);
        try {
          const mapped = await fetchRecordHistory(chart.id);
          setRecordHistory(mapped);
          setScrollHistoryToken((prev) => prev + 1);
        } catch (e) {
          setRecordHistoryError(
            e instanceof Error ? e.message : "施術録の取得に失敗しました",
          );
        } finally {
          setRecordHistoryLoading(false);
        }
        fetchCharts();
      } catch (e) {
        setRecordError(
          e instanceof Error ? e.message : "施術録の登録に失敗しました",
        );
      } finally {
        setRecordSaving(false);
      }
    },
    [fetchCharts, fetchRecordHistory, narrative, visitDateStr],
  );

  // keyboard shortcuts (Ctrl/Cmd+S) for save inside record modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!recordModal) return;
      const isCmdS = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s";
      if (isCmdS) {
        e.preventDefault();
        void handleSubmitRecordModal(recordModal);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSubmitRecordModal, recordModal]);

  const searchCounts = useMemo(
    () => [{ label: "件数", value: charts.length, unit: "件" }],
    [charts],
  );

  const showFirstVisit = useMemo(
    () => (containerWidth ?? 0) >= FIRST_VISIT_HIDE_WIDTH,
    [containerWidth],
  );

  /**
   * 表示列とセルの定義を単一のソースで管理し、列数ズレを防ぐ
   */
  const columnDefs = useMemo(() => {
    const defs: Array<
      ListGridColumn & {
        render: (chart: ChartListItem) => JSX.Element;
      }
    > = [
      {
        id: "patientId",
        label: "患者ID",
        className: "text-slate-700",
        render: (chart) => (
          <div
            className="text-slate-800 font-mono whitespace-nowrap pr-1"
            title={`患者ID: ${chart.patient.id}`}
          >
            {chart.patient.patientNumber || chart.patient.id}
          </div>
        ),
      },
      {
        id: "patient",
        label: "氏名",
        className: "text-slate-700",
        render: (chart) => (
          <div className="leading-tight min-w-0 space-y-0.5">
            <div className="text-xs text-gray-500 whitespace-nowrap truncate">
              {chart.patient.kana || "—"}
            </div>
            <Link
              href={`/patients/${chart.patient.id}`}
              className="font-medium text-gray-900 hover:underline whitespace-nowrap truncate"
            >
              {chart.patient.name}
            </Link>
          </div>
        ),
      },
      {
        id: "chart",
        label: "カルテ",
        className: "text-slate-700",
        render: (chart) => (
          <div className="leading-tight text-gray-800 min-w-0 space-y-0.5">
            <div className="truncate">{chart.insuranceType || "—"}</div>
          </div>
        ),
      },
      {
        id: "status",
        label: "状態",
        className: "text-slate-700",
        render: (chart) => (
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 flex-nowrap">
              <ChartStatusBadge status={chart.status} size="md" />
            </div>
          </div>
        ),
      },
    ];

    if (showFirstVisit) {
      defs.push({
        id: "firstVisit",
        label: "初検日（経過週数）",
        className: "text-slate-700",
        render: (chart) => (
          <div className="text-gray-800 whitespace-nowrap tabular-nums">
            {formatSlash(chart.firstVisitDate) || "—"}
            {chart.elapsed ? `（${formatWeeksOnly(chart.elapsed)}）` : ""}
          </div>
        ),
      });
    }

    defs.push({
      id: "actions",
      label: <div className="text-right">操作</div>,
      className: "text-right text-slate-700 justify-self-end",
      render: (chart) => (
        <div className="text-right space-y-1 justify-self-end">
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              size="list"
              variant="secondary"
              onClick={() => {
                setSelectedChart(chart);
                setDetailTab("overview");
                setShowModal(true);
              }}
            >
              カルテ概要
            </Button>
            <Button
              size="list"
              onClick={() => {
                setRecordModal(chart);
                setRecordError(null);
                setNarrative("");
              }}
              disabled={Boolean(actionBusy[chart.id])}
            >
              {actionBusy[chart.id] ? "処理中…" : "施術録記載"}
            </Button>
          </div>
          {actionError[chart.id] ? (
            <div className="text-[11px] text-red-600">
              {actionError[chart.id]}
            </div>
          ) : null}
        </div>
      ),
    });

    return defs;
  }, [
    actionBusy,
    actionError,
    showFirstVisit,
    setRecordModal,
    setRecordError,
    setNarrative,
    setSelectedChart,
    setDetailTab,
    setShowModal,
  ]);

  const columns: ListGridColumn[] = useMemo(
    () =>
      columnDefs.map(({ id, label, className }) => ({ id, label, className })),
    [columnDefs],
  );

  // 列数に合わせてグリッド定義を決定（列の増減とテンプレートのズレを防ぐ）
  const gridClassName = useMemo(
    () => (columnDefs.length === 6 ? GRID_FULL : GRID_COMPACT),
    [columnDefs.length],
  );

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="カルテ管理"
        subtitle="すべてのカルテを検索・閲覧できます"
      />

      <ListSearchBar
        query={q}
        placeholder="患者名/カナ/患者IDで検索"
        loading={loading}
        onQueryChange={setQ}
        onSearch={fetchCharts}
        counts={searchCounts}
        right={
          <Button size="list" onClick={() => setShowCreateModal(true)}>
            新規カルテ作成
          </Button>
        }
        filters={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500">状態</span>
            <div
              className="inline-flex flex-wrap items-center gap-1 rounded-md border border-slate-300 bg-white p-1"
              role="group"
              aria-label="状態で絞り込み"
            >
              {STATUS_FILTER_OPTIONS.map((opt) => {
                const active = status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={`h-7 rounded-md px-3 text-sm transition-colors ${
                      active
                        ? "bg-slate-200 text-slate-900"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                    aria-pressed={active}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        }
      />

      <div ref={containerRef}>
        <ListPanel>
          {containerWidth === undefined ? (
            <ListEmptyState
              variant="loading"
              message="レイアウトを読み込み中..."
            />
          ) : (
            <>
              <ListGridHeader columns={columns} gridClassName={gridClassName} />
              <div className="divide-y">
                {error ? (
                  <ListEmptyState
                    variant="error"
                    message={error}
                    action={
                      <button
                        type="button"
                        className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 hover:bg-slate-50"
                        onClick={fetchCharts}
                        disabled={loading}
                      >
                        再読み込み
                      </button>
                    }
                  />
                ) : loading && charts.length === 0 ? (
                  <ListEmptyState
                    variant="loading"
                    message="カルテ一覧を読み込み中..."
                  />
                ) : charts.length === 0 ? (
                  <ListEmptyState message="カルテがありません" />
                ) : (
                  charts.map((chart) => {
                    const cells = columnDefs.map((def) => def.render(chart));

                    return (
                      <ListGridRow
                        key={chart.id}
                        columns={columns}
                        gridClassName={gridClassName}
                        className="hover:bg-slate-50 transition-colors"
                        cells={cells}
                      />
                    );
                  })
                )}
              </div>
            </>
          )}
        </ListPanel>
      </div>

      {showModal && selectedChart
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="カルテ概要"
              onClick={() => setShowModal(false)}
            >
              <div
                className="flex h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                {detailLoading ? (
                  <div className="px-6 py-10 flex items-center justify-center gap-3 text-sm text-slate-600">
                    <svg
                      className="h-5 w-5 animate-spin text-slate-500"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      ></path>
                    </svg>
                    読み込み中…
                  </div>
                ) : detailError ? (
                  <div className="px-6 py-8 space-y-3">
                    <div className="text-base text-slate-900">
                      カルテ概要を取得できませんでした
                    </div>
                    <div className="text-sm text-slate-600 break-words">
                      {detailError}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="list"
                        variant="secondary"
                        onClick={loadDetail}
                      >
                        再取得
                      </Button>
                      <Button
                        size="list"
                        variant="outline"
                        onClick={() => setShowModal(false)}
                      >
                        閉じる
                      </Button>
                    </div>
                  </div>
                ) : detail ? (
                  <ChartDetailView
                    chart={detail}
                    backHref="/charts"
                    onBack={() => setShowModal(false)}
                    initialTab={detailTab}
                  />
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}

      <ChartCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        enableOpenRecordPreference
        onCreated={(chart, options) => {
          void fetchCharts();
          if (options?.openRecordAfterCreate ?? true) {
            void openRecordForChart(chart.id);
          }
        }}
      />

      {recordModal ? (
        <RecordModal
          recordModal={recordModal}
          patientDisplay={patientDisplay}
          patientDetailError={patientDetailError}
          recordHistory={recordHistory}
          recordHistoryLoading={recordHistoryLoading}
          recordHistoryError={recordHistoryError}
          scrollHistoryToBottomToken={scrollHistoryToken}
          calendarOpen={calendarOpen}
          setCalendarOpen={setCalendarOpen}
          calendarMonth={calendarMonth}
          setCalendarMonth={setCalendarMonth}
          visitDateStr={visitDateStr}
          setVisitDateStr={setVisitDateStr}
          narrative={narrative}
          setNarrative={setNarrative}
          currentUserName={currentUserName}
          recordError={recordError}
          recordSaving={recordSaving}
          closeRecordModal={closeRecordModal}
          handleSubmitRecordModal={handleSubmitRecordModal}
          calendarRef={calendarRef}
        />
      ) : null}
    </div>
  );
}
