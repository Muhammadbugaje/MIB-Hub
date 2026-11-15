# Known issues — Freshers School Life (FSLG)

Open bugs and limitations (MASTER_GAME_GUIDE §3.4). Each entry follows the bug format of §15.3: id, severity, area,
how it shows, suspected cause with file:line, suggested owner. Line numbers are as of 14 Nov 2026 and drift as files change.

The validator (`games/tests/fslg_validator.js`) and the bots (`games/tests/fslg_bot.js`) tag what they find with these ids.
`games/tests/test_fslg_validator.py` fails on any **new** error and lists the tracked ones in xfail tests, so they stay
visible in every run. When an issue is fixed, remove its id from `KNOWN` in the validator (or `KNOWN_BOT` in the test), so a
regression fails loudly. Current results: `docs/VALIDATOR_REPORT.md`.

Code TODOs: a search for `TODO|FIXME|XXX` in `static/js/games/samaru-*.js`, `fslg-*.js` and `tools/story/*.py` finds none.

## Open

Validator, latest run: 0 errors, 5 warnings, 49 review items. Replay bot m1–m10: 0 problems. Monkey (seeds 424242, 7): no
crash, soft-lock, fall or stuck spot.

| id | sev | area | issue | cause / where | owner |
|---|---|---|---|---|---|
| KI-005 | minor | story text | step text names a different place from the step's place (review list in the report, not failing), e.g. m3.6 "Fish the third book out of the fountain" at the Library | content; stand-in places (ENGINE_ISSUES.md) explain some | story |
| KI-017 | major | release | the production bundle is stale (`fslg.bundle.js` 13 Nov, 1.05 MB), so production serves 43 separate files (2.29 MB raw / 752 KB gzip vs one bundle, 690 KB gzip) | nobody re-ran `python -m games.bundle` (`games/bundle.py` `fresh()`) | coordinator (release step) |
| KI-022 | minor | vehicles | the plane's seat table is empty although `S.VEH.plane.seats = 1` (validator warning) | `Z.veh.SEATS` (`samaru-veh.js`) | vehicles |
| KI-023 | minor | cutscenes | only the opening declares `endState`/`maxDuration`/`skippable`; the 13 moments (`samaru-moment.js` `KIND`) have only `dur`; no step has `cutsceneBefore/After/OnEnter` | Phase 4 not started | Phase 4 |
| KI-024 | design | pacing | back-and-forth; worst missions in `docs/VALIDATOR_REPORT.md` (travel table, now with `npcAt`) | content | story (with the owner) |
| KI-027 | minor | performance | worst simulation step 242 ms (headless bench, shared machine); all 111 people tick every step (`friends.step`, `brawl.npc`), hidden ones included | `samaru-friends.js`, `samaru-brawl.js` | people |
| KI-028 | major | combat/vehicles | from the outside review, not checked by these tools: ram damage every frame with no cooldown, melee through walls (no `S.los`), enemies without routing, potholes ignore hops, two no-op lines in `samaru-veh.js` | `docs/FSLG_REVIEW.md` §4 | vehicles (ram, potholes, no-ops), people (melee, chase) |
| KI-029 | minor | save | a refused newer save sets `Z.loadError` and warns in the console, but the title screen does not show the message yet | `samaru-ui.js:23` reads `Z.load()` only | ui owner |
| KI-031 | minor | save | "Last played" (`fslg-save`, the old single save) is per device, not per user; the new slots are per user. Moving it needs a migration that reads the old key | `samaru-core.js:56-69` | core (decide with the owner) |
| KI-032 | minor | save | slot thumbnails come from the live canvases; the WebGL frame is re-rendered just before the copy (`Z.r3.render`), not yet checked in a real browser (headless has no canvas; the screenshots use stand-in pictures) | `samaru-saves.js` `SV.thumb` | audit worker (check on a device) |
| KI-030 | minor | story data | m120.1 `ride` names no vehicle | `fslg-story-y5.js` | story |

## Fixed and guarded (a regression fails the validator)

| id | issue | fixed by | guard |
|---|---|---|---|
| KI-001 | m1 "Unpack" and m4 "Find the torch" placed at the Main Gate (`build_y1.py` `last_place`) | story worker, 14 Nov (now `at: "@hostel"`) | `test_validator_catches_every_review_finding` puts the bug back and expects `DEFAULT_GATE`/`FIND_OFF_SCENE` |
| KI-003 | a `go` step to the place you stand on never fired (`Z.lastPlace` cached across steps) | core: the place is cached before the emit and reset at step start | validator engine probe (`goWhileStanding`), the injected stall must give `GO_STALL` for m8.1 and m9.3; the replay bot plays m7–m9 through `Z.update` |
| KI-012 | the arrow led to the place centre, not the item (drawn only within 18 m) | core: `Z.target` prefers `Z.quest` | `FIND_BEACON_OFF_GEM` check on every find step, and the bot's `ARROW_NOT_AT_ITEM` |
| — | Maryam at the Fire Station though she works at Page Turner Books | story (now `mk_books`) | `NPC_AT` check |
| KI-004 | raw `@roomie` on the HUD | audit worker, 14 Nov: `Z.objective()`/`Z.objText()` in `samaru-core.js` (163-172); the HUD, distance, minimap, 2D beacon and route read it | validator `HUD_TOKEN` + `OBJECTIVE_DIFFERS` on all steps; bot `HUD_TEXT` |
| KI-006 | no arrow for class/eat/job steps | story `ST.targetOf` (class → timetable room / `@dept`) and core `Z.target` fallbacks (`class → @dept`, `eat` → nearest food place, `job` → nearest jobs place; `samaru-core.js:155-160`) | validator live `NO_BEACON` |
| KI-013 | E talked to the first person within 3 m (and a parked bike beat the person you needed) | audit worker: `talkable()` in `samaru-core.js:421-425`: the step's person first (even over a vehicle), else the nearest; hidden/retired never; `interact()` 430, `Z.prompt` 439 | replay bot `STALL` on talk steps (m1–m10 now 0) |
| KI-014 | collect items lost on reload | audit worker: found item indices saved in `P.story.collect` (`samaru-story.js:372`), rebuilt without them at step start (267); `ST.ctx` reset on every `Z.begin` (587) | bot `RELOAD_ITEM`/`RELOAD_COUNT`/`RELOAD_COLLECT` at every step |
| KI-015 | "stuck" spots from the monkey | not a game bug: the monkey had the full map open (walking is paused on purpose); the bot now closes it like a player | monkey `stuck` = no direction moves you with no overlay or map open |
| KI-002, KI-011, KI-021, KI-025, KI-026 | finds at the gate (m26.8, m41.5, m42.6, m53.3, m71.3), Kaka's home, emote steps anywhere, two "Chemical Engineering" names, m85 giver | story / map workers (validator now clean on each) | `DEFAULT_GATE`, `FIND_OFF_SCENE`, `NPC_AT`, `EMOTE_ANYWHERE`, `SAME_NAME`, `BAD_NPC` |
| KI-018, KI-019 | harness lacked `samaru-overrides`; game name literals | config worker | `HARNESS_LIST`, `HARDCODED_NAME` (the `FSLG.x` API object is not a name) |
| KI-016 | retired Big Sly visible and talkable | audit worker: retired people are hidden every tick (`samaru-story.js:234`) and skipped by `talkable()` | bot talk checks at the court (m7–m9) |
| KI-020 | no top-level save version | audit worker: `saveVersion` 1 = `P.v` 2 + `story.ver` 2, `Z.SAVE_MIGRATIONS[0]`, newer saves refused untouched with `Z.loadError` (`samaru-core.js:56-69`); key unchanged (no migration reads another key) | `test_save_versions` (old save loads and plays; save 99 refused and left as is) |
| — | m2 sent you to Phase 2 for breakfast "by the hostel gate" | story (`@hostelshop`, the shop nearest your hostel) | `TEXT_PLACE`, travel table |
