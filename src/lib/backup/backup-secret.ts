import { getSetting } from "@/lib/settings";
import { PersonalInfoEncryption } from "@/lib/security/encryption";

export async function getBackupSecret(): Promise<string> {
  const stored = await getSetting("backupSecret");
  if (stored) return PersonalInfoEncryption.decrypt(stored);
  return process.env.BACKUP_SECRET || "";
}
