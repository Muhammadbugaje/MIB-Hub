# STORY AUDIT, 15 November 2026

**For:** the owner and the next writer. **Covers:** `missions/Y1.md` to `Y5.md` (M001–M120), `FORMAT.md`, `INTEGRATION_Y3_5.md` and `STORY_BIBLE_V2.md`.
**Result:** the 11 known problems are fixed. A full continuity and clue pass found about 100 more. **About 75 are fixed now**; the rest need a writer's hand or your decision and are listed in §5 and §7. The mechanical checker passes with **0 errors and 0 warnings**.

---

## 1. What was checked, and how

| Pass | How | Result |
|---|---|---|
| Mechanical | `tools/story/check_missions.py` (new, with 17 tests) | 120 missions, 392 cutscenes, 1,977 spoken lines. 0 errors, 0 warnings |
| Continuity and clues | Every line of every year read against the bible (§1.3 truth, §1.5 twists, §1.8 mysteries, §10.6 Muhammad tracker, §13 truth and rules) | About 100 findings; each one checked against the text before changing anything (one reviewer claim was wrong and was not applied: Nusaiba's 83 in M100 is already earned by Dr. Minus's "Plus two") |

**What the checker tests**, on every run: all 120 missions present and in order; every required section; story length (400–800 words) and step count (4–9); objective text under 60 characters; cutscene ids, open and close per mission, the 40-second cap; every spoken line's id (pattern, mission number, special-character prefix, never reused with different words), length (90 characters max), mood; anims, shots and light presets against `FORMAT.md`; every actor in the cast; optional roles only inside `if: special.*`; every `[IF special.*]` has an `[ELSE]`; clue ids; Muhammad sightings against the bible's tracker; calendar order within each year; heist numbering; seals never fitted before M114 and the seal count never dropping; Rumi quotations word for word from `QUOTES.md`; placeholders; banned names (Kaltume, real university and town names); Zainab never described as dark-skinned; "ghost/spirit/time travel" near Muhammad.

**Run it:** `python3 tools/story/check_missions.py` (add `--errors` for errors only, `--json` for tools). **Test it:** `python3 -m unittest tools/story/test_check_missions.py`.

---

## 2. The 11 known problems: decisions

| # | Problem | Decision and fix |
|---|---|---|
| 1 | Seal count at M60 | The missions were right: **four** held (Engineering, Arts, Law, Agriculture). The bible said three; fixed |
| 2 | Where the seals go | **They go in the bronze door under the clock (M114), as bible §1.3 says.** The garden coil's ten sockets are only a gauge. M24 now *tests* the Engineering Seal in socket 1: it glows, lets go, and you keep it. Every seal stays in your Pockets until M114 (the item data already did this). The checker now fails any seal fitted before M114 |
| 3 | The two Aishas | Kept as a deliberate, unexplained echo; noted in bible §13.4. **Owner question 1** |
| 4 | Year 4 dates (M93/M94) | M93 moves to **S2 Wk 12 Sat** (the evening after M92's night). The checker also found **M7/M8** out of order: M8 moves to **S1 Wk 5 Tue**, the night before M9 |
| 5 | Heist numbering | Now in play order: **M44 Heist 1, M81 Heist 2, M101 Heist 3** (missions and bible) |
| 6 | Jega's recovery (M78) | Injured Strike wk 22 of Year 3; rehab is about nine months later by the calendar. "Six months became eight" is now "**became nine**" |
| 7 | M56 reward | The mission was right: a **photograph** of the padlock; the padlock itself is sawn off in M66. Bible fixed |
| 8 | Rakiya missing from the bible | Added to the cast (Hajiya Ladi's elder daughter, the M71 bride) and to the bible's M71 |
| 9 | Bible §8.9 missing M115, M117, M119 | The table now lists **every** main mission with a special character (it also lacked M25, M32, M34–M36, M38, M45). Real totals, counted by the checker: **Jiya 32, Taty 34, Madison 21** (including one-line appearances). **Owner question 6** |
| 10 | `[RUMI_Q5]`, `[RUMI_Q6]` | Pasted word for word from `QUOTES.md` (Whinfield 1898). Each was over the 90-character line limit, so each is two subtitle lines, split at the poem's own line break |
| 11 | `horns` anim | Added to `FORMAT.md` (Taty only). Also found: the bullet list and cutscene of M46 gave Jiya's line two different wordings; now one line |

---

## 3. Continuity fixes applied (by year)

**Year 1**
- **M004:** Muhammad no longer appears on the camera screen. He is seen live; the photo shows only the gap (bible §13.5.5: no story photograph holds his image).
- **M010–M012:** KB's batteries are now **dear** before the blackout, not cheap. T10 says the prices warn you.
- **M013:** the night slips appear "the next morning", not by afternoon.
- **M017:** Lula and Faty are "a year from finishing", not finalists. They are needed until Year 5. "The first eight are my mother's", so page nine is their own.
- **M018:** the broadcast is now heard at **6:06** (18:06), not 20:06. The health hour moves to 17:00.
- **M019:** the guest-player rule no longer contradicts itself. The final is against Engineering, so the rule allows a guest from any faculty with both deans' consent. It is now the left-back, not the captain-to-be, who is suspended. "Eleven players, you among them". A wrong callback was removed.
- **M020:** the statue's string stops at the pond. She faces the hospital only at night.
- **M021:** "IDK" started when Helen heard Jega's "Ban sani ba" at the trials. The joke stays his.
- **M022:** convocation is "the Saturday after exams".
- **M006, M009, M048:** the Maker was described exactly like M.I. BUGAJE ("light skin, dark coily hair"). He now has close-cropped grey hair (bible §13.4: no link is ever drawn).
- **M006, M016:** Taty's lines no longer carry clues the [ELSE] path lacks: the cats' reason, and the cat that stares at Muhammad.
- **M003 etc.:** the fresher Sadiq is renamed **Idris**. "Small Sadiq" is Aminu in Year 3.
- **M011:** Mubarak no longer knows about help he did not see.

**Year 2**
- **M035:** the suspect list no longer includes {{ROOMIE}}. Jiya no longer hints who told.
- **M037:** an unlisted Muhammad sighting is removed (the boy now lectures Sarki the goat). Jega no longer says "Helen" before M109. Helen's team never played Medicine (she studies Physiotherapy).
- **M027:** "Next month", so the padlocks reach the mall in the same term.
- **M029:** the Maker's number is new to you, not "in your contacts for a year".
- **M036:** the dead channel's silence reads as strange, not as "never quiet".
- **M039:** "out-of-season storm", not first rain in February.
- **M042:** Iron Mama "eases her pull". M32 said her diesel was already dry.
- **M044:** big word B3 is restored word for word, and "since the mall opened" replaces "two years".
- **M045:** Jiya's help no longer changes Year 3's debt.
- **M046:** Shamsu is absent from the gallery, as the Mystery line says.
- **M047:** "Five more" is removed from the noticeboard. It is Muhammad's private line on your note, and coil 2 is lit. "A whole semester" replaces "fourteen weeks".
- **M048:** "a few weeks ago". Lula and Faty stay on as graduate assistants.
- **M025:** "Your hall", not the men's hall.
- **M038:** Aliyu's daughter is renamed **Safiya**. Zara is a reserved future character.
- **M043:** the code-name vote no longer assumes eight people.

**Year 3**
- **M070:** the stools add up: **five** fallen and one that never fell. The names under them are "charred past reading", because the letter took his name. The 6:06 broadcast carries on after the tape stops, as the bible needs.
- **M067:** the padlock sale was in Year 2 ("the week after the mall opened"), matching M27–M45. Emily and the special characters no longer "return" from a strike they stayed through.
- **M061:** "the first time any of your friends has" seen him (Kaka and the children already had).
- **M058:** T11 is now planted: "Some visitors never sign."
- **M064:** "two weeks into six months".
- **M066:** Nusaiba texts from home, not "three states away".
- **M062, M072:** four semesters; twelve papers.

**Year 4**
- **M077/M092:** Tunde's sketch is the one he gave you in Year 1 (`tunde_sketch_y1`), not a second copy.
- **M073:** Door 7 now shows its filing cabinets (bible §1.8).
- **M077:** the tape is optional, so one sighting a year can be missed (§10.6 rule).
- **M078/M088:** "K." was a leftover from Kaltume and is removed.
- **M083:** the fake clip is built from your **Echo**, not you.
- **M085:** Jiya no longer comments on the extra-voter clue.
- **M079/M085:** "nominations open" / "elections week", not a four-month "week".
- **M086:** Asiya's photo is a head-and-shoulders portrait. Any wider photo older than thirty years must hold Muhammad.
- **M094:** "For years", "her housemanship".
- **M096:** "four years", and your own radio, not a gift that never happened.
- **M089:** {{ROOMIE}} added to Who.

**Year 5**
- **M116:** the Maker hangs the coat on the fence and laughs in shirtsleeves (bible §10.3). {{PARTNER}} **or {{ROOMIE}}** climbs to the bell.
- **M106:** the rebuilt coil hums in the workshop. It is carried down in M114.
- **M114:** Aliyu throws the feeder, **or Abbas if Aliyu is absent** (the M38 choice). The Maker's "Mind the fourth step" echo of Muhammad is removed. It tied them together too openly (§13.5).
- **M120:** the mall's plaque follows your M102 choice.
- **M102:** Clause 9 is twenty-five years, everywhere.
- **M118:** Zainab brings "a term of stories", since she cancelled her flight in M111. The Registrar is the Registrar, not Mrs. Adebayo.
- **M108:** "three years" of Firdausi's suspicion.
- **M111:** the statue is planted on the lantern walk. Chancellor Null's face is no longer spent early.

---

## 4. What is clean (confirmed by the pass)

- Every Muhammad sighting (MS-01 to MS-29) is exactly where §10.6 puts it, with none extra. Nobody calls him a ghost, a spirit or a time traveller. Muhammad touches no coil, seal or bell. Muhammad and the Maker share a frame only in M61 and M72.
- **Seals:** Engineering M24, Arts M36, Law M46, Agriculture M54, Medicine M64, Education M70, Physical Sciences M81, Computing M83, Life Sciences M90, Environmental Design M91. All ten are placed in M114 by a bearer from their own faculty.
- **Coils:** lit in M24, M44, M70, M81 and M90. The sixth is built M104–M106 and closes in M116.
- **Broadcast countdown:** seven (Year 1), six, five, four, then two and one on the last night.
- All 14 Rumi quotations are word for word and introduced as quotations. The ten big words match.
- No special character sees Muhammad or touches a seal, coil or bell, and every `[IF]` has an `[ELSE]`.
- Zainab is fair throughout. "Snow White" is used only by friends.
- No Kaltume, and no real university or town names.

---

## 5. Still open: for the next writing pass

These need real rewriting, not a word swap. None blocks building the engine.

**Structural (a few paragraphs each)**
1. **Female player, Year 2.**
   - In M043/M044, Firdausi is both {{ROOMIE}} and the lookout on the pharmacy roof. Give the roof role to "{{ROOMIE}}'s cousin" (Bature when {{ROOMIE}} is Firdausi), and recast `m044_close2_04`.
   - M025 (Musa B. asleep on your bed) and M047 (Shamsu knocking on your room door) need female-player variants.
2. **M050:** Mubarak both leaves on a bus and stays all strike. He should stay ("relocating inventory" to the market). Recount the six buses in steps 4 and M67 step 2.
3. **M103:** the faculty gifts are eleven items under ten headings. Environmental Design appears twice; Life Sciences has no gift. Rebuild the list. M106's "Chemistry… Fine Arts" lines must follow.
4. **M112 and M115:** Mai Shayi keeps the weathervane cloth in his pocket, yet hours later it hems Null's robe. Pick one.
5. **M105:** the dream framing risks the young Maker and Muhammad in one shot. Hide Muhammad at 22.5 and reframe, as M111 does.
6. **T4 groundwork:** no Year 2 scene shows Shamsu learning about the basement before M35. Add one line in M032 or M033.
7. **Lily's letter from the Maker** (bible §2.2, Year 4) is never delivered. See owner question 5.

**Mystery lines that promise beats the story does not show (about 25).** Either write the beat in (one sentence each) or trim the Mystery line:
- Y1: M002 (bank clock), M005 (snitch groundwork), M015 (C-SACK), M022 (C-AWAY), M023 (C-KB).
- Y2: M031 (gavel dots), M044 (padlock gap), M045 (invoice), M047 (noticeboard).
- Y3: M049 (desk symbol), M064 (Hauwa; Maker absent), M069 (Kaka's frame).
- Y4: M074, M078, M079, M083, M085, M087, M088, M089, M090, M092, M095.
- Y5: M099, M102, M107, M110 (the only page-41 echo after M98; the most important), M112, M114 (hot drawer).

**Small items**
- M014 `m014_play_t05` "Last month": M7 was weeks earlier.
- M019 and M023 list people in **Who:** who never appear.
- M016 (a towel that is always dry) and M011 (a pen from a closed bookshop) each give a sighting a second clue. Log them in §10.6, or cut one.
- M118's three special characters share one `[ELSE]`. Write "[ELSE, all three]".
- M112's cliff-tower signaller reads like an unlisted sighting. Make it "two figures, one with Bolaji's cousin's torch".

---

## 6. Clue ledger (what each mission actually plants and pays)

Ids are from `FORMAT.md` §3.4. "MS" is a Muhammad sighting (bible §10.6).

| M | Plants | Pays | MS |
|---|---|---|---|
| 1 | C-NOTE, C-SYMBOL, C-CLOCK, C-HUM, C-GOAT | | 01 |
| 2 | C-DOOR7, C-CLOCK; Garba's ledger | C-NOTE (half) | 02 |
| 3 | C-BROADCAST (from 7), first shade, C-KB | | |
| 4 | C-PHOTO (the gap) | | 03 |
| 5 | C-PAGE41, C-SEVENTH | C-SYMBOL | |
| 6 | C-NOTE ("I do not write notes"), C-BENCH, C-CATS, C-STATUE, C-TANKO | | |
| 7 | C-SYMBOL (under the court paint) | | |
| 8 | C-IDK | C-GOAT (T2) | |
| 9 | C-AWAY/C-BENCH (hospital garden), T11 | | |
| 10 | C-KB (batteries dear) | | |
| 11 | C-ECHO (Tunde's drawing, T7) | C-KB | 04 |
| 12 | C-CAPE, the Count (T3) | | |
| 13 | C-BOARD | | |
| 14 | | C-SYMBOL | |
| 15 | C-SISTER, the cliff tower | | |
| 16 | C-HUM (underwater), the relay core | | 05 |
| 17 | C-LAUGH (page nine) | | |
| 18 | C-AWAY, C-CATS (inward), C-BROADCAST | | |
| 19 | | | 06 |
| 20 | C-SEALS (ten sockets), C-SEVENTH, six plaques, C-STATUE, C-TANKO | Tanko's six-legs riddle | |
| 21 | C-IDK | | |
| 22 | C-NOTE ("Thirty years"), Garba's ledger | | |
| 23 | feeder "2", mall sticker | | |
| 24 | C-NOTE ("Five more."), C-SEALS (1), C-CAPE | T3, C-HUM (coil 1) | 07 |
| 25 | C-606 | | 08 |
| 26 | C-KB, the always-lit mall | | |
| 27 | C-PADLOCK (200 padlocks) | | |
| 28 | C-AWAY/C-BENCH, the unlit long road | | |
| 29 | site 2 kerb plate, C-KB, C-CATS, C-TANKO | feeder 2; Rumi Q5 | |
| 30 | C-PHOTO (empty reflection) | | 09 |
| 31 | the market grant, C-SEALS | | |
| 32 | plaque 2, ten sockets (T6), C-PADLOCK; B1 | | |
| 33 | C-PHOTO (oldest class photo, a face scratched out) | | |
| 34 | C-DOOR7 (Garba's palm) | | |
| 35 | C-SNITCH (T4) | | |
| 36 | C-BROADCAST (quiet) | Tanko's ten-mouths riddle; seal 2 | |
| 37 | C-IDK | | |
| 38 | Aliyu's choice | | |
| 39 | the road with no lamps | | 10 |
| 40 | C-BENCH (sweet on the pier) | | |
| 41 | C-SISTER (Asiya: no sister); B2 | | |
| 42 | C-BENCH (yellow blanket), T11 | | |
| 43 | C-KB (bread cheap) | | |
| 44 | Megawatt's "investment"; Q6, B3 | coil 2 | |
| 45 | Mubarak's sisters | power banks (M27) | |
| 46 | C-SEALS (3) | the grant | 11 |
| 47 | C-SNITCH (nearly told) | | |
| 48 | C-PHOTO, C-BROADCAST ("Six") | | 12 |
| 49 | C-SNITCH | | |
| 50 | welfare committee | | 13 |
| 51 | the déjà vu loop (for M80), C-KB | | |
| 52 | | C-KB | |
| 53 | C-BROADCAST (three notes), C-SEVENTH | | 14 |
| 54 | C-SYMBOL (ram's bell) | seal 4 | |
| 55 | C-PHOTO (Kaka's frame) | | 15 |
| 56 | C-PADLOCK (T5), C-AWAY | | |
| 57 | the grey chair | | |
| 58 | C-SYMBOL (signature), T11, Seoul | | |
| 59 | C-BROADCAST | | |
| 60 | C-SEVENTH (stools), reel 5 | C-BROADCAST (whose voice), C-SEALS (T6) | |
| 61 | C-SEVENTH; B4, Q1 | reel 5; who the Maker is (half) | 16 |
| 62 | | C-SNITCH (T4) | |
| 63 | the scout's card | | 17 |
| 64 | C-HUM (Hauwa) | seal 5 | |
| 65 | C-SYMBOL, C-CLOCK, the half tower | | |
| 66 | C-PADLOCK (Plug sticker); Q8 | the Idle King | |
| 67 | | C-PADLOCK (half) | |
| 68 | Nusaiba will run | C-PADLOCK (T5) | |
| 69 | "Professor" (the mahogany) | "Follow my light" | |
| 70 | C-SEVENTH (stool falls); B5 | coil 3, seal 6 | |
| 71 | C-AWAY in reverse; Q2 | Jega and Helen | |
| 72 | C-PHOTO (the road), "an old argument" | Seoul | 18 |
| 73 | C-DOOR7 (cabinets), C-PHOTO | | 19 |
| 74 | C-SEVENTH (Aliyu's ring) | | |
| 75 | C-SYMBOL (comment), C-ECHO | | |
| 76 | C-ECHO (late reflection) | | |
| 77 | C-AWAY/C-CAPE (bare vane) | T7 | 20 |
| 78 | | | |
| 79 | C-CAPE (posters) | | |
| 80 | C-HUM, Wednesday's "eleven—" | T8 | |
| 81 | C-SACK (empty), C-SYMBOL; B6 | T9, coil 4, seal 7 | |
| 82 | C-ECHO; Q9 | | |
| 83 | | C-ECHO, seal 8 | |
| 84 | C-SISTER (boat photo), C-PHOTO, C-CATS | | 21 |
| 85 | one voter too many | | |
| 86 | C-SISTER (Asiya's uncle) | | |
| 87 | C-HUM | | |
| 88 | | | |
| 89 | "Thank you. A." | | |
| 90 | C-HUM, C-SISTER (fish); Q11 | coil 5, seal 9 | |
| 91 | C-SISTER (thumbprint), C-STATUE | seal 10 | |
| 92 | Q3, B7 | C-ECHO | |
| 93 | C-BENCH (sweet) | | |
| 94 | C-BENCH/C-AWAY ("Confidentiality") | | 22 |
| 95 | | {{ROOMIE}}'s results | |
| 96 | C-COAT, C-BROADCAST ("Four."), C-SEVENTH, C-AWAY | | |
| 97 | C-NOTE, C-606 (tin moved) | C-NOTE (T1) | 23 |
| 98 | C-SEVENTH ("someone who will leave"); B8 | C-PAGE41 | |
| 99 | | | |
| 100 | | | 24 |
| 101 | C-KB, C-CLOCK, C-SISTER (footprints) | C-DOOR7 (half) | |
| 102 | | | |
| 103 | C-BENCH (sweet in the crate) | | |
| 104 | C-AWAY, C-HUM | | |
| 105 | C-SEVENTH, C-COAT; Q7 | | 25 |
| 106 | C-SEVENTH; B9 | C-HUM | |
| 107 | C-IDK | | |
| 108 | C-LETTER (your hand), C-AWAY, C-BROADCAST | C-KB (T10) | |
| 109 | C-PHOTO (one face too many) | C-IDK | |
| 110 | | | |
| 111 | C-BROADCAST ("Two"), C-STATUE; Q10 | C-AWAY (T11) | 26 |
| 112 | C-CATS | | |
| 113 | C-TANKO, C-SACK | | |
| 114 | C-DOOR7 (Garba's ink), C-SEVENTH; Q4 | C-SEALS | 27 |
| 115 | C-COAT, C-CAPE | C-LETTER (T12) | |
| 116 | C-SISTER ("Ai—"); B10, Q12, Q13 | C-CLOCK, C-SEVENTH, C-LAUGH, C-BROADCAST (T13) | 28 (absent) |
| 117 | C-PHOTO | | 28 |
| 118 | C-SISTER ("She came"), C-COAT | | 28 |
| 119 | C-NOTE (the pen), C-606 | | 28 |
| 120 | | C-606, C-NOTE, T1, T14 | 29 |

**Open questions at the end of the game** (bible §1.8), as the scripts now stand:
- Answered: the note (M97), the snitch (M62), the halls (M68), page 41 (M98, opening "who will leave?").
- Half-answered: the dark (M24; the Idlers M56/M66), who the Maker is (M61, M115), the radio voice (M60), Door 7 (M101).
- Shown, not explained: the clock and the seventh space (M116).
- Hinted: where he goes (M111).
- Never answered: the sister, and Muhammad.

---

## 7. Questions for you (10)

1. **The two Aishas.** Hajiya Ladi's daughter shares the Maker's sister's secret name. Keep it as a deliberate, unexplained echo? *(Recommended: yes. Nobody remarks on it.)*
2. **The hospital hint.** M9, M28, M42, M94 and M111 point at the hospital garden, and M64 now also puts a wrapped sweet on the hospital bench. Keep all of it, or remove the sweet? *(Recommended: keep the hint, remove the M64 sweet. The sweets belong to the sister's bench.)*
3. **Tracker #28.** M117 shows a hand holding the gate open in your last photograph, but the rule says no story photograph holds Muhammad. Allow this one exception, a hand and not a face? *(Recommended: yes.)*
4. **Taty's language.** M66 and M78 already use Portuguese ("Meu Deus!"). Portuguese or Italian?
5. **Lily's Year 4 letter** from the Maker (bible §2.2) is never written. Write it into M84 or M91, or drop it from the bible?
6. **Special-character load.** As written: Jiya 32 main missions, Taty 34, Madison 21 (FORMAT's old target was 14, 15 and 9). Keep it, or trim Year 1 cameos?
7. **Garba's ledger** (M2, M22): your name is already in a column whose heading he covers. Proposed truth: it is the list of Baba Porter's picks over forty years. Approve, or cut M22's sentence?
8. **Kaka's photograph turned to the wall** (M55, M69). Proposed truth: her own class photo, with Muhammad in the back row; she turned it because she is the only one who remembers him. Approve, or cut?
9. **Jiya at the seal door** (M114). She reads the right of way aloud, which comes close to "special characters never carry plot". Keep, or give the reading to Nusaiba and move Jiya's lines to the tunnel? *(Recommended: Nusaiba reads it.)*
10. **Mubarak in the strike** (M50). He should stay on campus all strike, selling. Approve, so the writer can fix §5 item 2?

The earlier list in bible §12 (seals, Shamsu as the snitch, place names, and so on) is still open too.
