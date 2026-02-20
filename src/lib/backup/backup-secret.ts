import { getSetting } from "@/lib/settings";

export async function getBackupSecret(): Promise<string> {
  const stored = await getSetting("backupSecret");
  if (stored) return stored;
  return process.env.BACKUP_SECRET || "";
}
