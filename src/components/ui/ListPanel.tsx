"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

type ScrollBehavior = "none" | "x" | "y" | "both";

type ListPanelProps = React.HTMLAttributes<HTMLDivElement> & {
  size?: "small" | "medium" | "large" | null;
  scroll?: ScrollBehavior;
  listRootId?: string | number | null;
};

export function ListPanel({
  children,
  className,
  size = "medium",
  scroll = "none",
  listRootId,
  ...props
}: ListPanelProps) {
  const sizeClass = size ? `list-size-${size}` : null;
  const scrollClass: Record<ScrollBehavior, string> = {
    none: "overflow-hidden",
    x: "overflow-x-auto",
    y: "overflow-y-auto",
    both: "overflow-auto",
  };

  return (
    <div
      data-list-root={listRootId ?? undefined}
      className={cn(
        "list-panel rounded-xl border border-slate-200 bg-white shadow-sm",
        sizeClass,
        scrollClass[scroll],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type ListHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
  sticky?: boolean;
};

export function ListHeader({
  children,
  className,
  sticky = true,
  ...props
}: ListHeaderProps) {
  return (
    <div
      className={cn(
        "list-panel-header z-10 border-b border-slate-200 text-sm font-semibold text-slate-800 backdrop-blur",
        sticky ? "sticky top-0" : null,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
