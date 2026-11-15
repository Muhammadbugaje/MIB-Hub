# FSLG state

Current phase, last done, next tasks, decisions (MASTER_GAME_GUIDE §3.4). Updated 14 Nov 2026 by the audit worker.

## Phase

**Phase 0 (audit)** delivered: `docs/AUDIT.md`, waiting for the owner's approval. Work that belongs to later phases is
already running in parallel (story fixes, vehicle anchors, animation, config/credits), so this file tracks all of it.

## Who owns what right now

| worker | area | files |
|---|---|---|
| story | Year 1 generator and story data, story engine; fixing m1/m4 (done), Shamsu | `tools/story/build_y1.py`, `fslg-story-*.js`, `samaru-story.js`, `samaru-intro.js` |
| vehicles | models, motion, seat anchors, head clearance | `samaru-veh.js` |
| animation | figure, poses, clips | `samaru-anim.js` |
| admin editors | game config, tokens, credits, character overrides | `samaru-overrides.js`, `games` config/credits views and templates |
| audit (this file) | validator, bots, audit docs | `games/tests/fslg_validator.js`, `fslg_bot.js`, `test_fslg_validator.py`, `docs/AUDIT.md`, `docs/STATE.md`, `docs/VALIDATOR_REPORT.md`, `KNOWN_ISSUES.md` |
| unassigned | core loop/HUD/interact (shared file: small exact edits only), people (melee, chase), map/interiors | `samaru-core.js`, `samaru-brawl.js`, `samaru-interior.js`, `fslg-map.js` |

## Last done

- Audit tools: validator (§4.6, live arrow/marker/HUD for every main step, `npcAt` honoured in the travel table),
  replay bot m1–m10 with save/reload at every step, monkey bot, save-version test.
- Core slice by the audit worker (14 Nov), small exact edits:
  - `samaru-core.js`: `Z.objective()` / `Z.objText()` (163-172), the one reader for HUD text, distance readout, minimap star,
    2D beacon and route (343, 691, 767, 784, 793); `Z.target` resolves `@` people and falls back for `class`, `eat`, `job`
    (155-160); `talkable()` (421-425) used by `interact()` (430, 433) and `Z.prompt` (439, 442); `saveVersion` with
    `Z.SAVE_VERSION`/`Z.SAVE_MIGRATIONS` in `Z.load`/`Z.save` (56-69). The 3D beam (`samaru-3d.js:388`) and full map
    (`samaru-map.js:87`) call `Z.target()`, which is the same value as `Z.objective().target`.
  - `samaru-story.js`: retired people hidden every tick (234); collect rebuilds only the items not yet found, indices
    saved in `P.story.collect` (267, 372); `ST.ctx` reset on `Z.begin` (587).
- Save slots (owner request, audit worker): `static/js/games/samaru-saves.js` (new): 5 manual slots, an autosave slot
  written when you sleep at your hostel, and "Last played" (the existing `fslg-save`). Each card: 160×90 JPEG snapshot
  (~5 KB), mission number and name, year, day, in-game time, money, level, play time (`P.playS`), real date. Save, Load,
  Overwrite and Delete, each destructive one confirmed; loading mid-game asks first. Saving is refused during the opening
  film, cutscene beats (`hud: false`), moments, conversations, races, jobs, dates, chases, flights and mid-step. Every slot
  loads through `Z.upgrade` (saveVersion migrations). Storage: localStorage per user (`data-gm-user` on the play page),
  one key per slot, quota handling (drops the picture, then refuses without overwriting), memory fallback with a notice in
  private browsing. Local only: `/arcade/api/sync/` carries game results, not saves.
  Entry points (small edits): title "Saves" (`samaru-ui.js`), phone app "Saves" (`samaru-phone.js` APPS, icon, launch),
  pause dialog "Saves" (`arcade.js`, generic `game.saves` hook; `samaru.js` provides it). Also `games/catalogue.py` deps,
  `samaru_harness.js` list, `templates/games/play.html` (`data-gm-user`), `Z.upgrade` in `samaru-core.js`.
  Tests: `games/tests/test_fslg_saves.py` (+ `fslg_saves_harness.js`). Screenshots: `~/Downloads/FSLG_agent_images/saves/`.
- Fixed by other workers meanwhile and now guarded: finds at the gate, go-stall, find arrow, Maryam, Kaka, m2 breakfast,
  emote places, name literals, harness list.

## Test status

`export PATH="$HOME/.nvm/versions/node/v24.22.2/bin:$PATH"; .venv/bin/python -m pytest games/tests/test_fslg_validator.py -q`
Validator: 0 errors, 5 warnings, 49 review items. Replay bot: m1–m10 finished, 0 problems, 65 steps by play. Monkey:
no crash, soft-lock, fall or stuck spot. Results in `docs/VALIDATOR_REPORT.md`.

## Next tasks (in order)

1. Release: rebuild `fslg.bundle.js` (KI-017).
2. Show `Z.loadError` on the title screen (KI-029).
3. Vehicles: plane seat table (KI-022). Story: m120.1 ride vehicle (KI-030), text/place review list (KI-005), pacing (KI-024).
4. People: melee line of sight, chase routing; vehicles: ram cooldown, potholes (KI-028).
5. Phase 4: cutscene Director from the opening film (KI-023).
6. Extend the replay bot past m10 (the harness is fast enough for m1–m36 in about two minutes).

## Decisions

- The validator fails CI only on **new** errors; tracked ones carry a `KI-` id in `KNOWN` (validator) or `KNOWN_BOT`
  (test) and show as xfail. Remove an id when it is fixed so a regression fails loudly.
- Text-versus-place checks fail only on clear cases (a find/look placed at the Main Gate that nothing mentions, or a
  find/collect >400 m from the scene with no place named; `go`/`find` text naming exactly one other place >200 m away);
  everything fuzzier is listed for review.
- The monkey bot counts "stuck" only when no direction moves the player (pressing into a wall is not stuck); interiors
  are recognised (rooms live 6 km away), so entering one is not a fall.
- The validator loads catalogue scripts missing from the harness list (except the WebGL `samaru-3d`) and warns about it,
  rather than editing the shared harness.

## Phase 2 story systems (story-systems worker, progress log)

Files: `samaru-kit.js` (shared kit: spots, props, panels, chips), `samaru-switch.js`, `samaru-conseq.js`, `fslg-story-choices.js`
(overlays + consequences), then `samaru-romance/prosper/cook/workshop/maker/weather/worldlife.js`. Tests:
`games/tests/samaru_story2_harness.js` + `story2_*.part.js`, run by `test_samaru_story2.py`. Contract: `docs/story/ENGINE.md` §16.

- **Item 1 (choices) done:** 29 script choices added to side missions and m92 by anchored overlays; every pick is logged; 43
  consequences (texts days later, overheard lines, new greetings, weekly gifts, rumours) and a rumour mill (noticeboard by the Senate;
  the twins can set one straight). Year 1 choices were not touched (owned by the mission-review worker).
- **Item 2 (switch) done:** `switch` step type; 39 beats from the scripts (6 team beats: m55, m77, m86, m87, m103, m115); free-roam
  swap with a friend walking with you; 27 character skills; camera swoop; HUD chip; save version 3 moves old step indexes.
- **Item 9 (cutscene metadata) done for story beats:** every beat has `scene` = endState/maxDuration/skippable, a watchdog and E-to-skip;
  `ST.MOMENT_META` covers the 13 result cards (KI-023).
