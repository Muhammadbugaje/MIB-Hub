# 03 · Year 1 Script — *ARRIVING*

> **What this is:** the complete Year 1 screenplay, scene by scene, in play order. Every cutscene is reproduced from `docs/plan/missions/Y1.md` with its camera, staging, dialogue, sound and end state. Gameplay beats sit between scenes so the flow is readable without opening the mission file. Conditional `special.*` dialogue is separated at the end of each mission and never mixed into canon scenes.

> **What this is not:** a rewrite. Dialogue and line IDs are canonical and must be recorded exactly. Camera anchors are implementation keys, not prose. If a line reads oddly, it is intentional character voice — do not “fix” it.

---

## 1 · How to read this script

| Element | Meaning |
|---|---|
| `0:14` | Timecode from the start of that cutscene, in seconds. Rows are grouped at the same timecode. |
| `CUT` / `MOVE` / `FOLLOW` | Camera instruction. The two code spans are the `from` anchor and the `look` target. |
| **MUSIC** / **SFX** / **VFX** / **LIGHT** | Audio, effects and lighting cues. Cue names are final asset keys. |
| **CHARACTER:** “Line.” *(mood)* | Dialogue. The mood is the performance direction. The code beneath is the line ID used by voice files, subtitles and tests. |
| **TOKEN** | A line chosen at runtime by an earlier result (grades, gift, companion). It is a slot, not recordable text. |
| **End state** | Flags, positions and items that must be true when the scene ends. Never drop one. |

**Cutscene types.** `full` = authored cinematic; `entry` = plays on entering a location; `event` = triggered by a world event; `vehicle` = staged in or around a moving vehicle; `ambient` = short background scene with no player control.

**Coverage.** 24 missions · 78 cutscene blocks · 333 spoken cutscene lines · full 59 · vehicle 3 · event 8 · entry 6 · ambient 2. Nine of the blocks carry a conditional insert (9 lines); those rows are separated from the canon table and marked `CONDITIONAL`.

**Speaker names.** The name in a scene is the character, resolved through that scene’s `cast` block. A local label can therefore mean different people in different missions: `PORTER` is Baba Porter in M001 and the SUG Porter in M010; `CLERK` is Mrs. Adebayo in M002 and the Engineering Clerk in M020. Use the cast block, never the label alone.

**Conditional characters.** Jiya, Taty and Madison are marked `CONDITIONAL`. Their lines appear only in the “Conditional special dialogue” section of a mission, never in the screenplay tables. If the matching flag is off, use the `[ELSE]` staging; if no `[ELSE]` is given, the moment simply has no line.

---

## 2 · Mission index

| Mission | Title | When | Blocks | Lines | Runtime |
|---|---|---|---:|---:|---:|
| [M001](#m001--welcome-fresher) | Welcome, Fresher | Y1 · Freshers' Week · Mon (resumption day) · 07:00 to sunset. | 8 | 28 | 3:56 |
| [M002](#m002--queue-theory) | Queue Theory | Y1 · Freshers' Week · Tue · 08:00–16:00. | 3 | 12 | 1:30 |
| [M003](#m003--belle-first) | Belle First | Y1 · Freshers' Week · Wed · 18:00–23:00. | 4 | 12 | 1:48 |
| [M004](#m004--matric-fit) | Matric Fit | Y1 · S1 Wk 2 · Fri (matriculation, event day) · 08:00–14:00. | 3 | 15 | 1:26 |
| [M005](#m005--first-lecture-wrong-theatre) | First Lecture, Wrong Theatre | Y1 · S1 Wk 3 · Mon (lecture day) · 07:40–10:00. | 3 | 14 | 1:36 |
| [M006](#m006--mai-shayi-knows) | Mai Shayi Knows | Y1 · S1 Wk 3 · Thu · 19:00–22:00. | 3 | 17 | 1:50 |
| [M007](#m007--fresher-tax) | Fresher Tax | Y1 · S1 Wk 4 · Sat (weekend) · 16:00. | 2 | 11 | 1:04 |
| [M008](#m008--left-boot-first) | Left Boot First | Y1 · S1 Wk 5 · Tue (lecture day) · 17:00, football hour. | 3 | 17 | 1:42 |
| [M009](#m009--doctors-orders) | Doctor's Orders | Y1 · S1 Wk 5 · Wed · 20:00–23:30 (night). | 3 | 15 | 1:44 |
| [M010](#m010--the-plug) | The Plug | Y1 · S1 Wk 5 · Sat (weekend) · 11:00–14:00. | 3 | 16 | 1:32 |
| [M011](#m011--test-week-one-lamp) | Test Week, One Lamp | Y1 · S1 Wk 6–7 · Mon–Thu (test week) · evenings, and one 08:00 paper. | 3 | 14 | 1:40 |
| [M012](#m012--count-entropy) | Count Entropy | Y1 · S1 Wk 14 · Thu (exam week) · 21:00–01:00 (night). | 4 | 15 | 2:08 |
| [M013](#m013--results-day) | Results Day | Y1 · S2 Wk 1 · Mon (results day, event) · 09:00–15:00. | 3 | 12 | 1:32 |
| [M014](#m014--slys-last-stand) | Sly's Last Stand | Y1 · S2 Wk 2 · Sat (weekend) · 07:00–17:00. | 3 | 13 | 1:32 |
| [M015](#m015--baba-dams-pier) | Baba Dam's Pier | Y1 · S2 Wk 3 · Sun (weekend) · 09:00 to sunset. | 3 | 11 | 1:30 |
| [M016](#m016--the-dam-at-midnight) | The Dam at Midnight | Y1 · S2 Wk 4 · Fri · 23:00–02:00 (night; harmattan haze). | 3 | 7 | 1:36 |
| [M017](#m017--keke-grand-prix) | Keke Grand Prix | Y1 · S2 Wk 5 · Sat (weekend) · 10:00–15:00. | 3 | 16 | 1:32 |
| [M018](#m018--radio-silence) | Radio Silence | Y1 · S2 Wk 6 · Wed · 18:00–midnight. | 3 | 18 | 1:48 |
| [M019](#m019--the-vice-chancellors-cup) | The Vice-Chancellor's Cup | Y1 · S2 Wk 8 · Sat (event: inter-faculty final) · 16:00. | 3 | 11 | 1:50 |
| [M020](#m020--six-plaques) | Six Plaques | Y1 · S2 Wk 9 · Tue · 16:00–20:00. | 3 | 11 | 1:42 |
| [M021](#m021--wingman) | Wingman | Y1 · S2 Wk 10 · Sat (weekend) · 15:00–21:00. | 3 | 16 | 1:46 |
| [M022](#m022--everybody) | Everybody | Y1 · S2 Wk 12 · Mon–Fri · any hour; each person is where the timetable puts them. | 2 | 10 | 1:14 |
| [M023](#m023--exam-fever) | Exam Fever | Y1 · S2 Wk 14–15 · exam weeks · days and nights. | 3 | 11 | 1:32 |
| [M024](#m024--convocation-night) | Convocation Night | Y1 · after exams · Sat (event: the seniors' convocation) · 18:00–midnight, then dawn. | 4 | 11 | 2:30 |
| **Total** | | | **78** | **333** | **42:00** |

> Runtime is the sum of each block’s `maxDuration`, not a measured playthrough. Gameplay between scenes is additional.

---

# ACT I · ARRIVAL

*Missions M001–M004.* Freshers’ Week. The world, the cast, the four physical clues, and the first note. The act ends with the player photographed, registered, and watched.

## M001 · Welcome, Fresher

**When:** Y1 · Freshers' Week · Mon (resumption day) · 07:00 to sunset.  
**Where:** gate, hostel, student (the Spot), ring road, agric.  
**Who:** Mum, Dad, Baba Porter, {{ROOMIE}}, Mama Nkechi, Malam Sule, Sarki the goat.  
**Special helpers (conditional):** Taty (a passing bark only).  
**Mystery:** plants C-NOTE (the note), C-SYMBOL (inside the tin, on the note), C-CLOCK (6:06, and one strike), C-HUM (the garden), C-GOAT ("one engineering boy"), MS-01 (a still figure in the film).  
**Connects to:** nothing earlier. This is the first ten minutes, exactly as bible §3.

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Walk to the window` · `loc.hostel.window` · completeWhen: `reach(loc.hostel.window)` · fail: none
2. `Follow {{ROOMIE}} to the Spot` · `loc.student.spot` · completeWhen: `follow(npc.roomie, 12)` then `reach(loc.student.spot_counter)` · fail: none
3. `Buy two plates and eat` · `loc.student.spot_counter` · completeWhen: `use(item.plate_jollof)` · fail: none
4. `Catch the goat!` · `loc.student.spot` → `loc.agric.suya_fence` · completeWhen: `reach(prop.goat_sarki)` after 3 waypoints · fail: none (the goat waits)
5. `Ride the goat back to the farm` · `loc.agric.farm_gate` · completeWhen: `ride.arrive(bicycle, loc.agric.farm_gate)` · fail: none
6. `Look behind the barn` · `loc.agric.barn` · completeWhen: `collect(item.kola_vigour, 1)` · fail: none
7. `Go home` · `loc.hostel.room` · completeWhen: `reach(loc.hostel.corridor)` at dusk → `cutscene.end(cut_m001_close)`

### Film A — `cut_m001_film_a`

**Type:** `full` · **Max duration:** 28s · **Skippable:** yes · **Play once:** yes  
**First frame:** `air_dam_east` → `campus_core`  
**Cast:** no cast — landscape / prop only

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `day`.<br>**MOVE** — WIDE, `air_dam_east` → `campus_core` (9.0s). | **MUSIC** — `main_theme_dawn`. |
| 0:09 | **MOVE** — WIDE, `air_ring_road` → `twin_theatres` (8.0s). | — |
| 0:17 | **CUT** — MEDIUM, `clock_tower_face` → `clock_hands_606` (5.0s). | — |
| 0:19 | — | **SFX** — `cock_crow_wrong_time`. |
| 0:22 | **MOVE** — WIDE, `air_gate_high` → `gate_road` (5.0s). | — |

**End state:** Flags: `film_a`=true

### Film B — `cut_m001_film_b`

**Type:** `vehicle` · **Max duration:** 40s · **Skippable:** yes · **Play once:** yes  
**First frame:** `gate_kerb_low` → `family_car`  
**Cast:** `PLAYER` → The Fresher (`player`) · `MUM` → Mum (`npc.mum`) · `DAD` → Dad (`npc.dad`) · `GUARD` → Gate Guard (`npc.gate_guard`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — MEDIUM, `gate_kerb_low` → `family_car` (5.0s). | — |
| 0:01 | Dad rides `family_car` to `gate_barrier`. | — |
| 0:05 | — | **Dad:** “This is not the main gate.” *(stern)*<br><code>m001_film_01</code> |
| 0:08 | — | **Gate Guard:** “Oga, it is the only gate.” *(bored)*<br><code>m001_film_02</code> |
| 0:11 | **CUT** — CLOSE, `car_back_seat` → Mum (12.0s). | — |
| 0:12 | — | **Mum:** “Don't follow bad friends.” *(stern)*<br><code>m001_film_03</code> |
| 0:15 | — | **Mum:** “Don't follow good friends too closely either.” *(stern)*<br><code>m001_film_04</code> |
| 0:19 | — | **Mum:** “Eat. Pray. Call me.” *(warm)*<br><code>m001_film_05</code> |
| 0:23 | — | **Dad:** “When I was your age I trekked to school.” *(proud)*<br><code>m001_film_06</code> |
| 0:27 | — | **Mum:** “You took a bus.” *(dry)*<br><code>m001_film_07</code> |
| 0:29 | The Fresher laughs. | — |

**End state:** Flags: `film_b`=true

### Film C — `cut_m001_film_c`

**Type:** `full` · **Max duration:** 32s · **Skippable:** yes · **Play once:** yes  
**First frame:** `hall_forecourt` → Baba Porter  
**Cast:** `PLAYER` → The Fresher (`player`) · `PORTER` → Baba Porter (`npc.baba_porter`) · `MUM` → Mum (`npc.mum`) · `DAD` → Dad (`npc.dad`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — WIDE, `hall_forecourt` → Baba Porter (6.0s). | — |
| 0:01 | Baba Porter carries the load. | — |
| 0:04 | **FOLLOW** — MEDIUM on Baba Porter (10.0s). | — |
| 0:06 | — | **Baba Porter:** “Sign here. And here. Don't lose it.” *(bored)*<br><code>m001_film_08</code> |
| 0:11 | — | **Baba Porter:** “Fourth floor. There is no lift.” *(bored)*<br><code>m001_film_09</code> |
| 0:15 | — | **Baba Porter:** “There has never been a lift.” *(dry)*<br><code>m001_film_10</code> |
| 0:18 | **CUT** — MEDIUM, `room_door` → Mum (8.0s). | — |
| 0:19 | Mum gestures. | — |
| 0:26 | Dad gestures. | — |
| 0:27 | — | **Dad:** “Manage it.” *(whisper)*<br><code>m001_film_11</code> |

**End state:** Flags: `film_c`=true · The Fresher: items `naira` 5000

### Film D — `cut_m001_film_d`

**Type:** `full` · **Max duration:** 30s · **Skippable:** yes · **Play once:** yes  
**First frame:** `room_centre` → Mum  
**Cast:** `PLAYER` → The Fresher (`player`) · `MUM` → Mum (`npc.mum`) · `DAD` → Dad (`npc.dad`) · `MUHAMMAD` → Muhammad (`npc.muhammad`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — CLOSE, `room_centre` → Mum (6.0s). | — |
| 0:01 | Mum hugs. | — |
| 0:07 | **CUT** — WIDE, `hostel_window` → `family_car` (8.0s). | — |
| 0:08 | Dad rides `family_car` to `gate_road_far`. | — |
| 0:12 | — | **Mum:** “CALL ME!” *(excited)*<br><code>m001_film_12</code> |
| 0:15 | **MOVE** — WIDE, `gate_crane` → `crowd_freshers` (9.0s). | — |
| 0:17 | Muhammad is revealed. | — |
| 0:21 | **CUT** — WIDE, `gate_crane_b` → `crowd_freshers` (3.0s).<br>Muhammad is no longer visible. | — |
| 0:24 | **TITLE CARD** — “{{GAME\_NAME}}”. | — |

**End state:** Flags: `film_done`=true · The Fresher: at `hostel_bed`

### Film E — `cut_m001_film_e`

**Type:** `full` · **Max duration:** 34s · **Skippable:** yes · **Play once:** yes  
**First frame:** `room_corner` → The Roommate  
**Cast:** `PLAYER` → The Fresher (`player`) · `ROOMIE` → The Roommate (`npc.roomie`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — MEDIUM, `room_corner` → The Roommate (8.0s). | — |
| 0:01 | The Roommate eats. | — |
| 0:02 | — | **The Roommate:** “Ah, you're awake. I was guarding your biscuits.” *(amused)*<br><code>m001_open_01</code> |
| 0:06 | — | **The Roommate:** “From inside.” *(dry)*<br><code>m001_open_02</code> |
| 0:09 | — | **The Roommate:** “Riddle: what's yours, but your roommate uses it more?” *(excited)*<br><code>m001_open_03</code> |
| 0:14 | — | **The Fresher:** “…My biscuits.” *(dry)*<br><code>m001_open_p01</code> |
| 0:17 | — | **The Roommate:** “Your NAME. But also the biscuits.” *(amused)*<br><code>m001_open_04</code> |
| 0:21 | The Roommate points. | — |
| 0:22 | — | **The Roommate:** “Come and see your kingdom.” *(warm)*<br><code>m001_open_05</code> |
| 0:25 | **CALENDAR CARD** — “Mon 16 Sep · Freshers' Week · Resumption day”. | — |
| 0:27 | **RETURN TO PLAYER** — blend 1.5s. | — |

**End state:** Flags: `m001_started`=true · The Fresher: at `hostel_bed_stand`

### Mid-scene 1 — `cut_m001_mid_1`

**Type:** `event` · **Max duration:** 18s · **Skippable:** yes · **Play once:** yes  
**First frame:** `spot_rafters` → Sarki the Goat  
**Cast:** `PLAYER` → The Fresher (`player`) · `ROOMIE` → The Roommate (`npc.roomie`) · `GOAT` → Sarki the Goat (`prop.goat_sarki`) · `SUYA` → Suya Man (`npc.suya_man`) · `CROWD` → The Freshers (`crowd.freshers`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | — | **SFX** — `goat_bell_fast`. |
| 0:01 | **CUT** — WIDE, `spot_rafters` → Sarki the Goat (4.0s). | — |
| 0:01 | Sarki the Goat runs to `suya_table_top`. | — |
| 0:03 | — | **The Freshers:** “Faaa!” *(excited)*<br><code>m001_mid1_01</code> |
| 0:05 | — | **Suya Man:** “Not the yaji! NOT THE YAJI!” *(scared)*<br><code>m001_mid1_02</code> |
| 0:07 | **CUT** — CLOSE, `suya_table_low` → Sarki the Goat (3.0s). | — |
| 0:08 | Sarki the Goat looks at The Fresher. | — |
| 0:10 | — | **The Fresher:** “…That goat is looking at me.” *(dry)*<br><code>m001_mid1_p01</code> |
| 0:13 | — | **The Roommate:** “Freshers chase. It's tradition. Since now.” *(excited)*<br><code>m001_mid1_03</code> |
| 0:16 | **RETURN TO PLAYER** — blend 0.8s. | — |

**End state:** Flags: `goat_loose`=true · GOAT: at `spot_exit_east`

### Mid-scene 2 — `cut_m001_mid_2`

**Type:** `full` · **Max duration:** 24s · **Skippable:** yes · **Play once:** yes  
**First frame:** `farm_gate_post` → Malam Sule  
**Cast:** `PLAYER` → The Fresher (`player`) · `ROOMIE` → The Roommate (`npc.roomie`) · `SULE` → Malam Sule (`npc.malam_sule`) · `GOAT` → Sarki the Goat (`prop.goat_sarki`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — MEDIUM, `farm_gate_post` → Malam Sule (8.0s). | — |
| 0:01 | — | **Malam Sule:** “Sarki! Again!” *(stern)*<br><code>m001_mid2_01</code> |
| 0:04 | — | **Malam Sule:** “One engineering boy was lecturing it. On littering.” *(dry)*<br><code>m001_mid2_02</code> |
| 0:09 | — | **Malam Sule:** “Ten minutes. Left the gate open.” *(dry)*<br><code>m001_mid2_03</code> |
| 0:13 | **CUT** — CLOSE, `farm_gate_low` → Malam Sule (6.0s). | — |
| 0:14 | — | **Malam Sule:** “You brought him back. People don't, you know.” *(warm)*<br><code>m001_mid2_04</code> |
| 0:18 | — | **Malam Sule:** “Behind the barn. The old kola tree. Look down.” *(whisper)*<br><code>m001_mid2_05</code> |
| 0:22 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `goat_returned`=true · The Fresher: at `farm_gate`; items `naira` 5500

### Closing — `cut_m001_close`

**Type:** `full` · **Max duration:** 30s · **Skippable:** yes · **Play once:** yes  
**First frame:** `corridor_far_end` → `room_door`  
**Cast:** `PLAYER` → The Fresher (`player`) · `ROOMIE` → The Roommate (`npc.roomie`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `dusk`.<br>**CUT** — WIDE, `corridor_far_end` → `room_door` (6.0s). | — |
| 0:02 | **VFX** — `flicker` at `corridor_lights`. | — |
| 0:04 | — | **MUSIC OUT** — all cues. |
| 0:06 | **CUT** — CLOSE, `door_floor` → `prop.note` (5.0s). | — |
| 0:07 | Prop `prop.note` appears at `room_door_gap`. | — |
| 0:08 | The Fresher kneels. | — |
| 0:11 | **TITLE CARD** — “The Maker is watching. Welcome.”. | — |
| 0:15 | **CUT** — POV, `PLAYER` → `corridor_far_end` (4.0s). | — |
| 0:19 | — | **SFX** — `clock_strike_single_far`. |
| 0:21 | The Roommate looks at `prop.note`. | — |
| 0:22 | — | **The Roommate:** “…Don't lose that.” *(whisper)*<br><code>m001_close_01</code> |
| 0:25 | **TITLE CARD** — “YEAR 1”. | — |

**End state:** Flags: `m001_done`=true, `journal_note`=true · The Fresher: at `room_door`; items `note_maker` 1, `kola_vigour` 1

### Conditional special dialogue

> **Do not record or stage these in the canon pass.** They exist only when the named real-person flag is enabled, and must be cut cleanly when it is off. They are never romance content, never marketing, and never in a non-conditional cutscene.

**Taty** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m001_play_t01` | “Bora! Run, fresher, the goat is winning!” | — |
| `m001_play_t02` | “Don't look at me, I'm on lap six!” | — |

**Staging and `[ELSE]` from `Y1.md`:**

> - **[IF special.taty]** During step 4 she jogs through the chase the other way, a cat in her hood, not breaking stride. No help, no step: a bark and a wave, so her fans find her on day one. Lines: `m001_play_t01` "Bora! Run, fresher, the goat is winning!" · `m001_play_t02` "Don't look at me, I'm on lap six!"
> - **[ELSE]** A senior with a phone films you instead ("Fresher, smile!"). Nothing else changes.

## M002 · Queue Theory

**When:** Y1 · Freshers' Week · Tue · 08:00–16:00.  
**Where:** admin: Senate, Registry, Bursary, bank.  
**Who:** Malam Garba, Mrs. Adebayo, Mr. Clement, Aleeya, Muhammad, Mum (phone).  
**Special helpers (conditional):** Jiya.  
**Mystery:** plants C-DOOR7 (a door with no handle), MS-02 (he knows your name; the clerk talks past him), C-CLOCK (the bank's clock also says 6:06: "We set it by the tower").  
**Connects to:** M1 (the note is in your Pockets; Malam Garba sees it).

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Join the Senate queue` · `loc.admin.senate_steps` · completeWhen: `minigame.pass(queue)` · fail: none
2. `Get four passport photos` · `loc.admin.registry` → `loc.market.photo_kiosk` · completeWhen: `deliver(item.passport_x4, npc.mrs_adebayo)` · fail: none
3. `Answer Mum's call` · anywhere · completeWhen: `talk(npc.mum)` (phone) · fail: none
4. `Open a bank account` · `loc.admin.bank` · completeWhen: `flag(bank_account)` · fail: none
5. `Reach the Bursary` · `loc.admin.bursary` · completeWhen: `choice(m002_shortcut)` then `reach(loc.admin.bursary)` · fail: `shortcut → locked gate, lose 60 game minutes, optional ₦500 fine` → retry: go round
6. `Get the last stamp from Malam Garba` · `loc.admin.senate_basement` · completeWhen: `talk(npc.garba)` → `cutscene.end(cut_m002_close)`

### Opening — `cut_m002_open`

**Type:** `full` · **Max duration:** 32s · **Skippable:** yes · **Play once:** yes  
**First frame:** `senate_crane_high` → `senate_queue`  
**Cast:** `PLAYER` → The Fresher (`player`) · `ALEEYA` → Aleeya (`npc.aleeya`) · `CLERK` → Mrs. Adebayo (`npc.mrs_adebayo`) · `JIYA?` → Jiya (`special.jiya`) — `CONDITIONAL`

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **MOVE** — TOP, `senate_crane_high` → `senate_queue` (6.0s). | — |
| 0:01 | — | **MUSIC** — `queue_theme` (ducked under dialogue). |
| 0:02 | The Fresher walks to `queue_end`. | — |
| 0:06 | **CUT** — MEDIUM, `queue_side` → Aleeya (10.0s). | — |
| 0:07 | — | **Aleeya:** “I'll hold your bag. And your place.” *(warm)*<br><code>m002_open_01</code> |
| 0:11 | — | **Aleeya:** “You're so patient. Like a goat tied to a post.” *(amused)*<br><code>m002_open_02</code> |
| 0:15 | — | **The Fresher:** “…Thank you?” *(dry)*<br><code>m002_open_p01</code> |
| 0:17 | **CUT** — CLOSE, `registry_window` → Mrs. Adebayo (6.0s). | — |
| 0:18 | — | **Mrs. Adebayo:** “Four passports.” *(bored)*<br><code>m002_open_03</code> |
| 0:29 | **RETURN TO PLAYER** — blend 1.0s. | — |

**Conditional insert — `special.jiya`**

> Plays only when the named real-person flag is on. If it is off, cut these rows; the surrounding scene, camera and timing continue without them. This insert is never part of the canon pass and never a romance beat.

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:23 | **CUT** — MEDIUM, `queue_front` → Jiya (5.0s). | — |
| 0:24 | — | **Jiya:** “Four. In a digital age. Right.” *(dry)*<br><code>m002_open_j01</code> |

**End state:** Flags: `m002_started`=true, `met_aleeya`=true · The Fresher: at `queue_end`

### Mid-scene 1 — `cut_m002_mid_1`

**Type:** `full` · **Max duration:** 30s · **Skippable:** yes · **Play once:** yes  
**First frame:** `bursary_window` → Mr. Clement  
**Cast:** `PLAYER` → The Fresher (`player`) · `CLEMENT` → Mr. Clement (`npc.mr_clement`) · `MUHAMMAD` → Muhammad (`npc.muhammad`) · `CLERK` → Mrs. Adebayo (`npc.mrs_adebayo`) · `CROWD` → The Freshers (`crowd.freshers`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — MEDIUM, `bursary_window` → Mr. Clement (4.0s). | — |
| 0:01 | — | **Mr. Clement:** “Network.” *(bored)*<br><code>m002_mid1_01</code> |
| 0:03 | The Freshers sits. | — |
| 0:05 | **CUT** — OVER_SHOULDER, `PLAYER` → Muhammad (12.0s). | — |
| 0:06 | Muhammad is revealed. | — |
| 0:07 | — | **Muhammad:** “Excuse me. Sorry.” *(warm)*<br><code>m002_mid1_02</code> |
| 0:09 | — | **Muhammad:** “Don't take the shortcut, {{PLAYER\_NAME}}.” *(warm)*<br><code>m002_mid1_03</code> |
| 0:13 | — | **Muhammad:** “The gate is locked on Tuesdays.” *(neutral)*<br><code>m002_mid1_04</code> |
| 0:16 | — | **The Fresher:** “How do you know my name?” *(neutral)*<br><code>m002_mid1_p01</code> |
| 0:19 | **CUT** — MEDIUM, `registry_window` → Mrs. Adebayo (5.0s). | — |
| 0:19 | Mrs. Adebayo looks at `queue_behind_muhammad`. | — |
| 0:20 | — | **Mrs. Adebayo:** “Next.” *(bored)*<br><code>m002_mid1_05</code> |
| 0:24 | **CUT** — POV, `PLAYER` → `muhammad_mark` (4.0s).<br>Muhammad is no longer visible. | — |
| 0:28 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `met_muhammad`=true, `ms_02`=true · The Fresher: at `bursary_queue`

### Closing — `cut_m002_close`

**Type:** `full` · **Max duration:** 28s · **Skippable:** yes · **Play once:** yes  
**First frame:** `basement_corridor` → `door7`  
**Cast:** `PLAYER` → The Fresher (`player`) · `GARBA` → Malam Garba (`npc.garba`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `day`.<br>**FOLLOW** — MEDIUM on The Fresher (6.0s). | — |
| 0:03 | **CUT** — MEDIUM, `basement_corridor` → `door7` (4.0s). | — |
| 0:07 | **CUT** — MEDIUM, `garba_desk_side` → Malam Garba (8.0s). | — |
| 0:08 | Malam Garba writes. | — |
| 0:10 | — | **SFX** — `rubber_stamp`. |
| 0:12 | Malam Garba looks at `prop.note`. | — |
| 0:15 | **CUT** — CLOSE, `garba_desk_low` → Malam Garba (6.0s). | — |
| 0:17 | — | **Malam Garba:** “Hm.” *(neutral)*<br><code>m002_close_01</code> |
| 0:20 | Malam Garba writes. | — |
| 0:23 | **CUT** — WIDE, `senate_lawn` → `clock_hands_606` (4.0s). | — |

**End state:** Flags: `m002_done`=true, `saw_door7`=true, `garba_hm`=true · The Fresher: at `senate_basement_stair`; items `student_id` 1

### Conditional special dialogue

> **Do not record or stage these in the canon pass.** They exist only when the named real-person flag is enabled, and must be cut cleanly when it is off. They are never romance content, never marketing, and never in a non-conditional cutscene.

**Jiya** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m002_play_j01` | “Right. 'Sundry charges.' Sundry what, precisely?” | — |
| `m002_play_j02` | “Trespass on a path. A \*path\*. Mate, that's what paths are for.” | — |
| `m002_play_j03` | “With respect, officer, and I mean a great deal of it: which regulation?” | — |
| `m002_play_j04` | “You paid without reading it? You're the reason small print exists.” | — |
| `m002_play_j05` | “I'm Jiya. I did law. Then I got better.” | — |

**Staging and `[ELSE]` from `Y1.md`:**

> - **[IF special.jiya]** She is two places ahead of you in the Bursary queue with a coffee, reading the fee notice like a contract. If you took the shortcut and were fined, she walks you back to the security man and the fine is cancelled (Legal Immunity). If you did not, she annotates the fee notice and saves you ₦300 in "sundry charges". Lines: `m002_play_j01` "Right. 'Sundry charges.' Sundry what, precisely?" · `m002_play_j02` "Trespass on a path. A *path*. Mate, that's what paths are for." · `m002_play_j03` "With respect, officer, and I mean a great deal of it: which regulation?" · `m002_play_j04` "You paid without reading it? You're the reason small print exists." · `m002_play_j05` "I'm Jiya. I did law. Then I got better."
> - **[ELSE]** Aleeya quietly tells you the "sundry charges" are optional (the same ₦300); the fine, if any, stands. Nothing else changes.

## M003 · Belle First

**When:** Y1 · Freshers' Week · Wed · 18:00–23:00.  
**Where:** hostel: kitchen, corridor.  
**Who:** {{ROOMIE}}, Mama Nkechi (phone), Baba Porter, a quiet fresher (Idris), corridor freshers.  
**Mystery:** plants C-BROADCAST (three notes; a woman counts down from seven); first shade (what moves in the dark); C-KB (he sold out of candles at noon, at double price).  
**Connects to:** M1 (the corridor that flickered); M2 (the money from home buys the ingredients).

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Buy ingredients` · `loc.market.main` · completeWhen: `collect(item.jollof_kit, 1)` · fail: none
2. `Cook jollof with {{ROOMIE}}` · `loc.hostel.kitchen` · completeWhen: `minigame.pass(cook, 50%)` (interrupted at 50% by design) · fail: none
3. `Make soaked garri` · `loc.hostel.kitchen` · completeWhen: `minigame.pass(cook)` recipe `garri` · fail: `hot water → {{ROOMIE}} stops you` → retry: at once
4. `Fetch sugar from your room` · `loc.hostel.room` · completeWhen: `collect(item.sugar, 1)` · fail: none
5. `Bring the fresher to the kitchen` · `loc.hostel.corridor` · completeWhen: `talk(npc.idris)` then `escort(npc.idris, loc.hostel.kitchen)` · fail: `walk away → the shade reaches the door; he is found cold and quiet; fetch him with food` → retry: step 5
6. `Share the cup` · `loc.hostel.kitchen` · completeWhen: `cutscene.end(cut_m003_close)`

### Opening — `cut_m003_open`

**Type:** `full` · **Max duration:** 26s · **Skippable:** yes · **Play once:** yes  
**First frame:** `room_table` → `prop.onion`  
**Cast:** `PLAYER` → The Fresher (`player`) · `ROOMIE` → The Roommate (`npc.roomie`) · `NKECHI` → Mama Nkechi (`npc.mama_nkechi`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — CLOSE, `room_table` → `prop.onion` (4.0s). | — |
| 0:01 | The Fresher takes a phone call. | — |
| 0:02 | — | **Mama Nkechi:** “Fry the tomato till it stops shouting.” *(stern)*<br><code>m003_open_01</code> |
| 0:06 | — | **Mama Nkechi:** “Add water early and I will know.” *(stern)*<br><code>m003_open_02</code> |
| 0:10 | **CUT** — MEDIUM, `room_corner` → The Roommate (10.0s). | — |
| 0:10 | — | **The Fresher:** “Will you help?” *(neutral)*<br><code>m003_open_p01</code> |
| 0:13 | — | **The Roommate:** “I'm more of a consultant.” *(proud)*<br><code>m003_open_03</code> |
| 0:16 | — | **The Roommate:** “KB sold out of candles. At noon. Who knew?” *(whisper)*<br><code>m003_open_04</code> |
| 0:22 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m003_started`=true · The Fresher: at `room_door`

### Mid-scene 1 — `cut_m003_mid_1`

**Type:** `event` · **Max duration:** 24s · **Skippable:** yes · **Play once:** yes  
**First frame:** `kitchen_door` → The Roommate  
**Cast:** `PLAYER` → The Fresher (`player`) · `ROOMIE` → The Roommate (`npc.roomie`) · `CROWD` → The Freshers (`crowd.freshers`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | — | **SFX** — `power_down_whine`. |
| 0:00 | **LIGHT** — `blackout`. | — |
| 0:01 | — | **SFX** — `hostel_groan_wave`. |
| 0:03 | **CUT** — MEDIUM, `kitchen_door` → The Roommate (8.0s). | — |
| 0:04 | — | **The Freshers:** “Ahn ahn! NEPA!” *(sad)*<br><code>m003_mid1_01</code> |
| 0:07 | — | **The Roommate:** “They have taken light. Welcome to university.” *(dry)*<br><code>m003_mid1_02</code> |
| 0:11 | **LIGHT** — `torch`. | — |
| 0:12 | — | **The Roommate:** “Plan B. Garri. Cold water only.” *(stern)*<br><code>m003_mid1_03</code> |
| 0:16 | — | **The Roommate:** “Hot water? You want eba by accident?” *(amused)*<br><code>m003_mid1_04</code> |
| 0:21 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `blackout_1`=true · The Fresher: at `kitchen_counter`

### Mid-scene 2 — `cut_m003_mid_2`

**Type:** `full` · **Max duration:** 22s · **Skippable:** yes · **Play once:** yes  
**First frame:** `PLAYER` → `corridor_far_end`  
**Cast:** `PLAYER` → The Fresher (`player`) · `IDRIS` → Idris (`npc.idris`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `blackout`.<br>**CUT** — POV, `PLAYER` → `corridor_far_end` (9.0s). | **MUSIC** — `dark_quiet`. |
| 0:02 | **VFX** — `shade_drift` at `corridor_far_end`. | — |
| 0:09 | **CUT** — CLOSE, `door_floor` → `idris_door_light` (4.0s). | — |
| 0:13 | **CUT** — MEDIUM, `corridor_mid` → The Fresher (5.0s). | — |
| 0:14 | The Fresher gestures. | — |
| 0:15 | — | **SFX** — `knock_three`. |
| 0:19 | **RETURN TO PLAYER** — blend 0.8s. | — |

**End state:** Flags: `saw_shade`=true · The Fresher: at `idris_door`

### Closing — `cut_m003_close`

**Type:** `full` · **Max duration:** 36s · **Skippable:** yes · **Play once:** yes  
**First frame:** `kitchen_high` → `candle_circle`  
**Cast:** `PLAYER` → The Fresher (`player`) · `ROOMIE` → The Roommate (`npc.roomie`) · `IDRIS` → Idris (`npc.idris`) · `PORTER` → Baba Porter (`npc.baba_porter`) · `RADIO` → Radio (old transmitter) (`prop.radio`) · `CROWD` → The Freshers (`crowd.freshers`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `candle`.<br>**CUT** — WIDE, `kitchen_high` → `candle_circle` (7.0s). | — |
| 0:01 | The Freshers sits. | — |
| 0:03 | Idris eats. | — |
| 0:07 | **CUT** — CLOSE, `kitchen_shelf` → Radio (old transmitter) (14.0s). | — |
| 0:08 | — | **SFX** — `radio_static`. |
| 0:09 | — | **SFX** — `three_notes`. |
| 0:13 | — | **Radio (old transmitter):** “Seven. Six. Five. Four. Three. Two. One.” *(amused)*<br><code>m003_close_01</code> |
| 0:21 | The Roommate gestures. | — |
| 0:22 | — | **The Roommate:** “Old thing. It does that.” *(bored)*<br><code>m003_close_02</code> |
| 0:25 | **CUT** — MEDIUM, `kitchen_door` → Baba Porter (6.0s). | — |
| 0:26 | — | **Baba Porter:** “Twelve. Good. Nobody alone.” *(neutral)*<br><code>m003_close_03</code> |
| 0:31 | **CUT** — WIDE, `corridor_far_end` → `corridor_empty` (4.0s). | — |

**End state:** Flags: `m003_done`=true, `heard_broadcast_7`=true · The Fresher: at `kitchen_circle`; items `recipe_jollof` 1, `recipe_garri` 1

## M004 · Matric Fit

**When:** Y1 · S1 Wk 2 · Fri (matriculation, event day) · 08:00–14:00.  
**Where:** market (tailor), student (SUG), eng (theatre lawn).  
**Who:** Mubarak, Alhaji Needle, Lyzzy, Lily, Maryam, Aleeya.  
**Special helpers (conditional):** Madison.  
**Mystery:** plants MS-03 (a white shirt in the back row; in the print, an empty space), C-PHOTO.  
**Connects to:** M2 (Aleeya waves from the next row; your student ID is checked at the lawn).

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Collect your gown from the tailor` · `loc.market.tailor` · completeWhen: `talk(npc.needle)` · fail: none ("Thursday")
2. `Rent a gown from Mubarak` · `loc.student.sug_hall` · completeWhen: `minigame.pass(bargain)` (price ₦300–₦800 by result) · fail: none
3. `Fix the gown: pins, then a belt` · `loc.gate.flowers` → `loc.admin.bookshop` · completeWhen: `collect(item.safety_pins, 1)` and `collect(item.belt, 1)` then `use(item.gown)` · fail: none
4. `Reach the theatre lawn by 10:00` · `loc.eng.theatre_lawn` · completeWhen: `reach(loc.eng.theatre_lawn)` before `time(10:00)` · fail: `late → you take the oath from the back, same result, Lyzzy's caption is worse` → retry: none needed
5. `Take the oath` · `loc.eng.theatre_lawn` · completeWhen: `cutscene.end(cut_m004_mid_1)`
6. `Find yourself in Lyzzy's photo` · `loc.eng.theatre_lawn` · completeWhen: `talk(npc.lyzzy)` → `cutscene.end(cut_m004_close)`

### Opening — `cut_m004_open`

**Type:** `full` · **Max duration:** 30s · **Skippable:** yes · **Play once:** yes  
**First frame:** `tailor_doorway` → Alhaji Needle  
**Cast:** `PLAYER` → The Fresher (`player`) · `NEEDLE` → Alhaji Needle (`npc.needle`) · `MUBARAK` → Mubarak (`npc.mubarak`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CALENDAR CARD** — “Fri · Week 2 · Matriculation”.<br>**CUT** — MEDIUM, `tailor_doorway` → Alhaji Needle (9.0s). | — |
| 0:01 | — | **The Fresher:** “My gown?” *(neutral)*<br><code>m004_open_p01</code> |
| 0:03 | — | **Alhaji Needle:** “Thursday.” *(warm)*<br><code>m004_open_01</code> |
| 0:05 | — | **The Fresher:** “Today is Friday.” *(dry)*<br><code>m004_open_p02</code> |
| 0:07 | — | **Alhaji Needle:** “It is. May God bless it.” *(warm)*<br><code>m004_open_02</code> |
| 0:10 | **CUT** — WIDE, `sug_hall_door` → Mubarak (10.0s). | — |
| 0:10 | Mubarak gestures. | — |
| 0:11 | — | **Mubarak:** “My guy! Premium gown. For you, specially.” *(excited)*<br><code>m004_open_03</code> |
| 0:16 | Prop `prop.gown_huge` appears at The Fresher. | — |
| 0:17 | — | **Mubarak:** “See? Fine. Don't look down.” *(proud)*<br><code>m004_open_04</code> |
| 0:26 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m004_started`=true, `met_mubarak`=true · The Fresher: at `sug_hall_table`

### Mid-scene 1 — `cut_m004_mid_1`

**Type:** `event` · **Max duration:** 26s · **Skippable:** yes · **Play once:** yes  
**First frame:** `lawn_crane` → The Freshers  
**Cast:** `PLAYER` → The Fresher (`player`) · `LILY` → Lily (`npc.lily`) · `LYZZY` → Lyzzy (`npc.lyzzy`) · `CROWD` → The Freshers (`crowd.freshers`) · `MADISON?` → Madison (`special.madison`) — `CONDITIONAL`

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **MOVE** — WIDE, `lawn_crane` → The Freshers (6.0s). | — |
| 0:01 | — | **MUSIC** — `anthem_brass` (ducked under dialogue). |
| 0:06 | **CUT** — MEDIUM, `lawn_row_side` → The Fresher (12.0s). | — |
| 0:07 | — | **The Freshers:** “I solemnly promise…” *(neutral)*<br><code>m004_mid1_01</code> |
| 0:09 | — | **SFX** — `wind_gust`. |
| 0:10 | The Fresher freezes in shock. | — |
| 0:10 | **VFX** — `dust` at `lawn_row_side`. | — |
| 0:12 | — | **Lyzzy:** “Don't move! Your face is a moment!” *(excited)*<br><code>m004_mid1_02</code> |
| 0:18 | **CUT** — CLOSE, `lawn_edge` → Lily (5.0s). | — |
| 0:19 | — | **Lily:** “…I said it would be windy.” *(shy)*<br><code>m004_mid1_03</code> |
| 0:24 | **RETURN TO PLAYER** — blend 1.0s. | — |

**Conditional insert — `special.madison`**

> Plays only when the named real-person flag is on. If it is off, cut these rows; the surrounding scene, camera and timing continue without them. This insert is never part of the canon pass and never a romance beat.

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:15 | — | **Madison:** “Fly, fresher! Fly with dignity!” *(excited)*<br><code>m004_mid1_d01</code> |

**End state:** Flags: `matriculated`=true, `met_twins`=true · The Fresher: at `lawn_row`

### Closing — `cut_m004_close`

**Type:** `full` · **Max duration:** 30s · **Skippable:** yes · **Play once:** yes  
**First frame:** `PLAYER` → `prop.camera_screen`  
**Cast:** `PLAYER` → The Fresher (`player`) · `LYZZY` → Lyzzy (`npc.lyzzy`) · `MUBARAK` → Mubarak (`npc.mubarak`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — OVER_SHOULDER, `PLAYER` → `prop.camera_screen` (12.0s). | — |
| 0:01 | — | **Lyzzy:** “There's you. The kite.” *(amused)*<br><code>m004_close_01</code> |
| 0:06 | — | **The Fresher:** “Who's that? Back row.” *(neutral)*<br><code>m004_close_p01</code> |
| 0:08 | Prop `prop.photo_backrow_gap` appears at `prop.camera_screen`. | — |
| 0:09 | — | **Lyzzy:** “That's nobody. That's a gap.” *(bored)*<br><code>m004_close_02</code> |
| 0:13 | **CUT** — CLOSE, `lawn_edge` → The Fresher (4.0s). | — |
| 0:17 | **CUT** — MEDIUM, `lawn_path` → Mubarak (9.0s). | — |
| 0:18 | — | **Mubarak:** “Your change? Ah. Take my number instead.” *(proud)*<br><code>m004_close_03</code> |
| 0:22 | — | **Mubarak:** “Trust me. It will appreciate.” *(amused)*<br><code>m004_close_04</code> |
| 0:27 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m004_done`=true, `ms_03`=true, `photo_mode`=true · The Fresher: at `lawn_path`; items `matric_photo` 1

### Conditional special dialogue

> **Do not record or stage these in the canon pass.** They exist only when the named real-person flag is enabled, and must be cut cleanly when it is off. They are never romance content, never marketing, and never in a non-conditional cutscene.

**Madison** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m004_play_d01` | “Aiya! That's not a gown, that's a tent. I love it. Don't move.” | — |
| `m004_play_d02` | “Wait wait wait, film this. Okay: knot. Shoulder. Attitude.” | — |
| `m004_play_d03` | “It's not too big, it's oversized. Different word, different price.” | — |
| `m004_play_d04` | “Jiayou, fresher! Fly! Fly with dignity!” | — |

**Staging and `[ELSE]` from `Y1.md`:**

> - **[IF special.madison]** She is at the SUG table buying nothing and filming everything. In step 3 she replaces the belt: knots the spare cloth over one shoulder, declares it a look, and half the back row copies it before the oath (Trend Setter: +Charm for the day, and the "kite" photograph gets tips). Lines: `m004_play_d01` "Aiya! That's not a gown, that's a tent. I love it. Don't move." · `m004_play_d02` "Wait wait wait, film this. Okay: knot. Shoulder. Attitude." · `m004_play_d03` "It's not too big, it's oversized. Different word, different price." · `m004_play_d04` "Jiayou, fresher! Fly! Fly with dignity!"
> - **[ELSE]** Maryam's belt does the job, as written above.

# ACT II · THE FIRST SEMESTER

*Missions M005–M013.* The ordinary machinery of student life, made personal by the power problem. Ends with the first whole-campus blackout, the Count, and results day.

## M005 · First Lecture, Wrong Theatre

**When:** Y1 · S1 Wk 3 · Mon (lecture day) · 07:40–10:00.  
**Where:** eng: Theatre Yamma, Theatre Gabas, the electrical lab.  
**Who:** Dr. Okonkwo, Shamsu, Nusaiba, Abbas, Wednesday, a Law lecturer.  
**Mystery:** plants C-PAGE41 (cut out with a blade), C-SEVENTH (six circles on page forty, and a seventh pencilled then rubbed out), C-SNITCH groundwork (Shamsu "cannot" lie about the time he arrived).  
**Connects to:** M1 (the symbol in the tin is on page forty); M4 (you sit near people you matriculated beside).

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Get to your 08:00 lecture` · `loc.eng.theatre_yamma` · completeWhen: `reach(loc.eng.theatre_yamma)` · fail: none (it is the wrong one by design)
2. `Run to Theatre Gabas!` · `loc.eng.theatre_gabas` · completeWhen: `reach(loc.eng.theatre_gabas)` · fail: none
3. `Survive the lecture` · `loc.eng.theatre_gabas` · completeWhen: `minigame.pass(lecture)` (score sets Smarts gain) · fail: `score under 30% → Shamsu lends his notes; lower gain` → retry: not needed
4. `Fetch a fuse from the lab` · `loc.eng.elec_lab` · completeWhen: `talk(npc.abbas)` then `collect(item.fuse_13a, 1)` · fail: none
5. `Look at the logbook` · `loc.eng.elec_lab` · completeWhen: `cutscene.end(cut_m005_close)`
6. `Bring the fuse to Dr. Okonkwo` · `loc.eng.theatre_gabas` · completeWhen: `deliver(item.fuse_13a, npc.okonkwo)`

### Opening — `cut_m005_open`

**Type:** `entry` · **Max duration:** 30s · **Skippable:** yes · **Play once:** yes  
**First frame:** `theatre_lawn_high` → `twin_theatres`  
**Cast:** `PLAYER` → The Fresher (`player`) · `LAWLEC` → Law Lecturer (`npc.law_lecturer`) · `CROWD` → The Students (`crowd.students`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **MOVE** — WIDE, `theatre_lawn_high` → `twin_theatres` (5.0s). | — |
| 0:01 | **CALENDAR CARD** — “Mon · Week 3 · Lecture day”. | — |
| 0:05 | **CUT** — MEDIUM, `yamma_aisle` → The Fresher (5.0s). | — |
| 0:06 | The Fresher sits. | — |
| 0:10 | **CUT** — MEDIUM, `yamma_stage` → Law Lecturer (12.0s). | — |
| 0:11 | — | **Law Lecturer:** “You. The gentleman in the unfortunate shirt.” *(dry)*<br><code>m005_open_01</code> |
| 0:15 | — | **Law Lecturer:** “Define a tort.” *(stern)*<br><code>m005_open_02</code> |
| 0:18 | — | **The Fresher:** “…A kind of cake?” *(shy)*<br><code>m005_open_p01</code> |
| 0:21 | The Students laughs. | — |
| 0:23 | The Fresher freezes in shock. | — |
| 0:24 | — | **The Fresher:** “Wrong theatre.” *(whisper)*<br><code>m005_open_p02</code> |
| 0:27 | **RETURN TO PLAYER** — blend 0.6s. | — |

**End state:** Flags: `m005_started`=true, `wrong_theatre`=true · The Fresher: at `yamma_aisle_door`

### Mid-scene 1 — `cut_m005_mid_1`

**Type:** `full` · **Max duration:** 34s · **Skippable:** yes · **Play once:** yes  
**First frame:** `gabas_stage` → Dr. Okonkwo  
**Cast:** `PLAYER` → The Fresher (`player`) · `OKONKWO` → Dr. Okonkwo (`npc.okonkwo`) · `SHAMSU` → Shamsu (`npc.shamsu`) · `NUSAIBA` → Nusaiba (`npc.nusaiba`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — MEDIUM, `gabas_stage` → Dr. Okonkwo (5.0s). | — |
| 0:01 | Dr. Okonkwo looks at The Fresher. | — |
| 0:05 | **CUT** — CLOSE, `gabas_row_six` → Shamsu (10.0s). | — |
| 0:06 | The Fresher sits. | — |
| 0:06 | — | **Shamsu:** “Simple. A capacitor is a bucket.” *(whisper)*<br><code>m005_mid1_01</code> |
| 0:10 | — | **Shamsu:** “A resistor is your uncle. Current is the salary.” *(whisper)*<br><code>m005_mid1_02</code> |
| 0:14 | — | **The Fresher:** “…No.” *(dry)*<br><code>m005_mid1_p01</code> |
| 0:15 | — | **Shamsu:** “Good. Confusion is the first step.” *(warm)*<br><code>m005_mid1_03</code> |
| 0:19 | **CUT** — MEDIUM, `gabas_row_three` → Nusaiba (12.0s). | — |
| 0:19 | — | **Nusaiba:** “With respect, ma. That sign should be negative.” *(neutral)*<br><code>m005_mid1_04</code> |
| 0:23 | — | **Nusaiba:** “I have three reasons.” *(proud)*<br><code>m005_mid1_05</code> |
| 0:26 | — | **Dr. Okonkwo:** “Sit in front, Nusaiba. I need the supervision.” *(dry)*<br><code>m005_mid1_06</code> |
| 0:31 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `met_shamsu`=true, `met_nusaiba`=true · The Fresher: at `gabas_row_six_seat`

### Closing — `cut_m005_close`

**Type:** `full` · **Max duration:** 32s · **Skippable:** yes · **Play once:** yes  
**First frame:** `lab_bench_end` → Wednesday  
**Cast:** `PLAYER` → The Fresher (`player`) · `OKONKWO` → Dr. Okonkwo (`npc.okonkwo`) · `ABBAS` → Abbas (`npc.abbas`) · `WEDNESDAY` → Wednesday (`npc.wednesday`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — MEDIUM, `lab_bench_end` → Wednesday (4.0s). | — |
| 0:01 | — | **Wednesday:** “See you Wednesday.” *(neutral)*<br><code>m005_close_01</code> |
| 0:04 | **CUT** — TOP, `lab_bench_over` → `prop.logbook` (12.0s). | — |
| 0:05 | — | **MUSIC** — `mystery_thread`. |
| 0:05 | Prop `prop.logbook_p40` appears at `lab_bench`. | — |
| 0:10 | The Fresher gestures. | — |
| 0:11 | Prop `prop.logbook_stub_p41` appears at `lab_bench`. | — |
| 0:16 | **CUT** — CLOSE, `lab_bench_low` → Dr. Okonkwo (12.0s). | — |
| 0:17 | — | **SFX** — `book_shut`. |
| 0:18 | — | **Dr. Okonkwo:** “Page forty is not on the syllabus.” *(stern)*<br><code>m005_close_02</code> |
| 0:23 | — | **Dr. Okonkwo:** “Neither is asking.” *(dry)*<br><code>m005_close_03</code> |
| 0:28 | — | **MUSIC OUT** — `mystery_thread`. |
| 0:29 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m005_done`=true, `logbook_p40`=true, `page41_missing`=true, `met_abbas`=true, `met_wednesday`=true · The Fresher: at `lab_bench`; items `fuse_13a` 1

### Conditional special dialogue

> **Do not record or stage these in the canon pass.** They exist only when the named real-person flag is enabled, and must be cut cleanly when it is off. They are never romance content, never marketing, and never in a non-conditional cutscene.

**Jiya** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m005_play_j01` | “A cake. Right. He's not wrong about some of the case law.” | — |

**Staging.** `Y1.md` carries this as an inline aside in the mission story rather than a block. Use the mission text for blocking and keep the line optional.

## M006 · Mai Shayi Knows

**When:** Y1 · S1 Wk 3 · Thu · 19:00–22:00.  
**Where:** student: Mai Shayi's bench; envd: Sculpture Garden; eng: garden.  
**Who:** Mai Shayi Audu, {{ROOMIE}}, Tanko, the Maker.  
**Mystery:** plants C-BENCH (he sits beside it), C-STATUE (she has turned), C-TANKO (a riddle with no answer yet), C-NOTE ("I do not write notes"), C-CATS (a ring of cats, facing out).  
**Connects to:** M1 (the note; the hum behind the fence); M3 (the radio); M5 (page forty).

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Take the note to Mai Shayi` · `loc.student.mai_shayi` · completeWhen: `talk(npc.mai_shayi)` · fail: none
2. `Drink tea and listen` · `loc.student.mai_shayi` · completeWhen: `cutscene.end(cut_m006_open)` (three legends added) · fail: none
3. `Walk through the Sculpture Garden` · `loc.envd.sculpture_garden` · completeWhen: `reach(loc.envd.sculpture_garden_pond)` · fail: none
4. `Greet the Maker` · `loc.eng.garden` · completeWhen: `talk(npc.maker)` · fail: `touch the fence → a mild static shock, he says "I did mention."` → retry: at once
5. `Hear Tanko's riddle` · `loc.eng.garden_gate` · completeWhen: `talk(npc.tanko)` · fail: none
6. `Go home through the garden` · `loc.envd.sculpture_garden_pond` · completeWhen: `cutscene.end(cut_m006_close)`

### Opening — `cut_m006_open`

**Type:** `full` · **Max duration:** 40s · **Skippable:** yes · **Play once:** yes  
**First frame:** `neem_tree_branch` → Mai Shayi  
**Cast:** `PLAYER` → The Fresher (`player`) · `ROOMIE` → The Roommate (`npc.roomie`) · `SHAYI` → Mai Shayi (`npc.mai_shayi`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `night`.<br>**CUT** — WIDE, `neem_tree_branch` → Mai Shayi (6.0s). | — |
| 0:01 | — | **SFX** — `kettle_boil`. |
| 0:02 | — | **Mai Shayi:** “Sit. Tea first, gist second.” *(warm)*<br><code>m006_open_01</code> |
| 0:06 | **CUT** — MEDIUM, `bench_end` → The Roommate (8.0s). | — |
| 0:07 | — | **The Roommate:** “I'll pay with a riddle. What has keys but no door?” *(excited)*<br><code>m006_open_02</code> |
| 0:11 | — | **Mai Shayi:** “A piano. Double price.” *(dry)*<br><code>m006_open_03</code> |
| 0:14 | **CUT** — CLOSE, `bench_fire` → Mai Shayi (20.0s). | — |
| 0:15 | Mai Shayi looks at `prop.note`. | — |
| 0:18 | — | **Mai Shayi:** “A corridor that cries. A lecturer who never ages.” *(whisper)*<br><code>m006_open_04</code> |
| 0:23 | — | **Mai Shayi:** “An okada at 3 a.m. with nobody you can describe.” *(whisper)*<br><code>m006_open_05</code> |
| 0:28 | — | **The Fresher:** “And the Maker?” *(neutral)*<br><code>m006_open_p01</code> |
| 0:31 | — | **Mai Shayi:** “Go and greet him. If he's sitting, look at WHERE.” *(neutral)*<br><code>m006_open_06</code> |
| 0:36 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m006_started`=true, `legends_3`=true · The Fresher: at `mai_shayi_bench`

### Mid-scene 1 — `cut_m006_mid_1`

**Type:** `full` · **Max duration:** 40s · **Skippable:** yes · **Play once:** yes  
**First frame:** `garden_fence_east` → `coil_plinth`  
**Cast:** `PLAYER` → The Fresher (`player`) · `MAKER` → The Maker (`npc.maker`) · `CATS` → The Cats (`prop.cats_ring`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `coil_glow`.<br>**MOVE** — WIDE, `garden_fence_east` → `coil_plinth` (7.0s). | **SFX** — `coil_hum_low`. |
| 0:03 | Prop `prop.cats_ring` appears at `coil_plinth`. | — |
| 0:07 | **CUT** — MEDIUM, `garden_fence_gate` → The Maker (8.0s). | — |
| 0:08 | The Maker sits. | — |
| 0:10 | — | **The Fresher:** “Did you write this?” *(neutral)*<br><code>m006_mid1_p01</code> |
| 0:13 | **CUT** — CLOSE, `garden_bench_low` → The Maker (22.0s). | — |
| 0:14 | — | **The Maker:** “I do not write notes. I do not watch.” *(dry)*<br><code>m006_mid1_01</code> |
| 0:20 | — | **The Maker:** “I listen. It is a different job.” *(neutral)*<br><code>m006_mid1_02</code> |
| 0:24 | The Maker looks at `prop.note`. | — |
| 0:27 | — | **The Maker:** “Whoever sent that wanted you here. So. You came.” *(neutral)*<br><code>m006_mid1_03</code> |
| 0:33 | — | **The Maker:** “Go and sleep. It will be a long five years.” *(dry)*<br><code>m006_mid1_04</code> |
| 0:37 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `met_maker`=true, `maker_beside_bench`=true · The Fresher: at `garden_fence_gate`

### Closing — `cut_m006_close`

**Type:** `full` · **Max duration:** 30s · **Skippable:** yes · **Play once:** yes  
**First frame:** `garden_gate_post` → Tanko  
**Cast:** `PLAYER` → The Fresher (`player`) · `ROOMIE` → The Roommate (`npc.roomie`) · `TANKO` → Tanko (`npc.tanko`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — MEDIUM, `garden_gate_post` → Tanko (10.0s). | — |
| 0:01 | — | **Tanko:** “Riddle. What has six legs and cannot stand?” *(neutral)*<br><code>m006_close_01</code> |
| 0:05 | — | **The Roommate:** “Two goats. Tired.” *(excited)*<br><code>m006_close_02</code> |
| 0:08 | — | **Tanko:** “Which?” *(dry)*<br><code>m006_close_03</code> |
| 0:10 | **LIGHT** — `night`.<br>**MOVE** — WIDE, `pond_far_bank` → `prop.statue_fish_girl` (8.0s). | **MUSIC** — `mystery_thread`. |
| 0:12 | Prop `prop.statue_fish_girl_turned` appears at `pond_edge`. | — |
| 0:18 | **CUT** — POV, `prop.statue_fish_girl` → `hospital_lights_far` (5.0s). | — |
| 0:23 | — | **The Roommate:** “What are you looking at?” *(neutral)*<br><code>m006_close_04</code> |
| 0:26 | — | **The Fresher:** “Nothing. …I think.” *(whisper)*<br><code>m006_close_p01</code> |
| 0:28 | — | **MUSIC OUT** — `mystery_thread`. |

**End state:** Flags: `m006_done`=true, `met_tanko`=true, `statue_turned_seen`=true, `riddle_six_legs`=true · The Fresher: at `pond_path`

### Conditional special dialogue

> **Do not record or stage these in the canon pass.** They exist only when the named real-person flag is enabled, and must be cut cleanly when it is off. They are never romance content, never marketing, and never in a non-conditional cutscene.

**Taty** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m006_play_t01` | “Pixel. Pixel! We live together. You can't just join a cult.” | — |
| `m006_play_t02` | “They do this every evening. Nobody knows why. Pixel won't say.” | — |

**Staging and `[ELSE]` from `Y1.md`:**

> - **[IF special.taty]** No step. Her cat, Pixel, is the twelfth in the ring, and she is at the fence in running kit, arguing with it. Lines: `m006_play_t01` "Pixel. Pixel! We live together. You can't just join a cult." · `m006_play_t02` "They do this every evening. Nobody knows why. Pixel won't say."
> - **[ELSE]** Eleven cats; nobody remarks on them.

## M007 · Fresher Tax

**When:** Y1 · S1 Wk 4 · Sat (weekend) · 16:00.  
**Where:** sports: the basketball court.  
**Who:** Bolaji "Big Sly", Big Baby, Hassan, Abbas, {{ROOMIE}}.  
**Special helpers (conditional):** Jiya.  
**Mystery:** plants C-SYMBOL (chalked small on the court's centre circle, under years of paint); nothing paid.  
**Connects to:** M2 (what is left of your money from home); M5 (Abbas, "John Carter", is on the touchline).

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Cross the court to the market` · `loc.sports.court` · completeWhen: `reach(loc.sports.court_centre)` · fail: none
2. `Deal with Big Sly: pay, bargain or refuse` · `loc.sports.court_centre` · completeWhen: `choice(m007_tax)` · fail: none
3. *(bargain)* `Talk the toll down` · completeWhen: `minigame.pass(bargain)` · fail: `price stays ₦200` → retry: once
4. *(refuse)* `Stand your ground for three rounds` · completeWhen: `minigame.pass(scuffle, survive 3)` · fail: `knocked down → get up, round repeats` → retry: at once
5. `Get up` · completeWhen: `cutscene.end(cut_m007_close)`
6. `Look at the centre circle` · `loc.sports.court_centre` · completeWhen: `photo(symbol_court)` (optional; journal entry)

### Opening — `cut_m007_open`

**Type:** `full` · **Max duration:** 30s · **Skippable:** yes · **Play once:** yes  
**First frame:** `court_hoop_high` → The Fresher  
**Cast:** `PLAYER` → The Fresher (`player`) · `ROOMIE` → The Roommate (`npc.roomie`) · `SLY` → Bolaji (as Sly) (`npc.bolaji`) · `HASSAN` → Hassan (`npc.hassan`) · `JIYA?` → Jiya (`special.jiya`) — `CONDITIONAL`

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — WIDE, `court_hoop_high` → The Fresher (5.0s). | — |
| 0:01 | The Fresher walks to `court_centre`. | — |
| 0:04 | **VFX** — `big_shadow` at `court_centre`. | — |
| 0:05 | **CUT** — CLOSE, `court_floor_low` → Bolaji (as Sly) (12.0s). | — |
| 0:06 | — | **Bolaji (as Sly):** “Sly has noticed a fresher.” *(proud)*<br><code>m007_open_01</code> |
| 0:10 | — | **Bolaji (as Sly):** “Has the fresher noticed the toll?” *(stern)*<br><code>m007_open_02</code> |
| 0:13 | Bolaji (as Sly) gestures. | — |
| 0:14 | — | **SFX** — `knuckle_crack`. |
| 0:15 | — | **Bolaji (as Sly):** “…Sorry.” *(whisper)*<br><code>m007_open_03</code> |
| 0:17 | **CUT** — MEDIUM, `court_side` → Hassan (6.0s). | — |
| 0:18 | — | **Hassan:** “Two hundred. Receipt provided.” *(bored)*<br><code>m007_open_04</code> |
| 0:28 | **RETURN TO PLAYER** — blend 1.0s. | — |

**Conditional insert — `special.jiya`**

> Plays only when the named real-person flag is on. If it is off, cut these rows; the surrounding scene, camera and timing continue without them. This insert is never part of the canon pass and never a romance beat.

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:23 | **CUT** — MEDIUM, `court_bench` → Jiya (4.0s). | — |
| 0:24 | — | **Jiya:** “Oh, this'll be good.” *(amused)*<br><code>m007_open_j01</code> |

**End state:** Flags: `m007_started`=true, `met_sly`=true · The Fresher: at `court_centre`

### Closing — `cut_m007_close`

**Type:** `full` · **Max duration:** 34s · **Skippable:** yes · **Play once:** yes  
**First frame:** `court_touchline` → Abbas  
**Cast:** `PLAYER` → The Fresher (`player`) · `ROOMIE` → The Roommate (`npc.roomie`) · `SLY` → Bolaji (as Sly) (`npc.bolaji`) · `BABY` → Big Baby (`npc.big_baby`) · `ABBAS` → Abbas (`npc.abbas`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — MEDIUM, `court_touchline` → Abbas (4.0s). | — |
| 0:01 | — | **Abbas:** “He has pushed. He has also pushed.” *(bored)*<br><code>m007_close_01</code> |
| 0:04 | **CUT** — WIDE, `court_gate` → Big Baby (5.0s). | — |
| 0:05 | Big Baby is revealed. | — |
| 0:06 | — | **Big Baby:** “Bolaji.” *(stern)*<br><code>m007_close_02</code> |
| 0:08 | Bolaji (as Sly) freezes in shock. | — |
| 0:10 | — | **Big Baby:** “Outside.” *(stern)*<br><code>m007_close_03</code> |
| 0:12 | Bolaji (as Sly) walks to `court_gate`. | — |
| 0:16 | **CUT** — MEDIUM, `court_gate_inside` → Bolaji (as Sly) (8.0s). | — |
| 0:17 | — | **Bolaji (as Sly):** “Sly will remember your face.” *(proud)*<br><code>m007_close_04</code> |
| 0:21 | — | **Bolaji (as Sly):** “In a good way. Maybe.” *(shy)*<br><code>m007_close_05</code> |
| 0:24 | **CUT** — MEDIUM, `court_side` → The Roommate (8.0s). | — |
| 0:25 | The Fresher stands. | — |
| 0:26 | — | **The Roommate:** “What's two metres tall and fears a hairdresser?” *(amused)*<br><code>m007_close_06</code> |
| 0:31 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m007_done`=true, `met_big_baby`=true · The Fresher: at `court_centre`

### Conditional special dialogue

> **Do not record or stage these in the canon pass.** They exist only when the named real-person flag is enabled, and must be cut cleanly when it is off. They are never romance content, never marketing, and never in a non-conditional cutscene.

**Jiya** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m007_play_j01` | “Sorry, quick question. Is this a levy, a toll or a donation?” | — |
| `m007_play_j02` | “Because a levy needs a by-law, a toll needs a road, and a donation needs consent.” | — |
| `m007_play_j03` | “So what we have here is a large man standing near money. Which is not a legal category.” | — |
| `m007_play_j04` | “Lovely receipts, though. Who drew the ball?” | — |
| `m007_play_j05` | “He was pushed, officer. Gravity isn't an offence. I've checked.” | to the guard |

**Staging and `[ELSE]` from `Y1.md`:**

> - **[IF special.jiya]** She is on the bench with a book, watching. If you choose **bargain**, she does it for you, standing, in a tone of deep professional interest, and the toll is ₦0 (her "Objection!" is shown working). If you **refuse**, a security guard arrives to fine *you* for fighting and she sends him away (Legal Immunity). Lines: `m007_play_j01` "Sorry, quick question. Is this a levy, a toll or a donation?" · `m007_play_j02` "Because a levy needs a by-law, a toll needs a road, and a donation needs consent." · `m007_play_j03` "So what we have here is a large man standing near money. Which is not a legal category." · `m007_play_j04` "Lovely receipts, though. Who drew the ball?" · `m007_play_j05` (to the guard) "He was pushed, officer. Gravity isn't an offence. I've checked."
> - **[ELSE]** Bargaining is yours alone (Charm decides); if you refuse, the guard arrives, and Big Baby sends him away with a look.

## M008 · Left Boot First

**When:** Y1 · S1 Wk 5 · Tue (lecture day) · 17:00, football hour.  
**Where:** sports: training pitch, touchline.  
**Who:** Jega, Coach Danladi, Helen, Shamsu, {{ROOMIE}}.  
**Special helpers (conditional):** Taty.  
**Mystery:** pays C-GOAT (who opened the gate); plants C-IDK ("Ban sani ba").  
**Connects to:** M1 (the goat is why Jega picks you; Shamsu confesses to the gate); M5 (Shamsu, your seat-mate).

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Report to the training pitch at 17:00` · `loc.sports.pitch` · completeWhen: `reach(loc.sports.pitch)` at `time(17:00)` · fail: `late → Coach makes you run a lap first` → retry: none
2. `Warm up: jog the pitch` · `loc.sports.pitch` · completeWhen: `minigame.pass(run_lap)` · fail: none
3. `Passing drill with Jega` · completeWhen: `minigame.pass(football.pass, 5)` · fail: retry at once
4. `Shooting drill` · completeWhen: `minigame.pass(football.shoot, 2 of 5)` · fail: retry at once
5. `Play the scrimmage` · completeWhen: `timer(180)` then `cutscene.end(cut_m008_mid_1)` · fail: none (the score is recorded, not required)
6. `Take the corner` · completeWhen: `minigame.pass(football.pass, corner)` · fail: retry once, then Jega scores anyway from open play
7. `Talk to Jega` · `loc.sports.touchline` · completeWhen: `cutscene.end(cut_m008_close)`

### Opening — `cut_m008_open`

**Type:** `full` · **Max duration:** 34s · **Skippable:** yes · **Play once:** yes  
**First frame:** `pitch_floodlight` → `pitch_centre`  
**Cast:** `PLAYER` → The Fresher (`player`) · `JEGA` → Jega (`npc.jega`) · `COACH` → Coach Danladi (`npc.danladi`) · `TATY?` → Taty (`special.taty`) — `CONDITIONAL`

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CALENDAR CARD** — “Tue · Week 5 · 17:00 · Football hour”.<br>**MOVE** — WIDE, `pitch_floodlight` → `pitch_centre` (5.0s). | — |
| 0:05 | **CUT** — CLOSE, `pitch_grass_low` → Jega (8.0s). | — |
| 0:06 | Jega kneels. | — |
| 0:07 | — | **Jega:** “Takalmin hagu tukuna. (Left boot first.)” *(neutral)*<br><code>m008_open_01</code> |
| 0:11 | — | **Jega:** “Always. Don't argue with success.” *(proud)*<br><code>m008_open_02</code> |
| 0:13 | **CUT** — MEDIUM, `pitch_touchline` → Coach Danladi (5.0s). | — |
| 0:14 | — | **Coach Danladi:** “Pass! Is the ball your inheritance?” *(stern)*<br><code>m008_open_03</code> |
| 0:23 | **CUT** — OVER_SHOULDER, `JEGA` → The Fresher (8.0s). | — |
| 0:23 | Jega points. | — |
| 0:24 | — | **Jega:** “Kai! You chased the goat. Wallahi, you're on my side.” *(excited)*<br><code>m008_open_04</code> |
| 0:29 | — | **Jega:** “Mu je! (Let's go!)” *(excited)*<br><code>m008_open_05</code> |
| 0:31 | **RETURN TO PLAYER** — blend 1.0s. | — |

**Conditional insert — `special.taty`**

> Plays only when the named real-person flag is on. If it is off, cut these rows; the surrounding scene, camera and timing continue without them. This insert is never part of the canon pass and never a romance beat.

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:18 | **CUT** — MEDIUM, `pitch_corner` → Taty (4.0s). | — |
| 0:19 | — | **Taty:** “Coach, give me the whistle. I'll break them gently.” *(amused)*<br><code>m008_open_t01</code> |

**End state:** Flags: `m008_started`=true, `met_jega`=true · The Fresher: at `pitch_centre`

### Mid-scene 1 — `cut_m008_mid_1`

**Type:** `full` · **Max duration:** 38s · **Skippable:** yes · **Play once:** yes  
**First frame:** `goalmouth_side` → Shamsu  
**Cast:** `PLAYER` → The Fresher (`player`) · `SHAMSU` → Shamsu (`npc.shamsu`) · `ROOMIE` → The Roommate (`npc.roomie`) · `JEGA` → Jega (`npc.jega`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — MEDIUM, `goalmouth_side` → Shamsu (6.0s). | — |
| 0:01 | Shamsu freezes in shock. | — |
| 0:02 | — | **SFX** — `ball_miss_whoosh`. |
| 0:03 | — | **Shamsu:** “Simple. The spin, the wet grass, the angle…” *(neutral)*<br><code>m008_mid1_01</code> |
| 0:07 | — | **The Roommate:** “Sheikh Biru! Lecture us on football!” *(amused)*<br><code>m008_mid1_02</code> |
| 0:11 | **CUT** — CLOSE, `water_cooler` → Shamsu (22.0s). | — |
| 0:11 | — | **The Fresher:** “Why 'Sheikh'?” *(neutral)*<br><code>m008_mid1_p01</code> |
| 0:13 | — | **Shamsu:** “A goat was eating a sachet. I said something.” *(shy)*<br><code>m008_mid1_03</code> |
| 0:18 | — | **Shamsu:** “I was not preaching. I was ADVISING the goat.” *(proud)*<br><code>m008_mid1_04</code> |
| 0:23 | — | **Shamsu:** “Possibly I did not close the gate.” *(whisper)*<br><code>m008_mid1_05</code> |
| 0:27 | Shamsu looks at The Fresher. | — |
| 0:28 | — | **Shamsu:** “…Oh. That was you. Sorry. Also, thank you.” *(shy)*<br><code>m008_mid1_06</code> |
| 0:32 | — | **Jega:** “Haba, Professor! Ball first, sermon later!” *(amused)*<br><code>m008_mid1_07</code> |
| 0:36 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `goat_gate_shamsu`=true · The Fresher: at `water_cooler`

### Closing — `cut_m008_close`

**Type:** `full` · **Max duration:** 30s · **Skippable:** yes · **Play once:** yes  
**First frame:** `pitch_touchline_far` → Helen  
**Cast:** `PLAYER` → The Fresher (`player`) · `JEGA` → Jega (`npc.jega`) · `HELEN` → Helen (`npc.helen`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `dusk`.<br>**CUT** — WIDE, `pitch_touchline_far` → Helen (5.0s). | — |
| 0:01 | Helen writes. | — |
| 0:05 | **CUT** — MEDIUM, `pitch_touchline` → Jega (12.0s). | — |
| 0:06 | — | **The Fresher:** “What's her name?” *(neutral)*<br><code>m008_close_p01</code> |
| 0:08 | Jega kneels. | — |
| 0:10 | — | **Jega:** “…Ban sani ba. (I don't know.)” *(shy)*<br><code>m008_close_01</code> |
| 0:13 | **CUT** — CLOSE, `pitch_touchline_far` → Helen (4.0s). | — |
| 0:14 | Helen looks at The Fresher. | — |
| 0:17 | **CUT** — MEDIUM, `pitch_centre` → Jega (10.0s). | — |
| 0:18 | Prop `prop.bib` appears at The Fresher. | — |
| 0:19 | — | **Jega:** “Kai, {{PLAYER\_NAME}}. We have a cup to win.” *(warm)*<br><code>m008_close_02</code> |
| 0:24 | Jega laughs. | — |
| 0:27 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m008_done`=true, `heard_idk`=true, `football_unlocked`=true · The Fresher: at `pitch_touchline`; items `bib` 1

### Conditional special dialogue

> **Do not record or stage these in the canon pass.** They exist only when the named real-person flag is enabled, and must be cut cleanly when it is off. They are never romance content, never marketing, and never in a non-conditional cutscene.

**Taty** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m008_play_t01` | “Bora! One lap. Easy lap. Baby lap.” | — |
| `m008_play_t02` | “I lied. Two.” | — |
| `m008_play_t03` | “You're not dying. I've seen dying. This is Tuesday.” | — |
| `m008_play_t04` | “You tie that boot one more time, I'm taking it home.” | to Jega |
| `m008_play_t05` | “Good! Now do it tired. Tired is where it counts.” | — |

**Staging and `[ELSE]` from `Y1.md`:**

> - **[IF special.taty]** She runs the warm-up (step 2) for the coach, backwards, chatting, lapping the squad twice; keeping within ten metres of her gives a stamina bonus for the rest of the mission (Never Tired rubs off). Lines: `m008_play_t01` "Bora! One lap. Easy lap. Baby lap." · `m008_play_t02` "I lied. Two." · `m008_play_t03` "You're not dying. I've seen dying. This is Tuesday." · `m008_play_t04` (to Jega) "You tie that boot one more time, I'm taking it home." · `m008_play_t05` "Good! Now do it tired. Tired is where it counts."
> - **[ELSE]** Coach Danladi runs the warm-up with a whistle; no bonus; the lap is half as long.

## M009 · Doctor's Orders

**When:** Y1 · S1 Wk 5 · Wed · 20:00–23:30 (night).  
**Where:** sports → med: A&E.  
**Who:** Jega, Dr. Zainab, Nurse Hauwa, a keke driver.  
**Mystery:** plants C-BENCH and C-AWAY (an old man in a lab coat in the hospital garden, at night, far from his own garden).  
**Connects to:** M8 (the heading habit; the goalpost); M3 (a blackout, this time somewhere it matters); M6 (the lab coat; the statue was looking this way).

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Help Jega to the keke` · `loc.sports.pitch` → `loc.sports.gate` · completeWhen: `escort(npc.jega, loc.sports.gate)` · fail: none
2. `Ride to the teaching hospital` · `loc.med.ae` · completeWhen: `ride.arrive(keke, loc.med.ae)` (passenger) · fail: none
3. `Report to the nurse` · `loc.med.ae_bay` · completeWhen: `talk(npc.hauwa)` · fail: none
4. `Hold the torch steady` · `loc.med.ae_bay` · completeWhen: `minigame.pass(steady_hand, 4 stitches)` · fail: `shake → "Again. Breathe first." the stitch repeats` → retry: at once
5. `Take the prescription` · completeWhen: `talk(npc.zainab)` · fail: none
6. `Look out of the window` · completeWhen: `cutscene.end(cut_m009_close)`

### Opening — `cut_m009_open`

**Type:** `full` · **Max duration:** 26s · **Skippable:** yes · **Play once:** yes  
**First frame:** `pitch_floodlight` → `goalmouth`  
**Cast:** `PLAYER` → The Fresher (`player`) · `JEGA` → Jega (`npc.jega`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `night`.<br>**CUT** — WIDE, `pitch_floodlight` → `goalmouth` (5.0s). | — |
| 0:02 | Jega runs to `goalpost_near`. | — |
| 0:04 | — | **SFX** — `goalpost_clang`. |
| 0:04 | **CAMERA SHAKE** — amount 0.3, 0.5s. | — |
| 0:05 | **CUT** — MEDIUM, `goalmouth_low` → Jega (14.0s). | — |
| 0:06 | Jega sits. | — |
| 0:08 | — | **Jega:** “Kai. …Did we score?” *(neutral)*<br><code>m009_open_01</code> |
| 0:11 | — | **The Fresher:** “You're bleeding.” *(scared)*<br><code>m009_open_p01</code> |
| 0:13 | — | **Jega:** “Ba matsala. (No problem.) It's only the face.” *(amused)*<br><code>m009_open_02</code> |
| 0:18 | Jega laughs. | — |
| 0:22 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m009_started`=true · The Fresher: at `goalmouth`

### Mid-scene 1 — `cut_m009_mid_1`

**Type:** `entry` · **Max duration:** 40s · **Skippable:** yes · **Play once:** yes  
**First frame:** `ae_desk` → Nurse Hauwa  
**Cast:** `PLAYER` → The Fresher (`player`) · `JEGA` → Jega (`npc.jega`) · `ZAINAB` → Dr. Zainab (`npc.zainab`) · `HAUWA` → Nurse Hauwa (`npc.hauwa`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — MEDIUM, `ae_desk` → Nurse Hauwa (4.0s). | — |
| 0:01 | — | **Nurse Hauwa:** “Doctor is coming. Sit.” *(bored)*<br><code>m009_mid1_01</code> |
| 0:04 | **CUT** — MEDIUM, `ae_curtain` → Dr. Zainab (14.0s). | — |
| 0:05 | Dr. Zainab walks to `ae_bay_bed`. | — |
| 0:06 | — | **Dr. Zainab:** “Which one is the patient?” *(neutral)*<br><code>m009_mid1_02</code> |
| 0:09 | Jega waves. | — |
| 0:09 | The Fresher waves. | — |
| 0:11 | — | **Dr. Zainab:** “Both. Wonderful. Aigoo. (Oh dear.)” *(dry)*<br><code>m009_mid1_03</code> |
| 0:15 | — | **Dr. Zainab:** “You: bed. You: chair. No, the CHAIR.” *(sharp)*<br><code>m009_mid1_04</code> |
| 0:19 | — | **Dr. Zainab:** “The bed is for sick people. You are only foolish.” *(dry)*<br><code>m009_mid1_05</code> |
| 0:23 | — | **SFX** — `power_down_whine`. |
| 0:23 | **LIGHT** — `blackout`. | — |
| 0:25 | — | **Dr. Zainab:** “Pen torch. My top pocket. Hold it HERE.” *(stern)*<br><code>m009_mid1_06</code> |
| 0:30 | **LIGHT** — `torch`. | — |
| 0:30 | — | **Dr. Zainab:** “Shake, and I stitch your sleeve to his face.” *(sharp)*<br><code>m009_mid1_07</code> |
| 0:35 | — | **Jega:** “In goal: Yusuf. Left back: Sani. Striker: me…” *(scared)*<br><code>m009_mid1_08</code> |
| 0:39 | **RETURN TO PLAYER** — blend 0.6s. | — |

**End state:** Flags: `met_zainab`=true, `met_hauwa`=true · The Fresher: at `ae_bay_bedside`; items `pen_torch` 1

### Closing — `cut_m009_close`

**Type:** `full` · **Max duration:** 38s · **Skippable:** yes · **Play once:** yes  
**First frame:** `ae_bay_foot` → Dr. Zainab  
**Cast:** `PLAYER` → The Fresher (`player`) · `JEGA` → Jega (`npc.jega`) · `ZAINAB` → Dr. Zainab (`npc.zainab`) · `MAKER` → The Maker (`npc.maker`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `night`.<br>**CUT** — MEDIUM, `ae_bay_foot` → Dr. Zainab (14.0s). | — |
| 0:01 | Dr. Zainab sits. | — |
| 0:02 | — | **Dr. Zainab:** “Two tablets after food. Not 'vibes'.” *(stern)*<br><code>m009_close_01</code> |
| 0:06 | — | **Dr. Zainab:** “And drink water. Both of you. Did I stutter?” *(sharp)*<br><code>m009_close_02</code> |
| 0:10 | — | **The Fresher:** “Sorry, Doctor.” *(shy)*<br><code>m009_close_p01</code> |
| 0:11 | Dr. Zainab takes a phone call. | — |
| 0:12 | — | **Dr. Zainab:** “My number. Do NOT call for nonsense.” *(dry)*<br><code>m009_close_03</code> |
| 0:16 | **CUT** — POV, `PLAYER` → `med_garden_bench` (9.0s). | **MUSIC** — `mystery_thread`. |
| 0:17 | The Maker is revealed. | — |
| 0:17 | The Maker sits. | — |
| 0:20 | The Maker looks at `ward_window_first_floor`. | — |
| 0:25 | **CUT** — CLOSE, `ae_window` → Dr. Zainab (8.0s). | — |
| 0:26 | Dr. Zainab looks at `med_garden_bench`. | — |
| 0:33 | — | **MUSIC OUT** — `mystery_thread`. |
| 0:34 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m009_done`=true, `maker_at_hospital_seen`=true, `contact_zainab`=true · The Fresher: at `ae_bay_bedside`; items `paracetamol` 2

## M010 · The Plug

**When:** Y1 · S1 Wk 5 · Sat (weekend) · 11:00–14:00.  
**Where:** student: SUG basement; market.  
**Who:** Mubarak, Hajiya Ladi, KB, the SUG porter.  
**Special helpers (conditional):** Madison.  
**Mystery:** plants C-KB (his blackboard: torch batteries cheap today, "no reason"); nothing paid.  
**Connects to:** M4 (he still owes you ₦200, and pays in stock); M3 (KB and the candles).

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Meet Mubarak in the SUG basement` · `loc.student.sug_basement` · completeWhen: `talk(npc.mubarak)` · fail: none
2. `Run to the market in Turbo Sneakers` · `loc.market.main` · completeWhen: `use(item.turbo_sneakers)` then `reach(loc.market.ladi_stall)` · fail: none (the timer only shows the boost)
3. `Bargain for the stock` · `loc.market.ladi_stall` · completeWhen: `minigame.pass(bargain)` · fail: `price higher; Mubarak sighs` → retry: once
4. `Carry the crate back on Zobo Max` · `loc.student.sug_basement` · completeWhen: `use(item.zobo_max)` then `deliver(item.crate_stock, loc.student.sug_basement)` · fail: `drop → pick up, lose 10 s`
5. `Third run: use the Lucky Kola` · `loc.market.main` ↔ `loc.student.sug_basement` · completeWhen: `use(item.lucky_kola)` then `deliver(item.crate_stock_2, loc.student.sug_basement)` before `time(13:30)` · fail: `late → the porter is on the stairs; hide the crate behind the chairs` → retry: step 5 short version
6. `Buy batteries from KB` *(optional)* · `loc.market.kb_shop` · completeWhen: `collect(item.battery, 2)`
7. `Close the shop` · completeWhen: `cutscene.end(cut_m010_close)`

### Opening — `cut_m010_open`

**Type:** `full` · **Max duration:** 32s · **Skippable:** yes · **Play once:** yes  
**First frame:** `basement_stair` → `locker_row`  
**Cast:** `PLAYER` → The Fresher (`player`) · `MUBARAK` → Mubarak (`npc.mubarak`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — WIDE, `basement_stair` → `locker_row` (5.0s). | — |
| 0:01 | The Fresher walks to `locker_row`. | — |
| 0:05 | **CUT** — MEDIUM, `locker_side` → Mubarak (22.0s). | — |
| 0:06 | Mubarak gestures. | — |
| 0:07 | — | **SFX** — `locker_creak_grand`. |
| 0:08 | — | **MUSIC** — `plug_theme` (ducked under dialogue). |
| 0:09 | — | **Mubarak:** “Welcome to The Plug. I know a guy.” *(proud)*<br><code>m010_open_01</code> |
| 0:13 | — | **The Fresher:** “It's a locker.” *(dry)*<br><code>m010_open_p01</code> |
| 0:15 | — | **Mubarak:** “It's a FLAGSHIP locker.” *(proud)*<br><code>m010_open_02</code> |
| 0:18 | — | **Mubarak:** “I don't sell products. I sell advantages.” *(excited)*<br><code>m010_open_03</code> |
| 0:23 | Prop `prop.turbo_sneakers` appears at The Fresher. | — |
| 0:24 | — | **Mubarak:** “Wear these. Run. You'll understand.” *(warm)*<br><code>m010_open_04</code> |
| 0:28 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m010_started`=true, `plug_intro`=true · The Fresher: at `locker_row`; items `turbo_sneakers` 1, `zobo_max` 1, `lucky_kola` 1

### Mid-scene 1 — `cut_m010_mid_1`

**Type:** `full` · **Max duration:** 24s · **Skippable:** yes · **Play once:** yes  
**First frame:** `ladi_stall_front` → Hajiya Ladi  
**Cast:** `PLAYER` → The Fresher (`player`) · `MUBARAK` → Mubarak (`npc.mubarak`) · `LADI` → Hajiya Ladi (`npc.hajiya_ladi`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — MEDIUM, `ladi_stall_front` → Hajiya Ladi (20.0s). | — |
| 0:01 | Mubarak writes. | — |
| 0:03 | Hajiya Ladi looks at Mubarak. | — |
| 0:05 | — | **Hajiya Ladi:** “You have customers.” *(neutral)*<br><code>m010_mid1_01</code> |
| 0:08 | — | **Hajiya Ladi:** “You do not have a business.” *(stern)*<br><code>m010_mid1_02</code> |
| 0:12 | — | **Mubarak:** “Hajiya, I have a brand.” *(proud)*<br><code>m010_mid1_03</code> |
| 0:14 | — | **Hajiya Ladi:** “A business has a book. Bring it when you have one.” *(dry)*<br><code>m010_mid1_04</code> |
| 0:19 | Mubarak nods. | — |
| 0:21 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `met_hajiya_ladi`=true · The Fresher: at `ladi_stall`

### Closing — `cut_m010_close`

**Type:** `full` · **Max duration:** 36s · **Skippable:** yes · **Play once:** yes  
**First frame:** `locker_side` → Sophomore Customer  
**Cast:** `PLAYER` → The Fresher (`player`) · `MUBARAK` → Mubarak (`npc.mubarak`) · `CUSTOMER` → Sophomore Customer (`npc.sophomore`) · `PORTER` → SUG Porter (`npc.sug_porter`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — MEDIUM, `locker_side` → Sophomore Customer (12.0s). | — |
| 0:01 | — | **Sophomore Customer:** “They stopped working after ten minutes.” *(stern)*<br><code>m010_close_01</code> |
| 0:04 | — | **Mubarak:** “That is the product.” *(warm)*<br><code>m010_close_02</code> |
| 0:06 | — | **Sophomore Customer:** “I want a refund.” *(stern)*<br><code>m010_close_03</code> |
| 0:08 | Mubarak gestures. | — |
| 0:09 | — | **Mubarak:** “Refund? In this economy?” *(excited)*<br><code>m010_close_04</code> |
| 0:12 | — | **Mubarak:** “Let me give you something better. Advice.” *(warm)*<br><code>m010_close_05</code> |
| 0:17 | — | **SFX** — `keys_jingle_stairs`. |
| 0:17 | Mubarak freezes in shock. | — |
| 0:18 | — | **SFX** — `locker_slam`. |
| 0:19 | Prop `prop.plug_sign` is removed. | — |
| 0:21 | **CUT** — MEDIUM, `basement_stair` → SUG Porter (10.0s). | — |
| 0:23 | — | **Mubarak:** “Good afternoon, sir. Table-tennis balls?” *(neutral)*<br><code>m010_close_06</code> |
| 0:28 | — | **Mubarak:** “(Trust the Plug.)” *(whisper)*<br><code>m010_close_07</code> |
| 0:31 | — | **MUSIC OUT** — `plug_theme`. |
| 0:32 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m010_done`=true, `plug_store_unlocked`=true · The Fresher: at `basement_stair`; items `zobo_max` 1, `naira` +1000

### Conditional special dialogue

> **Do not record or stage these in the canon pass.** They exist only when the named real-person flag is enabled, and must be cut cleanly when it is off. They are never romance content, never marketing, and never in a non-conditional cutscene.

**Madison** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m010_play_d01` | “Aiya! Tai gui le! (Too expensive!) Hajiya, look at his belt. GUCCY. He's poor.” | — |
| `m010_play_d02` | “Okay okay okay, I take six, you give me price for ten. Deal? Deal.” | — |
| `m010_play_d03` | “Boss, I'm a student. Look at my shoes. …Don't look at my shoes, they're nice. Look at HIS shoes.” | — |
| `m010_play_d04` | “You don't bargain, you beg. I'll teach you. It's free. Today.” | to Mubarak |

**Staging and `[ELSE]` from `Y1.md`:**

> - **[IF special.madison]** She is at Hajiya Ladi's stall bargaining for fabric and takes over step 3 for the fun of it: the price drops a further 30% and Hajiya Ladi offers her a job (Trend Setter's bargaining). Lines: `m010_play_d01` "Aiya! Tai gui le! (Too expensive!) Hajiya, look at his belt. GUCCY. He's poor." · `m010_play_d02` "Okay okay okay, I take six, you give me price for ten. Deal? Deal." · `m010_play_d03` "Boss, I'm a student. Look at my shoes. …Don't look at my shoes, they're nice. Look at HIS shoes." · `m010_play_d04` (to Mubarak) "You don't bargain, you beg. I'll teach you. It's free. Today."
> - **[ELSE]** You bargain (Charm and Street sense), as written.

## M011 · Test Week, One Lamp

**When:** Y1 · S1 Wk 6–7 · Mon–Thu (test week) · evenings, and one 08:00 paper.  
**Where:** lib: Main Library; hostel; eng: Theatre Gabas.  
**Who:** Shamsu, Nusaiba, {{ROOMIE}}, Tunde, Mrs. Shehu, Muhammad.  
**Mystery:** plants MS-04 (the answer before the exam), C-ECHO seed (Tunde draws a figure behind you and does not remember), C-KB pays quietly (cheap batteries, then a blackout).  
**Connects to:** M5 (your lecture score sets how hard the test feels; Shamsu's seat); M2 (the stranger who knew your name); M10 (the batteries KB sold you cheap are why your torch works).

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Join Shamsu's tutorial` · `loc.hostel.common_room` · completeWhen: `minigame.pass(lecture, tutorial)` · fail: none (score sets a bonus)
2. `Follow the lamp to the library` · `loc.lib.main` · completeWhen: `follow(npc.shamsu, 15)` in blackout · fail: `lost in the dark → a shade drifts near; use your torch or rejoin the group` → retry: last waypoint
3. `Find three old exam papers` · `loc.lib.main` floors 1–4 · completeWhen: `collect(item.old_paper, 3)` via `minigame.pass(search)` · fail: `noise → Mrs. Shehu sends you down a floor`
4. `Explain it back to Nusaiba` · `loc.lib.main` · completeWhen: `choice(m011_explain)` correct · fail: `wrong → she explains it, properly, and you get the index anyway, with a look`
5. `Sit Test 1 and Test 2` · `loc.eng.theatre_gabas` · completeWhen: `minigame.pass(test)` ×2 · fail: `low score is recorded, not retried`
6. `Sit the hard paper` · `loc.eng.theatre_gabas` Thu 08:00 · completeWhen: `cutscene.end(cut_m011_mid_1)` then `minigame.pass(test, hard)` (order hint active)
7. `Go home` · `loc.hostel.room` · completeWhen: `cutscene.end(cut_m011_close)`

### Opening — `cut_m011_open`

**Type:** `full` · **Max duration:** 34s · **Skippable:** yes · **Play once:** yes  
**First frame:** `room_wall` → `prop.timetable_red_circles`  
**Cast:** `PLAYER` → The Fresher (`player`) · `SHAMSU` → Shamsu (`npc.shamsu`) · `ROOMIE` → The Roommate (`npc.roomie`) · `CROWD` → The Students (`crowd.students`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CALENDAR CARD** — “Mon · Week 6 · Test week”.<br>**CUT** — CLOSE, `room_wall` → `prop.timetable_red_circles` (4.0s). | — |
| 0:04 | **CUT** — MEDIUM, `common_room_door` → Shamsu (12.0s). | — |
| 0:05 | Shamsu writes. | — |
| 0:06 | — | **Shamsu:** “Simple.” *(warm)*<br><code>m011_open_01</code> |
| 0:07 | — | **The Roommate:** “It is never simple when he says that.” *(whisper)*<br><code>m011_open_02</code> |
| 0:11 | — | **Shamsu:** “In sha Allah, you will all pass.” *(warm)*<br><code>m011_open_03</code> |
| 0:16 | — | **SFX** — `power_down_whine`. |
| 0:16 | **LIGHT** — `torch`. | — |
| 0:18 | — | **The Students:** “Ahn ahn!” *(sad)*<br><code>m011_open_04</code> |
| 0:20 | **MOVE** — WIDE, `lawn_high` → Shamsu (10.0s). | — |
| 0:21 | Shamsu walks to `library_steps`. | — |
| 0:22 | The Students walks to `library_steps`. | — |
| 0:26 | — | **The Roommate:** “Forty moths. One Professor.” *(amused)*<br><code>m011_open_05</code> |
| 0:31 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m011_started`=true · The Fresher: at `lawn_path`

### Mid-scene 1 — `cut_m011_mid_1`

**Type:** `full` · **Max duration:** 36s · **Skippable:** yes · **Play once:** yes  
**First frame:** `gabas_steps_side` → The Fresher  
**Cast:** `PLAYER` → The Fresher (`player`) · `MUHAMMAD` → Muhammad (`npc.muhammad`) · `SHAMSU` → Shamsu (`npc.shamsu`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `day`.<br>**CUT** — MEDIUM, `gabas_steps_side` → The Fresher (5.0s). | — |
| 0:01 | The Fresher writes. | — |
| 0:03 | — | **The Fresher:** “No. No no no.” *(scared)*<br><code>m011_mid1_p01</code> |
| 0:05 | **CUT** — OVER_SHOULDER, `PLAYER` → Muhammad (18.0s).<br>Muhammad is revealed. | — |
| 0:06 | — | **Muhammad:** “Excuse me. Sorry.” *(warm)*<br><code>m011_mid1_01</code> |
| 0:08 | Prop `prop.blue_pen` appears at The Fresher. | — |
| 0:10 | — | **Muhammad:** “Question four is the long one. Start there.” *(neutral)*<br><code>m011_mid1_02</code> |
| 0:14 | — | **Muhammad:** “Leave one till last. It only looks easy.” *(neutral)*<br><code>m011_mid1_03</code> |
| 0:19 | — | **Muhammad:** “Sorry. I shouldn't. You looked worried.” *(shy)*<br><code>m011_mid1_04</code> |
| 0:23 | **CUT** — MEDIUM, `gabas_door` → Shamsu (6.0s). | — |
| 0:24 | — | **Shamsu:** “{{PLAYER\_NAME}}! Who are you talking to?” *(neutral)*<br><code>m011_mid1_05</code> |
| 0:29 | **CUT** — WIDE, `gabas_steps_side` → `gabas_steps_empty` (4.0s).<br>Muhammad is no longer visible. | — |
| 0:33 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `ms_04`=true, `hint_q4`=true · The Fresher: at `gabas_steps`; items `blue_pen_old` 1

### Closing — `cut_m011_close`

**Type:** `full` · **Max duration:** 30s · **Skippable:** yes · **Play once:** yes  
**First frame:** `corridor_mid` → Tunde  
**Cast:** `PLAYER` → The Fresher (`player`) · `TUNDE` → Tunde (`npc.tunde`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `night`.<br>**CUT** — MEDIUM, `corridor_mid` → Tunde (6.0s). | — |
| 0:01 | Tunde walks to `room_door`. | — |
| 0:04 | Prop `prop.sketch_y1` appears at The Fresher. | — |
| 0:06 | **CUT** — TOP, `PLAYER` → `prop.sketch_y1` (8.0s). | — |
| 0:07 | — | **MUSIC** — `mystery_thread`. |
| 0:14 | **CUT** — CLOSE, `corridor_wall` → Tunde (13.0s). | — |
| 0:15 | — | **The Fresher:** “Who's that? Behind me.” *(neutral)*<br><code>m011_close_p01</code> |
| 0:18 | — | **Tunde:** “I draw what's there.” *(shy)*<br><code>m011_close_01</code> |
| 0:21 | Tunde looks at `prop.sketch_y1`. | — |
| 0:23 | — | **Tunde:** “…I don't remember that being there.” *(whisper)*<br><code>m011_close_02</code> |
| 0:28 | — | **MUSIC OUT** — `mystery_thread`. |

**End state:** Flags: `m011_done`=true, `met_tunde`=true, `sketch_figure`=true · The Fresher: at `room_door`; items `tunde_sketch_y1` 1, `brain_booster_tea` 1

### Conditional special dialogue

> **Do not record or stage these in the canon pass.** They exist only when the named real-person flag is enabled, and must be cut cleanly when it is off. They are never romance content, never marketing, and never in a non-conditional cutscene.

**Jiya** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m011_play_j01` | “Pens down. That includes you, mate. Yes, I can see you finishing a sentence.” | — |

**Staging.** `Y1.md` carries this as an inline aside in the mission story rather than a block. Use the mission text for blocking and keep the line optional.

## M012 · Count Entropy

**When:** Y1 · S1 Wk 14 · Thu (exam week) · 21:00–01:00 (night).  
**Where:** hostels → the boulevard → admin: Senate steps.  
**Who:** {{ROOMIE}}, Jega, Shamsu, Nusaiba, Mubarak, Bolaji, the Maker (briefly). **(switch: you and {{ROOMIE}})**  
**Special helpers (conditional):** Taty.  
**Mystery:** plants C-CAPE (the cloth on the weathervane); deepens "what moves in the dark"; C-KB (his board that morning: "TORCH ₦900. Don't ask.").  
**Connects to:** M3 (the first shade found a fresher alone; now there are hundreds alone with books); M6 (the Maker); M7 (Bolaji comes when asked); M10 (Mubarak's torches); M11 (the lamp everyone followed).

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Go up to the roof` · `loc.hostel.roof` · completeWhen: `reach(loc.hostel.roof)` · fail: none
2. `Gather your corridor (10 people)` · `loc.hostel.corridor` · completeWhen: `minigame.pass(crowd_gather, 10)` · fail: `a shade reaches a room → that student sits cold; bring them food later`
3. `Get torches from Mubarak` · `loc.hostel.steps` · completeWhen: `talk(npc.mubarak)` → `collect(item.torch, 5)` · fail: none
4. `Ask Bolaji for the generator` · `loc.sports.court` · completeWhen: `talk(npc.bolaji)` · fail: none
5. `Keep the reading room singing` · `loc.lib.reading_room` · completeWhen: `switch(roomie)` then `minigame.pass(rhythm, 3 rounds)` · fail: `the room goes quiet → restart the round`
6. `Lead the line to the Senate` · `loc.admin.senate_steps` · completeWhen: `switch(player)` then `escort(crowd.students, loc.admin.senate_steps)` · fail: `the line breaks → regroup at the last lamp post`
7. `Hold the steps` · `loc.admin.senate_steps` · completeWhen: `minigame.pass(crowd_gather, 80)` + `use(item.generator)` · fail: `torches under 20 → fall back, regather`
8. `Look up` · completeWhen: `cutscene.end(cut_m012_close)`

### Opening — `cut_m012_open`

**Type:** `full` · **Max duration:** 32s · **Skippable:** yes · **Play once:** yes  
**First frame:** `hostel_roof_edge` → `campus_core`  
**Cast:** `PLAYER` → The Fresher (`player`) · `ROOMIE` → The Roommate (`npc.roomie`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CALENDAR CARD** — “Thu · Week 14 · Exam week · Night”.<br>**LIGHT** — `night`.<br>**MOVE** — WIDE, `hostel_roof_edge` → `campus_core` (12.0s). | — |
| 0:02 | **VFX** — `blackout_rows` at `campus_core`. | **SFX** — `power_down_rolling`. |
| 0:10 | **LIGHT** — `blackout`. | — |
| 0:12 | **CUT** — MEDIUM, `hostel_roof_tank` → The Roommate (16.0s). | — |
| 0:13 | — | **The Roommate:** “Riddle me this. …No. Not tonight.” *(scared)*<br><code>m012_open_01</code> |
| 0:17 | **VFX** — `shade_drift` at `lawn_between_blocks`. | — |
| 0:18 | — | **The Fresher:** “There are hundreds.” *(whisper)*<br><code>m012_open_p01</code> |
| 0:21 | — | **The Roommate:** “And everybody's reading. Alone.” *(whisper)*<br><code>m012_open_02</code> |
| 0:25 | — | **The Roommate:** “One torch is a snack. Five is a problem.” *(stern)*<br><code>m012_open_03</code> |
| 0:29 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m012_started`=true · The Fresher: at `hostel_roof`

### Mid-scene 1 — `cut_m012_mid_1`

**Type:** `full` · **Max duration:** 28s · **Skippable:** yes · **Play once:** yes  
**First frame:** `hostel_steps_low` → Mubarak  
**Cast:** `PLAYER` → The Fresher (`player`) · `MUBARAK` → Mubarak (`npc.mubarak`) · `CROWD` → The Students (`crowd.students`) · `TATY?` → Taty (`special.taty`) — `CONDITIONAL`

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `torch`.<br>**CUT** — MEDIUM, `hostel_steps_low` → Mubarak (20.0s). | — |
| 0:01 | — | **Mubarak:** “Torch! Premium torch! Three hundred!” *(excited)*<br><code>m012_mid1_01</code> |
| 0:05 | Mubarak looks at `lawn_between_blocks`. | — |
| 0:07 | Mubarak looks at `prop.torch_in_hand`. | — |
| 0:10 | — | **Mubarak:** “…God, You are watching me.” *(whisper)*<br><code>m012_mid1_02</code> |
| 0:13 | Mubarak gestures. | — |
| 0:13 | — | **Mubarak:** “Take. Take! Don't thank me. I am suffering.” *(sad)*<br><code>m012_mid1_03</code> |
| 0:22 | **CUT** — WIDE, `lawn_high` → The Students (5.0s). | — |
| 0:23 | **VFX** — `torch_bloom` at `hostel_steps`. | — |
| 0:27 | **RETURN TO PLAYER** — blend 1.0s. | — |

**Conditional insert — `special.taty`**

> Plays only when the named real-person flag is on. If it is off, cut these rows; the surrounding scene, camera and timing continue without them. This insert is never part of the canon pass and never a romance beat.

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:17 | Taty runs to `hostel_steps`. | — |
| 0:18 | — | **Taty:** “Give me twenty. I have arms. Bora!” *(excited)*<br><code>m012_mid1_t01</code> |

**End state:** Flags: `mubarak_gave_torches`=true · The Fresher: at `hostel_steps`; items `torch` 5

### Mid-scene 2 — `cut_m012_mid_2`

**Type:** `event` · **Max duration:** 30s · **Skippable:** yes · **Play once:** yes  
**First frame:** `boulevard_end` → `senate_steps_top`  
**Cast:** `PLAYER` → The Fresher (`player`) · `JEGA` → Jega (`npc.jega`) · `NUSAIBA` → Nusaiba (`npc.nusaiba`) · `SHAMSU` → Shamsu (`npc.shamsu`) · `BOLAJI` → Bolaji (`npc.bolaji`) · `CROWD` → The Students (`crowd.students`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `blackout`.<br>**MOVE** — WIDE, `boulevard_end` → `senate_steps_top` (8.0s). | **MUSIC** — `count_theme`. |
| 0:02 | **VFX** — `shade_gather` at `senate_steps_top`. | — |
| 0:08 | **CUT** — CLOSE, `senate_steps_low` → `senate_steps_top` (7.0s). | — |
| 0:09 | Prop `prop.count_entropy` appears at `senate_steps_top`. | — |
| 0:15 | **CUT** — MEDIUM, `boulevard_front` → Jega (12.0s). | — |
| 0:16 | — | **Jega:** “Kai. It's wearing a cape.” *(scared)*<br><code>m012_mid2_01</code> |
| 0:19 | — | **Shamsu:** “Technically, that is not possible.” *(scared)*<br><code>m012_mid2_02</code> |
| 0:22 | — | **Nusaiba:** “Torches down, not in faces. Line up. NOW.” *(stern)*<br><code>m012_mid2_03</code> |
| 0:25 | — | **Bolaji:** “Sly is not afraid. Sly is… beside you.” *(scared)*<br><code>m012_mid2_04</code> |
| 0:29 | **RETURN TO PLAYER** — blend 0.8s. | — |

**End state:** Flags: `count_seen`=true · The Fresher: at `senate_steps_bottom`

### Closing — `cut_m012_close`

**Type:** `full` · **Max duration:** 38s · **Skippable:** yes · **Play once:** yes  
**First frame:** `senate_lawn` → `senate_steps_top`  
**Cast:** `PLAYER` → The Fresher (`player`) · `ROOMIE` → The Roommate (`npc.roomie`) · `MAKER` → The Maker (`npc.maker`) · `CROWD` → The Students (`crowd.students`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | — | **SFX** — `generator_start`. |
| 0:01 | **VFX** — `bulb_string_on` at `senate_steps_bottom`. | — |
| 0:02 | **CUT** — WIDE, `senate_lawn` → `senate_steps_top` (6.0s). | — |
| 0:03 | Prop `prop.count_entropy` is removed. | — |
| 0:08 | **CUT** — POV, `PLAYER` → `boulevard_tree_far` (4.0s).<br>The Maker is revealed. | — |
| 0:12 | **LIGHT** — `night`.<br>The Maker is no longer visible. | **SFX** — `power_up_surge`. |
| 0:13 | **CUT** — WIDE, `boulevard_crane` → The Students (8.0s). | — |
| 0:14 | — | **The Students:** “UP NEPA!” *(excited)*<br><code>m012_close_01</code> |
| 0:16 | The Students cheers. | — |
| 0:18 | — | **The Roommate:** “We have a paper at eight. Why am I happy?” *(amused)*<br><code>m012_close_02</code> |
| 0:22 | **LIGHT** — `day`. | **MUSIC OUT** — `count_theme`. |
| 0:23 | **CALENDAR CARD** — “Fri · 07:30”. | — |
| 0:23 | **MOVE** — CLOSE, `senate_roof` → `prop.weathervane` (9.0s). | — |
| 0:24 | Prop `prop.cape_scrap` appears at `prop.weathervane`. | — |
| 0:32 | — | **The Roommate:** “…That wasn't there yesterday.” *(whisper)*<br><code>m012_close_03</code> |
| 0:36 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m012_done`=true, `cape_on_vane`=true, `crew_chat`=true · The Fresher: at `senate_lawn`; items `torch_upgraded` 1

### Conditional special dialogue

> **Do not record or stage these in the canon pass.** They exist only when the named real-person flag is enabled, and must be cut cleanly when it is off. They are never romance content, never marketing, and never in a non-conditional cutscene.

**Taty** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m012_play_t01` | “Give me ten. No, twenty. I have arms.” | — |
| `m012_play_t02` | “Block C is lit. Block D is lit. Who's next? Don't make me choose.” | — |
| `m012_play_t03` | “Pixel doesn't like them. Pixel doesn't like anybody. So that means nothing.” | — |
| `m012_play_t04` | “I'm not scared. I'm fast. It's a different thing.” | — |

**Staging and `[ELSE]` from `Y1.md`:**

> - **[IF special.taty]** In steps 2–3 she is the courier: runs torches from Mubarak to each block faster than the dark can cross the lawn, so two blocks arrive already lit and your gather target falls from 10 to 6 (Never Tired). Her cat rides in her hood and hisses at the windows. Lines: `m012_play_t01` "Give me ten. No, twenty. I have arms." · `m012_play_t02` "Block C is lit. Block D is lit. Who's next? Don't make me choose." · `m012_play_t03` "Pixel doesn't like them. Pixel doesn't like anybody. So that means nothing." · `m012_play_t04` "I'm not scared. I'm fast. It's a different thing."
> - **[ELSE]** Jega's teammates carry the torches at a jog; the gather target stays 10.

## M013 · Results Day

**When:** Y1 · S2 Wk 1 · Mon (results day, event) · 09:00–15:00.  
**Where:** eng: noticeboards; admin: bank; hostel.  
**Who:** {{ROOMIE}}, Shamsu, Jega, Dad (phone), Dr. Khadija.  
**Mystery:** plants C-BOARD (one handwritten slip among the results: "Page 41, please return."); Shamsu's fear (he cannot bear a B).  
**Connects to:** M5 and M11 (your lecture and test scores are the numbers on the sheet); M12 (the paper you sat at eight after no sleep); M8 (Jega).

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Find your number on the board` · `loc.eng.noticeboard` · completeWhen: `minigame.pass(search, crowd)` · fail: none (time taken only)
2. `Talk to Shamsu` · `loc.eng.quad` · completeWhen: `talk(npc.shamsu)` · fail: none
3. `Sit with Jega` · `loc.eng.quad_kerb` · completeWhen: `choice(m013_jega)` (joke with him, or sit quietly; the quiet option raises friendship more) · fail: none
4. `Answer Dad's call` · anywhere · completeWhen: `talk(npc.dad)` (phone) · fail: `ignore the call → he texts "I see."; allowance delayed one week`
5. `Collect your allowance` · `loc.admin.bank` · completeWhen: `minigame.pass(queue)` then `flag(allowance_y1s2)` · fail: none
6. `Read the slip on the board` · `loc.eng.noticeboard` · completeWhen: `cutscene.end(cut_m013_close)`

### Opening — `cut_m013_open`

**Type:** `event` · **Max duration:** 28s · **Skippable:** yes · **Play once:** yes  
**First frame:** `eng_office_door` → Engineering Clerk  
**Cast:** `PLAYER` → The Fresher (`player`) · `ROOMIE` → The Roommate (`npc.roomie`) · `CLERK` → Engineering Clerk (`npc.eng_clerk`) · `CROWD` → The Students (`crowd.students`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CALENDAR CARD** — “Mon · Week 1 · Results day”.<br>**LIGHT** — `day`.<br>**VFX** — `dust` at `eng_quad`.<br>**CUT** — MEDIUM, `eng_office_door` → Engineering Clerk (6.0s). | — |
| 0:01 | Engineering Clerk walks to `noticeboard`. | — |
| 0:04 | — | **SFX** — `pin_push`. |
| 0:06 | **CUT** — WIDE, `quad_high` → The Students (8.0s). | — |
| 0:07 | The Students runs to `noticeboard`. | — |
| 0:08 | — | **SFX** — `polite_stampede`. |
| 0:14 | **CUT** — MEDIUM, `quad_edge` → The Roommate (10.0s). | — |
| 0:15 | — | **The Roommate:** “Riddle: what is A4, and ruins your life?” *(scared)*<br><code>m013_open_01</code> |
| 0:19 | — | **The Fresher:** “We move.” *(neutral)*<br><code>m013_open_p01</code> |
| 0:21 | — | **The Roommate:** “We don't move. We are carried.” *(dry)*<br><code>m013_open_02</code> |
| 0:25 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m013_started`=true · The Fresher: at `quad_edge`

### Mid-scene 1 — `cut_m013_mid_1`

**Type:** `full` · **Max duration:** 36s · **Skippable:** yes · **Play once:** yes  
**First frame:** `PLAYER` → `prop.phone_ringing`  
**Cast:** `PLAYER` → The Fresher (`player`) · `DAD` → Dad (`npc.dad`) · `MUM` → Mum (`npc.mum`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — CLOSE, `PLAYER` → `prop.phone_ringing` (4.0s). | **SFX** — `phone_ring_dread`. |
| 0:04 | **CUT** — MEDIUM, `quad_bench` → The Fresher (28.0s). | — |
| 0:05 | The Fresher takes a phone call. | — |
| 0:06 | — | **Dad:** “I am not angry.” *(neutral)*<br><code>m013_mid1_01</code> |
| 0:09 | — | **Dad:** “I am only calculating.” *(stern)*<br><code>m013_mid1_02</code> |
| 0:13 | — | **Dad** — **TOKEN:** `[LECTURE_LINE: chosen by grades and spending]` *(stern)*<br><code>m013_mid1_03</code> |
| 0:20 | — | **The Fresher:** “Yes, sir.” *(shy)*<br><code>m013_mid1_p01</code> |
| 0:23 | — | **Mum:** “Give me the phone. Have you eaten?” *(warm)*<br><code>m013_mid1_04</code> |
| 0:27 | — | **Mum:** “He's prouder than he sounds. Eat.” *(whisper)*<br><code>m013_mid1_05</code> |
| 0:32 | — | **SFX** — `bank_alert`. |
| 0:34 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `dad_lecture_y1`=true · The Fresher: at `quad_bench`

### Closing — `cut_m013_close`

**Type:** `full` · **Max duration:** 28s · **Skippable:** yes · **Play once:** yes  
**First frame:** `noticeboard_face` → `prop.slip_page41`  
**Cast:** `PLAYER` → The Fresher (`player`) · `KHADIJA` → Dr. Khadija (`npc.khadija`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — CLOSE, `noticeboard_face` → `prop.slip_page41` (7.0s). | — |
| 0:01 | — | **MUSIC** — `mystery_thread`. |
| 0:07 | **CUT** — MEDIUM, `noticeboard_side` → Dr. Khadija (16.0s). | — |
| 0:08 | Dr. Khadija walks to `noticeboard_path`. | — |
| 0:10 | — | **Dr. Khadija:** “{{PLAYER\_NAME}}. I know your name now.” *(stern)*<br><code>m013_close_01</code> |
| 0:14 | — | **Dr. Khadija:** “I will be watching you. In the good sense.” *(neutral)*<br><code>m013_close_02</code> |
| 0:18 | — | **Dr. Khadija:** “For now.” *(dry)*<br><code>m013_close_03</code> |
| 0:21 | Dr. Khadija walks to `eng_office_door`. | — |
| 0:23 | **CUT** — CLOSE, `noticeboard_face` → `prop.slip_thank_you` (4.0s). | — |
| 0:26 | — | **MUSIC OUT** — `mystery_thread`. |

**End state:** Flags: `m013_done`=true, `khadija_watching`=true, `night_board_seen`=true · The Fresher: at `noticeboard`

# ACT III · THE SECOND SEMESTER

*Missions M014–M024.* The year turns outward: work, sport, radio, the dam, six sites, a week of asking, exams, and the garden at convocation.

## M014 · Sly's Last Stand

**When:** Y1 · S2 Wk 2 · Sat (weekend) · 07:00–17:00.  
**Where:** sports: gym, then the court.  
**Who:** Bolaji, Coach Ngozi, Big Baby, Abbas, Hassan.  
**Special helpers (conditional):** Taty.  
**Mystery:** pays C-SYMBOL a little (he chalks his ring exactly over the old one, without knowing); plants the barber (clippers in his bag).  
**Connects to:** M7 (the tax, and the push that moved him the width of a coin); M12 (he carried the generator; he is not the same person).

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Read the challenge` · `loc.hostel.room` · completeWhen: `cutscene.end(cut_m014_open)`
2. `Weigh in with Coach Ngozi` · `loc.sports.gym` · completeWhen: `talk(npc.ngozi)` · fail: none
3. `Three lifts` · `loc.sports.gym` · completeWhen: `minigame.pass(lift, 3 sets)` · fail: `missed beats → lighter weight, smaller gain`
4. `Eat a proper meal` · `loc.student.spot` · completeWhen: `use(item.plate_protein)` · fail: `garri instead → a stamina penalty in the spar and a comment`
5. `Treadmill and rope` · `loc.sports.gym` · completeWhen: `minigame.pass(run_lap, treadmill)` · fail: none
6. `Spar with Bolaji at 17:00` · `loc.sports.court_centre` · completeWhen: `minigame.pass(scuffle, best of 3)` · fail: `lose → same ending, different line`
7. `Sit on the bench` · completeWhen: `cutscene.end(cut_m014_close)`

### Opening — `cut_m014_open`

**Type:** `full` · **Max duration:** 26s · **Skippable:** yes · **Play once:** yes  
**First frame:** `room_door` → Hassan  
**Cast:** `PLAYER` → The Fresher (`player`) · `ROOMIE` → The Roommate (`npc.roomie`) · `HASSAN` → Hassan (`npc.hassan`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — MEDIUM, `room_door` → Hassan (8.0s). | — |
| 0:01 | — | **SFX** — `knock_three`. |
| 0:02 | — | **Hassan:** “Delivery. Sign for the note. Sign for the receipt.” *(bored)*<br><code>m014_open_01</code> |
| 0:06 | Prop `prop.challenge_note` appears at The Fresher. | — |
| 0:08 | **CUT** — TOP, `PLAYER` → `prop.challenge_note` (8.0s). | — |
| 0:09 | **TITLE CARD** — “A FAIR SPAR. RULES. A REFEREE. 5 P.M.”. | — |
| 0:16 | **CUT** — MEDIUM, `room_corner` → The Roommate (9.0s). | — |
| 0:17 | — | **The Roommate:** “'B.B.' She signed it. So it's real.” *(whisper)*<br><code>m014_open_02</code> |
| 0:20 | — | **The Roommate:** “The gym opens at seven. I'll watch. From far.” *(amused)*<br><code>m014_open_03</code> |
| 0:24 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m014_started`=true · The Fresher: at `room_door`; items `challenge_note` 1

### Mid-scene 1 — `cut_m014_mid_1`

**Type:** `entry` · **Max duration:** 26s · **Skippable:** yes · **Play once:** yes  
**First frame:** `gym_door` → `gym_floor`  
**Cast:** `PLAYER` → The Fresher (`player`) · `NGOZI` → Coach Ngozi (`npc.ngozi`) · `TATY?` → Taty (`special.taty`) — `CONDITIONAL`

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — WIDE, `gym_door` → `gym_floor` (4.0s). | — |
| 0:04 | **CUT** — MEDIUM, `gym_scale_side` → Coach Ngozi (16.0s). | — |
| 0:05 | The Fresher walks to `gym_scale`. | — |
| 0:07 | — | **SFX** — `scale_announce_beep`. |
| 0:08 | — | **Coach Ngozi:** “The scale speaks. Don't take it personally.” *(warm)*<br><code>m014_mid1_01</code> |
| 0:12 | — | **Coach Ngozi:** “Three lifts. On the beat. Then you eat properly.” *(stern)*<br><code>m014_mid1_02</code> |
| 0:16 | — | **Coach Ngozi:** “Garri is not a food group. It is a cry for help.” *(dry)*<br><code>m014_mid1_03</code> |
| 0:25 | **RETURN TO PLAYER** — blend 1.0s. | — |

**Conditional insert — `special.taty`**

> Plays only when the named real-person flag is on. If it is off, cut these rows; the surrounding scene, camera and timing continue without them. This insert is never part of the canon pass and never a romance beat.

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:20 | **CUT** — MEDIUM, `gym_rack` → Taty (4.0s). | — |
| 0:21 | — | **Taty:** “Fresher! You again. Good. I need a victim.” *(amused)*<br><code>m014_mid1_t01</code> |

**End state:** Flags: `gym_member`=true, `before_photo`=true · The Fresher: at `gym_rack`

### Closing — `cut_m014_close`

**Type:** `full` · **Max duration:** 40s · **Skippable:** yes · **Play once:** yes  
**First frame:** `court_centre_low` → Bolaji  
**Cast:** `PLAYER` → The Fresher (`player`) · `BOLAJI` → Bolaji (`npc.bolaji`) · `BABY` → Big Baby (`npc.big_baby`) · `ABBAS` → Abbas (`npc.abbas`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `dusk`.<br>**CUT** — MEDIUM, `court_centre_low` → Bolaji (9.0s). | — |
| 0:01 | Bolaji looks at Big Baby. | — |
| 0:02 | — | **Bolaji:** “Sly keeps his word. No tax. This year.” *(proud)*<br><code>m014_close_01</code> |
| 0:06 | — | **Abbas:** “The crowd is pleased. I am also pleased.” *(bored)*<br><code>m014_close_02</code> |
| 0:09 | **CUT** — MEDIUM, `court_bench_front` → Bolaji (28.0s). | — |
| 0:10 | Bolaji sits. | — |
| 0:11 | — | **SFX** — `bench_creak`. |
| 0:12 | Prop `prop.clippers` appears at `court_bench`. | — |
| 0:13 | Bolaji freezes in shock. | — |
| 0:14 | Prop `prop.clippers` is removed. | — |
| 0:15 | — | **Bolaji:** “That is nothing. That is for… dogs.” *(shy)*<br><code>m014_close_03</code> |
| 0:19 | Prop `prop.zobo_max` appears at The Fresher. | — |
| 0:20 | — | **Bolaji:** “Zobo Max. You'll need it one day. Sly knows things.” *(proud)*<br><code>m014_close_04</code> |
| 0:26 | — | **Bolaji:** “I didn't think anyone would train for it.” *(whisper)*<br><code>m014_close_05</code> |
| 0:31 | — | **The Fresher:** “Same time next week?” *(warm)*<br><code>m014_close_p01</code> |
| 0:34 | Bolaji nods. | — |
| 0:37 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m014_done`=true, `sly_friend`=true, `clippers_seen`=true, `tax_ended_y1`=true · The Fresher: at `court_bench`; items `zobo_max` 1

### Conditional special dialogue

> **Do not record or stage these in the canon pass.** They exist only when the named real-person flag is enabled, and must be cut cleanly when it is off. They are never romance content, never marketing, and never in a non-conditional cutscene.

**Taty** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m014_play_t01` | “Lift on my count. One. Two. I'm not helping, I'm just touching the bar. Three.” | — |
| `m014_play_t02` | “You ate garri for dinner. I can see it in your soul.” | — |
| `m014_play_t03` | “Last set. I lied. Second last.” | — |
| `m014_play_t04` | “Big man! You fight fair or I make you run with me. Your choice.” | to Bolaji |
| `m014_play_t05` | “See? You moved him. Last month you couldn't move his shadow.” | — |

**Staging and `[ELSE]` from `Y1.md`:**

> - **[IF special.taty]** She is your gym partner for steps 3 and 5 (her spotting widens the timing window on the lifts; running beside her on the next treadmill, the stamina drain halves), and holds the round cards at the spar. Lines: `m014_play_t01` "Lift on my count. One. Two. I'm not helping, I'm just touching the bar. Three." · `m014_play_t02` "You ate garri for dinner. I can see it in your soul." · `m014_play_t03` "Last set. I lied. Second last." · `m014_play_t04` (to Bolaji) "Big man! You fight fair or I make you run with me. Your choice." · `m014_play_t05` "See? You moved him. Last month you couldn't move his shadow."
> - **[ELSE]** Coach Ngozi spots you with a normal window; Hassan holds the round cards upside down.

## M015 · Baba Dam's Pier

**When:** Y1 · S2 Wk 3 · Sun (weekend) · 09:00 to sunset.  
**Where:** dam: pier, shallows, cliff; eng: civil workshop.  
**Who:** Baba Dam, Foreman Asabe, {{ROOMIE}}, Ranger Lawal, the Maker.  
**Mystery:** plants C-SISTER (the first line), the cliff tower (stakes and "we ran out of wood"), the Old Site (a light in the forest); C-SACK is set up for the side mission "What the Net Caught".  
**Connects to:** M6 (the statue of a girl feeding fish; the Maker who never leaves his garden, except that you saw him at the hospital in M9).

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Ride to the dam with {{ROOMIE}}` · `loc.dam.pier` · completeWhen: `ride.arrive(bicycle, loc.dam.pier)` · fail: none
2. `Get materials from Foreman Asabe` · `loc.eng.workshop_civil` · completeWhen: `minigame.pass(measure_cut, 4 planks)` → `collect(item.plank, 4)`, `collect(item.cement, 1)`, `collect(item.sand, 1)` · fail: `cut wrong → "Again." one plank wasted, free replacement`
3. `Carry them back` · `loc.dam.pier` · completeWhen: `deliver(item.plank, loc.dam.pier)` (encumbered) · fail: none
4. `Mend the pier` · `loc.dam.pier` · completeWhen: `minigame.pass(build, pier)` · fail: `loose nail → {{ROOMIE}} tests it and falls in again`
5. `Learn to float` · `loc.dam.shallows` · completeWhen: `minigame.pass(swim, float 10 s)` · fail: `sink → Baba Dam fishes you out; retry`
6. `Swim across the shallows` · `loc.dam.shallows` · completeWhen: `reach(loc.dam.shallows_far)` swimming · fail: `out of breath → stand up; it is shallow`
7. `Watch the sunset` · `loc.dam.pier` · completeWhen: `cutscene.end(cut_m015_close)`

### Opening — `cut_m015_open`

**Type:** `entry` · **Max duration:** 30s · **Skippable:** yes · **Play once:** yes  
**First frame:** `dam_road_crest` → `dam_water`  
**Cast:** `PLAYER` → The Fresher (`player`) · `ROOMIE` → The Roommate (`npc.roomie`) · `BABADAM` → Baba Dam (`npc.baba_dam`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **MOVE** — WIDE, `dam_road_crest` → `dam_water` (6.0s). | — |
| 0:01 | — | **MUSIC** — `dam_theme` (ducked under dialogue). |
| 0:06 | **CUT** — MEDIUM, `pier_side_low` → The Roommate (12.0s). | — |
| 0:07 | The Roommate walks to `pier_mid`. | — |
| 0:08 | — | **The Roommate:** “Riddle: what is free, wet, and full of fi—” *(excited)*<br><code>m015_open_01</code> |
| 0:11 | — | **SFX** — `plank_long_creak`. |
| 0:14 | — | **SFX** — `splash_big`. |
| 0:14 | The Roommate is no longer visible. | — |
| 0:15 | The Fresher laughs. | — |
| 0:18 | **CUT** — MEDIUM, `pier_end` → Baba Dam (10.0s). | — |
| 0:19 | The Roommate is revealed. | — |
| 0:19 | Baba Dam carries the load. | — |
| 0:21 | — | **Baba Dam:** “Fish don't hurry. Pier don't either.” *(dry)*<br><code>m015_open_02</code> |
| 0:25 | — | **Baba Dam:** “Four planks. You broke one. So: four planks.” *(neutral)*<br><code>m015_open_03</code> |
| 0:29 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m015_started`=true, `met_baba_dam`=true · The Fresher: at `pier_foot`

### Mid-scene 1 — `cut_m015_mid_1`

**Type:** `ambient` · **Max duration:** 20s · **Skippable:** yes · **Play once:** yes  
**First frame:** `PLAYER` → `cliff_stakes`  
**Cast:** `PLAYER` → The Fresher (`player`) · `BABADAM` → Baba Dam (`npc.baba_dam`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — POV, `PLAYER` → `cliff_stakes` (8.0s). | — |
| 0:02 | — | **The Fresher:** “What's that? On the cliff.” *(neutral)*<br><code>m015_mid1_p01</code> |
| 0:05 | — | **Baba Dam:** “A tower. One day.” *(neutral)*<br><code>m015_mid1_01</code> |
| 0:08 | **CUT** — CLOSE, `pier_post` → Baba Dam (9.0s). | — |
| 0:09 | — | **Baba Dam:** “They brought the stakes when my hair was black.” *(dry)*<br><code>m015_mid1_02</code> |
| 0:13 | — | **Baba Dam:** “Then they ran out of wood.” *(dry)*<br><code>m015_mid1_03</code> |
| 0:18 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `cliff_stakes_seen`=true · The Fresher: at `shallows_far`

### Closing — `cut_m015_close`

**Type:** `full` · **Max duration:** 40s · **Skippable:** yes · **Play once:** yes  
**First frame:** `bank_high` → The Maker  
**Cast:** `PLAYER` → The Fresher (`player`) · `ROOMIE` → The Roommate (`npc.roomie`) · `BABADAM` → Baba Dam (`npc.baba_dam`) · `MAKER` → The Maker (`npc.maker`) · `LAWAL` → Ranger Lawal (`npc.lawal`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `dusk`.<br>**CUT** — WIDE, `bank_high` → The Maker (7.0s). | **MUSIC OUT** — `dam_theme`. |
| 0:01 | The Maker kneels. | — |
| 0:02 | Prop `prop.glass_dam_water` appears at The Maker. | — |
| 0:07 | **CUT** — CLOSE, `pier_end_low` → The Maker (10.0s). | — |
| 0:08 | The Maker looks at `pier_end_water`. | — |
| 0:10 | — | **The Maker:** “My sister used to feed the fish here.” *(neutral)*<br><code>m015_close_01</code> |
| 0:15 | The Maker walks to `dam_road`. | — |
| 0:17 | **CUT** — MEDIUM, `pier_mid` → Baba Dam (4.0s). | — |
| 0:18 | Baba Dam carries the load. | — |
| 0:21 | **LIGHT** — `night`.<br>**CUT** — MEDIUM, `tree_line` → Ranger Lawal (8.0s). | — |
| 0:22 | **VFX** — `torch_click_on` at `LAWAL`. | — |
| 0:23 | — | **Ranger Lawal:** “Go back.” *(stern)*<br><code>m015_close_02</code> |
| 0:26 | — | **The Roommate:** “Good evening to you too, Baba Ranger.” *(amused)*<br><code>m015_close_03</code> |
| 0:29 | **CUT** — POV, `PLAYER` → `forest_light_far` (6.0s). | **MUSIC** — `mystery_thread`. |
| 0:35 | **CUT** — CLOSE, `tree_line_low` → Ranger Lawal (4.0s). | — |
| 0:36 | — | **Ranger Lawal:** “…Go back.” *(whisper)*<br><code>m015_close_04</code> |
| 0:39 | — | **MUSIC OUT** — `mystery_thread`. |

**End state:** Flags: `m015_done`=true, `sister_line_1`=true, `forest_light_seen`=true, `met_lawal`=true, `swimming`=true · The Fresher: at `pier_foot`

### Conditional special dialogue

> **Do not record or stage these in the canon pass.** They exist only when the named real-person flag is enabled, and must be cut cleanly when it is off. They are never romance content, never marketing, and never in a non-conditional cutscene.

**Taty** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m015_play_t01` | “He says 'float'. I say 'kick'. Do both. Bora!” | — |
| `m015_play_t02` | “You swim like a chair. A brave chair.” | — |
| `m015_play_t03` | “Pixel thinks water is a mistake. Pixel is wrong about many things.” | — |

**Staging and `[ELSE]` from `Y1.md`:**

> - **[IF special.taty]** She is swimming lengths of the bay when you arrive and gives the lesson its second half (step 6: with her alongside, your breath drains 30% slower). Her cat sits on the mended pier and will not look at the water. Lines: `m015_play_t01` "He says 'float'. I say 'kick'. Do both. Bora!" · `m015_play_t02` "You swim like a chair. A brave chair." · `m015_play_t03` "Pixel thinks water is a mistake. Pixel is wrong about many things."
> - **[ELSE]** Baba Dam shouts "Float!" from the pier at intervals; no bonus.

## M016 · The Dam at Midnight

**When:** Y1 · S2 Wk 4 · Fri · 23:00–02:00 (night; harmattan haze).  
**Where:** dam: pier, underwater.  
**Who:** Baba Dam, {{ROOMIE}}, Mubarak (phone), the eel, Muhammad.  
**Special helpers (conditional):** Taty.  
**Mystery:** plants MS-05 (a hand in the water; footprints that stop), the relay core (six dots), the eel; C-HUM (the same note, under water).  
**Connects to:** M15 (the pier you mended holds your weight tonight; the Maker's line); M10 (the Plug); M6 (the hum).

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Meet Baba Dam at the pier at night` · `loc.dam.pier` · completeWhen: `reach(loc.dam.pier)` after `time(23:00)` · fail: none
2. `Listen at the post` · `loc.dam.pier` · completeWhen: `cutscene.end(cut_m016_open)`
3. `Call Mubarak` · phone · completeWhen: `talk(npc.mubarak)` → `collect(item.iron_lungs_gum, 1)` after `timer(60)` · fail: none
4. `Dive to the humming thing` · `loc.dam.underwater` · completeWhen: `use(item.iron_lungs_gum)` then `reach(loc.dam.underwater_core)` · fail: `out of breath → surface, a second gum is in the foil`
5. `Offer the eel kilishi` · `loc.dam.underwater_core` · completeWhen: `minigame.pass(bargain, patience)` 3 offers · fail: `grab → the eel nudges you back to the surface, unharmed; dive again`
6. `Take the relay core and surface` · completeWhen: `collect(item.relay_core, 1)` → `cutscene.end(cut_m016_close)`

### Opening — `cut_m016_open`

**Type:** `full` · **Max duration:** 32s · **Skippable:** yes · **Play once:** yes  
**First frame:** `pier_foot_low` → `pier_end`  
**Cast:** `PLAYER` → The Fresher (`player`) · `ROOMIE` → The Roommate (`npc.roomie`) · `BABADAM` → Baba Dam (`npc.baba_dam`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `night`.<br>**VFX** — `dust` at `dam_water`.<br>**MOVE** — WIDE, `pier_foot_low` → `pier_end` (7.0s). | — |
| 0:07 | **CUT** — CLOSE, `pier_post` → Baba Dam (10.0s). | — |
| 0:08 | Baba Dam kneels. | — |
| 0:09 | — | **Baba Dam:** “Listen.” *(whisper)*<br><code>m016_open_01</code> |
| 0:11 | — | **SFX** — `coil_hum_underwater`. |
| 0:13 | The Fresher kneels. | — |
| 0:17 | **CUT** — MEDIUM, `pier_mid` → The Roommate (12.0s). | — |
| 0:18 | — | **The Roommate:** “That's the garden's sound. Under WATER.” *(whisper)*<br><code>m016_open_02</code> |
| 0:22 | — | **Baba Dam:** “Forty years it sang soft. This month, loud.” *(neutral)*<br><code>m016_open_03</code> |
| 0:26 | — | **The Roommate:** “I'm the loud one. I'll stay up here and be loud.” *(scared)*<br><code>m016_open_04</code> |
| 0:30 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m016_started`=true · The Fresher: at `pier_end`

### Mid-scene 1 — `cut_m016_mid_1`

**Type:** `full` · **Max duration:** 24s · **Skippable:** yes · **Play once:** yes  
**First frame:** `underwater_silt` → `prop.relay_core`  
**Cast:** `PLAYER` → The Fresher (`player`) · `EEL` → The Eel (`prop.eel`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `torch`.<br>**FOLLOW** — MEDIUM on The Fresher (6.0s). | — |
| 0:02 | Prop `prop.relay_core` appears at `underwater_core`. | — |
| 0:06 | **CUT** — CLOSE, `underwater_silt` → `prop.relay_core` (5.0s). | — |
| 0:11 | **CUT** — MEDIUM, `underwater_post` → The Eel (10.0s). | — |
| 0:12 | The Eel is revealed. | — |
| 0:13 | The Eel looks at The Fresher. | — |
| 0:15 | The Fresher freezes in shock. | — |
| 0:17 | Prop `prop.eel_head` moves to `underwater_core`. | — |
| 0:21 | **RETURN TO PLAYER** — blend 0.8s. | — |

**End state:** Flags: `met_eel`=true · The Fresher: at `underwater_core`

### Closing — `cut_m016_close`

**Type:** `full` · **Max duration:** 40s · **Skippable:** yes · **Play once:** yes  
**First frame:** `PLAYER` → `water_surface_haze`  
**Cast:** `PLAYER` → The Fresher (`player`) · `ROOMIE` → The Roommate (`npc.roomie`) · `MUHAMMAD` → Muhammad (`npc.muhammad`) · `TATY?` → Taty (`special.taty`) — `CONDITIONAL`

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `blackout`.<br>**CUT** — POV, `PLAYER` → `water_surface_haze` (5.0s). | — |
| 0:01 | — | **SFX** — `heartbeat_underwater`. |
| 0:04 | **VFX** — `hand_reach` at `PLAYER`. | — |
| 0:05 | **CUT** — MEDIUM, `pier_end_low` → The Fresher (12.0s).<br>**LIGHT** — `night`. | — |
| 0:06 | The Fresher kneels. | — |
| 0:06 | Prop `prop.towel` appears at The Fresher. | — |
| 0:08 | — | **Muhammad:** “You'll be all right. I checked. Sorry.” *(warm)*<br><code>m016_close_01</code> |
| 0:13 | The Roommate runs to `pier_end`. | — |
| 0:15 | — | **The Roommate:** “Who are you talking to? I heard you talking!” *(scared)*<br><code>m016_close_02</code> |
| 0:23 | **MOVE** — TOP, `pier_over` → `prop.wet_footprints` (12.0s). | **MUSIC** — `mystery_thread`. |
| 0:24 | Prop `prop.wet_footprints` appears at `pier_to_road`. | — |
| 0:35 | **CUT** — WIDE, `dam_road_crest` → `prop.wet_footprints_end` (4.0s). | — |
| 0:39 | — | **MUSIC OUT** — `mystery_thread`. |

**Conditional insert — `special.taty`**

> Plays only when the named real-person flag is on. If it is off, cut these rows; the surrounding scene, camera and timing continue without them. This insert is never part of the canon pass and never a romance beat.

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:19 | — | **Taty:** “Are you okay? I saw bubbles. I was over there!” *(scared)*<br><code>m016_close_t01</code> |

**End state:** Flags: `m016_done`=true, `ms_05`=true, `eel_trust`=true · The Fresher: at `pier_end`; items `relay_core` 1, `towel_old` 1, `swim_medal_old` 1

### Conditional special dialogue

> **Do not record or stage these in the canon pass.** They exist only when the named real-person flag is enabled, and must be cut cleanly when it is off. They are never romance content, never marketing, and never in a non-conditional cutscene.

**Taty** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m016_play_t01` | “I'll be up here. With the light. Go down, come up, simple.” | — |
| `m016_play_t02` | “An eel? A big one? …How big? No. Don't tell me. Tell me.” | — |
| `m016_play_t03` | “That wasn't me. I was on the other side. …Who pulled you out?” | — |
| `m016_play_t04` | “Pixel, what? There's nothing there. Stop it.” | — |

**Staging and `[ELSE]` from `Y1.md`:**

> - **[IF special.taty]** She has come for a night swim ("the water's warmer than the air, obviously") and is your surface swimmer: at step 4 she holds a second torch above you, so the way up stays lit and running out of breath does not fail the dive. She is not the hand in the cutscene; she is on the far side of the pier at that moment, and says so. Lines: `m016_play_t01` "I'll be up here. With the light. Go down, come up, simple." · `m016_play_t02` "An eel? A big one? …How big? No. Don't tell me. Tell me." · `m016_play_t03` "That wasn't me. I was on the other side. …Who pulled you out?" · `m016_play_t04` "Pixel, what? There's nothing there. Stop it."
> - **[ELSE]** {{ROOMIE}} holds the torch from the pier; it reaches less far; the retry in step 4 stands.

## M017 · Keke Grand Prix

**When:** Y1 · S2 Wk 5 · Sat (weekend) · 10:00–15:00.  
**Where:** ring road; market: motor park.  
**Who:** Lula and Faty Ajaka, Emeka, Aleeya, Basit, a licence examiner.  
**Special helpers (conditional):** Jiya.  
**Mystery:** plants C-LAUGH ("only one person ever laughed at page nine"); nothing else. A daylight mission, on purpose, after two nights.  
**Connects to:** M9 (your first keke ride, as a passenger); M2 (Aleeya); M10 (a Lucky Kola helps on the pit stop).

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Report for your keke test` · `loc.gate.ring_road_start` · completeWhen: `cutscene.end(cut_m017_open)`
2. `Drive one lap with the Ajakas` · ring road · completeWhen: `minigame.pass(drive, test_lap)` with 4 manoeuvres · fail: `stall or bump → Faty: "We'll call that practice." repeat the manoeuvre`
3. `Drop them at the motor park` · `loc.market.motor_park` · completeWhen: `ride.arrive(keke, loc.market.motor_park)` → `flag(keke_licence)`
4. `Enter the Grand Prix` · `loc.market.motor_park` · completeWhen: `talk(npc.emeka)`
5. `Race two laps` · ring road · completeWhen: `minigame.pass(drive, race)` to the last bend · fail: none (position recorded)
6. `Win, or stop for Basit` · last bend · completeWhen: `choice(m017_basit)` → finish · fail: none
7. `Meet Faty's joke book` · `loc.market.motor_park` · completeWhen: `cutscene.end(cut_m017_close)`

### Opening — `cut_m017_open`

**Type:** `vehicle` · **Max duration:** 36s · **Skippable:** yes · **Play once:** yes  
**First frame:** `road_kerb` → Driving Examiner  
**Cast:** `PLAYER` → The Fresher (`player`) · `LULA` → Lula (`npc.lula`) · `FATY` → Faty (`npc.faty`) · `EXAMINER` → Driving Examiner (`npc.examiner`) · `JIYA?` → Jiya (`special.jiya`) — `CONDITIONAL`

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CALENDAR CARD** — “Sat · Week 5 · Weekend”.<br>**CUT** — MEDIUM, `road_kerb` → Driving Examiner (9.0s). | — |
| 0:01 | Driving Examiner walks to `keke_door`. | — |
| 0:03 | Driving Examiner looks at `keke_back_seat`. | — |
| 0:05 | Driving Examiner freezes in shock. | — |
| 0:06 | — | **Driving Examiner:** “I will follow. On foot.” *(scared)*<br><code>m017_open_01</code> |
| 0:09 | **CUT** — MEDIUM, `keke_dash` → `keke_back_seat` (22.0s). | — |
| 0:10 | The Fresher enters in `keke_test`. | — |
| 0:11 | — | **Lula:** “Driver! Motor park. Turn left.” *(proud)*<br><code>m017_open_02</code> |
| 0:14 | — | **Faty:** “He means right.” *(dry)*<br><code>m017_open_03</code> |
| 0:16 | — | **Lula:** “I mean left. Emotionally.” *(proud)*<br><code>m017_open_04</code> |
| 0:19 | — | **Faty:** “Emotionally, we are lost.” *(amused)*<br><code>m017_open_05</code> |
| 0:27 | — | **The Fresher:** “…Is this the test?” *(scared)*<br><code>m017_open_p01</code> |
| 0:30 | — | **Faty:** “My dear, this is the marriage. Drive.” *(warm)*<br><code>m017_open_06</code> |
| 0:34 | **RETURN TO PLAYER** — blend 1.0s. | — |

**Conditional insert — `special.jiya`**

> Plays only when the named real-person flag is on. If it is off, cut these rows; the surrounding scene, camera and timing continue without them. This insert is never part of the canon pass and never a romance beat.

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:23 | — | **Jiya:** “I'm not in this argument. I'm just between it.” *(dry)*<br><code>m017_open_j01</code> |

**End state:** Flags: `m017_started`=true, `met_lula_faty`=true · The Fresher: at `keke_test_seat`

### Mid-scene 1 — `cut_m017_mid_1`

**Type:** `vehicle` · **Max duration:** 20s · **Skippable:** yes · **Play once:** yes  
**First frame:** `last_bend_kerb` → Basit  
**Cast:** `PLAYER` → The Fresher (`player`) · `BASIT` → Basit (`npc.basit`) · `ALEEYA` → Aleeya (`npc.aleeya`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **FOLLOW** — WIDE on Basit (5.0s). | — |
| 0:02 | — | **SFX** — `wheel_pop`. |
| 0:03 | Prop `prop.keke_wheel` moves to `gutter_last_bend`. | — |
| 0:03 | Basit freezes in shock. | — |
| 0:05 | **CUT** — MEDIUM, `last_bend_kerb` → Basit (7.0s). | — |
| 0:06 | — | **Basit:** “No no no. Run it back! RUN IT BACK!” *(sad)*<br><code>m017_mid1_01</code> |
| 0:10 | Aleeya rides `keke_aleeya` to `finish_line`. | — |
| 0:10 | — | **Aleeya:** “Sorry! I'd stop, but I've only just got it going!” *(warm)*<br><code>m017_mid1_02</code> |
| 0:14 | **CUT** — POV, `PLAYER` → `finish_line` (5.0s). | — |
| 0:19 | **RETURN TO PLAYER** — blend 0.5s. | — |

**End state:** Flags: `basit_wheel_off`=true · The Fresher: at `last_bend`

### Closing — `cut_m017_close`

**Type:** `full` · **Max duration:** 36s · **Skippable:** yes · **Play once:** yes  
**First frame:** `park_shade` → Emeka  
**Cast:** `PLAYER` → The Fresher (`player`) · `LULA` → Lula (`npc.lula`) · `FATY` → Faty (`npc.faty`) · `EMEKA` → Emeka (`npc.emeka`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — MEDIUM, `park_shade` → Emeka (6.0s). | — |
| 0:01 | Prop `prop.gold_exhaust` appears at `podium`. | — |
| 0:02 | — | **Emeka:** “The gold exhaust! Don't ask what it came off.” *(proud)*<br><code>m017_close_01</code> |
| 0:06 | **CUT** — CLOSE, `park_bench` → Faty (28.0s). | — |
| 0:07 | Prop `prop.joke_book` appears at Faty. | — |
| 0:08 | Faty writes. | — |
| 0:10 | — | **Faty:** “Page twelve. That's you. One joke a year.” *(amused)*<br><code>m017_close_02</code> |
| 0:15 | — | **Faty:** “The first eight are my mother's.” *(dry)*<br><code>m017_close_03</code> |
| 0:18 | — | **The Fresher:** “And nine?” *(neutral)*<br><code>m017_close_p01</code> |
| 0:20 | Faty looks at Lula. | — |
| 0:22 | — | **Lula:** “Only one person ever laughed at page nine.” *(neutral)*<br><code>m017_close_04</code> |
| 0:26 | — | **Faty:** “And you wouldn't believe who.” *(whisper)*<br><code>m017_close_05</code> |
| 0:30 | — | **SFX** — `rubber_band_snap`. |
| 0:33 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m017_done`=true, `page_nine_hint`=true, `driving_jobs`=true · The Fresher: at `park_bench`; items `keke_licence` 1

### Conditional special dialogue

> **Do not record or stage these in the canon pass.** They exist only when the named real-person flag is enabled, and must be cut cleanly when it is off. They are never romance content, never marketing, and never in a non-conditional cutscene.

**Jiya** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m017_play_j01` | “Hello. Sorry. I'm not in this argument, I'm just between it.” | — |
| `m017_play_j02` | “Examiner! Which section says passengers must agree with each other?” | — |
| `m017_play_j03` | “He stopped for the goat. That's an emergency stop. Tick the box, there's a good man.” | — |
| `m017_play_j04` | “'Left, emotionally.' I'm having that. That's going in a contract.” | to Lula |
| `m017_play_j05` | “Right. That's a pass. I'd appeal a fail, and I'd enjoy it.” | — |

**Staging and `[ELSE]` from `Y1.md`:**

> - **[IF special.jiya]** She is the third passenger, squashed between the Ajakas, there for the lift. When the examiner, on foot, tries to fail you for "carrying an unauthorised debate", she leans out and argues the pass through the window at eight miles an hour; the licence fee is waived (Legal Immunity). Lines: `m017_play_j01` "Hello. Sorry. I'm not in this argument, I'm just between it." · `m017_play_j02` "Examiner! Which section says passengers must agree with each other?" · `m017_play_j03` "He stopped for the goat. That's an emergency stop. Tick the box, there's a good man." · `m017_play_j04` (to Lula) "'Left, emotionally.' I'm having that. That's going in a contract." · `m017_play_j05` "Right. That's a pass. I'd appeal a fail, and I'd enjoy it."
> - **[ELSE]** The examiner passes you on the manoeuvres alone, as written; you pay the ₦500 licence fee.

## M018 · Radio Silence

**When:** Y1 · S2 Wk 6 · Wed · 18:00–midnight.  
**Where:** arts: Ring Road FM studio, the mast.  
**Who:** Bature, Firdausi, DJ Kabiru, Lyzzy, Wednesday, Dr. Zainab (voice).  
**Mystery:** plants C-AWAY (the first long absence: two days, and worse blackouts), C-BROADCAST (it is older than the station), C-CATS (facing inward).  
**Connects to:** M3 (the three notes and the count, on {{ROOMIE}}'s radio); M9 ("Dr. Z" is a voice you know); M12 (the Maker outside his garden); M5 ("See you Wednesday").

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Walk Bature to the radio station` · `loc.arts.radio` via `loc.eng.garden` · completeWhen: `escort(npc.bature, loc.arts.radio)` · fail: none
2. `Wait in the studio` · `loc.arts.radio` · completeWhen: `cutscene.end(cut_m018_open)`
3. `Crank the dynamo on the roof` · `loc.arts.mast` · completeWhen: `minigame.pass(rhythm, crank, 60 s)` · fail: `needle drops → dead air; resume from half`
4. `Read one news item` · `loc.arts.radio` · completeWhen: `minigame.pass(rhythm, read_aloud)` · fail: `stumble → Bature covers with a joke; no penalty`
5. `Play the one unscratched record` · completeWhen: `use(item.record_highlife)` · fail: none
6. `Hold the signal until the light returns` · `loc.arts.mast` · completeWhen: `time(18:06)` → `cutscene.end(cut_m018_close)`

### Opening — `cut_m018_open`

**Type:** `entry` · **Max duration:** 40s · **Skippable:** yes · **Play once:** yes  
**First frame:** `garden_fence_east` → The Cats  
**Cast:** `PLAYER` → The Fresher (`player`) · `BATURE` → Bature (`npc.bature`) · `KABIRU` → DJ Kabiru (`npc.kabiru`) · `WEDNESDAY` → Wednesday (`npc.wednesday`) · `ZAINAB` → Dr. Zainab (`npc.zainab`) · `CATS` → The Cats (`prop.cats_ring`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `dusk`.<br>**CUT** — WIDE, `garden_fence_east` → The Cats (6.0s). | — |
| 0:01 | Prop `prop.cats_ring_inward` appears at `coil_plinth`. | — |
| 0:01 | — | **SFX** — `coil_hum_thin`. |
| 0:06 | **CUT** — MEDIUM, `radio_stairs` → Wednesday (8.0s). | — |
| 0:07 | — | **Wednesday:** “See you Wednesday.” *(neutral)*<br><code>m018_open_01</code> |
| 0:09 | — | **The Fresher:** “It IS Wednesday.” *(dry)*<br><code>m018_open_p01</code> |
| 0:11 | — | **Wednesday:** “I know.” *(warm)*<br><code>m018_open_02</code> |
| 0:14 | **CUT** — MEDIUM, `studio_glass` → DJ Kabiru (24.0s). | — |
| 0:15 | Prop `prop.on_air_sign_lit` appears at `studio_door`. | — |
| 0:16 | — | **Dr. Zainab:** “Caller. Energy drink is not breakfast.” *(sharp)*<br><code>m018_open_03</code> |
| 0:20 | — | **SFX** — `can_open_phone`. |
| 0:21 | — | **Dr. Zainab:** “Caller. CALLER. I can hear you opening one.” *(sharp)*<br><code>m018_open_04</code> |
| 0:25 | — | **Bature:** “I ironed a shirt. For radio. Is that normal?” *(scared)*<br><code>m018_open_05</code> |
| 0:30 | — | **DJ Kabiru:** “Nothing here is normal. You're on at six.” *(warm)*<br><code>m018_open_06</code> |
| 0:34 | — | **SFX** — `power_down_whine`. |
| 0:34 | **LIGHT** — `blackout`. | — |
| 0:35 | Prop `prop.on_air_sign_lit` is removed. | — |
| 0:37 | — | **DJ Kabiru:** “Mast room. Hand crank. Somebody young.” *(stern)*<br><code>m018_open_07</code> |

**End state:** Flags: `m018_started`=true, `maker_away`=true, `met_kabiru`=true · The Fresher: at `studio_door`

### Mid-scene 1 — `cut_m018_mid_1`

**Type:** `full` · **Max duration:** 30s · **Skippable:** yes · **Play once:** yes  
**First frame:** `studio_desk` → Bature  
**Cast:** `PLAYER` → The Fresher (`player`) · `BATURE` → Bature (`npc.bature`) · `LYZZY` → Lyzzy (`npc.lyzzy`) · `ZAINAB` → Dr. Zainab (`npc.zainab`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `torch`.<br>**CUT** — CLOSE, `studio_desk` → Bature (14.0s). | — |
| 0:01 | Prop `prop.phone_news` appears at Bature. | — |
| 0:02 | — | **Bature:** “Good… good evening. This is, um. The news.” *(scared)*<br><code>m018_mid1_01</code> |
| 0:07 | — | **Lyzzy:** “(Breathe! Your voice is a moment!)” *(whisper)*<br><code>m018_mid1_02</code> |
| 0:10 | — | **Bature:** “Riddle: what goes off without warning? Our light.” *(amused)*<br><code>m018_mid1_03</code> |
| 0:14 | **CUT** — CLOSE, `studio_phone_bank` → `prop.phone_lines_lit` (4.0s). | — |
| 0:18 | **CUT** — MEDIUM, `studio_desk` → The Fresher (10.0s). | — |
| 0:19 | — | **The Fresher:** “And now the weather. Dust.” *(neutral)*<br><code>m018_mid1_p01</code> |
| 0:22 | — | **Dr. Zainab:** “Excuse me. Is that my PATIENT reading the news?” *(sharp)*<br><code>m018_mid1_04</code> |
| 0:27 | The Fresher freezes in shock. | — |
| 0:29 | **RETURN TO PLAYER** — blend 0.8s. | — |

**End state:** Flags: `dr_z_is_zainab`=true · The Fresher: at `studio_desk`

### Closing — `cut_m018_close`

**Type:** `full` · **Max duration:** 38s · **Skippable:** yes · **Play once:** yes  
**First frame:** `studio_wall` → `prop.studio_clock_1806`  
**Cast:** `PLAYER` → The Fresher (`player`) · `BATURE` → Bature (`npc.bature`) · `KABIRU` → DJ Kabiru (`npc.kabiru`) · `RADIO` → Radio (old transmitter) (`prop.old_transmitter`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — CLOSE, `studio_wall` → `prop.studio_clock_1806` (3.0s). | — |
| 0:03 | **CUT** — MEDIUM, `studio_corner` → Radio (old transmitter) (11.0s). | **MUSIC** — `mystery_thread`.<br>**SFX** — `three_notes`. |
| 0:07 | — | **Radio (old transmitter):** “Seven. Six. Five. Four. Three. Two. One.” *(amused)*<br><code>m018_close_01</code> |
| 0:14 | DJ Kabiru runs to `studio_desk`. | — |
| 0:15 | — | **SFX** — `fader_slam`. |
| 0:16 | **CUT** — CLOSE, `studio_desk` → DJ Kabiru (18.0s). | — |
| 0:17 | — | **The Fresher:** “Who is she?” *(whisper)*<br><code>m018_close_p01</code> |
| 0:20 | — | **DJ Kabiru:** “That voice was here before this station was built.” *(whisper)*<br><code>m018_close_02</code> |
| 0:25 | — | **DJ Kabiru:** “We don't talk about it on air.” *(stern)*<br><code>m018_close_03</code> |
| 0:29 | — | **DJ Kabiru:** “…You've got the job, by the way. Both of you.” *(warm)*<br><code>m018_close_04</code> |
| 0:34 | — | **MUSIC OUT** — `mystery_thread`. |
| 0:34 | **LIGHT** — `night`. | — |
| 0:35 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m018_done`=true, `radio_job`=true, `broadcast_older_than_station`=true, `bature_show`=true · The Fresher: at `studio_desk`

### Conditional special dialogue

> **Do not record or stage these in the canon pass.** They exist only when the named real-person flag is enabled, and must be cut cleanly when it is off. They are never romance content, never marketing, and never in a non-conditional cutscene.

**Madison** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m018_play_d01` | “Hello hello hello, am I on? Okay. Play something with a beat, I have a trend to launch.” | — |

**Staging.** `Y1.md` carries this as an inline aside in the mission story rather than a block. Use the mission text for blocking and keep the line optional.

## M019 · The Vice-Chancellor's Cup

**When:** Y1 · S2 Wk 8 · Sat (event: inter-faculty final) · 16:00.  
**Where:** sports: stadium.  
**Who:** Jega, Coach Danladi, Helen, Shamsu, Bolaji, Nusaiba, Dr. Zainab, Muhammad. **(switch: you and Jega)**  
**Special helpers (conditional):** Jiya, Taty.  
**Mystery:** plants MS-06 (a twelfth pair of shoes in the team photograph). Otherwise a pure sports mission.  
**Connects to:** M8 (the trial, the bib, "we have a cup to win"); M9 (the eyebrow scar; Zainab comes "for medical reasons").

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Collect the deans' consent from Nusaiba` · `loc.sports.stadium_gate` · completeWhen: `talk(npc.nusaiba)` → `collect(item.rule_14c, 1)`
2. `Warm up` · `loc.sports.stadium` · completeWhen: `minigame.pass(run_lap)`
3. `First half (you)` · completeWhen: `minigame.pass(football.match, 45)` · fail: none (score recorded)
4. `Second half: switch to Jega to finish` · completeWhen: `switch(jega)` → `minigame.pass(football.shoot, header)` → `switch(player)`
5. `Penalties: take yours` · completeWhen: `minigame.pass(football.shoot, penalty)` · fail: `miss → the shoot-out goes one round longer; same ending`
6. `Watch Jega's penalty` · completeWhen: `cutscene.end(cut_m019_mid_1)`
7. `Sit with him` · `loc.sports.pitch_centre` · completeWhen: `cutscene.end(cut_m019_close)`

### Opening — `cut_m019_open`

**Type:** `event` · **Max duration:** 36s · **Skippable:** yes · **Play once:** yes  
**First frame:** `stadium_roof` → `pitch_centre`  
**Cast:** `PLAYER` → The Fresher (`player`) · `JEGA` → Jega (`npc.jega`) · `NUSAIBA` → Nusaiba (`npc.nusaiba`) · `COACH` → Coach Danladi (`npc.danladi`) · `CROWD` → Fans (crowd) (`crowd.fans`) · `JIYA?` → Jiya (`special.jiya`) — `CONDITIONAL`

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CALENDAR CARD** — “Sat · Week 8 · The Vice-Chancellor's Cup Final”.<br>**MOVE** — WIDE, `stadium_roof` → `pitch_centre` (6.0s). | — |
| 0:01 | — | **MUSIC** — `stadium_drums` (ducked under dialogue). |
| 0:06 | **CUT** — MEDIUM, `tunnel_mouth` → Nusaiba (8.0s). | — |
| 0:07 | — | **Nusaiba:** “Rule 14(c). I have three points and two deans.” *(proud)*<br><code>m019_open_01</code> |
| 0:15 | **CUT** — CLOSE, `tunnel_bench` → Jega (14.0s). | — |
| 0:15 | Prop `prop.lucky_socks` appears at Jega. | — |
| 0:16 | — | **Jega:** “My mother's socks. Don't laugh.” *(shy)*<br><code>m019_open_02</code> |
| 0:20 | — | **Jega:** “…You can laugh small.” *(amused)*<br><code>m019_open_03</code> |
| 0:23 | — | **Coach Danladi:** “Out! Out! The grass is not coming to you!” *(stern)*<br><code>m019_open_04</code> |
| 0:27 | — | **Jega:** “Takalmin hagu tukuna. Mu je!” *(excited)*<br><code>m019_open_05</code> |
| 0:30 | Jega runs to `pitch_centre`. | — |
| 0:31 | Fans (crowd) cheers. | — |
| 0:34 | **RETURN TO PLAYER** — blend 1.0s. | — |

**Conditional insert — `special.jiya`**

> Plays only when the named real-person flag is on. If it is off, cut these rows; the surrounding scene, camera and timing continue without them. This insert is never part of the canon pass and never a romance beat.

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:11 | — | **Jiya:** “It says 'a guest'. Not 'a good one'. No offence.” *(dry)*<br><code>m019_open_j01</code> |

**End state:** Flags: `m019_started`=true · The Fresher: at `pitch_midfield`

### Mid-scene 1 — `cut_m019_mid_1`

**Type:** `event` · **Max duration:** 38s · **Skippable:** yes · **Play once:** yes  
**First frame:** `touchline_low` → Small Boy  
**Cast:** `PLAYER` → The Fresher (`player`) · `JEGA` → Jega (`npc.jega`) · `SHAMSU` → Shamsu (`npc.shamsu`) · `BOY` → Small Boy (`npc.small_boy`) · `CROWD` → Fans (crowd) (`crowd.fans`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — MEDIUM, `touchline_low` → Small Boy (5.0s). | **MUSIC OUT** — `stadium_drums`. |
| 0:01 | — | **Small Boy:** “Jega! Show us!” *(excited)*<br><code>m019_mid1_01</code> |
| 0:05 | **CUT** — CLOSE, `penalty_spot_low` → Jega (12.0s). | — |
| 0:06 | Jega laughs. | — |
| 0:07 | Jega kneels. | — |
| 0:09 | Prop `prop.right_boot_first` appears at Jega. | — |
| 0:13 | Jega stands. | — |
| 0:15 | Jega freezes in shock. | — |
| 0:17 | **CUT** — WIDE, `behind_goal` → Jega (7.0s). | — |
| 0:19 | Jega runs to `penalty_spot`. | — |
| 0:21 | — | **SFX** — `crossbar_bell`. |
| 0:21 | **CAMERA SHAKE** — amount 0.2, 0.4s. | — |
| 0:24 | **CUT** — MEDIUM, `goal_line` → Shamsu (5.0s). | — |
| 0:25 | — | **Shamsu:** “Technically… we have won? I'm sorry. We've won.” *(shy)*<br><code>m019_mid1_02</code> |
| 0:29 | **FOLLOW** — MEDIUM on Jega (8.0s). | — |
| 0:30 | Jega walks to `eng_team_line`. | — |
| 0:31 | Jega gestures. | — |
| 0:37 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `cup_lost_y1`=true · The Fresher: at `pitch_centre`

### Closing — `cut_m019_close`

**Type:** `full` · **Max duration:** 36s · **Skippable:** yes · **Play once:** yes  
**First frame:** `touchline_low` → Jega  
**Cast:** `PLAYER` → The Fresher (`player`) · `JEGA` → Jega (`npc.jega`) · `BOY` → Small Boy (`npc.small_boy`) · `ZAINAB` → Dr. Zainab (`npc.zainab`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `dusk`.<br>**CUT** — MEDIUM, `touchline_low` → Jega (7.0s). | — |
| 0:01 | Prop `prop.armband` appears at Small Boy. | — |
| 0:02 | — | **Jega:** “Next year you will see it. Wallahi.” *(warm)*<br><code>m019_close_01</code> |
| 0:07 | **CUT** — MEDIUM, `stand_row` → Dr. Zainab (4.0s). | — |
| 0:08 | Dr. Zainab cheers. | — |
| 0:11 | **CUT** — WIDE, `centre_circle_low` → Jega (14.0s). | — |
| 0:12 | Jega sits. | — |
| 0:12 | The Fresher sits. | — |
| 0:14 | — | **Jega:** “Right boot first. Once. For a child. Kai.” *(sad)*<br><code>m019_close_02</code> |
| 0:19 | Jega laughs. | — |
| 0:21 | — | **Jega:** “Mu sake. (We go again.) Next year.” *(warm)*<br><code>m019_close_03</code> |
| 0:25 | **CUT** — CLOSE, `PLAYER` → `prop.team_photo` (9.0s). | **MUSIC** — `mystery_thread`. |
| 0:26 | Prop `prop.team_photo_twelfth_shoes` appears at The Fresher. | — |
| 0:34 | — | **MUSIC OUT** — `mystery_thread`. |

**End state:** Flags: `m019_done`=true, `ms_06`=true · The Fresher: at `centre_circle`; items `runners_up_medal` 1, `team_photo_y1` 1

### Conditional special dialogue

> **Do not record or stage these in the canon pass.** They exist only when the named real-person flag is enabled, and must be cut cleanly when it is off. They are never romance content, never marketing, and never in a non-conditional cutscene.

**Jiya** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m019_play_j01` | “Rule 14(c). 'With the written consent of both deans.' Here are both deans. In writing.” | — |
| `m019_play_j02` | “It says 'a guest'. It doesn't say 'a good one'. No offence, mate.” | — |
| `m019_play_j03` | “Oh, don't change the boots. Don't. …He's changed the boots.” | at the penalty |

**Taty** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m019_play_t01` | “Drink. Breathe. You have forty-five more. Bora!” | — |
| `m019_play_t02` | “Jega! Left boot! I'm not superstitious but LEFT BOOT!” | — |
| `m019_play_t03` | “You lost. So what. You ran. Come here. Hug. Now we train.” | — |

**Staging and `[ELSE]` from `Y1.md`:**

> - **[IF special.jiya]** She found Rule 14(c) with Nusaiba (they have become a small terrifying committee) and deals with the referee's objection at kick-off (step 1 needs no dean-chasing). Lines: `m019_play_j01` "Rule 14(c). 'With the written consent of both deans.' Here are both deans. In writing." · `m019_play_j02` "It says 'a guest'. It doesn't say 'a good one'. No offence, mate." · `m019_play_j03` (at the penalty) "Oh, don't change the boots. Don't. …He's changed the boots."
> - **[IF special.taty]** She is Education's volunteer fitness coach: your stamina refills fully at half-time, and she runs the water on. Lines: `m019_play_t01` "Drink. Breathe. You have forty-five more. Bora!" · `m019_play_t02` "Jega! Left boot! I'm not superstitious but LEFT BOOT!" · `m019_play_t03` "You lost. So what. You ran. Come here. Hug. Now we train."
> - **[ELSE]** Nusaiba faces the referee alone with the rule book (one extra dialogue); your stamina refills by half at half-time; a ball boy runs the water.

## M020 · Six Plaques

**When:** Y1 · S2 Wk 9 · Tue · 16:00–20:00.  
**Where:** envd: Sculpture Garden; eng: garden.  
**Who:** Kelechi, Tunde, Lily, Lyzzy, the Maker, Tanko, Dr. Okonkwo.  
**Mystery:** pays the riddle (six legs that cannot stand: the ring); plants C-SEALS (ten empty sockets), C-SEVENTH (a space with no plaque), the six sites on the map as question marks, C-STATUE (she is the only statue that points nowhere on the ring).  
**Connects to:** M5 (page forty's six circles); M6 (the statue; Tanko's riddle, answered here); M16 (the relay core fits); M18 (he is back from wherever he was, and says nothing).

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Stand where the statues stand (6)` · `loc.envd.sculpture_garden` · completeWhen: `photo(gaze_1..6)` · fail: none
2. `Walk each sight line with the compass` · garden → `loc.eng.garden_fence` · completeWhen: `minigame.pass(search, compass_line)` ×6 · fail: `off the bearing → Lily tugs the twine`
3. `Try the seventh statue` · `loc.envd.sculpture_garden_pond` · completeWhen: `photo(gaze_7)` → twine runs out
4. `Show the Maker the relay core` · `loc.eng.garden_gate` · completeWhen: `deliver(item.relay_core, npc.maker)`
5. `Fit the core` · `loc.eng.garden` · completeWhen: `use(item.relay_core)` at `coil_socket`
6. `Read the six plaques` · completeWhen: `cutscene.end(cut_m020_close)` (six map markers added)

### Opening — `cut_m020_open`

**Type:** `entry` · **Max duration:** 32s · **Skippable:** yes · **Play once:** yes  
**First frame:** `sculpture_gate_arch` → `sculpture_lawn`  
**Cast:** `PLAYER` → The Fresher (`player`) · `KELECHI` → Kelechi (`npc.kelechi`) · `LYZZY` → Lyzzy (`npc.lyzzy`) · `LILY` → Lily (`npc.lily`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **MOVE** — WIDE, `sculpture_gate_arch` → `sculpture_lawn` (6.0s). | — |
| 0:06 | **CUT** — MEDIUM, `drummer_statue_side` → Kelechi (14.0s). | — |
| 0:07 | Kelechi gestures. | — |
| 0:08 | — | **Kelechi:** “Stand where she's standing. Head like hers.” *(warm)*<br><code>m020_open_01</code> |
| 0:12 | The Fresher walks to `drummer_statue_mark`. | — |
| 0:14 | — | **Kelechi:** “What do you see?” *(neutral)*<br><code>m020_open_02</code> |
| 0:16 | **CUT** — POV, `PLAYER` → `mall_roof_far` (4.0s). | — |
| 0:20 | **CUT** — MEDIUM, `sculpture_bench` → Lyzzy (10.0s). | — |
| 0:21 | — | **Lyzzy:** “He's looking at her. She's looking at the Senate.” *(amused)*<br><code>m020_open_03</code> |
| 0:25 | — | **Lyzzy:** “Typical.” *(dry)*<br><code>m020_open_04</code> |
| 0:27 | — | **Lily:** “…I have twine.” *(shy)*<br><code>m020_open_05</code> |
| 0:30 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m020_started`=true, `met_kelechi`=true · The Fresher: at `drummer_statue_mark`; items `compass` 1

### Mid-scene 1 — `cut_m020_mid_1`

**Type:** `full` · **Max duration:** 30s · **Skippable:** yes · **Play once:** yes  
**First frame:** `garden_over` → `prop.twine_web`  
**Cast:** `PLAYER` → The Fresher (`player`) · `MAKER` → The Maker (`npc.maker`) · `KELECHI` → Kelechi (`npc.kelechi`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **MOVE** — TOP, `garden_over` → `prop.twine_web` (7.0s). | — |
| 0:07 | **CUT** — MEDIUM, `sculpture_pond_bank` → Kelechi (9.0s). | — |
| 0:08 | — | **Kelechi:** “She's by a different hand. Look at the chisel.” *(neutral)*<br><code>m020_mid1_01</code> |
| 0:12 | — | **Kelechi:** “Somebody who loved her made that one.” *(warm)*<br><code>m020_mid1_02</code> |
| 0:16 | **CUT** — CLOSE, `garden_gate_post` → The Maker (12.0s). | — |
| 0:17 | Prop `prop.relay_core` appears at The Fresher. | — |
| 0:18 | The Maker looks at `prop.relay_core`. | — |
| 0:21 | — | **The Maker:** “You went down for that.” *(neutral)*<br><code>m020_mid1_03</code> |
| 0:24 | — | **SFX** — `gate_latch_old`. |
| 0:25 | The Maker gestures. | — |
| 0:28 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `garden_gate_open`=true · The Fresher: at `garden_gate_inside`

### Closing — `cut_m020_close`

**Type:** `full` · **Max duration:** 40s · **Skippable:** yes · **Play once:** yes  
**First frame:** `plinth_orbit` → `prop.plaques_six`  
**Cast:** `PLAYER` → The Fresher (`player`) · `MAKER` → The Maker (`npc.maker`) · `OKONKWO` → Dr. Okonkwo (`npc.okonkwo`) · `TANKO` → Tanko (`npc.tanko`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `coil_glow`. | **SFX** — `core_click`. |
| 0:01 | **VFX** — `plaques_light_six` at `coil_plinth`. | — |
| 0:01 | **MOVE** — CLOSE, `plinth_orbit` → `prop.plaques_six` (9.0s). | — |
| 0:10 | **CUT** — MEDIUM, `garden_gate_post` → Dr. Okonkwo (6.0s). | — |
| 0:11 | — | **Dr. Okonkwo:** “Six sites. One ring. We have one.” *(stern)*<br><code>m020_close_01</code> |
| 0:16 | **MOVE** — CLOSE, `plinth_rim` → `prop.sockets_ten` (6.0s). | **MUSIC** — `mystery_thread`. |
| 0:22 | **CUT** — CLOSE, `plinth_north` → `prop.seventh_space` (6.0s). | — |
| 0:24 | The Maker looks at `prop.seventh_space`. | — |
| 0:26 | The Maker looks at The Fresher. | — |
| 0:28 | **CUT** — MEDIUM, `garden_gate_low` → Tanko (11.0s). | — |
| 0:29 | — | **Tanko:** “Six legs and cannot stand. You have your answer.” *(neutral)*<br><code>m020_close_02</code> |
| 0:34 | — | **Tanko:** “Now: what has ten mouths and was never fed?” *(dry)*<br><code>m020_close_03</code> |
| 0:39 | — | **MUSIC OUT** — `mystery_thread`. |

**End state:** Flags: `m020_done`=true, `plaques_six`=true, `sockets_ten_seen`=true, `seventh_space_seen`=true, `riddle_ten_mouths`=true, `six_sites_on_map`=true · The Fresher: at `coil_plinth`

### Conditional special dialogue

> **Do not record or stage these in the canon pass.** They exist only when the named real-person flag is enabled, and must be cut cleanly when it is off. They are never romance content, never marketing, and never in a non-conditional cutscene.

**Taty** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m020_play_t01` | “Pixel! That's evidence! …Okay it's string. But it's important string.” | — |

**Staging.** `Y1.md` carries this as an inline aside in the mission story rather than a block. Use the mission text for blocking and keep the line optional.

## M021 · Wingman

**When:** Y1 · S2 Wk 10 · Sat (weekend) · 15:00–21:00.  
**Where:** student: Love Garden, Cinema Hall, the Spot; market: Clemantine's.  
**Who:** Jega, Helen, Clemantine, your chosen interest or {{ROOMIE}}.  
**Mystery:** deepens C-IDK only (she started the "IDK" joke herself). A light mission between two heavy ones.  
**Connects to:** M8 ("Ban sani ba"); M19 (he lost the final and she stayed to the end; that is why he has the courage, barely).

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Find Jega behind the tree` · `loc.hostel.kadanya_gate` · completeWhen: `talk(npc.jega)`
2. `Find out what Helen likes` *(optional, and it matters)* · `loc.sports.volleyball` or `loc.life.labs` · completeWhen: `talk(npc.firdausi)` → `flag(listened_helen)`
3. `Buy a gift` · `loc.market.clemantine` or `loc.market.corn_seller` · completeWhen: `collect(item.gift_any, 1)`
4. `Carry Jega's message` · `loc.sports.volleyball` · completeWhen: `deliver(item.gift_any, npc.helen)` → `cutscene.end(cut_m021_mid_1)`
5. `Ask someone to the cinema yourself` · anywhere · completeWhen: `choice(m021_invite)` (an interest, or {{ROOMIE}})
6. `Watch the film` · `loc.student.cinema` at 18:00 · completeWhen: `cutscene.end(cut_m021_close)`

### Opening — `cut_m021_open`

**Type:** `full` · **Max duration:** 38s · **Skippable:** yes · **Play once:** yes  
**First frame:** `kadanya_gate_path` → `prop.neem_thin`  
**Cast:** `PLAYER` → The Fresher (`player`) · `JEGA` → Jega (`npc.jega`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — WIDE, `kadanya_gate_path` → `prop.neem_thin` (5.0s). | — |
| 0:01 | Jega is revealed. | — |
| 0:02 | Jega waves. | — |
| 0:05 | **CUT** — MEDIUM, `neem_side` → Jega (30.0s). | — |
| 0:06 | — | **Jega:** “Kai. Come. I have a tactical problem.” *(whisper)*<br><code>m021_open_01</code> |
| 0:10 | — | **The Fresher:** “Just say her name.” *(dry)*<br><code>m021_open_p01</code> |
| 0:12 | — | **Jega:** “Ban sani ba. (I don't know.) Officially.” *(proud)*<br><code>m021_open_02</code> |
| 0:17 | — | **Jega:** “Let me practise. Sannu… no. Hello… no.” *(scared)*<br><code>m021_open_03</code> |
| 0:22 | — | **Jega:** “Kai! …No. She is not a goalkeeper.” *(sad)*<br><code>m021_open_04</code> |
| 0:26 | — | **Jega:** “You go. You chased a goat. You fear nothing.” *(warm)*<br><code>m021_open_05</code> |
| 0:31 | Jega gestures. | — |
| 0:35 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m021_started`=true · The Fresher: at `neem_side`

### Mid-scene 1 — `cut_m021_mid_1`

**Type:** `full` · **Max duration:** 38s · **Skippable:** yes · **Play once:** yes  
**First frame:** `volleyball_net_post` → Helen  
**Cast:** `PLAYER` → The Fresher (`player`) · `HELEN` → Helen (`npc.helen`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — MEDIUM, `volleyball_net_post` → Helen (34.0s). | — |
| 0:01 | Helen stands. | — |
| 0:02 | — | **Helen:** “Who's asking?” *(amused)*<br><code>m021_mid1_01</code> |
| 0:04 | — | **The Fresher:** “A friend. Tall. Behind a tree.” *(neutral)*<br><code>m021_mid1_p01</code> |
| 0:08 | — | **Helen:** “Does he think I can't see him? The tree is thin.” *(dry)*<br><code>m021_mid1_02</code> |
| 0:13 | — | **Helen** — **TOKEN:** `[GIFT_LINE: corn or flowers]` *(amused)*<br><code>m021_mid1_03</code> |
| 0:18 | — | **Helen:** “'IDK' was my idea. After the trials. My whole team says it.” *(warm)*<br><code>m021_mid1_04</code> |
| 0:24 | — | **Helen:** “I'm waiting to see how long he carries it.” *(amused)*<br><code>m021_mid1_05</code> |
| 0:28 | — | **Helen:** “Tell him six o'clock. And I know my own name.” *(warm)*<br><code>m021_mid1_06</code> |
| 0:34 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `helen_yes`=true, `idk_her_joke`=true · The Fresher: at `volleyball_court`

### Closing — `cut_m021_close`

**Type:** `full` · **Max duration:** 30s · **Skippable:** yes · **Play once:** yes  
**First frame:** `cinema_back_row` → `cinema_screen`  
**Cast:** `PLAYER` → The Fresher (`player`) · `COMPANION` → The Companion (`npc.partner_or_roomie`) · `JEGA` → Jega (`npc.jega`) · `HELEN` → Helen (`npc.helen`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `night`.<br>**CUT** — WIDE, `cinema_back_row` → `cinema_screen` (6.0s). | — |
| 0:01 | — | **SFX** — `projector_whirr`. |
| 0:06 | **CUT** — MEDIUM, `cinema_aisle` → The Companion (10.0s). | — |
| 0:07 | The Fresher sits. | — |
| 0:08 | — | **The Companion** — **TOKEN:** `[COMPANION_LINE: by who came]` *(warm)*<br><code>m021_close_01</code> |
| 0:16 | **CUT** — MEDIUM, `cinema_row_behind` → Jega (10.0s). | — |
| 0:17 | Jega sits. | — |
| 0:19 | Helen looks at Jega. | — |
| 0:21 | — | **Jega:** “(…Is it going well? I can't tell.)” *(whisper)*<br><code>m021_close_02</code> |
| 0:25 | — | **Helen:** “(It's going well. Watch the film.)” *(whisper)*<br><code>m021_close_03</code> |
| 0:28 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m021_done`=true, `gifts_unlocked`=true, `cinema_unlocked`=true · The Fresher: at `cinema_seat`

### Conditional special dialogue

> **Do not record or stage these in the canon pass.** They exist only when the named real-person flag is enabled, and must be cut cleanly when it is off. They are never romance content, never marketing, and never in a non-conditional cutscene.

**Madison** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m021_play_d01` | “Aiya! Flowers for an athlete? She'll use them as a towel.” | — |
| `m021_play_d02` | “Ask her friend. Always ask the friend. The friend is the search engine.” | — |
| `m021_play_d03` | “Corn. Hot. Trust me. Jiayou!” | — |

**Staging and `[ELSE]` from `Y1.md`:**

> - **[IF special.madison]** She is at Clemantine's buying nothing and has opinions; if you have not done step 2, she stops you buying flowers ("Who told you flowers? Nobody told you. You guessed.") and points you to the corn seller, so the "listened" result is rescued. Lines: `m021_play_d01` "Aiya! Flowers for an athlete? She'll use them as a towel." · `m021_play_d02` "Ask her friend. Always ask the friend. The friend is the search engine." · `m021_play_d03` "Corn. Hot. Trust me. Jiayou!"
> - **[ELSE]** Nobody rescues you; flowers get the "different girl" line, and the date still happens.

## M022 · Everybody

**When:** Y1 · S2 Wk 12 · Mon–Fri · any hour; each person is where the timetable puts them.  
**Where:** the whole campus.  
**Who:** everyone you have met; the Maker; Baba Porter.  
**Mystery:** plants C-NOTE (Baba Porter: "thirty years"), C-AWAY (the Maker is counting days); Malam Garba's ledger (your name is already in a column you cannot read the heading of).  
**Connects to:** every mission from M1 to M21: each "yes" is a callback to what you did for that person.

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Go to the garden; the gate is open` · `loc.eng.garden` · completeWhen: `cutscene.end(cut_m022_open)`
2. `Ask your friends (at least 12 of 20)` · campus-wide · completeWhen: `talk(npc.*)` ×12 with `flag(everybody_<id>)`; each is available only in their timetable window (shown on the phone) · fail: `missed window → try the next day`
3. `Catch Dr. Zainab at shift change` · `loc.med.corridor` 19:00–19:11 · completeWhen: `talk(npc.zainab)` · fail: `late → "Tomorrow. Same eleven minutes."`
4. `Accept three refusals` · completeWhen: `talk(npc.khadija)`, `talk(npc.idris)`, `talk(npc.lawal)`
5. `Get Malam Garba's "Hm."` · `loc.admin.senate_basement` · completeWhen: `talk(npc.garba)`
6. `Ask Baba Porter` · `loc.hostel.lodge` · completeWhen: `cutscene.end(cut_m022_close)`

### Opening — `cut_m022_open`

**Type:** `full` · **Max duration:** 40s · **Skippable:** yes · **Play once:** yes  
**First frame:** `garden_gate_post` → `prop.garden_gate_ajar`  
**Cast:** `PLAYER` → The Fresher (`player`) · `MAKER` → The Maker (`npc.maker`) · `ROOMIE` → The Roommate (`npc.roomie`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `dusk`.<br>**CUT** — MEDIUM, `garden_gate_post` → `prop.garden_gate_ajar` (4.0s). | — |
| 0:04 | **CUT** — CLOSE, `garden_bench_low` → The Maker (26.0s). | — |
| 0:05 | — | **The Maker:** “I have kept one coil lit alone for a long time.” *(neutral)*<br><code>m022_open_01</code> |
| 0:10 | — | **The Maker:** “I begin to suspect I was doing it wrong.” *(dry)*<br><code>m022_open_02</code> |
| 0:14 | — | **The Maker:** “It needs people round it. Not soldiers. Witnesses.” *(neutral)*<br><code>m022_open_03</code> |
| 0:20 | — | **The Maker:** “It was designed for a crowd. I had forgotten.” *(sad)*<br><code>m022_open_04</code> |
| 0:24 | — | **The Maker:** “I do not know many people. You seem to.” *(dry)*<br><code>m022_open_05</code> |
| 0:30 | **CUT** — MEDIUM, `room_table` → The Roommate (8.0s). | — |
| 0:31 | The Roommate writes. | — |
| 0:32 | — | **The Roommate:** “EVERYBODY. Underlined. Twice. Start walking.” *(excited)*<br><code>m022_open_06</code> |
| 0:37 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m022_started`=true · The Fresher: at `room_table`; items `everybody_list` 1

### Closing — `cut_m022_close`

**Type:** `full` · **Max duration:** 34s · **Skippable:** yes · **Play once:** yes  
**First frame:** `lodge_window` → Baba Porter  
**Cast:** `PLAYER` → The Fresher (`player`) · `PORTER` → Baba Porter (`npc.baba_porter`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CUT** — MEDIUM, `lodge_window` → Baba Porter (30.0s). | — |
| 0:01 | Prop `prop.everybody_list` appears at Baba Porter. | — |
| 0:02 | Baba Porter looks at `prop.everybody_list`. | — |
| 0:06 | Baba Porter writes. | — |
| 0:11 | — | **Baba Porter:** “I've been waiting to be asked.” *(neutral)*<br><code>m022_close_01</code> |
| 0:15 | — | **Baba Porter:** “Thirty years.” *(whisper)*<br><code>m022_close_02</code> |
| 0:19 | — | **The Fresher:** “Asked by who?” *(neutral)*<br><code>m022_close_p01</code> |
| 0:21 | Baba Porter looks at `hall_forecourt`. | — |
| 0:22 | — | **Baba Porter:** “YOU! That mattress has a room number! FIND IT!” *(stern)*<br><code>m022_close_03</code> |
| 0:27 | Baba Porter walks to `hall_forecourt`. | — |
| 0:31 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m022_done`=true, `porter_thirty_years`=true, `everybody_ready`=true · The Fresher: at `lodge_window`

### Conditional special dialogue

> **Do not record or stage these in the canon pass.** They exist only when the named real-person flag is enabled, and must be cut cleanly when it is off. They are never romance content, never marketing, and never in a non-conditional cutscene.

**Jiya** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m022_play_j01` | “So you'd like me to stand in a garden at night for reasons you can't legally describe.” | — |
| `m022_play_j02` | “Is there a waiver? There should be a waiver. I'll draft the waiver.” | — |
| `m022_play_j03` | “Fine. I'm in. Mostly to see what it is.” | — |

**Taty** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m022_play_t01` | “Yes. What is it? Doesn't matter. Yes.” | — |
| `m022_play_t02` | “Who's left? Give me the list. I'll run it. You talk, I fetch.” | — |

**Madison** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m022_play_d01` | “No filming? Not even a little? …Okay. Okay! I'll be there. I'll remember it with my EYES. Aiya.” | — |

**Staging and `[ELSE]` from `Y1.md`:**

> - **[IF special.jiya]** She is one of the twenty, and the hardest: she makes you state the request in one sentence without the word "vibes". Lines: `m022_play_j01` "So you'd like me to stand in a garden at night for reasons you can't legally describe." · `m022_play_j02` "Is there a waiver? There should be a waiver. I'll draft the waiver." · `m022_play_j03` "Fine. I'm in. Mostly to see what it is."
> - **[IF special.taty]** She says yes before you finish and offers to fetch three of the others at a run (their windows widen by an hour). Lines: `m022_play_t01` "Yes. What is it? Doesn't matter. Yes." · `m022_play_t02` "Who's left? Give me the list. I'll run it. You talk, I fetch."
> - **[IF special.madison]** She will come if she can film nothing, which she finds harder than the request. Line: `m022_play_d01` "No filming? Not even a little? …Okay. Okay! I'll be there. I'll remember it with my EYES. Aiya."
> - **[ELSE]** The twenty are all core cast; the target stays 12.

## M023 · Exam Fever

**When:** Y1 · S2 Wk 14–15 · exam weeks · days and nights.  
**Where:** lib; exam halls; eng: the campus substation; med.  
**Who:** Shamsu, Nusaiba, Engr. Aliyu, Dr. Zainab, Nurse Hauwa.  
**Mystery:** plants Year 2 (a mall sticker on a Works van; a feeder labelled "2" that is not on Shamsu's diagram); C-KB (batteries dear again this week).  
**Connects to:** M11 (tests; this is the real thing); M9 (the hospital blackout); M12 (exam-week nights); M13 (a resit paper is added if you carried one over).

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Revise in the library` · `loc.lib.main` · completeWhen: `minigame.pass(lecture, revise)` ×2 · fail: none
2. `Sit Paper 1 and Paper 2` · exam halls 08:00 · completeWhen: `minigame.pass(test, exam)` ×2 · fail: `scores recorded; no retry`
3. `Read Zainab's text` · night · completeWhen: `cutscene.end(cut_m023_mid_1)`
4. `Go to the substation with Shamsu` · `loc.eng.substation` · completeWhen: `escort(npc.shamsu, loc.eng.substation)` · fail: `a patrol sees you → hide behind the transformer; resume`
5. `Hold the wards and reading rooms until 04:00` · `loc.eng.substation` · completeWhen: `minigame.pass(switchboard, 3 waves)` · fail: `a line drops → 20 s to restore; Zainab texts "?"`
6. `Hand over to Engr. Aliyu` · completeWhen: `talk(npc.aliyu)`
7. `Sit Paper 3 (and Paper 4 next day)` · completeWhen: `minigame.pass(test, exam)` ×2 → `cutscene.end(cut_m023_close)`

### Opening — `cut_m023_open`

**Type:** `ambient` · **Max duration:** 22s · **Skippable:** yes · **Play once:** yes  
**First frame:** `library_atrium_high` → `reading_desks`  
**Cast:** `PLAYER` → The Fresher (`player`) · `ROOMIE` → The Roommate (`npc.roomie`) · `CROWD` → The Students (`crowd.students`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CALENDAR CARD** — “Week 14 · Exam week”.<br>**MOVE** — WIDE, `library_atrium_high` → `reading_desks` (8.0s). | **MUSIC** — `exam_tension` (ducked under dialogue). |
| 0:08 | **CUT** — MEDIUM, `library_aisle` → `prop.mattress_in_library` (5.0s). | — |
| 0:09 | The Students sleeps. | — |
| 0:13 | **CUT** — MEDIUM, `library_desk` → The Roommate (7.0s). | — |
| 0:14 | — | **The Roommate:** “Riddle: what has four papers and no mercy?” *(scared)*<br><code>m023_open_01</code> |
| 0:18 | — | **The Fresher:** “Read.” *(stern)*<br><code>m023_open_p01</code> |
| 0:20 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m023_started`=true · The Fresher: at `library_desk`

### Mid-scene 1 — `cut_m023_mid_1`

**Type:** `full` · **Max duration:** 30s · **Skippable:** yes · **Play once:** yes  
**First frame:** `PLAYER` → `prop.phone_text`  
**Cast:** `PLAYER` → The Fresher (`player`) · `ZAINAB` → Dr. Zainab (`npc.zainab`) · `SHAMSU` → Shamsu (`npc.shamsu`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `night`. | **SFX** — `phone_buzz_night`. |
| 0:01 | **CUT** — CLOSE, `PLAYER` → `prop.phone_text` (14.0s). | — |
| 0:01 | — | **Dr. Zainab:** “THE HOSPITAL LINE DROPS EVERY NIGHT. 01:17.” *(sharp)*<br><code>m023_mid1_01</code> |
| 0:06 | — | **Dr. Zainab:** “I HAVE BABIES ON MACHINES. THIS IS NOT NONSENSE.” *(sharp)*<br><code>m023_mid1_02</code> |
| 0:10 | — | **Dr. Zainab:** “…sorry. I know you have exams. Who else do I ask?” *(sad)*<br><code>m023_mid1_03</code> |
| 0:15 | **CUT** — MEDIUM, `corridor_mid` → Shamsu (13.0s). | — |
| 0:16 | — | **SFX** — `knock_three`. |
| 0:17 | — | **Shamsu:** “I was not asleep. I have a diagram.” *(neutral)*<br><code>m023_mid1_04</code> |
| 0:21 | — | **Shamsu:** “Technically we are not allowed. Bring a torch.” *(whisper)*<br><code>m023_mid1_05</code> |
| 0:27 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `zainab_asked_help`=true · The Fresher: at `corridor_mid`

### Closing — `cut_m023_close`

**Type:** `full` · **Max duration:** 40s · **Skippable:** yes · **Play once:** yes  
**First frame:** `substation_door` → Engr. Aliyu  
**Cast:** `PLAYER` → The Fresher (`player`) · `SHAMSU` → Shamsu (`npc.shamsu`) · `ALIYU` → Engr. Aliyu (`npc.aliyu`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `night`.<br>**CUT** — MEDIUM, `substation_door` → Engr. Aliyu (18.0s). | — |
| 0:01 | Engr. Aliyu rides `works_van` to `substation_door`. | — |
| 0:03 | Engr. Aliyu exits in `works_van`. | — |
| 0:05 | — | **Engr. Aliyu:** “You should not be in here.” *(scared)*<br><code>m023_close_01</code> |
| 0:09 | — | **Engr. Aliyu:** “…Thank you for being in here.” *(warm)*<br><code>m023_close_02</code> |
| 0:13 | — | **Engr. Aliyu:** “This never happened. I owe you. I pay what I owe.” *(neutral)*<br><code>m023_close_03</code> |
| 0:18 | **CUT** — CLOSE, `van_rear` → `prop.mall_sticker` (5.0s). | **MUSIC** — `mystery_thread`. |
| 0:23 | **CUT** — CLOSE, `switch_wall` → `prop.feeder_label_2` (5.0s). | — |
| 0:24 | — | **Shamsu:** “There are seven. My diagram has six.” *(whisper)*<br><code>m023_close_04</code> |
| 0:28 | **LIGHT** — `day`. | **MUSIC OUT** — `mystery_thread`. |
| 0:29 | **CALENDAR CARD** — “08:00 · Circuit Theory”. | — |
| 0:29 | **CUT** — TOP, `exam_desk_over` → `prop.glucose_and_note` (9.0s). | — |
| 0:31 | **TITLE CARD** — “SLEEP. This is not advice.”. | — |
| 0:38 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `m023_done`=true, `aliyu_owes`=true, `feeder_2_seen`=true, `mall_sticker_seen`=true · The Fresher: at `exam_desk`; items `glucose` 1

### Conditional special dialogue

> **Do not record or stage these in the canon pass.** They exist only when the named real-person flag is enabled, and must be cut cleanly when it is off. They are never romance content, never marketing, and never in a non-conditional cutscene.

**Jiya** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m023_play_j01` | “Evening, officer. They're with me. I'm conducting a… site visit.” | — |
| `m023_play_j02` | “Is the door locked? It was. Was it forced? It wasn't. Then what precisely is the offence?” | — |
| `m023_play_j03` | “I don't want to know. I really don't. Carry on.” | to you |

**Taty** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m023_play_t01` | “Hospital says ward three is flickering. I'm going back. Don't let go of that thing.” | — |
| `m023_play_t02` | “Four trips. I'm warm now. Keep going.” | — |

**Staging and `[ELSE]` from `Y1.md`:**

> - **[IF special.jiya]** If the patrol catches you in step 4, she is walking back from the staff club and deals with it (no hiding needed; heat does not rise). Lines: `m023_play_j01` "Evening, officer. They're with me. I'm conducting a… site visit." · `m023_play_j02` "Is the door locked? It was. Was it forced? It wasn't. Then what precisely is the offence?" · `m023_play_j03` (to you) "I don't want to know. I really don't. Carry on."
> - **[IF special.taty]** In step 5 she runs between the substation and the hospital as your messenger, so you see the wards' needle directly and get five extra seconds on each wave. Lines: `m023_play_t01` "Hospital says ward three is flickering. I'm going back. Don't let go of that thing." · `m023_play_t02` "Four trips. I'm warm now. Keep going."
> - **[ELSE]** You hide from the patrol; the hospital's state comes by text, with a delay.

## M024 · Convocation Night

**When:** Y1 · after exams · Sat (event: the seniors' convocation) · 18:00–midnight, then dawn.  
**Where:** admin: Senate steps, the boulevard; eng: garden.  
**Who:** everybody who said yes; Malam Garba; Mai Shayi; the Maker; the Dean of Engineering; Muhammad.  
**Special helpers (conditional):** Jiya, Taty, Madison.  
**Mystery:** pays "what is the Count" (the freshers drew it a face); plants C-NOTE ("Five more."), MS-07 (the Maker sees him and looks away), C-SEALS (the first seal), C-CAPE (still on the vane).  
**Connects to:** M22 (every yes stands in its place, by name); M12 (the Count, taller); M20 (the plaques light; one socket answers); M1 (the note); M23 (the load that the feeders cannot carry).

### Playable spine (between scenes)

These are the playable beats in order. They are not cutscenes; they are where the player moves, chooses, fights, buys, runs or waits. The next cutscene triggers at the end of the last beat.

1. `Usher the convocation` · `loc.sports.stadium` → `loc.admin.boulevard` · completeWhen: `escort(crowd.families, loc.admin.boulevard)` · fail: none
2. `Watch the lights come on` · completeWhen: `cutscene.end(cut_m024_open)`
3. `Run to the garden` · `loc.eng.garden` · completeWhen: `reach(loc.eng.garden_gate)` · fail: none
4. `Hold the fence (3 waves)` · `loc.eng.garden` · completeWhen: `minigame.pass(crowd_gather, hold_3)` with ally slots from `flag(everybody_*)` · fail: `a gap opens → 15 s to plug it yourself; the wave repeats`
5. `Bring the generator to the plinth` · completeWhen: `escort(npc.bolaji, coil_plinth)`
6. `Light the coil` · completeWhen: `use(item.coil_switch)` → `cutscene.end(cut_m024_mid_1)`
7. `Try the seal in the first socket` · completeWhen: `use(item.seal_engineering)` at `socket_1` (it glows, then returns to your Pockets) · fail: none
8. `Dance; then go home` · `loc.hostel.room` at dawn · completeWhen: `cutscene.end(cut_m024_close)`

### Opening — `cut_m024_open`

**Type:** `event` · **Max duration:** 40s · **Skippable:** yes · **Play once:** yes  
**First frame:** `boulevard_crane` → `senate_steps_top`  
**Cast:** `PLAYER` → The Fresher (`player`) · `SHAMSU` → Shamsu (`npc.shamsu`) · `CROWD` → Families (crowd) (`crowd.families`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **CALENDAR CARD** — “Sat · Convocation”.<br>**LIGHT** — `dusk`.<br>**MOVE** — WIDE, `boulevard_crane` → `senate_steps_top` (8.0s). | **MUSIC** — `convocation_brass` (ducked under dialogue). |
| 0:04 | **VFX** — `boulevard_bulbs_on` at `boulevard`. | — |
| 0:08 | **CUT** — MEDIUM, `boulevard_side` → Shamsu (10.0s). | — |
| 0:09 | — | **Shamsu:** “That is too much load. That is all seven feeders.” *(scared)*<br><code>m024_open_01</code> |
| 0:14 | — | **Shamsu:** “That is—” *(scared)*<br><code>m024_open_02</code> |
| 0:15 | — | **SFX** — `power_down_rolling`. |
| 0:15 | **LIGHT** — `blackout`. | — |
| 0:16 | — | **MUSIC OUT** — `convocation_brass`. |
| 0:18 | **CUT** — CLOSE, `senate_steps_low` → `senate_steps_top` (10.0s). | — |
| 0:19 | — | **MUSIC** — `count_theme`. |
| 0:19 | **VFX** — `shade_gather` at `senate_steps_top`. | — |
| 0:22 | Prop `prop.count_entropy_tall` appears at `senate_steps_top`. | — |
| 0:28 | **CUT** — WIDE, `boulevard_end` → Families (crowd) (10.0s). | — |
| 0:29 | **VFX** — `torch_bloom` at `boulevard_end`. | — |
| 0:31 | — | **The Fresher:** “Everybody. With me.” *(stern)*<br><code>m024_open_p01</code> |
| 0:38 | **RETURN TO PLAYER** — blend 0.8s. | — |

**End state:** Flags: `m024_started`=true · The Fresher: at `boulevard_mid`

### Mid-scene 1 — `cut_m024_mid_1`

**Type:** `full` · **Max duration:** 40s · **Skippable:** yes · **Play once:** yes  
**First frame:** `plinth_orbit` → The Maker  
**Cast:** `PLAYER` → The Fresher (`player`) · `MAKER` → The Maker (`npc.maker`) · `MUHAMMAD` → Muhammad (`npc.muhammad`) · `CROWD` → The Students (`crowd.students`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `torch`.<br>**CUT** — MEDIUM, `plinth_orbit` → The Maker (7.0s). | — |
| 0:01 | The Maker gestures. | — |
| 0:07 | **CUT** — POV, `MAKER` → Muhammad (5.0s).<br>Muhammad is revealed. | — |
| 0:08 | Prop `prop.lantern` appears at Muhammad. | — |
| 0:12 | **CUT** — CLOSE, `plinth_rim` → The Maker (5.0s). | — |
| 0:13 | The Maker looks at `coil_plinth`. | — |
| 0:17 | **LIGHT** — `coil_glow`. | **SFX** — `coil_in_tune`. |
| 0:18 | — | **MUSIC OUT** — `count_theme`. |
| 0:18 | **MOVE** — WIDE, `air_ring_road` → `campus_core` (12.0s). | **MUSIC** — `main_theme_full`. |
| 0:19 | **VFX** — `prosperity_wave_1` at `campus_core`. | — |
| 0:30 | **CUT** — WIDE, `senate_lawn` → `senate_steps_top` (5.0s).<br>Prop `prop.count_entropy_tall` is removed. | — |
| 0:35 | — | **The Students:** “UP NEPA!” *(excited)*<br><code>m024_mid1_01</code> |
| 0:38 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `coil1`=true, `prosperity`=1, `ms_07`=true · The Fresher: at `coil_plinth`

### Mid-scene 2 — `cut_m024_mid_2`

**Type:** `full` · **Max duration:** 40s · **Skippable:** yes · **Play once:** yes  
**First frame:** `boulevard_side` → Mai Shayi  
**Cast:** `PLAYER` → The Fresher (`player`) · `SHAYI` → Mai Shayi (`npc.mai_shayi`) · `DEAN` → Dean of Engineering (`npc.dean_eng`) · `GARBA` → Malam Garba (`npc.garba`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `night`.<br>**CUT** — MEDIUM, `boulevard_side` → Mai Shayi (20.0s). | — |
| 0:01 | — | **Mai Shayi:** “You know who gave that thing a cape?” *(warm)*<br><code>m024_mid2_01</code> |
| 0:05 | — | **Mai Shayi:** “Us. First-years. Every year.” *(neutral)*<br><code>m024_mid2_02</code> |
| 0:09 | — | **Mai Shayi:** “We were scared. So we drew it a face.” *(neutral)*<br><code>m024_mid2_03</code> |
| 0:13 | — | **Mai Shayi:** “A thing with a face, you can stand against.” *(warm)*<br><code>m024_mid2_04</code> |
| 0:18 | Mai Shayi looks at `prop.weathervane`. | — |
| 0:20 | **CUT** — CLOSE, `garden_gate_post` → Dean of Engineering (10.0s). | — |
| 0:21 | Prop `prop.seal_engineering` appears at The Fresher. | — |
| 0:22 | — | **Dean of Engineering:** “My paperweight. And the last Dean's.” *(amused)*<br><code>m024_mid2_05</code> |
| 0:26 | — | **Dean of Engineering:** “'When your people are ready.' I think: tonight.” *(warm)*<br><code>m024_mid2_06</code> |
| 0:30 | **CUT** — MEDIUM, `senate_door` → Malam Garba (8.0s). | — |
| 0:31 | — | **Malam Garba:** “Go and dance. Fresher no more.” *(warm)*<br><code>m024_mid2_07</code> |
| 0:37 | **RETURN TO PLAYER** — blend 1.0s. | — |

**End state:** Flags: `count_face_truth`=true, `seal_1`=true · The Fresher: at `senate_door`; items `seal_engineering` 1

### Closing — `cut_m024_close`

**Type:** `full` · **Max duration:** 30s · **Skippable:** yes · **Play once:** yes  
**First frame:** `room_door` → The Fresher  
**Cast:** `PLAYER` → The Fresher (`player`)

| Time | Picture / staging | Dialogue / sound |
|---:|---|---|
| 0:00 | **LIGHT** — `day`.<br>**CUT** — MEDIUM, `room_door` → The Fresher (6.0s). | **MUSIC OUT** — `main_theme_full`. |
| 0:01 | The Fresher walks to `room_desk`. | — |
| 0:06 | **CUT** — TOP, `PLAYER` → `prop.note` (14.0s). | — |
| 0:07 | Prop `prop.note` appears at `room_desk`. | — |
| 0:09 | **TITLE CARD** — “The Maker is watching. Welcome.”. | — |
| 0:13 | — | **MUSIC** — `mystery_thread`. |
| 0:14 | Prop `prop.note_second_line` appears at `room_desk`. | — |
| 0:15 | **TITLE CARD** — “Five more.”. | — |
| 0:20 | **CUT** — CLOSE, `room_desk_low` → The Fresher (5.0s). | — |
| 0:21 | The Fresher freezes in shock. | — |
| 0:25 | **TITLE CARD** — “END OF YEAR 1”. | — |
| 0:29 | — | **MUSIC OUT** — `mystery_thread`. |

**End state:** Flags: `m024_done`=true, `year1_done`=true, `note_five_more`=true, `zainab_playable`=true · The Fresher: at `room_desk`

### Conditional special dialogue

> **Do not record or stage these in the canon pass.** They exist only when the named real-person flag is enabled, and must be cut cleanly when it is off. They are never romance content, never marketing, and never in a non-conditional cutscene.

**Jiya** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m024_play_j01` | “Nobody's trespassing. It's convocation. Read your own programme.” | — |
| `m024_play_j02` | “I said I'd come to see what it is. …Right. I see what it is. Keep going!” | — |
| `m024_play_j03` | “I can't object to that thing. It hasn't said anything. Rude.” | — |

**Taty** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m024_play_t01` | “Left side's mine! All of it! Don't send anyone, they'll slow me down!” | — |
| `m024_play_t02` | “Wave three? That's all? Bora!” | — |
| `m024_play_t03` | “Pixel's in my hood and she's furious. That's how you know we're winning.” | — |

**Madison** — `CONDITIONAL`

| Line ID | Line | Direction |
|---|---|---|
| `m024_play_d01` | “Okay everybody, with me! Torch UP, step, torch UP, step!” | — |
| `m024_play_d02` | “No filming, I promised. I PROMISED. Aiya, it's so beautiful.” | — |

**Staging and `[ELSE]` from `Y1.md`:**

> - **[IF special.jiya]** She holds the gate (one ally slot filled even if you asked fewer than twelve) by informing a security cordon that the garden is "a public gathering under the university's own events policy". Lines: `m024_play_j01` "Nobody's trespassing. It's convocation. Read your own programme." · `m024_play_j02` "I said I'd come to see what it is. …Right. I see what it is. Keep going!" · `m024_play_j03` "I can't object to that thing. It hasn't said anything. Rude."
> - **[IF special.taty]** She runs the far side of the fence (a second slot), end to end, all three waves. Lines: `m024_play_t01` "Left side's mine! All of it! Don't send anyone, they'll slow me down!" · `m024_play_t02` "Wave three? That's all? Bora!" · `m024_play_t03` "Pixel's in my hood and she's furious. That's how you know we're winning."
> - **[IF special.madison]** She starts a chant-and-step at the back of the crowd that spreads forward (the crowd meter in step 4 fills faster). Lines: `m024_play_d01` "Okay everybody, with me! Torch UP, step, torch UP, step!" · `m024_play_d02` "No filming, I promised. I PROMISED. Aiya, it's so beautiful."
> - **[ELSE]** Slots are filled only by those you asked in M22.

---

## 3 · Year 1 totals

| Measure | Count |
|---|---:|
| Missions | 24 |
| Cutscene blocks | 78 |
| Spoken cutscene lines | 333 |
| Runtime-token lines (not recordable until a branch is chosen) | 3 |
| Conditional cutscene inserts | 9 blocks · 9 lines |
| Conditional gameplay lines | 80 |
| All conditional lines | 89 |
| Cutscene types | full 59 · vehicle 3 · event 8 · entry 6 · ambient 2 |
| Total authored runtime (sum of maxDuration) | 42:00 |

**The three runtime tokens:**

| Line ID | Mission | Speaker | Token |
|---|---|---|---|
| `m013_mid1_03` | M013 | Dad | `[LECTURE_LINE: chosen by grades and spending]` |
| `m021_mid1_03` | M021 | Helen | `[GIFT_LINE: corn or flowers]` |
| `m021_close_01` | M021 | The Companion | `[COMPANION_LINE: by who came]` |

These are not missing dialogue. They are deliberate slots filled by an earlier player result. The build must supply the selected line before the scene plays; it must never ship the bracket text to a voice actor.

**Where to go next.** Line-by-line casting sheets are in `03B_YEAR1_LINES_BY_CHARACTER.md`. Shot lists, transitions and exact end-state tables are in `04_CUTSCENE_TECHNICAL_SPEC.md`. Assets and sets are in `05_SCENE_AND_ASSET_MANIFEST.md`.
