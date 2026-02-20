import { test, expect } from "@playwright/test";
import { _electron as electron } from "playwright";
import electronPath from "electron";
import path from "path";
import fs from "fs/promises";
import { spawn, type ChildProcess } from "child_process";
import http from "http";
import { PrismaClient } from "@prisma/client";

const ROOT = path.resolve(__dirname, "..");
const TMP_DIR = path.join(ROOT, "tmp", "e2e-backup");
const USER_DATA_DIR = path.join(TMP_DIR, "user-data");
const DB_PATH = path.join(TMP_DIR, "e2e.db");
const BACKUP_SECRET = "test-backup-secret";
let baseUrl = "";
let testEnv: Record<string, string>;

function buildTestEnv(port: number): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }
  env.NODE_ENV = "development";
  env.DEV_BYPASS_AUTH = "true";
  env.BACKUP_SECRET = BACKUP_SECRET;
  env.DATABASE_URL = `file:${DB_PATH}`;
  env.VOSS_USER_DATA_DIR = USER_DATA_DIR;
  env.HOSTNAME = "localhost";
  env.PORT = String(port);
  env.E2E_MODE = "true";
  env.NEXT_PRIVATE_SKIP_ENV_LOADING = "1";
  return env;
}

async function getAvailablePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error("Failed to acquire port")));
      }
    });
    server.on("error", (error) => {
      reject(error);
    });
  });
}

let serverProcess: ChildProcess | null = null;
let electronApp: Awaited<ReturnType<typeof electron.launch>> | null = null;

async function waitForServer(
  url: string,
  timeoutMs: number = 30000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  await new Promise<void>((resolve, reject) => {
    const attempt = () => {
      if (Date.now() > deadline) {
        reject(new Error("Next.js server did not start in time"));
        return;
      }
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

async function resetBackups(): Promise<void> {
  const backupDir = path.join(USER_DATA_DIR, "backups");
  await fs.rm(backupDir, { recursive: true, force: true });
  await fs.mkdir(backupDir, { recursive: true });
}

async function withPrisma<T>(
  fn: (prisma: PrismaClient) => Promise<T>,
): Promise<T> {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: `file:${DB_PATH}` },
    },
  });
  try {
    return await fn(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

async function setMarker(value: string): Promise<void> {
  await withPrisma((prisma) =>
    prisma.systemSettings.upsert({
      where: { key: "e2e_restore_marker" },
      update: { value },
      create: {
        key: "e2e_restore_marker",
        value,
        description: "e2e",
        updatedBy: "e2e",
      },
    }),
  );
}

async function getMarker(): Promise<string | null> {
  return withPrisma(async (prisma) => {
    const record = await prisma.systemSettings.findUnique({
      where: { key: "e2e_restore_marker" },
    });
    return record?.value ?? null;
  });
}

async function setSystemSetting(key: string, value: string): Promise<void> {
  await withPrisma((prisma) =>
    prisma.systemSettings.upsert({
      where: { key },
      update: { value, updatedBy: "e2e" },
      create: {
        key,
        value,
        description: "e2e",
        updatedBy: "e2e",
      },
    }),
  );
}

test.describe.serial("backup restore", () => {
  test.beforeAll(async () => {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
    await fs.mkdir(TMP_DIR, { recursive: true });
    await fs.mkdir(USER_DATA_DIR, { recursive: true });

    const sourceDb = path.join(ROOT, "prisma", "prisma", "dev.db");
    await fs.copyFile(sourceDb, DB_PATH);

    await setSystemSetting(
      "backupDirectory",
      path.join(USER_DATA_DIR, "backups"),
    );
    await setSystemSetting("backupDirectorySource", "custom");

    const port = await getAvailablePort();
    baseUrl = `http://localhost:${port}`;
    testEnv = buildTestEnv(port);

    serverProcess = spawn("npm", ["run", "dev"], {
      cwd: ROOT,
      env: testEnv as NodeJS.ProcessEnv,
      stdio: "inherit",
    });

    await waitForServer(baseUrl);
  });

  test.afterAll(async () => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill("SIGTERM");
    }
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
      electronApp = null;
    }
  });

  const launchElectron = async () => {
    electronApp = await electron.launch({
      executablePath: electronPath as unknown as string,
      args: [path.join(ROOT, "electron-dist", "main.js")],
      env: testEnv,
    });
    const proc = electronApp.process();
    if (proc?.stdout) {
      proc.stdout.on("data", (data) => {
        console.log(`[electron:stdout] ${data.toString()}`);
      });
    }
    if (proc?.stderr) {
      proc.stderr.on("data", (data) => {
        console.error(`[electron:stderr] ${data.toString()}`);
      });
    }
    const page = await electronApp.firstWindow({ timeout: 60000 });
    return { app: electronApp, page };
  };

  test("restore succeeds and triggers restart", async () => {
    await resetBackups();
    await setMarker("before");

    const { app, page } = await launchElectron();

    await page.goto(`${baseUrl}/settings?tab=backup`);
    await page.getByRole("button", { name: "今すぐバックアップ" }).waitFor();

    const restoreTrigger = page.getByRole("button", { name: "復元" }).first();
    if ((await restoreTrigger.count()) === 0) {
      const createResponse = page.waitForResponse(
        (res) =>
          res.url().includes("/api/backup") &&
          res.request().method() === "POST",
      );
      await page.getByRole("button", { name: "今すぐバックアップ" }).click();
      await createResponse;
      await page.waitForResponse(
        (res) =>
          res.url().includes("/api/backup") && res.request().method() === "GET",
      );
      await expect(restoreTrigger).toBeVisible();
    }

    await setMarker("after");

    await restoreTrigger.click();
    await page.getByText("バックアップから復元").waitFor();
    await page.getByPlaceholder("復元").fill("復元");
    const executeRestore = page.getByRole("button", { name: "復元を実行" });
    await expect(executeRestore).toBeEnabled();
    const restoreResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/backup/restore") &&
        res.request().method() === "POST",
    );
    await executeRestore.click();
    await restoreResponse;

    await expect(page.getByText("再起動中…")).toBeVisible();
    await expect(
      page.getByText("復元が完了しました。データ反映のため再起動しています。"),
    ).toBeVisible();

    await expect
      .poll(
        async () =>
          app.evaluate(() => (globalThis as any).__E2E_RESTART_REQUESTED),
        { timeout: 5000 },
      )
      .toBe(true);

    await expect
      .poll(
        async () =>
          page.evaluate(() =>
            window.localStorage.getItem("voss_restore_completed_at"),
          ),
        { timeout: 5000 },
      )
      .not.toBeNull();

    await page.reload();
    await expect(
      page.getByText("復元が完了しました。最新のデータが反映されています。"),
    ).toBeVisible();

    const marker = await getMarker();
    expect(marker).toBe("before");
  });

  test("restore failure rolls back", async () => {
    await resetBackups();
    await setMarker("before");

    const { app, page } = await launchElectron();

    await page.goto(`${baseUrl}/settings?tab=backup`);
    await page.getByRole("button", { name: "今すぐバックアップ" }).waitFor();

    const restoreTrigger = page.getByRole("button", { name: "復元" }).first();
    if ((await restoreTrigger.count()) === 0) {
      const createResponse = page.waitForResponse(
        (res) =>
          res.url().includes("/api/backup") &&
          res.request().method() === "POST",
      );
      await page.getByRole("button", { name: "今すぐバックアップ" }).click();
      await createResponse;
      await page.waitForResponse(
        (res) =>
          res.url().includes("/api/backup") && res.request().method() === "GET",
      );
      await expect(restoreTrigger).toBeVisible();
    }

    await setMarker("after");

    await page.route("**/api/backup/restore", async (route) => {
      const request = route.request();
      const raw = request.postData();
      let payload: Record<string, unknown> = {};
      if (raw) {
        try {
          payload = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          payload = {};
        }
      }
      await route.continue({
        postData: JSON.stringify({
          ...payload,
          e2eForceFailAfterMove: true,
        }),
        headers: {
          ...request.headers(),
          "content-type": "application/json",
        },
      });
    });

    await restoreTrigger.click();
    await page.getByText("バックアップから復元").waitFor();
    await page.getByPlaceholder("復元").fill("復元");
    const executeRestore = page.getByRole("button", { name: "復元を実行" });
    await expect(executeRestore).toBeEnabled();
    const restoreResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/backup/restore") &&
        res.request().method() === "POST",
    );
    await executeRestore.click();
    const restoreResult = await restoreResponse;

    expect(restoreResult.status()).toBeGreaterThanOrEqual(400);
    await expect(page.getByText(/復元失敗|ロールバック/)).toBeVisible();

    const restartRequested = await app.evaluate(
      () => (globalThis as any).__E2E_RESTART_REQUESTED,
    );
    expect(restartRequested).toBe(false);

    const marker = await getMarker();
    expect(marker).toBe("after");
  });
});
