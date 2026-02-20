import { prisma } from "@/lib/prisma";
import { invalidateAllUserSessions } from "@/lib/security/session-manager";

export const GOOGLE_ACCOUNT_KEY = "google_account_email";

export type EnsureGoogleBindingResult =
  | { status: "ok"; boundEmail: string }
  | { status: "bound"; boundEmail: string }
  | { status: "blocked"; boundEmail: string }
  | { status: "transferred"; boundEmail: string; previousEmail: string };

/**
 * 1院 = 1 Googleアカウントの紐づけを保証する。
 * transferRequested が true のときだけ既存紐づけを上書きし、旧アカウントのセッションを無効化する。
 */
export async function ensureGoogleAccountBinding(
  email: string | null | undefined,
  { transferRequested = false }: { transferRequested?: boolean } = {},
): Promise<EnsureGoogleBindingResult> {
  const normalizedEmail = (email || "").trim().toLowerCase();

  if (!normalizedEmail) {
    return {
      status: "blocked",
      boundEmail: "",
    };
  }

  const setting = await prisma.systemSettings.findUnique({
    where: { key: GOOGLE_ACCOUNT_KEY },
  });

  // 初回登録: 現在のアカウントを固定する
  if (!setting) {
    await prisma.systemSettings.create({
      data: {
        key: GOOGLE_ACCOUNT_KEY,
        value: normalizedEmail,
        description: "この院に紐づく代表Googleアカウント（1院=1アカウント）",
      },
    });
    return { status: "bound", boundEmail: normalizedEmail };
  }

  const boundEmail = setting.value.toLowerCase();

  if (boundEmail === normalizedEmail) {
    return { status: "ok", boundEmail };
  }

  if (!transferRequested) {
    return { status: "blocked", boundEmail };
  }

  // 明示的な移管時のみ上書きし、旧アカウントのセッションを無効化
  await prisma.systemSettings.update({
    where: { key: GOOGLE_ACCOUNT_KEY },
    data: { value: normalizedEmail },
  });

  const previousUser = await prisma.user.findUnique({
    where: { email: boundEmail },
    select: { id: true },
  });
  if (previousUser) {
    await invalidateAllUserSessions(previousUser.id);
  }

  return {
    status: "transferred",
    boundEmail: normalizedEmail,
    previousEmail: boundEmail,
  };
}

export async function getBoundGoogleAccount(): Promise<string | null> {
  const setting = await prisma.systemSettings.findUnique({
    where: { key: GOOGLE_ACCOUNT_KEY },
  });
  return setting?.value ?? null;
}
