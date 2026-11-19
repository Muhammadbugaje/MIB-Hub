# 06 — BUILD BRIEF FOR CLAUDE (YEAR ONE)

**You are the executing AI.** This is the contract. Read it fully before touching a file. It tells you what to build, what you may decide, what you must not invent, and how your work will be accepted.

**Deliverable:** a playable, filmable Year One of MIB-Hub that matches the documents in `docs/year1-production/` and the canon in `docs/plan/missions/Y1.md`. Not a reinterpretation. Not a "spiritual adaptation". The same year.

---

## 1. Read order (do not skip)

1. `00_README.md` — index, hierarchy, status legend.
2. `02_YEAR1_STORY.md` — what the year means, mission by mission.
3. `03_YEAR1_SCRIPT.md` — every scene, in order, with dialogue and staging.
4. `04_CUTSCENE_TECHNICAL_SPEC.md` — every shot, anchor, cue and end state.
5. `05_SCENE_AND_ASSET_MANIFEST.md` — every set, prop, look, effect and item.
6. `07_FLOW_AND_CONTINUITY.md` — gates, flags, knowledge, calendar.
7. `01_CHARACTER_BIBLE.md` — bodies, faces, wardrobe, rigs, voices.
8. `03B_YEAR1_LINES_BY_CHARACTER.md` — recording/coverage check.

Then open the primary sources: `docs/plan/missions/Y1.md`, `FORMAT.md`, `STORY_BIBLE_V2.md`, `cast.ts`, `voices.ts`.

**Rule:** the later document never overrides the earlier one. If `05` and `04` disagree about a prop, `04` wins (it quotes the mission). If `04` and `Y1.md` disagree, **`Y1.md` wins**. If `Y1.md` and `STORY_BIBLE_V2.md` disagree about character truth, the bible wins for *who people are*, `Y1.md` wins for *what happens on screen*.

---

## 2. What "done" means

A Year 1 build is done when all of the following are true:

1. **All 24 missions** are playable in order, with the gates and end flags in `07`.
2. **All 78 cutscene blocks** play at the written durations, with the written lines, in the written order.
3. **All 160 world anchors + 3 actor rigs** resolve; no shot fires at nothing.
4. **All 119 look targets** resolve; no camera aims at empty space.
5. **All 63 prop/state keys** exist; the 14 hero props read in close-up.
6. **All 333 cutscene lines** are present: 321 canon, 9 conditional, 3 runtime tokens.
7. **All 80 conditional gameplay lines** fire only inside their `[IF special.*]` blocks.
8. **No line is invented** to cover a missing asset, a missing shot, or a logic gap.
9. **The year ends** on the second line of the note, with the state in `07 §7`.
10. **A player who ignores all optional content** still completes a coherent year.

---

## 3. Non-negotiable invariants

These are not preferences. Changing any of them breaks canon, saves, or both.

### 3.1 Identity and look

- **One human scale.** Every human shares the skeleton scale; heights within ±6%.
- **Skin:** fair-to-caramel; nobody very dark. Dr. Zainab is **`#f1d6c2`**, locked, test-enforced. Never darken her in lighting, grading or shadow.
- **Modest outfits.** No midriffs, no tight clothing, no sexualised framing of any character, ever.
- **No real brands, clubs, logos or readable real phone numbers.** Invented names only.
- **Roomie casting is fixed at new game.** Bature (male) or Firdausi (female); never swapped mid-run; shared lines exist for both.

### 3.2 Story

- **The year is linear.** No mission branches, no missable missions, no fail-to-game-over.
- **The Cup is lost** (M019). Do not let the player win it, and do not retcon it.
- **The goat is returned** (M001) and stays at the farm.
- **The Maker did not write the note.** He says so in M006. The writer is not revealed in Year 1.
- **The Count's face was invented by freshers.** Mai Shayi says so in M024. Do not explain it earlier.
- **Muhammad is never explained.** He is seen, helped, and looked at. No file, no name, no answer.
- **The seventh space stays empty until M024**, then receives one plaque. One socket of ten is filled.
- **The second line ("Five more.") appears only in M024.**
- **No romance is confirmed.** Helen's answer is hers; the companion is a runtime token.
- **No death, expulsion, gore, weapons, or irredeemable villain.** Sly becomes a friend; the tax ends.

### 3.3 Specials

- **Jiya, Taty and Madison exist only inside `[IF special.*]`.** Never in the default cast, marketing, key art, trailers, or the main story path.
- Their lines are **33 / 40 / 16** respectively; their blocks are the nine listed in `00_README.md`.
- If the condition is false, skip the block **cleanly** — never play a truncated or improvised version.
- They write **no flags** and change **no endings**.

### 3.4 Technical

- **IDs are exact.** `cut_m###_open|mid_K|close`; M001's film is `cut_m001_film_a`–`_e`. Anchors lowercase; actor rigs uppercase.
- **Never rename** a mission, cutscene, anchor, prop, item or flag to "clean it up". Add an alias if you must; keep the original.
- **Runtime tokens are not lines.** `m013_mid1_03`, `m021_mid1_03`, `m021_close_01` are filled at runtime (Dad, Helen's gift, the companion). Never record the bracket text.
- **`prosperity` is a flag, not an item.** It cannot be spent, dropped or traded.
- **Cutscene `endState` is law.** Write exactly the flags in the block; do not add "helpful" flags.

---

## 4. What you may decide, and what you may not

### You may decide (production choices)

- Mesh density, texture resolution, shader technique, LOD strategy.
- Exact camera lens within the written shot size (`wide`, `medium`, `close`, `pov`, `over_shoulder`, `top`).
- Layout within a set, as long as every anchor and sightline in `05` exists.
- Kit-piece dressing not named as a prop.
- Transition technique between blocks, within the written blend time.
- Crowd instancing method, as long as the four crowd types read correctly.
- Audio implementation (middleware, stems, ducking) within the written cues.
- Performance capture or keyframed animation, within the 16 tokens + 6 loops.
- Any `PROPOSED` item in `05 §K`, if you announce it and keep the look consistent.

### You may not decide (canon choices)

- Who wrote the note, what the Count is, who Muhammad is, what the seventh dot means.
- Any character's skin tone, height class, gender, casting, or family relationship.
- Any new named character, mission, cutscene, clue, item or location.
- Any change to the 333 lines, their order, speaker, or scene.
- Any change to the calendar, the Cup result, the tax ending, or the year-end state.
- Any use of specials outside their conditional blocks.
- Any romantic, violent or horror escalation not in the script.

**If a scene seems to need something that is not in the docs:** stop and log it as a `GAP` with the mission, block, line and what is missing. Do not fill it with invention. A one-line note is cheaper than a canon break.

---

## 5. Conflict resolution

When two sources disagree, apply this order:

1. **`Y1.md`** — the mission block, verbatim. **Wins for what happens on screen.**
2. **`cast.ts` / `voices.ts`** — looks, colours, heights, voice. **Wins for identity, body and casting.**
3. **`STORY_BIBLE_V2.md`** — character truth, mystery truth, arc. **Wins for who people are and what is true.**
4. **`FORMAT.md`** — grammar, IDs, token rules.
5. **`01`–`07`** — production synthesis.
6. **`CHARACTERS.md`** — human-readable look notes (older; defer to `cast.ts`).
7. **Anything else** — not canon until confirmed.

There is no single "highest" file: the domains are different. If a look and a scene collide (e.g. a character is written in an outfit the cast file does not allow), keep the scene's story beat and the cast file's body; solve the outfit as a `PROPOSED` overlay, not by changing either source.

**Known conflicts, already resolved:**

| Conflict | Resolution |
|---|---|
| Baba Dam described as "very dark" in legacy notes | Use the `cast.ts` fair-to-caramel palette. Do not darken him. |
| "Kaltume" in old material | She is **Helen** (`npc.helen`), nickname "IDK". |
| Zainab's tone in old art | Locked `#f1d6c2`. Old art is wrong. |
| `PORTER` / `CLERK` / `RADIO` labels | Context-sensitive by mission; see `05 §B2`. Do not collapse to one character. |
| Roommate lines duplicated | Intentional: one set per casting; both are canon. |
| Bature's 3 extra M018 lines | Intentional: he always auditions at Ring Road FM. |

---

## 6. File and folder contract

Work inside the existing repo. Do not restructure it.

```
docs/year1-production/          ← this documentation set (read-only for the build)
docs/plan/missions/Y1.md        ← canon script (do not edit)
docs/plan/STORY_BIBLE_V2.md     ← canon truth (do not edit)
games/work-in-progress/
  src/game/cast.ts              ← cast looks (extend only with approved characters)
  src/game/voices.ts            ← voice profiles (extend only with approved characters)
  src/world/                    ← sets, props, anchors
  src/cutscene/                 ← block runner, tokens, end states
  assets/people/                ← character assets
  assets/sets/                  ← environment kits
  assets/props/                 ← prop prefabs
  assets/audio/                 ← SFX/music stems
```

**Rules:**

- **Do not overwrite** `Y1.md`, `STORY_BIBLE_V2.md`, `FORMAT.md`, `cast.ts` or `voices.ts` to make a build pass. Fix the build.
- **Do not commit** generated binaries or caches into `docs/`.
- **New docs** go in `docs/year1-production/` with the next free number; never renumber existing files.
- **New canon** requires the owner's explicit approval and a note in `00_README.md`. A build agent cannot grant canon status.
- **Every new asset** gets an ID that matches the docs; if it has no doc ID, it is not ready to build.

---

## 7. Work order

Build in this order. Each phase has a gate; do not start the next until the gate passes.

### Phase 0 — Read and reconcile (1 pass)
- Read all eight docs and the five canon files.
- Produce a one-page **conflict log** (should be empty; use §5).
- Gate: no unresolved `GAP` that blocks M001.

### Phase 1 — Scale and camera kit
- One door, bed, desk, chair, counter, vehicle seat at human scale.
- Player camera rig, `PLAYER`/`JEGA`/`MAKER` sockets.
- Gate: a 1.62 m and a 1.90 m character can sit, walk and be framed in every shot size.

### Phase 2 — M001 vertical slice
- Gate, ring road, hostel room/corridor, the Spot, the farm.
- All M001 anchors, looks, props, FX, cues, lines.
- Gate: M001 plays start to finish at the written durations, with the note, the goat, the tin and the single strike.

### Phase 3 — Act I (M002–M006)
- Admin, theatres, garden/lab, market edge.
- Gate: all five missions complete; the clue ledger through M006 is visible; no line invented.

### Phase 4 — Act II (M007–M014)
- Court, pitch, gym, hospital, Plug, radio edge.
- Gate: football, gym and Plug unlocks work; Sly's turn lands; the tax ends.

### Phase 5 — Act III (M015–M019)
- Dam, underwater, market/cinema, stadium.
- Gate: the core is retrievable and unique; the Cup is lost; the Count is seen.

### Phase 6 — Act IV (M020–M024)
- Plaques, sockets, seventh space, convocation, second line.
- Gate: one socket filled; the year-end state matches `07 §7`.

### Phase 7 — Coverage and polish
- All conditional inserts (9 blocks, 89 lines).
- All crowds, vehicles, weather, lighting presets.
- Full anchor/look/prop sweep.
- Gate: the acceptance checklist in §8 passes.

---

## 8. Acceptance tests (machine-checkable where possible)

### Coverage
- [ ] 24 missions present, IDs `M001`–`M024`.
- [ ] 78 cutscene blocks present, IDs exact.
- [ ] 333 cutscene lines: 321 canon + 9 conditional + 3 runtime tokens.
- [ ] 80 conditional gameplay lines, all inside `[IF special.*]`.
- [ ] 61 named speaking roles resolve to a cast key or a documented alias.
- [ ] 9 conditional blocks: M002 open, M004 mid_1, M007 open, M008 open, M012 mid_1, M014 mid_1, M016 close, M017 open, M019 open.

### Space
- [ ] 160 world anchors + 3 actor rigs exist with exact names.
- [ ] 35 world look targets resolve at every listed mission/time.
- [ ] 55 cast aim sockets exist; `PORTER`/`CLERK`/`RADIO` resolve by context.
- [ ] 63 prop/state keys exist; 14 hero props pass 0.4 m close-up.
- [ ] 72 location IDs are reachable; no orphan set.
- [ ] 5 vehicles, 4 crowd types, 17 VFX (13 + 4 weather), 7 lighting presets.

### Performance
- [ ] Every line has a speaker, mood, and a recorded or runtime source.
- [ ] No T-pose in any block; all 16 tokens + 6 loops present.
- [ ] Zainab's skin is `#f1d6c2` in every preset, including night and underwater.
- [ ] No character is darkened by lighting; no skin below the palette floor.

### Story
- [ ] Every clue is shown before it is discussed (`07 §5.2`).
- [ ] The calendar matches `07 §6`; never runs backwards.
- [ ] The note, the tin, the core, the plaque and the second line are unique and persistent.
- [ ] The Cup is lost; the tax ends; Sly is a friend; the goat is at the farm.
- [ ] Specials write no flags and do not appear outside their blocks.
- [ ] The year ends on "Five more." and the state in `07 §7`.

### Tone
- [ ] No gore, weapons, death, expulsion, or sexualised framing.
- [ ] No real brands or logos.
- [ ] Kind retries: no fail state ends the run.
- [ ] The humour lands in the written places; no added cruelty.

---

## 9. How to report work

For each phase, produce:

1. **What was built** — asset IDs, mission IDs, block IDs.
2. **What was not built** — with reason (`GAP`, blocked dependency, owner decision).
3. **What changed** — any `PROPOSED` choice, with the doc line it affects.
4. **Evidence** — a playable build or capture for the phase gate; a checklist with pass/fail.
5. **Risks** — anything that could break a later phase.

**Do not** report "done" on a phase whose gate has not been demonstrated. **Do not** hide a gap inside a summary.

---

## 10. Definition of done (one paragraph)

Year One is done when a new player can arrive at the gate, chase a goat, queue for an ID, sit in the wrong lecture, hear the hum, lose a Cup, dive for a core, light one socket, and read a second line that was not there before — and when every set, prop, face, light, sound and line in that journey is the one written in these documents, with nothing invented to cover a hole and nothing removed to make the build easier. At that point the year is not just playable. It is **the same year**.

---

*End of 06. If you are an executing AI: the next action is Phase 0. Do not start building until the conflict log is empty.*
