import { ChartStatus } from "@prisma/client";

export const ACTIVE_CHART_STATUS: ChartStatus = "IN_TREATMENT";

const STATUS_LABELS: Record<ChartStatus, string> = {
  IN_TREATMENT: "通院中",
  HEALED: "治癒",
  DISCONTINUED: "中止",
  TRANSFERRED: "転医",
};

const LEGACY_ALIASES: Record<string, ChartStatus> = {
  ACTIVE: "IN_TREATMENT",
  FOLLOW_UP: "IN_TREATMENT",
};

const STATUS_VALUES: ChartStatus[] = [
  "IN_TREATMENT",
  "HEALED",
  "DISCONTINUED",
  "TRANSFERRED",
];

export type ChartStatusLike = ChartStatus | keyof typeof LEGACY_ALIASES;

export function normalizeChartStatus(
  status: ChartStatus | string,
): ChartStatus {
  if (status in LEGACY_ALIASES) {
    return LEGACY_ALIASES[status];
  }

  if (STATUS_VALUES.includes(status as ChartStatus)) {
    return status as ChartStatus;
  }

  return ACTIVE_CHART_STATUS;
}

export function getChartStatusLabel(status: ChartStatus | string): string {
  return STATUS_LABELS[normalizeChartStatus(status)];
}

export function getChartStatusOptions(): Array<{
  value: ChartStatus;
  label: string;
}> {
  return STATUS_VALUES.map((value) => ({
    value,
    label: STATUS_LABELS[value],
  }));
}

export function isActiveChartStatus(status: ChartStatus | string): boolean {
  return normalizeChartStatus(status) === ACTIVE_CHART_STATUS;
}
