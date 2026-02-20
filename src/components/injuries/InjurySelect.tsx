"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { AlertCircle } from "lucide-react";

type InjuryOption = {
  id: string;
  injuryName: string;
  injuryDate: Date | string;
  endDate: Date | string | null;
  isDeleted: boolean;
};

type Props = {
  patientId: string;
  value: string | null;
  onChange: (injuryId: string | null) => void;
  required?: boolean;
  disabled?: boolean;
  showUnlinkedOption?: boolean;
};

export function InjurySelect({
  patientId,
  value,
  onChange,
  required = false,
  disabled = false,
  showUnlinkedOption = false,
}: Props) {
  const [injuries, setInjuries] = useState<InjuryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInjuries = async () => {
      try {
        const response = await fetch(`/api/injuries?patientId=${patientId}`);
        if (!response.ok) {
          throw new Error("負傷エピソードの取得に失敗しました");
        }
        const data = await response.json();

        // isDeleted=false のみ、endDate未設定を優先的に表示
        const filteredInjuries = data
          .filter((i: InjuryOption) => !i.isDeleted)
          .sort((a: InjuryOption, b: InjuryOption) => {
            // endDateがnullのものを先に
            if (!a.endDate && b.endDate) return -1;
            if (a.endDate && !b.endDate) return 1;
            // 負傷日の新しいものを先に
            return (
              new Date(b.injuryDate).getTime() -
              new Date(a.injuryDate).getTime()
            );
          });

        setInjuries(filteredInjuries);
      } catch (err) {
        setError(err instanceof Error ? err.message : "取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    fetchInjuries();
  }, [patientId]);

  if (loading) {
    return (
      <select
        disabled
        className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-100 text-slate-500"
      >
        <option>読み込み中...</option>
      </select>
    );
  }

  if (error) {
    return (
      <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        {error}
      </div>
    );
  }

  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value || null)}
      required={required}
      disabled={disabled}
      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
    >
      {showUnlinkedOption && <option value="">未紐付け</option>}
      {!showUnlinkedOption && !required && (
        <option value="">選択してください</option>
      )}
      {injuries.length === 0 ? (
        <option value="" disabled>
          負傷エピソードがありません
        </option>
      ) : (
        injuries.map((injury) => {
          const injuryDate = new Date(injury.injuryDate);
          const isOngoing = !injury.endDate;

          return (
            <option key={injury.id} value={injury.id}>
              {injury.injuryName} -{" "}
              {format(injuryDate, "yyyy/MM/dd", { locale: ja })}
              {isOngoing ? "〜" : ""}
            </option>
          );
        })
      )}
    </select>
  );
}
