# FSLG (Freshers School Life) — inspection report

**Scope:** `games/` catalogue entry `samaru-days`, all `static/js/games/samaru-*.js` and `fslg-story-*.js`
(~25.8k lines), the Year 1 generator (`tools/story/build_y1.py`), and the story design docs.
**Method:** read the engine + generated story data, ran static checks and the fast test files.
**Not run:** the full headless playthrough / soak harness (too slow for this pass). No files were modified.

**Tests that pass:** `pytest games/tests/test_samaru_story.py`, `test_samaru_intro.py`, `test_samaru_life.py`.
Important: those tests validate the *data* (the story solver feeds events straight into `S.missionEvent`),
so they cannot see the two P0 bugs below — both happen only in real play.

---

## 0. TL;DR

- The story content is strong; the **engine-to-content contract is where it breaks**.
- **P0:** several `find` / `collect` objectives are generated at the **Main Gate** instead of their real place
  (`m1` "Unpack", `m4` "Find the torch in your backpack", `m10` statues, `m25` ledger, `m32` parts). One is a
  one-line generator bug; the rest are missing `at` tags in the scripts.
- **P0:** a `go` step to the place you are already standing in **never fires**, because `Z.lastPlace` is only
  updated when the nearest place *changes*. There are 19 such steps across the campaign (e.g. `m9` has
  `go court` twice in a row; `m8` starts with `go court` right after `m7` ends at the court). The player has to
  walk 13 m away and come back to un-stick it.
- **P1:** `find`/`collect` beacons point at the place centre while the pickup spawns 16–46 m away and is only
  drawn within 18 m; the HUD can read “0 m” with nothing visible.
- **P1:** mission 2 sends a main-campus fresher to **Phase 2** (1.3–2.1 km) for “breakfast by the hostel gate”,
  then back to class, then back to Phase 2, before the bicycle unlock in m3.
- **P2:** melee ignores walls, enemies have no pathfinding, vehicle ram damage has no hit cooldown, a few
  `ride` / `class` steps have no beacon at all.

**Big picture:** 120 main missions / 896 steps, 50 side missions, 31 ambient templates (93 variants).
69% of all steps are `go`/`talk`/`turn`/`look`/`find`/`collect`/`emote`/`eat`/`sleep`; only 2.1% are fights and
0.8% races. Year 1 alone is ~45 km of straight-line travel (~82 min sprinting, ~154 min walking, before roads
and dialogue). The game reads as a very good campus **walk-and-talk** game with occasional set-pieces, not yet
as the action/open-world game the systems suggest.

---

## 1. P0 — objectives generated at the wrong place

### 1.1 Root cause (m1 + m4): `last_place` is not updated for `@` places

`tools/story/build_y1.py:246-248`:

```python
st = step_of(..., last_place)
if st.get("place") and not str(st["place"]).startswith("@"):
    last_place = st["place"]
```

`last_place` starts as `"gate"` for every mission. After `[go: @hostel]` the builder deliberately does **not**
update it, so the next unplaced `find` inherits `"gate"`.

Result (verified in `static/js/games/fslg-story-y1.js`):

| step | text | generated `at` | should be | source |
|---|---|---|---|---|
| m1.6 | Unpack (backpack) | `gate` (line 1992) | `@hostel` / `@home` | `docs/story/scripts/Y1.md:89` |
| m4.3 | Find the torch in your backpack | `gate` (line 2755) | `@hostel` / `@home` | `Y1.md:307` |

In play: the intro ends with you **at your hostel**; the next objective (“Unpack”) puts a gold beacon at the
Main Gate ~1.2 km away, and m4 makes you leave your hostel at night to fetch a torch from your own backpack at
the gate. This is the most visible bug in the first ten minutes.

**Fix:** update `last_place` for `@` places too:

```python
if st.get("place"):
    last_place = st["place"]
```

`Z.place` is already wrapped by the story engine (`samaru-story.js:537`) and resolves `@hostel` → `@home` →
`P.home`, so `st.at = "@hostel"` is safe.

### 1.2 Missing `at` tags in the scripts (m10, m25, m32)

The builder already supports `[find: item at <place>]` (`build_y1.py:351-354`), but these source beats name the
place only in prose, so the builder falls back to `last_place` (which is `"gate"` when no `go` preceded).

| step | text | generated `at` | should be | source |
|---|---|---|---|---|
| m10.2 | Stand where each statue looks (`statues ×3`) | `gate` (line 4126) | `sculpture` | `Y1.md:704` |
| m25.5 | Find what he dropped by Page Turner Books | `bank` (line 7600) | `mk_books` | `Y1b.md:510` |
| m32.3 | Find copper winding near Chemical Engineering | `gate` (line 9276) | `chemeng` | `Y1b.md:1062` |
| m32.4 | Find a spark gap near Physics | `gate` (line 9289) | `physics` | `Y1b.md:1065` |
| m32.8 | Make a rubbing of each plaque (`×6`) | `gate` (line 9356) | six named places | `Y1b.md:1074-1076` |

`docs/story/03_OUTLINE.md:97,119` confirms the intended places for m10 and m32. The m32 case is particularly
bad: “Chemical Engineering” and “Physics” are on opposite sides of campus from the gate.

**Fix:** add explicit `at` to the beats, e.g. `[find: winding at chemeng]`, `[find: spark gap at physics]`,
`[find: statues ×3 at sculpture]`, `[find: ledger pages at mk_books]`. Re-run `python tools/story/build_y1.py`
and rebuild the bundle.

**m32.8 needs an engine change:** `collect` uses a single `at`/`place` (`samaru-story.js:253`), so all six
plaques spawn around the gate. Either add `places: ["...", "..."]` to `collect` (spawn the nth gem near the nth
place) or split it into six collect steps. The script explicitly says “One here. Five out there.”

### 1.3 NPC locations that contradict the scene

| NPC | `at` | Problem |
|---|---|---|
| `maryam` | `fire` (line 578) | role says “works at Page Turner Books”; m3.10 “Tell Maryam the books arrived” sends you to the Fire Station |
| `hassan` | `court` (line 450) | m7.1 says “Hassan is outside your hostel” (`Y1.md:502`), but the scene plays at the basketball court |

`talk` steps carry no `place` (verified: 0 talk steps have one), so the NPC’s home is the scene. For `maryam`
set `at: "mk_books"` (check m66.5 too). For Hassan, either move him for that beat or add a per-step
`npcAt`/`bring` option to the engine.

---

## 2. P0 — `go` steps can never fire while you are already there

### 2.1 Mechanism

`samaru-core.js:303`:

```js
var pl = Z.near(13);
if (pl && pl !== Z.lastPlace) { Z.emit({ t: "go", place: pl.id, ... }); ... }
Z.lastPlace = pl;
```

`Z.lastPlace` is only updated when the nearest place **changes**, and `Z.stepStart()` does **not** reset it.
So when a step changes to `go X` and the player is already within 13 m of X, no `go X` event is ever emitted:
the objective stays “Walk to X” until the player leaves the 13 m radius and comes back.

### 2.2 Confirmed cases (static analysis, 19 across m1–m120)

Consecutive duplicates are guaranteed to stall:

- `m9` #2 `go court` (“Find Abbas in the mechanic yard first”) → #3 `go court` (“Go to the court”).
  The first completes on entry; the second can never fire while standing there.
- `m19` #7 `go shinkafi` immediately after the #4 rhythm / #6 turn at Shinkafi.
- `m27` #2 `talk baba` at the Dam → #3 `go dam` (“Come back to the Dam at night”).
- `m7` #1 `talk hassan` (Hassan is at court) → #2 `go court`.
- `m8` #1 `go court`: m7 ends with `talk hassan` at the court, so the new mission’s first `go` is already satisfied.
- Also flagged: `m3` #8, `m31` #3 (probably saved by the market trip in #2), and `m36`, `m56`, `m66`, `m73`,
  `m79`, `m87` (×2), `m102`, `m115`, `m116`.

`m9` and `m8` are in the first hour of Year 1, so this is not an edge case.

### 2.3 Fix (order matters)

`Z.stepStart` must invalidate the cached place, **and** the update loop must set `Z.lastPlace` *before*
calling `Z.emit`, otherwise the trailing `Z.lastPlace = pl` re-caches the place during the same frame and the
stall comes back.

```js
// samaru-core.js, Z.stepStart
Z.lastPlace = null;

// samaru-core.js, Z.update
var pl = Z.near(13);
if (pl !== Z.lastPlace) {
  Z.lastPlace = pl;
  if (pl) { Z.emit({ t: "go", place: pl.id, night: S.isNight(P) }); if (pl.id === P.home) Z.emit({ t: "go", place: "@home", ... }); }
}
```

**Acceptance:** stand still at the court after m7, let m8 start, and the “Find Jega” step must complete on the
next frame (no walking away). Same for m9 #2→#3, m19 #6→#7, m27 #2→#3.

**Regression risk:** low. Re-emitting the current place only completes a `go` step for that same place; it
cannot skip a `talk`, `find`, `fight`, etc.

---

## 3. P1 — target/HUD problems

### 3.1 `find` / `collect` beacons lead to the place, not the item

- `Z.stepStart` (`samaru-core.js:136`) spawns the find gem **16–32 m** from the place centre at a random angle.
- `collect` (`samaru-story.js:253`) spawns gems **6–46 m** from the place.
- `Z.target()` (`samaru-core.js:143`) returns the **place centre** for both step types.
- The gem is only drawn within 18 m (`samaru-3d.js:423`; 16 m in 2D, `samaru-core.js:643`).
- `Z.quest.r = 42` is stored but never read (verified: no `quest.r` usage anywhere).

So the yellow line / minimap star / “distance” readout (`samaru-core.js:646, 722, 748`) all point at the place,
while the gem is up to 46 m away and invisible. The player arrives, reads “0 m”, and sees nothing.

**Fix:** at the top of `Z.target`, prefer the live quest:

```js
if (Z.quest) return { x: Z.quest.x, y: Z.quest.y, name: "Search nearby" };
```

and draw the gem out to ~40 m instead of 18 m (or show a ground sparkle at the place once within 45 m).

### 3.2 `ride` steps without a beacon

`Z.target` (`samaru-core.js:143`) maps only `plane → strip` and `keke → gate`. Everything else returns `""`,
which falls back to `Z.waypoint` (undefined until the player sets one):

- `m3` #2 `ride bike`
- `m26` #4 `ride car` (“Get behind the wheel at the Racing Club”)

m26 is the visible one: the car is at the Racing Club, but there is no star, beam, or distance. Add
`car → club`, `bike/okada/scooter → gate`, or read a new `at` field on the ride step.

### 3.3 `class` steps have no place

`class` steps (e.g. m2 #5, m32 #2) have neither `place` nor `at`, so `Z.target()` returns `Z.waypoint`.
There is no beacon to the lecture. Fall back to `@dept` or the timetable’s room.

---

## 4. P1 — combat / vehicle issues

| # | Where | What |
|---|---|---|
| 4.1 | `samaru-core.js:248`, `hitFoe` `:234` | Vehicle ram calls `hitFoe(f, 25, ...)` **every frame** while `speed > 6` and `d < r + 1.6`, with no cooldown. `vx *= .7` slows the car quickly, so it is usually 2–4 hits, but it is frame-rate dependent and can delete a boss in one pass. Add `f.ramCd = api.t + .35` and scale damage with speed. |
| 4.2 | `samaru-core.js:258`, `:274` | Melee hit tests use distance + angle only, never `S.los`. Player and enemies can hit each other **through building walls**. |
| 4.3 | `samaru-core.js:252` | Enemy chase is straight-line `S.push` with no routing. Foes bunch on walls/fences; a quest fight can stall with the enemy on the wrong side of a building. Use `S.route` when `push` reports a hit, or add simple wall sliding. |
| 4.4 | `samaru-veh.js:562, 578` | Dead no-op code: `c.hz = c.hz > 0 && !c.hvz ? c.hz : c.hz;` and `A.x = clamp(A.x, A.x, A.x);`. |
| 4.5 | `samaru-core.js:470` | Potholes ignore `v.hz`, so a bicycle/skateboard hop never clears a pothole or kerb. |

---

## 5. P1 — mission 2 geography (design)

`m2` (“Belle first”) step 1 is `go p2shops` (“Buy breakfast at KB’s shop **by the hostel gate**”). KB is
defined at `p2shops` (Phase 2 Shops, x≈1392, y≈410). Only the Phase 2 halls (Dan Fodio / Dangote) are nearby.
Distances from the other room choices:

| room | to p2shops |
|---|---|
| Ribadu/Alex | ~2.1 km |
| Suleiman | ~2.0 km |
| Akenzua | ~1.3 km |
| Queen Amina | ~1.4 km |

Then m2 sends you to class, back to `p2shops` to collect 4 coins, then home. The bicycle unlock is m3. The
shuttle exists (`stop_gate` → `stop` at Phase 2), but nothing in m2 tells the player, and the first objective
is a 2 km walk for a player who has just finished the intro.

**Options:** move KB to the main-gate shops / `mk_supermarket`, rewrite the line to “take the shuttle to KB’s
shop in Phase 2”, or move the bicycle unlock to the end of m1.

---

## 6. P2 — smaller correctness/consistency issues

- **`emote` steps complete anywhere.** `Z.emote` emits `{emote, place}` (`samaru-core.js:200`), and m1 #5
  “Greet your roommate properly” has no `npc`, so a wave at an empty gate completes it. Add `npc: "@roomie"`
  and check proximity.
- **Find gems can spawn in water.** `S.push` keeps them out of buildings but not out of the reservoir; a Dam
  `find` can land in the lake (swimmable, but slow).
- **`collect` progress is lost on reload.** `r.left` lives in `ST.ctx` (`samaru-story.js:230`), which is not
  saved; reload mid-collect and all gems respawn while `P.m.n` keeps its partial count.
- **`Z.quest` is not cleared on mission changes.** A leftover collect/find gem can persist into the next
  mission’s HUD until overwritten.
- **`Z.lastPlace` is not saved**; harmless, but it means reloading near a `go` objective can re-fire it.
- **`docs/story/ENGINE_ISSUES.md` is stale.** Several listed “needs” are already implemented:
  `$who`/`$here`/`$other` are spawned (`samaru-story.js:446-448`), ambient `help.friend`/`flags`/`thanks`/
  `hidden` are applied (`:142`, `:432-433`, `:216`), `last_result_lost` / `linesLost` works (`:374`, `:362`),
  and `has_partner` / `strike` are set (`:226`). Verify each item before spending time on it.

---

## 7. Gameplay assessment

### What works

- **Writing and voice.** The porter, KB, Bature, Baba Dam and the Maker are genuinely funny and specific;
  the Maker’s 44-line monologue set is the best writing in the game. The story has a real thesis (light,
  entropy, community) rather than generic campus filler.
- **Sense of place.** The map is coherent: gate → Senate → faculties → hostels → market → Dam → Phase 2,
  with buses, kiosks, statues and named halls. Landmarks are reusable and the story uses them.
- **Systems breadth.** Classes/quizzes, jobs, races, flight, vehicles, torch/shades, phone, bank, friendships,
  wardrobe, security, co-op. The level-gate + auto-XP curve (`samaru-story.js:37-49`) is carefully tuned so
  story-only players reach each act’s gate.
- **Presentation.** The film-style intro, chapter banners, music zones and the “moment” overlays are strong.
- **Test discipline.** There is a real harness and a story solver; the data is consistent enough that
  `test_samaru_story.py` passes 7/7.

### What does not work yet

- **The verb-to-step ratio.** 896 steps: 26.8% `talk`, 17.5% `go`, 11.0% `turn`, 4.4% `look`, 3.0% `find`;
  fights 2.1%, races 0.8%, stealth 0.7%, flight 1.1%. Most missions are “walk here, talk, watch a turn, walk
  there”. The unique mechanics (quiz, rhythm, flight, build, stealth) appear once or twice per act and are
  gone before they become interesting.
- **Travel is the default challenge.** Year 1 is ~45 km straight-line; the longest missions are m1 (3.4 km),
  m5 (3.0 km), m26 (2.9 km) and m10 (2.6 km). Roads add ~15–30%. The first bike arrives in m3.
- **Repeat locations.** m7, m8 and m9 all live at the Basketball Court; m12/m13 both at the Racing Club;
  m14/m27/m31 all at the Dam. The story escalates, but the player stands in the same square for three missions.
- **Combat is thin.** `shade` is the only common enemy; `entropy` and `leviathan` are shade variants with
  projectile/teleport tweaks (confirmed by the enemy table and the docs). Melee is one button, no lock-on,
  no dodge window against most enemies.
- **The map is not taught.** The game has a minimap, a full map, route-setting, shuttles and a phone, but the
  first two missions never explicitly teach them; m2 assumes the player will find Phase 2.

---

## 8. Sequence / pacing

Measured (straight-line, ignoring roads):

| mission | steps | travel | notes |
|---|---|---|---|
| m1 Welcome, fresher | 12 | 3.4 km | gate → porter → hostel → **back to gate (bug)** → Senate → Sick Bay → Senate → dept |
| m2 Belle first | 10 | 2.1 km | Phase 2 → class → Phase 2 → home; no bike yet |
| m3 Two wheels | 10 | 2.0 km | bike unlock; gate → market → library → gate(npc) |
| m4 They have taken light | 7 | 1.9 km | hostel → **gate (torch bug)** → hostel → fight |
| m5 The missing fuse | 9 | 3.0 km | fire → radio → ee; good mystery, too much walking |
| m9 Sly's last stand | 9 | ~0 | two `go court` steps in a row (stall) |
| m10 Stone that points | 7 | 2.6 km | statue hunt is at the **gate** (bug); then chapel/mosque/dam |
| m26 East Side Drift | 9 | 2.9 km | car `ride` has no beacon |

Year 1 average is 8.3 steps and ~1.26 km per mission; the median is ~7 steps and ~1.2 km.

### Specific sequence recommendations

1. **End m1 at the hostel.** Cut or move the Senate/Sick Bay stamp run to m2. m1 should be: gate → porter →
   room choice → hostel → greet roommate → unpack → *end*. Save “register your file” for the next morning.
   This also removes the worst back-tracking even after the `at` bug is fixed.
2. **Fix m1/m4 first, then re-measure.** The generator fix removes ~1.2 km from m1 and ~1.2 km from m4.
3. **Give the player wheels before the Phase 2 errand.** Move the bicycle to the end of m1 (or reorder m3
   before m2). If m2 must stay in Phase 2, put a shuttle prompt in the objective text (“Take the shuttle from
   the Main Gate stop”).
4. **One location per mission, or one return.** m7/m8/m9 all at the court is the clearest example: let m8
   start at the football pitch and move Jega there, or make m7 end at Hassan’s hostel and m8 start at the
   pitch. The story already says “football pitch” in m8 #1 — make the data agree.
5. **Add a “wait until dusk” action.** The clock is 1 real second = 1 game minute. `sleep` jumps to 06:30;
   `rest` is 1 hour. Night missions (m4, m14, m27, m31) currently mean idling or spamming rest. A bench/hostel
   “Wait until dusk” would fix a whole class of pacing friction.
6. **Protect the first hour.** Cap m1–m3 at 5–6 steps each, put the tutorial for map/shuttle/phone in m2,
   and make the first fight (m4) happen at home, not across campus.
7. **Vary the verb in every mission.** A simple content rule: each main mission must contain at least one of
   `quiz / rhythm / race / flight / build / stealth / care / defend`, not only `go/talk/turn`.

---

## 9. Test blind spot (important)

`games/tests/test_samaru_story.py` passes because it drives `ST.solve` / `S.missionEvent` directly; it never
executes `Z.update`, `Z.near`, `Z.stepStart`, or `Z.target`. That is why both P0 bugs pass CI.

Add a small headless test that:

1. starts each mission at the previous mission’s final position,
2. steps `Z.update(1/60)` for ~2 s without input,
3. asserts the current `go` step either completes or the target is >13 m away,
4. asserts every `find`/`collect` target is inside its place radius and not in water.

That test would have caught m1/m4/m9/m19/m27 and the m32 gate placement.

---

## 10. Suggested fix order

1. `build_y1.py` `last_place` (one line) + rebuild Y1 + bundle. **Fixes m1/m4.**
2. `Z.stepStart` / `Z.update` lastPlace ordering. **Fixes m8/m9/m19/m27 and 14 more.**
3. Add `at` tags to m10/m25/m32 beats; handle m32.8 with a multi-place `collect`.
4. Move `maryam` to `mk_books`; decide what to do about Hassan in m7.
5. Prefer `Z.quest` in `Z.target`; widen gem draw radius; add `car → club` / `class → @dept` fallbacks.
6. m2 geography / bicycle order / shuttle hint.
7. Combat: ram cooldown, LOS checks, enemy routing.
8. Add the replay test above so these cannot regress.

---

## Appendix — quick data check

```bash
# list every find/collect target in Year 1
node - <<'NODE'
global.self = global
const D = require('./static/js/games/samaru-data.js')
global.SamaruData = D; global.window = global
require('./static/js/games/fslg-story-y1.js')
for (const m of D.STORY[0].missions)
  m.steps.forEach((s, i) => {
    if (s.t === 'find' || s.t === 'collect')
      console.log(m.id, i + 1, s.t, s.item, 'at=' + s.at, '|', s.text)
  })
NODE
```

```bash
# rebuild the generated Year 1 file and the production bundle
python tools/story/build_y1.py
python -m games.bundle
```
