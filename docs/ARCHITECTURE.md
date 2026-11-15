# Architecture (Stage 1 foundation)

This file tells you where things go. If you add a folder or a pattern, update this file in the same commit.

```
MIB-Hub/
├─ apps/web/                 the website (Astro, server-rendered, React islands)
│  ├─ src/site.config.ts     site name, tagline, nav: change the brand here
│  ├─ src/middleware.ts      runs on every request: session → Astro.locals.viewer
│  ├─ src/lib/
│  │   ├─ env.ts             reads .env (server only)
│  │   ├─ db.ts              the one DB connection + `repos` (repository layer)
│  │   ├─ auth.ts            Better Auth config (email + password, sessions)
│  │   ├─ permissions.ts     roles, permissions, role → permission map
│  │   ├─ guard.ts           guard() for pages, guardApi() for API routes
│  │   ├─ mailer.ts          pluggable email (console driver in dev)
│  │   └─ admin-sections.ts  the admin sections still to build
│  ├─ src/layouts/           BaseLayout → PublicLayout | AppLayout | AuthLayout
│  ├─ src/components/        Astro components (Icon, Logo, Field, Alert)
│  ├─ src/games/             game loader contract, registry, GameHost island
│  ├─ src/pages/             routes (file = URL), see the table below
│  ├─ src/styles/app.css     site chrome (header, sidebar, auth screen, home)
│  ├─ scripts/seed.ts        npm run db:seed
│  └─ test/                  guard + permission tests
├─ packages/db/              Drizzle schema, migrations, repositories
│  ├─ src/schema/            auth.ts, platform.ts, games.ts
│  ├─ src/repos/             one file per area; index.ts builds `createRepos()`
│  ├─ src/sqlite.ts          local SQLite driver (Node only)
│  ├─ src/d1.ts              Cloudflare D1 driver
│  ├─ src/crypto.ts          cheat-code hashing (Web Crypto)
│  ├─ migrations/            generated SQL, numbered; never edit old ones
│  └─ seed/                  seed data (game catalogue from the old site)
├─ packages/ui/              design system
│  ├─ src/styles/            tokens.css, base.css, components.css, animations.css
│  ├─ src/theme.ts           light/dark logic + the inline <head> script
│  └─ src/components/        ThemeToggle.tsx (React)
└─ docs/                     plan, decisions, this file, screenshots
```

## Request flow

```mermaid
flowchart LR
  B[Browser] --> M[middleware.ts<br/>auth.api.getSession<br/>+ permission overrides]
  M --> L[Astro.locals.viewer<br/>user, role, permissions]
  L --> P[page .astro<br/>guard() first]
  P --> R[repos.*<br/>packages/db]
  R --> D[(SQLite file / D1)]
```

1. `middleware.ts` asks Better Auth for the session. If there is one and the user is not banned, it loads that user's active permission overrides and sets `Astro.locals.viewer = { user, role, permissions }`. Signed-out visitors get the `guest` viewer.
2. A protected page calls `guard(Astro, { permission: "..." })` first. A signed-out visitor is sent to sign in (with `?next=` back), and a signed-in visitor without the permission sees `/403`.
3. Pages read and write data only through `repos` (from `src/lib/db.ts`). **Never import tables or write SQL in a page.**

## Routes

| URL | File | Access | Status |
|---|---|---|---|
| `/` | `pages/index.astro` | everyone | minimal; TODO(public-pages) |
| `/play/<slug>` | `pages/play/[slug].astro` | everyone (hidden/off games: `games.preview`) | placeholder + loader; TODO(games-port) |
| `/auth/sign-in`, `/auth/register` | `pages/auth/*.astro` | signed-out | done |
| `/auth/sign-out` | `pages/auth/sign-out.astro` | POST only | done |
| `/auth/forgot-password`, `/auth/reset-password` | `pages/auth/*.astro` | everyone | done (console mailer) |
| `/account/profile` | `pages/account/profile.astro` | signed in | done (name, password, stats) |
| `/admin` | `pages/admin/index.astro` | `admin.access` | shell + stats; TODO(admin-panel) |
| `/admin/<section>` | `pages/admin/[section].astro` | the section's permission | placeholder; create `pages/admin/<section>.astro` to replace |
| `/api/auth/*` | `pages/api/auth/[...all].ts` | Better Auth | done |
| `/403`, `/404` | `pages/403.astro`, `pages/404.astro` | | done |

Search the code for `TODO(public-pages)`, `TODO(games-port)`, `TODO(admin-panel)` and `TODO(platform)` to find your work.

## Layouts

- **PublicLayout**: glass header (logo, nav from `site.config.ts`, theme toggle, sign-in or account button), footer. For marketing and play pages.
- **AppLayout**: signed-in shell. Sidebar (main links, then admin links filtered by permission, with "soon" tags) and a top bar (title, theme toggle, user chip, sign-out). For profile and admin pages.
- **AuthLayout**: split screen. Brand art on the left, the form card on the right; stacks on phones.
- All three wrap **BaseLayout**, which loads `@mib/ui/styles.css` and `src/styles/app.css` and runs the inline theme script before first paint.

## Design system (packages/ui)

- **Tokens:** use the semantic tokens (`--bg`, `--surface`, `--text`, `--text-muted`, `--primary`, `--accent`, `--border`, `--shadow-*`, `--radius-*`, `--space-*`, `--dur*`, `--ease-*`). Raw palette tokens (`--brand-500`) are for the design system itself.
- **Themes:** light by default. Dark applies when the device prefers it, or when the visitor picks it with the toggle. The rule (from EE Hub) is: follow the device, unless the visitor chose otherwise *while the device was on its current setting*. It lives in `theme.ts` and is tested.
- **Motion:** keyframes and utilities in `animations.css` (`.page-enter`, `.stagger`, `.lift`, `.anim-float`). Everything turns off under `prefers-reduced-motion` or `html[data-motion="reduce"]`. Animate only `transform` and `opacity`, and keep UI motion at 320 ms or less.
- **Components:** `.btn` (`--primary`, `--accent`, `--ghost`, `--danger`, `--lg`, `--sm`, `--block`, `--icon`), `.card`, `.form`/`.field`/`.input`, `.alert--*`, `.badge--*`, `.table`, `.empty`, `.skeleton`, `.theme-toggle`.
- **Avoid `color-mix()`** for now: the screenshot pipeline's WebKit (macOS 12) drops it.

## Database (packages/db)

Tables (see the comments in `src/schema/*.ts`):

| Area | Tables |
|---|---|
| Accounts (Better Auth) | `user` (+ `role`, `banned`), `session`, `account` (password hash), `verification` |
| Platform | `role`, `user_permission_override`, `audit_log`, `site_setting` |
| Games | `game`, `game_setting` (slug `*` = site-wide), `cheat` (salted hash), `hero` (scrypt), `game_content` + `game_content_version`, `guest_player`, `player_profile`, `score`, `progress` (save slots), `offline_submission`, `game_sound` |

**Repositories** (`repos.*`): `users`, `roles`, `permissionOverrides`, `audit` (redacts secrets), `siteSettings`, `games`, `gameSettings` (`effective()` merges defaults → `*` → game), `cheats` (`match()`), `heroes` (`verify()`), `profiles`, `scores` (`top()` skips cheated runs and opted-out players), `progress` (slots `auto`, `1`–`5`).

To change the schema:
1. edit `packages/db/src/schema/*.ts`;
2. run `npm run db:generate` to write a new numbered migration;
3. add or adjust repository functions and their tests in `packages/db/test/`;
4. commit the schema, the migration and the tests together.

Switching databases is configuration only. See `docs/DATABASE.md`.

## The game loader contract (`apps/web/src/games/`)

- `contract.ts` holds the types. A game module exports `mount(container, ctx) → { unmount, pause?, resume? }`.
- `ctx` gives the game its `slug`, `assetsPath`, effective `settings`, the `player` (or null) and `platform` services: `saveProgress`, `loadProgress`, `submitScore`, `checkCheat`, `checkHero`. It also gives an `AbortSignal` that fires when the page goes away.
- `registry.ts` maps a game's `entry` (DB column) to a **dynamic import**, so game code downloads only on its play page.
- `GameHost.tsx` is the React island that loads and mounts the game. `demo-hello.ts` is a working example. To see it, sign in as an admin or the owner and open `/play/demo-hello` (the game is hidden from players).
- **The game never calls site URLs or reads cookies itself.** Everything goes through `platform`, so the same game can later ship as a portal demo or an offline app (V2 §22).

## Notes for the next workers

**Games port**
- Put each game in its own package (`packages/game-<slug>` or `apps/game-<slug>`). Export `mount`, and register it in `registry.ts` under the game's `entry`. The seeded catalogue keeps the old `script` names as `entry` (`kickoff`, `clash`, `samaru`…).
- Build the API routes behind `GamePlatform`: `src/pages/api/games/[slug]/{progress,score,cheat,hero}.ts`. Use `guardApi()` and the repos.
- Cheat defaults: the old `games/cheat_defaults/*.json` files are under `legacy/fslg-classic/django/games/cheat_defaults/`. Import them through `repos.cheats.create` (it hashes the codes).
- Saves are offline-first: write locally first, then `platform.saveProgress`. Bump `saveVersion` and migrate old saves; never discard them.

**Admin panel**
- Build each section listed in `src/lib/admin-sections.ts` as `src/pages/admin/<key>.astro`, guarded by the permission listed there.
- **Every write** calls `repos.audit.record({ actorId, action, targetType, targetId, before, after })`. Secrets are redacted automatically.
- Role changes must respect `canManageRole()` and `assignableRoles()`.
- Big interactive tables can be React islands. Keep the permission checks on the server.

**Public pages**
- Use `PublicLayout`. Add nav links in `site.config.ts`. Keep pages light: no game code, and images sized and lazy-loaded.
- Branding comes from `site.config.ts`. The `site_setting` keys `brand.*` are seeded for a later runtime override.
