"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { validateInjury } from "@/lib/injuries/injury-validation";
import { useSystemMode } from "@/components/providers/SystemModeProvider";
import { JudoInjuryNameInput } from "@/components/injuries/JudoInjuryNameInput";

type Props = {
  patientId: string;
  chartId?: string | null;
};

export function InjuryCreateForm({ patientId, chartId }: Props) {
  const router = useRouter();
  const { isReadOnly } = useSystemMode();
  const [injuryName, setInjuryName] = useState("");
  const [judoInjuryMasterId, setJudoInjuryMasterId] = useState<string | null>(
    null,
  );
  const [medicalInjuryName, setMedicalInjuryName] = useState("");
  const [injuryDate, setInjuryDate] = useState("");
  const [firstVisitDate, setFirstVisitDate] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!injuryName.trim() || !injuryDate || !firstVisitDate) {
      setError("負傷名・負傷日・初検日は必須です");
      return;
    }
    const validation = validateInjury({
      injuryDate: new Date(injuryDate),
      firstVisitDate: new Date(firstVisitDate),
    });
    if (!validation.isValid) {
      setError(validation.errors.join("、"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/injuries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          chartId: chartId || null,
          injuryName: injuryName.trim(),
          judoInjuryMasterId,
          medicalInjuryName: medicalInjuryName.trim() || null,
          injuryDate,
          firstVisitDate,
          memo: memo.trim() || null,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "負傷エピソードの登録に失敗しました");
      }
      const result = await response.json();
      router.push(`/patients/${patientId}/charts/${result.chartId}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "負傷エピソードの登録に失敗しました",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          負傷名 <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <JudoInjuryNameInput
            value={injuryName}
            onChange={(value) => {
              setInjuryName(value);
              setJudoInjuryMasterId(null);
            }}
            onSelectSuggestion={({ id, label }) => {
              setJudoInjuryMasterId(id);
              setInjuryName(label);
            }}
            required
            placeholder="柔整療養費傷病（例: 右手関節捻挫）"
            disabled={isReadOnly}
          />
          <input
            type="text"
            value={medicalInjuryName}
            onChange={(e) => setMedicalInjuryName(e.target.value)}
            placeholder="病名自由記述（任意）"
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            disabled={isReadOnly}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            負傷日 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={injuryDate}
            onChange={(e) => setInjuryDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            初検日 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={firstVisitDate}
            onChange={(e) => setFirstVisitDate(e.target.value)}
            min={injuryDate || undefined}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          メモ
        </label>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
          placeholder="例: 階段を降りる際に足を踏み外した"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm text-slate-700 hover:text-slate-900"
        >
          キャンセル
        </button>
        {!isReadOnly && (
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? "保存中..." : "登録"}
          </button>
        )}
      </div>
    </form>
  );
}
