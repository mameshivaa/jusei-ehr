import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { PersonalInfoEncryption } from "./encryption";
import { getMfaSettings } from "@/lib/settings";

/**
 * MFA（多要素認証）機能（ガイドライン準拠：TOTP対応）
 *
 * セキュリティ強化:
 * - MFAシークレットは暗号化して保存
 * - バックアップコードはハッシュ化して保存（再表示不可）
 * - MFA試行にレートリミットを適用
 */

const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30; // 秒
const TOTP_ALGORITHM = "sha1";
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;
const BCRYPT_ROUNDS = 10;

// MFA試行のレートリミット用キャッシュ（本番ではRedis等を使用推奨）
const mfaAttemptCache = new Map<string, { count: number; resetAt: Date }>();

/**
 * Base32エンコード
 */
function base32Encode(buffer: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  let result = "";

  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, "0");
  }

  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    result += alphabet[parseInt(chunk, 2)];
  }

  return result;
}

/**
 * Base32デコード
 */
function base32Decode(encoded: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";

  for (const char of encoded.toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index >= 0) {
      bits += index.toString(2).padStart(5, "0");
    }
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

/**
 * TOTPコードを生成
 */
function generateTOTP(secret: string, timestamp?: number): string {
  const time = timestamp ?? Math.floor(Date.now() / 1000);
  const counter = Math.floor(time / TOTP_PERIOD);

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const secretBuffer = base32Decode(secret);
  const hmac = crypto.createHmac(TOTP_ALGORITHM, secretBuffer);
  hmac.update(counterBuffer);
  const hmacResult = hmac.digest();

  const offset = hmacResult[hmacResult.length - 1] & 0x0f;
  const code =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  const otp = code % Math.pow(10, TOTP_DIGITS);
  return otp.toString().padStart(TOTP_DIGITS, "0");
}

/**
 * MFA用の秘密鍵を生成
 */
export function generateMfaSecret(): string {
  const buffer = crypto.randomBytes(20);
  return base32Encode(buffer);
}

/**
 * バックアップコードを生成（平文）
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = crypto.randomBytes(BACKUP_CODE_LENGTH / 2).toString("hex");
    codes.push(code);
  }
  return codes;
}

/**
 * バックアップコードをハッシュ化（保存用）
 */
async function hashBackupCodes(codes: string[]): Promise<string[]> {
  const hashedCodes = await Promise.all(
    codes.map((code) => bcrypt.hash(code, BCRYPT_ROUNDS)),
  );
  return hashedCodes;
}

/**
 * バックアップコードを検証
 */
async function verifyBackupCode(
  code: string,
  hashedCodes: string[],
): Promise<number> {
  for (let i = 0; i < hashedCodes.length; i++) {
    const match = await bcrypt.compare(code, hashedCodes[i]);
    if (match) {
      return i;
    }
  }
  return -1;
}

/**
 * MFAシークレットを暗号化
 */
function encryptMfaSecret(secret: string): string {
  return PersonalInfoEncryption.encrypt(secret);
}

/**
 * MFAシークレットを復号化
 */
function decryptMfaSecret(encryptedSecret: string): string {
  return PersonalInfoEncryption.decrypt(encryptedSecret);
}

/**
 * MFA試行のレートリミットをチェック
 */
async function checkMfaRateLimit(userId: string): Promise<{
  allowed: boolean;
  remainingAttempts: number;
  resetAt?: Date;
}> {
  const settings = await getMfaSettings();
  const now = new Date();
  const cached = mfaAttemptCache.get(userId);

  if (cached && cached.resetAt > now) {
    if (cached.count >= settings.rateLimitAttempts) {
      return {
        allowed: false,
        remainingAttempts: 0,
        resetAt: cached.resetAt,
      };
    }
    return {
      allowed: true,
      remainingAttempts: settings.rateLimitAttempts - cached.count,
    };
  }

  // キャッシュがないか期限切れの場合はリセット
  return {
    allowed: true,
    remainingAttempts: settings.rateLimitAttempts,
  };
}

/**
 * MFA試行を記録
 */
async function recordMfaAttempt(
  userId: string,
  success: boolean,
): Promise<void> {
  const settings = await getMfaSettings();
  const now = new Date();
  const resetAt = new Date(
    now.getTime() + settings.rateLimitMinutes * 60 * 1000,
  );
  const cached = mfaAttemptCache.get(userId);

  if (success) {
    // 成功時はカウントをリセット
    mfaAttemptCache.delete(userId);
    return;
  }

  if (cached && cached.resetAt > now) {
    // 既存のカウントを増加
    cached.count += 1;
  } else {
    // 新規カウント開始
    mfaAttemptCache.set(userId, { count: 1, resetAt });
  }
}

/**
 * TOTPコードを検証
 */
export function verifyTOTP(
  secret: string,
  code: string,
  window: number = 1,
): boolean {
  const now = Math.floor(Date.now() / 1000);

  // 前後のwindow分のコードも許容（時刻ずれ対策）
  for (let i = -window; i <= window; i++) {
    const timestamp = now + i * TOTP_PERIOD;
    const expectedCode = generateTOTP(secret, timestamp);
    if (code === expectedCode) {
      return true;
    }
  }

  return false;
}

/**
 * TOTP認証URI（QRコード用）を生成
 */
export function generateTotpUri(
  secret: string,
  email: string,
  issuer: string = "V電子カルテ",
): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(email);
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}

/**
 * ユーザーのMFAをセットアップ
 *
 * 注意: この関数は秘密鍵とバックアップコードを平文で返す（初回表示用）。
 * バックアップコードはハッシュ化して保存されるため、再表示は不可能。
 */
export async function setupMfa(userId: string): Promise<{
  secret: string;
  backupCodes: string[];
  uri: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, mfaEnabled: true },
  });

  if (!user) {
    throw new Error("ユーザーが見つかりません");
  }

  if (user.mfaEnabled) {
    throw new Error("MFAは既に有効化されています");
  }

  const secret = generateMfaSecret();
  const backupCodes = generateBackupCodes();
  const uri = generateTotpUri(secret, user.email);

  // 秘密鍵を暗号化、バックアップコードをハッシュ化して保存
  const encryptedSecret = encryptMfaSecret(secret);
  const hashedBackupCodes = await hashBackupCodes(backupCodes);

  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaSecret: encryptedSecret,
      mfaBackupCodes: JSON.stringify(hashedBackupCodes),
    },
  });

  // 平文で返す（初回表示用、以降は再表示不可）
  return { secret, backupCodes, uri };
}

/**
 * MFAを有効化（初回コード検証後）
 */
export async function enableMfa(
  userId: string,
  code: string,
): Promise<boolean> {
  // レートリミットチェック
  const rateLimit = await checkMfaRateLimit(userId);
  if (!rateLimit.allowed) {
    throw new Error(
      `MFA試行回数が上限を超えました。${rateLimit.resetAt?.toLocaleString("ja-JP")}以降に再試行してください。`,
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaSecret: true, mfaEnabled: true },
  });

  if (!user || !user.mfaSecret) {
    throw new Error("MFAのセットアップが完了していません");
  }

  if (user.mfaEnabled) {
    throw new Error("MFAは既に有効化されています");
  }

  // 暗号化された秘密鍵を復号化
  const decryptedSecret = decryptMfaSecret(user.mfaSecret);

  if (!verifyTOTP(decryptedSecret, code)) {
    await recordMfaAttempt(userId, false);
    return false;
  }

  await recordMfaAttempt(userId, true);

  await prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: true },
  });

  await createAuditLog({
    userId,
    action: "MFA_ENABLED",
    entityType: "USER",
    entityId: userId,
    category: "AUTHENTICATION",
    severity: "INFO",
  });

  return true;
}

/**
 * MFAを無効化
 */
export async function disableMfa(
  userId: string,
  disabledBy: string,
  reason?: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: null,
    },
  });

  await createAuditLog({
    userId: disabledBy,
    action: "MFA_DISABLED",
    entityType: "USER",
    entityId: userId,
    category: "AUTHENTICATION",
    severity: "WARNING",
    metadata: { reason },
  });
}

/**
 * MFAコードを検証（レートリミット付き）
 */
export async function verifyMfaCode(
  userId: string,
  code: string,
): Promise<boolean> {
  // レートリミットチェック
  const rateLimit = await checkMfaRateLimit(userId);
  if (!rateLimit.allowed) {
    await createAuditLog({
      userId,
      action: "MFA_RATE_LIMITED",
      entityType: "USER",
      entityId: userId,
      category: "AUTHENTICATION",
      severity: "WARNING",
    });
    return false;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaSecret: true, mfaEnabled: true, mfaBackupCodes: true },
  });

  if (!user || !user.mfaEnabled || !user.mfaSecret) {
    return false;
  }

  // 暗号化された秘密鍵を復号化してTOTPコードを検証
  const decryptedSecret = decryptMfaSecret(user.mfaSecret);
  if (verifyTOTP(decryptedSecret, code)) {
    await recordMfaAttempt(userId, true);
    return true;
  }

  // バックアップコードを検証（ハッシュ比較）
  if (user.mfaBackupCodes) {
    const hashedCodes: string[] = JSON.parse(user.mfaBackupCodes);
    const codeIndex = await verifyBackupCode(code, hashedCodes);

    if (codeIndex >= 0) {
      // 使用済みのバックアップコードを削除
      hashedCodes.splice(codeIndex, 1);
      await prisma.user.update({
        where: { id: userId },
        data: { mfaBackupCodes: JSON.stringify(hashedCodes) },
      });

      await recordMfaAttempt(userId, true);

      await createAuditLog({
        userId,
        action: "MFA_BACKUP_CODE_USED",
        entityType: "USER",
        entityId: userId,
        category: "AUTHENTICATION",
        severity: "WARNING",
        metadata: { remainingCodes: hashedCodes.length },
      });

      return true;
    }
  }

  // 失敗を記録
  await recordMfaAttempt(userId, false);
  return false;
}

/**
 * ユーザーのMFA状態を取得
 */
export async function getMfaStatus(userId: string): Promise<{
  enabled: boolean;
  hasBackupCodes: boolean;
  backupCodesRemaining: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true, mfaBackupCodes: true },
  });

  if (!user) {
    throw new Error("ユーザーが見つかりません");
  }

  let backupCodesRemaining = 0;
  if (user.mfaBackupCodes) {
    const codes: string[] = JSON.parse(user.mfaBackupCodes);
    backupCodesRemaining = codes.length;
  }

  return {
    enabled: user.mfaEnabled,
    hasBackupCodes: backupCodesRemaining > 0,
    backupCodesRemaining,
  };
}

/**
 * バックアップコードを再生成
 *
 * 注意: この関数は新しいバックアップコードを平文で返す（初回表示用）。
 * 以降は再表示不可能。
 */
export async function regenerateBackupCodes(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true },
  });

  if (!user || !user.mfaEnabled) {
    throw new Error("MFAが有効化されていません");
  }

  const backupCodes = generateBackupCodes();
  const hashedBackupCodes = await hashBackupCodes(backupCodes);

  await prisma.user.update({
    where: { id: userId },
    data: { mfaBackupCodes: JSON.stringify(hashedBackupCodes) },
  });

  await createAuditLog({
    userId,
    action: "MFA_BACKUP_CODES_REGENERATED",
    entityType: "USER",
    entityId: userId,
    category: "AUTHENTICATION",
    severity: "INFO",
  });

  // 平文で返す（初回表示用、以降は再表示不可）
  return backupCodes;
}
