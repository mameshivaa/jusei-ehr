import crypto from "crypto";

/**
 * e-文書法対応：電子署名・タイムスタンプ機能
 */
export class DigitalSignature {
  /**
   * データのハッシュ値を計算（SHA-256）
   */
  static calculateHash(data: string): string {
    return crypto.createHash("sha256").update(data, "utf8").digest("hex");
  }

  /**
   * 電子署名を生成（e-文書法対応）
   * 実際の運用では、認証局（CA）発行の証明書を使用することを推奨
   */
  static sign(
    data: string,
    privateKey?: string,
  ): {
    signature: string;
    hash: string;
    timestamp: string;
    algorithm: string;
  } {
    const hash = this.calculateHash(data);
    const timestamp = new Date().toISOString();

    // 開発環境用の簡易署名（本番環境では認証局発行の証明書を使用）
    const signingKey =
      privateKey || process.env.SIGNING_PRIVATE_KEY || "development-key";
    const hmac = crypto.createHmac("sha256", signingKey);
    hmac.update(hash);
    hmac.update(timestamp);
    const signature = hmac.digest("hex");

    return {
      signature,
      hash,
      timestamp,
      algorithm: "HMAC-SHA256",
    };
  }

  /**
   * 電子署名を検証
   */
  static verify(
    data: string,
    signature: string,
    timestamp: string,
    algorithm: string,
    privateKey?: string,
  ): boolean {
    const hash = this.calculateHash(data);
    const signingKey =
      privateKey || process.env.SIGNING_PRIVATE_KEY || "development-key";

    const hmac = crypto.createHmac("sha256", signingKey);
    hmac.update(hash);
    hmac.update(timestamp);
    const expectedSignature = hmac.digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex"),
    );
  }

  /**
   * タイムスタンプを生成（e-文書法対応）
   * 実際の運用では、タイムスタンプ局（TSA）のサービスを使用することを推奨
   */
  static generateTimestamp(): {
    timestamp: string;
    timestampHash: string;
    source: string;
  } {
    const timestamp = new Date().toISOString();
    const timestampHash = this.calculateHash(timestamp);

    return {
      timestamp,
      timestampHash,
      source: "SYSTEM", // 本番環境では 'TSA' などに変更
    };
  }
}
