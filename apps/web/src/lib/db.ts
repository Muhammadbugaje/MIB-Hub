/**
 * The website's single database connection and repositories.
 *
 *   import { repos } from "../lib/db.ts";
 *   const games = await repos.games.listPublic();
 *
 * Which database is used depends on where the site runs (src/platform/):
 *   npm run dev, tests, scripts  a local SQLite file (apps/web/.data/dev.sqlite)
 *   Cloudflare Workers           the D1 database bound as DB in wrangler.jsonc
 */
import { createRepos } from "@mib/db";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { openDb } from "#platform";

export const db = openDb();

/** Better Auth's scrypt password hasher, reused for hero codes. */
export const passwordHasher = {
  hash: (plain: string) => hashPassword(plain),
  verify: (hash: string, plain: string) => verifyPassword({ hash, password: plain }),
};

export const repos = createRepos(db, { hasher: passwordHasher });
