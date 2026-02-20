"use client";

import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { InjuryCard, InjuryCardData } from "./InjuryCard";

type Props = {
  patientId: string;
  initialInjuries?: InjuryCardData[];
  showDeleted?: boolean;
};

export function InjuryList({
  patientId,
  initialInjuries,
  showDeleted = false,
}: Props) {
  const [injuries, setInjuries] = useState<InjuryCardData[]>(
    initialInjuries || [],
  );
  const [loading, setLoading] = useState(!initialInjuries);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialInjuries) return;

    const fetchInjuries = async () => {
      try {
        const params = new URLSearchParams({ patientId });
        if (showDeleted) {
          params.append("includeDeleted", "true");
        }
        const response = await fetch(`/api/injuries?${params}`);
        if (!response.ok) {
          throw new Error("負傷エピソードの取得に失敗しました");
        }
        const data = await response.json();
        setInjuries(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    fetchInjuries();
  }, [patientId, showDeleted, initialInjuries]);

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-pulse text-slate-600">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">負傷エピソード</h2>
      </div>

      {/* リスト */}
      {injuries.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-slate-600">負傷エピソードがありません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {injuries.map((injury) => (
            <InjuryCard key={injury.id} injury={injury} />
          ))}
        </div>
      )}
    </div>
  );
}
