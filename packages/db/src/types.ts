/**
 * The database type every repository accepts.
 *
 * Drizzle has a "sync" SQLite driver (better-sqlite3, used locally and in
 * tests) and an "async" one (Cloudflare D1). Both are a BaseSQLiteDatabase,
 * and in both cases `await query` works. Repositories always `await`, so the
 * same repository code runs on either driver.
 */
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import type * as schema from "./schema/index.ts";

export type Schema = typeof schema;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppDb = BaseSQLiteDatabase<"sync" | "async", any, Schema>;

/** Hashes secrets such as hero codes. apps/web passes its PBKDF2 hasher (src/lib/passwords.ts). */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
  /** True when a hash that just matched should be replaced by a fresh one (an older format). */
  needsRehash?(hash: string): boolean;
}
