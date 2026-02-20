import React from "react";

type PatientDetailSectionProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  columns?: "one" | "two";
};

export default function PatientDetailSection({
  title,
  description,
  children,
  columns = "two",
}: PatientDetailSectionProps) {
  const gridClass =
    columns === "two" ? "grid gap-4 md:grid-cols-2" : "grid gap-4";

  return (
    <section className="rounded-xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm">
      <header className="mb-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {description && (
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        )}
      </header>
      <div className={gridClass}>{children}</div>
    </section>
  );
}
