import { prisma } from "@/lib/prisma";
import { getLocalSessionUser } from "@/lib/auth/local-session";

// 認証エラーの種類
export class AuthError extends Error {
  constructor(
    message: string,
    public code:
      | "UNAUTHENTICATED"
      | "FORBIDDEN"
      | "ACCOUNT_LOCKED"
      | "ACCOUNT_SUSPENDED"
      | "ACCOUNT_DELETED",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * 現在のユーザーを取得（認証チェックなし）
 */
export async function getCurrentUser() {
  const localUser = await getLocalSessionUser();
  if (localUser) {
    return {
      id: localUser.id,
      email: localUser.email,
      name: localUser.name,
      role: localUser.role,
      status: localUser.status,
    };
  }

  return null;
}

/**
 * ユーザーのアカウント状態をチェック（ガイドライン準拠：ACTIVE以外は拒否）
 */
async function checkUserStatus(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, lockedUntil: true },
  });

  if (!user) {
    throw new AuthError("ユーザーが見つかりません", "UNAUTHENTICATED");
  }

  // アカウント状態チェック
  if (user.status === "SUSPENDED") {
    throw new AuthError(
      "アカウントが一時停止されています",
      "ACCOUNT_SUSPENDED",
    );
  }

  if (user.status === "DELETED") {
    throw new AuthError("アカウントが削除されています", "ACCOUNT_DELETED");
  }

  // ロックアウトチェック
  if (user.lockedUntil && new Date() < user.lockedUntil) {
    throw new AuthError(
      `アカウントがロックされています。${user.lockedUntil.toLocaleString("ja-JP")}まで待つか、管理者に連絡してください。`,
      "ACCOUNT_LOCKED",
    );
  }

  // ロック期限切れの場合は自動解除
  if (user.lockedUntil && new Date() >= user.lockedUntil) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lockedUntil: null,
        failedLoginCount: 0,
      },
    });
  }
}

/**
 * 認証を要求（ガイドライン準拠：アカウント状態も確認）
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("認証が必要です", "UNAUTHENTICATED");
  }

  // アカウント状態をチェック
  await checkUserStatus(user.id);

  return user;
}

/**
 * 特定のロールを要求（ガイドライン準拠：権限チェック）
 */
export async function requireRole(role: string) {
  const user = await requireAuth();
  if (user.role !== role && user.role !== "ADMIN") {
    throw new AuthError("権限が不足しています", "FORBIDDEN");
  }
  return user;
}

/**
 * 複数のロールのいずれかを要求
 */
export async function requireAnyRole(roles: string[]) {
  const user = await requireAuth();
  if (!roles.includes(user.role) && user.role !== "ADMIN") {
    throw new AuthError("権限が不足しています", "FORBIDDEN");
  }
  return user;
}

/**
 * 管理者権限を要求
 */
export async function requireAdmin() {
  return requireRole("ADMIN");
}
