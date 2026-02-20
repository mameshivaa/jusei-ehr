"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type HeaderTodayProps = {
  dateStr?: string;
  onPrev?: () => void;
  onNext?: () => void;
  onToday?: () => void;
  disablePrev?: boolean;
  disableNext?: boolean;
  disableToday?: boolean;
};

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function toDateKey(d: Date) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function parseDateKey(value?: string) {
  if (!value || !DATE_KEY_RE.test(value)) return null;
  const dt = new Date(`${value}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function HeaderToday({
  dateStr,
  onPrev,
  onNext,
  onToday,
  disablePrev = false,
  disableNext = false,
  disableToday = false,
}: HeaderTodayProps) {
  const fallback = new Date();
  const dt = parseDateKey(dateStr) ?? fallback;
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  const wd = ["日", "月", "火", "水", "木", "金", "土"][dt.getDay()];

  const showNav = Boolean(onPrev || onNext || onToday);
  const todayKey = toDateKey(new Date());
  const dateKey =
    dateStr && DATE_KEY_RE.test(dateStr) ? dateStr : toDateKey(dt);
  const isToday = dateKey === todayKey;

  return (
    <div className={showNav ? "flex items-center gap-2" : undefined}>
      {onPrev ? (
        <button
          type="button"
          onClick={onPrev}
          disabled={disablePrev}
          className="h-8 w-9 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:text-slate-400 disabled:bg-slate-50 disabled:cursor-not-allowed"
          aria-label="前日"
          title="前日"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
      <div className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900 whitespace-nowrap">
        {yy}/{mm}/{dd} <span className="text-slate-900">（{wd}）</span>
      </div>
      {onToday ? (
        <button
          type="button"
          onClick={onToday}
          disabled={disableToday || isToday}
          className="h-8 px-2.5 rounded-md border border-slate-200 text-sm text-slate-700 hover:bg-slate-100 disabled:text-slate-400 disabled:bg-slate-50 disabled:cursor-not-allowed"
          aria-label="本日"
        >
          本日
        </button>
      ) : null}
      {onNext ? (
        <button
          type="button"
          onClick={onNext}
          disabled={disableNext}
          className="h-8 w-9 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:text-slate-400 disabled:bg-slate-50 disabled:cursor-not-allowed"
          aria-label="翌日"
          title="翌日"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
