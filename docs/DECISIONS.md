# Decisions

A short log of important decisions and why. Newest first. Library versions were checked on npm on the date shown.

## 2026-11-15 · Stage 1 foundation: the website stack

**Decided by:** the coordinator. **Recorded by:** the foundation worker.

| Layer | Choice (exact version) | Why |
|---|---|---|
| Repo | npm workspaces monorepo: `apps/web`, `packages/db`, `packages/ui`; one `node_modules` at the root | V2 §19.2 layout; one install saves disk and avoids version drift |
| Website | **Astro 5.18.2** (`output: "server"`), `@astrojs/node` 9.5.5 (standalone) | Fast pages with little JavaScript (V2 §19.1); SSR is needed for sign-in |
| Interactive bits | **React 19.3.1** islands via `@astrojs/react` 4.4.2 | Only where needed (theme toggle, game host, later the admin panel) |
| Language | **TypeScript 5.9.3**, strict (+ `noUncheckedIndexedAccess`); Astro's `strictest` preset in `apps/web` | Catches bugs before the site runs |
| Database access | **Drizzle ORM 0.45.4**, `drizzle-kit` 0.31.11 for migrations | One schema for SQLite and D1; a documented path to Postgres |
| Local database | SQLite file `apps/web/.data/dev.sqlite` via **better-sqlite3 13.2.0** (gitignored) | Zero setup; ships prebuilt binaries for Node 24 |
| Production database | **Cloudflare D1** (recommended), same SQLite schema and migrations | We plan Cloudflare Pages; D1 is SQLite, so nothing to translate |
| Auth | **Better Auth 1.7.25** (email + password, database sessions) with its Drizzle adapter | Open source, runs on Node and Workers, sessions in our own DB |
| Roles | owner, admin, moderator, player, guest; role → permission map in `apps/web/src/lib/permissions.ts` | Mirrors EE Hub's `accounts.access` (role + personal grants − revokes) |
| Design system | `packages/ui`: CSS custom-property tokens ported from EE Hub, light/dark themes | Keeps the brand look; no CSS framework to learn |
| Tests | **Vitest 5.1.0** | Fast, TypeScript-native |
| Lint / format | ESLint 10.15.0 + typescript-eslint 8.72.2 + eslint-plugin-astro 3.2.1; Prettier 3.10.1 | Conventional, automatic |
| Scripts runner | tsx 4.23.15 | Runs the TypeScript seed and migrate scripts directly |
| Node | 24.22.2 (any ≥ 22.12) | Current LTS line on the owner's Mac |

### Notes and trade-offs

- **Astro 5, not 7.** Astro 7.4.12 is the newest release (7.0 shipped 22 Jun 2026). The coordinator chose Astro 5, so we pinned the last 5.x (5.18.2, 26 May 2026) with the matching integrations. Upgrading later is `npx @astrojs/upgrade` plus testing; nothing in our code depends on 5-only behaviour. **Flag:** 5.x may stop getting fixes, so plan the upgrade before the public launch.
- **TypeScript 5.9.3, not 6.0.** typescript-eslint 8.72 supports TS < 6.1 and `@astrojs/check` supports 5 and 6, but Astro 5's tsconfig presets were written for TS 5. Revisit with the Astro upgrade.
- **Cloudflare adapter not installed yet.** `@astrojs/cloudflare` pulls in Wrangler and workerd (well over 100 MB), and the disk is nearly full. The code is ready for it: the repositories are driver-neutral and `packages/db/src/d1.ts` exists. See `docs/DATABASE.md` and `docs/ARCHITECTURE.md`.
- **Cheat codes:** salted SHA-256 (a random 16-byte salt for each code, via Web Crypto). They are checked often and are not account passwords. **Hero codes** unlock a powerful character, so they use the account password hasher (PBKDF2-SHA256 via Web Crypto since 16 Nov 2026, chosen to fit the Workers Free plan's 10 ms CPU limit; see docs/DEPLOY_CLOUDFLARE.md). Plain codes are never stored or returned. This differs from Django, which sent unsalted `sha256(slug:code)` hashes to the browser: in the new design the browser asks the server instead (`GamePlatform.checkCheat`).
- **Guest players:** we kept Django's `GuestPlayer` idea (name + hashed PIN, expires) but dropped the registration number. No personal data was copied from the Django database. Only the game catalogue (titles, descriptions, controls) was exported, to `packages/db/seed/games.catalogue.json`.
- **Permissions live in code, not in the database.** A code review then sees every change to who may do what. The `role` table holds only labels and ranks for the admin panel. Personal grants and revokes (with optional expiry) are rows in `user_permission_override`, as in Django.
- **Auth pages are server-rendered HTML forms** that call `auth.api.*`. They work without JavaScript, and Astro's `checkOrigin` blocks cross-site form posts.
- **Telemetry** in Better Auth is switched off.
