"use client";

import { useState, useEffect } from "react";

type Procedure = {
  id: string;
  code: string;
  name: string;
  defaultPrice: number | null;
};

type Props = {
  value: string;
  onChange: (procedureId: string) => void;
  disabled?: boolean;
};

export function ProcedureSelect({ value, onChange, disabled = false }: Props) {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProcedures = async () => {
      try {
        const response = await fetch("/api/procedures");
        if (response.ok) {
          const data = await response.json();
          setProcedures(data);
        }
      } catch (error) {
        console.error("Failed to fetch procedures:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProcedures();
  }, []);

  if (loading) {
    return (
      <select
        disabled
        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md bg-slate-100 text-slate-500"
      >
        <option>読み込み中...</option>
      </select>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
    >
      <option value="">選択してください</option>
      {procedures.map((procedure) => (
        <option key={procedure.id} value={procedure.id}>
          {procedure.name}
          {procedure.defaultPrice
            ? ` (¥${procedure.defaultPrice.toLocaleString()})`
            : ""}
        </option>
      ))}
    </select>
  );
}
