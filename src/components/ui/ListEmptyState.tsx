"use client";

import React from "react";
import { cn } from "@/lib/utils/cn";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

type Variant = "empty" | "loading" | "error";

interface ListEmptyStateProps {
  message: string;
  className?: string;
  variant?: Variant;
  action?: React.ReactNode;
}

export default function ListEmptyState({
  message,
  className,
  variant = "empty",
  action,
}: ListEmptyStateProps) {
  const baseClass = "px-4 py-12 text-center text-sm text-slate-500";
  const composed = cn(baseClass, "flex flex-col items-center gap-3", className);
  const messageClass = cn(
    "text-sm text-slate-600",
    variant === "error" ? "text-red-600" : null,
    variant === "loading" ? "text-slate-600" : null,
  );

  return (
    <div className={composed}>
      {variant === "loading" ? (
        <LoadingSpinner size="md" color="gray" label={message} />
      ) : null}
      <p className={messageClass}>{message}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
