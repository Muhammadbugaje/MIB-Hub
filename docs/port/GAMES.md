# GAMES.md — port spec for the learning arcade

Source: `eehub-2` (Django). Generated 2026-11-15 from `games/catalogue.py`, `games/views.py`, `games/progress.py`, `games/rooms.py`, `games/offline.py`, `games/bundle.py`, `games/cheats.py`, `templates/games/play.html` and a scan of `static/js/games/*.js`. Machine-readable twin: `data/seed/games.json` (all 16 games, exact load order, byte sizes). Management screens: `MANAGEMENT.md`. Look and feel: `DESIGN.md`.

All 16 catalogue entries are `playable=True`. The catalogue is a Python list (no DB table); order = list order; the index groups games on shelves by `level` (100–500).

## 1. How a game page loads (the contract the JS expects)

URL `/arcade/play/<slug>/` (`games.views.play`, `@player_required` = signed-in user or unexpired guest session). Order of checks: game exists and playable → `GameSettings[slug].enabled` (else 404 unless manager) → `viewer(request)` level gate (else `locked.html`, 403). For `samaru-days` the title is replaced by the FSLG config name (`fslg_admin.game_title()`).

**Markup** (`templates/games/play.html`): a `.gm-page.gm-play` wrapper with `--gm-a: <accent>`, a toolbar (`data-gm-offline`, `data-gm-install`, `data-gm-lan` FSLG only, `data-gm-pause`, `data-gm-settings`, `data-gm-full`, `data-gm-mute` (starts muted), `data-gm-vol` range 0–100 default 60), and the stage:

```html
<div class="gm-stage" data-gm-stage data-gm-slug="<slug>" data-gm-user="u<pk>|guest"
     data-gm-api="/arcade/api/" data-csrf="<token>" data-gm-locked='[{"level":200,"name":"…"}]'
     data-gm-config='{"cheats":[{"id","typed":sha256,"dial":sha256}],"cheatsEnabled","cheatsOnBoards","rules":{…},"hero":{"enabled","name","combo","swipe"}}'
     data-gm-three="/static/vendor/three@0.158.0/build/three.module.min.js"  <!-- FSLG only -->>
  <canvas class="gm-canvas" data-gm-canvas tabindex="0"></canvas>
  <div class="gm-hud" data-gm-hud aria-live="polite"></div>
  <div class="gm-overlay" data-gm-overlay hidden></div>
  <div class="gm-touch" data-gm-touch></div>
</div>
<div class="gm-under"> … <div data-gm-concept></div> … <div data-gm-controls></div></div>
```

**Scripts**, all classic `<script defer>` (not modules), in this exact order:
1. Shell: `js/games/arcade.js` (104 KB), `arcade-settings.js` (51 KB), `arcade-audio.js` (22 KB), `arcade-sounds.js` (43 KB), `arcade-offline.js` (25 KB).
2. FSLG only: `vendor/qrcode-generator@1.4.4/qrcode.js`, `js/games/arcade-lan.js` (23 KB).
3. Each name in `catalogue extra.deps` (or, for FSLG outside DEBUG, the single `fslg.bundle.js` when it is newer than every dep). A name containing `/` is `static/<name>.js`, otherwise `static/js/games/<name>.js`.
4. Level packs (`extra.packs`) whose level ≤ the viewer's max level; the rest are listed in `data-gm-locked`.
5. The entry script `js/games/<script>.js`, which builds a game object and calls `Arcade.run(game)`.
CSS: `static/css/games.css` (plus the app base layout).

**Shell globals** (`window.Arcade`, arcade.js:927): `run, report, apiCall, profile, store, settings, Sound, toast, hash (sha256), HERO, VILLAIN, CAST/cast, byId, drawHead, picker, paintFaces, card, styled, trail, owns, song, songs, rng, esc, W=960, H=540`. Also `window.EEArcadeDebug` (test hook), `window.ArcadeOffline` (queue/isNetErr), `Arcade.Audio` (sample player, from arcade-audio.js), `window.__gmSession` (`{cheated, boards}` set by the cheat/hero layer). `Arcade.run(game)`: fixed 120 Hz step, letterboxed 960×540 canvas, keyboard + touch buttons mapped to the same action ids (`game.actions[{id, keys}]`), DOM overlays, pause on hide, reduced motion from `prefers-reduced-motion` or `<html data-motion="reduce">`.

**Port options for MIB-Hub (Astro):** keep the games as legacy classic scripts served from `public/legacy/arcade/…` and render the same stage markup + data attributes from an Astro page (fastest, zero JS changes); the API paths are read from `data-gm-api`, so they can move to `/api/arcade/` as long as the sub-paths (`me/`, `result/`, …) stay. CSRF header is `X-CSRFToken` from `data-csrf`.

## 2. Server APIs the games call (`games/urls.py`, mounted at `/arcade/`)

All JSON, same-origin, `X-CSRFToken`. `_api` wrapper: 401 `{"error"}` when neither user nor guest; 400 `{"error"}` on `Rejected`. Bodies capped (2 KB normal, 4 KB room, 96 KB sync).

| Method + path | View | Body → response | Rules |
|---|---|---|---|
| GET `api/me/` | `api_me` | → profile dict `{xp, coins, level, rank, next_xp, this_xp, owned[], equipped{}, badges[{id,name,text}], on_leaderboard, shop[{id,label,price,kind,value}]}` | called once at load (`Profile.ready`) |
| POST `api/result/` | `api_result` → `progress.record` | `{game, result: win|draw|lose, stage, score, mode: solo|duo, cheated?, hero?}` → profile + `{earned_coins, earned_xp, levelled_up, cheated, counted, new_badges[]}` | game must be open to viewer and enabled; stage 1..MAX_STAGE; score clamped 0..5000; one result per game per 15 s; coins = {30,15,8}[result] + 5×stage on win; duo halves, no score row; xp = 2×coins; cheated results saved with `cheated=true` and earn 0 unless `cheats_on_boards`; `STAGE_LEVEL` gates Circuit Forge / Logic Labyrinth chapters by level. `Arcade.report()` skips the call if `__gmSession.cheated && !boards`, and queues offline on network error |
| POST `api/buy/` | `api_buy` | `{item}` (SHOP id) | cosmetic shop, coins only |
| POST `api/equip/` | `api_equip` | `{item}` | |
| POST `api/privacy/` | `api_privacy` | `{on_leaderboard: bool}` | |
| POST `api/hero/` | `api_hero` | `{slug, code}` → `{ok, name}` / `{ok:false, wait?}` | pbkdf2 check (see `data/seed/heroes.json`); 8 wrong tries per profile and per IP per 10 min |
| POST `api/room/` | `api_room` → `rooms.sync` | `{code, name, st, ev[], since}` → `{me, now, players[{id,n,st}], ev[]}` | FSLG only; cache-only relay; ≤6 players, stale after 8 s, room TTL 120 s, ≤40 events, ≤5 events per post, fixed chat phrase indexes (10), vehicles/emotes whitelists, co-op snapshot ≤1000 chars |
| GET `api/package/<slug>/` | `api_package` → `offline.package` | → `{slug,title,version,page,lan_page,lan,files[{u,b,s}],sounds{ogg[],m4a[]},voices{…},size,shared_size,voice_size}` | `no-store` |
| GET `api/packages/` | `api_packages` | → `{games:[{slug,title,version,size,shared_size,page}]}` | "Download all" |
| POST `api/sync/` | `api_sync` | `{items:[{cid, kind:"result", at(ms), data:<result body>}]}` → `{done[], rejected[{cid,error}], me}` | ≤40 items/request, ≤60/day/player, ≤14 days old; idempotent by `cid` (OfflineSubmission) |
| GET `api/fslg/` | `fslg_admin.api_bundle` | → FSLG overrides bundle (config, credits, characters), ETag = version | read by `samaru-overrides.js` at start-up |
| GET `api/sounds/<slug>/`, GET `api/sounds/<slug>/file/<name>/` | `games.sounds` | super-admin global sound replacements list + file | read by `arcade-sounds.js` |
| GET `lan/` | `lan_page` | standalone page opened from the pairing QR | FSLG Wi-Fi play (WebRTC via arcade-lan.js; `api/room/` is the online relay) |
| GET `manifest.webmanifest`, `play/<slug>/manifest.webmanifest` | `manifest_view` | PWA manifests; icons `img/games/<slug>[-maskable]-{192,512}.png`; FSLG name from config | public, cache 1 h |

Other pages: `/arcade/` index (shelves by level), `/arcade/leaderboard/` (`progress.leaderboard`, weekly + all-time, `xp_board`; names shown as first name + initial, only `on_leaderboard`), `/arcade/guest/` (guest sign-in: name + reg no + 4–6 digit PIN, pbkdf2 PIN hash, 10 failures/IP/15 min, expiry `games.guest_days`).

**Progress model to recreate (Drizzle):** `arcade_profile(user_id|guest_id unique, xp, coins, owned json, equipped json, badges json, stats json {slug:{plays,wins,best,stages[],last}}, on_leaderboard)`, `arcade_score(profile_id, game, score, cheated, created; index (game, score desc))`, `arcade_guest(...)`, `arcade_offline_submission(cid unique, …)`. Level = `floor((sqrt(1+8xp/100)-1)/2)+1`; ranks Apprentice → Fellow every 2 levels. Constants (SHOP 17 items, BADGES, MAX_STAGE, FINAL) are in `games/progress.py:12-71` — copy verbatim.

## 3. Offline (`games/offline.py`, `static/sw.js`, `arcade-offline.js`)

"Download for offline" fetches `api/package/<slug>/`, then the play page + every listed file into Cache Storage `ee-arcade-<slug>`; `static/sw.js` serves from it offline (and serves hashed statics/pictures/sounds from cache even online). Package = COMMON (`css/games.css` + the 5 shell scripts) + LAN files for FSLG + three.js for FSLG + the game's scripts/packs + statics referenced by `games/play.html`, `base_app.html`, `base_guest.html` (and CSS `url()`s) + `games/offline_assets/<slug>.txt` declared extras + sfx clips (per-game pack + core, ogg and m4a lists; device picks one) + FSLG voice clips (`audio/voice/`). `version` = sha256 over all bytes + play.html, first 12 hex chars → "Update available". Results played offline are queued and replayed via `api/sync/`. A test (`games/tests/test_offline.py`) fails when a page references a static not in its package — keep an equivalent test.

Shared audio: `static/audio/sfx/manifest.json` (`core` 37 names, `packs` for 10 games, `formats`, `v`), files under `static/audio/sfx/{core,cup,wave,puzzle,fslg,fslg3,fslg_water}/`, CC0 credits in `static/audio/sfx/CREDITS.md`. FSLG voice: `static/audio/voice/manifest.json`, `tags.json`, `intro/*.ogg|m4a`; intro film audio `static/audio/fslg-intro/` (+ `score.json`).

## 4. Per-game reference

Auto-scanned from each game's own files; "Static assets referenced" lists literal `img/ audio/ data/ …` paths in code (most games draw procedurally). Save keys are those found via `Arcade.store("<key>")` (stored as `ee-arcade-<key>`) — a game may also build keys dynamically, so treat the list as a minimum. Cheat counts and hashes: `data/seed/cheats.json`.

### Momentum Cup (`momentum-cup`)

- **Level / courses:** 100 · PHYS 111 · Scientist head-football · accent `#3dd68c` · order 0
- **Entry script:** `static/js/games/kickoff.js` (118 KB) · total JS 143 KB in 2 files
- **Deps (load order, before the entry):** `kickoff-career` (24 KB)
- **Game globals (window.*, defined or shared between its files; plus `window.Arcade` from the shell):** `window.KickCareerUI`, `window.MomentumCareer`, `window.MomentumCup`
- **Static assets referenced in code:** none (procedural drawing)
- **Sounds:** per-game pack `momentum-cup` in static/audio/sfx/manifest.json (8 names) + core set
- **Save keys:** Arcade.store → localStorage `ee-arcade-<key>`: `cup-best`, `kick-career`, `kick-p1`, `kick-tut`; settings `ee-arcade-set-momentum-cup`; sound prefs `ee-arcade-snd-momentum-cup`
- **Server calls:** `Arcade.report()` → POST api/result/ · stage range 1–6
- **Offline extras** (games/offline_assets): none
- **Cheats/rules:** see data/seed/cheats.json; 0 admin rules

### Impulse Arena (`impulse-arena`)

- **Level / courses:** 100 · PHYS 111 · Scientist arena fighter · accent `#f6c445` · order 1
- **Entry script:** `static/js/games/clash.js` (139 KB) · total JS 279 KB in 3 files
- **Deps (load order, before the entry):** `clashdata` (124 KB), `clashcareer` (15 KB)
- **Game globals (window.*, defined or shared between its files; plus `window.Arcade` from the shell):** `window.ClashCareer`, `window.ClashData`, `window.ImpulseArena`
- **Static assets referenced in code:** none (procedural drawing)
- **Sounds:** per-game pack `impulse-arena` in static/audio/sfx/manifest.json (8 names) + core set
- **Save keys:** Arcade.store → localStorage `ee-arcade-<key>`: —; settings `ee-arcade-set-impulse-arena`; sound prefs `ee-arcade-snd-impulse-arena`
- **Server calls:** `Arcade.report()` → POST api/result/ · stage range 1–100
- **Offline extras** (games/offline_assets): none
- **Cheats/rules:** see data/seed/cheats.json; 0 admin rules

### Volt City (`volt-city`)

- **Level / courses:** 100 · PHYS 122 · Open-world lite: charge puzzles · accent `#7ef0ff` · order 2
- **Entry script:** `static/js/games/fieldbound.js` (154 KB) · total JS 217 KB in 4 files
- **Deps (load order, before the entry):** `fieldsim` (4 KB), `voltworld` (33 KB), `voltlab` (26 KB)
- **Game globals (window.*, defined or shared between its files; plus `window.Arcade` from the shell):** `window.VoltCity`, `window.VoltLab`, `window.VoltSim`, `window.VoltWorld`
- **Static assets referenced in code:** none (procedural drawing)
- **Sounds:** per-game pack `volt-city` in static/audio/sfx/manifest.json (4 names) + core set
- **Save keys:** Arcade.store → localStorage `ee-arcade-<key>`: `kick-p1`, `volt2`; settings `ee-arcade-set-volt-city`; sound prefs `ee-arcade-snd-volt-city`
- **Server calls:** `Arcade.report()` → POST api/result/ · stage range 1–12 · final badge `ring-restored` at stage 12
- **Offline extras** (games/offline_assets): none
- **Cheats/rules:** see data/seed/cheats.json; 0 admin rules

### Kinetic Kingdom (`kinetic-kingdom`)

- **Level / courses:** 100 · PHYS 111 · Side-scrolling platformer · accent `#4ade80` · order 3
- **Entry script:** `static/js/games/platformer.js` (146 KB) · total JS 252 KB in 2 files
- **Deps (load order, before the entry):** `platformer-levels` (107 KB)
- **Game globals (window.*, defined or shared between its files; plus `window.Arcade` from the shell):** `window.KineticKingdom`, `window.KineticLevels`
- **Static assets referenced in code:** none (procedural drawing)
- **Sounds:** per-game pack `kinetic-kingdom` in static/audio/sfx/manifest.json (4 names) + core set
- **Save keys:** Arcade.store → localStorage `ee-arcade-<key>`: `kk`, `kk-g-`; settings `ee-arcade-set-kinetic-kingdom`; sound prefs `ee-arcade-snd-kinetic-kingdom`
- **Server calls:** `Arcade.report()` → POST api/result/ · stage range 1–41 · final badge `kingdom-restored` at stage 16
- **Offline extras** (games/offline_assets): none
- **Cheats/rules:** see data/seed/cheats.json; 0 admin rules

### Wavefront (`wavefront`)

- **Level / courses:** 100 · PHYS 124, PHYS 122 · Run-and-gun wave shooter · accent `#7ef0ff` · order 4
- **Entry script:** `static/js/games/shooter.js` (127 KB) · total JS 168 KB in 2 files
- **Deps (load order, before the entry):** `shooterdata` (41 KB)
- **Game globals (window.*, defined or shared between its files; plus `window.Arcade` from the shell):** `window.Wavefront`, `window.WavefrontData`
- **Static assets referenced in code:** none (procedural drawing)
- **Sounds:** per-game pack `wavefront` in static/audio/sfx/manifest.json (5 names) + core set
- **Save keys:** Arcade.store → localStorage `ee-arcade-<key>`: `wavefront`; settings `ee-arcade-set-wavefront`; sound prefs `ee-arcade-snd-wavefront`
- **Server calls:** `Arcade.report()` → POST api/result/ · stage range 1–12 · final badge `wavefront-hero` at stage 12
- **Offline extras** (games/offline_assets): none
- **Cheats/rules:** see data/seed/cheats.json; 0 admin rules

### Freshers School Life (`samaru-days`)

- **Level / courses:** 100 · PHYS 111, ENGG 102 · 3D open-world school life · accent `#f59e0b` · order 5
- **Entry script:** `static/js/games/samaru.js` (5 KB) · total JS 2.4 MB in 58 files
- **Deps (load order, before the entry):** `fslg-map` (61 KB), `samaru-sim` (70 KB), `samaru-data` (88 KB), `fslg.config` (1 KB), `fslg-story-y1` (160 KB), `fslg-story-y2` (57 KB), `fslg-story-y3` (55 KB), `fslg-story-y4` (55 KB), `fslg-story-y5` (56 KB), `fslg-story-side` (76 KB), `fslg-story-coop` (117 KB), `fslg-story-choices` (37 KB), `fslg-story-likes` (27 KB), `samaru-draw` (32 KB), `samaru-core` (121 KB), `samaru-story` (69 KB), `samaru-overrides` (33 KB), `samaru-intro` (64 KB), `samaru-3d` (93 KB), `samaru-anim` (91 KB), `samaru-wardrobe` (32 KB), `samaru-veh` (86 KB), `samaru-fx` (26 KB), `samaru-touch` (25 KB), `samaru-settings` (5 KB), `samaru-guide` (36 KB), `samaru-moment` (16 KB), `samaru-life` (33 KB), `samaru-interior` (72 KB), `samaru-mall` (49 KB), `samaru-friends` (28 KB), `samaru-brawl` (21 KB), `samaru-jobs` (16 KB), `samaru-crowd` (14 KB), `samaru-city` (32 KB), `samaru-ui` (45 KB), `samaru-inv` (59 KB), `samaru-phone` (70 KB), `samaru-texts` (23 KB), `samaru-travel` (13 KB), `samaru-wild` (20 KB), `samaru-map` (31 KB), `samaru-voice` (15 KB), `samaru-minigames` (87 KB), `samaru-audio` (15 KB), `samaru-water` (99 KB), `samaru-kit` (13 KB), `samaru-switch` (26 KB), `samaru-conseq` (12 KB), `samaru-romance` (42 KB), `samaru-prosper` (0 KB), `samaru-cook` (0 KB), `samaru-workshop` (0 KB), `samaru-maker` (0 KB), `samaru-weather` (0 KB), `samaru-worldlife` (0 KB), `samaru-saves` (15 KB)
- **three.js:** `static/vendor/three@0.158.0/build/three.module.min.js (ES module URL passed via data-gm-three; loaded by the game)`
- **Prod bundle:** `static/js/games/fslg.bundle.js` replaces all deps when fresh (games/bundle.py); ignored by git in MIB-Hub (`fslg.bundle.js`).
- **Extra page scripts:** `static/vendor/qrcode-generator@1.4.4/qrcode.js`, `static/js/games/arcade-lan.js`
- **Game globals (window.*, defined or shared between its files; plus `window.Arcade` from the shell):** `window.FSLGCoop`, `window.GameConfig`, `window.SamaruData`, `window.SamaruDraw`, `window.SamaruGame`, `window.SamaruMap`, `window.SamaruSim`
- **Static assets referenced in code:** none (procedural drawing)
- **Sounds:** per-game pack `samaru-days` in static/audio/sfx/manifest.json (82 names) + core set
- **Save keys:** Arcade.store → localStorage `ee-arcade-<key>`: `fslg-hero`, `fslg-look`, `fslg-save`, `samaru-flat`, `samaru-gfx`, `samaru-gfx-manual`; settings `ee-arcade-set-samaru-days`; sound prefs `ee-arcade-snd-samaru-days`
- **Server calls:** `Arcade.report()` → POST api/result/; `fslg/`, `room/` · stage range 1–120 · final badge `light-of-samaru` at stage 17
- **Offline extras** (games/offline_assets): `audio/voice/intro/`, `audio/fslg-intro/`
- **Cheats/rules:** see data/seed/cheats.json; 17 admin rules (warnings, window, warnExpire, guards, guardSpeed, sight, search, decay, fine, fareBase, farePerKm, fareMax, kekeFactor, wildWarn, wildLimit, wildPatience, wildFine)

### Motorworks Trails (`motorworks`)

- **Level / courses:** 300 · EEEN 309 · Open-world lite: workshop · accent `#f6c445` · order 6
- **Entry script:** `static/js/games/motorworks.js` (30 KB) · total JS 51 KB in 2 files
- **Deps (load order, before the entry):** `motorsim` (21 KB)
- **Game globals (window.*, defined or shared between its files; plus `window.Arcade` from the shell):** `window.MotorSim`, `window.Motorworks`
- **Static assets referenced in code:** none (procedural drawing)
- **Sounds:** core set only
- **Save keys:** Arcade.store → localStorage `ee-arcade-<key>`: `motorworks`; settings `ee-arcade-set-motorworks`; sound prefs `ee-arcade-snd-motorworks`
- **Server calls:** `Arcade.report()` → POST api/result/ · stage range 1–30 · final badge `workshop-master` at stage 30
- **Offline extras** (games/offline_assets): none
- **Cheats/rules:** see data/seed/cheats.json; 0 admin rules

### Gridkeepers: Storm Map (`storm-map`)

- **Level / courses:** 300 · EEEN 327 · Open-world lite: grid restoration · accent `#ffd84a` · order 7
- **Entry script:** `static/js/games/stormmap.js` (24 KB) · total JS 52 KB in 2 files
- **Deps (load order, before the entry):** `gridsim` (28 KB)
- **Game globals (window.*, defined or shared between its files; plus `window.Arcade` from the shell):** `window.GridSim`, `window.StormMap`
- **Static assets referenced in code:** none (procedural drawing)
- **Sounds:** core set only
- **Save keys:** Arcade.store → localStorage `ee-arcade-<key>`: `stormmap`; settings `ee-arcade-set-storm-map`; sound prefs `ee-arcade-snd-storm-map`
- **Server calls:** `Arcade.report()` → POST api/result/ · stage range 1–26 · final badge `gridkeeper` at stage 26
- **Offline extras** (games/offline_assets): none
- **Cheats/rules:** see data/seed/cheats.json; 0 admin rules

### Induction Dash (`induction-dash`)

- **Level / courses:** 100 · PHYS 122, ENGG 205 · Magnet-cart runner · accent `#ffd86b` · order 8
- **Entry script:** `static/js/games/dash.js` (37 KB) · total JS 45 KB in 2 files
- **Deps (load order, before the entry):** `inductionsim` (9 KB)
- **Game globals (window.*, defined or shared between its files; plus `window.Arcade` from the shell):** `window.InductionDash`, `window.InductionSim`
- **Static assets referenced in code:** none (procedural drawing)
- **Sounds:** per-game pack `induction-dash` in static/audio/sfx/manifest.json (4 names) + core set
- **Save keys:** Arcade.store → localStorage `ee-arcade-<key>`: `dash`, `kick-p1`; settings `ee-arcade-set-induction-dash`; sound prefs `ee-arcade-snd-induction-dash`
- **Server calls:** `Arcade.report()` → POST api/result/ · stage range 1–30 · final badge `dash-champion` at stage 30
- **Offline extras** (games/offline_assets): none
- **Cheats/rules:** see data/seed/cheats.json; 0 admin rules

### Logic Labyrinth (`logic-labyrinth`)

- **Level / courses:** 300 · EEEN 307, EEEN 405 · Logic puzzle-platformer · accent `#7ef0ff` · order 9
- **Entry script:** `static/js/games/logic.js` (67 KB) · total JS 125 KB in 4 files
- **Deps (load order, before the entry):** `logicsim` (14 KB)
- **Level packs** (loaded only if viewer level ≥ pack level; else listed in `data-gm-locked`): 300: `logic-300`, 400: `logic-400`
- **Game globals (window.*, defined or shared between its files; plus `window.Arcade` from the shell):** `window.LogicLabyrinth`, `window.LogicSim`
- **Static assets referenced in code:** none (procedural drawing)
- **Sounds:** per-game pack `logic-labyrinth` in static/audio/sfx/manifest.json (4 names) + core set
- **Save keys:** Arcade.store → localStorage `ee-arcade-<key>`: `logic`; settings `ee-arcade-set-logic-labyrinth`; sound prefs `ee-arcade-snd-logic-labyrinth`
- **Server calls:** `Arcade.report()` → POST api/result/ · stage range 1–40 · final badge `logic-master` at stage 40
- **Offline extras** (games/offline_assets): none
- **Cheats/rules:** see data/seed/cheats.json; 0 admin rules

### Signal Surfer (`signal-surfer`)

- **Level / courses:** 300 · EEEN 342 · Wave arcade · accent `#7ef0ff` · order 10
- **Entry script:** `static/js/games/surfer.js` (18 KB) · total JS 36 KB in 3 files
- **Deps (load order, before the entry):** `labkit` (8 KB), `signalsim` (11 KB)
- **Game globals (window.*, defined or shared between its files; plus `window.Arcade` from the shell):** `window.LabKit`, `window.SignalSim`, `window.SignalSurfer`
- **Static assets referenced in code:** none (procedural drawing)
- **Sounds:** core set only
- **Save keys:** Arcade.store → localStorage `ee-arcade-<key>`: `surfer`; settings `ee-arcade-set-signal-surfer`; sound prefs `ee-arcade-snd-signal-surfer`
- **Server calls:** `Arcade.report()` → POST api/result/ · stage range 1–26 · final badge `signal-master` at stage 26
- **Offline extras** (games/offline_assets): none
- **Cheats/rules:** see data/seed/cheats.json; 0 admin rules

### Circuit Forge (`circuit-forge`)

- **Level / courses:** 100 · PHYS 162, PHYS 122, ENGG 205, EEEN 309, EEEN 415, EEEN 527 · Circuit puzzle, 100 to 500 level · accent `#e9c46a` · order 11
- **Entry script:** `static/js/games/forge.js` (34 KB) · total JS 93 KB in 7 files
- **Deps (load order, before the entry):** `circuitsim` (21 KB), `circuit-100` (6 KB)
- **Level packs** (loaded only if viewer level ≥ pack level; else listed in `data-gm-locked`): 200: `circuit-200`, 300: `circuit-300`, 400: `circuit-400`, 500: `circuit-500`
- **Game globals (window.*, defined or shared between its files; plus `window.Arcade` from the shell):** `window.CircuitForge`, `window.CircuitSim`
- **Static assets referenced in code:** none (procedural drawing)
- **Sounds:** per-game pack `circuit-forge` in static/audio/sfx/manifest.json (4 names) + core set
- **Save keys:** Arcade.store → localStorage `ee-arcade-<key>`: `forge`; settings `ee-arcade-set-circuit-forge`; sound prefs `ee-arcade-snd-circuit-forge`
- **Server calls:** `Arcade.report()` → POST api/result/ · stage range 1–51 · final badge `master-electrician` at stage 51
- **Offline extras** (games/offline_assets): none
- **Cheats/rules:** see data/seed/cheats.json; 0 admin rules

### Light Bender (`light-bender`)

- **Level / courses:** 100 · PHYS 124, PHYS 162 · Laser-and-mirror puzzle · accent `#ff8080` · order 12
- **Entry script:** `static/js/games/bender.js` (32 KB) · total JS 72 KB in 3 files
- **Deps (load order, before the entry):** `opticsim` (25 KB), `bender-levels` (16 KB)
- **Game globals (window.*, defined or shared between its files; plus `window.Arcade` from the shell):** `window.LightBender`, `window.OpticSim`
- **Static assets referenced in code:** none (procedural drawing)
- **Sounds:** per-game pack `light-bender` in static/audio/sfx/manifest.json (4 names) + core set
- **Save keys:** Arcade.store → localStorage `ee-arcade-<key>`: `bender`; settings `ee-arcade-set-light-bender`; sound prefs `ee-arcade-snd-light-bender`
- **Server calls:** `Arcade.report()` → POST api/result/ · stage range 1–45 · final badge `optics-ace` at stage 45
- **Offline extras** (games/offline_assets): none
- **Cheats/rules:** see data/seed/cheats.json; 0 admin rules

### Maglev Rescue (`maglev-rescue`)

- **Level / courses:** 300 · EEEN 320 · Magnetic-control challenge · accent `#a78bfa` · order 13
- **Entry script:** `static/js/games/maglev.js` (18 KB) · total JS 38 KB in 3 files
- **Deps (load order, before the entry):** `labkit` (8 KB), `maglevsim` (11 KB)
- **Game globals (window.*, defined or shared between its files; plus `window.Arcade` from the shell):** `window.LabKit`, `window.MaglevRescue`, `window.MaglevSim`
- **Static assets referenced in code:** none (procedural drawing)
- **Sounds:** core set only
- **Save keys:** Arcade.store → localStorage `ee-arcade-<key>`: `maglev`; settings `ee-arcade-set-maglev-rescue`; sound prefs `ee-arcade-snd-maglev-rescue`
- **Server calls:** `Arcade.report()` → POST api/result/ · stage range 1–26 · final badge `line-restored` at stage 26
- **Offline extras** (games/offline_assets): none
- **Cheats/rules:** see data/seed/cheats.json; 0 admin rules

### Algorithm Garage (`algorithm-garage`)

- **Level / courses:** 300 · EEEN 316 · Programming robot challenge · accent `#7ef0ff` · order 14
- **Entry script:** `static/js/games/garage.js` (21 KB) · total JS 221 KB in 4 files
- **Deps (load order, before the entry):** `js/matlab/mlab` (86 KB), `js/matlab/mlab-lib` (89 KB), `garagesim` (25 KB)
- **Game globals (window.*, defined or shared between its files; plus `window.Arcade` from the shell):** `window.AlgorithmGarage`, `window.GarageSim`
- **Static assets referenced in code:** none (procedural drawing)
- **Sounds:** core set only
- **Save keys:** Arcade.store → localStorage `ee-arcade-<key>`: `garage`; settings `ee-arcade-set-algorithm-garage`; sound prefs `ee-arcade-snd-algorithm-garage`
- **Server calls:** `Arcade.report()` → POST api/result/ · stage range 1–26 · final badge `robot-whisperer` at stage 26
- **Offline extras** (games/offline_assets): none
- **Cheats/rules:** see data/seed/cheats.json; 0 admin rules

### Drive Room (`drive-room`)

- **Level / courses:** 500 · EEEN 524 · Motor-control sim · accent `#ffb347` · order 15
- **Entry script:** `static/js/games/driveroom.js` (19 KB) · total JS 44 KB in 3 files
- **Deps (load order, before the entry):** `labkit` (8 KB), `drivesim` (17 KB)
- **Game globals (window.*, defined or shared between its files; plus `window.Arcade` from the shell):** `window.DriveRoom`, `window.DriveSim`, `window.LabKit`
- **Static assets referenced in code:** none (procedural drawing)
- **Sounds:** core set only
- **Save keys:** Arcade.store → localStorage `ee-arcade-<key>`: `driveroom`; settings `ee-arcade-set-drive-room`; sound prefs `ee-arcade-snd-drive-room`
- **Server calls:** `Arcade.report()` → POST api/result/ · stage range 1–26 · final badge `chief-engineer` at stage 26
- **Offline extras** (games/offline_assets): none
- **Cheats/rules:** see data/seed/cheats.json; 0 admin rules
## 5. Notes and gotchas for the port

- **Six FSLG files are empty stubs** (≈100 bytes, `(function(){ "use strict"; })();`): `samaru-prosper`, `samaru-cook`, `samaru-workshop`, `samaru-maker`, `samaru-weather`, `samaru-worldlife` ("being built; see samaru-kit.js"). They are still in the load order; keep or drop together with the catalogue entry.
- FSLG story files `fslg-story-*.js` are generated by `tools/story/build_*.py` from `docs/story/scripts/*.md` — do not hand-edit; port the generator or freeze the output.
- `fslg.config.js` is the single source of the default game name/branding; `games/fslg_admin.py` reads the same JSON as its defaults; the in-game text uses tokens `{{GAME_NAME}}`, `{{GAME_INITIALS}}`, `{{TAGLINE}}`, `{{CURRENCY}}`, `{{PLAYER_NAME}}`.
- `fslg.bundle.js` is a build artefact (`python manage.py build_fslg`); MIB-Hub's `.gitignore` already ignores it. Rebuild it in the new pipeline (simple concatenation in dep order, comment stripping skipped for files containing backticks).
- Cheat hashes are embedded in each game's script between `/*CH[*/` and `/*]CH*/` by `games/cheat_defaults/build.py`, and also sent in `data-gm-config`. Keep `sha256(slug + ":" + norm(code))` or both sides break.
- Algorithm Garage depends on `static/js/matlab/mlab.js` and `mlab-lib.js` (shared with the MATLAB academy), outside `js/games/`.
- `three.js` 0.158.0 is loaded by URL from `data-gm-three` (ES module, dynamic import inside the game), not by a script tag.
- Feature flag `features.games` gates the whole arcade (code default off; currently on in the DB). Level gating: see `data/seed/site_settings.json` → `access_rules`.
- Management/admin JS (`static/js/games/fslg-admin.js`) belongs to MANAGEMENT.md, not to the play page.
