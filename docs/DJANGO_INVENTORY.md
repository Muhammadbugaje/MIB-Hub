# Django inventory: what the game still has in EE Hub (Stage 0, read-only)

- **Source:** `~/Downloads/eehub-2`, read on 15 Nov 2026. Nothing there was changed.
- **Rules:** V2 §18.2 and V3 §16, step 4.
- **Where the copies are:** each Django file named below has a reference copy under `legacy/fslg-classic/django/`.
- **Game slug in Django:** `samaru-days`. The display name comes from the FSLG config.
- **Mount point:** the game is part of the **learning arcade**, the `games` app, mounted at `/arcade/` (`eehub/urls.py` line 35, `path("arcade/", include("games.urls"))`).

## 1. URLs (`games/urls.py`, namespace `games`)

| Route (under `/arcade/`) | View | Used by FSLG | New-project replacement |
|---|---|---|---|
| `` | `views.index` | Arcade lobby (lists the game) | Website home / games list (`apps/web`) |
| `play/<slug>/` | `views.play` | **The play page.** For `samaru-days` it swaps in the configured title, picks the bundle or the separate scripts (`games/bundle.py`), and passes `data-gm-config` and the three.js path | The play page in `apps/web`; Classic embedded in Stage 1 |
| `play/<slug>/manifest.webmanifest`, `manifest.webmanifest` | `views.manifest_view` | Per-game PWA install | The PWA manifest in `apps/web` |
| `leaderboard/` | `views.leaderboard` | Arcade scores | Later (Stage 7 accounts) |
| `guest/`, `guest/sign-out/` | `views.guest`, `guest_signout` | Guests (name, reg. no., PIN) can play 100-level games | Dropped. New auth (V2 §18.2: password hashes don't carry over) |
| `api/me/`, `api/result/`, `api/buy/`, `api/equip/`, `api/privacy/` | `views.*` → `games/progress.py` | Coins, XP, badges and cosmetics for the arcade profile | `packages/data` + `packages/platform` (Stage 7) |
| `api/hero/` | `views.api_hero` | Checks the secret character's code on the server | Special characters / unlock codes (V3 §9) |
| `api/room/` | `views.api_room` → `games/rooms.py` | LAN rooms for 2–6 players (cache only, no DB) | `packages/platform` (later) |
| `api/package/<slug>/`, `api/packages/`, `api/sync/` | `views.*` → `games/offline.py` | "Download for offline", plus the queued results sync | PWA packs (V2 §24) |
| `lan/` | `views.lan_page` | LAN join page (QR code) | Later |
| `manage/` → `settings/` | `settings_views.settings_home` | **Arcade Management** console | Admin dashboard (V2 §25) |
| `settings/<slug>/`, `settings/<slug>/export/`, `settings/export/` | `settings_views.settings_game`, `export` | Per-game switches, access, rules and cheat codes; export to PDF, DOCX, XLSX or CSV | Admin dashboard |
| `settings/codes/`, `settings/secret-character/`, `settings/log/` | `settings_views.all_codes`, `guide`, `audit` | The code sheet, the hero guide and the audit log | Admin dashboard |
| `settings/sounds/`, `api/sounds/<slug>/`, `…/revert/`, `…/file/<name>/` | `games/sounds.py` | Super admin replaces a sound for everyone | Admin → Sounds |
| `settings/fslg/characters/`, `config/`, `credits/` | `fslg_admin.page_*` | **FSLG editors** (super admin only) | Admin → Characters, Config, Credits |
| `api/fslg/` | `fslg_admin.api_bundle` | **The game fetches this at start-up**: config, credits and character overrides | Remote config / content API (V2 §23) |
| `api/fslg/save/`, `reset/`, `rollback/`, `history/` | `fslg_admin.api_*` | Editor writes, with versions and rollback | Admin API |

## 2. Models (`games/models.py`, migrations `0001`–`0006`)

The row counts come from a read-only, immutable open of `db.sqlite3` on 15 Nov 2026. **No rows were exported.**

| Model | Fields (short) | Rows | FSLG relevance | Replacement |
|---|---|---|---|---|
| `GuestPlayer` | name, reg_number, name_key, reg_key, pin_hash, created, last_seen, expires_at | 1 | Arcade guests. **Personal data, not to be copied** | Dropped |
| `ArcadeProfile` | user (1:1) or guest (1:1), xp, coins, owned, equipped, badges, stats (JSON), on_leaderboard | 5 | Cosmetics and stats across the arcade | `profiles` table (Stage 7) |
| `ArcadeScore` | profile FK, game slug, score, created, cheated | 56 | Leaderboards | `scores` table |
| `GameSettings` | slug (unique), data (JSON: cheat codes, rules, switches, hero password hash) | 2 (`*`, `samaru-days`) | **The owner's live cheat and rule overrides.** They hold a hash, so they were not copied. Re-enter them in the new admin, or export them deliberately and redacted | `game_settings` + remote config |
| `OfflineSubmission` | cid, profile FK, game, played_at, ok, note | 0 | Offline sync audit | The sync log |
| `GlobalSound` | slug, name, file (restricted storage), content_type, size, duration, version, uploaded_by | 0 | Sound overrides (none uploaded) | Asset overrides table |
| `FSLGContent` | kind (config, credits, character), key, data JSON, version, updated_by | **0** | Editor changes. None have been saved yet, so the game's own data is the source of truth | `content_overrides` table |
| `FSLGContentVersion` | kind, key, version, data, note, by, created | 0 | History and rollback | `content_versions` table |

Custom permission: `games.manage_game_settings` opens Arcade Management. The FSLG editors require `accounts.access.is_super_admin`.

## 3. Django admin (`games/admin.py`)

| Model | ModelAdmin |
|---|---|
| `ArcadeProfile` | list_display: str, xp, coins, on_leaderboard, updated |
| `ArcadeScore` | list_display: profile, game, score, created |
| `GuestPlayer` | list_display: name, reg_number, created, expires_at |
| `GameSettings` | list_display: str, updated |

The real game admin is **Arcade Management** (`settings_views`, `fslg_admin`, `sounds`), not the Django admin.

## 4. Settings, features and site-wide glue (outside `games/`)

| Where | What | Replacement |
|---|---|---|
| `eehub/settings/base.py:42` | `"games"` in `INSTALLED_APPS` | n/a |
| `core/features.py:105` | Module switch `features.games` ("Learning arcade"; **off by default**) | The feature flag in remote config |
| `config/defaults.py:447–452` | `games.guests_enabled`, `games.guest_days` | Dropped (guests) |
| `games/nav.py` | Sidebar entry "Arcade" | Website nav |
| `games/templatetags/fslg_tags.py` | `fslg_super`: shows the FSLG editors to the super admin only | Admin roles |
| `games/access.py` | Who may play which level (from `people.StudentProfile.level`) | Dropped. The new game is open to all |
| `games/catalogue.py` | The game's entry: slug, title, script, `deps` (load order of 57 scripts, then `samaru.js`), controls | `apps/game-fsl` build config |
| `games/bundle.py`, `manage.py build_fslg` | Joins the scripts into `fslg.bundle.js` | Vite build |
| `manage.py fslg_voice_overrides` | Writes `docs/voice/line_overrides.json` from the editor changes | Voice tool reads from the admin DB |
| `manage.py build_game_icons` (`games/icons.py`) | Home-screen icons | Web app icons |
| `manage.py purge_arcade_guests` | Guest expiry | Dropped |
| `static/sw.js` (lines 29, 187–291) | Service worker: `ee-arcade-<slug>` caches, offline play page, `/arcade/api/sync/` background sync | The new site's service worker |
| `templates/games/play.html` | Play page. It loads `arcade*.js`, the `qrcode` and `arcade-lan.js` for FSLG, then the deps | Stage 1 Classic page |
| `templates/games/fslg_*.html`, `_fslg_admin_head.html`, `_settings_nav.html`, `static/css/fslg-admin.css` | Editor UI | Admin dashboard |
| `templates/partials/head.html:12` | Per-game app manifest, icon and title | n/a |
| `accounts.access.is_super_admin` | The super admin check | Roles: super admin, editor, player |

## 5. Static files and media

| Where | Size | Status |
|---|---|---|
| `static/js/games/samaru-*.js`, `fslg-*.js`, `fslg.config.js`, `arcade*.js` | about 3.6 MB | Copied to `legacy/fslg-classic/static/js/games/` |
| `static/js/games/fslg.bundle.js` | 1.0 MB | Not copied (build output) |
| `static/audio/` (sfx, voice, fslg-intro) | 7.6 MB | Copied |
| `static/vendor/three@0.158.0`, `qrcode-generator@1.4.4` | about 0.7 MB copied | Copied (the min build only) |
| `static/img/games/samaru-days-*.png` | 81 KB | Copied |
| `protected_media/games/sounds/` | Empty in the DB (0 `GlobalSound` rows) | Not copied |
| `media/` | 8.6 MB of EE Hub uploads | Not copied (not the game; personal data) |

## 6. Third-party packages
- **Front end:** three.js 0.158.0 (MIT), qrcode-generator 1.4.4 (MIT).
- **Server:** the game needs nothing beyond Django itself.
- **Tooling:**
  - `tools/voice` uses a Python venv (numpy, imageio-ffmpeg);
  - the PDF tools use the same libraries as `tools/story/md2pdf.py`;
  - check `tools/voice/run.sh` when porting.

## 7. Questions for the owner
1. **Live cheat codes and the hero password.** Should the current values in `GameSettings` (`samaru-days`) be exported (redacted) into the new admin, or re-entered by hand?
2. **Arcade profiles and scores** (5 and 56 rows, from real students). Should these be dropped (recommended), or carried with consent?
3. **Classic hosting.** Should Classic stay at `/arcade/play/samaru-days/` on EE Hub only, or also be served from the new website (Stage 1 says embed it)?
4. **The full test run and bundle rebuild** to freeze Classic need `manage.py` in the Django project. Who runs it, and when? It writes `fslg.bundle.js` there.
