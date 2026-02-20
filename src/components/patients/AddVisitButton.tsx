"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

type AddVisitButtonProps = {
  patientId: string;
  chartId?: string;
};

export function AddVisitButton({ patientId, chartId }: AddVisitButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, chartId }),
      });
      if (response.ok) {
        window.location.reload();
      } else {
        alert("来院記録の追加に失敗しました");
      }
    } catch (error) {
      alert("来院記録の追加に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50"
    >
      <Plus className="h-4 w-4" />
      {loading ? "追加中..." : "来院を追加"}
    </button>
  );
}
