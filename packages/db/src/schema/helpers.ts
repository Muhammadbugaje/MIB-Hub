/**
 * Small column helpers shared by every table, so all tables look alike.
 *
 * Portability note: this schema uses Drizzle's SQLite dialect, which runs on
 * the local SQLite file (better-sqlite3) AND on Cloudflare D1 unchanged.
 * For Postgres, see docs/DATABASE.md: the same tables are re-declared with
 * drizzle-orm/pg-core; these helpers are the only place types differ.
 */
import { integer, text } from "drizzle-orm/sqlite-core";

/** Primary key: a random UUID string, made in JavaScript (works everywhere). */
export const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

/** A timestamp stored as milliseconds since 1970 (read back as a Date). */
export const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });

/** created_at / updated_at columns, filled in automatically. */
export const timestamps = () => ({
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

/** A true/false column (SQLite stores 0 or 1). */
export const bool = (name: string) => integer(name, { mode: "boolean" });

/** A JSON column (stored as text, parsed for you). Pass the TypeScript type. */
export const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();
