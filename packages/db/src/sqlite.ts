/**
 * Local SQLite (a file on disk) through better-sqlite3. Used by `npm run dev`,
 * the seed and migrate scripts, and the tests (with ":memory:").
 *
 * Node only: do not import this from code that runs on Cloudflare (use ./d1.ts).
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema/index.ts";

/** The folder holding the generated SQL migrations (packages/db/migrations). */
export const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../migrations");

/** Open (or create) a SQLite database file. Pass ":memory:" for a throwaway one. */
export function createSqliteDb(file: string) {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL"); // faster, safe concurrent reads
  sqlite.pragma("foreign_keys = ON"); // SQLite has them off by default
  const db = drizzle(sqlite, { schema });
  return Object.assign(db, { $sqlite: sqlite });
}

export type SqliteDb = ReturnType<typeof createSqliteDb>;

/** Apply every migration that has not run yet. Safe to call repeatedly. */
export function migrateSqlite(db: SqliteDb, migrationsFolder = MIGRATIONS_DIR): void {
  migrate(db, { migrationsFolder });
}
