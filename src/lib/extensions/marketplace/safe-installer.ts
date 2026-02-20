import "server-only";
import path from "node:path";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import yauzl from "yauzl";
import { verifyPackageIntegrity } from "./signature";
import { parseManifest } from "../manifest";
import type { InstallFailureStage, InstallResult } from "./types";

const EXTENSIONS_DIR = path.join(process.cwd(), "extensions");
const TEMP_DIR = path.join(EXTENSIONS_DIR, ".tmp");
const BACKUP_SUFFIX = ".backup";

export async function safeInstall(
  packageBuffer: Buffer,
  catalogInfo: { packageHash: string; signature: string },
  userId: string,
): Promise<InstallResult> {
  let tempDir: string | null = null;
  let backupDir: string | null = null;
  let extensionId: string | null = null;
  let stage: InstallFailureStage = "download";

  try {
    // ================================
    // Stage 1: 署名・ハッシュ検証
    // ================================
    stage = "signature_verification";
    const verification = verifyPackageIntegrity(
      packageBuffer,
      catalogInfo.packageHash,
      catalogInfo.signature,
    );
    if (!verification.valid) {
      throw new Error(verification.error);
    }
    stage = "hash_verification";

    // ================================
    // Stage 2: 一時ディレクトリに展開
    // ================================
    stage = "extraction";
    tempDir = path.join(TEMP_DIR, `install-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // ZIP展開（zip-slip防止付き）
    await extractZipSafe(packageBuffer, tempDir);

    // ================================
    // Stage 3: manifest.json検証
    // ================================
    stage = "manifest_validation";
    const manifestPath = path.join(tempDir, "manifest.json");
    const manifestContent = await fs.readFile(manifestPath, "utf-8");
    const manifest = parseManifest(JSON.parse(manifestContent));
    if (!manifest.success || !manifest.manifest) {
      throw new Error(
        `Invalid manifest: ${manifest.errors?.[0]?.message || "unknown"}`,
      );
    }
    extensionId = manifest.manifest.id;

    // ================================
    // Stage 4: 既存バックアップ作成
    // ================================
    const targetDir = path.join(EXTENSIONS_DIR, extensionId);
    const backupPath = targetDir + BACKUP_SUFFIX;

    if (await exists(targetDir)) {
      backupDir = backupPath;
      await fs.rename(targetDir, backupPath);
    }

    // ================================
    // Stage 5: 原子的に置換
    // ================================
    stage = "registration";
    await fs.rename(tempDir, targetDir);
    tempDir = null; // 成功したのでクリーンアップ対象外

    // ================================
    // Stage 6: バックアップ削除
    // ================================
    if (backupDir) {
      await fs.rm(backupDir, { recursive: true });
      backupDir = null;
    }

    return {
      success: true,
      extensionId,
      version: manifest.manifest.version,
    };
  } catch (error) {
    // ================================
    // ロールバック処理
    // ================================
    let rollbackPerformed = false;

    // 一時ディレクトリ削除
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true }).catch(() => {});
    }

    // バックアップ復元
    if (backupDir && extensionId) {
      const targetDir = path.join(EXTENSIONS_DIR, extensionId);
      await fs.rm(targetDir, { recursive: true }).catch(() => {});
      await fs.rename(backupDir, targetDir).catch(() => {});
      rollbackPerformed = true;
    }

    return {
      success: false,
      extensionId: extensionId || "unknown",
      version: "unknown",
      error: `${stage}: ${error instanceof Error ? error.message : "unknown"}`,
      rollbackPerformed,
    };
  }
}

// zip-slip防止: 全エントリのパスを検証
async function extractZipSafe(buffer: Buffer, destDir: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err || new Error("Failed to open zip"));
        return;
      }

      const handleError = (error: Error) => {
        zipfile.close();
        reject(error);
      };

      zipfile.readEntry();
      zipfile.on("entry", (entry) => {
        const normalized = entry.fileName.replace(/\\/g, "/");

        if (path.isAbsolute(normalized) || !isSafePath(destDir, normalized)) {
          handleError(new Error(`Unsafe path in zip: ${entry.fileName}`));
          return;
        }

        const targetPath = path.resolve(destDir, normalized);

        if (entry.fileName.endsWith("/")) {
          fs.mkdir(targetPath, { recursive: true })
            .then(() => zipfile.readEntry())
            .catch(handleError);
          return;
        }

        fs.mkdir(path.dirname(targetPath), { recursive: true })
          .then(() => {
            zipfile.openReadStream(entry, (streamErr, readStream) => {
              if (streamErr || !readStream) {
                handleError(streamErr || new Error("Failed to read zip entry"));
                return;
              }
              pipeline(readStream, createWriteStream(targetPath))
                .then(() => zipfile.readEntry())
                .catch(handleError);
            });
          })
          .catch(handleError);
      });

      zipfile.on("end", () => {
        zipfile.close();
        resolve();
      });
      zipfile.on("error", handleError);
    });
  });
}

function isSafePath(basePath: string, targetPath: string): boolean {
  // バックスラッシュをスラッシュに正規化（Windows対応）
  const normalizedTarget = targetPath.replace(/\\/g, "/");

  // Windowsドライブレター（C: など）を拒否
  if (/^[a-zA-Z]:/.test(normalizedTarget)) {
    return false;
  }

  const resolvedBase = path.resolve(basePath);
  const resolvedTarget = path.resolve(basePath, normalizedTarget);
  return resolvedTarget.startsWith(resolvedBase + path.sep);
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}
