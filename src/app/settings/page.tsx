import SettingsPageClient from "./SettingsPageClient";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

type TabId = "account" | "backup";

function parseTab(value: string | string[] | undefined): TabId {
  if (value === "backup") return "backup";
  return "account";
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: { tab?: string | string[] };
}) {
  await requireRole("ADMIN");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      mfaEnabled: true,
      failedLoginCount: true,
      lockedUntil: true,
      lastLoginAt: true,
      lastLoginIp: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const serialisedUsers = users.map((u) => ({
    ...u,
    lockedUntil: u.lockedUntil ? u.lockedUntil.toISOString() : null,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  }));

  const initialTab = parseTab(searchParams?.tab);

  return (
    <SettingsPageClient
      initialUsers={serialisedUsers}
      initialTab={initialTab}
    />
  );
}
