import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const DEFAULT_DEV_EMAIL = "dev@example.com";
const DEFAULT_DEV_PASSWORD = "devpass1234!";

export async function ensureDevAdmin() {
  if (process.env.NODE_ENV !== "development") return;

  const email = process.env.DEV_ADMIN_EMAIL || DEFAULT_DEV_EMAIL;
  const password = process.env.DEV_ADMIN_PASSWORD || DEFAULT_DEV_PASSWORD;

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    create: {
      email: email.toLowerCase(),
      name: "開発管理者",
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash,
      failedLoginCount: 0,
      lockedUntil: null,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
    update: {
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash,
      failedLoginCount: 0,
      lockedUntil: null,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  });
}
