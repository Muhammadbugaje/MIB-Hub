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
import { openDb } from "#platform";
import { passwordHasher } from "./passwords.ts";

export const db = openDb();

/** The PBKDF2 password hasher (src/lib/passwords.ts), also used for hero codes. */
export { passwordHasher };

export const repos = createRepos(db, { hasher: passwordHasher });
