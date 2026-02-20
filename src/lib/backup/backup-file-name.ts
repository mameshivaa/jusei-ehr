import path from "path";

const BACKUP_FILE_EXTENSIONS = [
  ".encrypted.zip",
  ".db.encrypted",
  ".encrypted",
  ".db",
] as const;
const BACKUP_FILE_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;

export function normalizeBackupFileName(fileName: string): string | null {
  const trimmed = fileName.trim();
  if (!trimmed) return null;

  const safeName = path.basename(trimmed);
  if (safeName !== trimmed) return null;
  if (safeName.length > 255) return null;
  if (!BACKUP_FILE_NAME_PATTERN.test(safeName)) return null;
  if (!BACKUP_FILE_EXTENSIONS.some((ext) => safeName.endsWith(ext)))
    return null;

  return safeName;
}
