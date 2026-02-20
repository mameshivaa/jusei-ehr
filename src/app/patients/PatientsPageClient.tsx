"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { differenceInYears, differenceInCalendarDays, format } from "date-fns";
import { ja } from "date-fns/locale";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import PageHeader from "@/components/layout/PageHeader";
import Toolbar from "@/components/ui/Toolbar";
import { Button } from "@/components/ui/button";
import { ListHeader, ListPanel } from "@/components/ui/ListPanel";
import ListEmptyState from "@/components/ui/ListEmptyState";
import type { ListGridColumn } from "@/components/ui/ListGrid";
import AccessibleModal from "@/components/ui/AccessibleModal";
import { PatientForm } from "@/components/patients/PatientForm";
import { getChartStatusLabel } from "@/lib/charts/status";
import ChartCreateModal from "@/components/charts/ChartCreateModal";

type PatientItem = {
  id: string;
  name: string;
  kana?: string | null;
  patientNumber?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  chartsCount?: number | null;
  injuriesCount?: number | null;
  visitsCount?: number | null;
  lastVisit?: string | null;
  memo?: string | null;
};

export default function PatientsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PatientItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<PatientItem | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [createChartOpen, setCreateChartOpen] = useState(false);
  const [createChartPatient, setCreateChartPatient] =
    useState<PatientItem | null>(null);
  const [hideCreateModal, setHideCreateModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const prefersReduced = useReducedMotion();
  const EASE_OUT: any = [0.16, 1, 0.3, 1];
  const LAYOUT_DUR = 0.32;
  const FADE_DUR = 0.2;

  async function fetchPatients() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/patients?${params.toString()}`, {
        cache: "no-store",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "患者一覧の取得に失敗しました");
      setItems(Array.isArray(j) ? j : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "患者一覧の取得に失敗しました",
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = async (patient: PatientItem) => {
    setDetailTarget(patient);
    setDetailData(null);
    setDetailError(null);
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const res = await fetch(`/api/patients/${patient.id}`, {
        cache: "no-store",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error((j as any)?.error || "患者情報の取得に失敗しました");
      setDetailData(j);
    } catch (e) {
      setDetailError(
        e instanceof Error ? e.message : "患者情報の取得に失敗しました",
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailData(null);
    setDetailError(null);
    setDetailTarget(null);
    setIsEditMode(false);
    setCreateChartPatient(null);
  };

  const isCreateOpen = searchParams?.get("new") === "1";

  useEffect(() => {
    if (!isCreateOpen) {
      setHideCreateModal(false);
    }
  }, [isCreateOpen]);

  const closeCreate = () => {
    router.replace("/patients", { scroll: false });
  };

  const right = (
    <div className="flex items-center gap-2">
      <Link href="/patients?new=1">
        <Button size="list">新規患者登録</Button>
      </Link>
    </div>
  );

  const rows = useMemo(() => items, [items]);

  const calcAge = (birthDate?: string | null) => {
    if (!birthDate) return "—";
    const d = new Date(birthDate);
    if (Number.isNaN(d.getTime())) return "—";
    return `${differenceInYears(new Date(), d)}歳`;
  };

  const statusLabel = (lastVisit?: string | null) => {
    if (!lastVisit) return "—";
    const days = differenceInCalendarDays(new Date(), new Date(lastVisit));
    if (days <= 30) return "通院中";
    if (days <= 90) return "フォロー";
    return "休診中";
  };

  const columns: ListGridColumn[] = [
    { id: "id", label: "患者ID" },
    { id: "name", label: "氏名 / フリガナ" },
    { id: "last", label: "最終来院", className: "hidden sm:block" },
    { id: "age", label: "年齢", className: "hidden md:block text-right" },
    { id: "cvi", label: "カルテ数", className: "hidden lg:block text-right" },
    { id: "status", label: "状態", className: "text-right" },
    { id: "action", label: "操作", className: "text-right" },
  ];

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="患者管理"
        subtitle="患者を検索し、詳細を表示・登録します"
      />
      <Toolbar right={right}>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            className="h-9 border border-slate-300 rounded-md px-3 text-sm"
            placeholder="検索（氏名 / フリガナ / 患者ID）"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") fetchPatients();
            }}
          />
          <Button
            size="list"
            variant="secondary"
            onClick={fetchPatients}
            disabled={loading}
            className="whitespace-nowrap"
          >
            {loading ? "検索中…" : "検索"}
          </Button>
          <div className="ml-2 inline-flex items-center gap-1 text-base text-slate-700">
            <span>件数</span>
            <span className="text-lg font-semibold text-slate-900">
              {rows.length}
            </span>
          </div>
        </div>
      </Toolbar>

      <ListPanel listRootId="1">
        <ListHeader
          className="px-[var(--space-4)] sm:px-[var(--space-5)] lg:px-[var(--space-6)] 
                     py-[var(--space-2)] text-slate-700 grid gap-2 
                     grid-cols-[8rem_1fr_8rem] 
                     md:grid-cols-[8rem_1fr_10rem_8rem_8rem] 
                     lg:grid-cols-[10rem_1fr_12rem_9rem_9rem]"
        >
          <div>患者ID</div>
          <div>氏名</div>
          <div className="hidden md:block">最終来院</div>
          <div className="hidden md:block text-right">カルテ数</div>
          <div className="text-right">操作</div>
        </ListHeader>

        <div className="divide-y">
          {loading && items.length === 0 ? (
            <ListEmptyState
              variant="loading"
              message="患者一覧を読み込み中..."
            />
          ) : error && items.length === 0 ? (
            <ListEmptyState
              variant="error"
              message={error}
              action={
                <Button size="list" variant="outline" onClick={fetchPatients}>
                  再読み込み
                </Button>
              }
            />
          ) : rows.length === 0 ? (
            <ListEmptyState message="患者が見つかりません" />
          ) : (
            <AnimatePresence initial={false}>
              {rows.map((p) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={prefersReduced ? false : { opacity: 0.9, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={
                    prefersReduced
                      ? { duration: 0 }
                      : {
                          layout: { duration: LAYOUT_DUR, ease: EASE_OUT },
                          opacity: { duration: FADE_DUR, ease: EASE_OUT },
                        }
                  }
                  className="px-[var(--space-4)] sm:px-[var(--space-5)] lg:px-[var(--space-6)] py-[var(--space-2)] grid items-center gap-2 text-base 
                             grid-cols-[8rem_1fr_7rem] 
                             md:grid-cols-[8rem_1fr_10rem_8rem_8rem] 
                             lg:grid-cols-[10rem_1fr_12rem_9rem_9rem]
                             hover:bg-slate-50 transition-colors"
                >
                  <div className="text-scale-emphasis text-slate-700 font-mono whitespace-nowrap">
                    {p.patientNumber || p.id}
                  </div>
                  <div className="leading-tight min-w-0 overflow-hidden">
                    <div className="text-xs text-gray-500 whitespace-nowrap truncate">
                      {p.kana || "—"}
                    </div>
                    <div className="font-medium text-gray-900 whitespace-nowrap truncate">
                      {p.name}
                    </div>
                  </div>
                  <div className="hidden md:block text-sm text-gray-800 whitespace-nowrap">
                    {p.lastVisit
                      ? format(new Date(p.lastVisit), "yyyy/MM/dd", {
                          locale: ja,
                        })
                      : "—"}
                  </div>
                  <div className="hidden md:block text-right text-sm text-gray-800 whitespace-nowrap">
                    {p.chartsCount ?? "—"}
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button
                        size="list"
                        variant="secondary"
                        onClick={() => openDetail(p)}
                      >
                        詳細
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </ListPanel>

      <AccessibleModal
        isOpen={isCreateOpen && !hideCreateModal}
        onClose={closeCreate}
        title="新規患者登録"
        description="基本情報を入力して患者を登録します"
        size="xl"
      >
        <PatientForm
          onSuccess={(patient, options) => {
            if (options?.createChart) {
              setCreateChartPatient({
                id: patient.id,
                name: patient.name,
                kana: patient.kana ?? null,
                patientNumber: patient.patientNumber ?? null,
                birthDate: patient.birthDate ?? null,
                gender: patient.gender ?? null,
                chartsCount: patient.chartsCount ?? null,
                injuriesCount: patient.injuriesCount ?? null,
                visitsCount: patient.visitsCount ?? null,
                lastVisit: patient.lastVisit ?? null,
                memo: patient.memo ?? null,
              });
              setCreateChartOpen(true);
              setHideCreateModal(true);
              void fetchPatients();
            } else {
              closeCreate();
              fetchPatients();
            }
          }}
        />
      </AccessibleModal>

      <AccessibleModal
        isOpen={detailOpen}
        onClose={closeDetail}
        title="患者詳細"
        size="3xl"
        showCloseButton={false}
        headerActions={
          !isEditMode ? (
            <Button
              size="list"
              variant="ghost"
              onClick={closeDetail}
              className="hover:bg-slate-100"
            >
              閉じる
            </Button>
          ) : undefined
        }
      >
        {detailLoading && (
          <div className="py-6 text-base text-slate-600">読み込み中…</div>
        )}
        {detailError && (
          <div className="py-4 text-base text-red-600">{detailError}</div>
        )}
        {!detailLoading && !detailError && detailTarget && (
          <div className="space-y-6">
            {/* サマリ */}
            <div className="space-y-1 pt-2">
              <div className="text-2xl font-bold text-slate-900">
                {detailTarget.name}
              </div>
              <div className="text-base text-slate-600">
                {detailTarget.kana || "—"}
              </div>
              <div className="text-sm text-slate-500 font-mono">
                患者ID: {detailTarget.patientNumber || "—"}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 text-base">
                <InfoBlock
                  label="年齢"
                  value={calcAge(detailTarget.birthDate)}
                />
                <InfoBlock
                  label="最終来院"
                  value={
                    detailTarget.lastVisit
                      ? format(new Date(detailTarget.lastVisit), "yyyy/MM/dd", {
                          locale: ja,
                        })
                      : "—"
                  }
                />
                <InfoBlock
                  label="カルテ数"
                  value={detailTarget.chartsCount ?? "—"}
                />
                <InfoBlock
                  label="状態"
                  value={statusLabel(detailTarget.lastVisit)}
                />
              </div>
            </div>

            {/* 基本情報 */}
            {detailData && (
              <InlineEditableSection
                detailData={detailData}
                isEditMode={isEditMode}
                onSave={async () => {
                  if (!detailTarget) return;
                  try {
                    const res = await fetch(
                      `/api/patients/${detailTarget.id}`,
                      {
                        cache: "no-store",
                      },
                    );
                    const j = await res.json().catch(() => ({}));
                    if (res.ok) {
                      setDetailData(j);
                      setDetailTarget({
                        ...detailTarget,
                        name: `${j.lastName || ""}${j.firstName || ""}`,
                        kana: `${j.lastKana || ""}${j.firstKana || ""}`,
                      });
                    }
                  } catch (e) {
                    console.error("Failed to refresh patient data:", e);
                  }
                  setIsEditMode(false);
                }}
                onCancel={() => setIsEditMode(false)}
              />
            )}

            {/* カルテのみ表示 */}
            {!isEditMode && (
              <div className="flex justify-end gap-3 pb-3 border-b border-slate-200">
                {detailTarget && (
                  <Button
                    size="list"
                    variant="secondary"
                    onClick={() => {
                      setCreateChartPatient(detailTarget);
                      setCreateChartOpen(true);
                    }}
                  >
                    新規カルテ作成
                  </Button>
                )}
                <Button
                  size="list"
                  variant="outline"
                  onClick={() => setIsEditMode(true)}
                >
                  編集
                </Button>
              </div>
            )}
            {detailData?.charts?.length ? (
              <section className="p-1">
                <div className="text-sm font-semibold text-slate-700 mb-3">
                  カルテ一覧
                </div>
                <div className="space-y-3">
                  {detailData.charts.slice(0, 6).map((c: any) => (
                    <div
                      key={c.id}
                      className="w-full rounded-xl border border-slate-200 bg-white p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 text-sm">
                          {c.insuranceType && (
                            <div className="text-slate-700">
                              保険種別:{" "}
                              <span className="font-medium text-slate-900">
                                {c.insuranceType}
                              </span>
                            </div>
                          )}
                          {c.status && (
                            <div className="text-slate-700">
                              状態:{" "}
                              <span className="font-medium text-slate-900">
                                {getChartStatusLabel(c.status)}
                              </span>
                            </div>
                          )}
                        </div>
                        {detailTarget && (
                          <Link href={`/charts?chartId=${c.id}`}>
                            <Button size="list" variant="secondary">
                              カルテ管理で詳細を開く
                            </Button>
                          </Link>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm text-slate-800 pt-2 border-t border-slate-100">
                        <div className="space-y-0.5">
                          <div className="text-slate-500 text-xs">来院回数</div>
                          <div className="font-semibold tabular-nums">
                            {c.visitsCount ?? "—"}
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-slate-500 text-xs">負傷件数</div>
                          <div className="font-semibold tabular-nums">
                            {c.injuriesCount ?? "—"}
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-slate-500 text-xs">最終来院</div>
                          <div className="font-semibold tabular-nums">
                            {c.lastVisitDate
                              ? format(
                                  new Date(c.lastVisitDate),
                                  "yyyy/MM/dd",
                                  { locale: ja },
                                )
                              : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </AccessibleModal>

      <ChartCreateModal
        isOpen={createChartOpen}
        onClose={() => {
          setCreateChartOpen(false);
          if (hideCreateModal) {
            closeCreate();
            void fetchPatients();
          }
        }}
        initialPatient={
          createChartPatient
            ? {
                id: createChartPatient.id,
                name: createChartPatient.name,
                kana: createChartPatient.kana ?? null,
                patientNumber: createChartPatient.patientNumber ?? null,
                birthDate: createChartPatient.birthDate ?? null,
                phone: null,
              }
            : null
        }
        onCreated={() => {
          void fetchPatients();
        }}
      />
    </div>
  );
}

function InfoBlock({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-slate-500 text-xs">{label}</div>
      <div className="text-slate-900 text-sm">{value ?? "—"}</div>
    </div>
  );
}

function InlineEditableSection({
  detailData,
  isEditMode,
  onSave,
  onCancel,
}: {
  detailData: any;
  isEditMode: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    gender: detailData.gender || "",
    birthDate: detailData.birthDate
      ? new Date(detailData.birthDate).toISOString().split("T")[0]
      : "",
    phone: detailData.phone || "",
    email: detailData.email || "",
    postalCode: detailData.postalCode || "",
    prefecture: detailData.prefecture || "",
    city: detailData.city || "",
    address1: detailData.address1 || "",
    address2: detailData.address2 || "",
    memo: detailData.memo || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isEditMode) {
      setFormData({
        gender: detailData.gender || "",
        birthDate: detailData.birthDate
          ? new Date(detailData.birthDate).toISOString().split("T")[0]
          : "",
        phone: detailData.phone || "",
        email: detailData.email || "",
        postalCode: detailData.postalCode || "",
        prefecture: detailData.prefecture || "",
        city: detailData.city || "",
        address1: detailData.address1 || "",
        address2: detailData.address2 || "",
        memo: detailData.memo || "",
      });
    }
  }, [isEditMode, detailData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/patients/${detailData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lastName: detailData.lastName,
          firstName: detailData.firstName,
          lastKana: detailData.lastKana,
          firstKana: detailData.firstKana,
          patientNumber: detailData.patientNumber,
          birthDate: formData.birthDate || null,
          gender: formData.gender || null,
          phone: formData.phone || null,
          email: formData.email || null,
          postalCode: formData.postalCode || null,
          prefecture: formData.prefecture || null,
          city: formData.city || null,
          address1: formData.address1 || null,
          address2: formData.address2 || null,
          memo: formData.memo || null,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "保存に失敗しました");
      }

      onSave();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const PREFECTURES = [
    "北海道",
    "青森県",
    "岩手県",
    "宮城県",
    "秋田県",
    "山形県",
    "福島県",
    "茨城県",
    "栃木県",
    "群馬県",
    "埼玉県",
    "千葉県",
    "東京都",
    "神奈川県",
    "新潟県",
    "富山県",
    "石川県",
    "福井県",
    "山梨県",
    "長野県",
    "岐阜県",
    "静岡県",
    "愛知県",
    "三重県",
    "滋賀県",
    "京都府",
    "大阪府",
    "兵庫県",
    "奈良県",
    "和歌山県",
    "鳥取県",
    "島根県",
    "岡山県",
    "広島県",
    "山口県",
    "徳島県",
    "香川県",
    "愛媛県",
    "高知県",
    "福岡県",
    "佐賀県",
    "長崎県",
    "熊本県",
    "大分県",
    "宮崎県",
    "鹿児島県",
    "沖縄県",
  ];

  const inputBaseClass =
    "w-full px-3 py-2 border-2 border-slate-300 rounded-md bg-white text-slate-900 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 hover:border-slate-400";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}
      <div
        className={`flex items-center justify-between pb-2 border-b transition-colors ${isEditMode ? "border-slate-300" : "border-slate-200"}`}
      >
        <div
          className={`text-sm font-semibold transition-colors ${isEditMode ? "text-slate-800" : "text-slate-700"}`}
        >
          基本情報
        </div>
        {isEditMode && (
          <div className="flex items-center gap-2 text-xs font-semibold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-md border-2 border-slate-300">
            <div className="h-2 w-2 rounded-full bg-slate-600 animate-pulse" />
            <span>編集中</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isEditMode ? (
          <>
            <div className="space-y-1.5">
              <label className="block text-slate-800 text-xs font-semibold">
                性別
              </label>
              <select
                value={formData.gender}
                onChange={(e) =>
                  setFormData({ ...formData, gender: e.target.value })
                }
                className={inputBaseClass}
              >
                <option value="">選択してください</option>
                <option value="男性">男性</option>
                <option value="女性">女性</option>
                <option value="その他">その他</option>
                <option value="未回答">未回答</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-slate-800 text-xs font-semibold">
                生年月日
              </label>
              <input
                type="date"
                value={formData.birthDate}
                onChange={(e) =>
                  setFormData({ ...formData, birthDate: e.target.value })
                }
                className={inputBaseClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-slate-800 text-xs font-semibold">
                電話
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="090-1234-5678"
                className={inputBaseClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-slate-800 text-xs font-semibold">
                メール
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="example@email.com"
                className={inputBaseClass}
              />
            </div>
          </>
        ) : (
          <>
            <InfoBlock label="性別" value={detailData.gender || "—"} />
            <InfoBlock
              label="生年月日"
              value={
                detailData.birthDate
                  ? format(new Date(detailData.birthDate), "yyyy/MM/dd", {
                      locale: ja,
                    })
                  : "—"
              }
            />
            <InfoBlock label="電話" value={detailData.phone || "—"} />
            <InfoBlock label="メール" value={detailData.email || "—"} />
          </>
        )}
      </div>
      <div className="space-y-1.5">
        <label
          className={`block text-xs font-medium transition-colors ${isEditMode ? "text-slate-800 font-semibold" : "text-slate-500"}`}
        >
          住所
        </label>
        {isEditMode ? (
          <div className="grid grid-cols-1 gap-2.5">
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="郵便番号"
                value={formData.postalCode}
                onChange={(e) =>
                  setFormData({ ...formData, postalCode: e.target.value })
                }
                className={`${inputBaseClass} col-span-1`}
              />
              <select
                value={formData.prefecture}
                onChange={(e) =>
                  setFormData({ ...formData, prefecture: e.target.value })
                }
                className={`${inputBaseClass} col-span-2`}
              >
                <option value="">都道府県を選択</option>
                {PREFECTURES.map((pref) => (
                  <option key={pref} value={pref}>
                    {pref}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              placeholder="市区町村"
              value={formData.city}
              onChange={(e) =>
                setFormData({ ...formData, city: e.target.value })
              }
              className={inputBaseClass}
            />
            <input
              type="text"
              placeholder="番地・建物名"
              value={formData.address1}
              onChange={(e) =>
                setFormData({ ...formData, address1: e.target.value })
              }
              className={inputBaseClass}
            />
            <input
              type="text"
              placeholder="その他（任意）"
              value={formData.address2}
              onChange={(e) =>
                setFormData({ ...formData, address2: e.target.value })
              }
              className={inputBaseClass}
            />
          </div>
        ) : (
          <div className="text-slate-900 leading-relaxed text-sm py-1">
            {[
              detailData.postalCode ? `〒${detailData.postalCode}` : null,
              detailData.prefecture,
              detailData.city,
              detailData.address1,
              detailData.address2,
            ]
              .filter(Boolean)
              .join(" ") || "—"}
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <label
          className={`block text-xs font-medium transition-colors ${isEditMode ? "text-slate-800 font-semibold" : "text-slate-500"}`}
        >
          メモ
        </label>
        {isEditMode ? (
          <textarea
            value={formData.memo}
            onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
            rows={4}
            placeholder="メモを入力してください"
            className={`${inputBaseClass} resize-y`}
          />
        ) : detailData.memo ? (
          <div className="text-slate-900 whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-md p-3 text-sm min-h-[4rem]">
            {detailData.memo}
          </div>
        ) : (
          <div className="text-slate-400 text-sm py-2">—</div>
        )}
      </div>
      {isEditMode && (
        <div className="flex justify-end gap-3 pt-4 border-t-2 border-slate-200">
          <Button
            type="button"
            size="list"
            variant="outline"
            onClick={onCancel}
            disabled={saving}
          >
            キャンセル
          </Button>
          <Button
            type="submit"
            size="list"
            variant="secondary"
            disabled={saving}
            className="shadow-md hover:shadow-lg transition-all"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                保存中...
              </span>
            ) : (
              "保存"
            )}
          </Button>
        </div>
      )}
    </form>
  );
}
