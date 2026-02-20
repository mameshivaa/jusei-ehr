import os from "os";
import path from "path";

const APP_DATA_DIR_NAME = "V-OSS";

function getBaseDataDir(): string {
  const envDir = process.env.VOSS_USER_DATA_DIR;
  if (envDir) return envDir;

  const platform = process.platform;
  if (platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      APP_DATA_DIR_NAME,
    );
  }
  if (platform === "win32") {
    const appData =
      process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, APP_DATA_DIR_NAME);
  }
  const xdg =
    process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
  return path.join(xdg, "v-oss");
}

export function getDefaultBackupDirectory(): string {
  return path.join(getBaseDataDir(), "backups");
}
