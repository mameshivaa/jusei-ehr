import "server-only";
import crypto from "node:crypto";

// ================================
// 信頼根: アプリにハードコードされた公開鍵
// 鍵更新 = アプリ更新
// 本番環境では実際の公開鍵に置き換えること
// ================================
const TRUSTED_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAIPjYX0q+sWWISHFUZzfN+rnhPxgEGR2kbdPe2uvOc9A=
-----END PUBLIC KEY-----`;

// 署名対象: パッケージのSHA-256ハッシュ
// 検証順: 1) ハッシュ計算 → 2) 署名検証

export function verifyPackageIntegrity(
  packageBuffer: Buffer,
  expectedHash: string,
  signature: string,
): { valid: boolean; error?: string } {
  // Step 1: パッケージのSHA-256ハッシュを計算
  const actualHash = crypto
    .createHash("sha256")
    .update(packageBuffer)
    .digest("hex");

  if (actualHash !== expectedHash) {
    return { valid: false, error: "hash_mismatch" };
  }

  // Step 2: ハッシュに対する署名を検証（Ed25519）
  const signatureBuffer = Buffer.from(signature, "base64");
  const hashBuffer = Buffer.from(expectedHash, "hex");

  const isValid = crypto.verify(
    null, // Ed25519 doesn't use digest algorithm
    hashBuffer,
    TRUSTED_PUBLIC_KEY,
    signatureBuffer,
  );

  if (!isValid) {
    return { valid: false, error: "signature_invalid" };
  }

  return { valid: true };
}
