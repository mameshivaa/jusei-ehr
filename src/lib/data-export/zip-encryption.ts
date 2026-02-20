/**
 * ZIP暗号化ユーティリティ
 * エクスポートファイルをパスワード付きZIPで暗号化
 *
 * 実装方針:
 * 1. archiverでZIPファイルを作成
 * 2. パスワードからAES-256-GCM鍵を導出
 * 3. ZIPファイルをAES-256-GCMで暗号化
 * 4. 暗号化されたZIPファイルを返す
 */

import archiver from "archiver";
import crypto from "crypto";
import { Readable } from "stream";
import yauzl from "yauzl";

export interface ZipFile {
  filename: string;
  content: string | Buffer;
}

/**
 * パスワードから暗号化鍵を導出（PBKDF2）
 */
function deriveKeyFromPassword(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");
}

/**
 * ZIPファイルをAES-256-GCMで暗号化
 */
function encryptZipBuffer(zipBuffer: Buffer, password: string): Buffer {
  const salt = crypto.randomBytes(16);
  const key = deriveKeyFromPassword(password, salt);
  const iv = crypto.randomBytes(12); // GCM推奨IVサイズ（96ビット）

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(zipBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // 形式: salt(16) + iv(12) + authTag(16) + encrypted
  return Buffer.concat([salt, iv, authTag, encrypted]);
}

/**
 * AES-256-GCMで暗号化されたZIPバッファを復号
 */
export function decryptZipBuffer(
  encryptedBuffer: Buffer,
  password: string,
): Buffer {
  if (!password || password.length < 8) {
    throw new Error("パスワードは8文字以上である必要があります");
  }
  if (encryptedBuffer.length < 44) {
    throw new Error("暗号化バッファが不正です");
  }
  const salt = encryptedBuffer.subarray(0, 16);
  const iv = encryptedBuffer.subarray(16, 28);
  const authTag = encryptedBuffer.subarray(28, 44);
  const encrypted = encryptedBuffer.subarray(44);

  const key = deriveKeyFromPassword(password, salt);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function readEntryBuffer(entry: yauzl.Entry, zipfile: yauzl.ZipFile) {
  return new Promise<Buffer>((resolve, reject) => {
    zipfile.openReadStream(entry, (err, stream) => {
      if (err || !stream) {
        reject(err ?? new Error("Failed to open zip entry"));
        return;
      }
      const chunks: Buffer[] = [];
      stream.on("data", (chunk) => chunks.push(chunk as Buffer));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });
  });
}

/**
 * パスワード付きZIPを復号して内容を取り出す
 */
export async function extractPasswordProtectedZip(
  encryptedBuffer: Buffer,
  password: string,
): Promise<ZipFile[]> {
  const zipBuffer = decryptZipBuffer(encryptedBuffer, password);

  return new Promise<ZipFile[]>((resolve, reject) => {
    yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error("Failed to open zip buffer"));
        return;
      }

      const files: ZipFile[] = [];
      zipfile.readEntry();

      zipfile.on("entry", (entry) => {
        if (/\/$/.test(entry.fileName)) {
          zipfile.readEntry();
          return;
        }
        readEntryBuffer(entry, zipfile)
          .then((content) => {
            files.push({ filename: entry.fileName, content });
            zipfile.readEntry();
          })
          .catch((entryError) => {
            zipfile.close();
            reject(entryError);
          });
      });

      zipfile.on("end", () => resolve(files));
      zipfile.on("error", reject);
    });
  });
}

/**
 * パスワード付きZIPファイルを作成
 * @param files エクスポートするファイルのリスト
 * @param password ZIPパスワード（8文字以上）
 * @returns 暗号化されたZIPファイルのBuffer
 */
export async function createPasswordProtectedZip(
  files: ZipFile[],
  password: string,
): Promise<Buffer> {
  if (!password || password.length < 8) {
    throw new Error("パスワードは8文字以上である必要があります");
  }

  // archiverでZIPファイルを作成
  const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver("zip", {
      zlib: { level: 9 }, // 最高圧縮率
    });

    archive.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    archive.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    archive.on("error", (error: Error) => {
      reject(error);
    });

    // 各ファイルをZIPに追加
    for (const file of files) {
      const content =
        typeof file.content === "string"
          ? Buffer.from(file.content, "utf-8")
          : file.content;
      archive.append(content, { name: file.filename });
    }

    archive.finalize();
  });

  // ZIPファイルをAES-256-GCMで暗号化
  return encryptZipBuffer(zipBuffer, password);
}

/**
 * パスワード付きZIPファイルを作成（エイリアス）
 */
export async function createEncryptedZip(
  files: ZipFile[],
  password: string,
): Promise<Buffer> {
  return createPasswordProtectedZip(files, password);
}
