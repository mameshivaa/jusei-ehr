"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChartStatus } from "@prisma/client";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ACTIVE_CHART_STATUS } from "@/lib/charts/status";
import { getChartStatusOptions } from "./ChartStatusBadge";
import { useUser } from "@/hooks/useUser";
import { useDraftTracking } from "@/hooks/useDraftTracking";
import { Select } from "@/components/ui/Select";
import { INSURANCE_OPTIONS } from "@/lib/charts/insurance-options";
import { validateInjury } from "@/lib/injuries/injury-validation";
import { JudoInjuryNameInput } from "@/components/injuries/JudoInjuryNameInput";

// 保険種別の選択肢（JUXSEI互換）
const INSURANCE_TYPE_OPTIONS = [
  { value: "", label: "選択してください" },
  ...INSURANCE_OPTIONS.map((value) => ({ value, label: value })),
];

type ChartFormData = {
  id?: string;
  insuranceType: string | null;
  status: ChartStatus;
  insuranceNumber: string;
  insuranceInsurerNumber: string;
  insuranceCertificateSymbol: string;
  insuranceCertificateNumber: string;
  insuranceExpiryDate: string;
  insuranceEffectiveFrom: string;
  insuranceCopaymentRate: string;
  publicAssistanceNumber: string;
  publicAssistanceRecipient: string;
};

type SharedInjuryInput = {
  injuryDate: string;
  firstVisitDate: string;
  memo: string;
};

type ChartFormProps = {
  patientId: string;
  initialData?: ChartFormData;
  isEdit?: boolean;
  previousInsurance?: Partial<
    Pick<
      ChartFormData,
      | "insuranceNumber"
      | "insuranceInsurerNumber"
      | "insuranceCertificateSymbol"
      | "insuranceCertificateNumber"
      | "insuranceExpiryDate"
      | "insuranceEffectiveFrom"
      | "insuranceCopaymentRate"
      | "publicAssistanceNumber"
      | "publicAssistanceRecipient"
    >
  > | null;
  onCreated?: (chart: {
    id: string;
    patientId: string;
    status: ChartStatus;
  }) => void;
  redirectOnSuccess?: boolean;
  onConfirmStateChange?: (open: boolean) => void;
  confirmOptionsSlot?: React.ReactNode;
};

export function ChartForm({
  patientId,
  initialData,
  isEdit = false,
  previousInsurance = null,
  onCreated,
  redirectOnSuccess = true,
  onConfirmStateChange,
  confirmOptionsSlot,
}: ChartFormProps) {
  const router = useRouter();
  const { user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    insuranceType?: string;
    injuryNames?: string[];
    shared?: {
      firstVisitDate?: string;
      injuryDate?: string;
    };
  }>({});
  const insuranceSelectRef = useRef<HTMLDivElement | null>(null);
  const injuryInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const firstVisitDateRef = useRef<HTMLInputElement | null>(null);
  const injuryDateRef = useRef<HTMLInputElement | null>(null);
  const [isInsuranceExpanded, setIsInsuranceExpanded] = useState(false);

  // 当日の日付をYYYY-MM-DD形式で取得
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [sharedInjury, setSharedInjury] = useState<SharedInjuryInput>({
    injuryDate: isEdit ? "" : getTodayDateString(),
    firstVisitDate: isEdit ? "" : getTodayDateString(),
    memo: "",
  });
  const [injuryNames, setInjuryNames] = useState<string[]>(isEdit ? [] : [""]);
  const [injuryInputs, setInjuryInputs] = useState<string[]>(
    isEdit ? [] : [""],
  );
  const [injuryMasterIds, setInjuryMasterIds] = useState<(string | null)[]>(
    isEdit ? [] : [null],
  );
  const [injuryRefreshTokens, setInjuryRefreshTokens] = useState<number[]>(
    isEdit ? [] : [0],
  );
  const [medicalQueries, setMedicalQueries] = useState<string[]>(
    isEdit ? [] : [""],
  );
  const [medicalConfirmed, setMedicalConfirmed] = useState<string[]>(
    isEdit ? [] : [""],
  );

  const insuranceFallback = useMemo(
    () => ({
      insuranceNumber: previousInsurance?.insuranceNumber ?? "",
      insuranceInsurerNumber: previousInsurance?.insuranceInsurerNumber ?? "",
      insuranceCertificateSymbol:
        previousInsurance?.insuranceCertificateSymbol ?? "",
      insuranceCertificateNumber:
        previousInsurance?.insuranceCertificateNumber ?? "",
      insuranceExpiryDate: previousInsurance?.insuranceExpiryDate ?? "",
      insuranceEffectiveFrom: previousInsurance?.insuranceEffectiveFrom ?? "",
      insuranceCopaymentRate: previousInsurance?.insuranceCopaymentRate ?? "",
      publicAssistanceNumber: previousInsurance?.publicAssistanceNumber ?? "",
      publicAssistanceRecipient:
        previousInsurance?.publicAssistanceRecipient ?? "",
    }),
    [
      previousInsurance?.insuranceNumber,
      previousInsurance?.insuranceInsurerNumber,
      previousInsurance?.insuranceCertificateSymbol,
      previousInsurance?.insuranceCertificateNumber,
      previousInsurance?.insuranceExpiryDate,
      previousInsurance?.insuranceEffectiveFrom,
      previousInsurance?.insuranceCopaymentRate,
      previousInsurance?.publicAssistanceNumber,
      previousInsurance?.publicAssistanceRecipient,
    ],
  );

  const [formData, setFormData] = useState<ChartFormData>({
    insuranceType: initialData?.insuranceType || "",
    status: initialData?.status || ACTIVE_CHART_STATUS,
    insuranceNumber:
      initialData?.insuranceNumber ?? insuranceFallback.insuranceNumber,
    insuranceInsurerNumber:
      initialData?.insuranceInsurerNumber ??
      insuranceFallback.insuranceInsurerNumber,
    insuranceCertificateSymbol:
      initialData?.insuranceCertificateSymbol ??
      insuranceFallback.insuranceCertificateSymbol,
    insuranceCertificateNumber:
      initialData?.insuranceCertificateNumber ??
      insuranceFallback.insuranceCertificateNumber,
    insuranceExpiryDate:
      initialData?.insuranceExpiryDate ?? insuranceFallback.insuranceExpiryDate,
    insuranceEffectiveFrom:
      initialData?.insuranceEffectiveFrom ??
      insuranceFallback.insuranceEffectiveFrom,
    insuranceCopaymentRate:
      initialData?.insuranceCopaymentRate ??
      insuranceFallback.insuranceCopaymentRate,
    publicAssistanceNumber:
      initialData?.publicAssistanceNumber ??
      insuranceFallback.publicAssistanceNumber,
    publicAssistanceRecipient:
      initialData?.publicAssistanceRecipient ??
      insuranceFallback.publicAssistanceRecipient,
  });

  const { notifyActivity, markDirty, markCommit, markReopen } =
    useDraftTracking({
      entityType: "chart",
      entityId: initialData?.id ?? null,
      actorId: user?.id ?? null,
      enabled: !!user?.id && !!initialData?.id,
    });

  useEffect(() => {
    if (!initialData?.id || !user?.id || !isEdit) return;
    void markReopen();
  }, [initialData?.id, isEdit, markReopen, user?.id]);

  useEffect(() => {
    onConfirmStateChange?.(confirmOpen);
  }, [confirmOpen, onConfirmStateChange]);

  useEffect(() => {
    if (isEdit) {
      if (injuryNames.length > 0) setInjuryNames([]);
      if (injuryInputs.length > 0) setInjuryInputs([]);
      if (injuryMasterIds.length > 0) setInjuryMasterIds([]);
      if (injuryRefreshTokens.length > 0) setInjuryRefreshTokens([]);
      if (medicalQueries.length > 0) setMedicalQueries([]);
      if (medicalConfirmed.length > 0) setMedicalConfirmed([]);
      return;
    }
    if (injuryNames.length === 0) {
      setInjuryNames([""]);
    }
    if (injuryInputs.length === 0) {
      setInjuryInputs([""]);
    }
    if (injuryMasterIds.length === 0) {
      setInjuryMasterIds([null]);
    }
    if (injuryRefreshTokens.length === 0) {
      setInjuryRefreshTokens([0]);
    }
    if (medicalQueries.length === 0) {
      setMedicalQueries([""]);
    }
    if (medicalConfirmed.length === 0) {
      setMedicalConfirmed([""]);
    }
  }, [
    injuryMasterIds.length,
    injuryNames.length,
    injuryInputs.length,
    injuryRefreshTokens.length,
    medicalQueries.length,
    medicalConfirmed.length,
    isEdit,
  ]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    notifyActivity();
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === "insuranceType") {
      setFieldErrors((prev) => ({ ...prev, insuranceType: "" }));
    }
  };

  const updateSharedInjury = (key: keyof SharedInjuryInput, value: string) => {
    notifyActivity();
    setSharedInjury((prev) => ({ ...prev, [key]: value }));
    if (key === "firstVisitDate" || key === "injuryDate") {
      setFieldErrors((prev) => ({
        ...prev,
        shared: {
          ...prev.shared,
          [key]: "",
        },
      }));
    }
  };

  const updateInjuryName = (index: number, value: string) => {
    notifyActivity();
    setInjuryInputs((prev) =>
      prev.map((input, i) => (i === index ? value : input)),
    );
    setInjuryNames((prev) => prev.map((name, i) => (i === index ? "" : name)));
    setInjuryMasterIds((prev) =>
      prev.map((id, i) => (i === index ? null : id)),
    );
    setFieldErrors((prev) => {
      if (!prev.injuryNames) return prev;
      const next = [...prev.injuryNames];
      next[index] = "";
      return { ...prev, injuryNames: next };
    });
  };

  const updateMedicalQuery = (index: number, value: string) => {
    notifyActivity();
    setMedicalQueries((prev) =>
      prev.map((query, i) => (i === index ? value : query)),
    );
    setMedicalConfirmed((prev) =>
      prev.map((confirmed, i) => (i === index ? "" : confirmed)),
    );
  };

  const addInjuryName = () => {
    notifyActivity();
    setInjuryNames((prev) => [...prev, ""]);
    setInjuryInputs((prev) => [...prev, ""]);
    setInjuryMasterIds((prev) => [...prev, null]);
    setInjuryRefreshTokens((prev) => [...prev, 0]);
    setMedicalQueries((prev) => [...prev, ""]);
    setMedicalConfirmed((prev) => [...prev, ""]);
    setFieldErrors((prev) => ({
      ...prev,
      injuryNames: prev.injuryNames ? [...prev.injuryNames, ""] : [],
    }));
  };

  const removeInjuryName = (index: number) => {
    notifyActivity();
    setInjuryNames((prev) => prev.filter((_, i) => i !== index));
    setInjuryInputs((prev) => prev.filter((_, i) => i !== index));
    setInjuryMasterIds((prev) => prev.filter((_, i) => i !== index));
    setInjuryRefreshTokens((prev) => prev.filter((_, i) => i !== index));
    setMedicalQueries((prev) => prev.filter((_, i) => i !== index));
    setMedicalConfirmed((prev) => prev.filter((_, i) => i !== index));
    setFieldErrors((prev) => {
      if (!prev.injuryNames) return prev;
      return {
        ...prev,
        injuryNames: prev.injuryNames.filter((_, i) => i !== index),
      };
    });
  };

  const focusInsuranceSelect = () => {
    const button = insuranceSelectRef.current?.querySelector("button");
    button?.focus();
  };

  const normalizeName = (name: string) =>
    name.replace(/\s+/g, "").replace(/[右左]/g, "");
  const formatDateWithWeekday = (value?: string) => {
    if (!value) return "—";
    const parts = value.split("-");
    let date: Date;
    if (parts.length === 3) {
      const [y, m, d] = parts.map((v) => Number(v));
      date = new Date(y, (m || 1) - 1, d || 1);
    } else {
      date = new Date(value);
    }
    if (Number.isNaN(date.getTime())) return value;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    const day = weekdays[date.getDay()];
    return `${yyyy}/${mm}/${dd}（${day}）`;
  };
  const normalizedInjuryNames = () => injuryNames.map((name) => name.trim());
  const filteredInjuryNames = () =>
    normalizedInjuryNames().filter((name) => name.length > 0);
  const filteredMedicalNames = () =>
    medicalConfirmed
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
  const applyPreviousInsurance = () => {
    notifyActivity();
    setFormData((prev) => ({
      ...prev,
      insuranceNumber: insuranceFallback.insuranceNumber,
      insuranceInsurerNumber: insuranceFallback.insuranceInsurerNumber,
      insuranceCertificateSymbol: insuranceFallback.insuranceCertificateSymbol,
      insuranceCertificateNumber: insuranceFallback.insuranceCertificateNumber,
      insuranceExpiryDate: insuranceFallback.insuranceExpiryDate,
      insuranceEffectiveFrom: insuranceFallback.insuranceEffectiveFrom,
      insuranceCopaymentRate: insuranceFallback.insuranceCopaymentRate,
      publicAssistanceNumber: insuranceFallback.publicAssistanceNumber,
      publicAssistanceRecipient: insuranceFallback.publicAssistanceRecipient,
    }));
  };

  // 前回の保険証情報に実際の値があるかチェック
  const hasPreviousInsuranceData = useMemo(() => {
    if (!previousInsurance) return false;
    return !!(
      insuranceFallback.insuranceNumber ||
      insuranceFallback.insuranceInsurerNumber ||
      insuranceFallback.insuranceCertificateSymbol ||
      insuranceFallback.insuranceCertificateNumber ||
      insuranceFallback.insuranceExpiryDate ||
      insuranceFallback.insuranceEffectiveFrom ||
      insuranceFallback.insuranceCopaymentRate ||
      insuranceFallback.publicAssistanceNumber ||
      insuranceFallback.publicAssistanceRecipient
    );
  }, [previousInsurance, insuranceFallback]);

  const submitForm = async (filteredNames: string[]) => {
    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});
    markDirty();

    try {
      const url = isEdit ? `/api/charts/${initialData?.id}` : "/api/charts";
      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          ...(isEdit
            ? {}
            : {
                sharedInjury: {
                  injuryDate: sharedInjury.injuryDate.trim(),
                  firstVisitDate: sharedInjury.firstVisitDate.trim(),
                  memo: sharedInjury.memo.trim() || null,
                },
                injuryNames: filteredNames,
                injuryMasterIds,
                medicalInjuryNames: medicalConfirmed.map((name) => name.trim()),
              }),
          insuranceType: formData.insuranceType || null,
          status: formData.status,
          insuranceNumber: formData.insuranceNumber || null,
          insuranceInsurerNumber: formData.insuranceInsurerNumber || null,
          insuranceCertificateSymbol:
            formData.insuranceCertificateSymbol || null,
          insuranceCertificateNumber:
            formData.insuranceCertificateNumber || null,
          insuranceExpiryDate: formData.insuranceExpiryDate || null,
          insuranceEffectiveFrom: formData.insuranceEffectiveFrom || null,
          insuranceCopaymentRate: formData.insuranceCopaymentRate || null,
          publicAssistanceNumber: formData.publicAssistanceNumber || null,
          publicAssistanceRecipient: formData.publicAssistanceRecipient || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "カルテの保存に失敗しました");
      }

      const chart = await response.json();
      await markCommit();
      onCreated?.(chart);
      if (redirectOnSuccess) {
        router.push(`/patients/${patientId}/charts/${chart.id}`);
        router.refresh();
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "エラーが発生しました";
      const lateralityMatch = message.match(
        /左右（右\/左）を入力してください:\s*(.+)$/,
      );
      if (lateralityMatch) {
        const target = normalizeName(lateralityMatch[1]);
        const candidateNames = normalizedInjuryNames();
        const index = candidateNames.findIndex((name) =>
          normalizeName(name).includes(target),
        );
        if (index >= 0) {
          setFieldErrors((prev) => ({
            ...prev,
            injuryNames: candidateNames.map((_, i) =>
              i === index ? message : "",
            ),
          }));
          injuryInputRefs.current[index]?.focus();
          return;
        }
      }
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedNames = normalizedInjuryNames();
    const filteredNames = filteredInjuryNames();
    if (!isEdit) {
      const missing: string[] = [];
      if (!sharedInjury.firstVisitDate.trim()) missing.push("初検日");
      if (!sharedInjury.injuryDate.trim()) missing.push("負傷日");
      if (missing.length > 0) {
        setFieldErrors((prev) => ({
          ...prev,
          shared: {
            firstVisitDate: !sharedInjury.firstVisitDate.trim()
              ? "初検日は必須です"
              : "",
            injuryDate: !sharedInjury.injuryDate.trim()
              ? "負傷日は必須です"
              : "",
          },
        }));
        if (!sharedInjury.firstVisitDate.trim()) {
          firstVisitDateRef.current?.focus();
        } else if (!sharedInjury.injuryDate.trim()) {
          injuryDateRef.current?.focus();
        }
        return;
      }
      if (filteredNames.length === 0) {
        const nextErrors = injuryNames.map((_, index) => {
          const pending = (injuryInputs[index] ?? "").trim();
          return pending
            ? "候補から選択して確定してください"
            : "傷病名を入力してください";
        });
        setFieldErrors((prev) => ({
          ...prev,
          injuryNames: nextErrors,
        }));
        const index = nextErrors.findIndex((message) => message.length > 0);
        if (index >= 0) injuryInputRefs.current[index]?.focus();
        return;
      }
      if (normalizedNames.some((name) => name.length === 0)) {
        const nextErrors = normalizedNames.map((name, index) => {
          if (name.length > 0) return "";
          const pending = (injuryInputs[index] ?? "").trim();
          return pending
            ? "候補から選択して確定してください"
            : "空の傷病名があります。削除または入力してください";
        });
        setFieldErrors((prev) => ({
          ...prev,
          injuryNames: nextErrors,
        }));
        const index = nextErrors.findIndex((message) => message.length > 0);
        if (index >= 0) injuryInputRefs.current[index]?.focus();
        return;
      }
      const validationResult = validateInjury({
        injuryDate: new Date(sharedInjury.injuryDate),
        firstVisitDate: new Date(sharedInjury.firstVisitDate),
      });
      if (!validationResult.isValid) {
        setFieldErrors((prev) => ({
          ...prev,
          shared: {
            firstVisitDate: validationResult.errors.join("、"),
          },
        }));
        firstVisitDateRef.current?.focus();
        return;
      }
    }
    if (!formData.insuranceType) {
      setFieldErrors((prev) => ({
        ...prev,
        insuranceType: "保険種別を選択してください",
      }));
      focusInsuranceSelect();
      return;
    }
    if (!isEdit && !confirmOpen) {
      setConfirmOpen(true);
      return;
    }
    await submitForm(filteredNames);
  };

  const previewInjuryNames = filteredInjuryNames();
  const previewMedicalNames = filteredMedicalNames();

  return (
    <form
      id="chart-form"
      onSubmit={handleSubmit}
      className="space-y-5 overflow-visible"
    >
      {/* フィールド単位でエラー表示するため、全体エラーは出さない */}

      {!isEdit && confirmOpen ? (
        <div className="space-y-4">
          <div className="text-sm font-semibold text-slate-700">内容確認</div>
          <div className="mt-4 space-y-5 text-base text-slate-800">
            <div className="grid gap-y-3 gap-x-6 sm:grid-cols-[140px,1fr]">
              <div className="text-slate-500">初検日</div>
              <div>{formatDateWithWeekday(sharedInjury.firstVisitDate)}</div>

              <div className="text-slate-500">負傷日</div>
              <div>{formatDateWithWeekday(sharedInjury.injuryDate)}</div>

              <div className="text-slate-500">傷病名</div>
              <div>
                {previewInjuryNames.length > 0
                  ? previewInjuryNames.join("、")
                  : "—"}
              </div>

              <div className="text-slate-500">病名自由記述</div>
              <div>
                {previewMedicalNames.length > 0
                  ? previewMedicalNames.join("、")
                  : "—"}
              </div>

              <div className="text-slate-500">メモ</div>
              <div className="whitespace-pre-wrap">
                {sharedInjury.memo?.trim() || "—"}
              </div>

              <div className="text-slate-500">保険種別</div>
              <div>{formData.insuranceType || "—"}</div>
            </div>
            {confirmOptionsSlot ? (
              <div className="pt-1">{confirmOptionsSlot}</div>
            ) : null}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 text-sm text-slate-700 hover:text-slate-900"
              >
                戻る
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-[#3f3f3f] rounded-md hover:bg-[#494949] active:bg-[#323232]"
              >
                確定
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!isEdit && !confirmOpen && (
        <div className="space-y-4">
          <div>
            <div className="text-sm font-semibold text-slate-700">
              カルテ概要
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="sharedFirstVisitDate"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                初検日<span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="sharedFirstVisitDate"
                ref={firstVisitDateRef}
                value={sharedInjury.firstVisitDate}
                onChange={(e) =>
                  updateSharedInjury("firstVisitDate", e.target.value)
                }
                min={sharedInjury.injuryDate || undefined}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
              {fieldErrors.shared?.firstVisitDate && (
                <div className="mt-1 text-xs text-red-600">
                  {fieldErrors.shared.firstVisitDate}
                </div>
              )}
            </div>
            <div>
              <label
                htmlFor="sharedInjuryDate"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                負傷日<span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="sharedInjuryDate"
                ref={injuryDateRef}
                value={sharedInjury.injuryDate}
                onChange={(e) =>
                  updateSharedInjury("injuryDate", e.target.value)
                }
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
              {fieldErrors.shared?.injuryDate && (
                <div className="mt-1 text-xs text-red-600">
                  {fieldErrors.shared.injuryDate}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                傷病名（入力確定で複数追加可能）
                <span className="text-red-500">*</span>
              </label>
            </div>
            <div className="space-y-1">
              {injuryNames.map((name, index) => (
                <div
                  key={`injury-name-${index}`}
                  className="flex gap-2 items-center group"
                >
                  <div className="flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-slate-600">
                          柔整療養費傷病
                        </div>
                        <JudoInjuryNameInput
                          value={injuryInputs[index] || ""}
                          ref={(el) => {
                            injuryInputRefs.current[index] = el;
                          }}
                          onChange={(value) => updateInjuryName(index, value)}
                          onSelectSuggestion={({ id, label }) => {
                            setInjuryNames((prev) =>
                              prev.map((prevName, i) =>
                                i === index ? label : prevName,
                              ),
                            );
                            setInjuryMasterIds((prev) =>
                              prev.map((prevId, i) =>
                                i === index ? id : prevId,
                              ),
                            );
                            setInjuryInputs((prev) =>
                              prev.map((input, i) =>
                                i === index ? "" : input,
                              ),
                            );
                          }}
                          refreshToken={injuryRefreshTokens[index] ?? 0}
                          isConfirmed={!!injuryNames[index]}
                          statusSlot={
                            injuryNames.length > 1 ? (
                              <div className="flex min-w-[56px] items-center justify-end gap-2 text-xs leading-none text-slate-600">
                                <span
                                  role="tab"
                                  tabIndex={0}
                                  onClick={() => removeInjuryName(index)}
                                  onKeyDown={(event) => {
                                    if (
                                      event.key === "Enter" ||
                                      event.key === " "
                                    ) {
                                      event.preventDefault();
                                      removeInjuryName(index);
                                    }
                                  }}
                                  className="cursor-pointer text-red-600 font-medium focus:outline-none"
                                >
                                  削除
                                </span>
                              </div>
                            ) : null
                          }
                          required={false}
                          placeholder="柔整療養費傷病（例: 右手関節捻挫）"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-slate-600">
                          病名自由記述（療養費算定では表現できない傷病名を記載）
                        </div>
                        <input
                          type="text"
                          value={medicalQueries[index] || ""}
                          onChange={(e) =>
                            updateMedicalQuery(index, e.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              const trimmedValue = (
                                medicalQueries[index] || ""
                              ).trim();
                              if (!trimmedValue) return;
                              setMedicalConfirmed((prev) =>
                                prev.map((confirmed, i) =>
                                  i === index ? trimmedValue : confirmed,
                                ),
                              );
                              setMedicalQueries((prev) =>
                                prev.map((query, i) =>
                                  i === index ? "" : query,
                                ),
                              );
                            }
                          }}
                          placeholder="病名自由記述（任意）"
                          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                        />
                        <div className="h-0" />
                      </div>
                    </div>
                    <div className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        {injuryNames[index] ? (
                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-transparent px-3.5 py-1 text-sm font-normal text-slate-900 tracking-wide">
                              {injuryNames[index]}
                              <button
                                type="button"
                                onClick={() => {
                                  setInjuryMasterIds((prev) =>
                                    prev.map((id, i) =>
                                      i === index ? null : id,
                                    ),
                                  );
                                  setInjuryNames((prev) =>
                                    prev.map((nameValue, i) =>
                                      i === index ? "" : nameValue,
                                    ),
                                  );
                                  setInjuryRefreshTokens((prev) =>
                                    prev.map((token, i) =>
                                      i === index ? token + 1 : token,
                                    ),
                                  );
                                  injuryInputRefs.current[index]?.focus();
                                }}
                                className="text-slate-700 hover:text-slate-900 focus:outline-none"
                                aria-label="削除"
                                title="削除"
                              >
                                ×
                              </button>
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <div>
                        {medicalConfirmed[index]?.trim() ? (
                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-transparent px-3.5 py-1 text-sm font-normal text-slate-900 tracking-wide">
                              {medicalConfirmed[index].trim()}
                              <button
                                type="button"
                                onClick={() =>
                                  setMedicalConfirmed((prev) =>
                                    prev.map((confirmed, i) =>
                                      i === index ? "" : confirmed,
                                    ),
                                  )
                                }
                                className="text-slate-700 hover:text-slate-900 focus:outline-none"
                                aria-label="削除"
                                title="削除"
                              >
                                ×
                              </button>
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {fieldErrors.injuryNames?.[index] && (
                      <div className="mt-1 text-xs text-red-600">
                        {fieldErrors.injuryNames[index]}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="sharedInjuryCauseText"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              メモ
            </label>
            <textarea
              id="sharedInjuryCauseText"
              rows={1}
              value={sharedInjury.memo}
              onChange={(e) => updateSharedInjury("memo", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="例: メモがあればここに記入"
            />
          </div>

          <div className="overflow-visible">
            <label
              htmlFor="insuranceType"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              保険種別<span className="text-red-500">*</span>
            </label>
            <Select
              id="insuranceType"
              name="insuranceType"
              value={formData.insuranceType || ""}
              onChange={(value) => {
                const event = {
                  target: { name: "insuranceType", value },
                } as React.ChangeEvent<HTMLSelectElement>;
                handleChange(event);
              }}
              options={INSURANCE_TYPE_OPTIONS.map((opt) => ({
                value: opt.value,
                label: opt.label,
              }))}
              placeholder="選択してください"
              error={!!fieldErrors.insuranceType}
              ref={insuranceSelectRef}
            />
            {fieldErrors.insuranceType && (
              <div className="mt-1 text-xs text-red-600">
                {fieldErrors.insuranceType}
              </div>
            )}
          </div>
        </div>
      )}

      {isEdit && (
        <div className="overflow-visible">
          <label
            htmlFor="insuranceType"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            保険種別
          </label>
          <Select
            id="insuranceType"
            name="insuranceType"
            value={formData.insuranceType || ""}
            onChange={(value) => {
              const event = {
                target: { name: "insuranceType", value },
              } as React.ChangeEvent<HTMLSelectElement>;
              handleChange(event);
            }}
            options={INSURANCE_TYPE_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
            }))}
            placeholder="選択してください"
            error={!!fieldErrors.insuranceType}
            ref={insuranceSelectRef}
          />
          {fieldErrors.insuranceType && (
            <div className="mt-1 text-xs text-red-600">
              {fieldErrors.insuranceType}
            </div>
          )}
        </div>
      )}

      {!confirmOpen && (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setIsInsuranceExpanded(!isInsuranceExpanded)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
          >
            <div className="flex items-center gap-2">
              {isInsuranceExpanded ? (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400" />
              )}
              <span className="text-sm font-medium text-slate-700">
                保険証情報
              </span>
            </div>
            {hasPreviousInsuranceData && !isInsuranceExpanded && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  applyPreviousInsurance();
                  setIsInsuranceExpanded(true);
                }}
                className="text-xs px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 shrink-0"
              >
                前回から反映
              </button>
            )}
          </button>

          {isInsuranceExpanded && (
            <div className="px-4 pb-4 space-y-4 border-t border-slate-200 bg-white">
              {hasPreviousInsuranceData && (
                <div className="flex justify-end pt-3">
                  <button
                    type="button"
                    onClick={applyPreviousInsurance}
                    className="text-xs px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50"
                  >
                    前回から反映
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="insuranceNumber"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    保険証番号
                  </label>
                  <input
                    id="insuranceNumber"
                    name="insuranceNumber"
                    value={formData.insuranceNumber}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    placeholder="保険証番号を入力"
                  />
                </div>
                <div>
                  <label
                    htmlFor="insuranceInsurerNumber"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    保険者番号
                  </label>
                  <input
                    id="insuranceInsurerNumber"
                    name="insuranceInsurerNumber"
                    value={formData.insuranceInsurerNumber}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    placeholder="例: 12345678"
                  />
                </div>
                <div>
                  <label
                    htmlFor="insuranceCertificateSymbol"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    記号
                  </label>
                  <input
                    id="insuranceCertificateSymbol"
                    name="insuranceCertificateSymbol"
                    value={formData.insuranceCertificateSymbol}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="insuranceCertificateNumber"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    番号
                  </label>
                  <input
                    id="insuranceCertificateNumber"
                    name="insuranceCertificateNumber"
                    value={formData.insuranceCertificateNumber}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="insuranceEffectiveFrom"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    適用開始日
                  </label>
                  <input
                    id="insuranceEffectiveFrom"
                    name="insuranceEffectiveFrom"
                    type="date"
                    value={formData.insuranceEffectiveFrom}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="insuranceExpiryDate"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    有効期限
                  </label>
                  <input
                    id="insuranceExpiryDate"
                    name="insuranceExpiryDate"
                    type="date"
                    value={formData.insuranceExpiryDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="insuranceCopaymentRate"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    負担割合
                  </label>
                  <input
                    id="insuranceCopaymentRate"
                    name="insuranceCopaymentRate"
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formData.insuranceCopaymentRate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    placeholder="3.0 など"
                  />
                </div>
                <div>
                  <label
                    htmlFor="publicAssistanceNumber"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    公費負担者番号
                  </label>
                  <input
                    id="publicAssistanceNumber"
                    name="publicAssistanceNumber"
                    value={formData.publicAssistanceNumber}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="publicAssistanceRecipient"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    公費受給者番号
                  </label>
                  <input
                    id="publicAssistanceRecipient"
                    name="publicAssistanceRecipient"
                    value={formData.publicAssistanceRecipient}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {isEdit && (
        <div className="overflow-visible">
          <label
            htmlFor="status"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            ステータス
          </label>
          <Select
            id="status"
            name="status"
            value={formData.status}
            onChange={(value) => {
              const event = {
                target: { name: "status", value },
              } as React.ChangeEvent<HTMLSelectElement>;
              handleChange(event);
            }}
            options={getChartStatusOptions().map((opt) => ({
              value: opt.value,
              label: opt.label,
            }))}
          />
        </div>
      )}
    </form>
  );
}
