# Year 1 Production Package — MIB-Hub / *Samaru Days*

**Purpose:** a single, self-contained production set for Year 1 (M001–M024) that a human can enrich and a downstream AI (Claude) can execute **without inventing canon, breaking scene flow, or drifting the visual design**.

**Scope:** Year 1 only. Everything here is derived from the repository's canonical files; where the repository has no exact value, the entry is explicitly marked `PROPOSED` and must be signed off before it becomes canon.

---

## 1. Read in this order

| # | File | What it is | Use it to… |
|---|---|---|---|
| 00 | `00_README.md` | This index, source hierarchy, status legend, counts. | Orient yourself and check completeness. |
| 01 | `01_CHARACTER_BIBLE.md` | Every Year 1 character, model-ready: IDs, body, skin, hair, outfit slots, headwear, extras, silhouette, voice, acting, model risks. | Build or prompt any character; cast a scene. |
| 02 | `02_YEAR1_STORY.md` | The complete Year 1 story, mission by mission: premise, beats, clues, payoffs, cast, locations, rewards. | Understand *why* each scene exists before touching it. |
| 03 | `03_YEAR1_SCRIPT.md` | Full screenplay: every cutscene in order, timecoded, with action, camera, dialogue, SFX/music; plus gameplay barks. | Write, record, stage, or animate the scenes. |
| 03B | `03B_YEAR1_LINES_BY_CHARACTER.md` | Every Year 1 spoken line grouped by character, with mission, scene, line ID and mood. | Cast actors; record one part at a time; audit line coverage. |
| 04 | `04_CUTSCENE_TECHNICAL_SPEC.md` | Per-cutscene shot lists, transitions, durations, anchors, end-states, skip rules, continuity. | Implement or generate the cutscene files exactly. |
| 05 | `05_SCENE_AND_ASSET_MANIFEST.md` | Every set, anchor, prop, costume, VFX, SFX, music cue, animation, crowd and item used in Year 1. | Plan production, build asset lists, estimate work. |
| 06 | `06_BUILD_BRIEF_FOR_CLAUDE.md` | The execution contract: invariants, do-not-assume rules, file layout, acceptance tests, work order, definition of done. | Hand the build to another AI safely. |
| 07 | `07_FLOW_AND_CONTINUITY.md` | Mission flow graph, gates, flags, knowledge state, item economy, calendar, continuity ledger. | Change one mission without breaking the year. |

**If you only read two files:** `06_BUILD_BRIEF_FOR_CLAUDE.md` (the rules) and `03_YEAR1_SCRIPT.md` (the content).

---

## 2. Source hierarchy (highest authority first)

When two sources disagree, the higher one wins. Do not "fix" a higher source to match a lower one.

1. **`games/work-in-progress/src/game/cast.ts`** — exact looks, heights, widths, extras, locked skin.
2. **`games/work-in-progress/src/game/voices.ts`** — age, gender, accent, personality, pitch/rate.
3. **`docs/plan/missions/Y1.md`** — canonical Year 1 story, steps, cutscene timelines, end-states, rewards.
4. **`docs/plan/missions/FORMAT.md`** — mission and cutscene grammar, IDs, tokens, mood list, rules.
5. **`docs/plan/STORY_BIBLE_V2.md`** — premise, themes, mystery truth, character arcs, tone.
6. **`CHARACTERS.md`** — human-readable look bible; defers to `cast.ts` where they differ.
7. **`docs/voice/scripts/*.md` + `*.lines.json`** — per-character voice notes and line inventory.
8. **`docs/legacy/**`** — historical material. Useful colour and backstory, **never** authority for looks, ages or plot.

> `CHARACTERS.md` says it plainly: *"If this document and the code disagree, the code is right — then fix one of them."*

---

## 3. Status legend

Every character and asset in this package carries one of these:

| Tag | Meaning | May a downstream AI change it? |
|---|---|---|
| `CANON` | Exact value exists in `cast.ts`, `voices.ts`, `CHARACTERS.md` or `Y1.md`. | No. Reproduce exactly. |
| `LOCKED` | Test-enforced canon (Dr. Zainab's skin). | Never. |
| `CONDITIONAL` | Real-person content. Only inside `[IF special.*]` with a generic `[ELSE]`. | Only with the named person's approval and the kill switch on. |
| `PROPOSED` | This package supplies a model-ready value because no exact one exists in canon. Follows palette, fashion and height rules. | Not until the owner signs it off; then promote to `CANON`. |
| `DERIVED` | Mechanical value computed from canonical data (counts, shot lists, flags). | Regenerate from source, do not hand-edit. |
| `ALIAS` | An old name for a canonical thing (e.g. "Kaltume" → Helen). | Use the canonical name; keep the alias only as a note. |

**Rule:** a `PROPOSED` value is a *request for approval*, not a retcon. Never present it to a player or another document as established canon.

---

## 4. What "model-ready" means here

Every human is the **same two base bodies** (female/male, Universal Base Characters, `assets/people2/`) with data-driven clothing. There are no bespoke meshes. A character is fully specified by:

- `model` — one of 9 outfit cuts (`manlong`, `mansuit`, `man`, `casual`, `hoodie`, `farmer`, `womancasual`, `animwoman`, `womandress`);
- `skin` — hex from the 8-tone palette (fair → deep; nobody very dark);
- `hair` — black `#141010`, dark brown `#2a1d16`, grey `#8f8a84` (hidden under a hijab);
- `outfit` — one hex per slot, **in the model's slot order**;
- `headwear` — `none` / `cap` / `hijab` + colour;
- `height` — multiplier **0.94–1.06 only**;
- `width` — x/z only; **only Big Sly** uses it (1.18);
- `extras` — small props from the fixed list.

Clothing is real geometry: a shell cut from the body surface, offset (shoes 8 mm, trousers 13 mm, tops 15 mm), smoothed, with fabric normals. Fit/seam problems are geometry problems, not colour problems.

**Outfit slot order (memorise this):**

| Model | Slots, in order |
|---|---|
| `manlong` | shirt (long kaftan) · trousers |
| `mansuit` | shirt/jacket body · trousers |
| `man` | shirt · sleeves · trousers · shoes · socks |
| `casual` | shirt · sleeves · trousers · shoes |
| `hoodie` | hoodie · trim · trousers |
| `farmer` | overalls · shirt · trousers · hat · scarf |
| `womancasual` | top · trousers · shoes · socks |
| `animwoman` | top · trousers · trim · shoes |
| `womandress` | dress · trim · belt |

**Skin palette:**

| Name | Hex | Reads as |
|---|---|---|
| `veryFair` | `#f1d6c2` | "Snow White" — **Zainab only, locked** |
| `fair` | `#e2b892` | pale golden |
| `light` | `#d9a77c` | light warm tan |
| `honey` | `#c68a5e` | warm honey brown |
| `caramel` | `#b5794f` | caramel brown |
| `medium` | `#a06a46` | medium brown |
| `tan` | `#8d5b3c` | tan brown |
| `deep` | `#7a4e34` | deep brown (darkest used) |

**Fashion law:** modest, ordinary, sleeves at least to the elbow, trousers or long skirt; campus palette (mustard/gold, deep green, teal, indigo, burgundy, off-white, grey, black); no neon; hijab wearers never show hair; one human scale; props small and role-identifying.

---

## 5. Completeness counts (Year 1)

| Thing | Count | Where verified |
|---|---|---|
| Missions | 24 (M001–M024) | `02`, `07` |
| Cutscene blocks | 78 | `03`, `04` |
| Spoken cutscene lines | 333 (321 canon · 9 conditional inserts · 3 runtime tokens) | `03`, `03B` |
| Per-character voice-script rows | 446 | `docs/voice/scripts/`, reconciled in `03B` |
| Lines-by-character rows (incl. expanded small parts and tokens) | 449 | `03B` |
| Named speaking roles | 61 | `03B` |
| Voice-script casting groups | 46 | `docs/voice/scripts/INDEX.md` |
| Conditional cutscene inserts | 9 blocks · 9 lines | `03`, `03B` |
| Conditional gameplay lines | 80 | `03B` |
| All conditional lines | 89 | `03B` (marked `CONDITIONAL`) |
| Locations (`loc.*`) | 72 | `05` |
| Camera anchors (`from:`) | 163 (160 world + 3 actor rigs) | `04`, `05` |
| Look targets | 119 (55 cast · 35 world · 29 props) | `04`, `05` |
| Prop / prop-state keys | 63 (14 hero clue props) | `05` |
| Wardrobe overlays | 14 | `05` |
| VFX | 17 (13 authored + 4 weather layers) | `05` |
| SFX cues | 43 | `05` |
| Music cues | 13 | `05` |
| Lighting presets | 7 | `05` |
| Actor animation tokens | 16 (+6 loops) | `05` |
| Crowd types | 4 | `05` |
| Vehicles | 5 | `05` |
| Persistent items | 29 | `05` |
| Step-only tools | 21 | `05` |
| Cutscene block types | `full` 59 · `event` 8 · `entry` 6 · `vehicle` 3 · `ambient` 2 | `04` |

These counts are **DERIVED** from `Y1.md`; if the source changes, regenerate rather than editing the numbers by hand.

---

## 6. The five non-negotiables

1. **Scene order is canon.** Cutscenes play in the order listed per mission. Do not merge, reorder, or move a cutscene to another mission.
2. **IDs are API.** Mission IDs (`M001`), cutscene IDs (`cut_m001_film_a`), line IDs (`m001_film_01`), anchor names (`gate_kerb_low`), flags (`m001_done`) and item keys are stable keys. Renaming one breaks saves, voice files and tests.
3. **No invented canon.** If a value is missing, use a `PROPOSED` value from this package or ask. Do not silently invent a name, relationship, clue, location or power.
4. **Special characters stay conditional.** Jiya, Taty and Madison appear only inside `[IF special.*]` blocks with a working `[ELSE]`. They are never romance options, never in marketing, never in a non-conditional cutscene.
5. **Year 1 plants; it does not explain.** The note, the seven dots, the 6:06 clock, the hum, the missing page 41, the Count and the Maker's absence are **mysteries**. Reveal nothing the bible says lands in Year 2+.

---

## 7. Handing this to Claude

Give Claude, in this order:

1. `06_BUILD_BRIEF_FOR_CLAUDE.md` — the contract.
2. `01_CHARACTER_BIBLE.md` — the cast.
3. `03_YEAR1_SCRIPT.md` + `04_CUTSCENE_TECHNICAL_SPEC.md` — the content and its staging.
4. `05_SCENE_AND_ASSET_MANIFEST.md` — the asset checklist.
5. `07_FLOW_AND_CONTINUITY.md` — the state machine.
6. `02_YEAR1_STORY.md` — the intent, so it can resolve ambiguity correctly.

**Prompt skeleton:**

> You are implementing Year 1 of *Samaru Days*. Read `06_BUILD_BRIEF_FOR_CLAUDE.md` first and obey it. Treat `01`–`05` and `07` as specification, not inspiration. Implement one mission at a time in numerical order. After each mission, run the acceptance tests in `06` §7 and report: files changed, cutscenes implemented, flags/items emitted, and any `PROPOSED` value you had to use. Do not invent canon. If a required value is missing, stop and ask.

---

## 8. What this package deliberately does **not** do

- It does not replace `Y1.md`. `Y1.md` remains the canonical script source; this package arranges, explains and operationalises it.
- It does not lock the player's look. The fresher is created in the character editor; only the roomie, family and NPCs are fixed.
- It does not decide final art style, camera lens, colour grade, or audio performances. Those are direction choices for you, annotated where they matter.
- It does not promote legacy backstory into canon. Where legacy is used, it is labelled and often conflicts with current rules; the conflict is called out rather than silently resolved.
