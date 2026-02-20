/**
 * Prepare a clean template SQLite DB for packaged runtime initialization.
 *
 * Source DB:
 *   prisma/prisma/dev.db
 *
 * Output DB:
 *   prisma/prisma/template.db
 *
 * The template keeps schema (+ master tables) but removes environment-specific
 * runtime data, so first launch always starts from a predictable state.
 */

const fs = require("node:fs");
const path = require("node:path");

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Database = require("better-sqlite3");

const rootDir = process.cwd();
const srcPath = path.join(rootDir, "prisma", "prisma", "dev.db");
const dstPath = path.join(rootDir, "prisma", "prisma", "template.db");

const KEEP_TABLES = new Set([
  "_prisma_migrations",
  "judo_injury_masters",
  "procedure_masters",
]);

function quoteSqlIdentifier(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

function main() {
  if (!fs.existsSync(srcPath)) {
    throw new Error(`[prepare-template-db] Source DB not found: ${srcPath}`);
  }

  fs.mkdirSync(path.dirname(dstPath), { recursive: true });
  fs.copyFileSync(srcPath, dstPath);

  const db = new Database(dstPath);
  try {
    const rows = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      )
      .all();
    const triggerRows = db
      .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger'")
      .all();
    const tableNames = rows
      .map((row) => String(row.name))
      .filter((name) => !KEEP_TABLES.has(name));

    db.exec("PRAGMA foreign_keys = OFF;");
    const tx = db.transaction((tables) => {
      for (const trigger of triggerRows) {
        db.exec(`DROP TRIGGER IF EXISTS ${quoteSqlIdentifier(trigger.name)}`);
      }

      for (const table of tables) {
        db.prepare(`DELETE FROM ${quoteSqlIdentifier(table)}`).run();
      }

      const hasSqliteSequence = db
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'",
        )
        .get();
      if (hasSqliteSequence) {
        const clearSequenceStmt = db.prepare(
          "DELETE FROM sqlite_sequence WHERE name = ?",
        );
        for (const table of tables) {
          clearSequenceStmt.run(table);
        }
      }

      for (const trigger of triggerRows) {
        if (trigger.sql) {
          db.exec(String(trigger.sql));
        }
      }
    });
    tx(tableNames);
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec("VACUUM;");

    const counts = [];
    for (const table of tableNames) {
      const row = db
        .prepare(`SELECT COUNT(*) AS c FROM ${quoteSqlIdentifier(table)}`)
        .get();
      counts.push([table, Number(row.c)]);
    }
    const nonZero = counts.filter(([, c]) => c > 0);
    if (nonZero.length > 0) {
      throw new Error(
        `[prepare-template-db] Failed to sanitize tables: ${nonZero
          .map(([name, c]) => `${name}=${c}`)
          .join(", ")}`,
      );
    }

    console.log(
      `[prepare-template-db] Wrote ${path.relative(rootDir, dstPath)} (cleared ${tableNames.length} tables, kept ${KEEP_TABLES.size}).`,
    );
  } finally {
    db.close();
  }
}

main();
