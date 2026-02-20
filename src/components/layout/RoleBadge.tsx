"use client";

type RoleType = "ADMIN" | "PRACTITIONER" | "RECEPTION" | undefined;

const ROLE_CONFIG: Record<
  NonNullable<RoleType>,
  { label: string; bgColor: string; textColor: string }
> = {
  ADMIN: {
    label: "管理者",
    bgColor: "bg-slate-100",
    textColor: "text-slate-700",
  },
  PRACTITIONER: {
    label: "施術者",
    bgColor: "bg-slate-100",
    textColor: "text-slate-700",
  },
  RECEPTION: {
    label: "受付",
    bgColor: "bg-slate-100",
    textColor: "text-slate-700",
  },
};

export function RoleBadge({ role }: { role: RoleType }) {
  if (!role) return null;

  const config = ROLE_CONFIG[role];
  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.textColor}`}
    >
      {config.label}
    </span>
  );
}
