# 04 · Cutscene Technical Specification — Year 1

> **Use this file to implement, not to interpret.** Every cutscene below is a self-contained contract: exact ID, type, duration, cast, shot list, cues, blocking, conditional inserts and end state. The screenplay in `03_YEAR1_SCRIPT.md` tells you what the scene means; this file tells you what the engine must do.

> **Source:** `docs/plan/missions/Y1.md`, parsed without rewriting. Anchors, cues, flags, item keys and op names are canonical. Do not normalise, rename or “clean up” a token.

---

## 1 · Global contract

1. **Play order is canon.** Cutscenes play in the order listed under each mission. Never reorder, merge or move one to another mission.
2. **Time is seconds from the block’s first frame.** `at` values are absolute within the block. A `camera.move`/`camera.cut` `dur` describes that shot’s intended length, not a hard cut-off for dialogue.
3. **IDs are API.** `cut_m###_*`, line IDs, anchor names, flag names and item keys are stable. Renaming one breaks saves, voice files, subtitles and tests.
4. **End state is mandatory.** On natural end *and* on skip, apply every flag, position and item in `endState`. A skipped scene must leave the same world state as a watched one.
5. **`playOnce: true`** means the block must not replay once its end-state flag is set. **`skippable: true`** means the player may skip; preserve the end state and do not fire skipped dialogue.
6. **Conditional inserts are not canon rows.** They live in `if: special.*` blocks and must be removed cleanly when the flag is off. Never leave an orphan camera cut, an empty beat, or a line spoken by an absent character.
7. **Runtime tokens are slots.** Three lines in the year are placeholders selected by earlier results. Supply the text before the block plays. Never ship bracket text to a voice actor or subtitle track.
8. **One human scale.** Camera anchors are authored for the project’s single character scale. Do not rescale characters or sets to fit a shot; move the anchor.

**Block types.**

| Type | Behaviour |
|---|---|
| `full` | Authored cinematic. Blocks player control until end or skip. |
| `entry` | Plays on first entry to a location. Do not re-trigger on re-entry. |
| `event` | Triggered by a mission event (result, whistle, blackout, kick-off). |
| `vehicle` | Staged in or around a moving vehicle; actor/vehicle ops are part of the shot. |
| `ambient` | Short non-blocking background scene; no player control, no mission gate. |

**Camera vocabulary.**

| Op | Meaning | Required fields |
|---|---|---|
| `camera.move` | Moving shot between two authored anchors. | `shot`, `from`, `look`, `dur` |
| `camera.cut` | Hard cut to a new anchor. | `shot`, `from`, `look`, `dur` |
| `camera.follow` | Follow a named actor. | `shot`, `who`, `dur` |
| `camera.return` | Blend back to the gameplay camera. | `blend` |
| `camera.shake` | Additive shake. | `amt`, `dur` |

**Counts.**

| Measure | Count |
|---|---:|
| Cutscene blocks | 78 |
| Types | full 59 · vehicle 3 · event 8 · entry 6 · ambient 2 |
| Camera setups (main + conditional) | 297 |
| Spoken lines (main + conditional) | 333 |
| Blocks with a conditional insert | 9 |
| Total authored runtime | 42:00 |

---

## 2 · Mission matrix

| Mission | Blocks | Runtime | Shots | Lines | Conditional blocks | Flags emitted |
|---|---:|---:|---:|---:|---:|---|
| **M001** · Welcome, Fresher | 8 | 3:56 | 24 | 28 | — | `film_a`, `film_b`, `film_c`, `film_done`, `m001_started`, `goat_loose`, `goat_returned`, `m001_done`, `journal_note` |
| **M002** · Queue Theory | 3 | 1:30 | 15 | 12 | 1 | `m002_started`, `met_aleeya`, `met_muhammad`, `ms_02`, `m002_done`, `saw_door7`, `garba_hm` |
| **M003** · Belle First | 4 | 1:48 | 13 | 12 | — | `m003_started`, `blackout_1`, `saw_shade`, `m003_done`, `heard_broadcast_7` |
| **M004** · Matric Fit | 3 | 1:26 | 11 | 15 | 1 | `m004_started`, `met_mubarak`, `matriculated`, `met_twins`, `m004_done`, `ms_03`, `photo_mode` |
| **M005** · First Lecture, Wrong Theatre | 3 | 1:36 | 12 | 14 | — | `m005_started`, `wrong_theatre`, `met_shamsu`, `met_nusaiba`, `m005_done`, `logbook_p40`, `page41_missing`, `met_abbas`, `met_wednesday` |
| **M006** · Mai Shayi Knows | 3 | 1:50 | 11 | 17 | — | `m006_started`, `legends_3`, `met_maker`, `maker_beside_bench`, `m006_done`, `met_tanko`, `statue_turned_seen`, `riddle_six_legs` |
| **M007** · Fresher Tax | 2 | 1:04 | 10 | 11 | 1 | `m007_started`, `met_sly`, `m007_done`, `met_big_baby` |
| **M008** · Left Boot First | 3 | 1:42 | 14 | 17 | 1 | `m008_started`, `met_jega`, `goat_gate_shamsu`, `m008_done`, `heard_idk`, `football_unlocked` |
| **M009** · Doctor's Orders | 3 | 1:44 | 11 | 15 | — | `m009_started`, `met_zainab`, `met_hauwa`, `m009_done`, `maker_at_hospital_seen`, `contact_zainab` |
| **M010** · The Plug | 3 | 1:32 | 8 | 16 | — | `m010_started`, `plug_intro`, `met_hajiya_ladi`, `m010_done`, `plug_store_unlocked` |
| **M011** · Test Week, One Lamp | 3 | 1:40 | 12 | 14 | — | `m011_started`, `ms_04`, `hint_q4`, `m011_done`, `met_tunde`, `sketch_figure` |
| **M012** · Count Entropy | 4 | 2:08 | 15 | 15 | 1 | `m012_started`, `mubarak_gave_torches`, `count_seen`, `m012_done`, `cape_on_vane`, `crew_chat` |
| **M013** · Results Day | 3 | 1:32 | 10 | 12 | — | `m013_started`, `dad_lecture_y1`, `m013_done`, `khadija_watching`, `night_board_seen` |
| **M014** · Sly's Last Stand | 3 | 1:32 | 11 | 13 | 1 | `m014_started`, `gym_member`, `before_photo`, `m014_done`, `sly_friend`, `clippers_seen`, `tax_ended_y1` |
| **M015** · Baba Dam's Pier | 3 | 1:30 | 13 | 11 | — | `m015_started`, `met_baba_dam`, `cliff_stakes_seen`, `m015_done`, `sister_line_1`, `forest_light_seen`, `met_lawal`, `swimming` |
| **M016** · The Dam at Midnight | 3 | 1:36 | 12 | 7 | 1 | `m016_started`, `met_eel`, `m016_done`, `ms_05`, `eel_trust` |
| **M017** · Keke Grand Prix | 3 | 1:32 | 10 | 16 | 1 | `m017_started`, `met_lula_faty`, `basit_wheel_off`, `m017_done`, `page_nine_hint`, `driving_jobs` |
| **M018** · Radio Silence | 3 | 1:48 | 11 | 18 | — | `m018_started`, `maker_away`, `met_kabiru`, `dr_z_is_zainab`, `m018_done`, `radio_job`, `broadcast_older_than_station`, `bature_show` |
| **M019** · The Vice-Chancellor's Cup | 3 | 1:50 | 15 | 11 | 1 | `m019_started`, `cup_lost_y1`, `m019_done`, `ms_06` |
| **M020** · Six Plaques | 3 | 1:42 | 14 | 11 | — | `m020_started`, `met_kelechi`, `garden_gate_open`, `m020_done`, `plaques_six`, `sockets_ten_seen`, `seventh_space_seen`, `riddle_ten_mouths`, `six_sites_on_map` |
| **M021** · Wingman | 3 | 1:46 | 9 | 16 | — | `m021_started`, `helen_yes`, `idk_her_joke`, `m021_done`, `gifts_unlocked`, `cinema_unlocked` |
| **M022** · Everybody | 2 | 1:14 | 6 | 10 | — | `m022_started`, `m022_done`, `porter_thirty_years`, `everybody_ready` |
| **M023** · Exam Fever | 3 | 1:32 | 12 | 11 | — | `m023_started`, `zainab_asked_help`, `m023_done`, `aliyu_owes`, `feeder_2_seen`, `mall_sticker_seen` |
| **M024** · Convocation Night | 4 | 2:30 | 18 | 11 | — | `m024_started`, `coil1`, `prosperity`, `ms_07`, `count_face_truth`, `seal_1`, `m024_done`, `year1_done`, `note_five_more`, `zainab_playable` |

---

## 3 · Block specifications

### M001 · Welcome, Fresher

**When:** Y1 · Freshers' Week · Mon (resumption day) · 07:00 to sunset.  
**Blocks in order:** `cut_m001_film_a` → `cut_m001_film_b` → `cut_m001_film_c` → `cut_m001_film_d` → `cut_m001_film_e` → `cut_m001_mid_1` → `cut_m001_mid_2` → `cut_m001_close`

**Mission flags:** `film_a`, `film_b`, `film_c`, `film_done`, `m001_started`, `goat_loose`, `goat_returned`, `m001_done`, `journal_note`  
**Mission items granted:** `naira`, `note_maker`, `kola_vigour`

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m001_film_a` — Film A | `full` | 28s | 0 | 4 | 0 | — |
| 2 | `cut_m001_film_b` — Film B | `vehicle` | 40s | 4 | 2 | 7 | — |
| 3 | `cut_m001_film_c` — Film C | `full` | 32s | 4 | 3 | 4 | — |
| 4 | `cut_m001_film_d` — Film D | `full` | 30s | 4 | 4 | 1 | — |
| 5 | `cut_m001_film_e` — Film E | `full` | 34s | 2 | 2 | 6 | — |
| 6 | `cut_m001_mid_1` — Mid-scene 1 | `event` | 18s | 5 | 3 | 4 | — |
| 7 | `cut_m001_mid_2` — Mid-scene 2 | `full` | 24s | 4 | 3 | 5 | — |
| 8 | `cut_m001_close` — Closing | `full` | 30s | 2 | 3 | 1 | — |

#### `cut_m001_film_a` — Film A

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 28s |
| Skippable | yes |
| Play once | yes |
| Cast | none |
| Shots | 4 |
| Lines | 0 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.move` | `wide` | `air_dam_east` | `campus_core` | 9.0s | moving |
| 2 | 0:09 | `camera.move` | `wide` | `air_ring_road` | `twin_theatres` | 8.0s | moving |
| 3 | 0:17 | `camera.cut` | `medium` | `clock_tower_face` | `clock_hands_606` | 5.0s | hard cut |
| 4 | 0:22 | `camera.move` | `wide` | `air_gate_high` | `gate_road` | 5.0s | moving |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `day` | — |
| 0:00 | MUSIC | `main_theme_dawn` | full |
| 0:19 | SFX | `cock_crow_wrong_time` | — |

**Blocking and props**

No actor or prop ops. Use the authored idle set for the cast present.

**End state (exact)**

```
{ flags: { film_a: true } }
```

**Continuity emitted:** `film_a`

#### `cut_m001_film_b` — Film B

| Property | Value |
|---|---|
| Type | `vehicle` |
| Max duration | 40s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `MUM` → `npc.mum` · `DAD` → `npc.dad` · `GUARD` → `npc.gate_guard` |
| Shots | 2 |
| Lines | 7 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `gate_kerb_low` | `family_car` | 5.0s | hard cut |
| 2 | 0:11 | `camera.cut` | `close` | `car_back_seat` | `MUM` | 12.0s | hard cut |

**Sound, light, VFX and cards**

No cue changes. Inherit the previous scene’s light and music.

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.ride` | `{ who: DAD, vehicle: family_car, to: gate_barrier }` |
| 0:29 | `actor.anim` | `{ who: PLAYER, anim: laugh }` |

**End state (exact)**

```
{ flags: { film_b: true } }
```

**Continuity emitted:** `film_b`

#### `cut_m001_film_c` — Film C

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 32s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `PORTER` → `npc.baba_porter` · `MUM` → `npc.mum` · `DAD` → `npc.dad` |
| Shots | 3 |
| Lines | 4 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `wide` | `hall_forecourt` | `PORTER` | 6.0s | hard cut |
| 2 | 0:04 | `camera.follow` | `medium` | — | `PORTER` | 10.0s | follow |
| 3 | 0:18 | `camera.cut` | `medium` | `room_door` | `MUM` | 8.0s | hard cut |

**Sound, light, VFX and cards**

No cue changes. Inherit the previous scene’s light and music.

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.anim` | `{ who: PORTER, anim: carry }` |
| 0:19 | `actor.anim` | `{ who: MUM, anim: gesture }` |
| 0:26 | `actor.anim` | `{ who: DAD, anim: gesture }` |

**End state (exact)**

```
{ PLAYER: { items: { naira: 5000 } }, flags: { film_c: true } }
```

**Continuity emitted:** `film_c` · items `naira` 5000 

#### `cut_m001_film_d` — Film D

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 30s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `MUM` → `npc.mum` · `DAD` → `npc.dad` · `MUHAMMAD` → `npc.muhammad` |
| Shots | 4 |
| Lines | 1 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `close` | `room_centre` | `MUM` | 6.0s | hard cut |
| 2 | 0:07 | `camera.cut` | `wide` | `hostel_window` | `family_car` | 8.0s | hard cut |
| 3 | 0:15 | `camera.move` | `wide` | `gate_crane` | `crowd_freshers` | 9.0s | moving |
| 4 | 0:21 | `camera.cut` | `wide` | `gate_crane_b` | `crowd_freshers` | 3.0s | hard cut |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:24 | TITLE | `{{GAME_NAME}}` | on-screen card |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.anim` | `{ who: MUM, anim: hug }` |
| 0:08 | `actor.ride` | `{ who: DAD, vehicle: family_car, to: gate_road_far }` |
| 0:17 | `actor.show` | `{ who: MUHAMMAD }` |
| 0:21 | `actor.hide` | `{ who: MUHAMMAD }` |

**End state (exact)**

```
{ PLAYER: { at: hostel_bed }, flags: { film_done: true } }
```

**Continuity emitted:** `film_done`

#### `cut_m001_film_e` — Film E

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 34s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `ROOMIE` → `npc.roomie` |
| Shots | 2 |
| Lines | 6 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `room_corner` | `ROOMIE` | 8.0s | hard cut |
| 2 | 0:27 | `camera.return` | — | — | — | — | return, blend 1.5s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:25 | CALENDAR | `Mon 16 Sep · Freshers' Week · Resumption day` | on-screen card |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.anim` | `{ who: ROOMIE, anim: eat }` |
| 0:21 | `actor.anim` | `{ who: ROOMIE, anim: point }` |

**End state (exact)**

```
{ PLAYER: { at: hostel_bed_stand }, flags: { m001_started: true } }
```

**Continuity emitted:** `m001_started`

#### `cut_m001_mid_1` — Mid-scene 1

| Property | Value |
|---|---|
| Type | `event` |
| Max duration | 18s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `ROOMIE` → `npc.roomie` · `GOAT` → `prop.goat_sarki` · `SUYA` → `npc.suya_man` · `CROWD` → `crowd.freshers` |
| Shots | 3 |
| Lines | 4 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:01 | `camera.cut` | `wide` | `spot_rafters` | `GOAT` | 4.0s | hard cut |
| 2 | 0:07 | `camera.cut` | `close` | `suya_table_low` | `GOAT` | 3.0s | hard cut |
| 3 | 0:16 | `camera.return` | — | — | — | — | return, blend 0.8s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | SFX | `goat_bell_fast` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.run` | `{ who: GOAT, to: suya_table_top }` |
| 0:08 | `actor.look` | `{ who: GOAT, at: PLAYER }` |

**End state (exact)**

```
{ GOAT: { at: spot_exit_east }, flags: { goat_loose: true } }
```

**Continuity emitted:** `goat_loose`

#### `cut_m001_mid_2` — Mid-scene 2

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 24s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `ROOMIE` → `npc.roomie` · `SULE` → `npc.malam_sule` · `GOAT` → `prop.goat_sarki` |
| Shots | 3 |
| Lines | 5 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `farm_gate_post` | `SULE` | 8.0s | hard cut |
| 2 | 0:13 | `camera.cut` | `close` | `farm_gate_low` | `SULE` | 6.0s | hard cut |
| 3 | 0:22 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

No cue changes. Inherit the previous scene’s light and music.

**Blocking and props**

No actor or prop ops. Use the authored idle set for the cast present.

**End state (exact)**

```
{ PLAYER: { at: farm_gate, items: { naira: 5500 } }, flags: { goat_returned: true } }
```

**Continuity emitted:** `goat_returned` · items `naira` 5500 

#### `cut_m001_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 30s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `ROOMIE` → `npc.roomie` |
| Shots | 3 |
| Lines | 1 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `wide` | `corridor_far_end` | `room_door` | 6.0s | hard cut |
| 2 | 0:06 | `camera.cut` | `close` | `door_floor` | `prop.note` | 5.0s | hard cut |
| 3 | 0:15 | `camera.cut` | `pov` | `PLAYER` | `corridor_far_end` | 4.0s | hard cut |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `dusk` | — |
| 0:02 | FX | `flicker` | at `corridor_lights` |
| 0:04 | MUSIC | all cues | stop all cues |
| 0:11 | TITLE | `The Maker is watching. Welcome.` | on-screen card |
| 0:19 | SFX | `clock_strike_single_far` | — |
| 0:25 | TITLE | `YEAR 1` | on-screen card |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:07 | `prop.show` | `{ id: prop.note, at: room_door_gap }` |
| 0:08 | `actor.anim` | `{ who: PLAYER, anim: kneel }` |
| 0:21 | `actor.look` | `{ who: ROOMIE, at: prop.note }` |

**End state (exact)**

```
{ PLAYER: { at: room_door, items: { note_maker: 1, kola_vigour: 1 } }, flags: { m001_done: true, journal_note: true } }
```

**Continuity emitted:** `m001_done`, `journal_note` · items `note_maker` 1, `kola_vigour` 1 

### M002 · Queue Theory

**When:** Y1 · Freshers' Week · Tue · 08:00–16:00.  
**Blocks in order:** `cut_m002_open` → `cut_m002_mid_1` → `cut_m002_close`

**Mission flags:** `m002_started`, `met_aleeya`, `met_muhammad`, `ms_02`, `m002_done`, `saw_door7`, `garba_hm`  
**Mission items granted:** `student_id`

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m002_open` — Opening | `full` | 32s | 4 | 5 | 5 | yes |
| 2 | `cut_m002_mid_1` — Mid-scene 1 | `full` | 30s | 5 | 5 | 6 | — |
| 3 | `cut_m002_close` — Closing | `full` | 28s | 2 | 5 | 1 | — |

#### `cut_m002_open` — Opening

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 32s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `ALEEYA` → `npc.aleeya` · `CLERK` → `npc.mrs_adebayo` · `JIYA?` → `special.jiya` |
| Shots | 4 |
| Lines | 4 |
| Conditional insert | yes |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.move` | `top` | `senate_crane_high` | `senate_queue` | 6.0s | moving |
| 2 | 0:06 | `camera.cut` | `medium` | `queue_side` | `ALEEYA` | 10.0s | hard cut |
| 3 | 0:17 | `camera.cut` | `close` | `registry_window` | `CLERK` | 6.0s | hard cut |
| 4 | 0:29 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:01 | MUSIC | `queue_theme` | ducked under dialogue |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:02 | `actor.walk` | `{ who: PLAYER, to: queue_end }` |

**Conditional insert**

> Apply only when the named flag is on. A skipped or disabled insert must leave no empty shot and no orphan line.

| T | If | Op | Args (raw) |
|---:|---|---|---|
| 0:23 | `special.jiya` | `camera.cut` | `{ shot: medium, from: queue_front, look: JIYA, dur: 5.0 }` |
| 0:24 | `special.jiya` | `say` | `{ who: JIYA, id: m002_open_j01, text: "Four. In a digital age. Right.", mood: dry }` |

**End state (exact)**

```
{ PLAYER: { at: queue_end }, flags: { m002_started: true, met_aleeya: true } }
```

**Continuity emitted:** `m002_started`, `met_aleeya`

#### `cut_m002_mid_1` — Mid-scene 1

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 30s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `CLEMENT` → `npc.mr_clement` · `MUHAMMAD` → `npc.muhammad` · `CLERK` → `npc.mrs_adebayo` · `CROWD` → `crowd.freshers` |
| Shots | 5 |
| Lines | 6 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `bursary_window` | `CLEMENT` | 4.0s | hard cut |
| 2 | 0:05 | `camera.cut` | `over_shoulder` | `PLAYER` | `MUHAMMAD` | 12.0s | hard cut |
| 3 | 0:19 | `camera.cut` | `medium` | `registry_window` | `CLERK` | 5.0s | hard cut |
| 4 | 0:24 | `camera.cut` | `pov` | `PLAYER` | `muhammad_mark` | 4.0s | hard cut |
| 5 | 0:28 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

No cue changes. Inherit the previous scene’s light and music.

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:03 | `actor.anim` | `{ who: CROWD, anim: sit }` |
| 0:06 | `actor.show` | `{ who: MUHAMMAD }` |
| 0:19 | `actor.look` | `{ who: CLERK, at: queue_behind_muhammad }` |
| 0:24 | `actor.hide` | `{ who: MUHAMMAD }` |

**End state (exact)**

```
{ PLAYER: { at: bursary_queue }, flags: { met_muhammad: true, ms_02: true } }
```

**Continuity emitted:** `met_muhammad`, `ms_02`

#### `cut_m002_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 28s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `GARBA` → `npc.garba` |
| Shots | 5 |
| Lines | 1 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.follow` | `medium` | — | `PLAYER` | 6.0s | follow |
| 2 | 0:03 | `camera.cut` | `medium` | `basement_corridor` | `door7` | 4.0s | hard cut |
| 3 | 0:07 | `camera.cut` | `medium` | `garba_desk_side` | `GARBA` | 8.0s | hard cut |
| 4 | 0:15 | `camera.cut` | `close` | `garba_desk_low` | `GARBA` | 6.0s | hard cut |
| 5 | 0:23 | `camera.cut` | `wide` | `senate_lawn` | `clock_hands_606` | 4.0s | hard cut |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `day` | — |
| 0:10 | SFX | `rubber_stamp` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:08 | `actor.anim` | `{ who: GARBA, anim: write }` |
| 0:12 | `actor.look` | `{ who: GARBA, at: prop.note }` |
| 0:20 | `actor.anim` | `{ who: GARBA, anim: write }` |

**End state (exact)**

```
{ PLAYER: { at: senate_basement_stair, items: { student_id: 1 } }, flags: { m002_done: true, saw_door7: true, garba_hm: true } }
```

**Continuity emitted:** `m002_done`, `saw_door7`, `garba_hm` · items `student_id` 1 

### M003 · Belle First

**When:** Y1 · Freshers' Week · Wed · 18:00–23:00.  
**Blocks in order:** `cut_m003_open` → `cut_m003_mid_1` → `cut_m003_mid_2` → `cut_m003_close`

**Mission flags:** `m003_started`, `blackout_1`, `saw_shade`, `m003_done`, `heard_broadcast_7`  
**Mission items granted:** `recipe_jollof`, `recipe_garri`

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m003_open` — Opening | `full` | 26s | 3 | 3 | 5 | — |
| 2 | `cut_m003_mid_1` — Mid-scene 1 | `event` | 24s | 3 | 2 | 4 | — |
| 3 | `cut_m003_mid_2` — Mid-scene 2 | `full` | 22s | 2 | 4 | 0 | — |
| 4 | `cut_m003_close` — Closing | `full` | 36s | 6 | 4 | 3 | — |

#### `cut_m003_open` — Opening

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 26s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `ROOMIE` → `npc.roomie` · `NKECHI` → `npc.mama_nkechi` |
| Shots | 3 |
| Lines | 5 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `close` | `room_table` | `prop.onion` | 4.0s | hard cut |
| 2 | 0:10 | `camera.cut` | `medium` | `room_corner` | `ROOMIE` | 10.0s | hard cut |
| 3 | 0:22 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

No cue changes. Inherit the previous scene’s light and music.

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.anim` | `{ who: PLAYER, anim: phone }` |

**End state (exact)**

```
{ PLAYER: { at: room_door }, flags: { m003_started: true } }
```

**Continuity emitted:** `m003_started`

#### `cut_m003_mid_1` — Mid-scene 1

| Property | Value |
|---|---|
| Type | `event` |
| Max duration | 24s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `ROOMIE` → `npc.roomie` · `CROWD` → `crowd.freshers` |
| Shots | 2 |
| Lines | 4 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:03 | `camera.cut` | `medium` | `kitchen_door` | `ROOMIE` | 8.0s | hard cut |
| 2 | 0:21 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | SFX | `power_down_whine` | — |
| 0:00 | LIGHT | `blackout` | — |
| 0:01 | SFX | `hostel_groan_wave` | — |
| 0:11 | LIGHT | `torch` | — |

**Blocking and props**

No actor or prop ops. Use the authored idle set for the cast present.

**End state (exact)**

```
{ PLAYER: { at: kitchen_counter }, flags: { blackout_1: true } }
```

**Continuity emitted:** `blackout_1`

#### `cut_m003_mid_2` — Mid-scene 2

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 22s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `IDRIS` → `npc.idris` |
| Shots | 4 |
| Lines | 0 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `pov` | `PLAYER` | `corridor_far_end` | 9.0s | hard cut |
| 2 | 0:09 | `camera.cut` | `close` | `door_floor` | `idris_door_light` | 4.0s | hard cut |
| 3 | 0:13 | `camera.cut` | `medium` | `corridor_mid` | `PLAYER` | 5.0s | hard cut |
| 4 | 0:19 | `camera.return` | — | — | — | — | return, blend 0.8s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `blackout` | — |
| 0:00 | MUSIC | `dark_quiet` | full |
| 0:02 | FX | `shade_drift` | at `corridor_far_end` |
| 0:15 | SFX | `knock_three` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:14 | `actor.anim` | `{ who: PLAYER, anim: gesture }` |

**End state (exact)**

```
{ PLAYER: { at: idris_door }, flags: { saw_shade: true } }
```

**Continuity emitted:** `saw_shade`

#### `cut_m003_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 36s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `ROOMIE` → `npc.roomie` · `IDRIS` → `npc.idris` · `PORTER` → `npc.baba_porter` · `RADIO` → `prop.radio` · `CROWD` → `crowd.freshers` |
| Shots | 4 |
| Lines | 3 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `wide` | `kitchen_high` | `candle_circle` | 7.0s | hard cut |
| 2 | 0:07 | `camera.cut` | `close` | `kitchen_shelf` | `RADIO` | 14.0s | hard cut |
| 3 | 0:25 | `camera.cut` | `medium` | `kitchen_door` | `PORTER` | 6.0s | hard cut |
| 4 | 0:31 | `camera.cut` | `wide` | `corridor_far_end` | `corridor_empty` | 4.0s | hard cut |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `candle` | — |
| 0:08 | SFX | `radio_static` | — |
| 0:09 | SFX | `three_notes` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.anim` | `{ who: CROWD, anim: sit }` |
| 0:03 | `actor.anim` | `{ who: IDRIS, anim: eat }` |
| 0:21 | `actor.anim` | `{ who: ROOMIE, anim: gesture }` |

**End state (exact)**

```
{ PLAYER: { at: kitchen_circle, items: { recipe_jollof: 1, recipe_garri: 1 } }, flags: { m003_done: true, heard_broadcast_7: true } }
```

**Continuity emitted:** `m003_done`, `heard_broadcast_7` · items `recipe_jollof` 1, `recipe_garri` 1 

### M004 · Matric Fit

**When:** Y1 · S1 Wk 2 · Fri (matriculation, event day) · 08:00–14:00.  
**Blocks in order:** `cut_m004_open` → `cut_m004_mid_1` → `cut_m004_close`

**Mission flags:** `m004_started`, `met_mubarak`, `matriculated`, `met_twins`, `m004_done`, `ms_03`, `photo_mode`  
**Mission items granted:** `matric_photo`

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m004_open` — Opening | `full` | 30s | 3 | 3 | 6 | — |
| 2 | `cut_m004_mid_1` — Mid-scene 1 | `event` | 26s | 5 | 4 | 4 | yes |
| 3 | `cut_m004_close` — Closing | `full` | 30s | 3 | 4 | 5 | — |

#### `cut_m004_open` — Opening

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 30s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `NEEDLE` → `npc.needle` · `MUBARAK` → `npc.mubarak` |
| Shots | 3 |
| Lines | 6 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `tailor_doorway` | `NEEDLE` | 9.0s | hard cut |
| 2 | 0:10 | `camera.cut` | `wide` | `sug_hall_door` | `MUBARAK` | 10.0s | hard cut |
| 3 | 0:26 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | CALENDAR | `Fri · Week 2 · Matriculation` | on-screen card |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:10 | `actor.anim` | `{ who: MUBARAK, anim: gesture }` |
| 0:16 | `prop.show` | `{ id: prop.gown_huge, at: PLAYER }` |

**End state (exact)**

```
{ PLAYER: { at: sug_hall_table }, flags: { m004_started: true, met_mubarak: true } }
```

**Continuity emitted:** `m004_started`, `met_mubarak`

#### `cut_m004_mid_1` — Mid-scene 1

| Property | Value |
|---|---|
| Type | `event` |
| Max duration | 26s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `LILY` → `npc.lily` · `LYZZY` → `npc.lyzzy` · `CROWD` → `crowd.freshers` · `MADISON?` → `special.madison` |
| Shots | 4 |
| Lines | 3 |
| Conditional insert | yes |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.move` | `wide` | `lawn_crane` | `CROWD` | 6.0s | moving |
| 2 | 0:06 | `camera.cut` | `medium` | `lawn_row_side` | `PLAYER` | 12.0s | hard cut |
| 3 | 0:18 | `camera.cut` | `close` | `lawn_edge` | `LILY` | 5.0s | hard cut |
| 4 | 0:24 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:01 | MUSIC | `anthem_brass` | ducked under dialogue |
| 0:09 | SFX | `wind_gust` | — |
| 0:10 | FX | `dust` | at `lawn_row_side` |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:10 | `actor.anim` | `{ who: PLAYER, anim: shock }` |

**Conditional insert**

> Apply only when the named flag is on. A skipped or disabled insert must leave no empty shot and no orphan line.

| T | If | Op | Args (raw) |
|---:|---|---|---|
| 0:15 | `special.madison` | `say` | `{ who: MADISON, id: m004_mid1_d01, text: "Fly, fresher! Fly with dignity!", mood: excited }` |

**End state (exact)**

```
{ PLAYER: { at: lawn_row }, flags: { matriculated: true, met_twins: true } }
```

**Continuity emitted:** `matriculated`, `met_twins`

#### `cut_m004_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 30s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `LYZZY` → `npc.lyzzy` · `MUBARAK` → `npc.mubarak` |
| Shots | 4 |
| Lines | 5 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `over_shoulder` | `PLAYER` | `prop.camera_screen` | 12.0s | hard cut |
| 2 | 0:13 | `camera.cut` | `close` | `lawn_edge` | `PLAYER` | 4.0s | hard cut |
| 3 | 0:17 | `camera.cut` | `medium` | `lawn_path` | `MUBARAK` | 9.0s | hard cut |
| 4 | 0:27 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

No cue changes. Inherit the previous scene’s light and music.

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:08 | `prop.show` | `{ id: prop.photo_backrow_gap, at: prop.camera_screen }` |

**End state (exact)**

```
{ PLAYER: { at: lawn_path, items: { matric_photo: 1 } }, flags: { m004_done: true, ms_03: true, photo_mode: true } }
```

**Continuity emitted:** `m004_done`, `ms_03`, `photo_mode` · items `matric_photo` 1 

### M005 · First Lecture, Wrong Theatre

**When:** Y1 · S1 Wk 3 · Mon (lecture day) · 07:40–10:00.  
**Blocks in order:** `cut_m005_open` → `cut_m005_mid_1` → `cut_m005_close`

**Mission flags:** `m005_started`, `wrong_theatre`, `met_shamsu`, `met_nusaiba`, `m005_done`, `logbook_p40`, `page41_missing`, `met_abbas`, `met_wednesday`  
**Mission items granted:** `fuse_13a`

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m005_open` — Opening | `entry` | 30s | 3 | 4 | 4 | — |
| 2 | `cut_m005_mid_1` — Mid-scene 1 | `full` | 34s | 4 | 4 | 7 | — |
| 3 | `cut_m005_close` — Closing | `full` | 32s | 4 | 4 | 3 | — |

#### `cut_m005_open` — Opening

| Property | Value |
|---|---|
| Type | `entry` |
| Max duration | 30s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `LAWLEC` → `npc.law_lecturer` · `CROWD` → `crowd.students` |
| Shots | 4 |
| Lines | 4 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.move` | `wide` | `theatre_lawn_high` | `twin_theatres` | 5.0s | moving |
| 2 | 0:05 | `camera.cut` | `medium` | `yamma_aisle` | `PLAYER` | 5.0s | hard cut |
| 3 | 0:10 | `camera.cut` | `medium` | `yamma_stage` | `LAWLEC` | 12.0s | hard cut |
| 4 | 0:27 | `camera.return` | — | — | — | — | return, blend 0.6s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:01 | CALENDAR | `Mon · Week 3 · Lecture day` | on-screen card |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:06 | `actor.anim` | `{ who: PLAYER, anim: sit }` |
| 0:21 | `actor.anim` | `{ who: CROWD, anim: laugh }` |
| 0:23 | `actor.anim` | `{ who: PLAYER, anim: shock }` |

**End state (exact)**

```
{ PLAYER: { at: yamma_aisle_door }, flags: { m005_started: true, wrong_theatre: true } }
```

**Continuity emitted:** `m005_started`, `wrong_theatre`

#### `cut_m005_mid_1` — Mid-scene 1

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 34s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `OKONKWO` → `npc.okonkwo` · `SHAMSU` → `npc.shamsu` · `NUSAIBA` → `npc.nusaiba` |
| Shots | 4 |
| Lines | 7 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `gabas_stage` | `OKONKWO` | 5.0s | hard cut |
| 2 | 0:05 | `camera.cut` | `close` | `gabas_row_six` | `SHAMSU` | 10.0s | hard cut |
| 3 | 0:19 | `camera.cut` | `medium` | `gabas_row_three` | `NUSAIBA` | 12.0s | hard cut |
| 4 | 0:31 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

No cue changes. Inherit the previous scene’s light and music.

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.look` | `{ who: OKONKWO, at: PLAYER }` |
| 0:06 | `actor.anim` | `{ who: PLAYER, anim: sit }` |

**End state (exact)**

```
{ PLAYER: { at: gabas_row_six_seat }, flags: { met_shamsu: true, met_nusaiba: true } }
```

**Continuity emitted:** `met_shamsu`, `met_nusaiba`

#### `cut_m005_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 32s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `OKONKWO` → `npc.okonkwo` · `ABBAS` → `npc.abbas` · `WEDNESDAY` → `npc.wednesday` |
| Shots | 4 |
| Lines | 3 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `lab_bench_end` | `WEDNESDAY` | 4.0s | hard cut |
| 2 | 0:04 | `camera.cut` | `top` | `lab_bench_over` | `prop.logbook` | 12.0s | hard cut |
| 3 | 0:16 | `camera.cut` | `close` | `lab_bench_low` | `OKONKWO` | 12.0s | hard cut |
| 4 | 0:29 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:05 | MUSIC | `mystery_thread` | full |
| 0:17 | SFX | `book_shut` | — |
| 0:28 | MUSIC | `mystery_thread` | stop this cue |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:05 | `prop.show` | `{ id: prop.logbook_p40, at: lab_bench }` |
| 0:10 | `actor.anim` | `{ who: PLAYER, anim: gesture }` |
| 0:11 | `prop.show` | `{ id: prop.logbook_stub_p41, at: lab_bench }` |

**End state (exact)**

```
{ PLAYER: { at: lab_bench, items: { fuse_13a: 1 } }, flags: { m005_done: true, logbook_p40: true, page41_missing: true, met_abbas: true, met_wednesday: true } }
```

**Continuity emitted:** `m005_done`, `logbook_p40`, `page41_missing`, `met_abbas`, `met_wednesday` · items `fuse_13a` 1 

### M006 · Mai Shayi Knows

**When:** Y1 · S1 Wk 3 · Thu · 19:00–22:00.  
**Blocks in order:** `cut_m006_open` → `cut_m006_mid_1` → `cut_m006_close`

**Mission flags:** `m006_started`, `legends_3`, `met_maker`, `maker_beside_bench`, `m006_done`, `met_tanko`, `statue_turned_seen`, `riddle_six_legs`  
**Mission items granted:** none

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m006_open` — Opening | `full` | 40s | 3 | 4 | 7 | — |
| 2 | `cut_m006_mid_1` — Mid-scene 1 | `full` | 40s | 3 | 4 | 5 | — |
| 3 | `cut_m006_close` — Closing | `full` | 30s | 3 | 3 | 5 | — |

#### `cut_m006_open` — Opening

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 40s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `ROOMIE` → `npc.roomie` · `SHAYI` → `npc.mai_shayi` |
| Shots | 4 |
| Lines | 7 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `wide` | `neem_tree_branch` | `SHAYI` | 6.0s | hard cut |
| 2 | 0:06 | `camera.cut` | `medium` | `bench_end` | `ROOMIE` | 8.0s | hard cut |
| 3 | 0:14 | `camera.cut` | `close` | `bench_fire` | `SHAYI` | 20.0s | hard cut |
| 4 | 0:36 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `night` | — |
| 0:01 | SFX | `kettle_boil` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:15 | `actor.look` | `{ who: SHAYI, at: prop.note }` |

**End state (exact)**

```
{ PLAYER: { at: mai_shayi_bench }, flags: { m006_started: true, legends_3: true } }
```

**Continuity emitted:** `m006_started`, `legends_3`

#### `cut_m006_mid_1` — Mid-scene 1

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 40s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `MAKER` → `npc.maker` · `CATS` → `prop.cats_ring` |
| Shots | 4 |
| Lines | 5 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.move` | `wide` | `garden_fence_east` | `coil_plinth` | 7.0s | moving |
| 2 | 0:07 | `camera.cut` | `medium` | `garden_fence_gate` | `MAKER` | 8.0s | hard cut |
| 3 | 0:13 | `camera.cut` | `close` | `garden_bench_low` | `MAKER` | 22.0s | hard cut |
| 4 | 0:37 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `coil_glow` | — |
| 0:00 | SFX | `coil_hum_low` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:03 | `prop.show` | `{ id: prop.cats_ring, at: coil_plinth }` |
| 0:08 | `actor.anim` | `{ who: MAKER, anim: sit }` |
| 0:24 | `actor.look` | `{ who: MAKER, at: prop.note }` |

**End state (exact)**

```
{ PLAYER: { at: garden_fence_gate }, flags: { met_maker: true, maker_beside_bench: true } }
```

**Continuity emitted:** `met_maker`, `maker_beside_bench`

#### `cut_m006_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 30s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `ROOMIE` → `npc.roomie` · `TANKO` → `npc.tanko` |
| Shots | 3 |
| Lines | 5 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `garden_gate_post` | `TANKO` | 10.0s | hard cut |
| 2 | 0:10 | `camera.move` | `wide` | `pond_far_bank` | `prop.statue_fish_girl` | 8.0s | moving |
| 3 | 0:18 | `camera.cut` | `pov` | `prop.statue_fish_girl` | `hospital_lights_far` | 5.0s | hard cut |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:10 | LIGHT | `night` | — |
| 0:10 | MUSIC | `mystery_thread` | full |
| 0:28 | MUSIC | `mystery_thread` | stop this cue |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:12 | `prop.show` | `{ id: prop.statue_fish_girl_turned, at: pond_edge }` |

**End state (exact)**

```
{ PLAYER: { at: pond_path }, flags: { m006_done: true, met_tanko: true, statue_turned_seen: true, riddle_six_legs: true } }
```

**Continuity emitted:** `m006_done`, `met_tanko`, `statue_turned_seen`, `riddle_six_legs`

### M007 · Fresher Tax

**When:** Y1 · S1 Wk 4 · Sat (weekend) · 16:00.  
**Blocks in order:** `cut_m007_open` → `cut_m007_close`

**Mission flags:** `m007_started`, `met_sly`, `m007_done`, `met_big_baby`  
**Mission items granted:** none

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m007_open` — Opening | `full` | 30s | 5 | 5 | 5 | yes |
| 2 | `cut_m007_close` — Closing | `full` | 34s | 5 | 5 | 6 | — |

#### `cut_m007_open` — Opening

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 30s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `ROOMIE` → `npc.roomie` · `SLY` → `npc.bolaji` · `HASSAN` → `npc.hassan` · `JIYA?` → `special.jiya` |
| Shots | 4 |
| Lines | 4 |
| Conditional insert | yes |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `wide` | `court_hoop_high` | `PLAYER` | 5.0s | hard cut |
| 2 | 0:05 | `camera.cut` | `close` | `court_floor_low` | `SLY` | 12.0s | hard cut |
| 3 | 0:17 | `camera.cut` | `medium` | `court_side` | `HASSAN` | 6.0s | hard cut |
| 4 | 0:28 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:04 | FX | `big_shadow` | at `court_centre` |
| 0:14 | SFX | `knuckle_crack` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.walk` | `{ who: PLAYER, to: court_centre }` |
| 0:13 | `actor.anim` | `{ who: SLY, anim: gesture }` |

**Conditional insert**

> Apply only when the named flag is on. A skipped or disabled insert must leave no empty shot and no orphan line.

| T | If | Op | Args (raw) |
|---:|---|---|---|
| 0:23 | `special.jiya` | `camera.cut` | `{ shot: medium, from: court_bench, look: JIYA, dur: 4.0 }` |
| 0:24 | `special.jiya` | `say` | `{ who: JIYA, id: m007_open_j01, text: "Oh, this'll be good.", mood: amused }` |

**End state (exact)**

```
{ PLAYER: { at: court_centre }, flags: { m007_started: true, met_sly: true } }
```

**Continuity emitted:** `m007_started`, `met_sly`

#### `cut_m007_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 34s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `ROOMIE` → `npc.roomie` · `SLY` → `npc.bolaji` · `BABY` → `npc.big_baby` · `ABBAS` → `npc.abbas` |
| Shots | 5 |
| Lines | 6 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `court_touchline` | `ABBAS` | 4.0s | hard cut |
| 2 | 0:04 | `camera.cut` | `wide` | `court_gate` | `BABY` | 5.0s | hard cut |
| 3 | 0:16 | `camera.cut` | `medium` | `court_gate_inside` | `SLY` | 8.0s | hard cut |
| 4 | 0:24 | `camera.cut` | `medium` | `court_side` | `ROOMIE` | 8.0s | hard cut |
| 5 | 0:31 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

No cue changes. Inherit the previous scene’s light and music.

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:05 | `actor.show` | `{ who: BABY }` |
| 0:08 | `actor.anim` | `{ who: SLY, anim: shock }` |
| 0:12 | `actor.walk` | `{ who: SLY, to: court_gate }` |
| 0:25 | `actor.anim` | `{ who: PLAYER, anim: stand }` |

**End state (exact)**

```
{ PLAYER: { at: court_centre }, flags: { m007_done: true, met_big_baby: true } }
```

**Continuity emitted:** `m007_done`, `met_big_baby`

### M008 · Left Boot First

**When:** Y1 · S1 Wk 5 · Tue (lecture day) · 17:00, football hour.  
**Blocks in order:** `cut_m008_open` → `cut_m008_mid_1` → `cut_m008_close`

**Mission flags:** `m008_started`, `met_jega`, `goat_gate_shamsu`, `m008_done`, `heard_idk`, `football_unlocked`  
**Mission items granted:** `bib`

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m008_open` — Opening | `full` | 34s | 4 | 6 | 6 | yes |
| 2 | `cut_m008_mid_1` — Mid-scene 1 | `full` | 38s | 4 | 3 | 8 | — |
| 3 | `cut_m008_close` — Closing | `full` | 30s | 3 | 5 | 3 | — |

#### `cut_m008_open` — Opening

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 34s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `JEGA` → `npc.jega` · `COACH` → `npc.danladi` · `TATY?` → `special.taty` |
| Shots | 5 |
| Lines | 5 |
| Conditional insert | yes |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.move` | `wide` | `pitch_floodlight` | `pitch_centre` | 5.0s | moving |
| 2 | 0:05 | `camera.cut` | `close` | `pitch_grass_low` | `JEGA` | 8.0s | hard cut |
| 3 | 0:13 | `camera.cut` | `medium` | `pitch_touchline` | `COACH` | 5.0s | hard cut |
| 4 | 0:23 | `camera.cut` | `over_shoulder` | `JEGA` | `PLAYER` | 8.0s | hard cut |
| 5 | 0:31 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | CALENDAR | `Tue · Week 5 · 17:00 · Football hour` | on-screen card |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:06 | `actor.anim` | `{ who: JEGA, anim: kneel }` |
| 0:23 | `actor.anim` | `{ who: JEGA, anim: point }` |

**Conditional insert**

> Apply only when the named flag is on. A skipped or disabled insert must leave no empty shot and no orphan line.

| T | If | Op | Args (raw) |
|---:|---|---|---|
| 0:18 | `special.taty` | `camera.cut` | `{ shot: medium, from: pitch_corner, look: TATY, dur: 4.0 }` |
| 0:19 | `special.taty` | `say` | `{ who: TATY, id: m008_open_t01, text: "Coach, give me the whistle. I'll break them gently.", mood: amused }` |

**End state (exact)**

```
{ PLAYER: { at: pitch_centre }, flags: { m008_started: true, met_jega: true } }
```

**Continuity emitted:** `m008_started`, `met_jega`

#### `cut_m008_mid_1` — Mid-scene 1

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 38s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `SHAMSU` → `npc.shamsu` · `ROOMIE` → `npc.roomie` · `JEGA` → `npc.jega` |
| Shots | 3 |
| Lines | 8 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `goalmouth_side` | `SHAMSU` | 6.0s | hard cut |
| 2 | 0:11 | `camera.cut` | `close` | `water_cooler` | `SHAMSU` | 22.0s | hard cut |
| 3 | 0:36 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:02 | SFX | `ball_miss_whoosh` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.anim` | `{ who: SHAMSU, anim: shock }` |
| 0:27 | `actor.look` | `{ who: SHAMSU, at: PLAYER }` |

**End state (exact)**

```
{ PLAYER: { at: water_cooler }, flags: { goat_gate_shamsu: true } }
```

**Continuity emitted:** `goat_gate_shamsu`

#### `cut_m008_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 30s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `JEGA` → `npc.jega` · `HELEN` → `npc.helen` |
| Shots | 5 |
| Lines | 3 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `wide` | `pitch_touchline_far` | `HELEN` | 5.0s | hard cut |
| 2 | 0:05 | `camera.cut` | `medium` | `pitch_touchline` | `JEGA` | 12.0s | hard cut |
| 3 | 0:13 | `camera.cut` | `close` | `pitch_touchline_far` | `HELEN` | 4.0s | hard cut |
| 4 | 0:17 | `camera.cut` | `medium` | `pitch_centre` | `JEGA` | 10.0s | hard cut |
| 5 | 0:27 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `dusk` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.anim` | `{ who: HELEN, anim: write }` |
| 0:08 | `actor.anim` | `{ who: JEGA, anim: kneel }` |
| 0:14 | `actor.look` | `{ who: HELEN, at: PLAYER }` |
| 0:18 | `prop.show` | `{ id: prop.bib, at: PLAYER }` |
| 0:24 | `actor.anim` | `{ who: JEGA, anim: laugh }` |

**End state (exact)**

```
{ PLAYER: { at: pitch_touchline, items: { bib: 1 } }, flags: { m008_done: true, heard_idk: true, football_unlocked: true } }
```

**Continuity emitted:** `m008_done`, `heard_idk`, `football_unlocked` · items `bib` 1 

### M009 · Doctor's Orders

**When:** Y1 · S1 Wk 5 · Wed · 20:00–23:30 (night).  
**Blocks in order:** `cut_m009_open` → `cut_m009_mid_1` → `cut_m009_close`

**Mission flags:** `m009_started`, `met_zainab`, `met_hauwa`, `m009_done`, `maker_at_hospital_seen`, `contact_zainab`  
**Mission items granted:** `pen_torch`, `paracetamol`

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m009_open` — Opening | `full` | 26s | 2 | 4 | 3 | — |
| 2 | `cut_m009_mid_1` — Mid-scene 1 | `entry` | 40s | 4 | 3 | 8 | — |
| 3 | `cut_m009_close` — Closing | `full` | 38s | 4 | 4 | 4 | — |

#### `cut_m009_open` — Opening

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 26s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `JEGA` → `npc.jega` |
| Shots | 4 |
| Lines | 3 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `wide` | `pitch_floodlight` | `goalmouth` | 5.0s | hard cut |
| 2 | 0:04 | `camera.shake` | — | — | — | 0.5s | shake 0.3/0.5s |
| 3 | 0:05 | `camera.cut` | `medium` | `goalmouth_low` | `JEGA` | 14.0s | hard cut |
| 4 | 0:22 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `night` | — |
| 0:04 | SFX | `goalpost_clang` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:02 | `actor.run` | `{ who: JEGA, to: goalpost_near }` |
| 0:06 | `actor.anim` | `{ who: JEGA, anim: sit }` |
| 0:18 | `actor.anim` | `{ who: JEGA, anim: laugh }` |

**End state (exact)**

```
{ PLAYER: { at: goalmouth }, flags: { m009_started: true } }
```

**Continuity emitted:** `m009_started`

#### `cut_m009_mid_1` — Mid-scene 1

| Property | Value |
|---|---|
| Type | `entry` |
| Max duration | 40s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `JEGA` → `npc.jega` · `ZAINAB` → `npc.zainab` · `HAUWA` → `npc.hauwa` |
| Shots | 3 |
| Lines | 8 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `ae_desk` | `HAUWA` | 4.0s | hard cut |
| 2 | 0:04 | `camera.cut` | `medium` | `ae_curtain` | `ZAINAB` | 14.0s | hard cut |
| 3 | 0:39 | `camera.return` | — | — | — | — | return, blend 0.6s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:23 | SFX | `power_down_whine` | — |
| 0:23 | LIGHT | `blackout` | — |
| 0:30 | LIGHT | `torch` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:05 | `actor.walk` | `{ who: ZAINAB, to: ae_bay_bed }` |
| 0:09 | `actor.anim` | `{ who: JEGA, anim: wave }` |
| 0:09 | `actor.anim` | `{ who: PLAYER, anim: wave }` |

**End state (exact)**

```
{ PLAYER: { at: ae_bay_bedside, items: { pen_torch: 1 } }, flags: { met_zainab: true, met_hauwa: true } }
```

**Continuity emitted:** `met_zainab`, `met_hauwa` · items `pen_torch` 1 

#### `cut_m009_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 38s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `JEGA` → `npc.jega` · `ZAINAB` → `npc.zainab` · `MAKER` → `npc.maker` |
| Shots | 4 |
| Lines | 4 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `ae_bay_foot` | `ZAINAB` | 14.0s | hard cut |
| 2 | 0:16 | `camera.cut` | `pov` | `PLAYER` | `med_garden_bench` | 9.0s | hard cut |
| 3 | 0:25 | `camera.cut` | `close` | `ae_window` | `ZAINAB` | 8.0s | hard cut |
| 4 | 0:34 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `night` | — |
| 0:16 | MUSIC | `mystery_thread` | full |
| 0:33 | MUSIC | `mystery_thread` | stop this cue |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.anim` | `{ who: ZAINAB, anim: sit }` |
| 0:11 | `actor.anim` | `{ who: ZAINAB, anim: phone }` |
| 0:17 | `actor.show` | `{ who: MAKER }` |
| 0:17 | `actor.anim` | `{ who: MAKER, anim: sit }` |
| 0:20 | `actor.look` | `{ who: MAKER, at: ward_window_first_floor }` |
| 0:26 | `actor.look` | `{ who: ZAINAB, at: med_garden_bench }` |

**End state (exact)**

```
{ PLAYER: { at: ae_bay_bedside, items: { paracetamol: 2 } }, flags: { m009_done: true, maker_at_hospital_seen: true, contact_zainab: true } }
```

**Continuity emitted:** `m009_done`, `maker_at_hospital_seen`, `contact_zainab` · items `paracetamol` 2 

### M010 · The Plug

**When:** Y1 · S1 Wk 5 · Sat (weekend) · 11:00–14:00.  
**Blocks in order:** `cut_m010_open` → `cut_m010_mid_1` → `cut_m010_close`

**Mission flags:** `m010_started`, `plug_intro`, `met_hajiya_ladi`, `m010_done`, `plug_store_unlocked`  
**Mission items granted:** `turbo_sneakers`, `zobo_max`, `lucky_kola`, `naira`

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m010_open` — Opening | `full` | 32s | 2 | 3 | 5 | — |
| 2 | `cut_m010_mid_1` — Mid-scene 1 | `full` | 24s | 3 | 2 | 4 | — |
| 3 | `cut_m010_close` — Closing | `full` | 36s | 4 | 3 | 7 | — |

#### `cut_m010_open` — Opening

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 32s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `MUBARAK` → `npc.mubarak` |
| Shots | 3 |
| Lines | 5 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `wide` | `basement_stair` | `locker_row` | 5.0s | hard cut |
| 2 | 0:05 | `camera.cut` | `medium` | `locker_side` | `MUBARAK` | 22.0s | hard cut |
| 3 | 0:28 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:07 | SFX | `locker_creak_grand` | — |
| 0:08 | MUSIC | `plug_theme` | ducked under dialogue |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.walk` | `{ who: PLAYER, to: locker_row }` |
| 0:06 | `actor.anim` | `{ who: MUBARAK, anim: gesture }` |
| 0:23 | `prop.show` | `{ id: prop.turbo_sneakers, at: PLAYER }` |

**End state (exact)**

```
{ PLAYER: { at: locker_row, items: { turbo_sneakers: 1, zobo_max: 1, lucky_kola: 1 } }, flags: { m010_started: true, plug_intro: true } }
```

**Continuity emitted:** `m010_started`, `plug_intro` · items `turbo_sneakers` 1, `zobo_max` 1, `lucky_kola` 1 

#### `cut_m010_mid_1` — Mid-scene 1

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 24s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `MUBARAK` → `npc.mubarak` · `LADI` → `npc.hajiya_ladi` |
| Shots | 2 |
| Lines | 4 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `ladi_stall_front` | `LADI` | 20.0s | hard cut |
| 2 | 0:21 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

No cue changes. Inherit the previous scene’s light and music.

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.anim` | `{ who: MUBARAK, anim: write }` |
| 0:03 | `actor.look` | `{ who: LADI, at: MUBARAK }` |
| 0:19 | `actor.anim` | `{ who: MUBARAK, anim: nod }` |

**End state (exact)**

```
{ PLAYER: { at: ladi_stall }, flags: { met_hajiya_ladi: true } }
```

**Continuity emitted:** `met_hajiya_ladi`

#### `cut_m010_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 36s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `MUBARAK` → `npc.mubarak` · `CUSTOMER` → `npc.sophomore` · `PORTER` → `npc.sug_porter` |
| Shots | 3 |
| Lines | 7 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `locker_side` | `CUSTOMER` | 12.0s | hard cut |
| 2 | 0:21 | `camera.cut` | `medium` | `basement_stair` | `PORTER` | 10.0s | hard cut |
| 3 | 0:32 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:17 | SFX | `keys_jingle_stairs` | — |
| 0:18 | SFX | `locker_slam` | — |
| 0:31 | MUSIC | `plug_theme` | stop this cue |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:08 | `actor.anim` | `{ who: MUBARAK, anim: gesture }` |
| 0:17 | `actor.anim` | `{ who: MUBARAK, anim: shock }` |
| 0:19 | `prop.hide` | `{ id: prop.plug_sign }` |

**End state (exact)**

```
{ PLAYER: { at: basement_stair, items: { zobo_max: 1, naira: "+1000" } }, flags: { m010_done: true, plug_store_unlocked: true } }
```

**Continuity emitted:** `m010_done`, `plug_store_unlocked` · items `zobo_max` 1, `naira` +1000

### M011 · Test Week, One Lamp

**When:** Y1 · S1 Wk 6–7 · Mon–Thu (test week) · evenings, and one 08:00 paper.  
**Blocks in order:** `cut_m011_open` → `cut_m011_mid_1` → `cut_m011_close`

**Mission flags:** `m011_started`, `ms_04`, `hint_q4`, `m011_done`, `met_tunde`, `sketch_figure`  
**Mission items granted:** `blue_pen_old`, `tunde_sketch_y1`, `brain_booster_tea`

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m011_open` — Opening | `full` | 34s | 4 | 4 | 5 | — |
| 2 | `cut_m011_mid_1` — Mid-scene 1 | `full` | 36s | 3 | 5 | 6 | — |
| 3 | `cut_m011_close` — Closing | `full` | 30s | 2 | 3 | 3 | — |

#### `cut_m011_open` — Opening

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 34s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `SHAMSU` → `npc.shamsu` · `ROOMIE` → `npc.roomie` · `CROWD` → `crowd.students` |
| Shots | 4 |
| Lines | 5 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `close` | `room_wall` | `prop.timetable_red_circles` | 4.0s | hard cut |
| 2 | 0:04 | `camera.cut` | `medium` | `common_room_door` | `SHAMSU` | 12.0s | hard cut |
| 3 | 0:20 | `camera.move` | `wide` | `lawn_high` | `SHAMSU` | 10.0s | moving |
| 4 | 0:31 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | CALENDAR | `Mon · Week 6 · Test week` | on-screen card |
| 0:16 | SFX | `power_down_whine` | — |
| 0:16 | LIGHT | `torch` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:05 | `actor.anim` | `{ who: SHAMSU, anim: write }` |
| 0:21 | `actor.walk` | `{ who: SHAMSU, to: library_steps }` |
| 0:22 | `actor.walk` | `{ who: CROWD, to: library_steps }` |

**End state (exact)**

```
{ PLAYER: { at: lawn_path }, flags: { m011_started: true } }
```

**Continuity emitted:** `m011_started`

#### `cut_m011_mid_1` — Mid-scene 1

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 36s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `MUHAMMAD` → `npc.muhammad` · `SHAMSU` → `npc.shamsu` |
| Shots | 5 |
| Lines | 6 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `gabas_steps_side` | `PLAYER` | 5.0s | hard cut |
| 2 | 0:05 | `camera.cut` | `over_shoulder` | `PLAYER` | `MUHAMMAD` | 18.0s | hard cut |
| 3 | 0:23 | `camera.cut` | `medium` | `gabas_door` | `SHAMSU` | 6.0s | hard cut |
| 4 | 0:29 | `camera.cut` | `wide` | `gabas_steps_side` | `gabas_steps_empty` | 4.0s | hard cut |
| 5 | 0:33 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `day` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.anim` | `{ who: PLAYER, anim: write }` |
| 0:05 | `actor.show` | `{ who: MUHAMMAD }` |
| 0:08 | `prop.show` | `{ id: prop.blue_pen, at: PLAYER }` |
| 0:29 | `actor.hide` | `{ who: MUHAMMAD }` |

**End state (exact)**

```
{ PLAYER: { at: gabas_steps, items: { blue_pen_old: 1 } }, flags: { ms_04: true, hint_q4: true } }
```

**Continuity emitted:** `ms_04`, `hint_q4` · items `blue_pen_old` 1 

#### `cut_m011_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 30s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `TUNDE` → `npc.tunde` |
| Shots | 3 |
| Lines | 3 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `corridor_mid` | `TUNDE` | 6.0s | hard cut |
| 2 | 0:06 | `camera.cut` | `top` | `PLAYER` | `prop.sketch_y1` | 8.0s | hard cut |
| 3 | 0:14 | `camera.cut` | `close` | `corridor_wall` | `TUNDE` | 13.0s | hard cut |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `night` | — |
| 0:07 | MUSIC | `mystery_thread` | full |
| 0:28 | MUSIC | `mystery_thread` | stop this cue |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.walk` | `{ who: TUNDE, to: room_door }` |
| 0:04 | `prop.show` | `{ id: prop.sketch_y1, at: PLAYER }` |
| 0:21 | `actor.look` | `{ who: TUNDE, at: prop.sketch_y1 }` |

**End state (exact)**

```
{ PLAYER: { at: room_door, items: { tunde_sketch_y1: 1, brain_booster_tea: 1 } }, flags: { m011_done: true, met_tunde: true, sketch_figure: true } }
```

**Continuity emitted:** `m011_done`, `met_tunde`, `sketch_figure` · items `tunde_sketch_y1` 1, `brain_booster_tea` 1 

### M012 · Count Entropy

**When:** Y1 · S1 Wk 14 · Thu (exam week) · 21:00–01:00 (night).  
**Blocks in order:** `cut_m012_open` → `cut_m012_mid_1` → `cut_m012_mid_2` → `cut_m012_close`

**Mission flags:** `m012_started`, `mubarak_gave_torches`, `count_seen`, `m012_done`, `cape_on_vane`, `crew_chat`  
**Mission items granted:** `torch`, `torch_upgraded`

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m012_open` — Opening | `full` | 32s | 2 | 3 | 4 | — |
| 2 | `cut_m012_mid_1` — Mid-scene 1 | `full` | 28s | 4 | 3 | 4 | yes |
| 3 | `cut_m012_mid_2` — Mid-scene 2 | `event` | 30s | 6 | 4 | 4 | — |
| 4 | `cut_m012_close` — Closing | `full` | 38s | 4 | 5 | 3 | — |

#### `cut_m012_open` — Opening

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 32s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `ROOMIE` → `npc.roomie` |
| Shots | 3 |
| Lines | 4 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.move` | `wide` | `hostel_roof_edge` | `campus_core` | 12.0s | moving |
| 2 | 0:12 | `camera.cut` | `medium` | `hostel_roof_tank` | `ROOMIE` | 16.0s | hard cut |
| 3 | 0:29 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | CALENDAR | `Thu · Week 14 · Exam week · Night` | on-screen card |
| 0:00 | LIGHT | `night` | — |
| 0:02 | SFX | `power_down_rolling` | — |
| 0:02 | FX | `blackout_rows` | at `campus_core` |
| 0:10 | LIGHT | `blackout` | — |
| 0:17 | FX | `shade_drift` | at `lawn_between_blocks` |

**Blocking and props**

No actor or prop ops. Use the authored idle set for the cast present.

**End state (exact)**

```
{ PLAYER: { at: hostel_roof }, flags: { m012_started: true } }
```

**Continuity emitted:** `m012_started`

#### `cut_m012_mid_1` — Mid-scene 1

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 28s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `MUBARAK` → `npc.mubarak` · `CROWD` → `crowd.students` · `TATY?` → `special.taty` |
| Shots | 3 |
| Lines | 3 |
| Conditional insert | yes |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `hostel_steps_low` | `MUBARAK` | 20.0s | hard cut |
| 2 | 0:22 | `camera.cut` | `wide` | `lawn_high` | `CROWD` | 5.0s | hard cut |
| 3 | 0:27 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `torch` | — |
| 0:23 | FX | `torch_bloom` | at `hostel_steps` |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:05 | `actor.look` | `{ who: MUBARAK, at: lawn_between_blocks }` |
| 0:07 | `actor.look` | `{ who: MUBARAK, at: prop.torch_in_hand }` |
| 0:13 | `actor.anim` | `{ who: MUBARAK, anim: gesture }` |

**Conditional insert**

> Apply only when the named flag is on. A skipped or disabled insert must leave no empty shot and no orphan line.

| T | If | Op | Args (raw) |
|---:|---|---|---|
| 0:17 | `special.taty` | `actor.run` | `{ who: TATY, to: hostel_steps }` |
| 0:18 | `special.taty` | `say` | `{ who: TATY, id: m012_mid1_t01, text: "Give me twenty. I have arms. Bora!", mood: excited }` |

**End state (exact)**

```
{ PLAYER: { at: hostel_steps, items: { torch: 5 } }, flags: { mubarak_gave_torches: true } }
```

**Continuity emitted:** `mubarak_gave_torches` · items `torch` 5 

#### `cut_m012_mid_2` — Mid-scene 2

| Property | Value |
|---|---|
| Type | `event` |
| Max duration | 30s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `JEGA` → `npc.jega` · `NUSAIBA` → `npc.nusaiba` · `SHAMSU` → `npc.shamsu` · `BOLAJI` → `npc.bolaji` · `CROWD` → `crowd.students` |
| Shots | 4 |
| Lines | 4 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.move` | `wide` | `boulevard_end` | `senate_steps_top` | 8.0s | moving |
| 2 | 0:08 | `camera.cut` | `close` | `senate_steps_low` | `senate_steps_top` | 7.0s | hard cut |
| 3 | 0:15 | `camera.cut` | `medium` | `boulevard_front` | `JEGA` | 12.0s | hard cut |
| 4 | 0:29 | `camera.return` | — | — | — | — | return, blend 0.8s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `blackout` | — |
| 0:00 | MUSIC | `count_theme` | full |
| 0:02 | FX | `shade_gather` | at `senate_steps_top` |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:09 | `prop.show` | `{ id: prop.count_entropy, at: senate_steps_top }` |

**End state (exact)**

```
{ PLAYER: { at: senate_steps_bottom }, flags: { count_seen: true } }
```

**Continuity emitted:** `count_seen`

#### `cut_m012_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 38s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `ROOMIE` → `npc.roomie` · `MAKER` → `npc.maker` · `CROWD` → `crowd.students` |
| Shots | 5 |
| Lines | 3 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:02 | `camera.cut` | `wide` | `senate_lawn` | `senate_steps_top` | 6.0s | hard cut |
| 2 | 0:08 | `camera.cut` | `pov` | `PLAYER` | `boulevard_tree_far` | 4.0s | hard cut |
| 3 | 0:13 | `camera.cut` | `wide` | `boulevard_crane` | `CROWD` | 8.0s | hard cut |
| 4 | 0:23 | `camera.move` | `close` | `senate_roof` | `prop.weathervane` | 9.0s | moving |
| 5 | 0:36 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | SFX | `generator_start` | — |
| 0:01 | FX | `bulb_string_on` | at `senate_steps_bottom` |
| 0:12 | LIGHT | `night` | — |
| 0:12 | SFX | `power_up_surge` | — |
| 0:22 | LIGHT | `day` | — |
| 0:22 | MUSIC | `count_theme` | stop this cue |
| 0:23 | CALENDAR | `Fri · 07:30` | on-screen card |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:03 | `prop.hide` | `{ id: prop.count_entropy }` |
| 0:08 | `actor.show` | `{ who: MAKER }` |
| 0:12 | `actor.hide` | `{ who: MAKER }` |
| 0:16 | `actor.anim` | `{ who: CROWD, anim: cheer }` |
| 0:24 | `prop.show` | `{ id: prop.cape_scrap, at: prop.weathervane }` |

**End state (exact)**

```
{ PLAYER: { at: senate_lawn, items: { torch_upgraded: 1 } }, flags: { m012_done: true, cape_on_vane: true, crew_chat: true } }
```

**Continuity emitted:** `m012_done`, `cape_on_vane`, `crew_chat` · items `torch_upgraded` 1 

### M013 · Results Day

**When:** Y1 · S2 Wk 1 · Mon (results day, event) · 09:00–15:00.  
**Blocks in order:** `cut_m013_open` → `cut_m013_mid_1` → `cut_m013_close`

**Mission flags:** `m013_started`, `dad_lecture_y1`, `m013_done`, `khadija_watching`, `night_board_seen`  
**Mission items granted:** none

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m013_open` — Opening | `event` | 28s | 4 | 4 | 3 | — |
| 2 | `cut_m013_mid_1` — Mid-scene 1 | `full` | 36s | 3 | 3 | 6 | — |
| 3 | `cut_m013_close` — Closing | `full` | 28s | 2 | 3 | 3 | — |

#### `cut_m013_open` — Opening

| Property | Value |
|---|---|
| Type | `event` |
| Max duration | 28s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `ROOMIE` → `npc.roomie` · `CLERK` → `npc.eng_clerk` · `CROWD` → `crowd.students` |
| Shots | 4 |
| Lines | 3 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `eng_office_door` | `CLERK` | 6.0s | hard cut |
| 2 | 0:06 | `camera.cut` | `wide` | `quad_high` | `CROWD` | 8.0s | hard cut |
| 3 | 0:14 | `camera.cut` | `medium` | `quad_edge` | `ROOMIE` | 10.0s | hard cut |
| 4 | 0:25 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | CALENDAR | `Mon · Week 1 · Results day` | on-screen card |
| 0:00 | LIGHT | `day` | — |
| 0:00 | FX | `dust` | at `eng_quad` |
| 0:04 | SFX | `pin_push` | — |
| 0:08 | SFX | `polite_stampede` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.walk` | `{ who: CLERK, to: noticeboard }` |
| 0:07 | `actor.run` | `{ who: CROWD, to: noticeboard }` |

**End state (exact)**

```
{ PLAYER: { at: quad_edge }, flags: { m013_started: true } }
```

**Continuity emitted:** `m013_started`

#### `cut_m013_mid_1` — Mid-scene 1

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 36s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `DAD` → `npc.dad` · `MUM` → `npc.mum` |
| Shots | 3 |
| Lines | 6 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `close` | `PLAYER` | `prop.phone_ringing` | 4.0s | hard cut |
| 2 | 0:04 | `camera.cut` | `medium` | `quad_bench` | `PLAYER` | 28.0s | hard cut |
| 3 | 0:34 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | SFX | `phone_ring_dread` | — |
| 0:32 | SFX | `bank_alert` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:05 | `actor.anim` | `{ who: PLAYER, anim: phone }` |

**End state (exact)**

```
{ PLAYER: { at: quad_bench }, flags: { dad_lecture_y1: true } }
```

**Continuity emitted:** `dad_lecture_y1`

#### `cut_m013_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 28s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `KHADIJA` → `npc.khadija` |
| Shots | 3 |
| Lines | 3 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `close` | `noticeboard_face` | `prop.slip_page41` | 7.0s | hard cut |
| 2 | 0:07 | `camera.cut` | `medium` | `noticeboard_side` | `KHADIJA` | 16.0s | hard cut |
| 3 | 0:23 | `camera.cut` | `close` | `noticeboard_face` | `prop.slip_thank_you` | 4.0s | hard cut |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:01 | MUSIC | `mystery_thread` | full |
| 0:26 | MUSIC | `mystery_thread` | stop this cue |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:08 | `actor.walk` | `{ who: KHADIJA, to: noticeboard_path }` |
| 0:21 | `actor.walk` | `{ who: KHADIJA, to: eng_office_door }` |

**End state (exact)**

```
{ PLAYER: { at: noticeboard }, flags: { m013_done: true, khadija_watching: true, night_board_seen: true } }
```

**Continuity emitted:** `m013_done`, `khadija_watching`, `night_board_seen`

### M014 · Sly's Last Stand

**When:** Y1 · S2 Wk 2 · Sat (weekend) · 07:00–17:00.  
**Blocks in order:** `cut_m014_open` → `cut_m014_mid_1` → `cut_m014_close`

**Mission flags:** `m014_started`, `gym_member`, `before_photo`, `m014_done`, `sly_friend`, `clippers_seen`, `tax_ended_y1`  
**Mission items granted:** `challenge_note`, `zobo_max`

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m014_open` — Opening | `full` | 26s | 3 | 4 | 3 | — |
| 2 | `cut_m014_mid_1` — Mid-scene 1 | `entry` | 26s | 3 | 4 | 4 | yes |
| 3 | `cut_m014_close` — Closing | `full` | 40s | 4 | 3 | 6 | — |

#### `cut_m014_open` — Opening

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 26s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `ROOMIE` → `npc.roomie` · `HASSAN` → `npc.hassan` |
| Shots | 4 |
| Lines | 3 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `room_door` | `HASSAN` | 8.0s | hard cut |
| 2 | 0:08 | `camera.cut` | `top` | `PLAYER` | `prop.challenge_note` | 8.0s | hard cut |
| 3 | 0:16 | `camera.cut` | `medium` | `room_corner` | `ROOMIE` | 9.0s | hard cut |
| 4 | 0:24 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:01 | SFX | `knock_three` | — |
| 0:09 | TITLE | `A FAIR SPAR. RULES. A REFEREE. 5 P.M.` | on-screen card |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:06 | `prop.show` | `{ id: prop.challenge_note, at: PLAYER }` |

**End state (exact)**

```
{ PLAYER: { at: room_door, items: { challenge_note: 1 } }, flags: { m014_started: true } }
```

**Continuity emitted:** `m014_started` · items `challenge_note` 1 

#### `cut_m014_mid_1` — Mid-scene 1

| Property | Value |
|---|---|
| Type | `entry` |
| Max duration | 26s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `NGOZI` → `npc.ngozi` · `TATY?` → `special.taty` |
| Shots | 3 |
| Lines | 3 |
| Conditional insert | yes |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `wide` | `gym_door` | `gym_floor` | 4.0s | hard cut |
| 2 | 0:04 | `camera.cut` | `medium` | `gym_scale_side` | `NGOZI` | 16.0s | hard cut |
| 3 | 0:25 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:07 | SFX | `scale_announce_beep` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:05 | `actor.walk` | `{ who: PLAYER, to: gym_scale }` |

**Conditional insert**

> Apply only when the named flag is on. A skipped or disabled insert must leave no empty shot and no orphan line.

| T | If | Op | Args (raw) |
|---:|---|---|---|
| 0:20 | `special.taty` | `camera.cut` | `{ shot: medium, from: gym_rack, look: TATY, dur: 4.0 }` |
| 0:21 | `special.taty` | `say` | `{ who: TATY, id: m014_mid1_t01, text: "Fresher! You again. Good. I need a victim.", mood: amused }` |

**End state (exact)**

```
{ PLAYER: { at: gym_rack }, flags: { gym_member: true, before_photo: true } }
```

**Continuity emitted:** `gym_member`, `before_photo`

#### `cut_m014_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 40s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `BOLAJI` → `npc.bolaji` · `BABY` → `npc.big_baby` · `ABBAS` → `npc.abbas` |
| Shots | 3 |
| Lines | 6 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `court_centre_low` | `BOLAJI` | 9.0s | hard cut |
| 2 | 0:09 | `camera.cut` | `medium` | `court_bench_front` | `BOLAJI` | 28.0s | hard cut |
| 3 | 0:37 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `dusk` | — |
| 0:11 | SFX | `bench_creak` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.look` | `{ who: BOLAJI, at: BABY }` |
| 0:10 | `actor.anim` | `{ who: BOLAJI, anim: sit }` |
| 0:12 | `prop.show` | `{ id: prop.clippers, at: court_bench }` |
| 0:13 | `actor.anim` | `{ who: BOLAJI, anim: shock }` |
| 0:14 | `prop.hide` | `{ id: prop.clippers }` |
| 0:19 | `prop.show` | `{ id: prop.zobo_max, at: PLAYER }` |
| 0:34 | `actor.anim` | `{ who: BOLAJI, anim: nod }` |

**End state (exact)**

```
{ PLAYER: { at: court_bench, items: { zobo_max: 1 } }, flags: { m014_done: true, sly_friend: true, clippers_seen: true, tax_ended_y1: true } }
```

**Continuity emitted:** `m014_done`, `sly_friend`, `clippers_seen`, `tax_ended_y1` · items `zobo_max` 1 

### M015 · Baba Dam's Pier

**When:** Y1 · S2 Wk 3 · Sun (weekend) · 09:00 to sunset.  
**Blocks in order:** `cut_m015_open` → `cut_m015_mid_1` → `cut_m015_close`

**Mission flags:** `m015_started`, `met_baba_dam`, `cliff_stakes_seen`, `m015_done`, `sister_line_1`, `forest_light_seen`, `met_lawal`, `swimming`  
**Mission items granted:** none

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m015_open` — Opening | `entry` | 30s | 3 | 4 | 3 | — |
| 2 | `cut_m015_mid_1` — Mid-scene 1 | `ambient` | 20s | 2 | 3 | 4 | — |
| 3 | `cut_m015_close` — Closing | `full` | 40s | 5 | 6 | 4 | — |

#### `cut_m015_open` — Opening

| Property | Value |
|---|---|
| Type | `entry` |
| Max duration | 30s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `ROOMIE` → `npc.roomie` · `BABADAM` → `npc.baba_dam` |
| Shots | 4 |
| Lines | 3 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.move` | `wide` | `dam_road_crest` | `dam_water` | 6.0s | moving |
| 2 | 0:06 | `camera.cut` | `medium` | `pier_side_low` | `ROOMIE` | 12.0s | hard cut |
| 3 | 0:18 | `camera.cut` | `medium` | `pier_end` | `BABADAM` | 10.0s | hard cut |
| 4 | 0:29 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:01 | MUSIC | `dam_theme` | ducked under dialogue |
| 0:11 | SFX | `plank_long_creak` | — |
| 0:14 | SFX | `splash_big` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:07 | `actor.walk` | `{ who: ROOMIE, to: pier_mid }` |
| 0:14 | `actor.hide` | `{ who: ROOMIE }` |
| 0:15 | `actor.anim` | `{ who: PLAYER, anim: laugh }` |
| 0:19 | `actor.show` | `{ who: ROOMIE }` |
| 0:19 | `actor.anim` | `{ who: BABADAM, anim: carry }` |

**End state (exact)**

```
{ PLAYER: { at: pier_foot }, flags: { m015_started: true, met_baba_dam: true } }
```

**Continuity emitted:** `m015_started`, `met_baba_dam`

#### `cut_m015_mid_1` — Mid-scene 1

| Property | Value |
|---|---|
| Type | `ambient` |
| Max duration | 20s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `BABADAM` → `npc.baba_dam` |
| Shots | 3 |
| Lines | 4 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `pov` | `PLAYER` | `cliff_stakes` | 8.0s | hard cut |
| 2 | 0:08 | `camera.cut` | `close` | `pier_post` | `BABADAM` | 9.0s | hard cut |
| 3 | 0:18 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

No cue changes. Inherit the previous scene’s light and music.

**Blocking and props**

No actor or prop ops. Use the authored idle set for the cast present.

**End state (exact)**

```
{ PLAYER: { at: shallows_far }, flags: { cliff_stakes_seen: true } }
```

**Continuity emitted:** `cliff_stakes_seen`

#### `cut_m015_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 40s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `ROOMIE` → `npc.roomie` · `BABADAM` → `npc.baba_dam` · `MAKER` → `npc.maker` · `LAWAL` → `npc.lawal` |
| Shots | 6 |
| Lines | 4 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `wide` | `bank_high` | `MAKER` | 7.0s | hard cut |
| 2 | 0:07 | `camera.cut` | `close` | `pier_end_low` | `MAKER` | 10.0s | hard cut |
| 3 | 0:17 | `camera.cut` | `medium` | `pier_mid` | `BABADAM` | 4.0s | hard cut |
| 4 | 0:21 | `camera.cut` | `medium` | `tree_line` | `LAWAL` | 8.0s | hard cut |
| 5 | 0:29 | `camera.cut` | `pov` | `PLAYER` | `forest_light_far` | 6.0s | hard cut |
| 6 | 0:35 | `camera.cut` | `close` | `tree_line_low` | `LAWAL` | 4.0s | hard cut |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `dusk` | — |
| 0:00 | MUSIC | `dam_theme` | stop this cue |
| 0:21 | LIGHT | `night` | — |
| 0:22 | FX | `torch_click_on` | at `LAWAL` |
| 0:29 | MUSIC | `mystery_thread` | full |
| 0:39 | MUSIC | `mystery_thread` | stop this cue |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.anim` | `{ who: MAKER, anim: kneel }` |
| 0:02 | `prop.show` | `{ id: prop.glass_dam_water, at: MAKER }` |
| 0:08 | `actor.look` | `{ who: MAKER, at: pier_end_water }` |
| 0:15 | `actor.walk` | `{ who: MAKER, to: dam_road }` |
| 0:18 | `actor.anim` | `{ who: BABADAM, anim: carry }` |

**End state (exact)**

```
{ PLAYER: { at: pier_foot }, flags: { m015_done: true, sister_line_1: true, forest_light_seen: true, met_lawal: true, swimming: true } }
```

**Continuity emitted:** `m015_done`, `sister_line_1`, `forest_light_seen`, `met_lawal`, `swimming`

### M016 · The Dam at Midnight

**When:** Y1 · S2 Wk 4 · Fri · 23:00–02:00 (night; harmattan haze).  
**Blocks in order:** `cut_m016_open` → `cut_m016_mid_1` → `cut_m016_close`

**Mission flags:** `m016_started`, `met_eel`, `m016_done`, `ms_05`, `eel_trust`  
**Mission items granted:** `relay_core`, `towel_old`, `swim_medal_old`

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m016_open` — Opening | `full` | 32s | 3 | 4 | 4 | — |
| 2 | `cut_m016_mid_1` — Mid-scene 1 | `full` | 24s | 2 | 4 | 0 | — |
| 3 | `cut_m016_close` — Closing | `full` | 40s | 4 | 4 | 3 | yes |

#### `cut_m016_open` — Opening

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 32s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `ROOMIE` → `npc.roomie` · `BABADAM` → `npc.baba_dam` |
| Shots | 4 |
| Lines | 4 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.move` | `wide` | `pier_foot_low` | `pier_end` | 7.0s | moving |
| 2 | 0:07 | `camera.cut` | `close` | `pier_post` | `BABADAM` | 10.0s | hard cut |
| 3 | 0:17 | `camera.cut` | `medium` | `pier_mid` | `ROOMIE` | 12.0s | hard cut |
| 4 | 0:30 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `night` | — |
| 0:00 | FX | `dust` | at `dam_water` |
| 0:11 | SFX | `coil_hum_underwater` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:08 | `actor.anim` | `{ who: BABADAM, anim: kneel }` |
| 0:13 | `actor.anim` | `{ who: PLAYER, anim: kneel }` |

**End state (exact)**

```
{ PLAYER: { at: pier_end }, flags: { m016_started: true } }
```

**Continuity emitted:** `m016_started`

#### `cut_m016_mid_1` — Mid-scene 1

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 24s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `EEL` → `prop.eel` |
| Shots | 4 |
| Lines | 0 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.follow` | `medium` | — | `PLAYER` | 6.0s | follow |
| 2 | 0:06 | `camera.cut` | `close` | `underwater_silt` | `prop.relay_core` | 5.0s | hard cut |
| 3 | 0:11 | `camera.cut` | `medium` | `underwater_post` | `EEL` | 10.0s | hard cut |
| 4 | 0:21 | `camera.return` | — | — | — | — | return, blend 0.8s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `torch` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:02 | `prop.show` | `{ id: prop.relay_core, at: underwater_core }` |
| 0:12 | `actor.show` | `{ who: EEL }` |
| 0:13 | `actor.look` | `{ who: EEL, at: PLAYER }` |
| 0:15 | `actor.anim` | `{ who: PLAYER, anim: shock }` |
| 0:17 | `prop.move` | `{ id: prop.eel_head, at: underwater_core }` |

**End state (exact)**

```
{ PLAYER: { at: underwater_core }, flags: { met_eel: true } }
```

**Continuity emitted:** `met_eel`

#### `cut_m016_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 40s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `ROOMIE` → `npc.roomie` · `MUHAMMAD` → `npc.muhammad` · `TATY?` → `special.taty` |
| Shots | 4 |
| Lines | 2 |
| Conditional insert | yes |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `pov` | `PLAYER` | `water_surface_haze` | 5.0s | hard cut |
| 2 | 0:05 | `camera.cut` | `medium` | `pier_end_low` | `PLAYER` | 12.0s | hard cut |
| 3 | 0:23 | `camera.move` | `top` | `pier_over` | `prop.wet_footprints` | 12.0s | moving |
| 4 | 0:35 | `camera.cut` | `wide` | `dam_road_crest` | `prop.wet_footprints_end` | 4.0s | hard cut |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `blackout` | — |
| 0:01 | SFX | `heartbeat_underwater` | — |
| 0:04 | FX | `hand_reach` | at `PLAYER` |
| 0:05 | LIGHT | `night` | — |
| 0:23 | MUSIC | `mystery_thread` | full |
| 0:39 | MUSIC | `mystery_thread` | stop this cue |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:06 | `actor.anim` | `{ who: PLAYER, anim: kneel }` |
| 0:06 | `prop.show` | `{ id: prop.towel, at: PLAYER }` |
| 0:13 | `actor.run` | `{ who: ROOMIE, to: pier_end }` |
| 0:24 | `prop.show` | `{ id: prop.wet_footprints, at: pier_to_road }` |

**Conditional insert**

> Apply only when the named flag is on. A skipped or disabled insert must leave no empty shot and no orphan line.

| T | If | Op | Args (raw) |
|---:|---|---|---|
| 0:19 | `special.taty` | `say` | `{ who: TATY, id: m016_close_t01, text: "Are you okay? I saw bubbles. I was over there!", mood: scared }` |

**End state (exact)**

```
{ PLAYER: { at: pier_end, items: { relay_core: 1, towel_old: 1, swim_medal_old: 1 } }, flags: { m016_done: true, ms_05: true, eel_trust: true } }
```

**Continuity emitted:** `m016_done`, `ms_05`, `eel_trust` · items `relay_core` 1, `towel_old` 1, `swim_medal_old` 1 

### M017 · Keke Grand Prix

**When:** Y1 · S2 Wk 5 · Sat (weekend) · 10:00–15:00.  
**Blocks in order:** `cut_m017_open` → `cut_m017_mid_1` → `cut_m017_close`

**Mission flags:** `m017_started`, `met_lula_faty`, `basit_wheel_off`, `m017_done`, `page_nine_hint`, `driving_jobs`  
**Mission items granted:** `keke_licence`

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m017_open` — Opening | `vehicle` | 36s | 5 | 3 | 8 | yes |
| 2 | `cut_m017_mid_1` — Mid-scene 1 | `vehicle` | 20s | 3 | 4 | 2 | — |
| 3 | `cut_m017_close` — Closing | `full` | 36s | 4 | 3 | 6 | — |

#### `cut_m017_open` — Opening

| Property | Value |
|---|---|
| Type | `vehicle` |
| Max duration | 36s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `LULA` → `npc.lula` · `FATY` → `npc.faty` · `EXAMINER` → `npc.examiner` · `JIYA?` → `special.jiya` |
| Shots | 3 |
| Lines | 7 |
| Conditional insert | yes |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `road_kerb` | `EXAMINER` | 9.0s | hard cut |
| 2 | 0:09 | `camera.cut` | `medium` | `keke_dash` | `keke_back_seat` | 22.0s | hard cut |
| 3 | 0:34 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | CALENDAR | `Sat · Week 5 · Weekend` | on-screen card |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.walk` | `{ who: EXAMINER, to: keke_door }` |
| 0:03 | `actor.look` | `{ who: EXAMINER, at: keke_back_seat }` |
| 0:05 | `actor.anim` | `{ who: EXAMINER, anim: shock }` |
| 0:10 | `actor.enter` | `{ who: PLAYER, vehicle: keke_test }` |

**Conditional insert**

> Apply only when the named flag is on. A skipped or disabled insert must leave no empty shot and no orphan line.

| T | If | Op | Args (raw) |
|---:|---|---|---|
| 0:23 | `special.jiya` | `say` | `{ who: JIYA, id: m017_open_j01, text: "I'm not in this argument. I'm just between it.", mood: dry }` |

**End state (exact)**

```
{ PLAYER: { at: keke_test_seat }, flags: { m017_started: true, met_lula_faty: true } }
```

**Continuity emitted:** `m017_started`, `met_lula_faty`

#### `cut_m017_mid_1` — Mid-scene 1

| Property | Value |
|---|---|
| Type | `vehicle` |
| Max duration | 20s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `BASIT` → `npc.basit` · `ALEEYA` → `npc.aleeya` |
| Shots | 4 |
| Lines | 2 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.follow` | `wide` | — | `BASIT` | 5.0s | follow |
| 2 | 0:05 | `camera.cut` | `medium` | `last_bend_kerb` | `BASIT` | 7.0s | hard cut |
| 3 | 0:14 | `camera.cut` | `pov` | `PLAYER` | `finish_line` | 5.0s | hard cut |
| 4 | 0:19 | `camera.return` | — | — | — | — | return, blend 0.5s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:02 | SFX | `wheel_pop` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:03 | `prop.move` | `{ id: prop.keke_wheel, at: gutter_last_bend }` |
| 0:03 | `actor.anim` | `{ who: BASIT, anim: shock }` |
| 0:10 | `actor.ride` | `{ who: ALEEYA, vehicle: keke_aleeya, to: finish_line }` |

**End state (exact)**

```
{ PLAYER: { at: last_bend }, flags: { basit_wheel_off: true } }
```

**Continuity emitted:** `basit_wheel_off`

#### `cut_m017_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 36s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `LULA` → `npc.lula` · `FATY` → `npc.faty` · `EMEKA` → `npc.emeka` |
| Shots | 3 |
| Lines | 6 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `park_shade` | `EMEKA` | 6.0s | hard cut |
| 2 | 0:06 | `camera.cut` | `close` | `park_bench` | `FATY` | 28.0s | hard cut |
| 3 | 0:33 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:30 | SFX | `rubber_band_snap` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `prop.show` | `{ id: prop.gold_exhaust, at: podium }` |
| 0:07 | `prop.show` | `{ id: prop.joke_book, at: FATY }` |
| 0:08 | `actor.anim` | `{ who: FATY, anim: write }` |
| 0:20 | `actor.look` | `{ who: FATY, at: LULA }` |

**End state (exact)**

```
{ PLAYER: { at: park_bench, items: { keke_licence: 1 } }, flags: { m017_done: true, page_nine_hint: true, driving_jobs: true } }
```

**Continuity emitted:** `m017_done`, `page_nine_hint`, `driving_jobs` · items `keke_licence` 1 

### M018 · Radio Silence

**When:** Y1 · S2 Wk 6 · Wed · 18:00–midnight.  
**Blocks in order:** `cut_m018_open` → `cut_m018_mid_1` → `cut_m018_close`

**Mission flags:** `m018_started`, `maker_away`, `met_kabiru`, `dr_z_is_zainab`, `m018_done`, `radio_job`, `broadcast_older_than_station`, `bature_show`  
**Mission items granted:** none

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m018_open` — Opening | `entry` | 40s | 6 | 3 | 8 | — |
| 2 | `cut_m018_mid_1` — Mid-scene 1 | `full` | 30s | 4 | 4 | 5 | — |
| 3 | `cut_m018_close` — Closing | `full` | 38s | 4 | 4 | 5 | — |

#### `cut_m018_open` — Opening

| Property | Value |
|---|---|
| Type | `entry` |
| Max duration | 40s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `BATURE` → `npc.bature` · `KABIRU` → `npc.kabiru` · `WEDNESDAY` → `npc.wednesday` · `ZAINAB` → `npc.zainab` · `CATS` → `prop.cats_ring` |
| Shots | 3 |
| Lines | 8 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `wide` | `garden_fence_east` | `CATS` | 6.0s | hard cut |
| 2 | 0:06 | `camera.cut` | `medium` | `radio_stairs` | `WEDNESDAY` | 8.0s | hard cut |
| 3 | 0:14 | `camera.cut` | `medium` | `studio_glass` | `KABIRU` | 24.0s | hard cut |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `dusk` | — |
| 0:01 | SFX | `coil_hum_thin` | — |
| 0:20 | SFX | `can_open_phone` | — |
| 0:34 | SFX | `power_down_whine` | — |
| 0:34 | LIGHT | `blackout` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `prop.show` | `{ id: prop.cats_ring_inward, at: coil_plinth }` |
| 0:15 | `prop.show` | `{ id: prop.on_air_sign_lit, at: studio_door }` |
| 0:35 | `prop.hide` | `{ id: prop.on_air_sign_lit }` |

**End state (exact)**

```
{ PLAYER: { at: studio_door }, flags: { m018_started: true, maker_away: true, met_kabiru: true } }
```

**Continuity emitted:** `m018_started`, `maker_away`, `met_kabiru`

#### `cut_m018_mid_1` — Mid-scene 1

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 30s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `BATURE` → `npc.bature` · `LYZZY` → `npc.lyzzy` · `ZAINAB` → `npc.zainab` |
| Shots | 4 |
| Lines | 5 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `close` | `studio_desk` | `BATURE` | 14.0s | hard cut |
| 2 | 0:14 | `camera.cut` | `close` | `studio_phone_bank` | `prop.phone_lines_lit` | 4.0s | hard cut |
| 3 | 0:18 | `camera.cut` | `medium` | `studio_desk` | `PLAYER` | 10.0s | hard cut |
| 4 | 0:29 | `camera.return` | — | — | — | — | return, blend 0.8s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `torch` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `prop.show` | `{ id: prop.phone_news, at: BATURE }` |
| 0:27 | `actor.anim` | `{ who: PLAYER, anim: shock }` |

**End state (exact)**

```
{ PLAYER: { at: studio_desk }, flags: { dr_z_is_zainab: true } }
```

**Continuity emitted:** `dr_z_is_zainab`

#### `cut_m018_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 38s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `BATURE` → `npc.bature` · `KABIRU` → `npc.kabiru` · `RADIO` → `prop.old_transmitter` |
| Shots | 4 |
| Lines | 5 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `close` | `studio_wall` | `prop.studio_clock_1806` | 3.0s | hard cut |
| 2 | 0:03 | `camera.cut` | `medium` | `studio_corner` | `RADIO` | 11.0s | hard cut |
| 3 | 0:16 | `camera.cut` | `close` | `studio_desk` | `KABIRU` | 18.0s | hard cut |
| 4 | 0:35 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:03 | MUSIC | `mystery_thread` | full |
| 0:03 | SFX | `three_notes` | — |
| 0:15 | SFX | `fader_slam` | — |
| 0:34 | MUSIC | `mystery_thread` | stop this cue |
| 0:34 | LIGHT | `night` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:14 | `actor.run` | `{ who: KABIRU, to: studio_desk }` |

**End state (exact)**

```
{ PLAYER: { at: studio_desk }, flags: { m018_done: true, radio_job: true, broadcast_older_than_station: true, bature_show: true } }
```

**Continuity emitted:** `m018_done`, `radio_job`, `broadcast_older_than_station`, `bature_show`

### M019 · The Vice-Chancellor's Cup

**When:** Y1 · S2 Wk 8 · Sat (event: inter-faculty final) · 16:00.  
**Blocks in order:** `cut_m019_open` → `cut_m019_mid_1` → `cut_m019_close`

**Mission flags:** `m019_started`, `cup_lost_y1`, `m019_done`, `ms_06`  
**Mission items granted:** `runners_up_medal`, `team_photo_y1`

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m019_open` — Opening | `event` | 36s | 6 | 4 | 6 | yes |
| 2 | `cut_m019_mid_1` — Mid-scene 1 | `event` | 38s | 5 | 7 | 2 | — |
| 3 | `cut_m019_close` — Closing | `full` | 36s | 4 | 4 | 3 | — |

#### `cut_m019_open` — Opening

| Property | Value |
|---|---|
| Type | `event` |
| Max duration | 36s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `JEGA` → `npc.jega` · `NUSAIBA` → `npc.nusaiba` · `COACH` → `npc.danladi` · `CROWD` → `crowd.fans` · `JIYA?` → `special.jiya` |
| Shots | 4 |
| Lines | 5 |
| Conditional insert | yes |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.move` | `wide` | `stadium_roof` | `pitch_centre` | 6.0s | moving |
| 2 | 0:06 | `camera.cut` | `medium` | `tunnel_mouth` | `NUSAIBA` | 8.0s | hard cut |
| 3 | 0:15 | `camera.cut` | `close` | `tunnel_bench` | `JEGA` | 14.0s | hard cut |
| 4 | 0:34 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | CALENDAR | `Sat · Week 8 · The Vice-Chancellor's Cup Final` | on-screen card |
| 0:01 | MUSIC | `stadium_drums` | ducked under dialogue |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:15 | `prop.show` | `{ id: prop.lucky_socks, at: JEGA }` |
| 0:30 | `actor.run` | `{ who: JEGA, to: pitch_centre }` |
| 0:31 | `actor.anim` | `{ who: CROWD, anim: cheer }` |

**Conditional insert**

> Apply only when the named flag is on. A skipped or disabled insert must leave no empty shot and no orphan line.

| T | If | Op | Args (raw) |
|---:|---|---|---|
| 0:11 | `special.jiya` | `say` | `{ who: JIYA, id: m019_open_j01, text: "It says 'a guest'. Not 'a good one'. No offence.", mood: dry }` |

**End state (exact)**

```
{ PLAYER: { at: pitch_midfield }, flags: { m019_started: true } }
```

**Continuity emitted:** `m019_started`

#### `cut_m019_mid_1` — Mid-scene 1

| Property | Value |
|---|---|
| Type | `event` |
| Max duration | 38s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `JEGA` → `npc.jega` · `SHAMSU` → `npc.shamsu` · `BOY` → `npc.small_boy` · `CROWD` → `crowd.fans` |
| Shots | 7 |
| Lines | 2 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `touchline_low` | `BOY` | 5.0s | hard cut |
| 2 | 0:05 | `camera.cut` | `close` | `penalty_spot_low` | `JEGA` | 12.0s | hard cut |
| 3 | 0:17 | `camera.cut` | `wide` | `behind_goal` | `JEGA` | 7.0s | hard cut |
| 4 | 0:21 | `camera.shake` | — | — | — | 0.4s | shake 0.2/0.4s |
| 5 | 0:24 | `camera.cut` | `medium` | `goal_line` | `SHAMSU` | 5.0s | hard cut |
| 6 | 0:29 | `camera.follow` | `medium` | — | `JEGA` | 8.0s | follow |
| 7 | 0:37 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | MUSIC | `stadium_drums` | stop this cue |
| 0:21 | SFX | `crossbar_bell` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:06 | `actor.anim` | `{ who: JEGA, anim: laugh }` |
| 0:07 | `actor.anim` | `{ who: JEGA, anim: kneel }` |
| 0:09 | `prop.show` | `{ id: prop.right_boot_first, at: JEGA }` |
| 0:13 | `actor.anim` | `{ who: JEGA, anim: stand }` |
| 0:15 | `actor.anim` | `{ who: JEGA, anim: shock }` |
| 0:19 | `actor.run` | `{ who: JEGA, to: penalty_spot }` |
| 0:30 | `actor.walk` | `{ who: JEGA, to: eng_team_line }` |
| 0:31 | `actor.anim` | `{ who: JEGA, anim: gesture }` |

**End state (exact)**

```
{ PLAYER: { at: pitch_centre }, flags: { cup_lost_y1: true } }
```

**Continuity emitted:** `cup_lost_y1`

#### `cut_m019_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 36s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `JEGA` → `npc.jega` · `BOY` → `npc.small_boy` · `ZAINAB` → `npc.zainab` |
| Shots | 4 |
| Lines | 3 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `touchline_low` | `JEGA` | 7.0s | hard cut |
| 2 | 0:07 | `camera.cut` | `medium` | `stand_row` | `ZAINAB` | 4.0s | hard cut |
| 3 | 0:11 | `camera.cut` | `wide` | `centre_circle_low` | `JEGA` | 14.0s | hard cut |
| 4 | 0:25 | `camera.cut` | `close` | `PLAYER` | `prop.team_photo` | 9.0s | hard cut |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `dusk` | — |
| 0:25 | MUSIC | `mystery_thread` | full |
| 0:34 | MUSIC | `mystery_thread` | stop this cue |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `prop.show` | `{ id: prop.armband, at: BOY }` |
| 0:08 | `actor.anim` | `{ who: ZAINAB, anim: cheer }` |
| 0:12 | `actor.anim` | `{ who: JEGA, anim: sit }` |
| 0:12 | `actor.anim` | `{ who: PLAYER, anim: sit }` |
| 0:19 | `actor.anim` | `{ who: JEGA, anim: laugh }` |
| 0:26 | `prop.show` | `{ id: prop.team_photo_twelfth_shoes, at: PLAYER }` |

**End state (exact)**

```
{ PLAYER: { at: centre_circle, items: { runners_up_medal: 1, team_photo_y1: 1 } }, flags: { m019_done: true, ms_06: true } }
```

**Continuity emitted:** `m019_done`, `ms_06` · items `runners_up_medal` 1, `team_photo_y1` 1 

### M020 · Six Plaques

**When:** Y1 · S2 Wk 9 · Tue · 16:00–20:00.  
**Blocks in order:** `cut_m020_open` → `cut_m020_mid_1` → `cut_m020_close`

**Mission flags:** `m020_started`, `met_kelechi`, `garden_gate_open`, `m020_done`, `plaques_six`, `sockets_ten_seen`, `seventh_space_seen`, `riddle_ten_mouths`, `six_sites_on_map`  
**Mission items granted:** `compass`

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m020_open` — Opening | `entry` | 32s | 4 | 5 | 5 | — |
| 2 | `cut_m020_mid_1` — Mid-scene 1 | `full` | 30s | 3 | 4 | 3 | — |
| 3 | `cut_m020_close` — Closing | `full` | 40s | 4 | 5 | 3 | — |

#### `cut_m020_open` — Opening

| Property | Value |
|---|---|
| Type | `entry` |
| Max duration | 32s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `KELECHI` → `npc.kelechi` · `LYZZY` → `npc.lyzzy` · `LILY` → `npc.lily` |
| Shots | 5 |
| Lines | 5 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.move` | `wide` | `sculpture_gate_arch` | `sculpture_lawn` | 6.0s | moving |
| 2 | 0:06 | `camera.cut` | `medium` | `drummer_statue_side` | `KELECHI` | 14.0s | hard cut |
| 3 | 0:16 | `camera.cut` | `pov` | `PLAYER` | `mall_roof_far` | 4.0s | hard cut |
| 4 | 0:20 | `camera.cut` | `medium` | `sculpture_bench` | `LYZZY` | 10.0s | hard cut |
| 5 | 0:30 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

No cue changes. Inherit the previous scene’s light and music.

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:07 | `actor.anim` | `{ who: KELECHI, anim: gesture }` |
| 0:12 | `actor.walk` | `{ who: PLAYER, to: drummer_statue_mark }` |

**End state (exact)**

```
{ PLAYER: { at: drummer_statue_mark, items: { compass: 1 } }, flags: { m020_started: true, met_kelechi: true } }
```

**Continuity emitted:** `m020_started`, `met_kelechi` · items `compass` 1 

#### `cut_m020_mid_1` — Mid-scene 1

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 30s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `MAKER` → `npc.maker` · `KELECHI` → `npc.kelechi` |
| Shots | 4 |
| Lines | 3 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.move` | `top` | `garden_over` | `prop.twine_web` | 7.0s | moving |
| 2 | 0:07 | `camera.cut` | `medium` | `sculpture_pond_bank` | `KELECHI` | 9.0s | hard cut |
| 3 | 0:16 | `camera.cut` | `close` | `garden_gate_post` | `MAKER` | 12.0s | hard cut |
| 4 | 0:28 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:24 | SFX | `gate_latch_old` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:17 | `prop.show` | `{ id: prop.relay_core, at: PLAYER }` |
| 0:18 | `actor.look` | `{ who: MAKER, at: prop.relay_core }` |
| 0:25 | `actor.anim` | `{ who: MAKER, anim: gesture }` |

**End state (exact)**

```
{ PLAYER: { at: garden_gate_inside }, flags: { garden_gate_open: true } }
```

**Continuity emitted:** `garden_gate_open`

#### `cut_m020_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 40s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `MAKER` → `npc.maker` · `OKONKWO` → `npc.okonkwo` · `TANKO` → `npc.tanko` |
| Shots | 5 |
| Lines | 3 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:01 | `camera.move` | `close` | `plinth_orbit` | `prop.plaques_six` | 9.0s | moving |
| 2 | 0:10 | `camera.cut` | `medium` | `garden_gate_post` | `OKONKWO` | 6.0s | hard cut |
| 3 | 0:16 | `camera.move` | `close` | `plinth_rim` | `prop.sockets_ten` | 6.0s | moving |
| 4 | 0:22 | `camera.cut` | `close` | `plinth_north` | `prop.seventh_space` | 6.0s | hard cut |
| 5 | 0:28 | `camera.cut` | `medium` | `garden_gate_low` | `TANKO` | 11.0s | hard cut |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `coil_glow` | — |
| 0:00 | SFX | `core_click` | — |
| 0:01 | FX | `plaques_light_six` | at `coil_plinth` |
| 0:16 | MUSIC | `mystery_thread` | full |
| 0:39 | MUSIC | `mystery_thread` | stop this cue |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:24 | `actor.look` | `{ who: MAKER, at: prop.seventh_space }` |
| 0:26 | `actor.look` | `{ who: MAKER, at: PLAYER }` |

**End state (exact)**

```
{ PLAYER: { at: coil_plinth }, flags: { m020_done: true, plaques_six: true, sockets_ten_seen: true, seventh_space_seen: true, riddle_ten_mouths: true, six_sites_on_map: true } }
```

**Continuity emitted:** `m020_done`, `plaques_six`, `sockets_ten_seen`, `seventh_space_seen`, `riddle_ten_mouths`, `six_sites_on_map`

### M021 · Wingman

**When:** Y1 · S2 Wk 10 · Sat (weekend) · 15:00–21:00.  
**Blocks in order:** `cut_m021_open` → `cut_m021_mid_1` → `cut_m021_close`

**Mission flags:** `m021_started`, `helen_yes`, `idk_her_joke`, `m021_done`, `gifts_unlocked`, `cinema_unlocked`  
**Mission items granted:** none

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m021_open` — Opening | `full` | 38s | 2 | 3 | 6 | — |
| 2 | `cut_m021_mid_1` — Mid-scene 1 | `full` | 38s | 2 | 2 | 7 | — |
| 3 | `cut_m021_close` — Closing | `full` | 30s | 4 | 4 | 3 | — |

#### `cut_m021_open` — Opening

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 38s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `JEGA` → `npc.jega` |
| Shots | 3 |
| Lines | 6 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `wide` | `kadanya_gate_path` | `prop.neem_thin` | 5.0s | hard cut |
| 2 | 0:05 | `camera.cut` | `medium` | `neem_side` | `JEGA` | 30.0s | hard cut |
| 3 | 0:35 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

No cue changes. Inherit the previous scene’s light and music.

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.show` | `{ who: JEGA }` |
| 0:02 | `actor.anim` | `{ who: JEGA, anim: wave }` |
| 0:31 | `actor.anim` | `{ who: JEGA, anim: gesture }` |

**End state (exact)**

```
{ PLAYER: { at: neem_side }, flags: { m021_started: true } }
```

**Continuity emitted:** `m021_started`

#### `cut_m021_mid_1` — Mid-scene 1

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 38s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `HELEN` → `npc.helen` |
| Shots | 2 |
| Lines | 7 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `volleyball_net_post` | `HELEN` | 34.0s | hard cut |
| 2 | 0:34 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

No cue changes. Inherit the previous scene’s light and music.

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.anim` | `{ who: HELEN, anim: stand }` |

**End state (exact)**

```
{ PLAYER: { at: volleyball_court }, flags: { helen_yes: true, idk_her_joke: true } }
```

**Continuity emitted:** `helen_yes`, `idk_her_joke`

#### `cut_m021_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 30s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `COMPANION` → `npc.partner_or_roomie` · `JEGA` → `npc.jega` · `HELEN` → `npc.helen` |
| Shots | 4 |
| Lines | 3 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `wide` | `cinema_back_row` | `cinema_screen` | 6.0s | hard cut |
| 2 | 0:06 | `camera.cut` | `medium` | `cinema_aisle` | `COMPANION` | 10.0s | hard cut |
| 3 | 0:16 | `camera.cut` | `medium` | `cinema_row_behind` | `JEGA` | 10.0s | hard cut |
| 4 | 0:28 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `night` | — |
| 0:01 | SFX | `projector_whirr` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:07 | `actor.anim` | `{ who: PLAYER, anim: sit }` |
| 0:17 | `actor.anim` | `{ who: JEGA, anim: sit }` |
| 0:19 | `actor.look` | `{ who: HELEN, at: JEGA }` |

**End state (exact)**

```
{ PLAYER: { at: cinema_seat }, flags: { m021_done: true, gifts_unlocked: true, cinema_unlocked: true } }
```

**Continuity emitted:** `m021_done`, `gifts_unlocked`, `cinema_unlocked`

### M022 · Everybody

**When:** Y1 · S2 Wk 12 · Mon–Fri · any hour; each person is where the timetable puts them.  
**Blocks in order:** `cut_m022_open` → `cut_m022_close`

**Mission flags:** `m022_started`, `m022_done`, `porter_thirty_years`, `everybody_ready`  
**Mission items granted:** `everybody_list`

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m022_open` — Opening | `full` | 40s | 3 | 4 | 6 | — |
| 2 | `cut_m022_close` — Closing | `full` | 34s | 2 | 2 | 4 | — |

#### `cut_m022_open` — Opening

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 40s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `MAKER` → `npc.maker` · `ROOMIE` → `npc.roomie` |
| Shots | 4 |
| Lines | 6 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `garden_gate_post` | `prop.garden_gate_ajar` | 4.0s | hard cut |
| 2 | 0:04 | `camera.cut` | `close` | `garden_bench_low` | `MAKER` | 26.0s | hard cut |
| 3 | 0:30 | `camera.cut` | `medium` | `room_table` | `ROOMIE` | 8.0s | hard cut |
| 4 | 0:37 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `dusk` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:31 | `actor.anim` | `{ who: ROOMIE, anim: write }` |

**End state (exact)**

```
{ PLAYER: { at: room_table, items: { everybody_list: 1 } }, flags: { m022_started: true } }
```

**Continuity emitted:** `m022_started` · items `everybody_list` 1 

#### `cut_m022_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 34s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `PORTER` → `npc.baba_porter` |
| Shots | 2 |
| Lines | 4 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `lodge_window` | `PORTER` | 30.0s | hard cut |
| 2 | 0:31 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

No cue changes. Inherit the previous scene’s light and music.

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `prop.show` | `{ id: prop.everybody_list, at: PORTER }` |
| 0:02 | `actor.look` | `{ who: PORTER, at: prop.everybody_list }` |
| 0:06 | `actor.anim` | `{ who: PORTER, anim: write }` |
| 0:21 | `actor.look` | `{ who: PORTER, at: hall_forecourt }` |
| 0:27 | `actor.walk` | `{ who: PORTER, to: hall_forecourt }` |

**End state (exact)**

```
{ PLAYER: { at: lodge_window }, flags: { m022_done: true, porter_thirty_years: true, everybody_ready: true } }
```

**Continuity emitted:** `m022_done`, `porter_thirty_years`, `everybody_ready`

### M023 · Exam Fever

**When:** Y1 · S2 Wk 14–15 · exam weeks · days and nights.  
**Blocks in order:** `cut_m023_open` → `cut_m023_mid_1` → `cut_m023_close`

**Mission flags:** `m023_started`, `zainab_asked_help`, `m023_done`, `aliyu_owes`, `feeder_2_seen`, `mall_sticker_seen`  
**Mission items granted:** `glucose`

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m023_open` — Opening | `ambient` | 22s | 3 | 4 | 2 | — |
| 2 | `cut_m023_mid_1` — Mid-scene 1 | `full` | 30s | 3 | 3 | 5 | — |
| 3 | `cut_m023_close` — Closing | `full` | 40s | 3 | 5 | 4 | — |

#### `cut_m023_open` — Opening

| Property | Value |
|---|---|
| Type | `ambient` |
| Max duration | 22s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `ROOMIE` → `npc.roomie` · `CROWD` → `crowd.students` |
| Shots | 4 |
| Lines | 2 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.move` | `wide` | `library_atrium_high` | `reading_desks` | 8.0s | moving |
| 2 | 0:08 | `camera.cut` | `medium` | `library_aisle` | `prop.mattress_in_library` | 5.0s | hard cut |
| 3 | 0:13 | `camera.cut` | `medium` | `library_desk` | `ROOMIE` | 7.0s | hard cut |
| 4 | 0:20 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | CALENDAR | `Week 14 · Exam week` | on-screen card |
| 0:00 | MUSIC | `exam_tension` | ducked under dialogue |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:09 | `actor.anim` | `{ who: CROWD, anim: sleep }` |

**End state (exact)**

```
{ PLAYER: { at: library_desk }, flags: { m023_started: true } }
```

**Continuity emitted:** `m023_started`

#### `cut_m023_mid_1` — Mid-scene 1

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 30s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `ZAINAB` → `npc.zainab` · `SHAMSU` → `npc.shamsu` |
| Shots | 3 |
| Lines | 5 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:01 | `camera.cut` | `close` | `PLAYER` | `prop.phone_text` | 14.0s | hard cut |
| 2 | 0:15 | `camera.cut` | `medium` | `corridor_mid` | `SHAMSU` | 13.0s | hard cut |
| 3 | 0:27 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `night` | — |
| 0:00 | SFX | `phone_buzz_night` | — |
| 0:16 | SFX | `knock_three` | — |

**Blocking and props**

No actor or prop ops. Use the authored idle set for the cast present.

**End state (exact)**

```
{ PLAYER: { at: corridor_mid }, flags: { zainab_asked_help: true } }
```

**Continuity emitted:** `zainab_asked_help`

#### `cut_m023_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 40s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `SHAMSU` → `npc.shamsu` · `ALIYU` → `npc.aliyu` |
| Shots | 5 |
| Lines | 4 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `substation_door` | `ALIYU` | 18.0s | hard cut |
| 2 | 0:18 | `camera.cut` | `close` | `van_rear` | `prop.mall_sticker` | 5.0s | hard cut |
| 3 | 0:23 | `camera.cut` | `close` | `switch_wall` | `prop.feeder_label_2` | 5.0s | hard cut |
| 4 | 0:29 | `camera.cut` | `top` | `exam_desk_over` | `prop.glucose_and_note` | 9.0s | hard cut |
| 5 | 0:38 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `night` | — |
| 0:18 | MUSIC | `mystery_thread` | full |
| 0:28 | MUSIC | `mystery_thread` | stop this cue |
| 0:28 | LIGHT | `day` | — |
| 0:29 | CALENDAR | `08:00 · Circuit Theory` | on-screen card |
| 0:31 | TITLE | `SLEEP. This is not advice.` | on-screen card |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.ride` | `{ who: ALIYU, vehicle: works_van, to: substation_door }` |
| 0:03 | `actor.exit` | `{ who: ALIYU, vehicle: works_van }` |

**End state (exact)**

```
{ PLAYER: { at: exam_desk, items: { glucose: 1 } }, flags: { m023_done: true, aliyu_owes: true, feeder_2_seen: true, mall_sticker_seen: true } }
```

**Continuity emitted:** `m023_done`, `aliyu_owes`, `feeder_2_seen`, `mall_sticker_seen` · items `glucose` 1 

### M024 · Convocation Night

**When:** Y1 · after exams · Sat (event: the seniors' convocation) · 18:00–midnight, then dawn.  
**Blocks in order:** `cut_m024_open` → `cut_m024_mid_1` → `cut_m024_mid_2` → `cut_m024_close`

**Mission flags:** `m024_started`, `coil1`, `prosperity`, `ms_07`, `count_face_truth`, `seal_1`, `m024_done`, `year1_done`, `note_five_more`, `zainab_playable`  
**Mission items granted:** `seal_engineering`

| # | Block | Type | Max | Cast | Shots | Lines | Conditional |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `cut_m024_open` — Opening | `event` | 40s | 3 | 5 | 3 | — |
| 2 | `cut_m024_mid_1` — Mid-scene 1 | `full` | 40s | 4 | 6 | 1 | — |
| 3 | `cut_m024_mid_2` — Mid-scene 2 | `full` | 40s | 4 | 4 | 7 | — |
| 4 | `cut_m024_close` — Closing | `full` | 30s | 1 | 3 | 0 | — |

#### `cut_m024_open` — Opening

| Property | Value |
|---|---|
| Type | `event` |
| Max duration | 40s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `SHAMSU` → `npc.shamsu` · `CROWD` → `crowd.families` |
| Shots | 5 |
| Lines | 3 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.move` | `wide` | `boulevard_crane` | `senate_steps_top` | 8.0s | moving |
| 2 | 0:08 | `camera.cut` | `medium` | `boulevard_side` | `SHAMSU` | 10.0s | hard cut |
| 3 | 0:18 | `camera.cut` | `close` | `senate_steps_low` | `senate_steps_top` | 10.0s | hard cut |
| 4 | 0:28 | `camera.cut` | `wide` | `boulevard_end` | `CROWD` | 10.0s | hard cut |
| 5 | 0:38 | `camera.return` | — | — | — | — | return, blend 0.8s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | CALENDAR | `Sat · Convocation` | on-screen card |
| 0:00 | LIGHT | `dusk` | — |
| 0:00 | MUSIC | `convocation_brass` | ducked under dialogue |
| 0:04 | FX | `boulevard_bulbs_on` | at `boulevard` |
| 0:15 | SFX | `power_down_rolling` | — |
| 0:15 | LIGHT | `blackout` | — |
| 0:16 | MUSIC | `convocation_brass` | stop this cue |
| 0:19 | MUSIC | `count_theme` | full |
| 0:19 | FX | `shade_gather` | at `senate_steps_top` |
| 0:29 | FX | `torch_bloom` | at `boulevard_end` |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:22 | `prop.show` | `{ id: prop.count_entropy_tall, at: senate_steps_top }` |

**End state (exact)**

```
{ PLAYER: { at: boulevard_mid }, flags: { m024_started: true } }
```

**Continuity emitted:** `m024_started`

#### `cut_m024_mid_1` — Mid-scene 1

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 40s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `MAKER` → `npc.maker` · `MUHAMMAD` → `npc.muhammad` · `CROWD` → `crowd.students` |
| Shots | 6 |
| Lines | 1 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `plinth_orbit` | `MAKER` | 7.0s | hard cut |
| 2 | 0:07 | `camera.cut` | `pov` | `MAKER` | `MUHAMMAD` | 5.0s | hard cut |
| 3 | 0:12 | `camera.cut` | `close` | `plinth_rim` | `MAKER` | 5.0s | hard cut |
| 4 | 0:18 | `camera.move` | `wide` | `air_ring_road` | `campus_core` | 12.0s | moving |
| 5 | 0:30 | `camera.cut` | `wide` | `senate_lawn` | `senate_steps_top` | 5.0s | hard cut |
| 6 | 0:38 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `torch` | — |
| 0:17 | SFX | `coil_in_tune` | — |
| 0:17 | LIGHT | `coil_glow` | — |
| 0:18 | MUSIC | `count_theme` | stop this cue |
| 0:18 | MUSIC | `main_theme_full` | full |
| 0:19 | FX | `prosperity_wave_1` | at `campus_core` |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.anim` | `{ who: MAKER, anim: gesture }` |
| 0:07 | `actor.show` | `{ who: MUHAMMAD }` |
| 0:08 | `prop.show` | `{ id: prop.lantern, at: MUHAMMAD }` |
| 0:13 | `actor.look` | `{ who: MAKER, at: coil_plinth }` |
| 0:30 | `prop.hide` | `{ id: prop.count_entropy_tall }` |

**End state (exact)**

```
{ PLAYER: { at: coil_plinth }, flags: { coil1: true, prosperity: 1, ms_07: true } }
```

**Continuity emitted:** `coil1`, `prosperity`, `ms_07`

#### `cut_m024_mid_2` — Mid-scene 2

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 40s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` · `SHAYI` → `npc.mai_shayi` · `DEAN` → `npc.dean_eng` · `GARBA` → `npc.garba` |
| Shots | 4 |
| Lines | 7 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `boulevard_side` | `SHAYI` | 20.0s | hard cut |
| 2 | 0:20 | `camera.cut` | `close` | `garden_gate_post` | `DEAN` | 10.0s | hard cut |
| 3 | 0:30 | `camera.cut` | `medium` | `senate_door` | `GARBA` | 8.0s | hard cut |
| 4 | 0:37 | `camera.return` | — | — | — | — | return, blend 1.0s |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `night` | — |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:18 | `actor.look` | `{ who: SHAYI, at: prop.weathervane }` |
| 0:21 | `prop.show` | `{ id: prop.seal_engineering, at: PLAYER }` |

**End state (exact)**

```
{ PLAYER: { at: senate_door, items: { seal_engineering: 1 } }, flags: { count_face_truth: true, seal_1: true } }
```

**Continuity emitted:** `count_face_truth`, `seal_1` · items `seal_engineering` 1 

#### `cut_m024_close` — Closing

| Property | Value |
|---|---|
| Type | `full` |
| Max duration | 30s |
| Skippable | yes |
| Play once | yes |
| Cast | `PLAYER` → `player` |
| Shots | 3 |
| Lines | 0 |
| Conditional insert | no |

**Shot list**

| # | T | Op | Shot | From | Look / who | Dur | Transition |
|---:|---:|---|---|---|---|---:|---|
| 1 | 0:00 | `camera.cut` | `medium` | `room_door` | `PLAYER` | 6.0s | hard cut |
| 2 | 0:06 | `camera.cut` | `top` | `PLAYER` | `prop.note` | 14.0s | hard cut |
| 3 | 0:20 | `camera.cut` | `close` | `room_desk_low` | `PLAYER` | 5.0s | hard cut |

**Sound, light, VFX and cards**

| T | Kind | Value | Detail |
|---:|---|---|---|
| 0:00 | LIGHT | `day` | — |
| 0:00 | MUSIC | `main_theme_full` | stop this cue |
| 0:09 | TITLE | `The Maker is watching. Welcome.` | on-screen card |
| 0:13 | MUSIC | `mystery_thread` | full |
| 0:15 | TITLE | `Five more.` | on-screen card |
| 0:25 | TITLE | `END OF YEAR 1` | on-screen card |
| 0:29 | MUSIC | `mystery_thread` | stop this cue |

**Blocking and props**

| T | Op | Args (raw) |
|---:|---|---|
| 0:01 | `actor.walk` | `{ who: PLAYER, to: room_desk }` |
| 0:07 | `prop.show` | `{ id: prop.note, at: room_desk }` |
| 0:14 | `prop.show` | `{ id: prop.note_second_line, at: room_desk }` |
| 0:21 | `actor.anim` | `{ who: PLAYER, anim: shock }` |

**End state (exact)**

```
{ PLAYER: { at: room_desk }, flags: { m024_done: true, year1_done: true, note_five_more: true, zainab_playable: true } }
```

**Continuity emitted:** `m024_done`, `year1_done`, `note_five_more`, `zainab_playable`

---

## 4 · Implementation checks

Before a mission is considered done:

1. **Order** — every block above exists once, with the exact ID, in the exact order.
2. **Timing** — every `at` lands on its authored second; no shot is cut short by dialogue overflow.
3. **End state** — natural end and skip produce identical flags, positions and items.
4. **Conditional** — each insert is gated by its `special.*` flag and leaves no orphan shot or line when off.
5. **Tokens** — the three runtime tokens are filled before playback; no bracket text reaches audio or subtitles.
6. **Anchors** — every `from` and `look` resolves to an authored anchor or cast member; no fallback camera.
7. **Cues** — every music, SFX, VFX, light and card cue fires at its authored time; no cue is left running into gameplay unless the canon says so.
8. **Skip** — skipping never strands an actor, leaves a black frame, or skips a required flag.

**Known engine-sensitive moments.**

- **M001 film blocks** are the cold open. No HUD until the window; the film blocks carry tone and must not be cut into a single montage.
- **M001 goat chase** is a movement tutorial. The goat waits; failure is not allowed to punish.
- **M003 / M018 radio countdown** uses the same seven-to-one line and must sound identical both times.
- **M012 Count Entropy** and **M024 convocation** both use crowd-gather mechanics; the cutscenes must not assume a fixed crowd size.
- **M013 / M021 tokens** are branch-dependent; the surrounding camera and mood are fixed, only the line changes.
- **M016 dive** has a failure state that is not death; the cutscene must resume without a hard reset.
- **M024** has the only end-of-year title card sequence; do not reuse it for a season trailer.
