"use client";

import React from "react";

export default function Toolbar({
  children,
  right,
  className,
}: {
  children?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mb-3 flex items-center justify-between gap-2 ${className || ""}`}
    >
      <div className="flex items-center gap-2">{children}</div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}
