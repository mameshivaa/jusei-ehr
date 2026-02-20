"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { ListHeader } from "@/components/ui/ListPanel";

export type ListGridColumn = {
  id: string;
  label: ReactNode;
  className?: string;
};

type ListGridHeaderProps = {
  columns: ListGridColumn[];
  gridClassName: string;
  className?: string;
  sticky?: boolean;
};

export function ListGridHeader({
  columns,
  gridClassName,
  className,
  sticky = true,
}: ListGridHeaderProps) {
  return (
    <ListHeader
      className={cn(
        "grid gap-y-2 md:gap-y-3 xl:gap-y-4 px-[var(--space-3)] lg:px-[var(--space-4)] py-[var(--space-2)] md:py-[var(--space-3)] text-slate-700",
        gridClassName,
        className,
      )}
      sticky={sticky}
    >
      {columns.map((col) => (
        <div key={col.id} className={col.className}>
          {typeof col.label === "string" ? col.label : col.label}
        </div>
      ))}
    </ListHeader>
  );
}

export type ListGridRowProps = {
  columns: ListGridColumn[];
  cells: ReactNode[];
  gridClassName: string;
  className?: string;
};

export function ListGridRow({
  columns,
  cells,
  gridClassName,
  className,
}: ListGridRowProps) {
  return (
    <div
      className={cn(
        "grid items-center gap-y-2 md:gap-y-3 xl:gap-y-4 text-base px-[var(--space-3)] lg:px-[var(--space-4)] py-[var(--space-2)] md:py-[var(--space-3)]",
        gridClassName,
        className,
      )}
    >
      {columns.map((col, idx) => (
        <div key={col.id} className={col.className}>
          {cells[idx]}
        </div>
      ))}
    </div>
  );
}
