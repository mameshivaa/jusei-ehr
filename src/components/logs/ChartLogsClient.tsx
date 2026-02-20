"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import {
  Calendar,
  Download,
  Eye,
  Filter,
  Hash,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";

const LOGS_PER_PAGE = 50;
const ID_PREVIEW_LENGTH = 8;
const METADATA_SUMMARY_MAX_FIELDS = 2;

// Motion: うるさくならないよう「初回だけ」「控えめ」にする
const MOTION_DURATION_S = 0.16;
const MOTION_STAGGER_S = 0.015;
const MOTION_Y_PX = 4;
const MOTION_EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
const CHAOS_MAX_X_PX = 10;
const CHAOS_MAX_ROTATE_DEG = 1.2;
const CHAOS_BLUR_PX = 1.5;
const HASH_MULTIPLIER = 31;
const UINT32_MOD = 2 ** 32;

const ACTION_LABELS: Record<string, string> = {
  CREATE: "作成",
  READ: "閲覧",
  UPDATE: "更新",
  DELETE: "削除",
  CONFIRM: "確定",
};

const SEVERITY_LABELS: Record<string, string> = {
  INFO: "情報",
  WARNING: "注意",
  ERROR: "エラー",
  CRITICAL: "重大",
};

const SEVERITY_RAIL: Record<string, string> = {
  INFO: "bg-slate-300",
  WARNING: "bg-slate-300",
  ERROR: "bg-slate-300",
  CRITICAL: "bg-slate-300",
};

export type ChartLog = {
  id: string;
  action: string;
  entityId: string | null;
  resourcePath: string | null;
  severity: string;
  category: string;
  metadata: Record<string, any> | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  chartPatient: {
    id: string;
    name: string;
    kana: string | null;
    patientNumber: string | null;
  } | null;
};

type Filters = {
  action: string;
  startDate: string;
  endDate: string;
};

function formatDateInputLabel(value: string) {
  if (!value) return "指定なし";
  try {
    return format(new Date(value), "yyyy/MM/dd (EEE)", { locale: ja });
  } catch {
    return value;
  }
}

function buildMetadataSummary(metadata: Record<string, unknown> | null) {
  if (!metadata) return "";
  const entries = Object.entries(metadata).slice(
    0,
    METADATA_SUMMARY_MAX_FIELDS,
  );
  if (entries.length === 0) return "";

  const parts = entries.map(([k, v]) => {
    if (typeof v === "string") return `${k}: ${v}`;
    if (typeof v === "number") return `${k}: ${v}`;
    if (typeof v === "boolean") return `${k}: ${v ? "true" : "false"}`;
    if (v === null) return `${k}: null`;
    return `${k}: ...`;
  });
  return parts.join(" / ");
}

function ActionIcon({ action }: { action: string }) {
  const className = "h-3.5 w-3.5";
  switch (action) {
    case "READ":
      return <Eye className={className} aria-hidden />;
    case "UPDATE":
      return <Pencil className={className} aria-hidden />;
    case "CREATE":
      return <Plus className={className} aria-hidden />;
    case "DELETE":
      return <Trash2 className={className} aria-hidden />;
    case "CONFIRM":
      return <ShieldCheck className={className} aria-hidden />;
    default:
      return null;
  }
}

function isAttentionSeverity(severity: string) {
  return (
    severity === "WARNING" || severity === "ERROR" || severity === "CRITICAL"
  );
}

function buildSubject(log: ChartLog) {
  if (log.chartPatient) {
    const no = log.chartPatient.patientNumber
      ? `（No.${log.chartPatient.patientNumber}）`
      : "";
    return `${log.chartPatient.name}${no}`;
  }
  if (log.entityId) return `カルテ ${log.entityId.slice(0, ID_PREVIEW_LENGTH)}`;
  if (log.resourcePath) return log.resourcePath;
  return "対象不明";
}

function getSeverityDotClass(severity: string) {
  return SEVERITY_RAIL[severity] || "bg-slate-300";
}

function hashStringToUint32(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * HASH_MULTIPLIER + value.charCodeAt(i)) % UINT32_MOD;
  }
  return hash;
}

function hashToUnit(value: string) {
  return hashStringToUint32(value) / (UINT32_MOD - 1);
}

type ChaosPose = {
  x: number;
  rotate: number;
  blurPx: number;
  delay: number;
  paddingY: number;
  paddingL: number;
  dotOffsetY: number;
  lineGap: number;
};

const PADDING_Y_VARIANCE_PX = 3;
const PADDING_L_VARIANCE_PX = 2;
const DOT_OFFSET_Y_PX = 1.5;
const LINE_GAP_VARIANCE_PX = 2;

function getChaosPose(seed: string, index: number): ChaosPose {
  const u1 = hashToUnit(`${seed}:x`);
  const u2 = hashToUnit(`${seed}:r`);
  const u3 = hashToUnit(`${seed}:d:${index}`);
  const u4 = hashToUnit(`${seed}:py:${index}`);
  const u5 = hashToUnit(`${seed}:pl:${index}`);
  const u6 = hashToUnit(`${seed}:dot:${index}`);
  const u7 = hashToUnit(`${seed}:gap:${index}`);
  const x = (u1 - 0.5) * 2 * CHAOS_MAX_X_PX;
  const rotate = (u2 - 0.5) * 2 * CHAOS_MAX_ROTATE_DEG;
  return {
    x,
    rotate,
    blurPx: CHAOS_BLUR_PX,
    delay: u3 * 0.08,
    paddingY: (u4 - 0.5) * 2 * PADDING_Y_VARIANCE_PX,
    paddingL: (u5 - 0.5) * 2 * PADDING_L_VARIANCE_PX,
    dotOffsetY: (u6 - 0.5) * 2 * DOT_OFFSET_Y_PX,
    lineGap: (u7 - 0.5) * 2 * LINE_GAP_VARIANCE_PX,
  };
}

export function ChartLogsClient({ isAdmin = false }: { isAdmin?: boolean }) {
  const [logs, setLogs] = useState<ChartLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    action: "",
    startDate: "",
    endDate: "",
  });
  const reduceMotion = useReducedMotion();

  const handleExport = useCallback(() => {
    const params = new URLSearchParams();
    params.set("format", "csv");
    params.set("entityType", "CHART");
    if (filters.action) params.set("action", filters.action);
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    window.location.href = `/api/audit-logs/export?${params.toString()}`;
  }, [filters.action, filters.endDate, filters.startDate]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: String(LOGS_PER_PAGE),
        ...(filters.action && { action: filters.action }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
      });

      const res = await fetch(`/api/chart-logs?${params}`);
      if (!res.ok) throw new Error("failed to fetch");

      const data = await res.json();
      setLogs(data.logs);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error("Failed to load chart logs", error);
    } finally {
      setLoading(false);
    }
  }, [filters.action, filters.endDate, filters.startDate, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const selectedActionLabel = useMemo(() => {
    if (!filters.action) return "すべて";
    return ACTION_LABELS[filters.action] || filters.action;
  }, [filters.action]);

  // 日付ごとにグルーピング
  const grouped = useMemo(() => {
    const byDate: Record<string, ChartLog[]> = {};
    logs.forEach((log) => {
      const key = format(new Date(log.createdAt), "yyyy-MM-dd");
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(log);
    });
    // 直近が上にくるよう降順ソート
    return Object.entries(byDate)
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, items]) => ({
        date,
        items: items.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      }));
  }, [logs]);

  const quickActions: { value: string; label: string }[] = [
    { value: "", label: "すべて" },
    { value: "READ", label: "閲覧" },
    { value: "UPDATE", label: "更新" },
    { value: "CREATE", label: "作成" },
    { value: "DELETE", label: "削除" },
    { value: "CONFIRM", label: "確定" },
  ];

  const listVariants = useMemo(
    () => ({
      hidden: {},
      show: {
        transition: reduceMotion
          ? undefined
          : {
              staggerChildren: MOTION_STAGGER_S,
            },
      },
    }),
    [reduceMotion],
  );

  const itemVariants = useMemo<Variants>(() => {
    return {
      hidden: (custom: { chaos: ChaosPose }) => ({
        opacity: 0,
        y: reduceMotion ? 0 : MOTION_Y_PX,
        x: reduceMotion ? 0 : custom.chaos.x,
        rotate: reduceMotion ? 0 : custom.chaos.rotate,
        filter: reduceMotion ? "blur(0px)" : `blur(${custom.chaos.blurPx}px)`,
      }),
      show: (custom: { chaos: ChaosPose }) => ({
        opacity: 1,
        y: 0,
        x: 0,
        rotate: 0,
        filter: "blur(0px)",
        transition: reduceMotion
          ? { duration: 0 }
          : {
              delay: custom.chaos.delay,
              duration: MOTION_DURATION_S,
              ease: MOTION_EASE_OUT,
            },
      }),
    };
  }, [reduceMotion]);

  return (
    <div className="space-y-3">
      {/* ツールバー：操作（左）/ 期間（右） */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
            <Filter className="h-3.5 w-3.5" aria-hidden />
            操作
          </span>
          <div
            className="inline-flex flex-wrap items-center gap-1 rounded-full bg-slate-100 p-1 ring-1 ring-slate-200"
            role="tablist"
            aria-label="操作フィルター"
          >
            {quickActions.map((a) => {
              const selected = filters.action === a.value;
              return (
                <button
                  key={a.value || "all"}
                  type="button"
                  onClick={() => {
                    setFilters((prev) => ({
                      ...prev,
                      action: a.value,
                    }));
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs rounded-full transition ${
                    selected
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-700 hover:text-slate-900"
                  }`}
                  aria-current={selected ? "true" : undefined}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
            <Calendar className="h-3.5 w-3.5" aria-hidden />
            期間
          </span>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, startDate: e.target.value }));
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700"
            aria-label="開始日"
          />
          <span className="text-slate-400">〜</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, endDate: e.target.value }));
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700"
            aria-label="終了日"
          />
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Hash className="h-3.5 w-3.5" aria-hidden />
            {loading ? "更新中" : `${logs.length}件`}
          </span>
          {isAdmin ? (
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              CSV出力
            </button>
          ) : null}
        </div>
      </div>

      {/* 状態サマリ（視線誘導用） */}
      <div className="text-xs text-slate-600">
        表示:{" "}
        <span className="inline-flex items-center gap-1 font-medium text-slate-900">
          <span
            className={`h-2 w-2 rounded-full ${
              filters.action ? "bg-slate-900" : "bg-slate-400"
            }`}
            aria-hidden
          />
          {selectedActionLabel}
        </span>{" "}
        ・ 期間:{" "}
        <span className="text-slate-900 font-medium">
          {formatDateInputLabel(filters.startDate)}
        </span>{" "}
        〜{" "}
        <span className="text-slate-900 font-medium">
          {formatDateInputLabel(filters.endDate)}
        </span>
        {totalPages > 1 ? (
          <>
            {" "}
            ・ ページ:{" "}
            <span className="text-slate-900 font-medium">
              {page}/{totalPages}
            </span>
          </>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-500">読み込み中...</div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            ログがありません
          </div>
        ) : (
          <div className="relative">
            <motion.ul
              className="divide-y divide-slate-100"
              variants={listVariants}
              initial="hidden"
              animate="show"
            >
              {grouped.map(({ date, items }) => (
                <li key={date} className="relative">
                  <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-100 px-6 sm:px-8 lg:px-10 py-3">
                    <div className="flex items-baseline justify-between gap-4">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm sm:text-base font-bold text-slate-900 tracking-tight tabular-nums">
                          {format(new Date(date), "yyyy/MM/dd", { locale: ja })}
                        </span>
                        <span className="text-xs sm:text-sm font-semibold text-slate-600">
                          {format(new Date(date), "(EEE)", { locale: ja })}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 tabular-nums">
                        {items.length}件
                      </span>
                    </div>
                  </div>
                  <div className="relative px-6 sm:px-8 lg:px-10">
                    <div
                      className="absolute left-2 top-0 bottom-0 w-px bg-slate-300/80"
                      aria-hidden
                    />
                    <div
                      className="absolute left-2 top-0 bottom-0 w-3 -translate-x-1/2 bg-slate-200/25 blur-md"
                      aria-hidden
                    />
                    <ul>
                      {items.map((log, index) => {
                        const metaKeys = log.metadata
                          ? Object.keys(log.metadata)
                          : [];
                        const metaSummary = buildMetadataSummary(log.metadata);
                        const attention = isAttentionSeverity(log.severity);
                        const severityLabel =
                          SEVERITY_LABELS[log.severity] ||
                          log.severity ||
                          "不明";
                        const timeMain = format(
                          new Date(log.createdAt),
                          "HH:mm",
                          {
                            locale: ja,
                          },
                        );
                        const timeSec = format(new Date(log.createdAt), "ss", {
                          locale: ja,
                        });
                        const isExpanded = expandedLogId === log.id;
                        const detailsId = `chart-log-details-${log.id}`;
                        const chaos = getChaosPose(log.id, index);
                        const isFirst = index === 0;
                        const isLast = index === items.length - 1;
                        return (
                          <motion.li
                            key={log.id}
                            variants={itemVariants}
                            custom={{ chaos }}
                            layout
                            role="button"
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            aria-controls={detailsId}
                            onClick={() =>
                              setExpandedLogId((prev) =>
                                prev === log.id ? null : log.id,
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setExpandedLogId((prev) =>
                                  prev === log.id ? null : log.id,
                                );
                              }
                            }}
                            className="group relative cursor-pointer transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40"
                            style={{
                              paddingTop: `${24 + chaos.paddingY}px`,
                              paddingBottom: `${24 + chaos.paddingY}px`,
                              paddingLeft: `${64 + chaos.paddingL}px`,
                            }}
                          >
                            <div
                              className="absolute left-0 top-0 bottom-0 w-16"
                              aria-hidden
                            />
                            {/* 1つ上/下のログとの接続線（時系列の連続性を強く見せる） */}
                            {!isFirst ? (
                              <div
                                className="absolute left-2 top-0 w-px bg-slate-300/80"
                                style={{
                                  height: `${28 + chaos.lineGap}px`,
                                }}
                                aria-hidden
                              />
                            ) : null}
                            {!isLast ? (
                              <div
                                className="absolute left-2 bottom-0 w-px bg-slate-300/80"
                                style={{
                                  top: `${28 + chaos.dotOffsetY + chaos.lineGap}px`,
                                }}
                                aria-hidden
                              />
                            ) : null}
                            <div
                              className="absolute left-2 -translate-x-1/2"
                              style={{
                                top: `${28 + chaos.dotOffsetY}px`,
                              }}
                            >
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${getSeverityDotClass(
                                  log.severity,
                                )} ring-4 ring-white`}
                                aria-hidden
                              />
                            </div>
                            <div
                              className="absolute left-2 h-px -translate-y-1/2 bg-gradient-to-r from-slate-300/70 to-slate-200/0"
                              style={{
                                top: `${28 + chaos.dotOffsetY}px`,
                                width: `${48 + chaos.lineGap}px`,
                              }}
                              aria-hidden
                            />
                            <div
                              className="absolute left-0 w-16 pr-4 text-right tabular-nums"
                              style={{
                                top: `${20 + chaos.dotOffsetY}px`,
                              }}
                            >
                              <div className="text-sm font-bold text-slate-900 tracking-tight">
                                {timeMain}
                              </div>
                              <div className="text-[11px] font-semibold text-slate-600">
                                {timeSec}
                              </div>
                            </div>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
                                <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                                  <ActionIcon action={log.action} />
                                  {ACTION_LABELS[log.action] || log.action}
                                </span>
                                {attention ? (
                                  <span className="text-slate-600">
                                    ・{" "}
                                    <span className="font-semibold">
                                      {severityLabel}
                                    </span>
                                  </span>
                                ) : null}
                              </div>

                              <div className="mt-2 flex items-baseline flex-wrap gap-x-4 gap-y-1">
                                <span className="text-base font-medium text-slate-900 truncate leading-relaxed">
                                  {buildSubject(log)}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {log.user ? `${log.user.name}` : "システム"}
                                  {metaSummary ? ` ・ ${metaSummary}` : ""}
                                </span>
                              </div>

                              <AnimatePresence initial={false}>
                                {isExpanded ? (
                                  <motion.div
                                    id={detailsId}
                                    layout
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{
                                      duration: reduceMotion
                                        ? 0
                                        : MOTION_DURATION_S,
                                      ease: MOTION_EASE_OUT,
                                    }}
                                    className="mt-2 overflow-hidden"
                                  >
                                    <div
                                      className="w-[min(44rem,90vw)] px-1 py-3 text-xs text-slate-700"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="space-y-1.5">
                                        <div>
                                          <span className="text-slate-500">
                                            重要度:
                                          </span>{" "}
                                          <span className="text-slate-900 font-medium">
                                            {severityLabel}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-slate-500">
                                            カルテID:
                                          </span>{" "}
                                          <span className="text-slate-900 font-medium">
                                            {log.entityId || "—"}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-slate-500">
                                            パス:
                                          </span>{" "}
                                          <span className="text-slate-900 font-mono">
                                            {log.resourcePath || "—"}
                                          </span>
                                        </div>
                                      </div>

                                      {metaKeys.length > 0 ? (
                                        <div className="mt-4">
                                          <div className="text-slate-600 font-semibold">
                                            メタデータ ({metaKeys.length})
                                          </div>
                                          <pre className="mt-2 max-h-72 overflow-auto text-[11px] leading-5 text-slate-700">
                                            {JSON.stringify(
                                              log.metadata,
                                              null,
                                              2,
                                            )}
                                          </pre>
                                        </div>
                                      ) : null}
                                    </div>
                                  </motion.div>
                                ) : null}
                              </AnimatePresence>
                            </div>
                          </motion.li>
                        );
                      })}
                    </ul>
                  </div>
                </li>
              ))}
            </motion.ul>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-sm text-slate-700">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-full border border-slate-300 bg-white shadow-sm disabled:opacity-40"
          >
            前へ
          </button>
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-full border border-slate-300 bg-white shadow-sm disabled:opacity-40"
          >
            次へ
          </button>
        </div>
      )}
    </div>
  );
}
