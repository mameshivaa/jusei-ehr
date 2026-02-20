"use client";

import { useEffect, useRef, useState } from "react";
import { differenceInYears } from "date-fns";
import AccessibleModal from "@/components/ui/AccessibleModal";
import FormField from "@/components/ui/FormField";
import { Button } from "@/components/ui/button";
import { ChartForm } from "@/components/charts/ChartForm";
import { normalizeSearchQuery } from "@/lib/utils/kana";
import { formatSlash } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";

type PatientSearchItem = {
  id: string;
  name: string;
  kana: string | null;
  patientNumber: string | null;
  birthDate?: string | null;
  phone?: string | null;
};

type CreatedChart = {
  id: string;
  patientId: string;
  status: string;
};

type ChartCreateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialPatient?: PatientSearchItem | null;
  onCreated?: (
    chart: CreatedChart,
    options?: { openRecordAfterCreate?: boolean },
  ) => void;
  enableOpenRecordPreference?: boolean;
};

const OPEN_RECORD_PREF_KEY = "charts.openRecordAfterCreate";

export default function ChartCreateModal({
  isOpen,
  onClose,
  initialPatient = null,
  onCreated,
  enableOpenRecordPreference = false,
}: ChartCreateModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<PatientSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [recentResults, setRecentResults] = useState<PatientSearchItem[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [selectedPatient, setSelectedPatient] =
    useState<PatientSearchItem | null>(initialPatient);
  const [previousInsurance, setPreviousInsurance] = useState<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openRecordAfterCreate, setOpenRecordAfterCreate] = useState(true);

  const resetState = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setSearchTerm("");
    setSearchResults([]);
    setSearchLoading(false);
    setSearchError(null);
    setSearchPerformed(false);
    setRecentResults([]);
    setRecentLoading(false);
    setIsConfirming(false);
    setSelectedPatient(null);
    setPreviousInsurance(null);
  };

  useEffect(() => {
    if (!isOpen) {
      resetState();
      return;
    }
    if (initialPatient) {
      setSelectedPatient(initialPatient);
    }
  }, [isOpen, initialPatient]);

  useEffect(() => {
    if (!enableOpenRecordPreference) return;
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(OPEN_RECORD_PREF_KEY);
    if (stored !== null) {
      setOpenRecordAfterCreate(stored === "true");
    }
  }, [enableOpenRecordPreference]);

  useEffect(() => {
    if (!isOpen || selectedPatient || searchTerm.trim()) return;
    let ignore = false;
    const loadRecent = async () => {
      setRecentLoading(true);
      try {
        const res = await fetch(`/api/patients?recent=1&take=20`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("直近患者の取得に失敗しました");
        const data = (await res.json()) as any[];
        const mapped = Array.isArray(data)
          ? data.map((p) => ({
              id: String(p.id ?? ""),
              name: String(p.name ?? ""),
              kana: p.kana ?? null,
              patientNumber: p.patientNumber ?? null,
              birthDate: p.birthDate ?? null,
              phone: p.phone ?? null,
            }))
          : [];
        if (!ignore) setRecentResults(mapped);
      } catch {
        if (!ignore) setRecentResults([]);
      } finally {
        if (!ignore) setRecentLoading(false);
      }
    };
    void loadRecent();
    return () => {
      ignore = true;
    };
  }, [isOpen, selectedPatient, searchTerm]);

  useEffect(() => {
    if (!selectedPatient) {
      setPreviousInsurance(null);
      return;
    }
    let ignore = false;
    const loadPreviousInsurance = async () => {
      try {
        const res = await fetch(
          `/api/charts?patientId=${encodeURIComponent(selectedPatient.id)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const charts = (await res.json()) as any[];
        if (!Array.isArray(charts) || charts.length === 0) {
          setPreviousInsurance(null);
          return;
        }
        const latest = charts[0];
        if (!ignore) {
          setPreviousInsurance({
            insuranceNumber: latest.insuranceNumber ?? undefined,
            insuranceInsurerNumber: latest.insuranceInsurerNumber ?? undefined,
            insuranceCertificateSymbol:
              latest.insuranceCertificateSymbol ?? undefined,
            insuranceCertificateNumber:
              latest.insuranceCertificateNumber ?? undefined,
            insuranceExpiryDate: latest.insuranceExpiryDate ?? undefined,
            insuranceEffectiveFrom: latest.insuranceEffectiveFrom ?? undefined,
            insuranceCopaymentRate: latest.insuranceCopaymentRate ?? undefined,
            publicAssistanceNumber: latest.publicAssistanceNumber ?? undefined,
            publicAssistanceRecipient:
              latest.publicAssistanceRecipient ?? undefined,
          });
        }
      } catch {
        if (!ignore) setPreviousInsurance(null);
      }
    };
    void loadPreviousInsurance();
    return () => {
      ignore = true;
    };
  }, [selectedPatient]);

  const highlightSearchText = (value?: string | null) => {
    const text = value ?? "";
    const keyword = searchTerm.trim();
    if (!keyword) return text || "—";
    if (!text) return "—";
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try {
      const regex = new RegExp(`(${escaped})`, "gi");
      const parts = text.split(regex);
      return parts.map((part, index) => {
        const key = `${index}-${part}`;
        if (!part) return <span key={key} />;
        const isMatch = part.toLowerCase() === keyword.toLowerCase();
        return isMatch ? (
          <mark
            key={key}
            className="rounded bg-slate-200 px-0.5 text-slate-800"
          >
            {part}
          </mark>
        ) : (
          <span key={key}>{part}</span>
        );
      });
    } catch {
      return text;
    }
  };

  const performSearch = async (term: string, auto = false) => {
    const trimmed = term.trim();
    if (!trimmed) {
      if (!auto) setSearchError("検索キーワードを入力してください");
      setSearchResults([]);
      setSearchLoading(false);
      setSearchPerformed(false);
      return;
    }
    setSearchLoading(true);
    if (!auto) setSearchError(null);
    setSearchPerformed(true);
    try {
      // ひらがなをカタカナに変換してから検索
      const normalizedQuery = normalizeSearchQuery(trimmed);
      const res = await fetch(
        `/api/patients?q=${encodeURIComponent(normalizedQuery)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("患者検索に失敗しました");
      const data = (await res.json()) as any[];
      const mapped = Array.isArray(data)
        ? data.map((p) => ({
            id: String(p.id ?? ""),
            name: String(p.name ?? ""),
            kana: p.kana ?? null,
            patientNumber: p.patientNumber ?? null,
            birthDate: p.birthDate ?? null,
            phone: p.phone ?? null,
          }))
        : [];
      const limited = mapped.slice(0, 8);
      setSearchResults(limited);
      if (!auto) setRecentResults([]);
      setSearchError(
        limited.length === 0 ? "該当する患者が見つかりませんでした" : null,
      );
    } catch (err) {
      setSearchResults([]);
      setSearchError(
        err instanceof Error ? err.message : "患者検索に失敗しました",
      );
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectPatient = (patient: PatientSearchItem) => {
    setSelectedPatient(patient);
    setSearchError(null);
  };

  const handleCreated = (chart: CreatedChart) => {
    onCreated?.(
      chart,
      enableOpenRecordPreference ? { openRecordAfterCreate } : undefined,
    );
    handleClose();
  };

  const confirmOptionsSlot = enableOpenRecordPreference ? (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
        checked={openRecordAfterCreate}
        onChange={(e) => {
          const value = e.target.checked;
          setOpenRecordAfterCreate(value);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(OPEN_RECORD_PREF_KEY, String(value));
          }
        }}
      />
      そのまま作成したカルテの施術録を記入する
    </label>
  ) : null;

  const handleClose = () => {
    onClose();
    resetState();
  };

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={handleClose}
      title="新規カルテ作成"
      size="xxl"
      className="w-[1000px] min-w-[820px] max-w-[calc(100vw-2rem)] h-[80vh] min-h-[80vh]"
    >
      <div className="flex w-full h-full flex-col">
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="flex w-full flex-col">
            {/* 検索バー */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!selectedPatient) {
                    void performSearch(searchTerm, false);
                  }
                }}
                className="flex items-center gap-2 flex-1"
              >
                <div className="relative flex-1">
                  <input
                    className={cn(
                      "w-full h-9 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors",
                      selectedPatient
                        ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                        : "border-slate-300 bg-white text-slate-900",
                    )}
                    placeholder={
                      selectedPatient
                        ? "患者を変更ボタンを押して検索"
                        : "患者を検索（Enterキーで検索）"
                    }
                    value={searchTerm}
                    onChange={(e) => {
                      if (!selectedPatient) {
                        setSearchTerm(e.target.value);
                        if (searchError) setSearchError(null);
                        if (!e.target.value.trim()) {
                          setSearchResults([]);
                          setSearchPerformed(false);
                        }
                      }
                    }}
                    disabled={searchLoading || !!selectedPatient}
                  />
                  {searchTerm && !selectedPatient && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm("");
                        setSearchResults([]);
                        setSearchPerformed(false);
                        setSearchError(null);
                        setRecentResults([]);
                      }}
                      className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
                <Button
                  type="submit"
                  size="list"
                  variant="secondary"
                  loading={searchLoading}
                  loadingText="検索中..."
                  className="shrink-0"
                  disabled={!!selectedPatient}
                >
                  検索
                </Button>
              </form>
            </div>
            {searchError && (
              <div className="px-6 py-2 text-xs text-red-600 bg-red-50">
                {searchError}
              </div>
            )}

            {/* 患者選択時：選択された患者を明確に表示 */}
            {selectedPatient && (
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-600 text-white text-sm font-semibold">
                      ✓
                    </div>
                    <div className="flex items-center gap-x-4 flex-1 min-w-0 text-sm">
                      <div className="font-semibold text-slate-900 truncate">
                        {selectedPatient.name}
                      </div>
                      {selectedPatient.kana && (
                        <div className="text-slate-600 truncate">
                          {selectedPatient.kana}
                        </div>
                      )}
                      {selectedPatient.patientNumber && (
                        <div className="text-slate-600 shrink-0">
                          ID: {selectedPatient.patientNumber}
                        </div>
                      )}
                      {selectedPatient.birthDate &&
                        (() => {
                          try {
                            const birthDate = new Date(
                              selectedPatient.birthDate,
                            );
                            const age = !isNaN(birthDate.getTime())
                              ? differenceInYears(new Date(), birthDate)
                              : null;
                            return (
                              <>
                                <div className="text-slate-600 shrink-0">
                                  生年月日:{" "}
                                  {formatSlash(selectedPatient.birthDate) ||
                                    selectedPatient.birthDate}
                                </div>
                                {age !== null && (
                                  <div className="text-slate-600 shrink-0">
                                    {age}歳
                                  </div>
                                )}
                              </>
                            );
                          } catch {
                            return (
                              <div className="text-slate-600 shrink-0">
                                生年月日:{" "}
                                {formatSlash(selectedPatient.birthDate) ||
                                  selectedPatient.birthDate}
                              </div>
                            );
                          }
                        })()}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSelectedPatient(null);
                      setSearchTerm("");
                      setSearchResults([]);
                    }}
                    className="shrink-0"
                  >
                    患者を変更
                  </Button>
                </div>
              </div>
            )}

            {/* 患者未選択時：検索結果を表示 */}
            {!selectedPatient && (
              <div className="flex-1 overflow-y-auto min-h-0">
                {searchLoading && searchResults.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    <svg
                      className="mx-auto h-5 w-5 animate-spin text-slate-400 mb-2"
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
                    検索中
                  </div>
                ) : searchTerm.trim() ? (
                  searchResults.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">
                      {searchPerformed
                        ? "該当する患者が見つかりませんでした"
                        : "患者を検索してください"}
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-200">
                      {searchResults.map((patient) => {
                        return (
                          <li key={patient.id}>
                            <button
                              type="button"
                              onClick={() => handleSelectPatient(patient)}
                              className="w-full px-6 py-5 text-left hover:bg-slate-50 active:bg-slate-100 focus:outline-none focus:bg-slate-50 transition-colors cursor-pointer"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-base text-slate-700">
                                    {patient.patientNumber && (
                                      <span className="text-slate-600 text-base">
                                        {highlightSearchText(
                                          patient.patientNumber,
                                        )}
                                      </span>
                                    )}
                                    <span className="text-slate-900 text-lg font-normal">
                                      {highlightSearchText(patient.name)}
                                    </span>
                                    {patient.kana && (
                                      <span className="text-slate-600 text-base">
                                        {highlightSearchText(patient.kana)}
                                      </span>
                                    )}
                                    {patient.birthDate &&
                                      (() => {
                                        const formatted =
                                          formatSlash(patient.birthDate) ||
                                          patient.birthDate;
                                        const age = (() => {
                                          try {
                                            const birthDate = new Date(
                                              patient.birthDate,
                                            );
                                            if (
                                              Number.isNaN(birthDate.getTime())
                                            )
                                              return null;
                                            return differenceInYears(
                                              new Date(),
                                              birthDate,
                                            );
                                          } catch {
                                            return null;
                                          }
                                        })();
                                        return (
                                          <span className="text-slate-600 text-base">
                                            {formatted}
                                            {age !== null ? `（${age}歳）` : ""}
                                          </span>
                                        );
                                      })()}
                                  </div>
                                </div>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )
                ) : recentLoading ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    <svg
                      className="mx-auto h-5 w-5 animate-spin text-slate-400 mb-2"
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
                    直近の患者を読み込み中
                  </div>
                ) : recentResults.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    直近の患者が見つかりませんでした
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-200">
                    {recentResults.map((patient) => {
                      return (
                        <li key={patient.id}>
                          <button
                            type="button"
                            onClick={() => handleSelectPatient(patient)}
                            className="w-full px-6 py-5 text-left hover:bg-slate-50 active:bg-slate-100 focus:outline-none focus:bg-slate-50 transition-colors cursor-pointer"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-base text-slate-700">
                                  {patient.patientNumber && (
                                    <span className="text-slate-600 text-base">
                                      {highlightSearchText(
                                        patient.patientNumber,
                                      )}
                                    </span>
                                  )}
                                  <span className="text-slate-900 text-lg font-normal">
                                    {highlightSearchText(patient.name)}
                                  </span>
                                  {patient.kana && (
                                    <span className="text-slate-600 text-base">
                                      {highlightSearchText(patient.kana)}
                                    </span>
                                  )}
                                  {patient.birthDate &&
                                    (() => {
                                      const formatted =
                                        formatSlash(patient.birthDate) ||
                                        patient.birthDate;
                                      const age = (() => {
                                        try {
                                          const birthDate = new Date(
                                            patient.birthDate,
                                          );
                                          if (Number.isNaN(birthDate.getTime()))
                                            return null;
                                          return differenceInYears(
                                            new Date(),
                                            birthDate,
                                          );
                                        } catch {
                                          return null;
                                        }
                                      })();
                                      return (
                                        <span className="text-slate-600 text-base">
                                          {formatted}
                                          {age !== null ? `（${age}歳）` : ""}
                                        </span>
                                      );
                                    })()}
                                </div>
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {/* 患者選択時：カルテ情報入力フォームを表示 */}
            {selectedPatient && (
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="p-6 overflow-visible">
                  <ChartForm
                    key={selectedPatient.id}
                    patientId={selectedPatient.id}
                    isEdit={false}
                    previousInsurance={previousInsurance}
                    onCreated={handleCreated}
                    redirectOnSuccess={false}
                    onConfirmStateChange={setIsConfirming}
                    confirmOptionsSlot={confirmOptionsSlot}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        {/* モーダル下部に固定されたボタン */}
        {selectedPatient && !isConfirming && (
          <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm text-slate-700 hover:text-slate-900"
            >
              キャンセル
            </button>
            <button
              type="submit"
              form="chart-form"
              className="px-4 py-2 text-sm font-medium text-white bg-[#3f3f3f] rounded-md hover:bg-[#494949] active:bg-[#323232] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              作成
            </button>
          </div>
        )}
      </div>
    </AccessibleModal>
  );
}
