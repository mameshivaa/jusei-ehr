"use client";

import React, { useEffect, useMemo, useState } from "react";

type Suggestion = {
  id: string;
  label: string;
  categoryLabel: string;
  partLabel: string;
  lateralityRule: "NONE" | "REQUIRED";
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelectSuggestion?: (payload: { id: string; label: string }) => void;
  refreshToken?: number;
  isConfirmed?: boolean;
  statusSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
  panelOpen?: boolean;
  panelSlot?: React.ReactNode;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
};

const MIN_QUERY_LENGTH = 2;

export const JudoInjuryNameInput = React.forwardRef<HTMLInputElement, Props>(
  (
    {
      value,
      onChange,
      placeholder,
      required = false,
      disabled = false,
      onSelectSuggestion,
      refreshToken,
      isConfirmed = false,
      statusSlot,
      footerSlot,
      panelOpen = false,
      panelSlot,
    },
    ref,
  ) => {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [show, setShow] = useState(false);
    const trimmed = useMemo(() => value.trim(), [value]);

    useEffect(() => {
      if (isConfirmed) {
        setShow(false);
        return;
      }
      if (trimmed.length < MIN_QUERY_LENGTH) {
        setSuggestions([]);
        setShow(false);
        return;
      }
      let active = true;
      const timer = setTimeout(async () => {
        try {
          setLoading(true);
          const params = new URLSearchParams({ q: trimmed });
          const res = await fetch(
            `/api/judo-injury-masters/suggestions?${params.toString()}`,
          );
          if (!res.ok) {
            throw new Error("候補の取得に失敗しました");
          }
          const data = (await res.json()) as { suggestions: Suggestion[] };
          if (!active) return;
          setSuggestions(data.suggestions);
          setShow(true);
        } catch {
          if (!active) return;
          setSuggestions([]);
          setShow(false);
        } finally {
          if (active) setLoading(false);
        }
      }, 200);

      return () => {
        active = false;
        clearTimeout(timer);
      };
    }, [trimmed, refreshToken, isConfirmed]);

    useEffect(() => {
      if (refreshToken === undefined) return;
      setShow(true);
    }, [refreshToken]);

    const applySuggestion = (suggestion: Suggestion) => {
      onChange(suggestion.label);
      onSelectSuggestion?.({ id: suggestion.id, label: suggestion.label });
      setShow(false);
    };

    const inputClassName = `w-full px-3 py-2 text-sm focus:outline-none ${
      statusSlot ? "pr-32" : ""
    } ${footerSlot ? "border-0 rounded-none" : "border border-slate-300 rounded-md"} focus:ring-2 focus:ring-slate-500`;

    return (
      <div className="relative">
        {footerSlot ? (
          <div className="rounded-md border border-slate-300 focus-within:ring-2 focus-within:ring-slate-500">
            <div className="relative">
              <input
                ref={ref}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={inputClassName}
                placeholder={placeholder}
                required={required}
                disabled={disabled}
                onFocus={() => {
                  if (!isConfirmed && suggestions.length > 0) setShow(true);
                }}
                onKeyDown={(e) => {
                  if (
                    (e.key === "Tab" ||
                      e.key === "ArrowRight" ||
                      e.key === "Enter") &&
                    suggestions.length > 0 &&
                    !isConfirmed
                  ) {
                    const first = suggestions[0];
                    if (first) {
                      e.preventDefault();
                      applySuggestion(first);
                    }
                  }
                }}
              />
              {statusSlot && (
                <div className="absolute right-3 inset-y-0 flex items-center">
                  {statusSlot}
                </div>
              )}
              {trimmed.length >= MIN_QUERY_LENGTH &&
                show &&
                suggestions.length > 0 &&
                !isConfirmed && (
                  <div className="absolute left-0 top-full mt-1 w-full rounded-md border border-slate-200 bg-white shadow-sm max-h-48 overflow-auto z-20">
                    {loading && (
                      <div className="px-3 py-2 text-xs text-slate-400">
                        検索中…
                      </div>
                    )}
                    {!loading &&
                      suggestions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => applySuggestion(s)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                        >
                          {s.label}
                        </button>
                      ))}
                  </div>
                )}
            </div>
            <div className="px-3 pb-2">{footerSlot}</div>
          </div>
        ) : (
          <>
            <input
              ref={ref}
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className={inputClassName}
              placeholder={placeholder}
              required={required}
              disabled={disabled}
              onFocus={() => {
                if (!isConfirmed && suggestions.length > 0) setShow(true);
              }}
              onKeyDown={(e) => {
                if (
                  (e.key === "Tab" ||
                    e.key === "ArrowRight" ||
                    e.key === "Enter") &&
                  suggestions.length > 0 &&
                  !isConfirmed
                ) {
                  const first = suggestions[0];
                  if (first) {
                    e.preventDefault();
                    applySuggestion(first);
                  }
                }
              }}
            />
            {statusSlot && (
              <div className="absolute right-3 inset-y-0 flex items-center">
                {statusSlot}
              </div>
            )}
            {trimmed.length >= MIN_QUERY_LENGTH &&
              show &&
              suggestions.length > 0 &&
              !isConfirmed && (
                <div className="absolute left-0 top-full mt-1 w-full rounded-md border border-slate-200 bg-white shadow-sm max-h-48 overflow-auto z-20">
                  {loading && (
                    <div className="px-3 py-2 text-xs text-slate-400">
                      検索中…
                    </div>
                  )}
                  {!loading &&
                    suggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => applySuggestion(s)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        {s.label}
                      </button>
                    ))}
                </div>
              )}
          </>
        )}

        {panelOpen && panelSlot && (
          <div className="absolute left-0 top-full mt-1 w-full z-20">
            {panelSlot}
          </div>
        )}
      </div>
    );
  },
);

JudoInjuryNameInput.displayName = "JudoInjuryNameInput";
