import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getSetting, setSetting } from "@/lib/settings";

const RECOVERY_CODE_BYTES = 16;
const RECOVERY_CODE_SETTING_KEY = "systemRecoveryCodeHash";
const BCRYPT_ROUNDS = 10;

export function generateRecoveryCode(): string {
  return crypto.randomBytes(RECOVERY_CODE_BYTES).toString("hex");
}

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
}

export function formatRecoveryCode(code: string): string {
  const normalized = normalizeRecoveryCode(code);
  const groups = normalized.match(/.{1,4}/g) || [];
  return groups.join("-").toUpperCase();
}

export async function hashRecoveryCode(code: string): Promise<string> {
  const normalized = normalizeRecoveryCode(code);
  return bcrypt.hash(normalized, BCRYPT_ROUNDS);
}

export async function verifyRecoveryCode(
  code: string,
  hash: string,
): Promise<boolean> {
  const normalized = normalizeRecoveryCode(code);
  return bcrypt.compare(normalized, hash);
}

export async function saveRecoveryCodeHash(
  hash: string,
  updatedBy?: string,
): Promise<void> {
  await setSetting(RECOVERY_CODE_SETTING_KEY, hash, updatedBy);
}

export async function getRecoveryCodeHash(): Promise<string> {
  return getSetting(RECOVERY_CODE_SETTING_KEY);
}
