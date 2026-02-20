import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBackupFileName } from "../src/lib/backup/backup-file-name";

test("normalizeBackupFileName accepts supported backup names", () => {
  assert.equal(
    normalizeBackupFileName("backup-2026-02-06T12-34-56-000Z.db"),
    "backup-2026-02-06T12-34-56-000Z.db",
  );
  assert.equal(
    normalizeBackupFileName("backup-2026-02-06T12-34-56-000Z.db.encrypted"),
    "backup-2026-02-06T12-34-56-000Z.db.encrypted",
  );
  assert.equal(
    normalizeBackupFileName("backup-2026-02-06T12-34-56-000Z.db.encrypted.zip"),
    "backup-2026-02-06T12-34-56-000Z.db.encrypted.zip",
  );
});

test("normalizeBackupFileName rejects traversal and invalid format", () => {
  assert.equal(normalizeBackupFileName("../backup.db"), null);
  assert.equal(normalizeBackupFileName("dir/backup.db"), null);
  assert.equal(normalizeBackupFileName("backup_日本語.db"), null);
  assert.equal(normalizeBackupFileName("backup.sql"), null);
  assert.equal(normalizeBackupFileName(""), null);
});
