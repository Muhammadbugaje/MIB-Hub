/**
 * Cloudflare D1 (hosted SQLite) for production on Cloudflare Pages/Workers.
 *
 * The schema and the repositories are the same as local SQLite; only this
 * factory differs. Migrations are applied with Wrangler:
 *   npx wrangler d1 migrations apply <DB_NAME> --remote
 * using the same SQL files in packages/db/migrations (see docs/DATABASE.md).
 *
 * Not used yet: apps/web currently builds for Node. When the site moves to
 * Cloudflare, apps/web/src/lib/db.ts switches to this function.
 */
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema/index.ts";

/**
 * The D1 binding type, as Cloudflare passes it (env.DB). Declared loosely so
 * this package does not need @cloudflare/workers-types installed.
 */
export type D1Binding = Parameters<typeof drizzle>[0];

export function createD1Db(binding: D1Binding) {
  return drizzle(binding, { schema });
}
