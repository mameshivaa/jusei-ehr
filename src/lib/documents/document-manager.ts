import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

/**
 * スキャン文書管理（ガイドライン準拠：スキャナ保存・電子化）
 */

const DOCUMENTS_DIR = path.join(process.cwd(), "data", "documents");

// 許可されるMIMEタイプ
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/tiff",
];

// 最大ファイルサイズ（20MB）
const MAX_FILE_SIZE = 20 * 1024 * 1024;

// 推奨解像度（DPI）
const RECOMMENDED_MIN_DPI = 200;

export type DocumentType =
  | "CONSENT"
  | "REFERRAL"
  | "INSURANCE"
  | "MEDICAL"
  | "OTHER";

/**
 * 取り込み方法の種類（厚労省ガイドライン準拠）
 *
 * 医療情報システムの安全管理に関するガイドラインに基づき、
 * 紙の診療録等を電子化する際の取り込み方法を区別して記録する。
 *
 * @value IMMEDIATE_SCAN - 都度スキャン
 *   診療時または診療直後に、診療現場で即座にスキャンする方式。
 *   原本との突合が容易で、真正性の確保に最も適している。
 *   ガイドラインで推奨される方式。
 *
 * @value BATCH_DIGITIZE - 一括電子化
 *   過去の紙カルテ等を、まとめて後日電子化する方式。
 *   大量の文書を効率的に電子化できるが、
 *   原本照合（verifiedAt/verifiedBy）の記録が重要。
 *
 * @value CONVENIENCE - 外部電子化サービス
 *   コンビニスキャン等、外部サービスを利用した電子化。
 *   患者が持参したスキャンデータ等が該当。
 *   参考資料（isReference=true）として扱うことが多い。
 */
export type SourceType = "IMMEDIATE_SCAN" | "BATCH_DIGITIZE" | "CONVENIENCE";

/**
 * SourceType定数（コード内での参照用）
 */
export const SOURCE_TYPES = {
  /** 都度スキャン: 診療時に即座にスキャン */
  IMMEDIATE_SCAN: "IMMEDIATE_SCAN" as const,
  /** 一括電子化: 過去文書の一括スキャン */
  BATCH_DIGITIZE: "BATCH_DIGITIZE" as const,
  /** 外部サービス: コンビニスキャン等 */
  CONVENIENCE: "CONVENIENCE" as const,
};

export interface DocumentUploadInput {
  patientId: string;
  documentType: DocumentType;
  title?: string;
  description?: string;
  originalExists?: boolean;
  isReference?: boolean;
  originalDate?: Date;
  resolution?: number;
  colorMode?: "COLOR" | "GRAYSCALE" | "MONOCHROME";
  compressionType?: "NONE" | "LOSSLESS" | "LOSSY";
  metadata?: Record<string, unknown>;
  // 取り込み方法（ガイドライン準拠）
  sourceType?: SourceType;
}

/**
 * ドキュメントディレクトリを確保
 */
async function ensureDocumentsDir(): Promise<void> {
  try {
    await fs.access(DOCUMENTS_DIR);
  } catch {
    await fs.mkdir(DOCUMENTS_DIR, { recursive: true });
  }
}

/**
 * ファイルのハッシュを計算（SHA-256）
 */
function calculateFileHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * ファイル名を安全な形式に変換
 */
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 100);
}

/**
 * ユニークなファイルパスを生成
 */
function generateFilePath(patientId: string, fileName: string): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString("hex");
  const sanitizedName = sanitizeFileName(fileName);
  return path.join(patientId, `${timestamp}-${random}-${sanitizedName}`);
}

/**
 * MIMEタイプを検証
 */
export function validateMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

/**
 * ファイルサイズを検証
 */
export function validateFileSize(size: number): boolean {
  return size <= MAX_FILE_SIZE;
}

/**
 * 解像度の警告をチェック
 */
export function checkResolutionWarning(dpi: number | undefined): string | null {
  if (!dpi) return null;
  if (dpi < RECOMMENDED_MIN_DPI) {
    return `解像度が推奨値（${RECOMMENDED_MIN_DPI}DPI）を下回っています。画質が低下する可能性があります。`;
  }
  return null;
}

/**
 * スキャン文書をアップロード
 */
export async function uploadDocument(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  input: DocumentUploadInput,
  uploadedBy: string,
): Promise<{
  success: boolean;
  documentId?: string;
  warning?: string;
  error?: string;
}> {
  try {
    // バリデーション
    if (!validateMimeType(mimeType)) {
      return {
        success: false,
        error: `許可されていないファイル形式です。許可形式: ${ALLOWED_MIME_TYPES.join(", ")}`,
      };
    }

    if (!validateFileSize(fileBuffer.length)) {
      return {
        success: false,
        error: `ファイルサイズが上限（${MAX_FILE_SIZE / 1024 / 1024}MB）を超えています`,
      };
    }

    // 患者の存在確認
    const patient = await prisma.patient.findUnique({
      where: { id: input.patientId, isDeleted: false },
    });

    if (!patient) {
      return { success: false, error: "患者が見つかりません" };
    }

    await ensureDocumentsDir();

    // ファイルを保存
    const relativePath = generateFilePath(input.patientId, fileName);
    const absolutePath = path.join(DOCUMENTS_DIR, relativePath);

    // 患者ディレクトリを作成
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });

    // ファイルを保存
    await fs.writeFile(absolutePath, fileBuffer);

    // ハッシュを計算
    const fileHash = calculateFileHash(fileBuffer);

    // 解像度の警告をチェック
    const resolutionWarning = checkResolutionWarning(input.resolution);

    // データベースに保存
    const document = await prisma.scannedDocument.create({
      data: {
        patientId: input.patientId,
        documentType: input.documentType,
        title: input.title || null,
        description: input.description || null,
        originalExists: input.originalExists ?? true,
        isReference: input.isReference ?? false,
        originalDate: input.originalDate || null,
        sourceType: input.sourceType || "IMMEDIATE_SCAN",
        scannedBy: uploadedBy,
        fileName,
        filePath: relativePath,
        fileSize: fileBuffer.length,
        mimeType,
        fileHash,
        resolution: input.resolution || null,
        colorMode: input.colorMode || null,
        compressionType: input.compressionType || null,
        metadata: input.metadata ? (input.metadata as any) : null,
      },
    });

    // 監査ログを記録
    await createAuditLog({
      userId: uploadedBy,
      action: "CREATE",
      entityType: "SCANNED_DOCUMENT",
      entityId: document.id,
      category: "DATA_MODIFICATION",
      severity: "INFO",
      metadata: {
        patientId: input.patientId,
        documentType: input.documentType,
        fileName,
        fileSize: fileBuffer.length,
      },
    });

    return {
      success: true,
      documentId: document.id,
      warning: resolutionWarning || undefined,
    };
  } catch (error) {
    console.error("Document upload error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "文書のアップロードに失敗しました",
    };
  }
}

/**
 * スキャン文書を取得
 */
export async function getDocument(documentId: string): Promise<{
  document: any;
  fileBuffer?: Buffer;
} | null> {
  const document = await prisma.scannedDocument.findUnique({
    where: { id: documentId, isDeleted: false },
    include: {
      patient: {
        select: { id: true, name: true, patientNumber: true },
      },
      scannedByUser: {
        select: { id: true, name: true },
      },
    },
  });

  if (!document) {
    return null;
  }

  try {
    const absolutePath = path.join(DOCUMENTS_DIR, document.filePath);
    const fileBuffer = await fs.readFile(absolutePath);

    // ハッシュを検証
    const currentHash = calculateFileHash(fileBuffer);
    if (currentHash !== document.fileHash) {
      console.error("Document hash mismatch:", documentId);
      // ハッシュが一致しない場合も返すが、警告をログに残す
    }

    return { document, fileBuffer };
  } catch (error) {
    console.error("Document read error:", error);
    return { document };
  }
}

/**
 * 患者の文書一覧を取得
 */
export async function listPatientDocuments(
  patientId: string,
  options?: {
    documentType?: DocumentType;
    includeDeleted?: boolean;
  },
): Promise<any[]> {
  return prisma.scannedDocument.findMany({
    where: {
      patientId,
      ...(options?.documentType && { documentType: options.documentType }),
      ...(options?.includeDeleted ? {} : { isDeleted: false }),
    },
    include: {
      scannedByUser: {
        select: { id: true, name: true },
      },
    },
    orderBy: { scannedAt: "desc" },
  });
}

/**
 * 文書を論理削除
 */
export async function deleteDocument(
  documentId: string,
  deletedBy: string,
  reason?: string,
): Promise<boolean> {
  const document = await prisma.scannedDocument.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    return false;
  }

  await prisma.scannedDocument.update({
    where: { id: documentId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  });

  await createAuditLog({
    userId: deletedBy,
    action: "DELETE",
    entityType: "SCANNED_DOCUMENT",
    entityId: documentId,
    category: "DATA_MODIFICATION",
    severity: "WARNING",
    metadata: {
      patientId: document.patientId,
      documentType: document.documentType,
      fileName: document.fileName,
      reason,
    },
  });

  return true;
}

/**
 * 未スキャン文書のアラート用：最近の来院で文書がない患者を取得
 */
export async function getPatientsWithoutRecentDocuments(
  daysSinceVisit: number = 7,
): Promise<any[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysSinceVisit);

  const patientsWithRecentVisits = await prisma.patient.findMany({
    where: {
      isDeleted: false,
      visits: {
        some: {
          visitDate: { gte: cutoffDate },
        },
      },
    },
    include: {
      visits: {
        where: { visitDate: { gte: cutoffDate } },
        orderBy: { visitDate: "desc" },
        take: 1,
      },
      scannedDocuments: {
        where: {
          isDeleted: false,
          scannedAt: { gte: cutoffDate },
        },
      },
    },
  });

  // 文書がない患者をフィルタ
  return patientsWithRecentVisits.filter(
    (p) => p.scannedDocuments.length === 0,
  );
}

/**
 * 文書タイプの表示名を取得
 */
export function getDocumentTypeLabel(type: DocumentType): string {
  const labels: Record<DocumentType, string> = {
    CONSENT: "同意書",
    REFERRAL: "紹介状",
    INSURANCE: "保険証",
    MEDICAL: "診断書・医療文書",
    OTHER: "その他",
  };
  return labels[type] || type;
}

/**
 * 利用可能な文書タイプ一覧を取得
 */
export function getAvailableDocumentTypes(): Array<{
  value: DocumentType;
  label: string;
}> {
  return [
    { value: "CONSENT", label: "同意書" },
    { value: "REFERRAL", label: "紹介状" },
    { value: "INSURANCE", label: "保険証" },
    { value: "MEDICAL", label: "診断書・医療文書" },
    { value: "OTHER", label: "その他" },
  ];
}

/**
 * 取り込み方法の種類一覧を取得
 */
export function getAvailableSourceTypes(): Array<{
  value: SourceType;
  label: string;
  description: string;
  isPreferred: boolean;
}> {
  return [
    {
      value: "IMMEDIATE_SCAN",
      label: "即時スキャン",
      description: "診療時に現場で即座にスキャン（推奨）",
      isPreferred: true,
    },
    {
      value: "BATCH_DIGITIZE",
      label: "一括電子化",
      description: "過去文書のまとめてスキャン（原本照合必須）",
      isPreferred: false,
    },
    {
      value: "CONVENIENCE",
      label: "外部電子化サービス",
      description: "コンビニスキャン等（参考資料扱い推奨）",
      isPreferred: false,
    },
  ];
}

/**
 * 文書を原本照合済みとしてマーク（ガイドライン準拠）
 */
export async function verifyDocument(
  documentId: string,
  verifiedBy: string,
  note?: string,
): Promise<boolean> {
  const document = await prisma.scannedDocument.findUnique({
    where: { id: documentId, isDeleted: false },
  });

  if (!document) {
    return false;
  }

  await prisma.scannedDocument.update({
    where: { id: documentId },
    data: {
      verifiedAt: new Date(),
      verifiedBy,
      verificationNote: note || null,
    },
  });

  await createAuditLog({
    userId: verifiedBy,
    action: "VERIFY",
    entityType: "SCANNED_DOCUMENT",
    entityId: documentId,
    category: "DATA_MODIFICATION",
    severity: "INFO",
    metadata: {
      patientId: document.patientId,
      documentType: document.documentType,
      fileName: document.fileName,
      note,
    },
  });

  return true;
}

/**
 * 未照合の文書一覧を取得
 */
export async function getUnverifiedDocuments(options?: {
  sourceType?: SourceType;
  limit?: number;
}): Promise<any[]> {
  return prisma.scannedDocument.findMany({
    where: {
      isDeleted: false,
      verifiedAt: null,
      originalExists: true, // 原本が存在する場合のみ
      ...(options?.sourceType && { sourceType: options.sourceType }),
    },
    include: {
      patient: {
        select: { id: true, name: true, patientNumber: true },
      },
      scannedByUser: {
        select: { id: true, name: true },
      },
    },
    orderBy: { scannedAt: "asc" },
    take: options?.limit || 100,
  });
}
