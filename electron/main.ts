/**
 * Electron Main Process
 * v-oss デスクトップアプリケーションのメインプロセス
 */

import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  powerMonitor,
} from "electron";
import type { AppUpdater } from "electron-updater";
import path from "path";
import net from "net";

// electron-updater is loaded dynamically so the app can still start even when
// the module is absent (e.g. MS Store / appx builds where the Store handles
// updates).
let autoUpdater: AppUpdater | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  autoUpdater = require("electron-updater").autoUpdater;
} catch {
  console.warn(
    "[Updater] electron-updater not available. Auto-update is disabled.",
  );
}
import http from "http";
import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";

// @next/env may be absent in the standalone build if Next.js didn't trace it.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { loadEnvConfig } = require("@next/env") as {
    loadEnvConfig: (dir: string) => void;
  };
  loadEnvConfig(process.cwd());
} catch {
  console.warn("[Env] @next/env not available. Skipping .env file loading.");
}

// 開発モード判定
const isDev = process.env.NODE_ENV === "development";
const isE2E =
  process.env.E2E_MODE === "true" && process.env.NODE_ENV !== "production";

const DEFAULT_PROD_SERVER_PORT = 3000;
let runtimeServerPort = Number(process.env.PORT) || DEFAULT_PROD_SERVER_PORT;

// メインウィンドウの参照
let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let isShutdownInProgress = false;
const childWindows = new Set<BrowserWindow>();

const BACKUP_INTERVAL_MS = 12 * 60 * 60 * 1000;
const BACKUP_ALERT_INTERVAL_MS = 12 * 60 * 60 * 1000;
let lastBackupMissingAlertAt = 0;
const BACKUP_FAILURE_SUPPRESS_MS = 5 * 60 * 1000;
let lastBackupFailure: { at: number; signature: string } | null = null;
const execFileAsync = promisify(execFile);
const UPDATE_CHANNEL_OVERRIDE = (
  process.env.ELECTRON_AUTO_UPDATE_CHANNEL ?? ""
).trim();

function parseBooleanEnv(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

const STARTUP_UPDATE_CHECK_ENABLED = parseBooleanEnv(
  "ELECTRON_AUTO_UPDATE_ON_STARTUP",
  true,
);
const UPDATE_ALLOW_PRERELEASE_OVERRIDE = parseBooleanEnv(
  "ELECTRON_AUTO_UPDATE_ALLOW_PRERELEASE",
  false,
);

function getPrereleaseChannel(version: string): string | null {
  const [, prerelease = ""] = version.split("-", 2);
  if (!prerelease) return null;
  const channel = prerelease.split(".")[0]?.trim().toLowerCase();
  return channel || null;
}

if (isE2E) {
  (globalThis as any).__E2E_RESTART_REQUESTED = false;
}

/**
 * Auto Updater設定
 */
function setupAutoUpdater() {
  if (!autoUpdater) return;

  const versionChannel = getPrereleaseChannel(app.getVersion());
  const effectiveChannel = UPDATE_CHANNEL_OVERRIDE || versionChannel;
  const allowPrerelease =
    UPDATE_ALLOW_PRERELEASE_OVERRIDE || versionChannel !== null;

  // 自動ダウンロードを無効化（ユーザー確認後にダウンロード）
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = allowPrerelease;

  if (effectiveChannel) {
    autoUpdater.channel = effectiveChannel;
  }

  // GitHub Releasesをアップデートソースとして使用
  // electron-builder.ymlのpublish設定で指定

  // アップデートチェック時のログ
  autoUpdater.logger = console;
  console.info(
    `[Updater] channel=${effectiveChannel || "stable"} allowPrerelease=${
      allowPrerelease ? "true" : "false"
    } startupCheck=${STARTUP_UPDATE_CHECK_ENABLED ? "true" : "false"}`,
  );

  // 更新確認完了
  autoUpdater.on("checking-for-update", () => {
    sendStatusToWindow("update-checking");
  });

  // 更新が利用可能
  autoUpdater.on("update-available", (info) => {
    sendStatusToWindow("update-available", info);
  });

  // 更新なし
  autoUpdater.on("update-not-available", () => {
    sendStatusToWindow("update-not-available");
  });

  // ダウンロード進捗
  autoUpdater.on("download-progress", (progressObj) => {
    sendStatusToWindow("update-download-progress", progressObj);
  });

  // ダウンロード完了
  autoUpdater.on("update-downloaded", (info) => {
    sendStatusToWindow("update-downloaded", info);
  });

  // エラー
  autoUpdater.on("error", (err) => {
    sendStatusToWindow("update-error", err.message);
  });
}

/**
 * レンダラープロセスにステータスを送信
 */
function sendStatusToWindow(channel: string, data?: unknown) {
  if (mainWindow) {
    mainWindow.webContents.send(channel, data);
  }
}

/**
 * メインウィンドウを作成
 */
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: "柔道整復施術所向け電子施術録",
    icon: path.join(__dirname, "../public/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    // macOS用設定
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 15, y: 15 },
  });

  // 開発モードではNext.js dev serverを使用
  if (isDev) {
    const devPort = Number(process.env.PORT) || 3000;
    const devHost = process.env.HOSTNAME || "localhost";
    const devUrl = `http://${devHost}:${devPort}`;
    try {
      await mainWindow.loadURL(devUrl);
      mainWindow.webContents.openDevTools();
    } catch (error) {
      console.error("Failed to load dev server:", error);
      await dialog.showMessageBox(mainWindow, {
        type: "error",
        title: "開発サーバーに接続できません",
        message: "Next.js の開発サーバーに接続できませんでした。",
        detail:
          `接続先: ${devUrl}\n` +
          "別ターミナルで `npm run dev` を起動するか、\n" +
          "`npm run electron:dev` を使用してください。",
      });
    }
  } else {
    try {
      await startNextServer();
      const url = `http://127.0.0.1:${runtimeServerPort}`;
      await waitForServer(`${url}/api/system/health`);
      await mainWindow.loadURL(url);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unknown startup error";
      console.error("[Startup] Failed to initialize production server:", error);
      const escaped = message
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>起動エラー</title><style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Meiryo,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:32px}h1{margin:0 0 12px;font-size:24px}p{margin:0 0 10px}pre{margin-top:12px;padding:12px;background:#e2e8f0;border-radius:8px;white-space:pre-wrap;word-break:break-word}</style></head><body><h1>アプリの起動に失敗しました</h1><p>初期化処理に失敗したため起動できませんでした。</p><p>アプリを再起動し、解消しない場合はサポートへ連絡してください。</p><pre>${escaped}</pre></body></html>`;
      await mainWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
      );
      await dialog.showMessageBox(mainWindow, {
        type: "error",
        title: "起動エラー",
        message: "アプリ初期化に失敗しました。",
        detail: message,
      });
    }
  }

  mainWindow.webContents.on("did-finish-load", () => {
    if (!mainWindow) return;
    void runStartupBackup();
  });

  // 外部リンクはデフォルトブラウザ、内部リンクは新規ウィンドウで開く
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      const currentUrl = mainWindow?.webContents.getURL() || "";
      const currentOrigin = currentUrl ? new URL(currentUrl).origin : "";
      const isSameOrigin = currentOrigin && target.origin === currentOrigin;
      const isLocalHost =
        target.hostname === "localhost" ||
        target.hostname === "127.0.0.1" ||
        target.hostname === "0.0.0.0";

      if (isSameOrigin || isLocalHost) {
        const child = new BrowserWindow({
          width: 960,
          height: 800,
          minWidth: 720,
          minHeight: 600,
          parent: mainWindow ?? undefined,
          title: "柔道整復施術所向け電子施術録 - ドキュメント",
          webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true,
            session: mainWindow?.webContents.session,
          },
        });
        child.on("closed", () => {
          childWindows.delete(child);
        });
        childWindows.add(child);
        child.loadURL(url);
        return { action: "deny" };
      }
    } catch {
      // fall through to external
    }

    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function getMainServerOrigin(): string {
  if (mainWindow) {
    try {
      return new URL(mainWindow.webContents.getURL()).origin;
    } catch {
      // fall through to default
    }
  }
  const port = Number(process.env.PORT) || runtimeServerPort;
  return `http://127.0.0.1:${port}`;
}

function toPrismaFileUrl(absolutePath: string): string {
  const normalized = absolutePath.replace(/\\/g, "/");
  if (/^[A-Za-z]:\//.test(normalized)) {
    // Prisma on Windows expects file:C:/... (without extra leading slash).
    return `file:${normalized}`;
  }
  return `file:${normalized}`;
}

function getDatabasePathFromEnv(): string {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!dbUrl.startsWith("file:")) {
    throw new Error("DATABASE_URL must be file: URL");
  }
  const filePath = dbUrl.replace(/^file:/, "");
  const decoded = decodeURI(filePath);
  // Normalize "file:/C:/..." (Windows) into "C:/..."
  const windowsAbs = decoded.match(/^\/([A-Za-z]:\/.*)$/);
  const normalized = windowsAbs ? windowsAbs[1] : decoded;
  if (path.isAbsolute(normalized)) return normalized;
  return path.join(process.cwd(), normalized.replace(/^\.\//, ""));
}

function resolveRuntimeDatabasePath(): string {
  return path.join(app.getPath("userData"), "prisma", "voss.db");
}

function resolveBundledTemplateDatabasePath(): string | null {
  const appPath = app.getAppPath();
  const candidates = [
    path.join(process.resourcesPath, "prisma", "template.db"),
    path.join(appPath, "prisma", "template.db"),
    path.join(process.cwd(), "prisma", "template.db"),
    // Backward compatibility for older packages
    path.join(process.resourcesPath, "prisma", "dev.db"),
    path.join(appPath, "prisma", "dev.db"),
    path.join(process.cwd(), "prisma", "dev.db"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function ensureRuntimeDatabaseReady(): void {
  const dbPath = resolveRuntimeDatabasePath();
  process.env.DATABASE_URL = toPrismaFileUrl(dbPath);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  if (fs.existsSync(dbPath)) {
    return;
  }

  const templateDbPath = resolveBundledTemplateDatabasePath();
  if (!templateDbPath) {
    throw new Error(
      "[DB] Bundled template database not found. Cannot initialize local database.",
    );
  }
  fs.copyFileSync(templateDbPath, dbPath);
  console.info(
    `[DB] Initialized local SQLite database at ${dbPath} from template ${templateDbPath}.`,
  );
}

async function getBackupSecretFromDb(): Promise<string> {
  try {
    if (isE2E) {
      return process.env.BACKUP_SECRET || "";
    }
    const dbPath = getDatabasePathFromEnv();
    if (!fs.existsSync(dbPath)) {
      console.warn("[Backup] Database file not found:", dbPath);
      return "";
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Database = require("better-sqlite3") as any;
      const db = new Database(dbPath, { readonly: true });
      try {
        const row = db
          .prepare(
            "SELECT value FROM system_settings WHERE key = 'backupSecret' LIMIT 1",
          )
          .get() as { value?: string } | undefined;
        return row?.value ? String(row.value) : "";
      } finally {
        db.close();
      }
    } catch (error) {
      console.warn(
        "[Backup] Failed to read backupSecret via better-sqlite3:",
        error,
      );
      try {
        const { stdout } = await execFileAsync("sqlite3", [
          dbPath,
          "SELECT value FROM system_settings WHERE key = 'backupSecret' LIMIT 1;",
        ]);
        return stdout?.toString().trim() || "";
      } catch (cliError) {
        console.warn(
          "[Backup] Failed to read backupSecret via sqlite3:",
          cliError,
        );
        return "";
      }
    }
  } catch (error) {
    console.warn("[Backup] Failed to read backupSecret from DB:", error);
    return "";
  }
}

function parseBearerToken(value: string): string {
  return value.replace(/^Bearer\\s+/i, "").trim();
}

type BackupMissingStatusPayload = {
  required?: boolean;
  isMissing?: boolean;
  daysMissing?: number;
  alertAfterDays?: number;
};

type InternalBackupStatusPayload = {
  lastBackupAt?: string;
  missingStatus?: BackupMissingStatusPayload;
};

async function callAutoBackup(
  origin: string,
  secret: string,
  context: string,
  timeoutMs: number = 15000,
): Promise<{
  ok: boolean;
  skipped?: boolean;
  status?: number;
  error?: string;
}> {
  const url = `${origin}/api/backup/auto`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const token = parseBearerToken(secret);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      return {
        ok: false,
        status: response.status,
        error: body?.error || "backup API failed",
      };
    }
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      skipped?: boolean;
    } | null;
    return { ok: true, skipped: payload?.skipped ?? false };
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      return { ok: false, error: "timeout" };
    }
    console.warn(`[${context}] Auto backup request failed:`, error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "error",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchInternalBackupStatus(
  origin: string,
  secret: string,
  context: string,
  timeoutMs: number = 15000,
): Promise<{
  ok: boolean;
  status?: number;
  data?: InternalBackupStatusPayload;
  error?: string;
}> {
  const url = `${origin}/api/backup/internal/status`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const token = parseBearerToken(secret);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as
      | ({ error?: string } & InternalBackupStatusPayload)
      | null;
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: payload?.error || "internal backup status API failed",
      };
    }
    return {
      ok: true,
      status: response.status,
      data: payload || {},
    };
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      return { ok: false, error: "timeout" };
    }
    console.warn(`[${context}] Internal backup status request failed:`, error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "error",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function runStartupBackup(): Promise<void> {
  const secret = await getBackupSecretFromDb();
  if (!secret || parseBearerToken(secret).length < 8) {
    console.warn("[BackupOnStartup] BACKUP_SECRET not set, skipping");
    return;
  }
  const origin = getMainServerOrigin();
  const result = await callAutoBackup(origin, secret, "BackupOnStartup");
  if (!result.ok) {
    console.warn(
      `[BackupOnStartup] Failed: ${result.error || "unknown"} (status: ${result.status ?? "n/a"}). Will retry on next startup.`,
    );
  }
}

async function runScheduledBackup(force: boolean = false): Promise<void> {
  if (isQuitting || isShutdownInProgress) return;
  const secret = await getBackupSecretFromDb();
  if (!secret || parseBearerToken(secret).length < 8) {
    console.warn("[BackupScheduled] BACKUP_SECRET not set, skipping");
    return;
  }
  if (!force) {
    // Honor cooldown before hitting API on resume
    const statusResult = await fetchInternalBackupStatus(
      getMainServerOrigin(),
      secret,
      "BackupScheduledStatus",
    );
    if (statusResult.ok) {
      const lastBackupAt = statusResult.data?.lastBackupAt;
      if (lastBackupAt) {
        const last = Date.parse(lastBackupAt);
        if (Number.isFinite(last)) {
          const elapsed = Date.now() - last;
          if (elapsed < BACKUP_INTERVAL_MS) {
            return;
          }
        }
      }
    }
  }
  const origin = getMainServerOrigin();
  const result = await callAutoBackup(origin, secret, "BackupScheduled");
  if (!result.ok) {
    console.warn(
      `[BackupScheduled] Failed: ${result.error || "unknown"} (status: ${result.status ?? "n/a"}).`,
    );
  }
}

async function notifyBackupMissingIfNeeded(): Promise<void> {
  if (isQuitting || isShutdownInProgress) return;
  const now = Date.now();
  if (now - lastBackupMissingAlertAt < BACKUP_ALERT_INTERVAL_MS) return;
  const secret = await getBackupSecretFromDb();
  if (!secret || parseBearerToken(secret).length < 8) return;
  try {
    const result = await fetchInternalBackupStatus(
      getMainServerOrigin(),
      secret,
      "BackupMissingStatus",
    );
    if (!result.ok) return;
    const missingStatus = result.data?.missingStatus;
    if (
      missingStatus?.required &&
      missingStatus.isMissing &&
      typeof missingStatus.daysMissing === "number" &&
      typeof missingStatus.alertAfterDays === "number" &&
      missingStatus.daysMissing >= missingStatus.alertAfterDays
    ) {
      lastBackupMissingAlertAt = now;
      const dialogResult = await showMessageBox({
        type: "warning",
        title: "外部バックアップ未接続",
        message: `外部保存が${missingStatus.daysMissing}日以上行われていません。バックアップ先の接続状況を確認してください。`,
        buttons: ["設定を開く", "後で"],
        defaultId: 0,
        cancelId: 1,
      });
      if (dialogResult.response === 0 && mainWindow) {
        try {
          const target = new URL("/settings?tab=backup", getMainServerOrigin());
          await mainWindow.loadURL(target.toString());
        } catch {
          // ignore navigation errors
        }
      }
    }
  } catch {
    // ignore notification errors
  }
}

// External collection features are disabled in OSS builds.

async function showMessageBox(
  options: Electron.MessageBoxOptions,
): Promise<Electron.MessageBoxReturnValue> {
  if (mainWindow) {
    return dialog.showMessageBox(mainWindow, options);
  }
  return dialog.showMessageBox(options);
}

async function performShutdown(reason: string): Promise<void> {
  if (isShutdownInProgress) return;
  isShutdownInProgress = true;
  let shouldQuit = true;

  try {
    const secret = await getBackupSecretFromDb();
    if (!secret || parseBearerToken(secret).length < 8) {
      const result = await showMessageBox({
        type: "warning",
        title: "バックアップ未設定",
        message: "BACKUP_SECRET が未設定です。終了を続けますか？",
        buttons: ["終了する", "キャンセル"],
        defaultId: 0,
        cancelId: 1,
      });
      if (result.response === 1) {
        shouldQuit = false;
        return;
      }
    } else {
      const origin = getMainServerOrigin();
      const result = await callAutoBackup(origin, secret, reason);
      if (!result.ok) {
        console.warn(
          `[BackupOnShutdown] Failed: ${result.error || "unknown"} (status: ${result.status ?? "n/a"}).`,
        );
        const detailLines: string[] = [];
        if (result.status) {
          detailLines.push(`status: ${result.status}`);
        }
        if (result.error) {
          detailLines.push(`error: ${result.error}`);
        }
        if (result.status === 401) {
          detailLines.push("BACKUP_SECRET が一致しない可能性があります。");
        }
        const detailText =
          detailLines.length > 0 ? `\n原因: ${detailLines.join(" / ")}` : "";
        const signature = `${result.status ?? "n/a"}:${result.error ?? ""}`;
        const now = Date.now();
        if (
          lastBackupFailure &&
          lastBackupFailure.signature === signature &&
          now - lastBackupFailure.at < BACKUP_FAILURE_SUPPRESS_MS
        ) {
          console.warn(
            "[BackupOnShutdown] Suppressing repeated backup failure dialog.",
          );
          return;
        }
        lastBackupFailure = { at: now, signature };
        const response = await showMessageBox({
          type: "warning",
          title: "バックアップ失敗",
          message: `バックアップに失敗しました。${detailText}\n終了を続けますか？`,
          buttons: ["終了する", "キャンセル"],
          defaultId: 0,
          cancelId: 1,
        });
        if (response.response === 1) {
          shouldQuit = false;
          return;
        }
      }
    }
  } finally {
    if (!shouldQuit) {
      isShutdownInProgress = false;
      return;
    }
    isQuitting = true;
    isShutdownInProgress = false;
    app.quit();
  }
}

let nextServerStarted = false;

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

function getEphemeralPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to get ephemeral port")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function resolveServerPort(): Promise<number> {
  const explicit = Number(process.env.PORT);
  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  if (await isPortAvailable(DEFAULT_PROD_SERVER_PORT)) {
    return DEFAULT_PROD_SERVER_PORT;
  }
  const fallbackPort = await getEphemeralPort();
  console.warn(
    `[NextServer] Port ${DEFAULT_PROD_SERVER_PORT} is in use. Falling back to ${fallbackPort}.`,
  );
  return fallbackPort;
}

function resolveStandaloneServerPath(): string {
  const appPath = app.getAppPath();
  const candidates = [
    // Packaged app (electron-builder directories.app=.next/standalone)
    path.join(appPath, "server.js"),
    // Local unpackaged run from repo root
    path.join(appPath, ".next", "standalone", "server.js"),
    // Fallback for edge cases where cwd is the project root
    path.join(process.cwd(), ".next", "standalone", "server.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `[NextServer] server.js not found. looked in: ${candidates.join(", ")}`,
  );
}

async function startNextServer(): Promise<void> {
  if (nextServerStarted) return;
  const serverPath = resolveStandaloneServerPath();
  runtimeServerPort = await resolveServerPort();

  process.env.NODE_ENV = "production";
  process.env.PORT = String(runtimeServerPort);
  process.env.HOSTNAME = "127.0.0.1";
  process.env.ELECTRON_RUNTIME = "true";
  if (process.env.ELECTRON_BUILD !== "true") {
    process.env.ELECTRON_BUILD = "true";
  }

  try {
    console.info(`[NextServer] Starting from ${serverPath}`);
    console.info(`[NextServer] Listening on port ${runtimeServerPort}`);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require(serverPath);
    nextServerStarted = true;
  } catch (error) {
    console.error("Failed to start Next.js server:", error);
    throw error;
  }
}

async function waitForServer(
  url: string,
  timeoutMs: number = 30000,
): Promise<void> {
  const start = Date.now();
  let lastError = "";

  await new Promise<void>((resolve, reject) => {
    const tryOnce = () => {
      if (Date.now() - start > timeoutMs) {
        reject(
          new Error(
            `Next.js server did not become healthy in time (${lastError || "no response"})`,
          ),
        );
        return;
      }

      const req = http.get(url, (res) => {
        const status = res.statusCode || 0;
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
          if (body.length < 1024) {
            body += chunk;
          }
        });
        res.on("end", () => {
          if (status >= 200 && status < 300) {
            resolve();
            return;
          }
          // Middleware misconfiguration can return 401 for health checks even
          // when the Next.js server is alive. Treat 401 as "server reachable"
          // so app startup is not blocked by auth policy.
          if (status === 401) {
            console.warn(
              "[NextServer] Health endpoint returned 401. Continuing startup because server is reachable.",
            );
            resolve();
            return;
          }
          const compactBody = body.replace(/\s+/g, " ").trim();
          const detail =
            compactBody.length > 0 ? `: ${compactBody.slice(0, 240)}` : "";
          lastError = `HTTP ${status}${detail}`;
          setTimeout(tryOnce, 500);
        });
      });
      req.setTimeout(3000, () => {
        req.destroy(new Error("request timeout"));
      });
      req.on("error", (error) => {
        lastError = error instanceof Error ? error.message : "request error";
        setTimeout(tryOnce, 500);
      });
    };

    tryOnce();
  });
}

/**
 * IPC通信ハンドラー設定
 */
function setupIpcHandlers() {
  // アップデートチェック
  ipcMain.handle("check-for-updates", async () => {
    if (!autoUpdater) {
      return { success: false, error: "Auto-updater not available" };
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // アップデートダウンロード開始
  ipcMain.handle("download-update", async () => {
    if (!autoUpdater) {
      return { success: false, error: "Auto-updater not available" };
    }
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // アップデートインストール（再起動）
  ipcMain.handle("install-update", async () => {
    if (!autoUpdater) return;
    if (isShutdownInProgress) return;
    const secret = await getBackupSecretFromDb();
    if (!secret || parseBearerToken(secret).length < 8) {
      const response = await showMessageBox({
        type: "warning",
        title: "バックアップ未設定",
        message: "BACKUP_SECRET が未設定です。アップデートを続行しますか？",
        buttons: ["続行する", "キャンセル"],
        defaultId: 0,
        cancelId: 1,
      });
      if (response.response === 1) return;
      autoUpdater.quitAndInstall(false, true);
      return;
    }

    const origin = getMainServerOrigin();
    const result = await callAutoBackup(origin, secret, "UpdateInstall");
    if (!result.ok) {
      const response = await showMessageBox({
        type: "warning",
        title: "バックアップ失敗",
        message: "バックアップに失敗しました。アップデートを続行しますか？",
        buttons: ["続行する", "キャンセル"],
        defaultId: 0,
        cancelId: 1,
      });
      if (response.response === 1) return;
    }

    autoUpdater.quitAndInstall(false, true);
  });

  // アプリバージョン取得
  ipcMain.handle("get-app-version", () => {
    return app.getVersion();
  });

  // ダイアログ表示
  ipcMain.handle("show-message-box", async (_, options) => {
    if (!mainWindow) return null;
    return dialog.showMessageBox(mainWindow, options);
  });

  ipcMain.handle("restart-app", () => {
    if (isE2E) {
      (globalThis as any).__E2E_RESTART_REQUESTED = true;
      return;
    }
    isQuitting = true;
    app.relaunch();
    app.exit(0);
  });

  // ファイル選択ダイアログ
  ipcMain.handle("show-open-dialog", async (_, options) => {
    if (!mainWindow) return null;
    return dialog.showOpenDialog(mainWindow, options);
  });

  // ファイル保存ダイアログ
  ipcMain.handle("show-save-dialog", async (_, options) => {
    if (!mainWindow) return null;
    return dialog.showSaveDialog(mainWindow, options);
  });

  // ファイル保存
  ipcMain.handle("save-file", async (_, payload) => {
    try {
      if (!payload?.filePath) {
        return { success: false, error: "保存先が指定されていません" };
      }
      const data = payload.data;
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      await fs.promises.writeFile(payload.filePath, buffer);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "保存に失敗しました",
      };
    }
  });

  ipcMain.on("setup:ops-doc-read", () => {
    if (mainWindow) {
      mainWindow.webContents.send("setup:ops-doc-read");
    }
  });
}

// アプリ準備完了時
app.whenReady().then(async () => {
  process.env.VOSS_USER_DATA_DIR = app.getPath("userData");
  ensureRuntimeDatabaseReady();
  setupAutoUpdater();
  setupIpcHandlers();
  await createWindow();

  setInterval(() => {
    void runScheduledBackup();
  }, BACKUP_INTERVAL_MS);

  powerMonitor.on("resume", () => {
    void runScheduledBackup();
    void notifyBackupMissingIfNeeded();
  });

  setTimeout(() => {
    void notifyBackupMissingIfNeeded();
  }, 5000);

  // プロダクションモードでは起動時に更新チェック
  if (!isDev && STARTUP_UPDATE_CHECK_ENABLED && autoUpdater) {
    setTimeout(() => {
      autoUpdater!.checkForUpdates();
    }, 3000);
  } else if (!isDev) {
    console.info("[Updater] Startup update check is disabled by env");
  }
});

// すべてのウィンドウが閉じられたとき
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", (event) => {
  if (isQuitting) return;
  event.preventDefault();
  void performShutdown("AppQuit");
});

// アプリがアクティブ化されたとき（macOS）
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// セキュリティ: 新しいウェブビューの作成を防ぐ
app.on("web-contents-created", (_, contents) => {
  contents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
});
