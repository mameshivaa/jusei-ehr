/**
 * 拡張マーケットプレイス - 型定義
 */

// カタログ拡張情報
export interface CatalogExtension {
  id: string;
  name: string;
  version: string;
  publisher: string;
  description: string;
  longDescription?: string;
  icon?: string;
  screenshots?: string[];
  categories: string[];
  pricing: "free" | "paid" | "subscription";
  price?: number;
  monthlyPrice?: number;
  minAppVersion: string;
  downloads: number;
  rating?: number;
  // セキュリティ情報（サーバーから取得）
  packageHash: string; // SHA-256 of ZIP
  signature: string; // Ed25519 signature of packageHash
  createdAt: string;
  updatedAt: string;
}

// ライセンスキャッシュ（ローカル保存用）
export interface LicenseCache {
  extensionId: string;
  clinicId: string;
  type: "free" | "purchased" | "subscription";
  status: "valid" | "expired" | "grace_period";
  lastVerifiedAt: string;
  expiresAt?: string;
}

// インストール結果
export interface InstallResult {
  success: boolean;
  extensionId: string;
  version: string;
  error?: string;
  rollbackPerformed?: boolean;
}

// インストール失敗の段階
export type InstallFailureStage =
  | "download"
  | "signature_verification"
  | "hash_verification"
  | "extraction"
  | "manifest_validation"
  | "registration";

// Marketplace API responses
export type LicenseVerificationResponse = {
  valid: boolean;
  type: "free" | "purchased" | "subscription";
  expiresAt?: string;
};
