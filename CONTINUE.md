# CONTINUE HERE (live handover)

**Last updated: 19 Nov 2026, session 4 (Momentum Cup close-out; everything committed and pushed).**
This file is kept up to date *while* work is happening. If you are a new session, read
`READ-CLAUDE.md` first, then this. `READ-CLAUDE.md` is the stable project map; this file is the
"where we are, what is uncommitted, what to do next" scratchpad.

---

## 1. TL;DR state

- **The tree is clean and pushed** (19 Nov, session 4). Everything from the 16–18 Nov sessions — the
  Momentum Cup rework, the arcade pad, the owner Game Studio page, the new base bodies and garments, the
  Tesla coil, the tree crowns — is committed in two commits and pushed to `origin/main`.
- The game is **PlayCanvas**, source in `games/work-in-progress/`. All 195 WIP tests pass
  (`npx vitest run games/work-in-progress/test`), typecheck passes
  (`npx tsc -p games/work-in-progress --noEmit`).
- The owner's requested order: **(1) characters → cast pictures, (2) map polish,
  (3) world animations.**
- Characters were rebuilt this session on the **Quaternius Universal Base Characters** (CC0),
  packed by `games/work-in-progress/tools/anim/pack-ubc.ts` into `assets/people2/`.
  Clothing is generated procedurally from the body mesh (`src/world/basebody.ts`).

## 2. What was finished in the previous session (16–17 Nov), now committed

- New realistic base bodies `assets/people2/` (2 GLBs + textures + `index.json`).
- `src/world/basebody.ts` — parse base GLB, cut garments out of the body surface, palette colours,
  skin tint. Wired into `src/world/people.ts` (`loadBases`, `outfitOf`, `STYLES`).
- `src/world/tesla-coil.ts` — the Garden coil as a dynamic hero prop + collision in `campus.ts`.
- Tree crowns rewritten as open leaf clusters with branches (`src/world/nature.ts`), trunk root flares.
- Animation: foot IK, stops, turns, jump/land, kerbs/stairs, crowd locomotion — all passing;
  log in `games/work-in-progress/docs/ANIM_PROGRESS.md` (steps 1–10 PASS).
- `tools/anim/pack-ubc.ts`, tests `test/basebody.test.ts`, `test/coil.test.ts`.

## 3. What THIS session changed (17 Nov)

### Clothing (fixes "clothes look like body paint")
`src/world/basebody.ts`, `makeGarments`:
- Garments now stand off the skin (shoes 8 mm, trousers 13 mm, tops 15 mm).
- **Proper polygon clipping**: boundary triangles are subdivided and then clipped against the
  garment region (Sutherland–Hodgman + bisection on the region test). This replaced a
  vertex-snapping hack that produced the "torn/scalloped" neckline and hems.
- `drapeCloth()`: 5 Laplacian smoothing passes on the cloth shell (bridges anatomy grooves),
  hems/cuffs/seams anchored, offset tapered 25 %→100 % near the sewing line, and a clamp
  (0.18× standoff) so cloth never sinks into skin.
- Fabric normals are recomputed from the garment surface, not borrowed from muscles.

### Hijab (fixes "hijabs look very bad")
`src/world/headwear.ts`:
- Head section is round again (the old "boxy cartoon head" power-warp pinched the cloth at the
  temples and let the **ears cut through** as skin-coloured patches — this was the real bug).
- Wraps widened (wrap pad 28 mm, gyale 30 mm, khimar 24 mm, undercap 19 mm), face ovals trimmed
  (`open` 0.90–0.92), fold amplitude reduced so hems are calm, no inward "tuck" at the face edge.
- **STATUS: needs one more visual check after the latest change** (build + shot below).

### Cast render mode (new)
`src/main.ts`: `?shot=1&cast=<castId>,<castId>` renders real cast members (look, height, width,
extras) instead of a placeholder look. `CAST` imported from `src/game/cast.ts`.
Example: `cast=npc.zainab&anim=idle&t=1&lod=0&cz=0.85&cy=1.6&ly=1.58`.

## 3b. What THIS session changed (19 Nov)

Goal: close the previous session's two stated gaps — "the new animations and pad are proven not
to throw but not reviewed by eye" and "the studio page only appears after a deploy/seed".

- **`scripts/shot-page.py` (new tool).** Offscreen screenshots of pages *and* games that draw in
  `requestAnimationFrame`. Three things had to be worked around, all documented in the file:
  offscreen WebKit never fires rAF, it throttles timers to about 1 Hz (so `dt` clamps to 0.1 and a
  match crawls), and `takeSnapshot` returns the last *composited* layer, which never updates
  offscreen. So frames are queued and pumped by hand on a synthetic 60 Hz clock (`__pump(n)` in a
  step), and `--canvas` reads pixels back with `toDataURL`. Usage and examples are in its docstring.
- **HUD contrast fix, `apps/web/public/play/_shared/js/games/kickoff.js`, `hudStatic`.** In the day
  arenas the player name, power label and meter were white on a pale sky — the meter almost
  vanished and "Time Dilation" was unreadable over a cloud. Each player row now sits on a
  `rgba(4,12,18,.42)` scrim. Verified by still at 1109 px before and after.
- **`games/work-in-progress/test/basebody.test.ts`** — the known 5 s timeout. It called `expect`
  ~8 times per garment vertex; now one pass collecting faults and one assertion. Same strictness,
  113 ms instead of timing out.
- **Verified by eye (stills, all in `/tmp/shots`, not in git):** title/overlay → quick match → live
  frame with HUD, timer, both players and the ball; double-tap dash actually fires (player `dash`
  0.19→0.12, x 4.53→5.57) with the speed streaks; a 2–1 win credits exactly 91 coins
  (20 + 2×8 + 55) to the purse; the owner-only studio page renders its tuning fields and the
  hashed-codes note.
- **The round phone pad, seen at last (19 Nov, second pass).** The pad only shows when the page has
  `.gm-touch.is-on`, which `arcade.js` adds for `pointer: coarse`; offscreen WebKit is fine, so
  `scripts/shot-page.py --touch` fakes it. Reviewed at 390×844 and 844×390: both sticks/buttons
  build, sit in the safe areas and clear the pitch. Two labels ("low 25°", "lob 55°") overflowed
  their 40%-wide circles; now "25°" / "55°".
- **Sweep of every screen (19 Nov, second pass)** — screenshots in
  `~/Downloads/games-files/screenshots/wip/kickoff/` (outside git): menu, tutorial, career setup,
  career hub, outfits shop, live match with the physics readout, full time. Fixed what it found:
  - tutorial/flash text had a hard `.slice()` and cut words mid-sentence → `wrapLines()`, 2 lines max;
  - `<h3>` inside `.gm-dlg` was unstyled (dark text on a dark panel) and its default margins pushed
    **Create club** below the stage → styled in `games.css`; the club form is also tighter;
  - the outfits shop ran past the bottom of the stage so **Back to club** was unreachable without
    scrolling → `.gm-grid2`, two columns above 760 px, one row per kit;
  - career hub said "Season starts" as a chip → "Preseason".
- **Known, not fixed:** in portrait the 16:9 stage is a thin strip with black bands (no rotate
  hint); the pad overlaps the goal mouth on a narrow landscape stage; the guest "Sign in to save"
  toast sits over the pitch and can cover the right-hand player; shoes still read as socks.
- **Checks run:** `npx vitest run` → **471/471 pass** (was 469 pass, 1 fail); `astro check` 0 errors;
  `tsc -p games/work-in-progress --noEmit` clean; eslint on the changed test clean.

## 3c. 19 Nov, third pass — controls, art, portrait

Owner's asks, all done and screenshotted in `~/Downloads/games-files/screenshots/wip/kickoff/`:

- **Buttons in a row, not a diamond.** `mib-pad.js` gained `layout: "row"` in the pad spec: the action
  buttons sit in a flat row along the bottom, and the one marked `pos:"top"` (jump) stacks above the
  right-most one. Momentum Cup uses it (`04-pad-row.jpg`). The diamond is still the default for the
  other games. Two gotchas worth knowing: `arcade.js` rebuilds the pad spec before handing it to
  `MIBPad.build`, so any new spec field must also be copied there; and the row's buttons live in a
  full-stage `.mp-btns-shell` so a saved layout (a percentage of the *stage*) lands in the same place
  after a rebuild instead of a percentage of the small button box.
- **Drag and resize each control, per player.** Every action button is now its own `[data-lay]` item
  (`pad-kick`, `pad-lob`, `pad-power`, `pad-jump`) next to `pad-dpad`, so Settings > Layout gives each
  one its own Size and Opacity sliders, Hide, and per-orientation saving (the editor already did this
  for free once the items existed). Verified end to end: dragged kick 90 px, saved, reloaded — it came
  back at the dragged spot. `drawTouch()` now refuses to rebuild while `stage.gms-editing`, because the
  editor holds live element references.
- **Character art.** In `drawPlayer`: the shin was drawn entirely in sock colour with a white blob boot,
  so leg + boot read as one long sock. Now the thigh and calf stay skin to mid-shin, the club sock
  starts there with a colour turn-over, and the boot is dark leather with a pale sole and a rim. The
  shorts were one wide slab (a nappy) and are now two short legs with a crotch gap, and the resting
  stance splays so both legs and both boots read separately (`legs-zoom` shots in /tmp only).
- **Portrait hint.** `arcade.js` adds a `.gm-rotate` card ("Turn your phone sideways … Play like this",
  SVG phone icon) whenever the window is portrait and narrower than 820 px; it is dismissible for the
  session and hides itself when the phone is turned. Works for every arcade game, not just this one.

## 3d. 19 Nov, fourth pass — Momentum Cup close-out, everything committed

This pass touched **Momentum Cup and the arcade only**. The Work in Progress game was left exactly as the
previous session finished it (its hijab/garment work is still open — see §5.1).

- **Drive vs lob kick, reviewed side by side.** The interrupted check from the third pass is done: both kicks
  captured 6 frames after contact (leg at 0.14) with the ball placed at rest in front of the striker.
  Drive → body leans forward, boot swings low, turf streaks behind the boot, ball at 0.77 m. Lob → body leans
  back, ball at 1.31 m with the dotted arc. Frames: `12-drive-frame6.png`, `13-lob-frame6.png` in
  `~/Downloads/games-files/screenshots/wip/kickoff/` (outside git).
- **Two dead variables removed** (`chZ` in `world/headwear.ts`, `P` in `world/basebody.ts`) — they were the
  only two `eslint` errors in the tree, so `npm run lint` is clean again.

**Checks run (all green, on the exact tree that was committed):** `npm test` 471/471 · `npm run lint` clean ·
`npm run typecheck` (`tsc` x3 + `astro check`, 0 errors) · `npm run build` complete · `npx tsc -p
games/work-in-progress --noEmit` clean.

---

## 4. Exact commands (this Mac, disk often near full — check `df -h /System/Volumes/Data`)

```bash
export PATH=~/.nvm/versions/node/v24.22.2/bin:$PATH
cd /Users/macbookair/Downloads/MIB-Hub

# tests / types
npx vitest run games/work-in-progress/test
npx tsc -p games/work-in-progress --noEmit

# dev build (git-ignored output) + dev server (BACKGROUND; dies if not backgrounded)
WIP_OUT=dev npm run build:wip
npm run dev                       # http://localhost:4321

# stills (Playwright does NOT work on macOS 12; use this offscreen WKWebView)
WIP_OUT=dev ~/Downloads/eehub-2/.venv/bin/python -I \
  games/work-in-progress/tools/shot.py OUT.jpg \
  "cast=npc.zainab&anim=idle&t=1&lod=0&cz=0.85&cy=1.6&ly=1.58" \
  --width 800 --height 800
```
`WIP_OUT=dev` on **both** the build and the python shot command is required (the shot script
picks the dev URL from that env var).

Arcade games (canvas + rAF) need the other tool — it pumps frames by hand, so the match really
plays and `toDataURL` gives a live frame:

```bash
~/Downloads/eehub-2/.venv/bin/python -I scripts/shot-page.py OUT.png \
  http://localhost:4321/play/momentum-cup --canvas canvas \
  --step "4:[...document.querySelectorAll('button')].find(b=>/Play in this window/i.test(b.textContent)).click()" \
  --step "3:document.querySelector('[data-act=quick]').click(); __pump(3)" \
  --step "1:document.querySelector('[data-act=go]').click(); __pump(3)" \
  --step "1:document.querySelector('[data-act=kickoff]').click()" \
  --step "1:__pump(200)"
```

In a step, `__pump(n)` advances n frames, `__key(k, down)` and `__tap(k)` press keys, and the game
state is at `window.MomentumCup.S` (works for the 18 Nov features: dash, purse, hints).

## 5. What to do next, in order

> Before this list: the 18 Nov session reworked Momentum Cup (double-tap dash, removed dash
> button, phone diamond, kick buffering, richer animations, coin purse, custom players, owner
> studio page). 19 Nov reviewed it by eye, fixed the day-arena HUD and finished the kick-animation
> check. **All of it is committed and pushed.** Momentum Cup needs nothing more for now.

1. **Finish the character sheet.**
   - Rebuild and check Zainab (`npc.zainab`) head: the temple patches must be gone, the hijab
     must cover the ears and frame the face.
   - Then render **every cast member** in `games/work-in-progress/src/game/cast.ts` (about 34,
     including `special.jiya`, `special.taty`, `special.madison`) as individual portraits
     (e.g. 700×900, `cz≈2.6`, `cy≈1.35`, `ly≈1.2`) and a full-body shot.
   - Save them to `~/Downloads/games-files/screenshots/wip/characters/` (outside git; the owner
     wants copies, and real people's photos must never enter git).
   - Review them visually before showing the owner. Known rough spots: shoes still read as
     socks (they are the foot surface + 8 mm), the male base is very muscular,
     trousers still show a little knee/crotch anatomy.
2. **Map pass** (owner's complaints): pillars not touching the ground, a hole/gap near some
   building entrances, trees/grass on the soccer pitch and around the Tesla coil. Previous
   session already did tree crowns, coil solids, and some campus fixes — verify with stills
   (`view=aerial`, `view=street`, `?px=..&pz=..`) and fix what still shows.
3. **Animation pass**: route every downloaded Mixamo clip (inventory in
   `games/work-in-progress/docs/ANIM_INVENTORY.md`), add per-character variety (different idles,
   walks, gesture sets) so the crowd does not move in lockstep.
4. **Report to the owner**, then move to story/missions (10 missions exist; timing, locations and
   animations are inconsistent).

## 6. Rules that bit us / are easy to forget

- `npm run dev` started as a normal background shell dies when the tool call ends. Start it with
  the terminal tool's **BACKGROUND** process type.
- The shot tool times out silently if the dev server is down (empty title).
- Never put the reference photos or real people's data in git. First names only.
- Zainab is very fair ("Snow White"); skin tone is test-locked.
- Disk: renders and builds are fine, but check free space before big jobs.
- After editing `src/world/basebody.ts`, the garment mesh is built at load time, so a rebuild of
  the dev bundle is needed before screenshots change.
