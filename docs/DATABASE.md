# Database: local SQLite, Cloudflare D1, and the Postgres path

All data access goes through the repository layer (`packages/db/src/repos`, used as `repos.*` in the website). Pages never write SQL. That is why switching the database is configuration, not a rewrite.

## 1. Local development: SQLite file (today)

- File: `apps/web/.data/dev.sqlite` (gitignored). Override with `DATABASE_FILE` in `.env`.
- Driver: `better-sqlite3` through `createSqliteDb()` in `packages/db/src/sqlite.ts`.
- `npm run db:migrate` applies migrations. `npm run dev` also applies any new ones automatically in development.
- `npm run db:seed` loads the roles, the game catalogue, the site settings and the owner account. It is safe to run again.
- `npm run db:reset` deletes the file, then migrates and seeds again. It is for development only and refuses to run in production.

## 2. Production on Cloudflare: D1 (in use)

D1 is SQLite, so the **same schema and the same migration files** are used. This is wired up: the Cloudflare build opens D1 through `createD1Db()` (`packages/db/src/d1.ts`) in `apps/web/src/platform/workers.ts`, and Better Auth uses the same Drizzle instance. Local dev, tests and scripts keep using the SQLite file (`apps/web/src/platform/node.ts`).

- Apply migrations to D1: `npm run d1:migrate -w @mib/web` (runs `wrangler d1 migrations apply mib-hub --remote`).
- Load the starting data: `npm run d1:seed-sql -w @mib/web`, then `npx wrangler d1 execute mib-hub --remote --file=.data/d1-seed.sql` from `apps/web`.
- Full steps, settings and secrets: `docs/DEPLOY_CLOUDFLARE.md`.

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
| Account passwords | PBKDF2-SHA256, 20,000 rounds, `pbkdf2-sha256$<rounds>$<salt>$<hash>` (Web Crypto; `apps/web/src/lib/passwords.ts`). Older scrypt rows are upgraded at the next sign-in. | `account.password` |
| Hero (secret character) codes | the same PBKDF2 hasher (injected). Imported Django hashes (1.2 M rounds) only check on Node, then upgrade. | `hero.password_hash` |
| Cheat codes | SHA-256 of `salt:gameSlug:normalisedCode`, a random salt for each row | `cheat.code_hash`, `cheat.code_salt` |
| Guest PINs | to be decided by the games port (use the injected hasher) | `guest_player.pin_hash` |
