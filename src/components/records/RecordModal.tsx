"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartSummaryEntity, ChartStatusValue } from "@/domain/entities/chart";
import { ChartDetailPayload } from "@/components/charts/ChartDetailView";
import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format as formatDateFn,
  isToday,
  startOfMonth,
} from "date-fns";
import { formatSlash } from "@/lib/utils/date";
import { ja } from "date-fns/locale";
import { Dispatch, RefObject, SetStateAction } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useUser } from "@/hooks/useUser";
import { useDraftTracking } from "@/hooks/useDraftTracking";

export type RecordModalChart = Omit<ChartSummaryEntity, "status"> & {
  status: ChartStatusValue;
  injuriesCount: number;
  visitsCount: number;
};

export type RecordHistoryEntry = ChartDetailPayload["recentRecords"][number] & {
  updatedLabel: string;
  milestoneLabel?: string | null;
};

export type PatientDisplay = {
  id: string;
  name: string;
  kana: string | null;
  patientNumber: string | null;
  gender: string | null;
  birthDate: string | null;
  age?: number | null;
  phone?: string | null;
  addressText?: string;
};

type RecordModalProps = {
  recordModal: RecordModalChart;
  patientDisplay: PatientDisplay | null;
  patientDetailError: string | null;
  recordHistory: RecordHistoryEntry[];
  recordHistoryLoading: boolean;
  recordHistoryError: string | null;
  scrollHistoryToBottomToken?: number;
  calendarOpen: boolean;
  setCalendarOpen: Dispatch<SetStateAction<boolean>>;
  calendarMonth: Date;
  setCalendarMonth: Dispatch<SetStateAction<Date>>;
  visitDateStr: string;
  setVisitDateStr: Dispatch<SetStateAction<string>>;
  narrative: string;
  setNarrative: Dispatch<SetStateAction<string>>;
  currentUserName: string | null;
  recordError: string | null;
  recordSaving: boolean;
  closeRecordModal: () => void;
  handleSubmitRecordModal: (recordModal: RecordModalChart) => void;
  calendarRef: RefObject<HTMLDivElement>;
};

export function RecordModal({
  recordModal,
  patientDisplay,
  patientDetailError,
  recordHistory,
  recordHistoryLoading,
  recordHistoryError,
  scrollHistoryToBottomToken,
  calendarOpen,
  setCalendarOpen,
  calendarMonth,
  setCalendarMonth,
  visitDateStr,
  setVisitDateStr,
  narrative,
  setNarrative,
  currentUserName,
  recordError,
  recordSaving,
  closeRecordModal,
  handleSubmitRecordModal,
  calendarRef,
}: RecordModalProps) {
  const router = useRouter();
  const { user } = useUser();
  const [editingId, setEditingId] = useState<string | null>(null);
  // 新規作成時は一時的なentityIdを使用
  const [tempEntityId] = useState(() => `temp-${Date.now()}`);
  const effectiveEntityId = editingId || tempEntityId;
  const { notifyActivity, markCommit, markReopen } = useDraftTracking({
    entityType: "record",
    entityId: effectiveEntityId,
    actorId: user?.id ?? null,
    enabled: !!user?.id,
  });

  // デバッグ用：userとeditingIdの状態を確認
  useEffect(() => {
    console.log("[RecordModal] user:", user);
    console.log("[RecordModal] editingId:", editingId);
    console.log("[RecordModal] effectiveEntityId:", effectiveEntityId);
    console.log("[RecordModal] enabled:", !!user?.id);
  }, [user, editingId, effectiveEntityId]);

  // 既存施術記録の再編集開始を記録（editingIdが設定されたときのみ）
  useEffect(() => {
    if (!editingId || !user?.id) return;
    console.log("[RecordModal] markReopen called", {
      editingId,
      userId: user.id,
    });
    void markReopen();
  }, [markReopen, editingId, user?.id]);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const recordRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const recordListRef = useRef<HTMLDivElement | null>(null);
  const narrativeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrolledOnce = useRef(false);
  const [currentUserNameCache, setCurrentUserNameCache] = useState<
    string | null
  >(null);
  const getSortKey = useCallback((rec: RecordHistoryEntry) => {
    const candidates = [rec.visitDate, rec.updatedAt, rec.updatedLabel];
    for (const v of candidates) {
      if (!v) continue;
      const t = Date.parse(v);
      if (!Number.isNaN(t)) return t;
    }
    return -Infinity;
  }, []);

  // 指定基準で昇順に並べ、後で反転して最新を下にする（逆順表示）
  const sortHistory = useCallback(
    (items: RecordHistoryEntry[]) =>
      [...items].sort((a, b) => getSortKey(a) - getSortKey(b)),
    [getSortKey],
  );

  const [recordHistoryState, setRecordHistoryState] = useState(
    sortHistory(recordHistory),
  );
  const [savedFlash, setSavedFlash] = useState<Record<string, boolean>>({});
  const [expandedRecords, setExpandedRecords] = useState<
    Record<string, boolean>
  >({});
  const [editForm, setEditForm] = useState<{
    narrative: string | null;
    injuryId: string | null;
    version: number;
    treatmentDetails: Array<{
      procedureId: string;
      bodyPart: string | null;
      quantity: number;
      unitPrice: number | null;
    }>;
    changeReason: string;
  } | null>(null);

  useEffect(() => {
    if (!editingId || !user?.id) return;
    void markReopen();
  }, [editingId, markReopen, user?.id]);

  const parseDateValue = useCallback((value?: string | null): Date | null => {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    if (/^\d+$/.test(raw)) {
      const asNumber = Number(raw);
      if (Number.isFinite(asNumber)) {
        const fromEpoch = new Date(asNumber);
        if (!Number.isNaN(fromEpoch.getTime())) return fromEpoch;
      }
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }, []);

  const firstVisitDate = useMemo(
    () => parseDateValue(recordModal.firstVisitDate ?? null),
    [parseDateValue, recordModal.firstVisitDate],
  );

  const getElapsedWeekLabel = useCallback(
    (value?: string | null) => {
      if (!firstVisitDate) return null;
      const target = parseDateValue(value);
      if (!target) return null;
      const elapsedDays = differenceInCalendarDays(target, firstVisitDate);
      if (elapsedDays < 0) return null;
      return `${Math.floor(elapsedDays / 7)}w`;
    },
    [firstVisitDate, parseDateValue],
  );

  const selectedVisitElapsedWeeks = useMemo(
    () => getElapsedWeekLabel(visitDateStr),
    [getElapsedWeekLabel, visitDateStr],
  );
  const selectedVisitElapsedWeeksLabel = selectedVisitElapsedWeeks ?? "—";

  const autoResizeTextarea = () => {
    const el = narrativeTextareaRef.current;
    if (!el) return;

    const lineHeight = 22; // px (text-sm相当)
    const minLines = 3;
    const maxLines = 24; // 長文でも十分な縦幅を確保

    // 一旦縮めてから scrollHeight を採取すると、実際の内容に応じた高さを得られる
    el.style.height = "auto";
    const scrollBasedHeight = el.scrollHeight; // padding込み

    const minHeight = lineHeight * minLines;
    const maxHeight = lineHeight * maxLines;
    const nextHeight = Math.min(
      Math.max(scrollBasedHeight, minHeight),
      maxHeight,
    );

    el.style.height = `${nextHeight}px`;
    el.style.overflowY = scrollBasedHeight > maxHeight ? "auto" : "hidden";
  };

  // recordHistoryの遅延反映にも追随し、常に日付順で保持
  useEffect(() => {
    setRecordHistoryState(sortHistory(recordHistory));
  }, [recordHistory, sortHistory]);

  const sortedHistory = useMemo(
    () => sortHistory(recordHistoryState),
    [recordHistoryState, sortHistory],
  );

  // 編集フォーム内容が変わったら高さをリサイズ（scrollIntoViewと干渉しないよう1回だけ）
  useEffect(() => {
    autoResizeTextarea();
  }, [editForm?.narrative]);

  const scrollCardIntoView = (recordId: string) => {
    const listEl = recordListRef.current;
    const cardEl = recordRefs.current[recordId];
    if (!listEl || !cardEl) return;

    const ensureVisible = () => {
      const padding = 32; // 長文でも日付行が確実に見える余白

      // getBoundingClientRect を用いて、レイアウトアニメーション後の実座標を取得
      const listRect = listEl.getBoundingClientRect();
      const cardRect = cardEl.getBoundingClientRect();

      const cardTop = listEl.scrollTop + (cardRect.top - listRect.top);
      const cardBottom = cardTop + cardRect.height;
      const viewTop = listEl.scrollTop;
      const viewBottom = viewTop + listEl.clientHeight;
      const cardHeight = cardRect.height;
      const viewHeight = listEl.clientHeight;

      // カードがビューより大きい場合はヘッダーを優先して上端に合わせる
      if (cardHeight >= viewHeight - padding * 2) {
        listEl.scrollTo({
          top: Math.max(cardTop - padding, 0),
          behavior: "auto",
        });
        return;
      }

      // 上端が隠れている場合は上を優先
      if (cardTop - padding < viewTop) {
        listEl.scrollTo({
          top: Math.max(cardTop - padding, 0),
          behavior: "auto",
        });
        return;
      }

      // 下端だけ見切れている場合も補正
      if (cardBottom + padding > viewBottom) {
        const nextTop = cardBottom - listEl.clientHeight + padding;
        listEl.scrollTo({ top: Math.max(nextTop, 0), behavior: "auto" });
      }
    };

    // レイアウト確定後に複数回チェックし、アニメーション後のズレにも追随
    requestAnimationFrame(ensureVisible);
    setTimeout(ensureVisible, 260); // framer-motionのlayoutアニメーション完了後をカバー
    setTimeout(ensureVisible, 520); // 長文レンダリングによる高さ変化を追加でカバー
  };

  // 編集カード切替時にも可視範囲を保証
  useEffect(() => {
    if (editingId) {
      scrollCardIntoView(editingId);
    }
  }, [editingId]);

  const loadRecord = async (
    recordId: string,
    fallback?: { narrative?: string | null; narrativePreview?: string | null },
  ) => {
    try {
      if (currentUserName && !currentUserNameCache) {
        setCurrentUserNameCache(currentUserName);
      }
      setEditingId(recordId);
      setEditLoading(true);
      setEditError(null);
      const res = await fetch(`/api/treatment-records/${recordId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        throw new Error("施術録の取得に失敗しました");
      }
      const data = await res.json();
      setEditForm({
        narrative:
          data.narrative ??
          fallback?.narrative ??
          fallback?.narrativePreview ??
          "",
        injuryId: data.injuryId,
        version: data.version,
        treatmentDetails:
          data.treatmentDetails?.map((d: any) => ({
            procedureId: d.procedureId,
            bodyPart: d.bodyPart,
            quantity: d.quantity,
            unitPrice: d.unitPrice,
          })) || [],
        changeReason: "追加情報",
      });
      requestAnimationFrame(() => {
        scrollCardIntoView(recordId);
        autoResizeTextarea();
      });
    } catch (e) {
      setEditError(
        e instanceof Error ? e.message : "施術録の取得に失敗しました",
      );
      setEditingId(null);
    } finally {
      setEditLoading(false);
    }
  };

  // 初回はリストを最新（下端）までスクロール（データ到着後に一度だけ）
  useEffect(() => {
    if (scrolledOnce.current) return;
    if (sortedHistory.length === 0) return;
    const el = recordListRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    scrolledOnce.current = true;
  }, [sortedHistory.length]);

  useEffect(() => {
    if (scrollHistoryToBottomToken === undefined) return;
    if (sortedHistory.length === 0) return;
    const el = recordListRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [scrollHistoryToBottomToken, sortedHistory.length]);

  const saveRecord = async (recordId: string) => {
    if (!editForm) return;
    if (!editForm.changeReason.trim()) {
      setEditError("訂正理由を入力してください");
      return;
    }
    try {
      setEditSaving(true);
      setEditError(null);
      const res = await fetch(`/api/treatment-records/${recordId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          narrative: editForm.narrative,
          injuryId: editForm.injuryId,
          treatmentDetails: editForm.treatmentDetails,
          version: editForm.version,
          changeReason: editForm.changeReason.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "保存に失敗しました");
      }
      // 履歴リストを即時反映（モーダルを閉じない）
      setRecordHistoryState((prev) =>
        sortHistory(
          prev.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  narrative: editForm.narrative,
                  narrativePreview: editForm.narrative
                    ? editForm.narrative.slice(0, 80)
                    : r.narrativePreview,
                  updatedAt: new Date().toISOString(),
                }
              : r,
          ),
        ),
      );
      await markCommit();
      setSavedFlash((prev) => ({ ...prev, [recordId]: true }));
      setTimeout(
        () => setSavedFlash((prev) => ({ ...prev, [recordId]: false })),
        1200,
      );
      setEditingId(null);
      setEditForm(null);
      requestAnimationFrame(() => autoResizeTextarea());
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setEditSaving(false);
    }
  };
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="施術録モーダル記載"
    >
      <div
        className="w-full max-w-screen-xl rounded-xl border border-slate-200 bg-white shadow-xl max-h-[90vh] grid grid-rows-[auto_1fr_auto] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/60">
          {patientDetailError ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <svg
                  className="h-5 w-5 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm font-medium text-red-800">
                  {patientDetailError}
                </span>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-base">
            <span className="text-3xl font-bold text-slate-900">
              {patientDisplay?.name || recordModal.patient.name}
            </span>
            {patientDisplay?.gender ? (
              <span className="text-base font-medium text-slate-700">
                {patientDisplay.gender}
              </span>
            ) : null}
            {patientDisplay?.age !== null &&
            patientDisplay?.age !== undefined ? (
              <span className="text-base font-medium text-slate-700">
                {patientDisplay.age} 歳
              </span>
            ) : null}
            <span className="text-base font-mono text-slate-900">
              患者ID: {patientDisplay?.patientNumber || recordModal.patient.id}
            </span>
            <span className="text-base text-slate-900">
              フリガナ: {patientDisplay?.kana || "—"}
            </span>
            <span className="text-base text-slate-900">
              生年月日:{" "}
              {patientDisplay?.birthDate
                ? formatSlash(patientDisplay.birthDate)
                : "—"}
            </span>
            <span className="text-base text-slate-900 break-all">
              連絡先: {patientDisplay?.phone || "—"}
            </span>
            {patientDisplay?.addressText ? (
              <span className="text-base text-slate-900">
                住所: {patientDisplay.addressText}
              </span>
            ) : null}
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <div className="overflow-x-auto">
            <div className="grid min-w-[760px] gap-4 grid-cols-[1fr_1fr] lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-800">
                    過去の施術録
                  </div>
                  {recordHistoryLoading && (
                    <div className="text-xs text-slate-500">読込中…</div>
                  )}
                </div>
                {recordHistoryError ? (
                  <div className="text-sm text-red-600">
                    {recordHistoryError}
                  </div>
                ) : recordHistory.length === 0 ? (
                  <div className="text-sm text-slate-500">
                    施術録がまだありません。
                  </div>
                ) : (
                  <div
                    className="space-y-2 max-h-[60vh] overflow-y-auto pr-1"
                    ref={recordListRef}
                  >
                    <AnimatePresence mode="popLayout">
                      {sortedHistory.map((rec) => {
                        // 日付・時刻を1つの表示に統一（二重表示を防ぐ）
                        const datePart = rec.visitDate
                          ? formatSlash(rec.visitDate)
                          : rec.updatedAt
                            ? formatSlash(rec.updatedAt)
                            : "—";
                        const timePart = rec.updatedAt
                          ? formatDateFn(new Date(rec.updatedAt), "HH:mm", {
                              locale: ja,
                            })
                          : null;
                        const displayDateTime =
                          datePart && timePart
                            ? `${datePart} ${timePart}`
                            : (datePart ?? "—");
                        const elapsedWeekLabel =
                          getElapsedWeekLabel(
                            rec.visitDate ?? rec.updatedAt ?? null,
                          ) ?? "—";
                        const isEditing = editingId === rec.id;
                        return (
                          <motion.div
                            ref={(el) => {
                              recordRefs.current[rec.id] = el;
                            }}
                            key={rec.id}
                            layout
                            initial={{ opacity: 0, y: 6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                            transition={{
                              duration: 0.24,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                            className={`rounded-md border px-3 py-2 transition-colors scroll-mt-10 ${
                              savedFlash[rec.id]
                                ? "border-slate-300 bg-slate-50/70"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <span className="text-base font-semibold text-slate-900">
                                  {displayDateTime}
                                </span>
                                <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                                  {elapsedWeekLabel}
                                </span>
                              </span>
                              {rec.milestoneLabel ? (
                                <span className="text-xs text-slate-500">
                                  {rec.milestoneLabel}
                                </span>
                              ) : null}
                            </div>
                            {isEditing ? (
                              <div className="space-y-2 max-h-[32rem] flex flex-col">
                                <div className="space-y-2 overflow-y-auto pr-1 flex-1">
                                  <label className="block text-xs text-slate-500">
                                    訂正理由{" "}
                                    <span className="text-red-500">*</span>
                                  </label>
                                  <div className="relative">
                                    <select
                                      className="record-modal-select w-full pr-9"
                                      value={editForm?.changeReason || ""}
                                      onChange={(e) => {
                                        notifyActivity();
                                        setEditForm((f) =>
                                          f
                                            ? {
                                                ...f,
                                                changeReason: e.target.value,
                                              }
                                            : f,
                                        );
                                      }}
                                    >
                                      <option value="" disabled>
                                        選択してください
                                      </option>
                                      <option value="誤記訂正">
                                        誤記訂正（入力ミス）
                                      </option>
                                      <option value="追加情報">
                                        追加情報の記載
                                      </option>
                                      <option value="再評価に基づく更新">
                                        再評価に基づく更新
                                      </option>
                                      <option value="患者申告修正">
                                        患者申告による修正
                                      </option>
                                      <option value="計画更新">
                                        治療計画の更新
                                      </option>
                                      <option value="その他">その他</option>
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                  </div>
                                  <label className="block text-xs text-slate-500">
                                    施術録内容
                                  </label>
                                  <textarea
                                    className="record-modal-textarea"
                                    rows={3}
                                    ref={narrativeTextareaRef}
                                    value={
                                      editForm?.narrative ??
                                      rec.narrative ??
                                      rec.narrativePreview ??
                                      ""
                                    }
                                    onChange={(e) => {
                                      notifyActivity();
                                      setEditForm((f) =>
                                        f
                                          ? { ...f, narrative: e.target.value }
                                          : f,
                                      );
                                    }}
                                    onInput={autoResizeTextarea}
                                    placeholder="ここに内容を入力"
                                  />
                                  {editError && (
                                    <div className="text-xs text-red-600">
                                      {editError}
                                    </div>
                                  )}
                                  {currentUserNameCache && (
                                    <div className="text-[11px] text-slate-500">
                                      編集者: {currentUserNameCache}
                                    </div>
                                  )}
                                </div>
                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 bg-white/95 backdrop-blur-sm sticky bottom-0">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingId(null);
                                      setEditForm(null);
                                      setEditError(null);
                                    }}
                                    className="h-8"
                                  >
                                    キャンセル
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-8"
                                    disabled={editSaving}
                                    onClick={() => saveRecord(rec.id)}
                                  >
                                    {editSaving ? "保存中…" : "保存"}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">
                                  {(() => {
                                    const hasFull =
                                      !!rec.narrative &&
                                      !!rec.narrativePreview &&
                                      rec.narrativePreview !== rec.narrative;
                                    const isExpanded = expandedRecords[rec.id];
                                    const content =
                                      isExpanded || !hasFull
                                        ? rec.narrative || rec.narrativePreview
                                        : rec.narrativePreview;
                                    return content || "内容なし";
                                  })()}
                                </div>
                                {(() => {
                                  const hasFull =
                                    !!rec.narrative &&
                                    !!rec.narrativePreview &&
                                    rec.narrativePreview !== rec.narrative;
                                  if (!hasFull) return null;
                                  const isExpanded = expandedRecords[rec.id];
                                  return (
                                    <button
                                      type="button"
                                      className="mt-1 text-xs text-slate-600 hover:text-slate-900 underline"
                                      onClick={() =>
                                        setExpandedRecords((prev) => ({
                                          ...prev,
                                          [rec.id]: !isExpanded,
                                        }))
                                      }
                                    >
                                      {isExpanded ? "折りたたむ" : "全文を表示"}
                                    </button>
                                  );
                                })()}
                                {(timePart || rec.updatedBy) && (
                                  <div className="mt-1 text-[11px] text-slate-500">
                                    {rec.updatedBy
                                      ? `更新者 ${rec.updatedBy}`
                                      : null}
                                  </div>
                                )}
                                {rec.visitId && (
                                  <div className="mt-2 flex justify-end">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      className="h-7 px-2.5 text-xs"
                                      onClick={() => {
                                        setEditForm(null);
                                        loadRecord(rec.id, {
                                          narrative: rec.narrative,
                                          narrativePreview:
                                            rec.narrativePreview,
                                        });
                                      }}
                                    >
                                      {editLoading && editingId === rec.id
                                        ? "読込中…"
                                        : "編集"}
                                    </Button>
                                  </div>
                                )}
                              </>
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm text-slate-700">記載日</label>
                  <div className="relative" ref={calendarRef}>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCalendarOpen((v) => !v)}
                        className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-slate-300 bg-white text-sm text-slate-800 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 w-full sm:w-48 justify-between"
                      >
                        <span>{visitDateStr}</span>
                        <svg
                          className="h-4 w-4 text-slate-500"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            x="3"
                            y="4"
                            width="18"
                            height="18"
                            rx="2"
                            ry="2"
                          />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </button>
                      <span className="text-lg font-semibold text-slate-800 whitespace-nowrap">
                        {selectedVisitElapsedWeeksLabel}
                      </span>
                    </div>
                    {calendarOpen && (
                      <div
                        className="absolute top-full left-0 mt-2 w-72 rounded-lg border border-slate-200 bg-white shadow-lg p-3 z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <button
                            type="button"
                            className="text-sm text-slate-600 hover:text-slate-900"
                            onClick={() =>
                              setCalendarMonth((m) => addMonths(m, -1))
                            }
                          >
                            ← 前月
                          </button>
                          <div className="text-sm font-semibold text-slate-800">
                            {formatDateFn(calendarMonth, "yyyy年MM月")}
                          </div>
                          <button
                            type="button"
                            className="text-sm text-slate-600 hover:text-slate-900"
                            onClick={() =>
                              setCalendarMonth((m) => addMonths(m, 1))
                            }
                          >
                            次月 →
                          </button>
                        </div>
                        <div className="grid grid-cols-7 text-center text-xs text-slate-500 mb-1">
                          {["日", "月", "火", "水", "木", "金", "土"].map(
                            (d) => (
                              <div key={d}>{d}</div>
                            ),
                          )}
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-sm">
                          {eachDayOfInterval({
                            start: startOfMonth(calendarMonth),
                            end: endOfMonth(calendarMonth),
                          }).map((day) => {
                            const iso = formatDateFn(day, "yyyy-MM-dd");
                            const isSelected = visitDateStr === iso;
                            const isTodayDate = isToday(day);
                            return (
                              <button
                                key={iso}
                                type="button"
                                onClick={() => {
                                  setVisitDateStr(iso);
                                  setCalendarOpen(false);
                                }}
                                className={`h-8 rounded ${
                                  isSelected
                                    ? "bg-slate-900 text-white"
                                    : isTodayDate
                                      ? "border-2 border-slate-500 text-slate-600 font-semibold hover:bg-slate-50"
                                      : "text-slate-800 hover:bg-slate-100"
                                }`}
                              >
                                {day.getDate()}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm text-slate-700">
                    記録本文（自由記述）
                  </label>
                  <textarea
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                    rows={10}
                    value={narrative}
                    onChange={(e) => {
                      notifyActivity();
                      setNarrative(e.target.value);
                    }}
                    placeholder="施術内容・所見・計画などを自由に記載"
                  />
                </div>

                <div className="text-sm text-slate-600">
                  記載者: {currentUserName || "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-white border-t border-slate-200">
          {recordError ? (
            <div className="text-sm text-red-600 mb-2">{recordError}</div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              size="list"
              variant="outline"
              onClick={() => closeRecordModal()}
              disabled={recordSaving}
            >
              キャンセル
            </Button>
            <Button
              size="list"
              onClick={async () => {
                await markCommit();
                handleSubmitRecordModal(recordModal);
              }}
              disabled={recordSaving}
            >
              {recordSaving ? "登録中..." : "記載する"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default RecordModal;
