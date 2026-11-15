# Database: local SQLite, Cloudflare D1, and the Postgres path

All data access goes through the repository layer (`packages/db/src/repos`, used as `repos.*` in the website). Pages never write SQL. That is why switching the database is configuration, not a rewrite.

## 1. Local development: SQLite file (today)

- File: `apps/web/.data/dev.sqlite` (gitignored). Override with `DATABASE_FILE` in `.env`.
- Driver: `better-sqlite3` through `createSqliteDb()` in `packages/db/src/sqlite.ts`.
- `npm run db:migrate` applies migrations. `npm run dev` also applies any new ones automatically in development.
- `npm run db:seed` loads the roles, the game catalogue, the site settings and the owner account. It is safe to run again.
- `npm run db:reset` deletes the file, then migrates and seeds again. It is for development only and refuses to run in production.

## 2. Production on Cloudflare: D1 (recommended)

D1 is SQLite, so the **same schema and the same migration files** are used.

1. Install the adapter: `npm i -E -w @mib/web @astrojs/cloudflare@<version for Astro 5>`. Swap `node()` for `cloudflare()` in `apps/web/astro.config.mjs`.
2. Create the database: `npx wrangler d1 create mib-hub`. Add the binding (`DB`) to `wrangler.toml` with `migrations_dir = "packages/db/migrations"`.
3. Apply the migrations: `npx wrangler d1 migrations apply mib-hub --remote`.
4. In `apps/web/src/lib/db.ts`, when `DATABASE_DRIVER=d1`, build the repos per request from `createD1Db(Astro.locals.runtime.env.DB)` (from `@mib/db/d1`). Move the `repos` creation into the middleware (`context.locals.repos`), because D1 bindings exist only inside a request.
5. Better Auth: pass the same D1 Drizzle instance to `drizzleAdapter(db, { provider: "sqlite" })`.
6. `src/lib/env.ts` reads `process.env`. On Cloudflare, read secrets from the runtime env instead (`BETTER_AUTH_SECRET`, `SITE_URL`) and set them with `wrangler secret put`.
7. Seed once from your machine against D1, or export the local seed to SQL and apply it with `wrangler d1 execute`.

**Verify on the day:** D1's free-tier limits (database size, rows read and written per day) and the Workers CPU limits change over time. Record the date checked in `docs/DECISIONS.md` (V2 rule 16).

## 3. Postgres path (Supabase or Aiven)

Use this if we outgrow D1 or need row-level security in the database itself.

1. Add `pg` (or `postgres`) and re-declare the tables with `drizzle-orm/pg-core` in `packages/db/src/schema-pg/`. Use the same table and column names; only the column helpers change:
   - `text("id").primaryKey()` stays the same;
   - `integer(..., { mode: "timestamp_ms" })` becomes `timestamp(..., { withTimezone: true })`;
   - `integer(..., { mode: "boolean" })` becomes `boolean(...)`;
   - `text(..., { mode: "json" })` becomes `jsonb(...)`.

   These are all in `packages/db/src/schema/helpers.ts`, so a pg version of that file covers most of the work.
2. Generate migrations with a second drizzle config (`dialect: "postgresql"`, `out: "./migrations-pg"`).
3. The repositories are typed against SQLite's `BaseSQLiteDatabase`. Make a pg copy of `types.ts`. The query code itself (`select/insert/update/onConflictDoUpdate/returning`) is the same Drizzle API on Postgres, so the repo bodies carry over almost unchanged.
4. Better Auth: `drizzleAdapter(db, { provider: "pg" })`.
5. Supabase: turn on row-level security for every table. Players may read only their own `progress` and `player_profile`; only the server role writes `game`, `cheat`, `hero`, `site_setting` and `audit_log`. Never ship the service key to the browser.
6. Move the data with a JSON export and import script (to be written when needed; see V2 §21.2 "Backups").

## Hashing summary

| Secret | Stored as | Where |
|---|---|---|
| Account passwords | scrypt (Better Auth) | `account.password` |
| Hero (secret character) codes | scrypt (Better Auth's hasher, injected) | `hero.password_hash` |
| Cheat codes | SHA-256 of `salt:gameSlug:normalisedCode`, a random salt for each row | `cheat.code_hash`, `cheat.code_salt` |
| Guest PINs | to be decided by the games port (use the injected hasher) | `guest_player.pin_hash` |
