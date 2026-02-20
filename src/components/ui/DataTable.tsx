"use client";

import React from "react";

export default function DataTable({
  headers,
  rows,
  columnClasses,
  columnStyles,
  fixed,
  density = "regular",
}: {
  headers: React.ReactNode[];
  rows: React.ReactNode[][];
  columnClasses?: string[];
  columnStyles?: React.CSSProperties[];
  fixed?: boolean;
  density?: "compact" | "regular" | "relaxed";
}) {
  const useColgroup =
    Array.isArray(columnStyles) && (columnStyles?.length || 0) > 0;
  const isFixed = Boolean(fixed) || useColgroup;
  const densityMap = {
    compact: {
      th: "px-[var(--space-2)] py-[var(--space-1)]",
      td: "px-[var(--space-2)] py-[var(--space-1)]",
      text: "text-[13px]",
    },
    regular: {
      th: "px-[var(--space-3)] py-[var(--space-2)]",
      td: "px-[var(--space-3)] py-[var(--space-2)]",
      text: "text-sm",
    },
    relaxed: {
      th: "px-[var(--space-4)] py-[var(--space-3)]",
      td: "px-[var(--space-4)] py-[var(--space-3)]",
      text: "text-base",
    },
  } as const;
  const d = densityMap[density];
  return (
    <table
      className={`w-full ${isFixed ? "table-fixed" : "table-auto"} ${d.text}`}
    >
      {useColgroup && (
        <colgroup>
          {headers.map((_, i) => (
            <col key={i} style={columnStyles?.[i]} />
          ))}
        </colgroup>
      )}
      <thead className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <tr className="text-left text-slate-600">
          {headers.map((h, i) => (
            <th
              key={i}
              className={`
                ${d.th} text-xs font-semibold tracking-wide ${columnClasses?.[i] || ""}
                first:pl-[var(--space-4)] sm:first:pl-[var(--space-5)] lg:first:pl-[var(--space-6)]
                last:pr-[var(--space-4)] sm:last:pr-[var(--space-5)] lg:last:pr-[var(--space-6)]
              `}
              style={columnStyles?.[i]}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr
            key={ri}
            className="border-b last:border-0 hover:bg-slate-50 transition-colors"
          >
            {r.map((c, ci) => (
              <td
                key={ci}
                className={`
                  ${d.td} align-middle text-slate-800 ${columnClasses?.[ci] || ""}
                  first:pl-[var(--space-4)] sm:first:pl-[var(--space-5)] lg:first:pl-[var(--space-6)]
                  last:pr-[var(--space-4)] sm:last:pr-[var(--space-5)] lg:last:pr-[var(--space-6)]
                `}
                style={columnStyles?.[ci]}
              >
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
