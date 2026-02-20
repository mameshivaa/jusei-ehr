"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChartStatus } from "@prisma/client";
import PageHeader from "@/components/layout/PageHeader";
import { ChartStatusBadge } from "@/components/charts/ChartStatusBadge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/ToastProvider";
import { isElectron } from "@/lib/electron/update-manager";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import PdfPreviewSettingsClient from "@/components/settings/PdfPreviewSettingsClient";

export type ChartDetailPayload = {
  id: string;
  status: ChartStatus;
  insuranceType: string | null;
  startDate: string | null;
  endDate: string | null;
  closedAt: string | null;
  closureReason: string | null;
  recordsCount: number;
  injuriesCount: number;
  visitsCount: number;
  injuries: Array<{
    id: string;
    injuryName: string;
    medicalInjuryName: string | null;
    injuryDate: string | null;
    firstVisitDate: string | null;
  }>;
  recentRecords: Array<{
    id: string;
    visitId: string | null;
    visitDate: string | null;
    updatedAt: string;
    practitioner: string | null;
    updatedBy: string | null;
    narrative: string | null;
    narrativePreview: string | null;
    history: Array<{
      id: string;
      changedAt: string;
      changeType: "CREATE" | "UPDATE" | "DELETE" | "CONFIRM";
      changeReason: string | null;
      changedBy: string | null;
      beforeNarrative: string | null;
      afterNarrative: string | null;
    }>;
  }>;
  patient: {
    id: string;
    name: string;
    kana: string | null;
    patientNumber: string | null;
  };
};

type BackLink = { href: string; label: string };

type Props = {
  chart: ChartDetailPayload;
  backHref: string;
  onBack?: () => void;
  initialTab?: ChartDetailTab;
};

type SortKey = "visitDate" | "updatedAt";
type ChartDetailTab = "overview" | "pdf";

type PdfSettings = {
  pdfPreviewIncludeOutputTimestamp: boolean;
  pdfPreviewIncludePatientName: boolean;
  pdfPreviewIncludePatientId: boolean;
  pdfPreviewIncludeInsurance: boolean;
  pdfPreviewIncludeStatus: boolean;
  pdfPreviewIncludeFirstVisitDate: boolean;
  pdfPreviewIncludeRecordHeaderDate: boolean;
  pdfPreviewIncludeRecordHeaderMilestone: boolean;
  pdfPreviewIncludeRecordHeaderUpdatedAt: boolean;
  pdfPreviewIncludeRecordHeaderAuthor: boolean;
  pdfPreviewIncludeRecordContent: boolean;
  pdfPreviewIncludeRecordHistory: boolean;
  pdfPreviewIncludeRecordInjury: boolean;
  pdfPreviewIncludeRecordInjuryDate: boolean;
  pdfPreviewIncludeTreatmentDetails: boolean;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_WEEK = 7;

const formatDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "yyyy/MM/dd", { locale: ja });
};

const formatDateTime = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "yyyy/MM/dd HH:mm", { locale: ja });
};

const sanitizeNarrativeForPreview = (text: string) =>
  text.replace(/^(【[^】]+】)\s*(（[^）]*）|\([^)]*\))/gm, "$1");

export function ChartDetailView({
  chart,
  backHref,
  onBack,
  initialTab = "overview",
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("visitDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [activeTab, setActiveTab] = useState<ChartDetailTab>(initialTab);
  const [pdfSettings, setPdfSettings] = useState<Partial<PdfSettings>>({});
  const [pdfSettingsLoading, setPdfSettingsLoading] = useState(false);
  const [pdfSettingsError, setPdfSettingsError] = useState<string | null>(null);
  const [pdfPreviewStamp, setPdfPreviewStamp] = useState(() => Date.now());

  const injurySummary = useMemo(() => {
    const names = chart.injuries
      .map((injury) => injury.injuryName)
      .filter(Boolean);
    const uniqueNames = Array.from(new Set(names));
    if (uniqueNames.length === 0) return "—";
    if (uniqueNames.length <= 2) return uniqueNames.join("、");
    return `${uniqueNames.slice(0, 2).join("、")} ほか${uniqueNames.length - 2}件`;
  }, [chart.injuries]);

  const enrichedRecords = useMemo(() => {
    const baseDate =
      chart.recentRecords
        .map((r) => new Date(r.visitDate ?? r.updatedAt))
        .filter((d) => !Number.isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

    return chart.recentRecords.map((record) => {
      const parsedDate = record.visitDate
        ? new Date(record.visitDate)
        : new Date(record.updatedAt);
      const diffDays =
        baseDate && !Number.isNaN(parsedDate.getTime())
          ? Math.max(
              0,
              Math.floor(
                (parsedDate.getTime() - baseDate.getTime()) / MS_PER_DAY,
              ),
            )
          : null;
      let milestoneLabel: string | null = null;
      if (diffDays !== null) {
        if (diffDays === 0) milestoneLabel = "初検日";
        else {
          const weeks = Math.floor(diffDays / DAYS_PER_WEEK);
          const days = diffDays % DAYS_PER_WEEK;
          milestoneLabel = `${weeks}w${days}d`;
        }
      }
      return {
        ...record,
        displayDate: formatDate(record.visitDate || record.updatedAt),
        updatedLabel: formatDateTime(record.updatedAt),
        milestoneLabel,
      };
    });
  }, [chart.recentRecords]);

  const sortedRecords = useMemo(() => {
    const getSortTime = (record: (typeof enrichedRecords)[number]) => {
      const iso =
        sortKey === "updatedAt"
          ? record.updatedAt
          : (record.visitDate ?? record.updatedAt);
      const t = new Date(iso).getTime();
      return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
    };

    return [...enrichedRecords].sort((a, b) => {
      const diff = getSortTime(a) - getSortTime(b);
      if (diff !== 0) return sortDir === "asc" ? diff : -diff;
      const updatedDiff =
        new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      if (updatedDiff !== 0)
        return sortDir === "asc" ? updatedDiff : -updatedDiff;
      return a.id.localeCompare(b.id);
    });
  }, [enrichedRecords, sortDir, sortKey]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  };

  const handleBack = (href: string) => {
    if (onBack) onBack();
    else router.push(href as Parameters<typeof router.push>[0]);
  };

  const recordsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = recordsRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [sortKey, sortDir]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const refreshPreview = useCallback(() => {
    setPdfPreviewStamp(Date.now());
  }, []);

  const loadPdfSettings = useCallback(async () => {
    setPdfSettingsError(null);
    setPdfSettingsLoading(true);
    try {
      const res = await fetch("/api/settings/pdf-preview", {
        cache: "no-store",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (payload as { error?: string })?.error ||
            "PDF設定の取得に失敗しました",
        );
      }
      const parsed = Object.fromEntries(
        Object.entries(payload).map(([key, value]) => [key, value === "true"]),
      ) as Partial<PdfSettings>;
      setPdfSettings(parsed);
    } catch (e) {
      setPdfSettingsError(
        e instanceof Error ? e.message : "PDF設定の取得に失敗しました",
      );
    } finally {
      setPdfSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "pdf") {
      loadPdfSettings();
      refreshPreview();
    }
  }, [activeTab, loadPdfSettings, refreshPreview]);

  const fetchPdfBlob = async () => {
    const res = await fetch(`/api/charts/${chart.id}/pdf`);
    if (!res.ok) {
      let message = "PDF生成に失敗しました";
      try {
        const data = await res.json();
        message = data.error || message;
      } catch {
        // ignore json parse errors
      }
      throw new Error(message);
    }
    return res.blob();
  };

  const handlePdfDownload = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const fileToken = chart.patient.patientNumber || chart.id;
      const fileName = `chart-${fileToken}.pdf`;
      const api =
        isElectron() && typeof window !== "undefined"
          ? window.electronAPI
          : null;

      if (api?.showSaveDialog && api?.saveFile) {
        const dialogResult = await api.showSaveDialog({
          title: "PDF出力",
          defaultPath: fileName,
          filters: [{ name: "PDF", extensions: ["pdf"] }],
        });
        if (!dialogResult || dialogResult.canceled || !dialogResult.filePath) {
          return;
        }

        const blob = await fetchPdfBlob();
        const arrayBuffer = await blob.arrayBuffer();
        const result = await api.saveFile({
          filePath: dialogResult.filePath,
          data: arrayBuffer,
        });
        if (!result?.success) {
          throw new Error(result?.error || "保存に失敗しました");
        }
        showToast("PDFを保存しました", "success");
        return;
      }

      const blob = await fetchPdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "PDF生成に失敗しました",
        "error",
      );
    } finally {
      setExporting(false);
    }
  };

  const previewUrl = useMemo(
    () => `/api/charts/${chart.id}/pdf?preview=${pdfPreviewStamp}`,
    [chart.id, pdfPreviewStamp],
  );

  const handlePdfPrint = async () => {
    if (printing) return;
    setPrinting(true);
    try {
      const blob = await fetchPdfBlob();
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (!win) {
        URL.revokeObjectURL(url);
        showToast("印刷用のタブを開けませんでした", "error");
        return;
      }
      const onLoad = () => {
        win.focus();
        win.print();
      };
      win.addEventListener("load", onLoad, { once: true });
      const cleanup = () => URL.revokeObjectURL(url);
      win.addEventListener("beforeunload", cleanup, { once: true });
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "PDF印刷に失敗しました",
        "error",
      );
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 pt-3">
        <PageHeader title="カルテ概要" subtitle="カルテ参照・PDFプレビュー" />
        <div className="flex gap-1 border-b border-slate-200">
          {[
            { id: "overview", label: "カルテ参照" },
            { id: "pdf", label: "PDFプレビュー" },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as ChartDetailTab)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 space-y-5 overflow-auto px-4 pb-6">
        {activeTab === "overview" && (
          <>
            <section className="space-y-2 text-sm text-slate-900">
              <div className="flex flex-wrap items-center gap-2">
                <ChartStatusBadge status={chart.status} size="sm" />
                <span className="text-slate-600">
                  保険: {chart.insuranceType || "未設定"}
                </span>
              </div>
              <div className="grid gap-y-1.5 gap-x-4 sm:grid-cols-2">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <div className="text-lg font-semibold text-slate-900 leading-tight">
                    {chart.patient.name}
                  </div>
                  <div className="text-base text-slate-700 leading-tight">
                    {chart.patient.kana || "—"}
                  </div>
                  {chart.patient.patientNumber ? (
                    <div className="text-base text-slate-700 leading-tight font-mono">
                      ID: {chart.patient.patientNumber}
                    </div>
                  ) : null}
                  <div className="text-sm text-slate-600 leading-tight">
                    傷病名:{" "}
                    <span className="text-slate-900">{injurySummary}</span>
                  </div>
                </div>
                <div className="grid grid-cols-[4rem_1fr] items-baseline gap-x-2">
                  <div className="text-xs text-slate-500">初検日</div>
                  <div className="text-base text-slate-900 leading-tight">
                    {formatDate(chart.startDate)}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-xl border-2 border-slate-200 bg-slate-50/50 px-4 py-3 shadow-md">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 tracking-tight">
                    施術録プレビュー
                  </h3>
                  <div className="mt-0 text-sm text-slate-500">
                    最新 {chart.recentRecords.length} 件を表示
                  </div>
                </div>
              </div>
              {chart.recentRecords.length === 0 ? (
                <div className="py-6 text-base text-slate-500 text-center">
                  施術録がまだありません。
                </div>
              ) : (
                <div
                  ref={recordsRef}
                  className="max-h-[32rem] overflow-y-auto rounded-lg border border-slate-200 bg-white"
                >
                  <div className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-600">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900"
                      onClick={() => handleSort("visitDate")}
                      title="クリックで昇順/降順を切替"
                      aria-label="日付で並び替え"
                    >
                      日付昇順/降順
                      <span className="ml-1 text-[11px] opacity-60" aria-hidden>
                        {sortKey === "visitDate"
                          ? sortDir === "asc"
                            ? "▴"
                            : "▾"
                          : "↕"}
                      </span>
                    </button>
                    <span className="mx-2 text-slate-400">|</span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900"
                      onClick={() => handleSort("updatedAt")}
                      title="クリックで昇順/降順を切替"
                      aria-label="更新日時で並び替え"
                    >
                      更新日時
                      <span className="ml-1 text-[11px] opacity-60" aria-hidden>
                        {sortKey === "updatedAt"
                          ? sortDir === "asc"
                            ? "▴"
                            : "▾"
                          : "↕"}
                      </span>
                    </button>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {sortedRecords.map((record) => {
                      const createdEntry = record.history.find(
                        (entry) => entry.changeType === "CREATE",
                      );
                      const createdBy = createdEntry?.changedBy ?? "—";
                      const rawNarrative =
                        record.narrative ??
                        record.narrativePreview ??
                        "内容なし";
                      const displayNarrative =
                        typeof rawNarrative === "string"
                          ? sanitizeNarrativeForPreview(rawNarrative)
                          : "内容なし";
                      return (
                        <article key={record.id} className="px-3 py-3">
                          <div className="sticky top-7 z-10 -mx-3 mb-2 border-b border-slate-100 bg-white/95 px-3 py-1.5 backdrop-blur">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold text-slate-900">
                              <div className="text-slate-800">
                                {record.updatedLabel}
                              </div>
                              <div className="text-slate-800">
                                {record.milestoneLabel ?? "—"}
                              </div>
                              <div className="text-slate-800">
                                記載者: {createdBy}
                              </div>
                              <div className="text-slate-700">
                                変更者:{" "}
                                {record.updatedBy ?? record.practitioner ?? "—"}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 text-[13px] leading-6 text-slate-800 whitespace-pre-wrap break-words">
                            {displayNarrative}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === "pdf" && (
          <div className="space-y-4">
            <section className="space-y-2 text-sm text-slate-900">
              <div className="flex flex-wrap items-center gap-2">
                <ChartStatusBadge status={chart.status} size="sm" />
                <span className="text-slate-600">
                  保険: {chart.insuranceType || "未設定"}
                </span>
              </div>
              <div className="grid gap-y-1.5 gap-x-4 sm:grid-cols-2">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <div className="text-lg font-semibold text-slate-900 leading-tight">
                    {chart.patient.name}
                  </div>
                  <div className="text-base text-slate-700 leading-tight">
                    {chart.patient.kana || "—"}
                  </div>
                  {chart.patient.patientNumber ? (
                    <div className="text-base text-slate-700 leading-tight font-mono">
                      ID: {chart.patient.patientNumber}
                    </div>
                  ) : null}
                </div>
                <div className="grid grid-cols-[4rem_1fr] items-baseline gap-x-2">
                  <div className="text-xs text-slate-500">初検日</div>
                  <div className="text-base text-slate-900 leading-tight">
                    {formatDate(chart.startDate)}
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">
                      PDFプレビュー
                    </h3>
                    <p className="text-xs text-slate-500">
                      出力設定を変更したら再読み込みしてください。
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="list"
                      onClick={refreshPreview}
                    >
                      再読み込み
                    </Button>
                    <Button
                      variant="outline"
                      size="list"
                      onClick={handlePdfPrint}
                      loading={printing}
                      loadingText="印刷準備中..."
                    >
                      印刷
                    </Button>
                    <Button
                      variant="outline"
                      size="list"
                      onClick={handlePdfDownload}
                      loading={exporting}
                      loadingText="PDF生成中..."
                    >
                      ダウンロード
                    </Button>
                  </div>
                </div>
                <div className="mt-3 h-[70vh] min-h-[28rem] overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <iframe
                    key={pdfPreviewStamp}
                    title="PDFプレビュー"
                    src={previewUrl}
                    className="h-full w-full"
                  />
                </div>
              </section>

              <section className="space-y-2">
                <div className="text-sm font-semibold text-slate-700">
                  PDF出力設定
                </div>
                {pdfSettingsLoading ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    読み込み中…
                  </div>
                ) : pdfSettingsError ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 space-y-2">
                    <div>{pdfSettingsError}</div>
                    <Button
                      size="list"
                      variant="outline"
                      onClick={loadPdfSettings}
                    >
                      再取得
                    </Button>
                  </div>
                ) : (
                  <PdfPreviewSettingsClient
                    initialSettings={pdfSettings}
                    onSaved={refreshPreview}
                    compact
                  />
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
