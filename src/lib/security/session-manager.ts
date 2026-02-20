import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/**
 * セッション管理（ガイドライン準拠：即時セッション無効化対応）
 */

const SESSION_EXPIRY_DAYS = 30;

/**
 * 新しいセッションを作成
 */
export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<string> {
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

  await prisma.userSession.create({
    data: {
      userId,
      sessionToken,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      isValid: true,
      expiresAt,
    },
  });

  return sessionToken;
}

/**
 * セッションを検証
 */
export async function validateSession(sessionToken: string): Promise<{
  valid: boolean;
  userId?: string;
  reason?: string;
}> {
  const session = await prisma.userSession.findUnique({
    where: { sessionToken },
    include: {
      user: {
        select: {
          id: true,
          status: true,
          lockedUntil: true,
        },
      },
    },
  });

  if (!session) {
    return { valid: false, reason: "セッションが見つかりません" };
  }

  if (!session.isValid) {
    return { valid: false, reason: "セッションが無効化されています" };
  }

  if (new Date() > session.expiresAt) {
    await invalidateSession(sessionToken);
    return { valid: false, reason: "セッションの有効期限が切れています" };
  }

  // ユーザーの状態をチェック
  if (session.user.status !== "ACTIVE") {
    return { valid: false, reason: "アカウントが無効化されています" };
  }

  if (session.user.lockedUntil && new Date() < session.user.lockedUntil) {
    return { valid: false, reason: "アカウントがロックされています" };
  }

  // 最終アクティブ時刻を更新
  await prisma.userSession.update({
    where: { id: session.id },
    data: { lastActiveAt: new Date() },
  });

  return { valid: true, userId: session.userId };
}

/**
 * セッションを無効化
 */
export async function invalidateSession(sessionToken: string): Promise<void> {
  await prisma.userSession.updateMany({
    where: { sessionToken },
    data: { isValid: false },
  });
}

/**
 * ユーザーの全セッションを無効化
 */
export async function invalidateAllUserSessions(
  userId: string,
): Promise<number> {
  const result = await prisma.userSession.updateMany({
    where: { userId, isValid: true },
    data: { isValid: false },
  });
  return result.count;
}

/**
 * 全ユーザーのセッションを無効化（緊急時用）
 */
export async function invalidateAllSessions(): Promise<number> {
  const result = await prisma.userSession.updateMany({
    where: { isValid: true },
    data: { isValid: false },
  });
  return result.count;
}

/**
 * 特定ロールのユーザーのセッションを無効化
 */
export async function invalidateSessionsByRole(role: string): Promise<number> {
  const users = await prisma.user.findMany({
    where: { role: role as any },
    select: { id: true },
  });

  const userIds = users.map((u) => u.id);

  const result = await prisma.userSession.updateMany({
    where: {
      userId: { in: userIds },
      isValid: true,
    },
    data: { isValid: false },
  });

  return result.count;
}

/**
 * 期限切れセッションをクリーンアップ
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.userSession.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        {
          isValid: false,
          lastActiveAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      ],
    },
  });
  return result.count;
}

/**
 * ユーザーのアクティブセッション数を取得
 */
export async function getActiveSessionCount(userId: string): Promise<number> {
  return prisma.userSession.count({
    where: {
      userId,
      isValid: true,
      expiresAt: { gt: new Date() },
    },
  });
}

/**
 * ユーザーのセッション一覧を取得
 */
export async function getUserSessions(userId: string): Promise<
  Array<{
    id: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    lastActiveAt: Date;
    isValid: boolean;
  }>
> {
  return prisma.userSession.findMany({
    where: { userId },
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      lastActiveAt: true,
      isValid: true,
    },
    orderBy: { lastActiveAt: "desc" },
  });
}
