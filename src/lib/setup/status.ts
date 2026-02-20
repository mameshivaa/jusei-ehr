import { prisma } from "@/lib/prisma";

export async function isSetupComplete(): Promise<boolean> {
  const [clinic, adminUser, settings] = await Promise.all([
    prisma.clinic.findFirst({ select: { id: true } }),
    prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: { id: true },
    }),
    prisma.systemSettings.findMany({
      where: {
        key: {
          in: ["backupSecret", "securityOfficerName", "securityOfficerRole"],
        },
      },
      select: { key: true },
    }),
  ]);
  const requiredKeys = new Set([
    "backupSecret",
    "securityOfficerName",
    "securityOfficerRole",
  ]);
  for (const row of settings) {
    requiredKeys.delete(row.key);
  }
  return Boolean(clinic && adminUser && requiredKeys.size === 0);
}
