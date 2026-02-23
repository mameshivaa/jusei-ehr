import fs from "fs/promises";
import { constants as fsConstants } from "fs";
import path from "path";
import { PersonalInfoEncryption } from "@/lib/security/encryption";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import os from "os";
import {
  createPasswordProtectedZip,
  extractPasswordProtectedZip,
} from "@/lib/data-export/zip-encryption";
import { getSetting, setSetting } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { getDefaultBackupDirectory } from "@/lib/backup/default-backup-dir";
import { getBackupSecret } from "@/lib/backup/backup-secret";
import { detectBackupLocation } from "@/lib/backup/location-detector";
import { normalizeBackupFileName } from "@/lib/backup/backup-file-name";

const DEFAULT_BACKUP_DIR = getDefaultBackupDirectory();
const DEFAULT_BACKUP_COOLDOWN_HOURS = 12;
const execFileAsync = promisify(execFile);
let betterSqlite3LoadError: string | null = null;
const LEGACY_RELATIVE_BACKUP_DIRS = ["backups"];

function resolveLegacyDefaultBackupDirs(): string[] {
  const platform = process.platform;
  const homeDir = os.homedir();
  if (platform === "darwin") {
    return [
      path.join(homeDir, "Library", "Application Support", "v-oss", "backups"),
    ];
  }
  if (platform === "win32") {
    const appData =
      process.env.APPDATA || path.join(homeDir, "AppData", "Roaming");
    return [path.join(appData, "v-oss", "backups")];
  }
  const xdg =
    process.env.XDG_DATA_HOME || path.join(homeDir, ".local", "share");
  return [path.join(xdg, "V-OSS", "backups")];
}

async function isDirectoryPath(targetPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

function isBackupFileName(fileName: string): boolean {
  return Boolean(normalizeBackupFileName(fileName));
}

async function resolveLegacyBackupDirs(targetDir: string): Promise<string[]> {
  const resolvedTarget = path.resolve(targetDir);
  const candidates = new Set<string>();

  const addCandidate = (dir: string | null | undefined) => {
    if (!dir) return;
    candidates.add(path.resolve(dir));
  };

  addCandidate(DEFAULT_BACKUP_DIR);
  for (const relativeDir of LEGACY_RELATIVE_BACKUP_DIRS) {
    addCandidate(path.join(process.cwd(), relativeDir));
  }
  for (const legacyDir of resolveLegacyDefaultBackupDirs()) {
    addCandidate(legacyDir);
  }

  try {
    const externalLocation = await detectBackupLocation();
    if (externalLocation.source === "external") {
      addCandidate(externalLocation.directory);
    }
  } catch {
    // ignore external detection errors
  }

  const results: string[] = [];
  for (const candidate of candidates) {
    if (candidate === resolvedTarget) continue;
    if (await isDirectoryPath(candidate)) {
      results.push(candidate);
    }
  }
  return results;
}

async function importLegacyBackups(
  targetDir: string,
): Promise<{ imported: number }> {
  const legacyDirs = await resolveLegacyBackupDirs(targetDir);
  if (legacyDirs.length === 0) return { imported: 0 };

  let imported = 0;
  for (const legacyDir of legacyDirs) {
    let entries: string[] = [];
    try {
      entries = await fs.readdir(legacyDir);
    } catch (error) {
      console.warn(
        "[BackupImport] Failed to read legacy backup directory:",
        legacyDir,
        error,
      );
      continue;
    }

    for (const entry of entries) {
      if (!isBackupFileName(entry)) continue;
      const sourcePath = path.join(legacyDir, entry);
      const targetPath = path.join(targetDir, entry);

      if (await fileExists(targetPath)) continue;
      try {
        await fs.copyFile(sourcePath, targetPath, fsConstants.COPYFILE_EXCL);
        imported += 1;
      } catch (error) {
        const errCode = (error as NodeJS.ErrnoException | undefined)?.code;
        if (errCode === "EEXIST") {
          continue;
        }
        console.warn(
          "[BackupImport] Failed to copy legacy backup:",
          sourcePath,
          error,
        );
        continue;
      }

      const sourceMetadata = sourcePath + ".metadata.json";
      const targetMetadata = targetPath + ".metadata.json";
      if (
        !(await fileExists(targetMetadata)) &&
        (await fileExists(sourceMetadata))
      ) {
        try {
          await fs.copyFile(
            sourceMetadata,
            targetMetadata,
            fsConstants.COPYFILE_EXCL,
          );
        } catch (error) {
          const errCode = (error as NodeJS.ErrnoException | undefined)?.code;
          if (errCode !== "EEXIST") {
            console.warn(
              "[BackupImport] Failed to copy legacy metadata:",
              sourceMetadata,
              error,
            );
          }
        }
      }
    }
  }

  if (imported > 0) {
    console.log("[BackupImport] Imported", imported, "legacy backups.");
  }

  return { imported };
}

export async function importLegacyBackupsToCurrentDir(): Promise<{
  success: boolean;
  imported: number;
  error?: string;
}> {
  try {
    const backupDir = await ensureBackupDir();
    const result = await importLegacyBackups(backupDir);
    return { success: true, imported: result.imported };
  } catch (error) {
    console.error("Legacy backup import error:", error);
    return {
      success: false,
      imported: 0,
      error:
        error instanceof Error
          ? error.message
          : "過去バックアップの取り込みに失敗しました",
    };
  }
}

function recordBetterSqlite3Failure(error: unknown) {
  if (!betterSqlite3LoadError) {
    betterSqlite3LoadError =
      error instanceof Error ? error.message : "unknown error";
    console.warn(
      "[Backup] better-sqlite3 unavailable, falling back to sqlite3 CLI:",
      betterSqlite3LoadError,
    );
  }
}

function loadBetterSqlite3(): any | null {
  try {
    return require("better-sqlite3");
  } catch (error) {
    recordBetterSqlite3Failure(error);
    return null;
  }
}

function escapeSqliteString(value: string): string {
  return value.replace(/'/g, "''");
}

async function runSqliteCommand(
  dbPath: string,
  command: string,
): Promise<string> {
  try {
    const result = await execFileAsync("sqlite3", [dbPath, command], {
      maxBuffer: 1024 * 1024,
    });
    return result.stdout ?? "";
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
      throw new Error(
        "sqlite3 コマンドが見つかりません。better-sqlite3 を再ビルドするか sqlite3 をインストールしてください。",
      );
    }
    throw new Error(
      error instanceof Error
        ? error.message
        : "sqlite3 コマンドの実行に失敗しました",
    );
  }
}

async function backupWithSqliteCli(
  dbPath: string,
  backupPath: string,
): Promise<void> {
  const escapedPath = escapeSqliteString(backupPath);
  await runSqliteCommand(dbPath, `.backup '${escapedPath}'`);
}

/**
 * バックアップディレクトリを確保
 */
async function resolveBackupDir(): Promise<string> {
  const configured = await getSetting("backupDirectory");
  if (!configured) {
    return DEFAULT_BACKUP_DIR;
  }
  return path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured);
}

async function ensureBackupDir(): Promise<string> {
  const resolvedDir = await resolveBackupDir();
  try {
    await fs.access(resolvedDir);
    return resolvedDir;
  } catch (error) {
    try {
      await fs.mkdir(resolvedDir, { recursive: true });
      return resolvedDir;
    } catch {
      if (resolvedDir !== DEFAULT_BACKUP_DIR) {
        await fs.mkdir(DEFAULT_BACKUP_DIR, { recursive: true });
        return DEFAULT_BACKUP_DIR;
      }
      throw error;
    }
  }
}

type BackupLocationStatus = {
  preferredSource: "external" | "default" | "custom";
  activeSource: "external" | "default" | "custom";
  directory: string;
  externalAvailable: boolean;
  customAvailable: boolean;
  fallbackUsed: boolean;
};

export type BackupMissingStatus = {
  required: boolean;
  isMissing: boolean;
  missingSince: string | null;
  daysMissing: number;
  alertAfterDays: number;
};

function normalizeBackupSource(
  value: string,
): "external" | "default" | "custom" {
  if (value === "external" || value === "custom") return value;
  return "default";
}

async function ensureBackupDirForPath(
  preferredDir: string,
): Promise<{ directory: string; usedFallback: boolean }> {
  try {
    await fs.access(preferredDir);
    return { directory: preferredDir, usedFallback: false };
  } catch (error) {
    try {
      await fs.mkdir(preferredDir, { recursive: true });
      return { directory: preferredDir, usedFallback: false };
    } catch {
      if (preferredDir !== DEFAULT_BACKUP_DIR) {
        await fs.mkdir(DEFAULT_BACKUP_DIR, { recursive: true });
        return { directory: DEFAULT_BACKUP_DIR, usedFallback: true };
      }
      throw error;
    }
  }
}

async function resolveBackupDirWithStatus(): Promise<BackupLocationStatus> {
  const preferredSource = normalizeBackupSource(
    await getSetting("backupDirectorySource"),
  );
  const configured = await resolveBackupDir();
  let activeSource: BackupLocationStatus["activeSource"] = preferredSource;
  let directory = configured;
  let externalAvailable = false;
  let customAvailable = true;
  let fallbackUsed = false;

  if (preferredSource === "external") {
    const detected = await detectBackupLocation();
    if (detected.source === "external") {
      externalAvailable = true;
      directory = detected.directory;
      activeSource = "external";
    } else {
      externalAvailable = false;
      fallbackUsed = true;
      directory = configured || DEFAULT_BACKUP_DIR;
      activeSource = directory === DEFAULT_BACKUP_DIR ? "default" : "custom";
    }
  } else if (preferredSource === "default") {
    activeSource = "default";
  } else {
    activeSource = "custom";
    try {
      await fs.access(directory);
      customAvailable = true;
    } catch {
      customAvailable = false;
      fallbackUsed = true;
      directory = DEFAULT_BACKUP_DIR;
      activeSource = "default";
    }
  }

  const ensured = await ensureBackupDirForPath(directory);
  if (ensured.usedFallback) {
    fallbackUsed = true;
    directory = ensured.directory;
    activeSource = "default";
  } else {
    directory = ensured.directory;
  }

  return {
    preferredSource,
    activeSource,
    directory,
    externalAvailable,
    customAvailable,
    fallbackUsed,
  };
}

async function recordBackupLocationStatus(
  status: BackupLocationStatus,
): Promise<void> {
  try {
    await setSetting("lastBackupSource", status.activeSource);
    if (status.activeSource === "external") {
      await setSetting("lastExternalBackupAt", new Date().toISOString());
    }
    if (status.activeSource === "custom") {
      await setSetting("lastCustomBackupAt", new Date().toISOString());
    }
    if (status.preferredSource === "external") {
      if (status.externalAvailable) {
        await setSetting("externalBackupMissingAt", "");
      } else {
        const existingMissingAt = await getSetting("externalBackupMissingAt");
        if (!existingMissingAt) {
          await setSetting("externalBackupMissingAt", new Date().toISOString());
        }
      }
    }
    if (status.preferredSource === "custom") {
      if (status.customAvailable) {
        await setSetting("customBackupMissingAt", "");
      } else {
        const existingMissingAt = await getSetting("customBackupMissingAt");
        if (!existingMissingAt) {
          await setSetting("customBackupMissingAt", new Date().toISOString());
        }
      }
    }
  } catch (error) {
    console.warn("[Backup] Failed to update backup location status:", error);
  }
}

/**
 * バックアップディレクトリを確保（外部から呼び出し可能）
 * セットアップ完了時などに使用
 */
export async function ensureBackupDirectory(): Promise<string> {
  return ensureBackupDir();
}

/**
 * 最終バックアップ時刻を更新
 */
export async function updateLastBackupAt(): Promise<void> {
  await setSetting("lastBackupAt", new Date().toISOString());
}

async function recordLastBackupAt(): Promise<void> {
  try {
    await updateLastBackupAt();
  } catch (error) {
    console.warn("[Backup] Failed to update lastBackupAt:", error);
  }
}

/**
 * クールダウン判定
 */
export async function shouldRunBackup(
  cooldownHours: number = DEFAULT_BACKUP_COOLDOWN_HOURS,
): Promise<boolean> {
  const lastBackupAt = await getSetting("lastBackupAt");
  if (!lastBackupAt) return true;

  const lastTime = Date.parse(lastBackupAt);
  if (Number.isNaN(lastTime)) return true;

  const elapsedMs = Date.now() - lastTime;
  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  return elapsedMs >= cooldownMs;
}

/**
 * データベースファイルのパスを取得
 */
function getDatabasePath(): string {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  // file:./prisma/prisma/dev.db または file:/abs/path の形式からパスを抽出
  if (dbUrl.startsWith("file:")) {
    try {
      const fileUrl = new URL(dbUrl);
      if (fileUrl.pathname) {
        return fileUrl.pathname;
      }
    } catch {
      // fall through to legacy parsing
    }
  }

  const filePath = dbUrl.replace(/^file:/, "").replace(/^\.\//, "");
  return path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);
}

/**
 * バックアップファイル名を生成
 */
function generateBackupFileName(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `backup-${timestamp}.db`;
}

async function createConsistentDatabaseCopy(
  dbPath: string,
  backupPath: string,
): Promise<void> {
  const Database = loadBetterSqlite3();
  if (Database) {
    try {
      const db = new Database(dbPath, { readonly: true });
      try {
        await db.backup(backupPath);
        return;
      } finally {
        db.close();
      }
    } catch (error) {
      recordBetterSqlite3Failure(error);
    }
  }

  try {
    await backupWithSqliteCli(dbPath, backupPath);
  } catch (error) {
    const baseMessage =
      "データベースのバックアップに失敗しました。better-sqlite3 が利用できない可能性があります。";
    const details =
      error instanceof Error ? error.message : "unknown backup error";
    throw new Error(
      betterSqlite3LoadError
        ? `${baseMessage}\n原因: ${betterSqlite3LoadError}\n詳細: ${details}`
        : `${baseMessage}\n詳細: ${details}`,
    );
  }
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function verifyDatabaseIntegrity(databasePath: string): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const Database = loadBetterSqlite3();
  if (Database) {
    try {
      const db = new Database(databasePath, {
        readonly: true,
        fileMustExist: true,
      });
      try {
        const rows = db.prepare("PRAGMA integrity_check;").all() as Array<{
          integrity_check?: string;
        }>;
        if (!rows.length) {
          return {
            ok: false,
            reason: "整合性チェック結果を取得できませんでした",
          };
        }

        const messages = rows
          .map((row) =>
            typeof row.integrity_check === "string" ? row.integrity_check : "",
          )
          .filter((value) => value.length > 0);

        if (!messages.length) {
          return { ok: false, reason: "整合性チェック結果が空です" };
        }
        if (messages.every((value) => value === "ok")) {
          return { ok: true };
        }
        return { ok: false, reason: messages.join(", ") };
      } finally {
        db.close();
      }
    } catch (error) {
      recordBetterSqlite3Failure(error);
      // fallback below
    }
  }

  try {
    const output = await runSqliteCommand(
      databasePath,
      "PRAGMA integrity_check;",
    );
    const messages = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (!messages.length) {
      return { ok: false, reason: "整合性チェック結果を取得できませんでした" };
    }
    if (messages.every((value) => value === "ok")) {
      return { ok: true };
    }
    return { ok: false, reason: messages.join(", ") };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error
          ? error.message
          : "整合性チェックの実行に失敗しました",
    };
  }
}

/**
 * バックアップを作成
 */
export async function createBackup(description?: string): Promise<{
  success: boolean;
  backupPath?: string;
  error?: string;
}> {
  try {
    const locationStatus = await resolveBackupDirWithStatus();
    const backupDir = locationStatus.directory;

    const dbPath = getDatabasePath();
    const backupFileName = generateBackupFileName();
    const backupPath = path.join(backupDir, backupFileName);

    // 整合性のあるバックアップを作成
    await createConsistentDatabaseCopy(dbPath, backupPath);

    // メタデータファイルを作成
    const metadata = {
      createdAt: new Date().toISOString(),
      description: description || "",
      databasePath: dbPath,
      fileSize: (await fs.stat(backupPath)).size,
    };
    const metadataPath = backupPath + ".metadata.json";
    await fs.writeFile(
      metadataPath,
      JSON.stringify(metadata, null, 2),
      "utf-8",
    );

    await recordBackupLocationStatus(locationStatus);
    await recordLastBackupAt();

    return {
      success: true,
      backupPath: backupPath,
    };
  } catch (error) {
    console.error("Backup creation error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "バックアップの作成に失敗しました",
    };
  }
}

/**
 * バックアップをパスワード付きZIPで暗号化して作成
 * 常にBACKUP_SECRETを使用
 */
export async function createEncryptedBackup(description?: string): Promise<{
  success: boolean;
  backupPath?: string;
  error?: string;
}> {
  try {
    const locationStatus = await resolveBackupDirWithStatus();
    const backupDir = locationStatus.directory;

    const dbPath = getDatabasePath();

    const effectivePassword = await getBackupSecret();

    // シークレット未設定なら失敗
    if (!effectivePassword || effectivePassword.length < 8) {
      return {
        success: false,
        error:
          "BACKUP_SECRET が未設定のため暗号化バックアップを作成できません。",
      };
    }

    const backupFileName = generateBackupFileName() + ".encrypted.zip";
    const backupPath = path.join(backupDir, backupFileName);
    const tempCopyPath = path.join(
      backupDir,
      `${generateBackupFileName()}.tmp.db`,
    );

    let zipBuffer: Buffer;
    try {
      await createConsistentDatabaseCopy(dbPath, tempCopyPath);
      const dbData = await fs.readFile(tempCopyPath);
      // ZIP暗号化を使用
      zipBuffer = await createPasswordProtectedZip(
        [{ filename: path.basename(dbPath), content: dbData }],
        effectivePassword,
      );
    } finally {
      try {
        await fs.unlink(tempCopyPath);
      } catch {
        // ignore cleanup errors
      }
    }

    // ZIPファイルを保存
    await fs.writeFile(backupPath, zipBuffer);

    // メタデータファイルを作成（パスワードは保存しない）
    const metadata = {
      createdAt: new Date().toISOString(),
      description: description || "",
      databasePath: dbPath,
      fileSize: zipBuffer.length,
      encrypted: true,
      format: "zip",
    };
    const metadataPath = backupPath + ".metadata.json";
    await fs.writeFile(
      metadataPath,
      JSON.stringify(metadata, null, 2),
      "utf-8",
    );

    await recordBackupLocationStatus(locationStatus);
    await recordLastBackupAt();

    return {
      success: true,
      backupPath: backupPath,
    };
  } catch (error) {
    console.error("Encrypted backup creation error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "暗号化バックアップの作成に失敗しました",
    };
  }
}

/**
 * 古いバックアップを削除（最新1つだけ残す）
 */
export async function cleanupOldBackups(): Promise<{
  success: boolean;
  deletedCount: number;
  error?: string;
}> {
  try {
    const result = await listBackups();
    if (!result.success || !result.backups) {
      return { success: false, deletedCount: 0, error: result.error };
    }

    const retentionDaysRaw = await getSetting("backupRetentionDays");
    const retentionCountRaw = await getSetting("backupRetentionCount");
    const retentionDays = Number.parseInt(retentionDaysRaw || "14", 10);
    const retentionCount = Number.parseInt(retentionCountRaw || "5", 10);
    const days = Number.isFinite(retentionDays) ? retentionDays : 14;
    const count = Number.isFinite(retentionCount) ? retentionCount : 5;
    const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;

    const toDelete = new Set<string>();
    const backups = result.backups;

    for (const backup of backups) {
      const createdAt = Date.parse(backup.createdAt);
      if (!Number.isFinite(createdAt) || createdAt < cutoffMs) {
        toDelete.add(backup.fileName);
      }
    }

    const remaining = backups.filter(
      (backup) => !toDelete.has(backup.fileName),
    );
    if (remaining.length > count) {
      for (const backup of remaining.slice(count)) {
        toDelete.add(backup.fileName);
      }
    }

    let deletedCount = 0;
    for (const fileName of toDelete) {
      const deleteResult = await deleteBackup(fileName);
      if (deleteResult.success) {
        deletedCount++;
      }
    }

    return { success: true, deletedCount };
  } catch (error) {
    console.error("Backup cleanup error:", error);
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : "クリーンアップ失敗",
    };
  }
}

export async function getBackupLocationStatus(): Promise<BackupLocationStatus> {
  return resolveBackupDirWithStatus();
}

export async function getBackupMissingStatus(): Promise<BackupMissingStatus> {
  const locationStatus = await resolveBackupDirWithStatus();
  if (locationStatus.preferredSource === "external") {
    const missingAt = await getSetting("externalBackupMissingAt");
    const alertAfterRaw = await getSetting("backupMissingAlertDays");
    const alertAfterDays = Number.parseInt(alertAfterRaw || "3", 10);
    const days = Number.isFinite(alertAfterDays) ? alertAfterDays : 3;
    const missingSince = missingAt || null;
    const daysMissing = missingSince
      ? Math.max(
          0,
          Math.floor((Date.now() - Date.parse(missingSince)) / 86_400_000),
        )
      : 0;
    return {
      required: true,
      isMissing: !locationStatus.externalAvailable,
      missingSince,
      daysMissing,
      alertAfterDays: days,
    };
  }
  if (locationStatus.preferredSource === "custom") {
    const missingAt = await getSetting("customBackupMissingAt");
    const alertAfterRaw = await getSetting("backupMissingAlertDays");
    const alertAfterDays = Number.parseInt(alertAfterRaw || "3", 10);
    const days = Number.isFinite(alertAfterDays) ? alertAfterDays : 3;
    const missingSince = missingAt || null;
    const daysMissing = missingSince
      ? Math.max(
          0,
          Math.floor((Date.now() - Date.parse(missingSince)) / 86_400_000),
        )
      : 0;
    return {
      required: true,
      isMissing: !locationStatus.customAvailable,
      missingSince,
      daysMissing,
      alertAfterDays: days,
    };
  }
  return {
    required: false,
    isMissing: false,
    missingSince: null,
    daysMissing: 0,
    alertAfterDays: 0,
  };
}

/**
 * 自動バックアップを実行（暗号化 + 古いバックアップ削除）
 * 常に最新1つだけ保持
 */
export async function runAutoBackup(): Promise<{
  success: boolean;
  backupPath?: string;
  deletedCount?: number;
  error?: string;
}> {
  console.log("[AutoBackup] Starting automatic backup...");

  // 暗号化バックアップを作成
  const backupResult = await createEncryptedBackup("自動バックアップ");
  if (!backupResult.success) {
    console.error("[AutoBackup] Failed:", backupResult.error);
    return backupResult;
  }

  console.log("[AutoBackup] Backup created:", backupResult.backupPath);

  // 古いバックアップを削除（最新1つだけ残す）
  const cleanupResult = await cleanupOldBackups();

  if (cleanupResult.deletedCount > 0) {
    console.log(
      "[AutoBackup] Cleaned up",
      cleanupResult.deletedCount,
      "old backups",
    );
  }

  return {
    success: true,
    backupPath: backupResult.backupPath,
    deletedCount: cleanupResult.deletedCount,
  };
}

/**
 * クールダウン付き自動バックアップ
 */
export async function runAutoBackupWithCooldown(
  cooldownHours: number = DEFAULT_BACKUP_COOLDOWN_HOURS,
): Promise<{
  success: boolean;
  skipped?: boolean;
  backupPath?: string;
  deletedCount?: number;
  error?: string;
}> {
  const shouldRun = await shouldRunBackup(cooldownHours);
  if (!shouldRun) {
    console.log("[AutoBackup] Skipped due to cooldown");
    return { success: true, skipped: true };
  }

  const firstAttempt = await runAutoBackup();
  if (firstAttempt.success) return firstAttempt;

  console.warn("[AutoBackup] Retry after failure:", firstAttempt.error);
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const retryAttempt = await runAutoBackup();
  if (retryAttempt.success) return retryAttempt;

  return {
    success: false,
    error:
      retryAttempt.error ||
      firstAttempt.error ||
      "自動バックアップに失敗しました",
  };
}

/**
 * バックアップ一覧を取得
 */
export async function listBackups(): Promise<{
  success: boolean;
  backups?: Array<{
    fileName: string;
    filePath: string;
    metadataPath: string;
    createdAt: string;
    description: string;
    fileSize: number;
    encrypted: boolean;
  }>;
  error?: string;
}> {
  try {
    const backupDir = await ensureBackupDir();

    const files = await fs.readdir(backupDir);
    const backups: Array<{
      fileName: string;
      filePath: string;
      metadataPath: string;
      createdAt: string;
      description: string;
      fileSize: number;
      encrypted: boolean;
    }> = [];

    for (const file of files) {
      if (isBackupFileName(file)) {
        const filePath = path.join(backupDir, file);
        const metadataPath = filePath + ".metadata.json";

        try {
          const metadataContent = await fs.readFile(metadataPath, "utf-8");
          const metadata = JSON.parse(metadataContent);
          const fileInfo = await fs.stat(filePath);

          backups.push({
            fileName: file,
            filePath: filePath,
            metadataPath: metadataPath,
            createdAt: metadata.createdAt || fileInfo.birthtime.toISOString(),
            description: metadata.description || "",
            fileSize: fileInfo.size,
            encrypted: metadata.encrypted || false,
          });
        } catch {
          // メタデータがない場合は、ファイル情報のみを使用
          const fileInfo = await fs.stat(filePath);
          backups.push({
            fileName: file,
            filePath: filePath,
            metadataPath: metadataPath,
            createdAt: fileInfo.birthtime.toISOString(),
            description: "",
            fileSize: fileInfo.size,
            encrypted:
              file.endsWith(".encrypted") || file.endsWith(".encrypted.zip"),
          });
        }
      }
    }

    // 作成日時でソート（新しい順）
    backups.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return {
      success: true,
      backups: backups,
    };
  } catch (error) {
    console.error("Backup list error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "バックアップ一覧の取得に失敗しました",
    };
  }
}

/**
 * バックアップを復元
 */
export async function restoreBackup(backupFileName: string): Promise<{
  success: boolean;
  error?: string;
  backupCreatedAt?: string;
}> {
  try {
    const safeFileName = normalizeBackupFileName(backupFileName);
    if (!safeFileName) {
      return {
        success: false,
        error: "不正なバックアップファイル名です",
      };
    }

    const backupDir = await ensureBackupDir();

    const backupPath = path.join(backupDir, safeFileName);
    const dbPath = getDatabasePath();
    console.log("[BackupRestore] Starting restore:", safeFileName);
    let backupCreatedAt: string | undefined;

    // バックアップファイルの存在確認
    try {
      await fs.access(backupPath);
    } catch {
      return {
        success: false,
        error: "バックアップファイルが見つかりません",
      };
    }

    // メタデータ確認（警告のみ）
    const metadataPath = backupPath + ".metadata.json";
    try {
      const metadataContent = await fs.readFile(metadataPath, "utf-8");
      const metadata = JSON.parse(metadataContent);
      if (typeof metadata.createdAt === "string") {
        backupCreatedAt = metadata.createdAt;
      }
      console.log("[BackupRestore] Backup metadata:", {
        createdAt: metadata.createdAt,
        description: metadata.description,
        fileSize: metadata.fileSize,
        encrypted: metadata.encrypted,
      });
    } catch {
      console.warn("[BackupRestore] Metadata file not found or invalid");
    }

    // 現在のデータベースを暗号化バックアップ（安全のため）
    const currentBackup =
      await createEncryptedBackup("復元前の自動バックアップ");
    if (!currentBackup.success) {
      return {
        success: false,
        error:
          currentBackup.error || "復元前の暗号化バックアップに失敗しました",
      };
    }
    console.log(
      "[BackupRestore] Pre-restore backup created:",
      currentBackup.backupPath,
    );

    const restoreTempPath = `${dbPath}.restore-${Date.now()}.tmp`;
    const rollbackPath = `${dbPath}.rollback-${Date.now()}.tmp`;
    let movedCurrentDb = false;

    try {
      // バックアップファイルを一時ファイルに復元（本番DBへは直接書き込まない）
      if (safeFileName.endsWith(".encrypted.zip")) {
        const password = await getBackupSecret();
        if (!password || password.length < 8) {
          return {
            success: false,
            error: "ZIP暗号化バックアップの復元にはBACKUP_SECRETが必要です。",
          };
        }
        const encryptedBuffer = await fs.readFile(backupPath);
        let files: { filename: string; content: string | Buffer }[];
        try {
          files = await extractPasswordProtectedZip(encryptedBuffer, password);
        } catch {
          return {
            success: false,
            error:
              "バックアップの復号に失敗しました。BACKUP_SECRETが正しいか確認してください。",
          };
        }
        if (!files.length) {
          return {
            success: false,
            error: "バックアップの内容が空です。",
          };
        }
        const dbFileName = path.basename(dbPath);
        const target =
          files.find((file) => file.filename === dbFileName) ??
          files.find((file) => file.filename.endsWith(".db")) ??
          files[0];
        const content =
          typeof target.content === "string"
            ? Buffer.from(target.content, "utf-8")
            : target.content;
        await fs.writeFile(restoreTempPath, content);
      } else if (safeFileName.endsWith(".encrypted")) {
        // 旧形式のAES-256-CBC暗号化バックアップを復号化（後方互換性のため）
        const encryptedData = await fs.readFile(backupPath);
        const iv = encryptedData.slice(0, 16);
        const encrypted = encryptedData.slice(16);

        const key =
          process.env.PERSONAL_INFO_ENCRYPTION_KEY ||
          process.env.APP_SECURITY_SEED ||
          "default-key";
        const keyBuffer = Buffer.from(key.slice(0, 32), "utf8");
        const decipher = crypto.createDecipheriv("aes-256-cbc", keyBuffer, iv);

        const decrypted = Buffer.concat([
          decipher.update(encrypted),
          decipher.final(),
        ]);
        await fs.writeFile(restoreTempPath, decrypted);
      } else {
        await fs.copyFile(backupPath, restoreTempPath);
      }

      const integrity = await verifyDatabaseIntegrity(restoreTempPath);
      if (!integrity.ok) {
        return {
          success: false,
          error: `データベースの整合性チェックに失敗しました: ${integrity.reason || "unknown"}`,
        };
      }

      // 既存接続とWAL/SHMを整理してからDBファイルを差し替える
      try {
        await prisma.$disconnect();
      } catch {
        // ignore
      }
      await fs.unlink(`${dbPath}-wal`).catch(() => {});
      await fs.unlink(`${dbPath}-shm`).catch(() => {});

      if (await fileExists(dbPath)) {
        await fs.rename(dbPath, rollbackPath);
        movedCurrentDb = true;
      }

      try {
        await fs.rename(restoreTempPath, dbPath);
      } catch {
        if (movedCurrentDb) {
          await fs.rename(rollbackPath, dbPath).catch((rollbackError) => {
            console.error("[BackupRestore] Rollback failed:", rollbackError);
          });
        }
        return {
          success: false,
          error: "バックアップの反映に失敗したため、自動ロールバックしました。",
        };
      }

      if (movedCurrentDb) {
        await fs.unlink(rollbackPath).catch(() => {});
      }
    } finally {
      await fs.unlink(restoreTempPath).catch(() => {});
    }

    console.log("[BackupRestore] Restore completed successfully");
    return {
      success: true,
      backupCreatedAt,
    };
  } catch (error) {
    console.error("Backup restore error:", error);
    return {
      success: false,
      backupCreatedAt: undefined,
      error:
        error instanceof Error
          ? error.message
          : "バックアップの復元に失敗しました",
    };
  }
}

/**
 * バックアップを削除
 */
export async function deleteBackup(backupFileName: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const safeFileName = normalizeBackupFileName(backupFileName);
    if (!safeFileName) {
      return {
        success: false,
        error: "不正なバックアップファイル名です",
      };
    }

    const backupDir = await ensureBackupDir();
    const backupPath = path.join(backupDir, safeFileName);
    const metadataPath = backupPath + ".metadata.json";

    await fs.unlink(backupPath);
    try {
      await fs.unlink(metadataPath);
    } catch {
      // メタデータファイルがない場合は無視
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Backup delete error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "バックアップの削除に失敗しました",
    };
  }
}
