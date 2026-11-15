# Site v2: the rebuild brief (read this first)

**Date:** 15 Nov 2026. **Owner's verdict on the current site:** "looks AI generated", "made by a 2-year-old", games don't play, everything says "coming soon", the profile is broken (no profile picture), nothing can be customised. **Owner's direction:** rebuild MIB-Hub from scratch following **EE Hub's design language and tools**: "copy the CSS files and the JavaScript and everything… copy the entire front end". Polish level: Apple. Mood: a gaming hub, not a school portal.

## 1. The reference (study before building)
- **Screenshots of EE Hub:** `~/Downloads/eehub-2/docs/screenshots/landing-desktop-light.png`, `landing-desktop-dark.png`, `landing-mobile-*.png`, `landing-desktop-light-full.png` (13,000px tall; crop it with Pillow from `.venv/bin/python` to view parts).
- **EE Hub's front end, copied into this repo (reuse freely, it is the owner's own site):**
  - `legacy/eehub-django/static/css/` (tokens, base, layout, components, home, ee, fx, animations, forms, …)
  - `legacy/eehub-django/static/js/` (`app.js`, `theme-init.js`, `search.js`, `alive.js`, `apple.js`, `promotions.js`, and `fx/`: particle field, waves, electric field, galaxy, black hole, reveal, appearance)
  - `legacy/eehub-django/templates/` (`base_public.html`, `base.html` portal shell, `base_auth.html`, `partials/`, `content/partials/hero.html` and the home sections, `games/*`)
  - `docs/port/DESIGN.md` (1,200 lines: the full spec of that look: shells, partials, tokens, motion, icons, responsive rules, traps)
- **What makes it good:** an animated themed hero (canvas scenes, live arcs, turning gears, flowing waves) with a "Pause motion" control; a floating glass pill nav with dropdown menus, search, the theme toggle and a gold Sign-in button; a scrolling "LIVE" announcement ticker; an announcement pill; huge display headlines with a gold-to-cyan gradient word; stat chips; sections with an eyebrow label + gradient-accent heading; dark stat bands; horizontal timelines; polished cards with icons; reveal-on-scroll; a careful light AND dark theme.

## 2. Never reuse
- The real university crest (`legacy/eehub-django/static/img/…` crest/logo files) or any real university/department name ("Ahmadu Bello", "ABU", "Zaria", "Department of Electrical Engineering"). MIB-Hub has its own brand: `apps/web/src/components/Logo.astro`, `site.config.ts`.
- Real people's photos. People photos come only from the admin upload (`/api/uploads`).
- Placeholder pages. **No "coming soon" anywhere.** Every link goes to a real page with real data from the database. If a feature is not ready, do not show it.

## 3. MIB-Hub's content (all real, in the database: `npm run db:seed` already ran)
`repos.*` from `apps/web/src/lib/db.ts` (never write SQL in pages):
games (17, `listPublic`, `getBySlug`), posts (news/devlog/update/promo), events, deals, ads (`pick(placement)` for `home_hero | home_strip | arcade_top | game_side | news_inline`; link through `/go/ad/<id>`), people (founder, voice, supporter, …), history (timeline), faqs, tickets, characters (53, the open-world cast), analytics (`totals`, `perGame`, `hardestLevels`, `mostLikedLevels`, `daily`, `trending`, `devices`), likes, products (boosts in in-game naira: currency `GAME`; supporter tiers in `NGN`), orders, scores (`top`), profiles, siteSettings, cheats, heroes, gameSettings, users, roles, audit.
Helpers: `src/lib/site.ts` (`siteSwitches()`, `formatPrice`, `formatDate`, `timeAgo`), `src/lib/http.ts`, `src/lib/uploads.ts`.
APIs already built: `POST /api/track`, `POST /api/likes`, `POST /api/tickets` (form or JSON; redirects to `/support/thanks?ref=`), `POST /api/orders` (redirects to `/store/thanks?ref=`), `POST /api/uploads` (staff), `GET /uploads/*`, `GET /go/ad/<id>`.
Game art: `apps/web/public/games/<slug>/icon.png` now; `cover.jpg` (16:9), `tile.jpg` (4:5), `shot-1.jpg`, `shot-2.jpg` are being made from real gameplay by another worker; use them with a graceful fallback (accent gradient + icon) when a file is missing.

## 4. Who builds what (do not edit another builder's files)
| Builder | Owns |
|---|---|
| **Shell + home** | `packages/ui/src/styles/*`, `apps/web/src/styles/*` (except `pages/`), `src/layouts/BaseLayout.astro`, `PublicLayout.astro`, `AuthLayout.astro`, `src/components/` (except `components/admin/`, `components/public/`, `components/games/`), `public/fx/`, `public/js/`, `src/site.config.ts`, `pages/index.astro`, `pages/search.astro`, `pages/auth/*`, `pages/403.astro`, `pages/404.astro` |
| **Public pages** | `pages/games/*` (except `play`), `leaderboards*`, `news/*`, `events/*`, `community*`, `about*`, `support/*`, `store/*`, `characters/*`, `src/components/public/`, `src/styles/pages/` |
| **Account + admin** | `src/layouts/AppLayout.astro`, `pages/account/*`, `pages/admin/*`, `src/components/admin/`, `src/lib/admin-sections.ts`, `src/styles/admin.css`, new API routes under `pages/api/admin/*` and `pages/api/account/*` |
| **Games** | `src/games/*`, `pages/play/*`, `public/play/`, `pages/api/games/*`, `src/components/games/` |

Shared rules: the public builders use `PublicLayout` with props `{ title?: string; description?: string }` (the shell builder keeps that interface). Page-specific CSS goes in the builder's own files. If you need something from another builder's area, write it in your own folder.

## 5. Quality bar and checks
- Light and dark both beautiful (check both). Phone width 375px works. Keyboard and screen-reader basics (labels, focus, alt). `prefers-reduced-motion` respected.
- Every write in admin calls `repos.audit.record`. Every admin page uses `guard()` with the right permission (`src/lib/permissions.ts`: `admin.access`, `analytics.view`, `support.manage`, `content.manage`, `store.manage`, `games.manage`, `games.manage_settings`, `games.manage_content`, `games.manage_sounds`, `users.view`, `users.manage`, `site.settings`, `audit.view`, `roles.manage`).
- Before you finish: `export PATH=~/.nvm/versions/node/v24.22.2/bin:$PATH; npm run typecheck && npm run lint && npm test` from the repo root. Errors in files another builder owns are theirs; report them, do not fix them.
- Look at your pages: the dev server runs at http://localhost:4321 (start it with `npm run dev` in the background if it is not running). Screenshots: `scripts/screenshot.py` with `~/Downloads/eehub-2/.venv/bin/python -I` (offscreen WebKit on macOS 12; it lacks `color-mix()`; rAF does not tick, so canvas scenes look frozen there).
- Pinned dependency versions only, and only if truly needed. Disk is tight (~5 GB).
- Do not commit; the lead reviews and commits.
