"use client";

import React from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  compact?: boolean;
};

export default function PageHeader({
  title,
  subtitle,
  right,
  compact = false,
}: PageHeaderProps) {
  const containerClass = compact
    ? "flex items-center justify-between mb-2"
    : "flex items-center justify-between mb-4";
  const titleClass = compact
    ? "text-2xl font-semibold tracking-tight text-slate-900"
    : "text-3xl font-semibold tracking-tight text-slate-900";
  const subtitleClass = compact
    ? "mt-0.5 text-xs text-slate-600"
    : "mt-1 text-sm text-slate-600";

  return (
    <div className={containerClass}>
      <div>
        <h1 className={titleClass}>{title}</h1>
        {subtitle && <p className={subtitleClass}>{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  );
}
