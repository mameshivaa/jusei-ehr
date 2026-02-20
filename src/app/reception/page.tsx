"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "framer-motion";
import PageHeader from "@/components/layout/PageHeader";
import ListEmptyState from "@/components/ui/ListEmptyState";
import { ListPanel } from "@/components/ui/ListPanel";
import { Button } from "@/components/ui/button";
import { HeaderToday } from "@/components/ui/HeaderToday";
import { ListSearchBar } from "@/components/ui/ListSearchBar";
import {
  ListGridColumn,
  ListGridHeader,
  ListGridRow,
} from "@/components/ui/ListGrid";
import { ChartDetailPayload } from "@/components/charts/ChartDetailView";
import { ChartStatusBadge } from "@/components/charts/ChartStatusBadge";
import { ChartSummaryEntity, ChartStatusValue } from "@/domain/entities/chart";
import RecordModal, {
  PatientDisplay,
  RecordHistoryEntry,
  RecordModalChart,
} from "@/components/records/RecordModal";
import {
  daysSince,
  formatHM,
  formatSlash,
  formatWeeksOnly,
  normalizeDate,
} from "@/lib/utils/date";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format as formatDateFn,
  startOfMonth,
} from "date-fns";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

type ChartWithPatient = ChartSummaryEntity;
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

// 6列: 患者ID / 氏名 / カルテ / 状態 / 初検日 / 操作 (幅が広い場合)
// 操作列は2つのボタンを収容するため、十分な幅を確保
const RECEPTION_GRID_CLASS_FULL = [
  "grid-cols-[minmax(5.5rem,6.5rem)_minmax(10rem,0.95fr)_minmax(7rem,0.75fr)_minmax(7rem,0.75fr)_minmax(9rem,0.85fr)_minmax(13rem,max-content)]",
  "gap-x-1.5 md:gap-x-2",
].join(" ");

// 5列: 患者ID / 氏名 / カルテ / 状態 / 操作 (幅が狭い場合、初検日を非表示)
// 操作ボタンを常に表示するため、狭い画面では初検日列を省略
const RECEPTION_GRID_CLASS_COMPACT = [
  "grid-cols-[minmax(5.5rem,6.5rem)_minmax(9rem,0.9fr)_minmax(6rem,0.7fr)_minmax(6rem,0.65fr)_minmax(13rem,max-content)]",
  "gap-x-1.5 md:gap-x-2",
].join(" ");

// 初検日列を非表示にする閾値幅（px）
const RECEPTION_FIRST_VISIT_HIDE_WIDTH = 900;

// 「記載待ち」タブ用グリッド定義
// sm未満では4列（時刻列なし）、sm以上では5列（時刻列あり）
// hidden/block ではなくグリッドテンプレート自体を breakpoint で変更することで、列のズレを防止
// 操作列は2つのボタンを収容するため、十分な幅を確保
const PENDING_GRID_CLASS_SM = [
  // 4列: 患者ID / 氏名 / カルテ / 操作（sm未満）
  "grid-cols-[minmax(5.5rem,6.5rem)_minmax(9rem,1fr)_minmax(6rem,0.75fr)_minmax(11rem,max-content)]",
  "gap-x-1.5",
].join(" ");
const PENDING_GRID_CLASS_MD = [
  // 5列: 患者ID / 氏名 / カルテ / 時刻 / 操作（sm以上）
  "grid-cols-[minmax(5.5rem,6.5rem)_minmax(9rem,0.9fr)_minmax(6rem,0.7fr)_minmax(5.5rem,0.6fr)_minmax(11rem,max-content)]",
  "gap-x-1.5 md:gap-x-2",
].join(" ");

// sm breakpoint は 640px
const PENDING_TIME_COLUMN_WIDTH = 640;

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const toDateKey = (d: Date) => {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
};

const parseDateKey = (value?: string | null) => {
  if (!value || !DATE_KEY_RE.test(value)) return null;
  const dt = new Date(`${value}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const shiftDateKey = (value: string, offset: number) => {
  const base = parseDateKey(value) ?? new Date();
  const next = new Date(base);
  next.setDate(base.getDate() + offset);
  return toDateKey(next);
};

const toIsoAtLocalMidnight = (value: string) => {
  const base = parseDateKey(value) ?? new Date();
  return base.toISOString();
};

const getTodayKey = () => toDateKey(new Date());

export default function ReceptionPage() {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const calendarRef = useRef<HTMLDivElement | null>(null);
  const receptionContainerRef = useRef<HTMLDivElement | null>(null);
  const pendingContainerRef = useRef<HTMLDivElement | null>(null);
  const pendingRequestIdRef = useRef(0);
  const pendingAbortRef = useRef<AbortController | null>(null);
  const [receptionContainerWidth, setReceptionContainerWidth] = useState<
    number | undefined
  >(undefined);
  const [pendingContainerWidth, setPendingContainerWidth] = useState<
    number | undefined
  >(undefined);
  const [allCharts, setAllCharts] = useState<ChartWithPatient[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [checkedIn, setCheckedIn] = useState<Record<string, string>>({});
  const [checkedInAt, setCheckedInAt] = useState<Record<string, number>>({});
  const [flash, setFlash] = useState<Record<string, number>>({});
  const [recentMove, setRecentMove] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [recentReturn, setRecentReturn] = useState<{ id: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<Record<string, string>>({});
  const [sortDir, setSortDir] = useState<"asc" | "desc">(() => {
    try {
      return (
        (localStorage.getItem("ui.pref.reception.sortDir") as "asc" | "desc") ||
        "asc"
      );
    } catch {
      return "asc";
    }
  });
  const [selectedChart, setSelectedChart] = useState<ChartWithPatient | null>(
    null,
  );
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"reception" | "pending">(
    "reception",
  );
  const [pendingItems, setPendingItems] = useState<
    {
      id: string;
      chartId: string | null;
      chartInsuranceType: string | null;
      visitDate: string;
      patient: {
        id: string;
        name: string;
        kana?: string | null;
        patientNumber?: string | null;
      };
    }[]
  >([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [pendingBusy, setPendingBusy] = useState<Record<string, boolean>>({});
  const [recordModal, setRecordModal] = useState<ChartListItem | null>(null);
  const [recordSaving, setRecordSaving] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordDraftLoaded, setRecordDraftLoaded] = useState(false);
  const [narrative, setNarrative] = useState("");
  const [selectedDateStr, setSelectedDateStr] = useState(() => getTodayKey());
  const [visitDateStr, setVisitDateStr] = useState(() => getTodayKey());
  const [recordHistory, setRecordHistory] = useState<RecordHistoryEntry[]>([]);
  const [recordHistoryLoading, setRecordHistoryLoading] = useState(false);
  const [recordHistoryError, setRecordHistoryError] = useState<string | null>(
    null,
  );
  const [checkedInLoading, setCheckedInLoading] = useState(false);
  const [patientDetail, setPatientDetail] = useState<PatientDetail | null>(
    null,
  );
  const [patientDetailError, setPatientDetailError] = useState<string | null>(
    null,
  );
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() =>
    startOfMonth(new Date()),
  );
  const [pendingQ, setPendingQ] = useState("");

  const prefersReduced = useReducedMotion();
  const LAYOUT_DUR = 0.34;
  const FADE_DUR = 0.22;
  const todayKey = getTodayKey();
  const isSelectedDateToday = selectedDateStr === todayKey;

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

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // 「受付」タブのコンテナ幅を検出し、初検日列の表示を決定
  useLayoutEffect(() => {
    const node = receptionContainerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const width = node.getBoundingClientRect().width;
    if (width > 0) {
      setReceptionContainerWidth(width);
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry?.contentRect?.width) {
        setReceptionContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // 「記載待ち」タブのコンテナ幅を検出し、時刻列の表示を決定
  useLayoutEffect(() => {
    const node = pendingContainerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const width = node.getBoundingClientRect().width;
    if (width > 0) {
      setPendingContainerWidth(width);
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry?.contentRect?.width) {
        setPendingContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // record draft load
  useEffect(() => {
    if (!recordModal) return;
    const key = `recordDraft-${recordModal.id}`;
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      setNarrative(saved);
    } else {
      setNarrative("");
    }
    setRecordDraftLoaded(true);
  }, [recordModal]);

  // record draft save
  useEffect(() => {
    if (!recordModal || !recordDraftLoaded) return;
    const key = `recordDraft-${recordModal.id}`;
    localStorage.setItem(key, narrative);
  }, [narrative, recordDraftLoaded, recordModal]);

  const fetchRecordHistory = useCallback(async (chartId: string) => {
    setRecordHistoryLoading(true);
    setRecordHistoryError(null);
    try {
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
      const mapped = (detail.recentRecords || []).map((rec) => ({
        ...rec,
        milestoneLabel: (rec as any).milestoneLabel ?? null,
        updatedLabel: "",
      }));
      setRecordHistory(mapped);
    } catch (e) {
      setRecordHistoryError(
        e instanceof Error ? e.message : "施術録の取得に失敗しました",
      );
    } finally {
      setRecordHistoryLoading(false);
    }
  }, []);

  // load record history for modal
  useEffect(() => {
    if (!recordModal) return;
    fetchRecordHistory(recordModal.id);
  }, [recordModal, fetchRecordHistory]);

  // load patient detail for modal
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

  const loadAllCharts = useCallback(
    async (reset = false) => {
      setLoading(true);
      if (reset) setLoadError(null);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        const res = await fetch(
          `/api/reception/all-charts?${params.toString()}`,
        );
        const j = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(
            (j as any)?.error || "来院受付リストの取得に失敗しました",
          );

        // v-oss API は患者ベースの配列なのでカルテ単位にフラット化する
        const charts: ChartWithPatient[] = Array.isArray(j)
          ? (j as any[]).flatMap((p: any) =>
              (p.charts || []).map((c: any) => {
                const firstVisitDate = normalizeDate(
                  c.firstVisitDate || c.firstVisit || null,
                );
                const days = firstVisitDate ? daysSince(firstVisitDate) : null;
                const elapsed =
                  days === null ? null : `${Math.floor(days / 7)}w${days % 7}d`;

                return {
                  id: String(c.id),
                  status: c.status,
                  insuranceType: c.insuranceType,
                  firstVisitDate,
                  lastVisitDate: normalizeDate(c.lastVisit),
                  elapsed,
                  patient: {
                    id: String(p.id),
                    name: p.name,
                    kana: p.kana,
                    patientNumber: p.patientNumber ?? null,
                  },
                };
              }),
            )
          : [];

        setAllCharts((prev) => (reset ? charts : [...prev, ...charts]));
        setHasMore(false);
        setLoadError(null);
      } catch (err) {
        const message =
          err instanceof Error &&
          err.message &&
          err.message !== "Failed to fetch"
            ? err.message
            : "来院受付リストの取得に失敗しました";
        setLoadError(message);
        if (reset) {
          setAllCharts([]);
          setHasMore(false);
        }
      } finally {
        setLoading(false);
      }
    },
    [q],
  );

  useEffect(() => {
    loadAllCharts(true);
  }, [loadAllCharts]);

  const loadPending = useCallback(async () => {
    const requestId = ++pendingRequestIdRef.current;
    pendingAbortRef.current?.abort();
    const controller = new AbortController();
    pendingAbortRef.current = controller;

    setPendingLoading(true);
    setPendingError(null);
    try {
      const query = selectedDateStr
        ? `?date=${encodeURIComponent(selectedDateStr)}`
        : "";
      const res = await fetch(`/api/visits/pending${query}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (j as any)?.error || "記載待ち一覧の取得に失敗しました",
        );
      }
      const pending = Array.isArray(j)
        ? (j as any[]).map((v) => ({
            id: String(v.id),
            chartId: v.chartId ?? v.chart?.id ?? null,
            chartInsuranceType:
              v.chart?.insuranceType ?? v.chartInsuranceType ?? null,
            visitDate: v.visitDate,
            patient: v.patient,
          }))
        : [];
      if (pendingRequestIdRef.current !== requestId) return;
      setPendingItems(pending);
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      if (pendingRequestIdRef.current !== requestId) return;
      const msg =
        err instanceof Error ? err.message : "記載待ち一覧の取得に失敗しました";
      setPendingError(msg);
      setPendingItems([]);
    } finally {
      if (pendingRequestIdRef.current === requestId) {
        pendingAbortRef.current = null;
        setPendingLoading(false);
      }
    }
  }, [selectedDateStr]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  useEffect(() => {
    return () => {
      pendingAbortRef.current?.abort();
    };
  }, []);

  const loadCheckedIn = useCallback(async () => {
    setCheckedInLoading(true);
    try {
      const query = selectedDateStr
        ? `?date=${encodeURIComponent(selectedDateStr)}`
        : "";
      const res = await fetch(`/api/reception/today${query}`, {
        cache: "no-store",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((j as any)?.error || "受付一覧の取得に失敗しました");
      }
      const nextCheckedIn: Record<string, string> = {};
      const nextCheckedInAt: Record<string, number> = {};
      if (Array.isArray(j)) {
        for (const v of j) {
          const chartId = v?.chartId || v?.chart?.id;
          if (!chartId || !v?.id) continue;
          nextCheckedIn[String(chartId)] = String(v.id);
          const ts = Date.parse(String(v.visitDate || ""));
          if (!Number.isNaN(ts)) {
            nextCheckedInAt[String(chartId)] = ts;
          }
        }
      }
      setCheckedIn(nextCheckedIn);
      setCheckedInAt(nextCheckedInAt);
    } catch {
      setCheckedIn({});
      setCheckedInAt({});
    } finally {
      setCheckedInLoading(false);
    }
  }, [selectedDateStr]);

  useEffect(() => {
    loadCheckedIn();
  }, [loadCheckedIn]);

  useEffect(() => {
    setCheckedIn({});
    setCheckedInAt({});
    setFlash({});
    setRecentMove(null);
    setRecentReturn(null);
    setErrorMsg({});
    setPendingItems([]);
    setPendingError(null);
  }, [selectedDateStr]);

  const checkin = useCallback(
    async (chart: ChartWithPatient) => {
      const chartId = chart.id;
      if (checkedInLoading) {
        setErrorMsg((prev) => ({
          ...prev,
          [chartId]: "受付状況を読み込み中です",
        }));
        return;
      }
      if (checkedIn[chartId]) {
        const visitId = checkedIn[chartId];
        setBusy((prev) => ({ ...prev, [chartId]: true }));
        setErrorMsg((prev) => ({ ...prev, [chartId]: "" }));
        try {
          const r = await fetch(
            `/api/reception/checkin?id=${encodeURIComponent(visitId)}`,
            { method: "DELETE" },
          );
          const j = await r.json().catch(() => ({}));
          if (!r.ok || j?.error) throw new Error(j?.error || "cancel_failed");
          setCheckedIn((prev) => {
            const n = { ...prev };
            delete n[chartId];
            return n;
          });
          setCheckedInAt((prev) => {
            const n = { ...prev };
            delete n[chartId];
            return n;
          });
          setFlash((prev) => ({ ...prev, [chartId]: Date.now() }));
          setTimeout(() => {
            setFlash((prev) => {
              const n = { ...prev };
              delete n[chartId];
              return n;
            });
          }, 1600);
        } catch {
          setErrorMsg((prev) => ({
            ...prev,
            [chartId]: "取り消しに失敗しました",
          }));
        } finally {
          setBusy((prev) => ({ ...prev, [chartId]: false }));
        }
        return;
      }

      setBusy((prev) => ({ ...prev, [chartId]: true }));
      setErrorMsg((prev) => ({ ...prev, [chartId]: "" }));
      try {
        const visitDate = isSelectedDateToday
          ? new Date().toISOString()
          : toIsoAtLocalMidnight(selectedDateStr);
        const r = await fetch("/api/reception/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: chart.patient.id,
            chartId,
            visitDate,
          }),
        });
        const j = await r.json().catch(() => ({}));
        const visitId = j?.id || j?.visitId;
        if (!r.ok || !visitId) throw new Error(j?.error || "checkin_failed");
        setCheckedIn((prev) => ({ ...prev, [chartId]: String(visitId) }));
        setCheckedInAt((prev) => ({ ...prev, [chartId]: Date.now() }));

        // 即座に記載待ちタブへ反映（ローカル追加）し、移動アニメーションを表示
        const pendingEntry = {
          id: String(visitId),
          chartId,
          chartInsuranceType: chart.insuranceType || null,
          visitDate,
          patient: {
            id: chart.patient.id,
            name: chart.patient.name,
            kana: chart.patient.kana,
            patientNumber: chart.patient.patientNumber,
          },
        };
        setPendingItems((prev) => [pendingEntry, ...prev]);
        setRecentMove({ id: pendingEntry.id, name: chart.patient.name });
        setTimeout(
          () =>
            setRecentMove((cur) => (cur?.id === pendingEntry.id ? null : cur)),
          1000,
        );
        void loadPending(); // サーバーの真値で再同期
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "受付登録に失敗しました";
        setErrorMsg((prev) => ({
          ...prev,
          [chartId]: msg,
        }));
      } finally {
        setBusy((prev) => ({ ...prev, [chartId]: false }));
      }
    },
    [
      checkedIn,
      checkedInLoading,
      isSelectedDateToday,
      loadPending,
      selectedDateStr,
    ],
  );

  const rightContent = (
    <HeaderToday
      dateStr={selectedDateStr}
      onPrev={() => setSelectedDateStr((prev) => shiftDateKey(prev, -1))}
      onToday={() => setSelectedDateStr(todayKey)}
      onNext={() => setSelectedDateStr((prev) => shiftDateKey(prev, 1))}
    />
  );

  const visibleCharts = useMemo(() => {
    const items = allCharts.filter((c) => !checkedIn[c.id]);

    const cmpBlankLast = (aBlank: boolean, bBlank: boolean) => {
      if (aBlank && bBlank) return 0;
      if (aBlank) return 1;
      if (bBlank) return -1;
      return 0;
    };

    const numKey = (s?: string | null) => {
      if (!s) return NaN;
      const n = parseInt(String(s).replace(/\D+/g, ""), 10);
      return Number.isFinite(n) ? n : NaN;
    };
    const cmpNumber = (a: number, b: number) => {
      const aBlank = Number.isNaN(a);
      const bBlank = Number.isNaN(b);
      const blank = cmpBlankLast(aBlank, bBlank);
      if (blank !== 0) return blank;
      return sortDir === "asc" ? a - b : b - a;
    };

    const cmp = (a: ChartWithPatient, b: ChartWithPatient) =>
      cmpNumber(
        numKey(a.patient.patientNumber || a.patient.id),
        numKey(b.patient.patientNumber || b.patient.id),
      );

    return items.slice().sort(cmp);
  }, [allCharts, checkedIn, sortDir]);

  const toggleSortDir = useCallback(() => {
    const next = sortDir === "asc" ? "desc" : "asc";
    setSortDir(next);
    try {
      localStorage.setItem("ui.pref.reception.sortDir", next);
    } catch {}
  }, [sortDir]);

  const handleSearch = useCallback(() => {
    setAllCharts([]);
    setHasMore(false);
    loadAllCharts(true);
  }, [loadAllCharts]);

  const searchCounts = useMemo(() => {
    const waiting = allCharts.filter((c) => !checkedIn[c.id]).length;
    const accepted = Object.keys(checkedIn).length;
    return [
      { label: "未受付", value: waiting, unit: "件" },
      { label: "受付済み", value: accepted, unit: "件" },
    ];
  }, [allCharts, checkedIn]);

  const pendingFiltered = useMemo(() => {
    const keyword = pendingQ.trim().toLowerCase();
    if (!keyword) return pendingItems;
    return pendingItems.filter((v) => {
      const p = v.patient;
      return (
        p.name.toLowerCase().includes(keyword) ||
        (p.kana || "").toLowerCase().includes(keyword) ||
        (p.patientNumber || "").toLowerCase().includes(keyword) ||
        p.id.toLowerCase().includes(keyword)
      );
    });
  }, [pendingItems, pendingQ]);

  const handlePendingCancel = useCallback(
    async (visitId: string) => {
      setPendingBusy((b) => ({ ...b, [visitId]: true }));
      try {
        const res = await fetch(
          `/api/reception/checkin?id=${encodeURIComponent(visitId)}`,
          { method: "DELETE" },
        );
        const j = await res.json().catch(() => ({}));
        if (!res.ok || j?.error) throw new Error(j?.error || "cancel_failed");
        setPendingItems((prev) => prev.filter((v) => v.id !== visitId));
        setRecentReturn({ id: visitId });
        setTimeout(
          () => setRecentReturn((cur) => (cur?.id === visitId ? null : cur)),
          1000,
        );
        // checkedIn stateは chartIdキーなので、同じvisitIdを参照しているものを除外
        const chartEntry = Object.entries(checkedIn).find(
          ([, vId]) => vId === visitId,
        );
        if (chartEntry) {
          const chartId = chartEntry[0];
          setCheckedIn((prev) => {
            const n = { ...prev };
            delete n[chartId];
            return n;
          });
          setCheckedInAt((prev) => {
            const n = { ...prev };
            delete n[chartId];
            return n;
          });
        }
      } catch {
        alert("取り消しに失敗しました");
      } finally {
        setPendingBusy((b) => {
          const n = { ...b };
          delete n[visitId];
          return n;
        });
      }
    },
    [checkedIn],
  );

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
        // モーダルを閉じずに登録結果だけ反映
        setRecordError(null);
        const key = `recordDraft-${chart.id}`;
        localStorage.removeItem(key);
        setNarrative("");
        void fetchRecordHistory(chart.id);
        void loadPending();
      } catch (e) {
        setRecordError(
          e instanceof Error ? e.message : "施術録の登録に失敗しました",
        );
      } finally {
        setRecordSaving(false);
      }
    },
    [fetchRecordHistory, loadPending, narrative, visitDateStr],
  );

  const handlePendingRecord = useCallback(
    (item: { id: string; patient: { id: string }; chartId: string | null }) => {
      if (!item.chartId) {
        return;
      }
      const target = pendingItems.find((p) => p.id === item.id);
      const stub: ChartListItem = {
        id: item.chartId,
        status: "IN_TREATMENT",
        insuranceType: target?.chartInsuranceType ?? null,
        firstVisitDate: null,
        lastVisitDate: null,
        elapsed: null,
        patient: {
          id: item.patient.id,
          name: target?.patient.name || "",
          kana: target?.patient.kana || null,
          patientNumber: target?.patient.patientNumber || null,
        },
        injuriesCount: 0,
        visitsCount: 0,
      };
      setVisitDateStr(selectedDateStr);
      const baseDate = parseDateKey(selectedDateStr);
      if (baseDate) {
        setCalendarMonth(startOfMonth(baseDate));
      }
      setRecordModal(stub);
    },
    [pendingItems, selectedDateStr],
  );

  // keyboard shortcut for modal save
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

  // 受付タブ: 初検日列の表示判定（幅が広い場合のみ表示）
  const showReceptionFirstVisit = useMemo(
    () => (receptionContainerWidth ?? 0) >= RECEPTION_FIRST_VISIT_HIDE_WIDTH,
    [receptionContainerWidth],
  );

  // 受付タブ: 列数に応じたグリッドクラス
  const receptionGridClassName = useMemo(
    () =>
      showReceptionFirstVisit
        ? RECEPTION_GRID_CLASS_FULL
        : RECEPTION_GRID_CLASS_COMPACT,
    [showReceptionFirstVisit],
  );

  // 列定義を1か所に集約し、columns / cells のずれを防止
  const receptionColumnDefs = useMemo(() => {
    const defs: Array<
      ListGridColumn & { render: (c: ChartWithPatient) => JSX.Element }
    > = [
      {
        id: "patientId",
        label: (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
            onClick={toggleSortDir}
            title="クリックで昇順/降順を切替"
            aria-label="患者IDで並び替え"
          >
            患者ID
            <span
              className="ml-1 text-[11px] opacity-60 hover:opacity-100 transition-opacity"
              aria-hidden
            >
              {sortDir === "asc" ? "▴" : "▾"}
            </span>
          </button>
        ),
        className: undefined,
        render: (c: ChartWithPatient) => (
          <div
            className="text-scale-emphasis text-slate-700 font-mono whitespace-nowrap"
            title={`患者ID: ${c.patient.id}`}
          >
            {c.patient.patientNumber || c.patient.id}
          </div>
        ),
      },
      {
        id: "patient",
        label: "氏名",
        className: undefined,
        render: (c: ChartWithPatient) => (
          <div className="leading-tight min-w-0">
            <div className="text-xs text-gray-500 whitespace-nowrap truncate">
              {c.patient.kana}
            </div>
            <div className="font-medium text-gray-900 whitespace-nowrap truncate">
              {c.patient.name}
            </div>
          </div>
        ),
      },
      {
        id: "karte",
        label: "カルテ",
        className: undefined,
        render: (c: ChartWithPatient) => (
          <div className="leading-tight text-gray-800 min-w-0">
            <div className="truncate">{c.insuranceType || "—"}</div>
          </div>
        ),
      },
      {
        id: "status",
        label: "状態",
        className: undefined,
        render: (c: ChartWithPatient) => (
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 flex-nowrap">
              <ChartStatusBadge status={c.status ?? "IN_TREATMENT"} size="md" />
            </div>
          </div>
        ),
      },
    ];

    // 幅が広い場合のみ初検日列を追加
    if (showReceptionFirstVisit) {
      defs.push({
        id: "firstVisit",
        label: "初検日（経過週数）",
        className: undefined,
        render: (c: ChartWithPatient) => (
          <div className="text-gray-800 whitespace-nowrap tabular-nums">
            {formatSlash(c.firstVisitDate) || "—"}
            {c.elapsed ? `（${formatWeeksOnly(c.elapsed)}）` : ""}
          </div>
        ),
      });
    }

    // 操作列は常に最後に追加（必ず表示）
    defs.push({
      id: "actions",
      label: <div className="text-right w-full">操作</div>,
      className: "text-right",
      render: (c: ChartWithPatient) => (
        <div className="text-right">
          <div className="inline-flex items-center gap-2 justify-end w-full">
            <Button
              size="list"
              variant="outline"
              onClick={() => {
                setSelectedChart(c);
                setShowModal(true);
              }}
              className="whitespace-nowrap"
            >
              カルテ概要
            </Button>
            <Button
              size="list"
              variant="primary"
              className="px-3.5 min-w-[6.75rem] whitespace-nowrap"
              loading={busy[c.id]}
              loadingText="処理中…"
              disabled={!!busy[c.id] || checkedInLoading}
              onClick={() => checkin(c)}
            >
              受付登録
            </Button>
          </div>
          {errorMsg[c.id] && (
            <div className="mt-1 text-xs text-red-600">{errorMsg[c.id]}</div>
          )}
        </div>
      ),
    });

    return defs;
  }, [
    busy,
    checkin,
    checkedInLoading,
    errorMsg,
    setSelectedChart,
    setShowModal,
    showReceptionFirstVisit,
    sortDir,
    toggleSortDir,
  ]);

  const receptionColumns: ListGridColumn[] = useMemo(
    () =>
      receptionColumnDefs.map(({ id, label, className }) => ({
        id,
        label,
        className,
      })),
    [receptionColumnDefs],
  );

  // 「記載待ち」タブ: 時刻列の表示判定（幅640px以上で表示）
  const showPendingTime = useMemo(
    () =>
      (pendingContainerWidth ?? 0) >= PENDING_TIME_COLUMN_WIDTH &&
      isSelectedDateToday,
    [pendingContainerWidth, isSelectedDateToday],
  );

  // 「記載待ち」タブ: 列定義（時刻列は幅に応じて動的に追加/削除）
  const pendingColumns: ListGridColumn[] = useMemo(() => {
    const cols: ListGridColumn[] = [
      { id: "patientId", label: "患者ID" },
      { id: "patient", label: "氏名" },
      { id: "karte", label: "カルテ", className: "text-left" },
    ];
    if (showPendingTime) {
      cols.push({ id: "time", label: "受付時刻", className: "text-left" });
    }
    cols.push({
      id: "actions",
      label: <div className="text-right w-full">操作</div>,
      className: "text-right",
    });
    return cols;
  }, [showPendingTime]);

  // 「記載待ち」タブ: 列数に応じたグリッドクラス
  const pendingGridClassName = useMemo(
    () => (showPendingTime ? PENDING_GRID_CLASS_MD : PENDING_GRID_CLASS_SM),
    [showPendingTime],
  );

  const showInitialLoading = loading && allCharts.length === 0 && !loadError;
  const showInitialError = Boolean(loadError) && allCharts.length === 0;

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="来院受付"
        subtitle="患者を検索し、カルテを選んで来院受付を完了します"
      />
      <div className="flex gap-2 border-b border-slate-200">
        <motion.button
          type="button"
          onClick={() => setActiveTab("reception")}
          className={`px-3 py-2 text-sm font-medium border-b-2 ${
            activeTab === "reception"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          animate={
            recentReturn && !prefersReduced
              ? {
                  scale: 1.06,
                  color: "#0f172a",
                  textShadow:
                    "0 0 8px rgba(15,23,42,0.25), 0 0 16px rgba(15,23,42,0.2)",
                }
              : {
                  scale: 1,
                  color:
                    activeTab === "reception" ? "#0f172a" : "rgb(100 116 139)",
                  textShadow: "0 0 0 rgba(0,0,0,0)",
                }
          }
          transition={{ duration: 0.5, ease: EASE_OUT }}
          aria-current={activeTab === "reception" ? "page" : undefined}
        >
          受付
          {recentReturn ? (
            <motion.span
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0.35, scaleX: 0 }}
              animate={{ opacity: [0.35, 0.65, 0], scaleX: [0, 1.08, 0.45] }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              style={{
                background:
                  "radial-gradient(120% 120% at 10% 50%, rgba(15,23,42,0.12), transparent 65%)",
              }}
              aria-hidden
            />
          ) : null}
        </motion.button>
        <motion.button
          type="button"
          onClick={() => setActiveTab("pending")}
          className={`relative px-3 py-2 text-sm font-medium border-b-2 flex items-center gap-2 ${
            activeTab === "pending"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          animate={
            recentMove && !prefersReduced
              ? {
                  scale: 1.06,
                  color: "#0f172a",
                  textShadow:
                    "0 0 8px rgba(15,23,42,0.25), 0 0 16px rgba(15,23,42,0.2)",
                }
              : {
                  scale: 1,
                  color:
                    activeTab === "pending" ? "#0f172a" : "rgb(100 116 139)",
                  textShadow: "0 0 0 rgba(0,0,0,0)",
                }
          }
          transition={{ duration: 0.5, ease: EASE_OUT }}
          aria-current={activeTab === "pending" ? "page" : undefined}
        >
          記載待ち
          {pendingItems.length > 0 && (
            <motion.span
              className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 text-xs font-semibold text-white bg-slate-700 rounded-full shadow-sm"
              animate={
                !prefersReduced
                  ? {
                      scale: [1, 1.2, 1],
                      rotate: [0, 8, -8, 0],
                      y: [0, -2, 0],
                    }
                  : {}
              }
              transition={{
                duration: 0.8,
                repeat: Infinity,
                repeatDelay: 4,
                ease: "easeInOut",
              }}
            >
              {pendingItems.length}
            </motion.span>
          )}
          {recentMove ? (
            <motion.span
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0.35, scaleX: 0 }}
              animate={{ opacity: [0.35, 0.65, 0], scaleX: [0, 1.08, 0.45] }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              style={{
                background:
                  "radial-gradient(120% 120% at 90% 50%, rgba(15,23,42,0.12), transparent 65%)",
              }}
              aria-hidden
            />
          ) : null}
        </motion.button>
      </div>

      {/* Spark animations removed; use tab glow only */}

      {activeTab === "reception" ? (
        <>
          <ListSearchBar
            query={q}
            placeholder="検索（患者ID/かな/氏名）"
            loading={loading}
            inputRef={inputRef}
            onQueryChange={setQ}
            onSearch={handleSearch}
            onQuickAction={() => {
              const first = visibleCharts[0];
              if (first && !busy[first.id] && !checkedInLoading) {
                checkin(first);
              }
            }}
            counts={searchCounts}
            right={rightContent}
          />

          <div ref={receptionContainerRef}>
            <LayoutGroup>
              <ListPanel listRootId="1">
                <ListGridHeader
                  columns={receptionColumns}
                  gridClassName={receptionGridClassName}
                />

                <div className="divide-y">
                  {showInitialLoading ? (
                    <ListEmptyState
                      variant="loading"
                      message="来院受付リストを読み込み中..."
                    />
                  ) : showInitialError ? (
                    <ListEmptyState
                      variant="error"
                      message={
                        loadError || "来院受付リストの取得に失敗しました"
                      }
                      action={
                        <Button
                          size="list"
                          variant="outline"
                          onClick={() => loadAllCharts(true)}
                          disabled={loading}
                        >
                          再読み込み
                        </Button>
                      }
                    />
                  ) : visibleCharts.length === 0 ? (
                    <ListEmptyState
                      message={
                        Object.keys(checkedIn).length > 0
                          ? "未受付の患者はありません（受付済みあり）"
                          : "未受付の患者はありません"
                      }
                    />
                  ) : (
                    <AnimatePresence initial={false}>
                      {visibleCharts.map((c) => (
                        <motion.div
                          key={c.id}
                          layout
                          layoutId={`chart-${c.id}`}
                          initial={
                            prefersReduced
                              ? false
                              : { opacity: 1, y: 0, scale: 1 }
                          }
                          exit={
                            prefersReduced
                              ? {}
                              : {
                                  opacity: 0,
                                  y: -8,
                                  scale: 0.97,
                                  transition: { duration: 0.5, ease: EASE_OUT },
                                }
                          }
                          transition={
                            prefersReduced
                              ? { duration: 0 }
                              : {
                                  layout: {
                                    duration: LAYOUT_DUR,
                                    ease: EASE_OUT,
                                  },
                                  opacity: {
                                    duration: FADE_DUR,
                                    ease: EASE_OUT,
                                  },
                                }
                          }
                        >
                          <ListGridRow
                            columns={receptionColumns}
                            gridClassName={receptionGridClassName}
                            className={`origin-left hover:bg-slate-50 transition-colors ${flash[c.id] ? "bg-[var(--surface-2)]" : ""}`}
                            cells={receptionColumnDefs.map((def) =>
                              def.render(c),
                            )}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                </div>

                {hasMore && (
                  <div className="p-2 flex justify-center border-t">
                    <Button
                      size="list"
                      variant="outline"
                      onClick={() => loadAllCharts(false)}
                      className="px-3"
                    >
                      さらに読み込む
                    </Button>
                  </div>
                )}
              </ListPanel>
            </LayoutGroup>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              className="h-9 border border-slate-300 rounded-md px-3 text-sm"
              placeholder="検索（患者ID/かな/氏名/患者ID）"
              value={pendingQ}
              onChange={(e) => setPendingQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") loadPending();
              }}
            />
            <Button
              size="list"
              variant="secondary"
              onClick={loadPending}
              disabled={pendingLoading}
              className="whitespace-nowrap"
            >
              {pendingLoading ? "再読み込み中…" : "再読み込み"}
            </Button>
            <Button
              size="list"
              variant="outline"
              onClick={() => setPendingQ("")}
              disabled={pendingLoading || pendingQ.length === 0}
              className="px-2 text-slate-700 hover:text-slate-900"
            >
              クリア
            </Button>
            <div className="ml-2 inline-flex items-center gap-1 text-base text-slate-700">
              <span>未記載</span>
              <span className="text-lg font-semibold text-slate-900">
                {pendingFiltered.length}
              </span>
              <span>件</span>
            </div>
            <div className="ml-auto">{rightContent}</div>
          </div>

          <div ref={pendingContainerRef}>
            <ListPanel listRootId="pending-1">
              <ListGridHeader
                columns={pendingColumns}
                gridClassName={pendingGridClassName}
              />

              <div className="divide-y">
                {pendingLoading && pendingItems.length === 0 ? (
                  <ListEmptyState
                    variant="loading"
                    message="施術録記載待ちリストを読み込み中..."
                  />
                ) : pendingError && pendingItems.length === 0 ? (
                  <ListEmptyState
                    variant="error"
                    message={pendingError}
                    action={
                      <Button
                        size="list"
                        variant="outline"
                        onClick={loadPending}
                      >
                        再読み込み
                      </Button>
                    }
                  />
                ) : pendingFiltered.length === 0 ? (
                  <ListEmptyState message="本日、未作成の施術録はありません" />
                ) : (
                  <AnimatePresence initial={false}>
                    {pendingFiltered.map((v) => (
                      <motion.div
                        key={v.id}
                        layout
                        initial={
                          prefersReduced ? false : { opacity: 0.9, y: 4 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={
                          prefersReduced
                            ? { duration: 0 }
                            : {
                                layout: {
                                  duration: LAYOUT_DUR,
                                  ease: EASE_OUT,
                                },
                                opacity: { duration: FADE_DUR, ease: EASE_OUT },
                              }
                        }
                        className="origin-left hover:bg-slate-50 transition-colors"
                      >
                        <ListGridRow
                          columns={pendingColumns}
                          gridClassName={pendingGridClassName}
                          cells={(() => {
                            const cells = [
                              <div
                                key="patientId"
                                className="text-scale-emphasis text-slate-700 font-mono whitespace-nowrap"
                                title={`患者ID: ${v.patient.id}`}
                              >
                                {v.patient.patientNumber || v.patient.id}
                              </div>,
                              <div
                                key="patient"
                                className="leading-tight min-w-0"
                              >
                                <div className="text-xs text-gray-500 whitespace-nowrap truncate">
                                  {v.patient.kana || "—"}
                                </div>
                                <div className="font-medium text-gray-900 whitespace-nowrap truncate">
                                  {v.patient.name}
                                </div>
                              </div>,
                              <div
                                key="karte"
                                className="text-gray-800 whitespace-nowrap truncate"
                                title={v.chartInsuranceType || undefined}
                              >
                                {v.chartInsuranceType || "—"}
                              </div>,
                            ];
                            if (showPendingTime) {
                              cells.push(
                                <div
                                  key="time"
                                  className="text-sm text-gray-800 whitespace-nowrap"
                                >
                                  {formatHM(new Date(v.visitDate).getTime())}
                                </div>,
                              );
                            }
                            cells.push(
                              <div key="actions" className="text-right">
                                <div className="inline-flex items-center gap-1.5 justify-end w-full">
                                  <Button
                                    size="list"
                                    className="whitespace-nowrap"
                                    onClick={() =>
                                      handlePendingRecord({
                                        id: v.id,
                                        patient: { id: v.patient.id },
                                        chartId: v.chartId,
                                      })
                                    }
                                  >
                                    施術録記載
                                  </Button>
                                  <Button
                                    size="list"
                                    variant="outline"
                                    onClick={() => handlePendingCancel(v.id)}
                                    disabled={!!pendingBusy[v.id]}
                                    className="whitespace-nowrap"
                                  >
                                    {pendingBusy[v.id] ? "…" : "受付取消"}
                                  </Button>
                                </div>
                              </div>,
                            );
                            return cells;
                          })()}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </ListPanel>
          </div>
        </div>
      )}

      {mounted &&
        showModal &&
        selectedChart &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="カルテ概要"
            onClick={() => setShowModal(false)}
          >
            <div
              className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                <div>
                  <div className="text-sm text-slate-500">患者ID/患者ID</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {selectedChart.patient.patientNumber ||
                      selectedChart.patient.id}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    カルテID（内部管理用）:{" "}
                    <span className="font-mono text-slate-700 break-all">
                      {selectedChart.id}
                    </span>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="list"
                  onClick={() => setShowModal(false)}
                >
                  閉じる
                </Button>
              </div>

              <div className="px-5 py-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-slate-500">患者</div>
                    <div className="text-base text-slate-900 font-medium">
                      {selectedChart.patient.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {selectedChart.patient.kana}
                    </div>
                    <div className="text-xs text-slate-500">
                      患者ID: {selectedChart.patient.patientNumber || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">カルテ状態</div>
                    <div className="text-base text-slate-900">
                      {formatStatus(selectedChart.status)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">保険種別</div>
                    <div className="text-base text-slate-900">
                      {selectedChart.insuranceType || "—"}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-slate-500">
                      初検日（経過週数）
                    </div>
                    <div className="text-base text-slate-900">
                      {formatSlash(selectedChart.firstVisitDate) || "—"}
                      {selectedChart.elapsed
                        ? `（${formatWeeksOnly(selectedChart.elapsed)}）`
                        : ""}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">前回施術</div>
                    <div className="text-base text-slate-900">
                      {formatSlash(selectedChart.lastVisitDate) || "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {recordModal ? (
        <RecordModal
          recordModal={recordModal}
          patientDisplay={patientDisplay}
          patientDetailError={patientDetailError}
          recordHistory={recordHistory}
          recordHistoryLoading={recordHistoryLoading}
          recordHistoryError={recordHistoryError}
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

const STATUS_LABELS: Record<string, string> = {
  IN_TREATMENT: "通院中",
  HEALED: "治癒",
  DISCONTINUED: "中止",
  TRANSFERRED: "転医",
};

function formatStatus(status?: string | null) {
  if (!status) return "—";
  return STATUS_LABELS[status] || status;
}
