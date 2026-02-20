"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useState } from "react";

export function PatientSearchForm({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams ?? undefined);
    if (query) {
      params.set("q", query);
    } else {
      params.delete("q");
    }
    router.push(`/patients?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="患者名、フリガナ、電話番号、患者IDで検索"
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
        />
      </div>
      <button
        type="submit"
        className="bg-slate-900 text-white px-6 py-2 rounded-md hover:bg-slate-800"
      >
        検索
      </button>
    </form>
  );
}
