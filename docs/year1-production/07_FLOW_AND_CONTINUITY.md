# 07 — FLOW & CONTINUITY (YEAR ONE)

**Status:** execution reference · **Scope:** M001–M024 · **Sources:** `docs/plan/missions/Y1.md` (orders, steps, end states), `STORY_BIBLE_V2.md` §1.3/§1.8 (what is true), `02_YEAR1_STORY.md` (meaning), `03_YEAR1_SCRIPT.md` (what is said).

This document answers four questions for a build team:

1. **In what order does the year run, and what opens what?**
2. **What state must be true before and after each mission?**
3. **Who knows what, and when?**
4. **What must never break between scenes?**

If this document and a mission block disagree, **the mission block wins**. If a flag here is not in the mission's `endState`, treat this document as a design note, not canon.

---

## 0. The flow contract

- **One spine, no branches.** Year 1 is linear M001 → M024. There are no mission-level branches, no missable missions, and no fail states that end the run.
- **Optional inserts are additive.** `[IF special.*]` blocks add dialogue and shots but never change flags, gates, items or endings.
- **Systems unlock, story does not branch.** Football, the Plug, the gym, driving jobs, radio, gifts/cinema and Zainab-as-playable are **unlocks**, not forks. They add side content and callbacks; the spine continues.
- **Kind retries.** Any failed action (a jump, a queue, a puzzle) returns the player to the last safe beat with a joke, not a punishment. No mission can be lost.
- **No timers that kill.** Clocks, curfews and nightfall create pressure and change lighting; they never expire a mission.
- **The year always completes.** Even a player who ignores every optional thing reaches M024 and the second line of the note.

---

## 1. The mission graph

### 1.1 Spine

```
M001 Welcome, Fresher
  └─ M002 Queue Theory
       └─ M003 Belle First
            └─ M004 Matric Fit
                 └─ M005 First Lecture, Wrong Theatre
                      └─ M006 Mai Shayi Knows
                           └─ M007 Fresher Tax
                                └─ M008 Left Boot First
                                     └─ M009 Doctor's Orders
                                          └─ M010 The Plug
                                               └─ M011 Test Week, One Lamp
                                                    └─ M012 Count Entropy
                                                         └─ M013 Results Day
                                                              └─ M014 Sly's Last Stand
                                                                   └─ M015 Baba Dam's Pier
                                                                        └─ M016 The Dam at Midnight
                                                                             └─ M017 Keke Grand Prix
                                                                                  └─ M018 Radio Silence
                                                                                       └─ M019 The Vice-Chancellor's Cup
                                                                                            └─ M020 Six Plaques
                                                                                                 └─ M021 Wingman
                                                                                                      └─ M022 Everybody
                                                                                                           └─ M023 Exam Fever
                                                                                                                └─ M024 Convocation Night
```

**Act shape.**

| Act | Missions | Question | Ends on |
|---|---|---|---|
| I — Arriving | M001–M006 | Can a stranger belong? | The Maker: "I do not write notes. I do not watch. I listen." |
| II — Belonging | M007–M014 | What does belonging cost? | Sly becomes a friend; the tax ends. |
| III — The dark | M015–M019 | What moves when the light goes? | The Cup is lost; the Count is seen by everyone. |
| IV — The ring | M020–M024 | What is the seventh space for? | One socket answers; "Five more." |

### 1.2 Unlocks (side content, no story fork)

| Unlock | Flag | Opened by | What it adds |
|---|---|---|---|
| Football / pitch access | `football_unlocked` | M008 | Training, the left-boot joke, Cup setup. |
| The Plug's store | `plug_store_unlocked` | M010 | Torches, gum, batteries, Zobo Max; M012 and M016 depend on it. |
| Gym membership | `gym_member` | M014 | Gym scenes, the scale joke, Sly's turn. |
| Driving jobs | `driving_jobs` | M017 | Keke side jobs, Aleeya's route, Basit's favour. |
| Radio job | `radio_job` | M018 | Station shifts, Bature's show, the 6:06 broadcast. |
| Gifts / cinema | `gifts_unlocked`, `cinema_unlocked` | M021 | The non-date, Helen's answer, the companion token. |
| Playable Zainab | `zainab_playable` | M024 | Post-year free roam and Year 2 setup. |

**Rule:** an unlock may be referenced by a later mission's dialogue, but a later mission may never **require** an optional unlock to complete. The only soft dependencies are item-based (torch, gum, core) and those items are always obtainable on the spine.

---

## 2. Mission gates and end states

Legend: **Entry** = what must be true to start. **Exit** = hard flags written at completion. **Soft** = relationship/knowledge flags used for callbacks. Flags are lowercase snake_case.

| Mission | Entry | Exit (hard) | Soft / knowledge |
|---|---|---|---|
| **M001** | New game. | `m001_started`, `m001_done`, `film_a/b/c`, `film_done`, `goat_returned`, `journal_note` | `goat_loose` (transient); player has the note, the tin, the Kola of Vigour; Porter and Sule met. |
| **M002** | `m001_done` | `m002_started`, `m002_done`, `saw_door7`, `met_muhammad`, `met_aleeya` | `garba_hm`; ID, bank account, phone; Garba has seen the note; door 7 planted. |
| **M003** | `m001_done`, `m002_done` | `m003_started`, `m003_done`, `blackout_1`, `heard_broadcast_7`, `saw_shade` | First blackout; three notes + count on the radio; the shade follows a fresher alone. |
| **M004** | `m002_done` (ID check) | `m004_started`, `m004_done`, `matriculated`, `met_mubarak`, `met_twins` | `ms_03`, `photo_mode`; gown, photo with the back-row gap. |
| **M005** | `m004_done` | `m005_started`, `m005_done`, `wrong_theatre`, `logbook_p40`, `page41_missing`, `met_shamsu`, `met_nusaiba`, `met_abbas`, `met_wednesday` | Page 40 = six circles; page 41 cut out. |
| **M006** | `m005_done` | `m006_started`, `m006_done`, `met_maker`, `met_tanko`, `statue_turned_seen`, `riddle_six_legs`, `legends_3` | Maker denies writing notes; statue turned; the hum. |
| **M007** | `m002_done`, `m005_done` (Abbas) | `m007_started`, `m007_done`, `met_sly`, `met_big_baby` | The tax; the challenge; Sly's shadow. |
| **M008** | `m005_done` (Shamsu) | `m008_started`, `m008_done`, `met_jega`, `goat_gate_shamsu`, `heard_idk`, `football_unlocked` | Shamsu confesses the goat gate; "IDK" planted. |
| **M009** | `m008_started`, `m003_done`, `m006_done` | `m009_started`, `m009_done`, `met_zainab`, `met_hauwa`, `contact_zainab`, `maker_at_hospital_seen` | Jega's ankle; Zainab's first appearance; Maker at the hospital. |
| **M010** | `m004_done`, `m003_done` | `m010_started`, `m010_done`, `plug_intro`, `met_hajiya_ladi`, `plug_store_unlocked` | Mubarak pays his debt in stock; the Plug's sign; Lucky Kola. |
| **M011** | `m005_done`, `m002_done`, `m010_done` | `m011_started`, `m011_done`, `met_tunde`, `sketch_figure`, `hint_q4` | `ms_04`; torch works because of KB's batteries; the sketch. |
| **M012** | `m003_done`, `m006_done`, `m007_done`, `m010_done`, `m011_done` | `m012_started`, `m012_done`, `count_seen`, `cape_on_vane`, `crew_chat`, `mubarak_gave_torches` | The Count's tally; the cape on the weathervane; the generator. |
| **M013** | `m005_done`, `m011_done`, `m012_done`, `m008_done` | `m013_started`, `m013_done`, `dad_lecture_y1`, `khadija_watching`, `night_board_seen` | Results; Dad's call; Khadija knows about the mall basement (future thread); page 41 slip. |
| **M014** | `m007_done`, `m012_done` | `m014_started`, `m014_done`, `gym_member`, `before_photo`, `sly_friend`, `clippers_seen`, `tax_ended_y1` | The tax ends; Sly is a friend; the clippers are a threat that never lands. |
| **M015** | `m006_done`, `m009_done` | `m015_started`, `m015_done`, `met_baba_dam`, `met_lawal`, `cliff_stakes_seen`, `forest_light_seen`, `sister_line_1`, `swimming` | The pier; the light in the drowned forest; "sister" line planted. |
| **M016** | `m015_done`, `m010_done`, `m006_done` | `m016_started`, `m016_done`, `met_eel`, `eel_trust` | `ms_05`; the relay core; the footprints that do not return. |
| **M017** | `m009_done`, `m002_done`, `m010_done` | `m017_started`, `m017_done`, `met_lula_faty`, `basit_wheel_off`, `page_nine_hint`, `driving_jobs` | Aleeya's keke; the examiner; page-nine hint. |
| **M018** | `m003_done`, `m009_done`, `m012_done`, `m005_done` | `m018_started`, `m018_done`, `maker_away`, `met_kabiru`, `dr_z_is_zainab`, `radio_job`, `bature_show`, `broadcast_older_than_station` | The 6:06 broadcast; Dr. Z is Zainab; the Maker has been away two days. |
| **M019** | `m008_done`, `m009_done` | `m019_started`, `m019_done`, `cup_lost_y1` | `ms_06`; the Cup is lost; the twelfth pair of shoes; Zainab attends "for medical reasons". |
| **M020** | `m005_done`, `m006_done`, `m016_done`, `m018_done` | `m020_started`, `m020_done`, `met_kelechi`, `garden_gate_open`, `plaques_six`, `sockets_ten_seen`, `seventh_space_seen`, `riddle_ten_mouths`, `six_sites_on_map` | Six plaques; ten sockets, one dead; the seventh space; the core fits. |
| **M021** | `m008_done`, `m019_done` | `m021_started`, `m021_done`, `helen_yes`, `idk_her_joke`, `gifts_unlocked`, `cinema_unlocked` | Helen says yes (or not); "IDK" resolved as a joke, not a name reveal. |
| **M022** | M001–M021 | `m022_started`, `m022_done`, `porter_thirty_years`, `everybody_ready` | Porter's list; every "yes" is a callback; the garden gate ajar. |
| **M023** | `m011_done`, `m009_done`, `m012_done`, `m013_done` | `m023_started`, `m023_done`, `zainab_asked_help`, `aliyu_owes`, `feeder_2_seen`, `mall_sticker_seen` | The substation; feeder label 2; the mall sticker; Aliyu's favour. |
| **M024** | `m022_done`, `m012_done`, `m020_done`, `m001_done`, `m023_done` | `m024_started`, `m024_done`, `year1_done`, `coil1`, `prosperity`, `count_face_truth`, `seal_1`, `note_five_more`, `zainab_playable` | `ms_07`; one socket filled; the second line appears; Year 1 ends. |

**Hard rule:** every mission writes `m###_started` on entry and `m###_done` on exit. A save missing either is corrupt; fail forward to the nearest completed mission, never backward.

---

## 3. Flag registry

### 3.1 Mystery flags (do not reuse for jokes)

| Flag | Set | Meaning | Payoff |
|---|---|---|---|
| `journal_note` | M001 | The note is in the journal. | M024 second line. |
| `saw_door7` | M002 | Door 7 seen. | M020 six plaques. |
| `garba_hm` | M002 | Garba recognises the note. | Later porter/Maker thread. |
| `heard_broadcast_7` | M003 | Three notes + count from seven. | M018, M024. |
| `page41_missing` | M005 | Page 41 cut out. | M013 slip, M023. |
| `logbook_p40` | M005 | Six circles seen. | M020. |
| `statue_turned_seen` | M006 | The statue moved. | M020 gazes. |
| `goat_gate_shamsu` | M008 | Shamsu let the goat out. | M022 callback. |
| `maker_at_hospital_seen` | M009 | Maker outside his garden. | M015/M018. |
| `sketch_figure` | M011 | Tunde's sketch of the figure. | M022/M024. |
| `count_seen` | M012 | The Count's tally. | M019/M024. |
| `cape_on_vane` | M012 | Cape on the weathervane. | M024 "we gave it a face". |
| `night_board_seen` | M013 | The night results board. | M023. |
| `sister_line_1` | M015 | Baba Dam's "sister" line. | Later years (do not resolve in Y1). |
| `forest_light_seen` | M015 | Light in the drowned forest. | Unresolved in Y1. |
| `met_eel`, `eel_trust` | M016 | The eel is not a monster. | M024/Year 2 tone. |
| `page_nine_hint` | M017 | Page-nine hint. | M020. |
| `broadcast_older_than_station` | M018 | The broadcast predates the station. | M024. |
| `plaques_six`, `sockets_ten_seen`, `seventh_space_seen` | M020 | The ring's physical state. | M024. |
| `feeder_label_2_seen`, `mall_sticker_seen` | M023 | The substation clue. | M024. |
| `count_face_truth` | M024 | The face was invented by freshers. | Year 1 thematic close. |
| `note_five_more` | M024 | The second line. | Year 2 hook. |

### 3.2 Relationship flags

`met_*` flags are handshake flags, not romance meters. They gate a warmer line or a callback, never a mission.

`helen_yes` (M021) is deliberately ambiguous: it records that the player asked and Helen answered, not that a romance began. Do not build a romance system on it. `sly_friend` (M014) changes Sly's positioning and dialogue; `aliyu_owes` (M023) adds a favour in M024; `zainab_asked_help` (M023) adds her text in M024.

### 3.3 Tone flags

`tax_ended_y1` (M014) ends the fresher tax permanently. `cup_lost_y1` (M019) is canon: the Cup is lost, and the loss is the point. `prosperity` (M024) is a **flag**, not an item — it records that the campus's fortune changed, and it must not be spent or traded.

### 3.4 Special inserts

The nine conditional cutscene inserts (M002, M004, M007, M008, M012, M014, M016, M017, M019) set **no flags**. They may read relationship flags, but they must not write state, unlock content, or alter the ending. If a special insert is skipped, the mission's hard flags are identical.

---

## 4. Item economy

### 4.1 The critical path

```
M001  tin + Kola of Vigour + note
  └─ M005  fuse 13A (lab) ──────────────┐
       └─ M010  torch, Iron Lungs Gum, batteries, Zobo Max
            └─ M012  torch + generator (night)
                 └─ M015  plank + sand + cement (pier repair)
                      └─ M016  relay core (underwater) + towel
                           └─ M020  relay core installed
                                └─ M024  coil switch + Engineering seal
```

**No dead ends.** Every key item is either:
- **given** on the spine (note, tin, gum, torch, core),
- **bought** with money the spine provides (batteries, Zobo Max), or
- **found** in the mission's own set (fuse, plank, sand, cement, switch, seal).

**Never require:** a side-unlock item (football boots, gym kit, radio record) to finish the spine. They are flavour and callbacks.

### 4.2 Money

Money comes from home (M002), Malam Sule (M001), the Plug's stock (M010), and driving jobs (M017). It is spent on food, transport, gifts and the Plug. The economy is forgiving: the player can always eat at the Spot on credit, and Mama Nkechi's cheapest plate is always affordable. **Being broke never ends a mission** — it changes the scene (the M022 "everybody" version is warmer if the player has been generous).

### 4.3 Consumables

| Item | Drain | Refill | Rule |
|---|---|---|---|
| Torch battery | Across M012–M016 | Batteries from the Plug | If empty, the scene provides a candle/lantern; never soft-lock. |
| Iron Lungs Gum | One dive | One stick | The eel encounter is winnable without it, but slower. |
| Zobo Max | One bottle | Buy | Comedy item; also a gift option. |
| Kola of Vigour | One | None | A keepsake; eating it is a choice, not a requirement. |

### 4.4 Item states that matter

- `item.torch`: `off / on / low / dead` — the beam cone shrinks and yellows.
- `item.relay_core`: `wet / carried / installed / sealed` — the glow goes from wild cyan to steady.
- `item.gown`: `too_big / pinned / altered` — the M004 → M024 callback.
- `item.note`: `folded / open / pinned / second_line` — never lost, never damaged.

---

## 5. Knowledge and continuity

### 5.1 Who knows what, when

| Fact | First known by | Player learns | Must not be said earlier |
|---|---|---|---|
| The note exists | Player, Roomie, Porter (writer) | M001 | Anyone naming the writer. |
| The Maker did not write it | Maker | M006 | The Maker admitting he **ordered** it (Year 5). |
| Page 41 is missing | Player, Shamsu | M005 | Who tore it out. |
| Door 7 is one of six | Player, Garba (partly) | M002 → M020 | The seventh space's purpose. |
| The garden hum is a coil | Player, Maker | M006 | The full ten-faculty ring. |
| The Count has a face because freshers drew one | Mai Shayi, older students | M024 | Anyone explaining it before M024. |
| Dr. Z is Zainab | Player (M018), Zainab | M018 | The campus at large; it stays a niche joke. |
| Muhammad is "the light's face" | Nobody in Year 1 | Never in Y1 | Any explicit answer. He is seen, not explained. |
| The note is Porter's handwriting | Porter, Maker | Not in Y1 (M97) | The player noticing in Y1. Hints only. |
| The second line | Player | M024 | Any earlier sighting. |

### 5.2 The clue ledger (what must be visible, in order)

1. **M001** — note, symbol, 6:06, one strike, "one engineering boy", the tin.
2. **M002** — door 7, Garba's "Hm", Muhammad's mark.
3. **M003** — three notes, count from seven, the shade, the first blackout.
4. **M004** — the photo with a gap.
5. **M005** — page 40's six circles, page 41 cut out.
6. **M006** — the Maker's denial, the statue turned, the hum, the six-legs riddle.
7. **M008** — Shamsu and the goat gate.
8. **M009** — the Maker at the hospital.
9. **M011** — the sketch, the figure.
10. **M012** — the Count's tally, the cape, the blackout grid.
11. **M013** — page 41 slip, Khadija watching.
12. **M015** — the drowned forest light, the "sister" line.
13. **M016** — the core, the footprints that do not return.
14. **M017** — page-nine hint.
15. **M018** — 18:06, the broadcast older than the station.
16. **M019** — the twelfth pair of shoes.
17. **M020** — six plaques, ten sockets, the seventh space, the core fits.
18. **M023** — feeder label 2, the mall sticker.
19. **M024** — the Count's face, one socket lit, the second line.

**Rule:** each clue must be **shown** before it is **discussed**. No character explains a clue the camera has not given the player.

### 5.3 Continuity invariants (break these and the year stops making sense)

- The clock is wrong all year; it strikes **once** in M001 and **18:06** is a radio-studio clock, not the tower.
- The blackout in M003 is local (hostel); M012 is campus-wide; M024 is deliberate (too much load).
- The relay core is underwater in M016, in the player's bag in M020, installed in M020, and sealed in M024. It is never duplicated.
- The statue faces the pond after M006 and stays turned.
- The seventh plaque space is empty until M024.
- The weathervane keeps the cape scrap from M012 to M024.
- The pier's missing plank is missing in M015 and M016.
- The goat (Sarki) is returned in M001 and stays at the farm; the poster is a joke, not a search.
- Zainab's skin is `#f1d6c2` in every scene, including night and underwater reflections.
- Helen is "IDK" until she chooses to give her name; M021 does **not** reveal a different name.
- The Cup is lost in M019 and never retroactively won.

### 5.4 Relationship continuity

- Roomie's casting (Bature/Firdausi) is fixed at new game and never swapped. Shared lines are duplicated under both castings.
- Mubarak's debt (M004) is paid in stock (M010), not cash.
- Jega's ankle (M009) limits him in M012 and M019; he does not sprint.
- Sly's turn (M014) is permanent: he is never a threat again.
- Abbas is "John Carter" on the pitch (M007/M008) and Abbas in the lab (M005); the nickname is a joke, not an alias.
- Porter is Baba Porter at the hostel and the SUG porter at the basement; they are different men with the same local label.
- Clerk is Mrs. Adebayo in M002 and the Engineering Clerk in M013; different women.

---

## 6. Calendar and time

| Mission | When | Lighting | Calendar UI |
|---|---|---|---|
| M001 | Freshers' Week, Mon, 07:00–sunset | dawn → day → dusk → night | "Mon 16 Sep · Freshers' Week · Resumption day" |
| M002 | Tue, 08:00–16:00 | day | "Tue 17 Sep · Freshers' Week" |
| M003 | Wed, 18:00–23:00 | dusk → blackout night | "Wed 18 Sep · Freshers' Week" |
| M004 | S1 Wk 2, Fri, 08:00–14:00 | day | "Fri 27 Sep · Matriculation" |
| M005 | S1 Wk 3, Mon, 07:40–10:00 | morning | "Mon 30 Sep · First lecture" |
| M006 | S1 Wk 3, Thu, 19:00–22:00 | night | "Thu 3 Oct" |
| M007 | S1 Wk 4, Sat, 16:00 | dusk | "Sat 12 Oct" |
| M008 | S1 Wk 5, Tue, 17:00 | dusk → floodlights | "Tue 15 Oct · Football hour" |
| M009 | S1 Wk 5, Wed, 20:00–23:30 | night | "Wed 16 Oct" |
| M010 | S1 Wk 5, Sat, 11:00–14:00 | day | "Sat 19 Oct" |
| M011 | S1 Wk 6–7, Mon–Thu | evenings + one 08:00 paper | "Test week" |
| M012 | S1 Wk 14, Thu, 21:00–01:00 | night, blackout | "Thu 12 Dec · Exam week" |
| M013 | S2 Wk 1, Mon, 09:00–15:00 | day | "Mon 6 Jan · Results day" |
| M014 | S2 Wk 2, Sat, 07:00–17:00 | day | "Sat 18 Jan" |
| M015 | S2 Wk 3, Sun, 09:00–sunset | day → sunset | "Sun 26 Jan" |
| M016 | S2 Wk 4, Fri, 23:00–02:00 | night, harmattan | "Fri 31 Jan · Midnight" |
| M017 | S2 Wk 5, Sat, 10:00–15:00 | day | "Sat 8 Feb" |
| M018 | S2 Wk 6, Wed, 18:00–midnight | dusk → night | "Wed 19 Feb" |
| M019 | S2 Wk 8, Sat, 16:00 | dusk → night | "Sat 1 Mar · Cup final" |
| M020 | S2 Wk 9, Tue, 16:00–20:00 | late afternoon → dusk | "Tue 11 Mar" |
| M021 | S2 Wk 10, Sat, 15:00–21:00 | afternoon → night | "Sat 22 Mar" |
| M022 | S2 Wk 12, Mon–Fri, any hour | varies per person | "Everybody, everywhere" |
| M023 | S2 Wk 14–15, exam weeks | days and nights | "Exam fever" |
| M024 | After exams, Sat, 18:00–dawn | night → dawn | "Convocation night" |

**Rule:** the calendar is diegetic (phone/home screen). It must never advance backwards, skip a mission's day, or show a date that contradicts the table. M022 deliberately has no single date — it is a week of short visits.

---

## 7. Year-end state (canon)

At the end of M024, before the credits:

- The player is no longer a fresher. Garba: "Go and dance. Fresher no more."
- The relay core is installed; one of ten sockets is filled; the hum is in tune.
- The campus has light, paint, and a second shuttle (the `prosperity` flag).
- The Count's face is explained: freshers drew it. The dark is not gone; it is named.
- Sly is a friend. The tax is over. The Cup is still lost.
- Helen has answered; the answer is hers, not a prize.
- Zainab is playable; the hospital line holds.
- The note is where the player left it, with a second line: **"Five more."**
- Muhammad carries a lantern in the crowd. The Maker sees him and looks away. Neither is explained.

**Do not add at year end:** a romance confirmation, a villain defeat, a full explanation of the ring, a name for Muhammad, or a redemption of the Count. Year 1 closes on a question and a warm crowd.

---

## 8. Failure, retry and edge cases

| Situation | Behaviour |
|---|---|
| Player fails a jump/chase | Reset to last checkpoint with a joke; the goat waits. |
| Player misses a clue interact | The clue stays interactable until seen; no timed loss. |
| Player runs out of torch battery | Scene supplies a candle/lantern; the beat continues. |
| Player has no money | Credit at the Spot; the scene acknowledges it warmly. |
| Player skipped an optional mission/unlock | Later dialogue uses a neutral variant; no `met_*` line fires. |
| Player quits mid-cutscene | Resume at the block start, not mid-line; `playOnce` flags only set on completion. |
| Save missing a hard flag | Fail forward to the last completed mission; never replay a completed mission's ending. |
| Special insert conditions unmet | Skip the block cleanly; do not play a truncated version. |

---

## 9. Build acceptance for flow

- [ ] All 24 missions start and complete with the exact hard flags above.
- [ ] No mission requires an optional unlock to finish.
- [ ] Every clue is shown before it is discussed.
- [ ] The calendar never runs backwards and matches §6.
- [ ] The nine special inserts write no flags.
- [ ] The relay core exists in exactly one state at a time.
- [ ] Zainab's skin, the Cup loss, the goat return and the second line are invariant.
- [ ] A player who ignores every optional scene still reaches M024 with a coherent year.
- [ ] A player who does every optional scene gets callbacks, not a different plot.

---

*End of 07. Sets and props: `05_SCENE_AND_ASSET_MANIFEST.md`. Shots: `04_CUTSCENE_TECHNICAL_SPEC.md`. Script: `03_YEAR1_SCRIPT.md`. Story: `02_YEAR1_STORY.md`.*
