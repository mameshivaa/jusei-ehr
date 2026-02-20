"use client";

import { ChartStatus } from "@prisma/client";
import {
  getChartStatusLabel,
  getChartStatusOptions as getChartStatusOptionsInternal,
  normalizeChartStatus,
} from "@/lib/charts/status";

const NEUTRAL_BADGE = "text-slate-800";

const STATUS_STYLES: Record<string, string> = {
  IN_TREATMENT: NEUTRAL_BADGE,
  HEALED: NEUTRAL_BADGE,
  DISCONTINUED: NEUTRAL_BADGE,
  TRANSFERRED: NEUTRAL_BADGE,
};

type ChartStatusBadgeProps = {
  status: ChartStatus | string;
  size?: "sm" | "md";
};

export function ChartStatusBadge({
  status,
  size = "sm",
}: ChartStatusBadgeProps) {
  const normalized = normalizeChartStatus(status);
  const className = STATUS_STYLES[normalized];

  const sizeClasses = size === "sm" ? "text-xs" : "text-base";

  return (
    <span
      className={`inline-flex items-center font-medium whitespace-nowrap ${className} ${sizeClasses}`}
    >
      {getChartStatusLabel(normalized)}
    </span>
  );
}

export function getChartStatusOptions(): Array<{
  value: ChartStatus;
  label: string;
}> {
  return getChartStatusOptionsInternal();
}

export { getChartStatusLabel };
