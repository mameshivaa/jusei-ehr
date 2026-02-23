import crypto from "crypto";

/**
 * 個人情報保護法対応：個人情報の暗号化
 * AES-256-GCMを使用（認証付き暗号）
 */
export class PersonalInfoEncryption {
  private static getKey(): Buffer {
    const keyHex = process.env.PERSONAL_INFO_ENCRYPTION_KEY;
    if (keyHex && /^[0-9a-fA-F]{64}$/.test(keyHex)) {
      return Buffer.from(keyHex, "hex");
    }

    const secret = process.env.APP_SECRET || process.env.APP_SECURITY_SEED;
    if (!secret) {
      throw new Error(
        "Encryption key is not configured. Set PERSONAL_INFO_ENCRYPTION_KEY or APP_SECRET.",
      );
    }

    return crypto.createHash("sha256").update(secret).digest();
  }

  /**
   * 個人情報を暗号化
   */
  static encrypt(plainText: string): string {
    if (!plainText) return "";

    const key = this.getKey();
    const iv = crypto.randomBytes(12); // GCM推奨IVサイズ（96ビット）
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plainText, "utf8"),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // 形式: iv.hex|authTag.hex|ciphertext.hex
    return `${iv.toString("hex")}.${authTag.toString("hex")}.${ciphertext.toString("hex")}`;
  }

  /**
   * 個人情報を復号化
   */
  static decrypt(encrypted: string): string {
    if (!encrypted) return "";

    // 既に復号化されている可能性がある（移行中のデータ）
    // 暗号化されたデータは通常、特定の形式（iv.tag.ciphertext）を持つ
    const parts = encrypted.split(".");
    if (parts.length !== 3) {
      // 既に平文の可能性がある（移行前のデータ）
      return encrypted;
    }

    try {
      const [ivHex, tagHex, ctHex] = parts;
      const key = this.getKey();
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(tagHex, "hex");
      const ciphertext = Buffer.from(ctHex, "hex");

      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);

      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return plaintext.toString("utf8");
    } catch (error) {
      // 復号化に失敗した場合は元の値を保持（移行前のデータの可能性）
      return encrypted;
    }
  }

  /**
   * フィールドが暗号化されているかどうかを判定する
   * @param value チェックする値
   * @returns 暗号化されている場合はtrue
   */
  static isEncrypted(value: string | null | undefined): boolean {
    if (!value) return false;
    // 暗号化されたデータは iv.tag.ciphertext の形式
    return value.includes(".") && value.split(".").length === 3;
  }
}
