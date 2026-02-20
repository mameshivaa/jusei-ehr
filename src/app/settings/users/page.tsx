import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import UsersClient from "@/components/settings/UsersClient";
import PageHeader from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
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

  const serialised = users.map((u) => ({
    ...u,
    lockedUntil: u.lockedUntil ? u.lockedUntil.toISOString() : null,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        <PageHeader
          title="ユーザー管理"
          description="ロールとアカウント状態を管理します"
          contentOnly
        />
        <UsersClient initialUsers={serialised} />
      </div>
    </div>
  );
}
