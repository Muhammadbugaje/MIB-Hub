/**
 * The website's single database connection and repositories.
 *
 *   import { repos } from "../lib/db.ts";
 *   const games = await repos.games.listPublic();
 *
 * Which database is used is configuration only (DATABASE_DRIVER in .env):
 *   sqlite  a local file (default; apps/web/.data/dev.sqlite)
 *   d1      Cloudflare D1. Not wired yet: needs the Cloudflare adapter,
 *           which passes the D1 binding per request. See docs/DATABASE.md.
 */
import { createRepos } from "@mib/db";
import { createSqliteDb, migrateSqlite } from "@mib/db/sqlite";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { env } from "./env.ts";

function open() {
  if (env.databaseDriver !== "sqlite") {
    // TODO(platform): Cloudflare D1. Use createD1Db(locals.runtime.env.DB) from "@mib/db/d1".
    throw new Error(`DATABASE_DRIVER "${env.databaseDriver}" is not wired up yet. See docs/DATABASE.md.`);
  }
  const db = createSqliteDb(env.databaseFile);
  // In development, apply new migrations automatically so `npm run dev` just works.
  // In production, run `npm run db:migrate` as a deploy step instead.
  // (import.meta.env is Astro/Vite's; it is missing when a script runs under tsx.)
  const isDev = import.meta.env?.DEV ?? !env.isProd;
  if (isDev) migrateSqlite(db);
  return db;
}

export const db = open();

/** Better Auth's scrypt password hasher, reused for hero codes. */
export const passwordHasher = {
  hash: (plain: string) => hashPassword(plain),
  verify: (hash: string, plain: string) => verifyPassword({ hash, password: plain }),
};

export const repos = createRepos(db, { hasher: passwordHasher });
