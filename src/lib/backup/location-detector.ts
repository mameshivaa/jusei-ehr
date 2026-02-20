import fs from "fs/promises";
import os from "os";
import path from "path";
import { getDefaultBackupDirectory } from "@/lib/backup/default-backup-dir";

type BackupLocation = {
  directory: string;
  source: "external" | "default";
};

const EXTERNAL_BACKUP_DIR_NAME = "v-oss-backups";

async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function findExternalOnMac(): Promise<string | null> {
  const volumesPath = "/Volumes";
  if (!(await isDirectory(volumesPath))) return null;
  try {
    const entries = await fs.readdir(volumesPath);
    const excluded = new Set(["Macintosh HD", "Macintosh HD - Data"]);
    for (const entry of entries) {
      if (excluded.has(entry)) continue;
      const candidate = path.join(volumesPath, entry);
      if (await isDirectory(candidate)) {
        return candidate;
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function findExternalOnLinux(): Promise<string | null> {
  const candidates = ["/media", "/mnt"];
  for (const base of candidates) {
    if (!(await isDirectory(base))) continue;
    try {
      const entries = await fs.readdir(base);
      for (const entry of entries) {
        const candidate = path.join(base, entry);
        if (await isDirectory(candidate)) {
          return candidate;
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function findExternalOnWindows(): Promise<string | null> {
  for (let code = "D".charCodeAt(0); code <= "Z".charCodeAt(0); code += 1) {
    const drive = `${String.fromCharCode(code)}:\\`;
    try {
      if (await isDirectory(drive)) {
        return drive;
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function detectExternalDrive(): Promise<string | null> {
  const platform = os.platform();
  if (platform === "darwin") return findExternalOnMac();
  if (platform === "win32") return findExternalOnWindows();
  return findExternalOnLinux();
}

export async function detectBackupLocation(): Promise<BackupLocation> {
  const external = await detectExternalDrive();
  if (external) {
    const directory = path.join(external, EXTERNAL_BACKUP_DIR_NAME);
    try {
      await fs.mkdir(directory, { recursive: true });
    } catch {
      // fallback handled below
    }
    if (await isDirectory(directory)) {
      return {
        directory,
        source: "external",
      };
    }
  }
  return {
    directory: getDefaultBackupDirectory(),
    source: "default",
  };
}
