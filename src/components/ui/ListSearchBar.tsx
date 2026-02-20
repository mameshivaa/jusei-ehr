"use client";

import { KeyboardEvent, RefObject } from "react";
import Toolbar from "@/components/ui/Toolbar";
import { Button } from "@/components/ui/button";

type CountItem = {
  label: string;
  value: number;
  unit?: string;
};

type ListSearchBarProps = {
  query: string;
  placeholder?: string;
  loading?: boolean;
  searchLabel?: string;
  counts?: CountItem[];
  right?: React.ReactNode;
  filters?: React.ReactNode;
  inputRef?: RefObject<HTMLInputElement>;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onQuickAction?: () => void;
  className?: string;
};

export function ListSearchBar({
  query,
  placeholder,
  loading = false,
  searchLabel = "検索",
  counts,
  right,
  filters,
  inputRef,
  onQueryChange,
  onSearch,
  onQuickAction,
  className,
}: ListSearchBarProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      onSearch();
    }
    if (e.key === "Enter" && e.shiftKey && onQuickAction) {
      onQuickAction();
    }
  };

  return (
    <Toolbar right={right} className={className}>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={inputRef}
          className="h-9 border border-slate-300 rounded-md px-3 text-sm"
          placeholder={placeholder}
          autoComplete="off"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {filters ? (
          <div className="flex items-center gap-2 flex-wrap">{filters}</div>
        ) : null}
        <Button
          size="list"
          variant="secondary"
          onClick={onSearch}
          disabled={loading}
          className="whitespace-nowrap"
        >
          {loading ? "検索中…" : searchLabel}
        </Button>
        {counts && counts.length > 0 ? (
          <div
            className="ml-2 inline-flex items-center gap-1 text-base text-slate-700 flex-wrap"
            role="status"
            aria-live="polite"
          >
            {counts.map((item, idx) => (
              <span key={item.label} className="flex items-center gap-1">
                {idx > 0 ? (
                  <span className="mx-1 text-slate-400">/</span>
                ) : null}
                <span>{item.label}</span>
                <span className="text-lg font-semibold text-slate-900">
                  {item.value}
                </span>
                {item.unit ? <span>{item.unit}</span> : null}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Toolbar>
  );
}
