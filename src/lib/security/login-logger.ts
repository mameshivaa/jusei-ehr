import { prisma } from "@/lib/prisma";

/**
 * ログイン試行ログ（ガイドライン準拠：認証ログの詳細記録）
 */

export type LoginFailureReason =
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_LOCKED"
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_DELETED"
  | "MFA_REQUIRED"
  | "MFA_FAILED"
  | "MFA_RATE_LIMITED"
  | "USER_NOT_FOUND"
  | "UNKNOWN";

export interface LoginAttemptInput {
  email: string;
  userId?: string;
  success: boolean;
  failureReason?: LoginFailureReason;
  mfaRequired?: boolean;
  mfaVerified?: boolean;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

/**
 * ログイン試行を記録
 */
export async function recordLoginAttempt(
  input: LoginAttemptInput,
): Promise<string> {
  const attempt = await prisma.loginAttempt.create({
    data: {
      email: input.email,
      userId: input.userId || null,
      success: input.success,
      failureReason: input.failureReason || null,
      mfaRequired: input.mfaRequired || false,
      mfaVerified: input.mfaVerified || false,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
      sessionId: input.sessionId || null,
    },
  });

  return attempt.id;
}

/**
 * ログイン成功を記録
 */
export async function recordLoginSuccess(
  email: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string,
  sessionId?: string,
  mfaVerified?: boolean,
): Promise<string> {
  return recordLoginAttempt({
    email,
    userId,
    success: true,
    mfaVerified,
    ipAddress,
    userAgent,
    sessionId,
  });
}

/**
 * ログイン失敗を記録
 */
export async function recordLoginFailureLog(
  email: string,
  reason: LoginFailureReason,
  userId?: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<string> {
  return recordLoginAttempt({
    email,
    userId,
    success: false,
    failureReason: reason,
    ipAddress,
    userAgent,
  });
}

/**
 * 特定ユーザーのログイン試行履歴を取得
 */
export async function getLoginAttemptsByUser(
  userId: string,
  options?: {
    limit?: number;
    startDate?: Date;
    endDate?: Date;
    successOnly?: boolean;
  },
): Promise<any[]> {
  const where: any = { userId };

  if (options?.startDate || options?.endDate) {
    where.createdAt = {};
    if (options.startDate) where.createdAt.gte = options.startDate;
    if (options.endDate) where.createdAt.lte = options.endDate;
  }

  if (options?.successOnly !== undefined) {
    where.success = options.successOnly;
  }

  return prisma.loginAttempt.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options?.limit || 100,
  });
}

/**
 * 特定メールアドレスのログイン試行履歴を取得
 */
export async function getLoginAttemptsByEmail(
  email: string,
  options?: {
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  },
): Promise<any[]> {
  const where: any = { email };

  if (options?.startDate || options?.endDate) {
    where.createdAt = {};
    if (options.startDate) where.createdAt.gte = options.startDate;
    if (options.endDate) where.createdAt.lte = options.endDate;
  }

  return prisma.loginAttempt.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options?.limit || 100,
  });
}

/**
 * 特定IPアドレスからのログイン試行履歴を取得
 */
export async function getLoginAttemptsByIp(
  ipAddress: string,
  options?: {
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  },
): Promise<any[]> {
  const where: any = { ipAddress };

  if (options?.startDate || options?.endDate) {
    where.createdAt = {};
    if (options.startDate) where.createdAt.gte = options.startDate;
    if (options.endDate) where.createdAt.lte = options.endDate;
  }

  return prisma.loginAttempt.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options?.limit || 100,
  });
}

/**
 * 失敗したログイン試行の集計を取得
 */
export async function getFailedLoginSummary(
  startDate: Date,
  endDate: Date,
): Promise<{
  totalAttempts: number;
  failedAttempts: number;
  uniqueEmails: number;
  uniqueIps: number;
  byReason: Record<string, number>;
}> {
  const attempts = await prisma.loginAttempt.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
    select: {
      success: true,
      email: true,
      ipAddress: true,
      failureReason: true,
    },
  });

  const failedAttempts = attempts.filter((a) => !a.success);
  const uniqueEmails = new Set(failedAttempts.map((a) => a.email)).size;
  const uniqueIps = new Set(
    failedAttempts.filter((a) => a.ipAddress).map((a) => a.ipAddress),
  ).size;

  const byReason: Record<string, number> = {};
  for (const attempt of failedAttempts) {
    const reason = attempt.failureReason || "UNKNOWN";
    byReason[reason] = (byReason[reason] || 0) + 1;
  }

  return {
    totalAttempts: attempts.length,
    failedAttempts: failedAttempts.length,
    uniqueEmails,
    uniqueIps,
    byReason,
  };
}

/**
 * 古いログイン試行記録をクリーンアップ
 */
export async function cleanupOldLoginAttempts(
  retentionDays: number,
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const result = await prisma.loginAttempt.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
    },
  });

  return result.count;
}
