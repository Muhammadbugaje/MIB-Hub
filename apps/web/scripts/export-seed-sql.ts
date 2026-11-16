/**
 * `npm run d1:seed-sql -w @mib/web`: make the starting data for the live
 * Cloudflare D1 database, as one SQL file.
 *
 *   1. runs the normal seed (scripts/seed.ts) into a fresh, throwaway SQLite
 *      file, apps/web/.data/d1-seed.sqlite (owner account from your .env);
 *   2. writes every row as "INSERT OR IGNORE" into apps/web/.data/d1-seed.sql.
 *
 * Then load it into D1 (after `npm run d1:migrate -w @mib/web`):
 *   cd apps/web && npx wrangler d1 execute mib-hub --remote --file=.data/d1-seed.sql
 *
 * Safe to run again: rows that already exist in D1 are left alone.
 * The SQL file holds the owner's email and password hash: it lives in the
 * git-ignored apps/web/.data/ folder. Never commit or share it.
 */
import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createSqliteDb } from "@mib/db/sqlite";

const webDir = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const dbFile = resolve(webDir, ".data/d1-seed.sqlite");
const sqlFile = resolve(webDir, ".data/d1-seed.sql");

/** Tables that belong to the migration tools, not to the site. */
const SKIP = /^(sqlite_|__drizzle_migrations$|d1_migrations$|_cf_)/;

/** One SQLite value as SQL text. */
function sqlValue(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (v instanceof Uint8Array) return `X'${Buffer.from(v).toString("hex")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

function main() {
  for (const f of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) rmSync(f, { force: true });
  execFileSync(process.execPath, ["--import", "tsx", resolve(webDir, "scripts/seed.ts")], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_FILE: dbFile },
  });

  const sqlite = createSqliteDb(dbFile).$sqlite;
  const tables = (sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[])
    .map((t) => t.name)
    .filter((name) => !SKIP.test(name));

  // D1 checks foreign keys; deferring them lets tables load in any order.
  const lines = ["PRAGMA defer_foreign_keys = true;"];
  let rows = 0;
  for (const table of tables) {
    for (const row of sqlite.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[]) {
      const cols = Object.keys(row);
      lines.push(`INSERT OR IGNORE INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map((c) => sqlValue(row[c])).join(", ")});`);
      rows++;
    }
  }
  sqlite.close();
  writeFileSync(sqlFile, lines.join("\n") + "\n");
  console.log(`\nWrote ${rows} rows from ${tables.length} tables to ${sqlFile}`);
  console.log("Next: cd apps/web && npx wrangler d1 execute mib-hub --remote --file=.data/d1-seed.sql");
}

main();
