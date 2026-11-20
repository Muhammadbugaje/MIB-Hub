# FSLG (Freshers School Life) Fix Plan

**Game:** Freshers School Life (`samaru-days`)
**Slug:** `samaru-days`
**Accent:** `#f59e0b`
**Max Stage:** 120
**Three.js:** Enabled (`data-gm-three`)

---

## 1. Current State — What Works

| Area | Status | Notes |
|---|---|---|
| **Game launch** | ✅ Working | Loads at `http://localhost:4321/play/samaru-days` |
| **Canvas rendering** | ✅ Working | Three.js renders the 3D world; basic scene visible |
| **Stage progression** | ✅ Working | Stage 1–120 progression; final badge `light-of-samaru` at stage 17 |
| **Save system** | ✅ Working | Two save prefixes: `fslg-` and `samaru-` |
| **Sound manifest** | ✅ Working | 82 `samaru-days` sfx + 37 core sounds loaded from `manifest.json` |
| **Admin: Games** | ✅ Working | `/admin/games` — catalogue status, kill switches |
| **Admin: Cheats** | ✅ Working | `/admin/cheats` — cheat codes, hero system, access modes |
| **Admin: Characters** | ✅ Working | `/admin/characters` — open-world cast bios, voices, powers |
| **Admin: Sounds** | ✅ Working | `/admin/sounds` — global sound replacements (WAV/MP3/M4A) |
| **Dep load order** | ✅ Working | ~70 `samaru-*` and `fslg-*` scripts loaded in correct order |
| **fslg-overrides.js** | ✅ Working | Config tokens (`{{GAME_NAME}}`, `{{TAGLINE}}`, etc.) resolve text |
| **Story engine** | ✅ Working | `samaru-story.js` merges Y1–Y5, side, coop, ambient missions |
| **API: `/arcade/api/fslg/`** | ✅ Working | Returns `{schema, v, config, credits, characters, can_edit}` |
| **API: `/arcade/api/sounds/samaru-days/`** | ✅ Working | Lists global sound replacements |
| **LAN play** | ✅ Working | FSLG Wi-Fi play via `arcade-lan.js` + WebRTC |
| **Offline package** | ✅ Working | `api/package/samaru-days/` generates offline cache |

---

## 2. Gaps — What's Missing vs Legacy EEhub Django

Compared to the legacy FSLG at `~/Downloads/eehub-2` / `legacy/eehub-django`, the following FSLG settings and admin features are **not yet implemented** in MIB-Hub:

### 2.1 FSLG Config (Game Branding)
- **Missing:** `/arcade/settings/fslg/config/` — admin form for `gameName`, `gameShortName`, `initialsOverride`, `tagline`, `primaryColour`, `secondaryColour`, `currencyName`, `currencySymbol`
- **Impact:** Game title, initials, and tagline are currently hard-coded defaults (`"Campus Life"` / `"Game"`); super admins cannot change them live
- **Legacy source:** `games/fslg_admin.py:page_config`, `static/js/games/fslg.config.js`, template `fslg_config.html`
- **MIB-Hub need:** Astro page + React form + API `PATCH /arcade/api/fslg/` to update `GameConfig`

### 2.2 FSLG Characters (NPC Editor)
- **Missing:** `/arcade/settings/fslg/characters/` — per-NPC editor for `name`, `look` (skin, hair, hairCol, top, mode, fit, accessories), `attitude` (preset, mood, bump, hit, honk, speed, friend, romance, routine, likes, dislikes, hateTopic), `voice` (sex, pitch, tone, role), `barks` (≤4 × 120 chars), `lines` (≤800 with token preservation)
- **Impact:** No way to edit NPC appearances, dialogue, or voice settings via the admin UI
- **Legacy source:** `games/fslg_admin.py:page_characters`, `static/js/games/fslg-admin.js`, templates `fslg_characters.html`, `_fslg_admin_head.html`
- **MIB-Hub need:** Admin page + React component mirroring `fslg-admin.js` validation (`validate_character`) + API `POST /arcade/api/fslg/save/` `{kind:"character", key:<npc id>, data, note}`

### 2.3 FSLG Credits (End-of-Game Scroll)
- **Missing:** `/arcade/settings/fslg/credits/` — editor for credit sections/entries with `visible`/`approved` flags, drag-to-reorder, `outro` text
- **Impact:** No admin to manage the end-credits scroll; default list not ported (real names not copied)
- **Legacy source:** `games/fslg_admin.py:page_credits`, template `fslg_credits.html`
- **MIB-Hub need:** Admin page + API `POST /arcade/api/fslg/save/` `{kind:"credits", data}` + credits validation (`validate_credits`)

### 2.4 Global Sound Replacements for samaru-days
- **Missing:** No `GlobalSound` rows in the DB for `samaru-days`; no sounds uploaded "for everyone"
- **Impact:** Game plays its own per-player sound files only; no global sound overrides (e.g., custom fanfare, replaced SFX)
- **Legacy source:** `games/sounds.py:GlobalSound`, `manage.py upload_sound`, `api_sounds` endpoint
- **MIB-Hub need:** Super-admin upload UI + API `POST /arcade/api/sounds/samaru-days/` with `name` + `file` fields

### 2.5 FSLG-Specific Game Settings
- **Missing:** `GameSettings` row for `samaru-days` with cheat/rules overrides
- **Current `data` keys missing:** `cheats_enabled`, `cheats_on_boards`, `hero_enabled`, `rules`, `hero_hash`, `starter_off`
- **Legacy source:** `games/models.py:GameSettings`, `games/cheat_defaults/samaru-days.json` (17 rules), `cheats.update()`
- **MIB-Hub need:** Seed/GameSettings row for `samaru-days` + admin toggle + rule editor

### 2.6 `_fslg_admin_head.html` Partial
- **Missing:** The hidden `#fslg-admin` element with `data-api`, `data-csrf`, `data-three`, `data-page`, then the game data scripts and `fslg-admin.js`
- **Impact:** The FSLG admin client-side editor cannot initialize on the play page
- **Legacy source:** `templates/games/_fslg_admin_head.html`
- **MIB-Hub need:** Include in the play page Astro component for `samaru-days`

---

## 3. Phased Fix Plan

### Phase 1: Admin Parity — Config, Characters, Credits
- [ ] Add FSLG Config admin page (`/admin/fslg/config` or under `/admin/games` → tab)
- [ ] Add FSLG Characters admin page (`/admin/fslg/characters`)
- [ ] Add FSLG Credits admin page (`/admin/fslg/credits`)
- [ ] Include `_fslg_admin_head.html` partial in `samaru-days` play page
- [ ] Wire up API endpoints: `GET/POST /arcade/api/fslg/` (bundle), `POST /arcade/api/fslg/save/` (character/credits save), `POST /arcade/api/fslg/reset/`, `POST /arcade/api/fslg/rollback/`
- **Deliverable:** Super admin can edit game name/initials/tagline, per-NPC look/voice/lines, and credit entries; changes propagate live to the game

### Phase 2: Global Sound Replacements
- [ ] Add sound upload UI for `samaru-days` in `/admin/sounds`
- [ ] Ensure `POST /arcade/api/sounds/samaru-days/` works for super admins
- [ ] Test upload of WAV/MP3/M4A files (≤2 MB, 0.05–120 s)
- [ ] Test revert functionality
- **Deliverable:** Super admin can replace any of the 82 samaru-days SFX for all players

### Phase 3: Game Settings & Cheat Codes
- [ ] Create `GameSettings` row for `samaru-days` with default data mirroring `cheat_defaults/samaru-days.json`
- [ ] Add admin toggles: `enabled`, `cheats_enabled`, `cheats_on_boards`, `hero_enabled`
- [ ] Add rule editor for the 17 `samaru-days` rules (warnings, guards, fares, wild factors, etc.)
- [ ] Ensure hero code system works (password hashing, 8 tries per IP/10 min)
- **Deliverable:** Game settings visible and editable in the admin; cheat codes functional in-game

### Phase 4: Audio & Polish
- [ ] Verify all 82 `samaru-days` sfx names are in the inventory and playable
- [ ] Add any missing sounds from legacy `sfx/` manifest (check `SOUND_REQUESTS.md`)
- [ ] Verify voice clips (`audio/voice/manifest.json`) load and play
- [ ] Test intro film (`audio/fslg-intro/`) on the play page
- **Deliverable:** Complete sound set; intro film plays; no missing audio references

### Phase 5: Offline & Build
- [ ] Ensure `fslg.bundle.js` rebuild works (concatenation of deps in catalogue order)
- [ ] Verify offline package includes all FSLG scripts, three.js, and audio
- [ ] Test `npm run db:reset && npm run db:migrate && npm run db:seed` then play offline
- **Deliverable:** FSLG can be played offline with full content

---

## 4. Settings to Carry Over from Legacy EEhub Django

Based on the comparison, the following legacy settings should be carried into MIB-Hub:

| Legacy Setting | Source | MIB-Hub Destination | Decision |
|---|---|---|---|
| **Game config tokens** (`{{GAME_NAME}}`, `{{GAME_INITIALS}}`, `{{TAGLINE}}`, `{{CURRENCY}}`, `{{PLAYER_NAME}}`, `{{AUTHOR}}`) | `L/js/fslg.config.js`, `L/js/samaru-overrides.js` | `samaru-overrides.js` (already present) | ✅ As-is (tokens already ported) |
| **Default config values** (gameName, gameShortName, currency) | `fslg.config.js` defaults | `samaru-overrides.js` `DEFAULT` object | ✅ Already in MIB-Hub |
| **17 cheat rules** (warnings, guardSpeed, sight, search, decay, fine, fareBase/PerKm/Max, kekeFactor, wildWarn/wildLimit/wildPatience, wildFine) | `cheat_defaults/samaru-days.json` | `GameSettings[samaru-days].data.rules` | ✅ Re-enter in new admin (Phase 3) |
| **Hero code system** (password hash, `starter_off`) | `games/cheats.py`, `games/models.py:GameSettings` | `GameSettings[samaru-days].data` | ✅ Re-enter in new admin (Phase 3) |
| **Cheat codes list** (6–31 codes with `id, label, typed, dial, note, how`) | `cheat_defaults/samaru-days.json` + `data/seed/cheats.json` | Admin cheat editor | ✅ Re-enter in new admin (Phase 3) |
| **Global sound upload mechanism** | `games/sounds.py:GlobalSound` model + `api_sounds` endpoint | `/admin/sounds` + `POST /arcade/api/sounds/` | ✅ Rebuild in MIB-Hub (Phase 2) |
| **FSLG Content models** (`FSLGContent`, `FSLGContentVersion`) | `legacy/fslg-classic/django/games/models.py` | Consider for future MIB-Hub admin history | ⚠️ Spec: rebuild as new admin audit (not critical for V2) |
| **FSLG character validation** (`validate_character`, `HAIRS`, `MODES`, `PRESETS`, `VOICE_ROLES`) | `legacy/fslg-classic/django/games/fslg_admin.py:359` | New admin character editor | ✅ Port validation rules (Phase 1) |
| **FSLG credit validation** (`validate_credits`, `credit_warnings`, ≤30 sections, ≤1000 entries, ≤256 KB) | `legacy/fslg-classic/django/games/fslg_admin.py:263` | New admin credits editor | ✅ Port validation rules (Phase 1) |
| **Audio manifest** (`static/audio/sfx/manifest.json` — core 37 + packs) | `legacy/audio/sfx/` | `apps/web/public/play/_shared/audio/sfx/manifest.json` | ✅ Already present (82 samaru-days + 37 core) |
| **Voice manifest** (`static/audio/voice/manifest.json`, `tags.json`, `intro/`) | `legacy/audio/voice/` | `data/seed/voice/` + `assets/fsl/audio/voice/` | ✅ Copied; rebuild after new cast |
| **Fare rules** (fareBase, farePerKm, fareMax, kekeFactor, wildWarn, wildLimit, wildPatience, wildFine) | `cheat_defaults/samaru-days.json` → `rules` in `GameSettings` | New admin rule editor | ✅ Re-enter (Phase 3) |
| **Admin permission** `games.manage_game_settings` | `games/models.py:GameSettings.Meta.permissions` | MIB-Hub role/permission UI | ⚠️ Spec: add to normal role/grant UI (not in access matrix yet) |

**Notes on carry-over:**
- No real people's photos are copied; only first names used.
- No secrets (API keys, passwords) are in git — `.env` and `data/seed/private/` stay local.
- The hard-coded `"FSLG"` string in 15 files (KI-019) must be removed and replaced with token `{{GAME_INITIALS}}` — this is a carry-over task for Phase 1.
- The bus livery `"FSLG SHUTTLE"` in `samaru-3d.js` must be tokenized.

---

## 5. Screenshots

Screenshots captured during the scan (saved to `~/Downloads/games-files/screenshots/fslg/`):

| # | Description | File |
|---|---|---|
| 01 | Main menu / game launch page (black 3D viewport, top bar with Settings/Sound/Fullscreen) | `01_menu.jpg` |
| 02 | After clicking "Play in this window" — 3D world with brown building "SENATE", trees, road, grass (initial game state) | `02_page.jpg` |
| 03 | After gameplay — same 3D viewport; note the UI overlay with bottom cards (Play offline, The physics, Controls, Top scores) | `03_afterplay.jpg` |
| 04 | Settings panel visible (gear icon → Sounds volume slider, speaker on/off, volume slider) | `04_test.jpg` |
| 05 | Full UI overview — top bar (Back, FSLG icon, Freshers School Life (Classic), subtitle, Like 0, How to play, Pause, Settings, Sound on, volume slider, Full screen), main viewport, bottom notification bar, bottom action cards (Play offline, The physics, Controls, Top scores) | `05_page.jpg` |
| 06 | Settings page (audio/sounds configuration) | `06_settings.jpg` |

*(All images are JPEG; captured via `scripts/shot-page.py` with `__pump(N)` to advance the game loop before snapshot. Canvas-elements may appear empty if the game was between frames, but the UI overlays and top/bottom bars are captured.)*

---

## 6. Next Steps

1. **Start Phase 1:** Add FSLG Config, Characters, and Credits admin pages with full validation ported from `fslg_admin.py`
2. **Include `_fslg_admin_head.html`** in the `samaru-days` play page Astro component
3. **Wire API endpoints** for `GET/POST /arcade/api/fslg/` bundle and `POST /arcade/api/fslg/save/` per kind
4. **Re-enter GameSettings** for `samaru-days` with cheat codes, rules, and hero system defaults
5. **Add sound upload UI** for super admins to replace SFX globally
6. **Remove hard-coded "FSLG"** from 15 files (KI-019) and replace with `{{GAME_INITIALS}}` token
7. **Test end-to-end:** super admin changes → live game reflect → offline package → revert

---
*Document generated on November 20, 2026. Based on exploration of MIB-Hub dev server (http://localhost:4321) and legacy EEhub Django at `legacy/eehub-django/`.*