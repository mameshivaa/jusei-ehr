import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { invalidateAllUserSessions } from "./session-manager";
import { getLockoutSettings } from "@/lib/settings";
import bcrypt from "bcryptjs";

/**
 * アカウント管理（ガイドライン準拠：アカウント状態管理・ロックアウト機能）
 */

/**
 * ログイン失敗を記録
 */
export async function recordLoginFailure(
  userId: string,
  ipAddress?: string,
): Promise<{
  isLocked: boolean;
  remainingAttempts: number;
  lockedUntil?: Date;
}> {
  // 設定値を取得
  const { maxFailedLogins, lockoutMinutes } = await getLockoutSettings();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginCount: true, status: true },
  });

  if (!user || user.status !== "ACTIVE") {
    return { isLocked: true, remainingAttempts: 0 };
  }

  const newFailedCount = user.failedLoginCount + 1;
  const shouldLock = newFailedCount >= maxFailedLogins;
  const lockedUntil = shouldLock
    ? new Date(Date.now() + lockoutMinutes * 60 * 1000)
    : null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginCount: newFailedCount,
      lastFailedLoginAt: new Date(),
      lockedUntil,
    },
  });

  // 監査ログを記録
  await createAuditLog({
    userId,
    action: "LOGIN_FAILED",
    entityType: "USER",
    entityId: userId,
    category: "AUTHENTICATION",
    severity: shouldLock ? "WARNING" : "INFO",
    ipAddress,
    metadata: {
      failedCount: newFailedCount,
      isLocked: shouldLock,
    },
  });

  if (shouldLock) {
    // ロック時は全セッションを無効化
    await invalidateAllUserSessions(userId);
  }

  return {
    isLocked: shouldLock,
    remainingAttempts: Math.max(0, maxFailedLogins - newFailedCount),
    lockedUntil: lockedUntil || undefined,
  };
}

/**
 * ログイン成功を記録（失敗カウントをリセット・監査ログ1件）
 */
export async function recordLoginSuccess(
  userId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress || null,
    },
  });

  await createAuditLog({
    userId,
    action: "LOGIN",
    entityType: "USER",
    entityId: userId,
    category: "AUTHENTICATION",
    severity: "INFO",
    ipAddress,
    userAgent,
  });
}

/**
 * アカウントがロックされているかチェック
 */
export async function isAccountLocked(userId: string): Promise<{
  locked: boolean;
  reason?: string;
  lockedUntil?: Date;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, lockedUntil: true },
  });

  if (!user) {
    return { locked: true, reason: "ユーザーが見つかりません" };
  }

  if (user.status === "SUSPENDED") {
    return { locked: true, reason: "アカウントが一時停止されています" };
  }

  if (user.status === "DELETED") {
    return { locked: true, reason: "アカウントが削除されています" };
  }

  if (user.lockedUntil && new Date() < user.lockedUntil) {
    return {
      locked: true,
      reason: "ログイン試行回数が上限を超えました",
      lockedUntil: user.lockedUntil,
    };
  }

  // ロック期間が過ぎていたら自動解除
  if (user.lockedUntil && new Date() >= user.lockedUntil) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lockedUntil: null,
        failedLoginCount: 0,
      },
    });
  }

  return { locked: false };
}

/**
 * アカウントのロックを解除（管理者用）
 */
export async function unlockAccount(
  userId: string,
  unlockedBy: string,
  reason?: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      lockedUntil: null,
      failedLoginCount: 0,
    },
  });

  // 権限変更ログを記録
  await prisma.permissionChangeLog.create({
    data: {
      targetUserId: userId,
      changedById: unlockedBy,
      reason: reason || "アカウントロック解除",
    },
  });

  await createAuditLog({
    userId: unlockedBy,
    action: "ACCOUNT_UNLOCK",
    entityType: "USER",
    entityId: userId,
    category: "AUTHENTICATION",
    severity: "INFO",
    metadata: { reason },
  });
}

/**
 * アカウント状態を変更
 */
export async function changeAccountStatus(
  userId: string,
  newStatus: "ACTIVE" | "SUSPENDED" | "DELETED",
  changedBy: string,
  reason?: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true },
  });

  if (!user) {
    throw new Error("ユーザーが見つかりません");
  }

  const oldStatus = user.status;

  await prisma.user.update({
    where: { id: userId },
    data: { status: newStatus },
  });

  // 権限変更ログを記録
  await prisma.permissionChangeLog.create({
    data: {
      targetUserId: userId,
      changedById: changedBy,
      oldStatus,
      newStatus,
      reason,
    },
  });

  // 無効化時は全セッションを無効化
  if (newStatus !== "ACTIVE") {
    await invalidateAllUserSessions(userId);
  }

  await createAuditLog({
    userId: changedBy,
    action: "ACCOUNT_STATUS_CHANGE",
    entityType: "USER",
    entityId: userId,
    category: "AUTHENTICATION",
    severity: newStatus === "DELETED" ? "WARNING" : "INFO",
    metadata: {
      oldStatus,
      newStatus,
      reason,
    },
  });
}

/**
 * ユーザーのロールを変更
 */
export async function changeUserRole(
  userId: string,
  newRole: "ADMIN" | "PRACTITIONER" | "RECEPTION",
  changedBy: string,
  reason?: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) {
    throw new Error("ユーザーが見つかりません");
  }

  const oldRole = user.role;

  await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
  });

  // 権限変更ログを記録
  await prisma.permissionChangeLog.create({
    data: {
      targetUserId: userId,
      changedById: changedBy,
      oldRole,
      newRole,
      reason,
    },
  });

  await createAuditLog({
    userId: changedBy,
    action: "ROLE_CHANGE",
    entityType: "USER",
    entityId: userId,
    category: "DATA_MODIFICATION",
    severity: "WARNING",
    metadata: {
      oldRole,
      newRole,
      reason,
    },
  });
}

/**
 * パスワードをリセット（管理者操作）
 * - bcryptでハッシュ化
 * - 失敗カウント/ロックを解除
 * - セッションを全無効化
 * - 監査ログを記録
 */
export async function resetUserPassword(
  targetUserId: string,
  newPassword: string,
  changedBy: string,
): Promise<void> {
  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      passwordHash,
      failedLoginCount: 0,
      lockedUntil: null,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  });

  await invalidateAllUserSessions(targetUserId);

  await createAuditLog({
    userId: changedBy,
    action: "PASSWORD_RESET",
    entityType: "USER",
    entityId: targetUserId,
    category: "AUTHENTICATION",
    severity: "WARNING",
  });
}

/**
 * 全ユーザーを一括ロック（緊急時用）
 */
export async function lockAllUsers(
  lockedBy: string,
  reason: string,
  excludeAdmins: boolean = true,
): Promise<number> {
  const lockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24時間

  const whereClause = excludeAdmins
    ? { status: "ACTIVE" as const, role: { not: "ADMIN" as const } }
    : { status: "ACTIVE" as const };

  const result = await prisma.user.updateMany({
    where: whereClause,
    data: { lockedUntil },
  });

  await createAuditLog({
    userId: lockedBy,
    action: "EMERGENCY_LOCK_ALL",
    entityType: "SYSTEM",
    category: "AUTHENTICATION",
    severity: "CRITICAL",
    metadata: {
      reason,
      excludeAdmins,
      affectedCount: result.count,
    },
  });

  return result.count;
}

/**
 * 全ユーザーのロックを解除（緊急対応後）
 */
export async function unlockAllUsers(
  unlockedBy: string,
  reason: string,
): Promise<number> {
  const result = await prisma.user.updateMany({
    where: { lockedUntil: { not: null } },
    data: {
      lockedUntil: null,
      failedLoginCount: 0,
    },
  });

  await createAuditLog({
    userId: unlockedBy,
    action: "EMERGENCY_UNLOCK_ALL",
    entityType: "SYSTEM",
    category: "AUTHENTICATION",
    severity: "WARNING",
    metadata: {
      reason,
      affectedCount: result.count,
    },
  });

  return result.count;
}
