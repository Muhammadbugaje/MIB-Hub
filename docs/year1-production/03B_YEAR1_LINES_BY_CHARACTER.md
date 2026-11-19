# 03B · Year 1 Lines by Character

> **What this is:** every spoken line in Year 1, grouped by the character who says it, with mission, scene, line ID, mood and source. Use it to cast, schedule recording, check coverage, and audit that no character has been left silent or given another character’s voice.

> **The IDs are the contract.** A line ID is used by the voice file, the subtitle track, the cutscene timeline and the tests. Never renumber, merge or “improve” a line. Record the text exactly as written, including ellipses, interruptions and dropped letters.

---

## 1 · Coverage at a glance

| Measure | Count |
|---|---:|
| Rows in this document (one per cast part) | 449 |
| Canon cutscene rows (includes 36 Roommate duplicates) | 357 |
| Distinct canon cutscene lines | 321 |
| Conditional cutscene inserts | 9 |
| Conditional gameplay lines | 80 |
| Runtime-token slots | 3 |
| All conditional rows | 89 |
| Characters with at least one line | 61 |

**How the count reconciles.** `Y1.md` contains **333** spoken cutscene lines: **321** distinct canon lines, **9** conditional cutscene inserts, and **3** runtime tokens. The per-character voice scripts under `docs/voice/scripts/` contain **446** rows: the 321 canon lines, plus **9** conditional cutscene inserts, plus **80** conditional gameplay lines, plus **36** duplicate rows for the two Roommate castings, with the 3 tokens omitted. This document restores the tokens, expands the aggregated “Small Parts” voice script back into individual speakers, and lists the Roommate under both castings: **449** rows.

**Source legend.**

| Source | Meaning |
|---|---|
| `cutscene` | Canon dialogue inside an authored cutscene. Record it. |
| `insert (conditional)` | A cutscene line inside an `if: special.*` block. Cut it cleanly when the flag is off. |
| `gameplay (conditional)` | A gameplay bark that exists only for a special character. Never in the canon pass. |
| `TOKEN` | A slot filled at runtime by an earlier result. The bracketed text is not dialogue. |

**Moods.** Moods are performance directions from the canon timeline. `—` means the source gives none; use the character’s established register, not a new emotion.

---

## 2 · Known coverage notes

1. **Three runtime tokens are not recordable.** `m013_mid1_03` (Dad’s lecture line, chosen by grades and spending), `m021_mid1_03` (Helen’s gift line, corn or flowers) and `m021_close_01` (the Companion’s line, by who came). The build must select and supply the text before the scene; it must never send the bracket to an actor.
2. **The Roommate is two castings.** Bature and Firdausi share every Roommate line and differ only in name and look. Cast one. This document lists the shared lines under both so neither actor’s script has a hole.
3. **Bature has three extra lines in M018.** `m018_open_05`, `m018_mid1_01` and `m018_mid1_03` belong to Bature specifically, because he always auditions at Ring Road FM. If Firdausi is the Roommate, Bature is still her cousin and still in the booth; Firdausi has no lines there by design, not by omission.
4. **“Small Parts” is expanded here.** The voice scripts aggregate 24 minor lines under one casting label. This document resolves each to its scene speaker through the cutscene cast block, so the Registry clerk, the SUG porter, the examiner, the dean and the rest are individually castable.
5. **Local labels can mean different people.** `PORTER` is Baba Porter in M001 and the SUG Porter in M010. `CLERK` is Mrs. Adebayo in M002 and the Engineering Clerk in M020. This document resolves by cast value, not by label.
6. **No unconditional gameplay barks exist in `Y1.md`.** Playable dialogue is scripted only for the conditional special characters. Do not invent idle chatter for the canon cast to “fill” the game; use the authored cutscene lines and the mission’s visual storytelling instead.

---

## 3 · Cast index

| Character | Lines | Conditional | Missions |
|---|---:|---:|---|
| [The Fresher](#the-fresher) | 36 | 0 | M001, M002, M003, M004, M005, M006, M008, M009, M010, M011, M012, M013, M014, M015, M017, M018, M021, M022, M023, M024 |
| [Bature](#bature) | 39 | 0 | M001, M003, M006, M007, M008, M011, M012, M013, M014, M015, M016, M018, M022, M023 |
| [Firdausi](#firdausi) | 36 | 0 | M001, M003, M006, M007, M008, M011, M012, M013, M014, M015, M016, M022, M023 |
| [Mum](#mum) | 7 | 0 | M001, M013 |
| [Dad](#dad) | 6 | 0 | M001, M013 |
| [Jega](#jega) | 23 | 0 | M008, M009, M012, M019, M021 |
| [Shamsu](#shamsu) | 18 | 0 | M005, M008, M011, M012, M019, M023, M024 |
| [Mubarak](#mubarak) | 17 | 0 | M004, M010, M012 |
| [Nusaiba](#nusaiba) | 4 | 0 | M005, M012, M019 |
| [Dr. Zainab](#dr-zainab) | 15 | 0 | M009, M018, M023 |
| [Aleeya](#aleeya) | 3 | 0 | M002, M017 |
| [Lyzzy](#lyzzy) | 6 | 0 | M004, M018, M020 |
| [Lily](#lily) | 2 | 0 | M004, M020 |
| [Abbas](#abbas) | 2 | 0 | M007, M014 |
| [Helen](#helen) | 7 | 0 | M021 |
| [Bolaji](#bolaji) | 5 | 0 | M012, M014 |
| [Bolaji (as Sly)](#bolaji-as-sly) | 5 | 0 | M007 |
| [Muhammad](#muhammad) | 8 | 0 | M002, M011, M016 |
| [Tunde](#tunde) | 2 | 0 | M011 |
| [Kelechi](#kelechi) | 4 | 0 | M020 |
| [Baba Dam](#baba-dam) | 7 | 0 | M015, M016 |
| [Lula](#lula) | 3 | 0 | M017 |
| [Faty](#faty) | 6 | 0 | M017 |
| [Baba Porter](#baba-porter) | 7 | 0 | M001, M003, M022 |
| [The Maker](#the-maker) | 11 | 0 | M006, M015, M020, M022 |
| [Mai Shayi](#mai-shayi) | 9 | 0 | M006, M024 |
| [Alhaji Needle](#alhaji-needle) | 2 | 0 | M004 |
| [Mama Nkechi](#mama-nkechi) | 2 | 0 | M003 |
| [Malam Sule](#malam-sule) | 5 | 0 | M001 |
| [Malam Garba](#malam-garba) | 2 | 0 | M002, M024 |
| [Mrs. Adebayo](#mrs-adebayo) | 2 | 0 | M002 |
| [Mr. Clement](#mr-clement) | 1 | 0 | M002 |
| [Dr. Khadija](#dr-khadija) | 3 | 0 | M013 |
| [Dr. Okonkwo](#dr-okonkwo) | 4 | 0 | M005, M020 |
| [Nurse Hauwa](#nurse-hauwa) | 1 | 0 | M009 |
| [Coach Danladi](#coach-danladi) | 2 | 0 | M008, M019 |
| [Coach Ngozi](#coach-ngozi) | 3 | 0 | M014 |
| [Ranger Lawal](#ranger-lawal) | 2 | 0 | M015 |
| [Engr. Aliyu](#engr-aliyu) | 3 | 0 | M023 |
| [DJ Kabiru](#dj-kabiru) | 5 | 0 | M018 |
| [Hajiya Ladi](#hajiya-ladi) | 3 | 0 | M010 |
| [Wednesday](#wednesday) | 3 | 0 | M005, M018 |
| [Tanko](#tanko) | 4 | 0 | M006, M020 |
| [Basit](#basit) | 1 | 0 | M017 |
| [Emeka](#emeka) | 1 | 0 | M017 |
| [Big Baby](#big-baby) | 2 | 0 | M007 |
| [Gate Guard](#gate-guard) | 1 | 0 | M001 |
| [The Students](#the-students) | 3 | 0 | M011, M012, M024 |
| [The Freshers](#the-freshers) | 3 | 0 | M001, M003, M004 |
| [The Companion](#the-companion) | 1 | 0 | M021 |
| [Small Boy](#small-boy) | 1 | 0 | M019 |
| [Sophomore Customer](#sophomore-customer) | 2 | 0 | M010 |
| [Dean of Engineering](#dean-of-engineering) | 2 | 0 | M024 |
| [Driving Examiner](#driving-examiner) | 1 | 0 | M017 |
| [Law Lecturer](#law-lecturer) | 2 | 0 | M005 |
| [Suya Man](#suya-man) | 1 | 0 | M001 |
| [Hassan](#hassan) | 2 | 0 | M007, M014 |
| [Radio (old transmitter)](#radio-old-transmitter) | 2 | 0 | M003, M018 |
| [Jiya](#jiya) | 33 | 33 | M002, M007, M017, M019, M005, M011, M022, M023, M024 |
| [Taty](#taty) | 40 | 40 | M008, M012, M014, M016, M001, M006, M015, M019, M020, M022, M023, M024 |
| [Madison](#madison) | 16 | 16 | M004, M010, M018, M021, M022, M024 |
| **Total** | **449** | **89** | |

> Conditional rows are listed at the end of their character’s section, separated from canon. Jiya, Taty and Madison have their own sections under “Conditional specials” and must never be cast or promoted as part of the canon ensemble.

---

## The Fresher

**Lines:** 36 · **Canon cutscene:** 36 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m001_open_p01` | M001 · Film E | “…My biscuits.” | dry | cutscene |
| `m001_mid1_p01` | M001 · Mid-scene 1 | “…That goat is looking at me.” | dry | cutscene |
| `m002_open_p01` | M002 · Opening | “…Thank you?” | dry | cutscene |
| `m002_mid1_p01` | M002 · Mid-scene 1 | “How do you know my name?” | neutral | cutscene |
| `m003_open_p01` | M003 · Opening | “Will you help?” | neutral | cutscene |
| `m004_open_p01` | M004 · Opening | “My gown?” | neutral | cutscene |
| `m004_open_p02` | M004 · Opening | “Today is Friday.” | dry | cutscene |
| `m004_close_p01` | M004 · Closing | “Who's that? Back row.” | neutral | cutscene |
| `m005_open_p01` | M005 · Opening | “…A kind of cake?” | shy | cutscene |
| `m005_open_p02` | M005 · Opening | “Wrong theatre.” | whisper | cutscene |
| `m005_mid1_p01` | M005 · Mid-scene 1 | “…No.” | dry | cutscene |
| `m006_open_p01` | M006 · Opening | “And the Maker?” | neutral | cutscene |
| `m006_mid1_p01` | M006 · Mid-scene 1 | “Did you write this?” | neutral | cutscene |
| `m006_close_p01` | M006 · Closing | “Nothing. …I think.” | whisper | cutscene |
| `m008_mid1_p01` | M008 · Mid-scene 1 | “Why 'Sheikh'?” | neutral | cutscene |
| `m008_close_p01` | M008 · Closing | “What's her name?” | neutral | cutscene |
| `m009_open_p01` | M009 · Opening | “You're bleeding.” | scared | cutscene |
| `m009_close_p01` | M009 · Closing | “Sorry, Doctor.” | shy | cutscene |
| `m010_open_p01` | M010 · Opening | “It's a locker.” | dry | cutscene |
| `m011_mid1_p01` | M011 · Mid-scene 1 | “No. No no no.” | scared | cutscene |
| `m011_close_p01` | M011 · Closing | “Who's that? Behind me.” | neutral | cutscene |
| `m012_open_p01` | M012 · Opening | “There are hundreds.” | whisper | cutscene |
| `m013_open_p01` | M013 · Opening | “We move.” | neutral | cutscene |
| `m013_mid1_p01` | M013 · Mid-scene 1 | “Yes, sir.” | shy | cutscene |
| `m014_close_p01` | M014 · Closing | “Same time next week?” | warm | cutscene |
| `m015_mid1_p01` | M015 · Mid-scene 1 | “What's that? On the cliff.” | neutral | cutscene |
| `m017_open_p01` | M017 · Opening | “…Is this the test?” | scared | cutscene |
| `m017_close_p01` | M017 · Closing | “And nine?” | neutral | cutscene |
| `m018_open_p01` | M018 · Opening | “It IS Wednesday.” | dry | cutscene |
| `m018_mid1_p01` | M018 · Mid-scene 1 | “And now the weather. Dust.” | neutral | cutscene |
| `m018_close_p01` | M018 · Closing | “Who is she?” | whisper | cutscene |
| `m021_open_p01` | M021 · Opening | “Just say her name.” | dry | cutscene |
| `m021_mid1_p01` | M021 · Mid-scene 1 | “A friend. Tall. Behind a tree.” | neutral | cutscene |
| `m022_close_p01` | M022 · Closing | “Asked by who?” | neutral | cutscene |
| `m023_open_p01` | M023 · Opening | “Read.” | stern | cutscene |
| `m024_open_p01` | M024 · Opening | “Everybody. With me.” | stern | cutscene |

## Bature

**Lines:** 39 · **Canon cutscene:** 39 · **Runtime tokens:** 0 · **Conditional:** 0

*Roommate casting A. Shares all Roommate lines with Firdausi; also has three M018 radio lines of his own.*

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m001_open_01` | M001 · Film E | “Ah, you're awake. I was guarding your biscuits.” | amused | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m001_open_02` | M001 · Film E | “From inside.” | dry | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m001_open_03` | M001 · Film E | “Riddle: what's yours, but your roommate uses it more?” | excited | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m001_open_04` | M001 · Film E | “Your NAME. But also the biscuits.” | amused | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m001_open_05` | M001 · Film E | “Come and see your kingdom.” | warm | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m001_mid1_03` | M001 · Mid-scene 1 | “Freshers chase. It's tradition. Since now.” | excited | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m001_close_01` | M001 · Closing | “…Don't lose that.” | whisper | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m003_open_03` | M003 · Opening | “I'm more of a consultant.” | proud | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m003_open_04` | M003 · Opening | “KB sold out of candles. At noon. Who knew?” | whisper | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m003_mid1_02` | M003 · Mid-scene 1 | “They have taken light. Welcome to university.” | dry | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m003_mid1_03` | M003 · Mid-scene 1 | “Plan B. Garri. Cold water only.” | stern | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m003_mid1_04` | M003 · Mid-scene 1 | “Hot water? You want eba by accident?” | amused | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m003_close_02` | M003 · Closing | “Old thing. It does that.” | bored | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m006_open_02` | M006 · Opening | “I'll pay with a riddle. What has keys but no door?” | excited | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m006_close_02` | M006 · Closing | “Two goats. Tired.” | excited | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m006_close_04` | M006 · Closing | “What are you looking at?” | neutral | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m007_close_06` | M007 · Closing | “What's two metres tall and fears a hairdresser?” | amused | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m008_mid1_02` | M008 · Mid-scene 1 | “Sheikh Biru! Lecture us on football!” | amused | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m011_open_02` | M011 · Opening | “It is never simple when he says that.” | whisper | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m011_open_05` | M011 · Opening | “Forty moths. One Professor.” | amused | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m012_open_01` | M012 · Opening | “Riddle me this. …No. Not tonight.” | scared | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m012_open_02` | M012 · Opening | “And everybody's reading. Alone.” | whisper | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m012_open_03` | M012 · Opening | “One torch is a snack. Five is a problem.” | stern | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m012_close_02` | M012 · Closing | “We have a paper at eight. Why am I happy?” | amused | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m012_close_03` | M012 · Closing | “…That wasn't there yesterday.” | whisper | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m013_open_01` | M013 · Opening | “Riddle: what is A4, and ruins your life?” | scared | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m013_open_02` | M013 · Opening | “We don't move. We are carried.” | dry | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m014_open_02` | M014 · Opening | “'B.B.' She signed it. So it's real.” | whisper | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m014_open_03` | M014 · Opening | “The gym opens at seven. I'll watch. From far.” | amused | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m015_open_01` | M015 · Opening | “Riddle: what is free, wet, and full of fi—” | excited | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m015_close_03` | M015 · Closing | “Good evening to you too, Baba Ranger.” | amused | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m016_open_02` | M016 · Opening | “That's the garden's sound. Under WATER.” | whisper | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m016_open_04` | M016 · Opening | “I'm the loud one. I'll stay up here and be loud.” | scared | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m016_close_02` | M016 · Closing | “Who are you talking to? I heard you talking!” | scared | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m018_open_05` | M018 · Opening | “I ironed a shirt. For radio. Is that normal?” | scared | cutscene |
| `m018_mid1_01` | M018 · Mid-scene 1 | “Good… good evening. This is, um. The news.” | scared | cutscene |
| `m018_mid1_03` | M018 · Mid-scene 1 | “Riddle: what goes off without warning? Our light.” | amused | cutscene |
| `m022_open_06` | M022 · Opening | “EVERYBODY. Underlined. Twice. Start walking.” | excited | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m023_open_01` | M023 · Opening | “Riddle: what has four papers and no mercy?” | scared | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |

## Firdausi

**Lines:** 36 · **Canon cutscene:** 36 · **Runtime tokens:** 0 · **Conditional:** 0

*Roommate casting B. Shares all Roommate lines with Bature; has no M018 booth lines by design.*

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m001_open_01` | M001 · Film E | “Ah, you're awake. I was guarding your biscuits.” | amused | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m001_open_02` | M001 · Film E | “From inside.” | dry | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m001_open_03` | M001 · Film E | “Riddle: what's yours, but your roommate uses it more?” | excited | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m001_open_04` | M001 · Film E | “Your NAME. But also the biscuits.” | amused | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m001_open_05` | M001 · Film E | “Come and see your kingdom.” | warm | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m001_mid1_03` | M001 · Mid-scene 1 | “Freshers chase. It's tradition. Since now.” | excited | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m001_close_01` | M001 · Closing | “…Don't lose that.” | whisper | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m003_open_03` | M003 · Opening | “I'm more of a consultant.” | proud | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m003_open_04` | M003 · Opening | “KB sold out of candles. At noon. Who knew?” | whisper | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m003_mid1_02` | M003 · Mid-scene 1 | “They have taken light. Welcome to university.” | dry | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m003_mid1_03` | M003 · Mid-scene 1 | “Plan B. Garri. Cold water only.” | stern | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m003_mid1_04` | M003 · Mid-scene 1 | “Hot water? You want eba by accident?” | amused | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m003_close_02` | M003 · Closing | “Old thing. It does that.” | bored | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m006_open_02` | M006 · Opening | “I'll pay with a riddle. What has keys but no door?” | excited | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m006_close_02` | M006 · Closing | “Two goats. Tired.” | excited | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m006_close_04` | M006 · Closing | “What are you looking at?” | neutral | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m007_close_06` | M007 · Closing | “What's two metres tall and fears a hairdresser?” | amused | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m008_mid1_02` | M008 · Mid-scene 1 | “Sheikh Biru! Lecture us on football!” | amused | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m011_open_02` | M011 · Opening | “It is never simple when he says that.” | whisper | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m011_open_05` | M011 · Opening | “Forty moths. One Professor.” | amused | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m012_open_01` | M012 · Opening | “Riddle me this. …No. Not tonight.” | scared | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m012_open_02` | M012 · Opening | “And everybody's reading. Alone.” | whisper | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m012_open_03` | M012 · Opening | “One torch is a snack. Five is a problem.” | stern | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m012_close_02` | M012 · Closing | “We have a paper at eight. Why am I happy?” | amused | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m012_close_03` | M012 · Closing | “…That wasn't there yesterday.” | whisper | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m013_open_01` | M013 · Opening | “Riddle: what is A4, and ruins your life?” | scared | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m013_open_02` | M013 · Opening | “We don't move. We are carried.” | dry | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m014_open_02` | M014 · Opening | “'B.B.' She signed it. So it's real.” | whisper | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m014_open_03` | M014 · Opening | “The gym opens at seven. I'll watch. From far.” | amused | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m015_open_01` | M015 · Opening | “Riddle: what is free, wet, and full of fi—” | excited | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m015_close_03` | M015 · Closing | “Good evening to you too, Baba Ranger.” | amused | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m016_open_02` | M016 · Opening | “That's the garden's sound. Under WATER.” | whisper | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m016_open_04` | M016 · Opening | “I'm the loud one. I'll stay up here and be loud.” | scared | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m016_close_02` | M016 · Closing | “Who are you talking to? I heard you talking!” | scared | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m022_open_06` | M022 · Opening | “EVERYBODY. Underlined. Twice. Start walking.” | excited | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |
| `m023_open_01` | M023 · Opening | “Riddle: what has four papers and no mercy?” | scared | cutscene<br><sub>Roommate variant — cast one, not both.</sub> |

## Mum

**Lines:** 7 · **Canon cutscene:** 7 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m001_film_03` | M001 · Film B | “Don't follow bad friends.” | stern | cutscene |
| `m001_film_04` | M001 · Film B | “Don't follow good friends too closely either.” | stern | cutscene |
| `m001_film_05` | M001 · Film B | “Eat. Pray. Call me.” | warm | cutscene |
| `m001_film_07` | M001 · Film B | “You took a bus.” | dry | cutscene |
| `m001_film_12` | M001 · Film D | “CALL ME!” | excited | cutscene |
| `m013_mid1_04` | M013 · Mid-scene 1 | “Give me the phone. Have you eaten?” | warm | cutscene |
| `m013_mid1_05` | M013 · Mid-scene 1 | “He's prouder than he sounds. Eat.” | whisper | cutscene |

## Dad

**Lines:** 6 · **Canon cutscene:** 5 · **Runtime tokens:** 1 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m001_film_01` | M001 · Film B | “This is not the main gate.” | stern | cutscene |
| `m001_film_06` | M001 · Film B | “When I was your age I trekked to school.” | proud | cutscene |
| `m001_film_11` | M001 · Film C | “Manage it.” | whisper | cutscene |
| `m013_mid1_01` | M013 · Mid-scene 1 | “I am not angry.” | neutral | cutscene |
| `m013_mid1_02` | M013 · Mid-scene 1 | “I am only calculating.” | stern | cutscene |

**Runtime tokens**

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m013_mid1_03` | M013 · Mid-scene 1 | **TOKEN** `[LECTURE_LINE: chosen by grades and spending]` | stern | TOKEN |

## Jega

**Lines:** 23 · **Canon cutscene:** 23 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m008_open_01` | M008 · Opening | “Takalmin hagu tukuna. (Left boot first.)” | neutral | cutscene |
| `m008_open_02` | M008 · Opening | “Always. Don't argue with success.” | proud | cutscene |
| `m008_open_04` | M008 · Opening | “Kai! You chased the goat. Wallahi, you're on my side.” | excited | cutscene |
| `m008_open_05` | M008 · Opening | “Mu je! (Let's go!)” | excited | cutscene |
| `m008_mid1_07` | M008 · Mid-scene 1 | “Haba, Professor! Ball first, sermon later!” | amused | cutscene |
| `m008_close_01` | M008 · Closing | “…Ban sani ba. (I don't know.)” | shy | cutscene |
| `m008_close_02` | M008 · Closing | “Kai, {{PLAYER\_NAME}}. We have a cup to win.” | warm | cutscene |
| `m009_open_01` | M009 · Opening | “Kai. …Did we score?” | neutral | cutscene |
| `m009_open_02` | M009 · Opening | “Ba matsala. (No problem.) It's only the face.” | amused | cutscene |
| `m009_mid1_08` | M009 · Mid-scene 1 | “In goal: Yusuf. Left back: Sani. Striker: me…” | scared | cutscene |
| `m012_mid2_01` | M012 · Mid-scene 2 | “Kai. It's wearing a cape.” | scared | cutscene |
| `m019_open_02` | M019 · Opening | “My mother's socks. Don't laugh.” | shy | cutscene |
| `m019_open_03` | M019 · Opening | “…You can laugh small.” | amused | cutscene |
| `m019_open_05` | M019 · Opening | “Takalmin hagu tukuna. Mu je!” | excited | cutscene |
| `m019_close_01` | M019 · Closing | “Next year you will see it. Wallahi.” | warm | cutscene |
| `m019_close_02` | M019 · Closing | “Right boot first. Once. For a child. Kai.” | sad | cutscene |
| `m019_close_03` | M019 · Closing | “Mu sake. (We go again.) Next year.” | warm | cutscene |
| `m021_open_01` | M021 · Opening | “Kai. Come. I have a tactical problem.” | whisper | cutscene |
| `m021_open_02` | M021 · Opening | “Ban sani ba. (I don't know.) Officially.” | proud | cutscene |
| `m021_open_03` | M021 · Opening | “Let me practise. Sannu… no. Hello… no.” | scared | cutscene |
| `m021_open_04` | M021 · Opening | “Kai! …No. She is not a goalkeeper.” | sad | cutscene |
| `m021_open_05` | M021 · Opening | “You go. You chased a goat. You fear nothing.” | warm | cutscene |
| `m021_close_02` | M021 · Closing | “(…Is it going well? I can't tell.)” | whisper | cutscene |

## Shamsu

**Lines:** 18 · **Canon cutscene:** 18 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m005_mid1_01` | M005 · Mid-scene 1 | “Simple. A capacitor is a bucket.” | whisper | cutscene |
| `m005_mid1_02` | M005 · Mid-scene 1 | “A resistor is your uncle. Current is the salary.” | whisper | cutscene |
| `m005_mid1_03` | M005 · Mid-scene 1 | “Good. Confusion is the first step.” | warm | cutscene |
| `m008_mid1_01` | M008 · Mid-scene 1 | “Simple. The spin, the wet grass, the angle…” | neutral | cutscene |
| `m008_mid1_03` | M008 · Mid-scene 1 | “A goat was eating a sachet. I said something.” | shy | cutscene |
| `m008_mid1_04` | M008 · Mid-scene 1 | “I was not preaching. I was ADVISING the goat.” | proud | cutscene |
| `m008_mid1_05` | M008 · Mid-scene 1 | “Possibly I did not close the gate.” | whisper | cutscene |
| `m008_mid1_06` | M008 · Mid-scene 1 | “…Oh. That was you. Sorry. Also, thank you.” | shy | cutscene |
| `m011_open_01` | M011 · Opening | “Simple.” | warm | cutscene |
| `m011_open_03` | M011 · Opening | “In sha Allah, you will all pass.” | warm | cutscene |
| `m011_mid1_05` | M011 · Mid-scene 1 | “{{PLAYER\_NAME}}! Who are you talking to?” | neutral | cutscene |
| `m012_mid2_02` | M012 · Mid-scene 2 | “Technically, that is not possible.” | scared | cutscene |
| `m019_mid1_02` | M019 · Mid-scene 1 | “Technically… we have won? I'm sorry. We've won.” | shy | cutscene |
| `m023_mid1_04` | M023 · Mid-scene 1 | “I was not asleep. I have a diagram.” | neutral | cutscene |
| `m023_mid1_05` | M023 · Mid-scene 1 | “Technically we are not allowed. Bring a torch.” | whisper | cutscene |
| `m023_close_04` | M023 · Closing | “There are seven. My diagram has six.” | whisper | cutscene |
| `m024_open_01` | M024 · Opening | “That is too much load. That is all seven feeders.” | scared | cutscene |
| `m024_open_02` | M024 · Opening | “That is—” | scared | cutscene |

## Mubarak

**Lines:** 17 · **Canon cutscene:** 17 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m004_open_03` | M004 · Opening | “My guy! Premium gown. For you, specially.” | excited | cutscene |
| `m004_open_04` | M004 · Opening | “See? Fine. Don't look down.” | proud | cutscene |
| `m004_close_03` | M004 · Closing | “Your change? Ah. Take my number instead.” | proud | cutscene |
| `m004_close_04` | M004 · Closing | “Trust me. It will appreciate.” | amused | cutscene |
| `m010_open_01` | M010 · Opening | “Welcome to The Plug. I know a guy.” | proud | cutscene |
| `m010_open_02` | M010 · Opening | “It's a FLAGSHIP locker.” | proud | cutscene |
| `m010_open_03` | M010 · Opening | “I don't sell products. I sell advantages.” | excited | cutscene |
| `m010_open_04` | M010 · Opening | “Wear these. Run. You'll understand.” | warm | cutscene |
| `m010_mid1_03` | M010 · Mid-scene 1 | “Hajiya, I have a brand.” | proud | cutscene |
| `m010_close_02` | M010 · Closing | “That is the product.” | warm | cutscene |
| `m010_close_04` | M010 · Closing | “Refund? In this economy?” | excited | cutscene |
| `m010_close_05` | M010 · Closing | “Let me give you something better. Advice.” | warm | cutscene |
| `m010_close_06` | M010 · Closing | “Good afternoon, sir. Table-tennis balls?” | neutral | cutscene |
| `m010_close_07` | M010 · Closing | “(Trust the Plug.)” | whisper | cutscene |
| `m012_mid1_01` | M012 · Mid-scene 1 | “Torch! Premium torch! Three hundred!” | excited | cutscene |
| `m012_mid1_02` | M012 · Mid-scene 1 | “…God, You are watching me.” | whisper | cutscene |
| `m012_mid1_03` | M012 · Mid-scene 1 | “Take. Take! Don't thank me. I am suffering.” | sad | cutscene |

## Nusaiba

**Lines:** 4 · **Canon cutscene:** 4 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m005_mid1_04` | M005 · Mid-scene 1 | “With respect, ma. That sign should be negative.” | neutral | cutscene |
| `m005_mid1_05` | M005 · Mid-scene 1 | “I have three reasons.” | proud | cutscene |
| `m012_mid2_03` | M012 · Mid-scene 2 | “Torches down, not in faces. Line up. NOW.” | stern | cutscene |
| `m019_open_01` | M019 · Opening | “Rule 14(c). I have three points and two deans.” | proud | cutscene |

## Dr. Zainab

**Lines:** 15 · **Canon cutscene:** 15 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m009_mid1_02` | M009 · Mid-scene 1 | “Which one is the patient?” | neutral | cutscene |
| `m009_mid1_03` | M009 · Mid-scene 1 | “Both. Wonderful. Aigoo. (Oh dear.)” | dry | cutscene |
| `m009_mid1_04` | M009 · Mid-scene 1 | “You: bed. You: chair. No, the CHAIR.” | sharp | cutscene |
| `m009_mid1_05` | M009 · Mid-scene 1 | “The bed is for sick people. You are only foolish.” | dry | cutscene |
| `m009_mid1_06` | M009 · Mid-scene 1 | “Pen torch. My top pocket. Hold it HERE.” | stern | cutscene |
| `m009_mid1_07` | M009 · Mid-scene 1 | “Shake, and I stitch your sleeve to his face.” | sharp | cutscene |
| `m009_close_01` | M009 · Closing | “Two tablets after food. Not 'vibes'.” | stern | cutscene |
| `m009_close_02` | M009 · Closing | “And drink water. Both of you. Did I stutter?” | sharp | cutscene |
| `m009_close_03` | M009 · Closing | “My number. Do NOT call for nonsense.” | dry | cutscene |
| `m018_open_03` | M018 · Opening | “Caller. Energy drink is not breakfast.” | sharp | cutscene |
| `m018_open_04` | M018 · Opening | “Caller. CALLER. I can hear you opening one.” | sharp | cutscene |
| `m018_mid1_04` | M018 · Mid-scene 1 | “Excuse me. Is that my PATIENT reading the news?” | sharp | cutscene |
| `m023_mid1_01` | M023 · Mid-scene 1 | “THE HOSPITAL LINE DROPS EVERY NIGHT. 01:17.” | sharp | cutscene |
| `m023_mid1_02` | M023 · Mid-scene 1 | “I HAVE BABIES ON MACHINES. THIS IS NOT NONSENSE.” | sharp | cutscene |
| `m023_mid1_03` | M023 · Mid-scene 1 | “…sorry. I know you have exams. Who else do I ask?” | sad | cutscene |

## Aleeya

**Lines:** 3 · **Canon cutscene:** 3 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m002_open_01` | M002 · Opening | “I'll hold your bag. And your place.” | warm | cutscene |
| `m002_open_02` | M002 · Opening | “You're so patient. Like a goat tied to a post.” | amused | cutscene |
| `m017_mid1_02` | M017 · Mid-scene 1 | “Sorry! I'd stop, but I've only just got it going!” | warm | cutscene |

## Lyzzy

**Lines:** 6 · **Canon cutscene:** 6 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m004_mid1_02` | M004 · Mid-scene 1 | “Don't move! Your face is a moment!” | excited | cutscene |
| `m004_close_01` | M004 · Closing | “There's you. The kite.” | amused | cutscene |
| `m004_close_02` | M004 · Closing | “That's nobody. That's a gap.” | bored | cutscene |
| `m018_mid1_02` | M018 · Mid-scene 1 | “(Breathe! Your voice is a moment!)” | whisper | cutscene |
| `m020_open_03` | M020 · Opening | “He's looking at her. She's looking at the Senate.” | amused | cutscene |
| `m020_open_04` | M020 · Opening | “Typical.” | dry | cutscene |

## Lily

**Lines:** 2 · **Canon cutscene:** 2 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m004_mid1_03` | M004 · Mid-scene 1 | “…I said it would be windy.” | shy | cutscene |
| `m020_open_05` | M020 · Opening | “…I have twine.” | shy | cutscene |

## Abbas

**Lines:** 2 · **Canon cutscene:** 2 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m007_close_01` | M007 · Closing | “He has pushed. He has also pushed.” | bored | cutscene |
| `m014_close_02` | M014 · Closing | “The crowd is pleased. I am also pleased.” | bored | cutscene |

## Helen

**Lines:** 7 · **Canon cutscene:** 6 · **Runtime tokens:** 1 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m021_mid1_01` | M021 · Mid-scene 1 | “Who's asking?” | amused | cutscene |
| `m021_mid1_02` | M021 · Mid-scene 1 | “Does he think I can't see him? The tree is thin.” | dry | cutscene |
| `m021_mid1_04` | M021 · Mid-scene 1 | “'IDK' was my idea. After the trials. My whole team says it.” | warm | cutscene |
| `m021_mid1_05` | M021 · Mid-scene 1 | “I'm waiting to see how long he carries it.” | amused | cutscene |
| `m021_mid1_06` | M021 · Mid-scene 1 | “Tell him six o'clock. And I know my own name.” | warm | cutscene |
| `m021_close_03` | M021 · Closing | “(It's going well. Watch the film.)” | whisper | cutscene |

**Runtime tokens**

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m021_mid1_03` | M021 · Mid-scene 1 | **TOKEN** `[GIFT_LINE: corn or flowers]` | amused | TOKEN |

## Bolaji

**Lines:** 5 · **Canon cutscene:** 5 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m012_mid2_04` | M012 · Mid-scene 2 | “Sly is not afraid. Sly is… beside you.” | scared | cutscene |
| `m014_close_01` | M014 · Closing | “Sly keeps his word. No tax. This year.” | proud | cutscene |
| `m014_close_03` | M014 · Closing | “That is nothing. That is for… dogs.” | shy | cutscene |
| `m014_close_04` | M014 · Closing | “Zobo Max. You'll need it one day. Sly knows things.” | proud | cutscene |
| `m014_close_05` | M014 · Closing | “I didn't think anyone would train for it.” | whisper | cutscene |

## Bolaji (as Sly)

**Lines:** 5 · **Canon cutscene:** 5 · **Runtime tokens:** 0 · **Conditional:** 0

*Bolaji’s fight persona. Same character, different register: bigger, slower, kinder under the noise.*

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m007_open_01` | M007 · Opening | “Sly has noticed a fresher.” | proud | cutscene |
| `m007_open_02` | M007 · Opening | “Has the fresher noticed the toll?” | stern | cutscene |
| `m007_open_03` | M007 · Opening | “…Sorry.” | whisper | cutscene |
| `m007_close_04` | M007 · Closing | “Sly will remember your face.” | proud | cutscene |
| `m007_close_05` | M007 · Closing | “In a good way. Maybe.” | shy | cutscene |

## Muhammad

**Lines:** 8 · **Canon cutscene:** 8 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m002_mid1_02` | M002 · Mid-scene 1 | “Excuse me. Sorry.” | warm | cutscene |
| `m002_mid1_03` | M002 · Mid-scene 1 | “Don't take the shortcut, {{PLAYER\_NAME}}.” | warm | cutscene |
| `m002_mid1_04` | M002 · Mid-scene 1 | “The gate is locked on Tuesdays.” | neutral | cutscene |
| `m011_mid1_01` | M011 · Mid-scene 1 | “Excuse me. Sorry.” | warm | cutscene |
| `m011_mid1_02` | M011 · Mid-scene 1 | “Question four is the long one. Start there.” | neutral | cutscene |
| `m011_mid1_03` | M011 · Mid-scene 1 | “Leave one till last. It only looks easy.” | neutral | cutscene |
| `m011_mid1_04` | M011 · Mid-scene 1 | “Sorry. I shouldn't. You looked worried.” | shy | cutscene |
| `m016_close_01` | M016 · Closing | “You'll be all right. I checked. Sorry.” | warm | cutscene |

## Tunde

**Lines:** 2 · **Canon cutscene:** 2 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m011_close_01` | M011 · Closing | “I draw what's there.” | shy | cutscene |
| `m011_close_02` | M011 · Closing | “…I don't remember that being there.” | whisper | cutscene |

## Kelechi

**Lines:** 4 · **Canon cutscene:** 4 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m020_open_01` | M020 · Opening | “Stand where she's standing. Head like hers.” | warm | cutscene |
| `m020_open_02` | M020 · Opening | “What do you see?” | neutral | cutscene |
| `m020_mid1_01` | M020 · Mid-scene 1 | “She's by a different hand. Look at the chisel.” | neutral | cutscene |
| `m020_mid1_02` | M020 · Mid-scene 1 | “Somebody who loved her made that one.” | warm | cutscene |

## Baba Dam

**Lines:** 7 · **Canon cutscene:** 7 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m015_open_02` | M015 · Opening | “Fish don't hurry. Pier don't either.” | dry | cutscene |
| `m015_open_03` | M015 · Opening | “Four planks. You broke one. So: four planks.” | neutral | cutscene |
| `m015_mid1_01` | M015 · Mid-scene 1 | “A tower. One day.” | neutral | cutscene |
| `m015_mid1_02` | M015 · Mid-scene 1 | “They brought the stakes when my hair was black.” | dry | cutscene |
| `m015_mid1_03` | M015 · Mid-scene 1 | “Then they ran out of wood.” | dry | cutscene |
| `m016_open_01` | M016 · Opening | “Listen.” | whisper | cutscene |
| `m016_open_03` | M016 · Opening | “Forty years it sang soft. This month, loud.” | neutral | cutscene |

## Lula

**Lines:** 3 · **Canon cutscene:** 3 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m017_open_02` | M017 · Opening | “Driver! Motor park. Turn left.” | proud | cutscene |
| `m017_open_04` | M017 · Opening | “I mean left. Emotionally.” | proud | cutscene |
| `m017_close_04` | M017 · Closing | “Only one person ever laughed at page nine.” | neutral | cutscene |

## Faty

**Lines:** 6 · **Canon cutscene:** 6 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m017_open_03` | M017 · Opening | “He means right.” | dry | cutscene |
| `m017_open_05` | M017 · Opening | “Emotionally, we are lost.” | amused | cutscene |
| `m017_open_06` | M017 · Opening | “My dear, this is the marriage. Drive.” | warm | cutscene |
| `m017_close_02` | M017 · Closing | “Page twelve. That's you. One joke a year.” | amused | cutscene |
| `m017_close_03` | M017 · Closing | “The first eight are my mother's.” | dry | cutscene |
| `m017_close_05` | M017 · Closing | “And you wouldn't believe who.” | whisper | cutscene |

## Baba Porter

**Lines:** 7 · **Canon cutscene:** 7 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m001_film_08` | M001 · Film C | “Sign here. And here. Don't lose it.” | bored | cutscene |
| `m001_film_09` | M001 · Film C | “Fourth floor. There is no lift.” | bored | cutscene |
| `m001_film_10` | M001 · Film C | “There has never been a lift.” | dry | cutscene |
| `m003_close_03` | M003 · Closing | “Twelve. Good. Nobody alone.” | neutral | cutscene |
| `m022_close_01` | M022 · Closing | “I've been waiting to be asked.” | neutral | cutscene |
| `m022_close_02` | M022 · Closing | “Thirty years.” | whisper | cutscene |
| `m022_close_03` | M022 · Closing | “YOU! That mattress has a room number! FIND IT!” | stern | cutscene |

## The Maker

**Lines:** 11 · **Canon cutscene:** 11 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m006_mid1_01` | M006 · Mid-scene 1 | “I do not write notes. I do not watch.” | dry | cutscene |
| `m006_mid1_02` | M006 · Mid-scene 1 | “I listen. It is a different job.” | neutral | cutscene |
| `m006_mid1_03` | M006 · Mid-scene 1 | “Whoever sent that wanted you here. So. You came.” | neutral | cutscene |
| `m006_mid1_04` | M006 · Mid-scene 1 | “Go and sleep. It will be a long five years.” | dry | cutscene |
| `m015_close_01` | M015 · Closing | “My sister used to feed the fish here.” | neutral | cutscene |
| `m020_mid1_03` | M020 · Mid-scene 1 | “You went down for that.” | neutral | cutscene |
| `m022_open_01` | M022 · Opening | “I have kept one coil lit alone for a long time.” | neutral | cutscene |
| `m022_open_02` | M022 · Opening | “I begin to suspect I was doing it wrong.” | dry | cutscene |
| `m022_open_03` | M022 · Opening | “It needs people round it. Not soldiers. Witnesses.” | neutral | cutscene |
| `m022_open_04` | M022 · Opening | “It was designed for a crowd. I had forgotten.” | sad | cutscene |
| `m022_open_05` | M022 · Opening | “I do not know many people. You seem to.” | dry | cutscene |

## Mai Shayi

**Lines:** 9 · **Canon cutscene:** 9 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m006_open_01` | M006 · Opening | “Sit. Tea first, gist second.” | warm | cutscene |
| `m006_open_03` | M006 · Opening | “A piano. Double price.” | dry | cutscene |
| `m006_open_04` | M006 · Opening | “A corridor that cries. A lecturer who never ages.” | whisper | cutscene |
| `m006_open_05` | M006 · Opening | “An okada at 3 a.m. with nobody you can describe.” | whisper | cutscene |
| `m006_open_06` | M006 · Opening | “Go and greet him. If he's sitting, look at WHERE.” | neutral | cutscene |
| `m024_mid2_01` | M024 · Mid-scene 2 | “You know who gave that thing a cape?” | warm | cutscene |
| `m024_mid2_02` | M024 · Mid-scene 2 | “Us. First-years. Every year.” | neutral | cutscene |
| `m024_mid2_03` | M024 · Mid-scene 2 | “We were scared. So we drew it a face.” | neutral | cutscene |
| `m024_mid2_04` | M024 · Mid-scene 2 | “A thing with a face, you can stand against.” | warm | cutscene |

## Alhaji Needle

**Lines:** 2 · **Canon cutscene:** 2 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m004_open_01` | M004 · Opening | “Thursday.” | warm | cutscene |
| `m004_open_02` | M004 · Opening | “It is. May God bless it.” | warm | cutscene |

## Mama Nkechi

**Lines:** 2 · **Canon cutscene:** 2 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m003_open_01` | M003 · Opening | “Fry the tomato till it stops shouting.” | stern | cutscene |
| `m003_open_02` | M003 · Opening | “Add water early and I will know.” | stern | cutscene |

## Malam Sule

**Lines:** 5 · **Canon cutscene:** 5 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m001_mid2_01` | M001 · Mid-scene 2 | “Sarki! Again!” | stern | cutscene |
| `m001_mid2_02` | M001 · Mid-scene 2 | “One engineering boy was lecturing it. On littering.” | dry | cutscene |
| `m001_mid2_03` | M001 · Mid-scene 2 | “Ten minutes. Left the gate open.” | dry | cutscene |
| `m001_mid2_04` | M001 · Mid-scene 2 | “You brought him back. People don't, you know.” | warm | cutscene |
| `m001_mid2_05` | M001 · Mid-scene 2 | “Behind the barn. The old kola tree. Look down.” | whisper | cutscene |

## Malam Garba

**Lines:** 2 · **Canon cutscene:** 2 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m002_close_01` | M002 · Closing | “Hm.” | neutral | cutscene |
| `m024_mid2_07` | M024 · Mid-scene 2 | “Go and dance. Fresher no more.” | warm | cutscene |

## Mrs. Adebayo

**Lines:** 2 · **Canon cutscene:** 2 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m002_open_03` | M002 · Opening | “Four passports.” | bored | cutscene |
| `m002_mid1_05` | M002 · Mid-scene 1 | “Next.” | bored | cutscene |

## Mr. Clement

**Lines:** 1 · **Canon cutscene:** 1 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m002_mid1_01` | M002 · Mid-scene 1 | “Network.” | bored | cutscene |

## Dr. Khadija

**Lines:** 3 · **Canon cutscene:** 3 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m013_close_01` | M013 · Closing | “{{PLAYER\_NAME}}. I know your name now.” | stern | cutscene |
| `m013_close_02` | M013 · Closing | “I will be watching you. In the good sense.” | neutral | cutscene |
| `m013_close_03` | M013 · Closing | “For now.” | dry | cutscene |

## Dr. Okonkwo

**Lines:** 4 · **Canon cutscene:** 4 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m005_mid1_06` | M005 · Mid-scene 1 | “Sit in front, Nusaiba. I need the supervision.” | dry | cutscene |
| `m005_close_02` | M005 · Closing | “Page forty is not on the syllabus.” | stern | cutscene |
| `m005_close_03` | M005 · Closing | “Neither is asking.” | dry | cutscene |
| `m020_close_01` | M020 · Closing | “Six sites. One ring. We have one.” | stern | cutscene |

## Nurse Hauwa

**Lines:** 1 · **Canon cutscene:** 1 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m009_mid1_01` | M009 · Mid-scene 1 | “Doctor is coming. Sit.” | bored | cutscene |

## Coach Danladi

**Lines:** 2 · **Canon cutscene:** 2 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m008_open_03` | M008 · Opening | “Pass! Is the ball your inheritance?” | stern | cutscene |
| `m019_open_04` | M019 · Opening | “Out! Out! The grass is not coming to you!” | stern | cutscene |

## Coach Ngozi

**Lines:** 3 · **Canon cutscene:** 3 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m014_mid1_01` | M014 · Mid-scene 1 | “The scale speaks. Don't take it personally.” | warm | cutscene |
| `m014_mid1_02` | M014 · Mid-scene 1 | “Three lifts. On the beat. Then you eat properly.” | stern | cutscene |
| `m014_mid1_03` | M014 · Mid-scene 1 | “Garri is not a food group. It is a cry for help.” | dry | cutscene |

## Ranger Lawal

**Lines:** 2 · **Canon cutscene:** 2 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m015_close_02` | M015 · Closing | “Go back.” | stern | cutscene |
| `m015_close_04` | M015 · Closing | “…Go back.” | whisper | cutscene |

## Engr. Aliyu

**Lines:** 3 · **Canon cutscene:** 3 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m023_close_01` | M023 · Closing | “You should not be in here.” | scared | cutscene |
| `m023_close_02` | M023 · Closing | “…Thank you for being in here.” | warm | cutscene |
| `m023_close_03` | M023 · Closing | “This never happened. I owe you. I pay what I owe.” | neutral | cutscene |

## DJ Kabiru

**Lines:** 5 · **Canon cutscene:** 5 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m018_open_06` | M018 · Opening | “Nothing here is normal. You're on at six.” | warm | cutscene |
| `m018_open_07` | M018 · Opening | “Mast room. Hand crank. Somebody young.” | stern | cutscene |
| `m018_close_02` | M018 · Closing | “That voice was here before this station was built.” | whisper | cutscene |
| `m018_close_03` | M018 · Closing | “We don't talk about it on air.” | stern | cutscene |
| `m018_close_04` | M018 · Closing | “…You've got the job, by the way. Both of you.” | warm | cutscene |

## Hajiya Ladi

**Lines:** 3 · **Canon cutscene:** 3 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m010_mid1_01` | M010 · Mid-scene 1 | “You have customers.” | neutral | cutscene |
| `m010_mid1_02` | M010 · Mid-scene 1 | “You do not have a business.” | stern | cutscene |
| `m010_mid1_04` | M010 · Mid-scene 1 | “A business has a book. Bring it when you have one.” | dry | cutscene |

## Wednesday

**Lines:** 3 · **Canon cutscene:** 3 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m005_close_01` | M005 · Closing | “See you Wednesday.” | neutral | cutscene |
| `m018_open_01` | M018 · Opening | “See you Wednesday.” | neutral | cutscene |
| `m018_open_02` | M018 · Opening | “I know.” | warm | cutscene |

## Tanko

**Lines:** 4 · **Canon cutscene:** 4 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m006_close_01` | M006 · Closing | “Riddle. What has six legs and cannot stand?” | neutral | cutscene |
| `m006_close_03` | M006 · Closing | “Which?” | dry | cutscene |
| `m020_close_02` | M020 · Closing | “Six legs and cannot stand. You have your answer.” | neutral | cutscene |
| `m020_close_03` | M020 · Closing | “Now: what has ten mouths and was never fed?” | dry | cutscene |

## Basit

**Lines:** 1 · **Canon cutscene:** 1 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m017_mid1_01` | M017 · Mid-scene 1 | “No no no. Run it back! RUN IT BACK!” | sad | cutscene |

## Emeka

**Lines:** 1 · **Canon cutscene:** 1 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m017_close_01` | M017 · Closing | “The gold exhaust! Don't ask what it came off.” | proud | cutscene |

## Big Baby

**Lines:** 2 · **Canon cutscene:** 2 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m007_close_02` | M007 · Closing | “Bolaji.” | stern | cutscene |
| `m007_close_03` | M007 · Closing | “Outside.” | stern | cutscene |

## Gate Guard

**Lines:** 1 · **Canon cutscene:** 1 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m001_film_02` | M001 · Film B | “Oga, it is the only gate.” | bored | cutscene |

## The Students

**Lines:** 3 · **Canon cutscene:** 3 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m011_open_04` | M011 · Opening | “Ahn ahn!” | sad | cutscene |
| `m012_close_01` | M012 · Closing | “UP NEPA!” | excited | cutscene |
| `m024_mid1_01` | M024 · Mid-scene 1 | “UP NEPA!” | excited | cutscene |

## The Freshers

**Lines:** 3 · **Canon cutscene:** 3 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m001_mid1_01` | M001 · Mid-scene 1 | “Faaa!” | excited | cutscene |
| `m003_mid1_01` | M003 · Mid-scene 1 | “Ahn ahn! NEPA!” | sad | cutscene |
| `m004_mid1_01` | M004 · Mid-scene 1 | “I solemnly promise…” | neutral | cutscene |

## The Companion

**Lines:** 1 · **Canon cutscene:** 0 · **Runtime tokens:** 1 · **Conditional:** 0

**Runtime tokens**

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m021_close_01` | M021 · Closing | **TOKEN** `[COMPANION_LINE: by who came]` | warm | TOKEN |

## Small Boy

**Lines:** 1 · **Canon cutscene:** 1 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m019_mid1_01` | M019 · Mid-scene 1 | “Jega! Show us!” | excited | cutscene |

## Sophomore Customer

**Lines:** 2 · **Canon cutscene:** 2 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m010_close_01` | M010 · Closing | “They stopped working after ten minutes.” | stern | cutscene |
| `m010_close_03` | M010 · Closing | “I want a refund.” | stern | cutscene |

## Dean of Engineering

**Lines:** 2 · **Canon cutscene:** 2 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m024_mid2_05` | M024 · Mid-scene 2 | “My paperweight. And the last Dean's.” | amused | cutscene |
| `m024_mid2_06` | M024 · Mid-scene 2 | “'When your people are ready.' I think: tonight.” | warm | cutscene |

## Driving Examiner

**Lines:** 1 · **Canon cutscene:** 1 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m017_open_01` | M017 · Opening | “I will follow. On foot.” | scared | cutscene |

## Law Lecturer

**Lines:** 2 · **Canon cutscene:** 2 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m005_open_01` | M005 · Opening | “You. The gentleman in the unfortunate shirt.” | dry | cutscene |
| `m005_open_02` | M005 · Opening | “Define a tort.” | stern | cutscene |

## Suya Man

**Lines:** 1 · **Canon cutscene:** 1 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m001_mid1_02` | M001 · Mid-scene 1 | “Not the yaji! NOT THE YAJI!” | scared | cutscene |

## Hassan

**Lines:** 2 · **Canon cutscene:** 2 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m007_open_04` | M007 · Opening | “Two hundred. Receipt provided.” | bored | cutscene |
| `m014_open_01` | M014 · Opening | “Delivery. Sign for the note. Sign for the receipt.” | bored | cutscene |

## Radio (old transmitter)

**Lines:** 2 · **Canon cutscene:** 2 · **Runtime tokens:** 0 · **Conditional:** 0

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m003_close_01` | M003 · Closing | “Seven. Six. Five. Four. Three. Two. One.” | amused | cutscene |
| `m018_close_01` | M018 · Closing | “Seven. Six. Five. Four. Three. Two. One.” | amused | cutscene |

# Conditional specials

> **Real-person content.** These characters are enabled only by their named flag and are never romance options. Their lines are listed here for completeness and for the conditional pass only. If the flag is off, none of this exists in the build; the generic `[ELSE]` staging in `03_YEAR1_SCRIPT.md` replaces it.

## Jiya — `CONDITIONAL`

**Lines:** 33 · **Canon cutscene:** 0 · **Runtime tokens:** 0 · **Conditional:** 33

**Conditional**

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m002_open_j01` | M002 · Opening | “Four. In a digital age. Right.” | dry | insert (conditional) |
| `m007_open_j01` | M007 · Opening | “Oh, this'll be good.” | amused | insert (conditional) |
| `m017_open_j01` | M017 · Opening | “I'm not in this argument. I'm just between it.” | dry | insert (conditional) |
| `m019_open_j01` | M019 · Opening | “It says 'a guest'. Not 'a good one'. No offence.” | dry | insert (conditional) |
| `m002_play_j01` | M002 · gameplay | “Right. 'Sundry charges.' Sundry what, precisely?” | — | gameplay (conditional) |
| `m002_play_j02` | M002 · gameplay | “Trespass on a path. A \*path\*. Mate, that's what paths are for.” | — | gameplay (conditional) |
| `m002_play_j03` | M002 · gameplay | “With respect, officer, and I mean a great deal of it: which regulation?” | — | gameplay (conditional) |
| `m002_play_j04` | M002 · gameplay | “You paid without reading it? You're the reason small print exists.” | — | gameplay (conditional) |
| `m002_play_j05` | M002 · gameplay | “I'm Jiya. I did law. Then I got better.” | — | gameplay (conditional) |
| `m005_play_j01` | M005 · gameplay | “A cake. Right. He's not wrong about some of the case law.” | — | gameplay (conditional) |
| `m007_play_j01` | M007 · gameplay | “Sorry, quick question. Is this a levy, a toll or a donation?” | — | gameplay (conditional) |
| `m007_play_j02` | M007 · gameplay | “Because a levy needs a by-law, a toll needs a road, and a donation needs consent.” | — | gameplay (conditional) |
| `m007_play_j03` | M007 · gameplay | “So what we have here is a large man standing near money. Which is not a legal category.” | — | gameplay (conditional) |
| `m007_play_j04` | M007 · gameplay | “Lovely receipts, though. Who drew the ball?” | — | gameplay (conditional) |
| `m007_play_j05` | M007 · gameplay | “He was pushed, officer. Gravity isn't an offence. I've checked.” | — | gameplay (conditional)<br><sub>Direction: to the guard.</sub> |
| `m011_play_j01` | M011 · gameplay | “Pens down. That includes you, mate. Yes, I can see you finishing a sentence.” | — | gameplay (conditional) |
| `m017_play_j01` | M017 · gameplay | “Hello. Sorry. I'm not in this argument, I'm just between it.” | — | gameplay (conditional) |
| `m017_play_j02` | M017 · gameplay | “Examiner! Which section says passengers must agree with each other?” | — | gameplay (conditional) |
| `m017_play_j03` | M017 · gameplay | “He stopped for the goat. That's an emergency stop. Tick the box, there's a good man.” | — | gameplay (conditional) |
| `m017_play_j04` | M017 · gameplay | “'Left, emotionally.' I'm having that. That's going in a contract.” | — | gameplay (conditional)<br><sub>Direction: to Lula.</sub> |
| `m017_play_j05` | M017 · gameplay | “Right. That's a pass. I'd appeal a fail, and I'd enjoy it.” | — | gameplay (conditional) |
| `m019_play_j01` | M019 · gameplay | “Rule 14(c). 'With the written consent of both deans.' Here are both deans. In writing.” | — | gameplay (conditional) |
| `m019_play_j02` | M019 · gameplay | “It says 'a guest'. It doesn't say 'a good one'. No offence, mate.” | — | gameplay (conditional) |
| `m019_play_j03` | M019 · gameplay | “Oh, don't change the boots. Don't. …He's changed the boots.” | — | gameplay (conditional)<br><sub>Direction: at the penalty.</sub> |
| `m022_play_j01` | M022 · gameplay | “So you'd like me to stand in a garden at night for reasons you can't legally describe.” | — | gameplay (conditional) |
| `m022_play_j02` | M022 · gameplay | “Is there a waiver? There should be a waiver. I'll draft the waiver.” | — | gameplay (conditional) |
| `m022_play_j03` | M022 · gameplay | “Fine. I'm in. Mostly to see what it is.” | — | gameplay (conditional) |
| `m023_play_j01` | M023 · gameplay | “Evening, officer. They're with me. I'm conducting a… site visit.” | — | gameplay (conditional) |
| `m023_play_j02` | M023 · gameplay | “Is the door locked? It was. Was it forced? It wasn't. Then what precisely is the offence?” | — | gameplay (conditional) |
| `m023_play_j03` | M023 · gameplay | “I don't want to know. I really don't. Carry on.” | — | gameplay (conditional)<br><sub>Direction: to you.</sub> |
| `m024_play_j01` | M024 · gameplay | “Nobody's trespassing. It's convocation. Read your own programme.” | — | gameplay (conditional) |
| `m024_play_j02` | M024 · gameplay | “I said I'd come to see what it is. …Right. I see what it is. Keep going!” | — | gameplay (conditional) |
| `m024_play_j03` | M024 · gameplay | “I can't object to that thing. It hasn't said anything. Rude.” | — | gameplay (conditional) |

## Taty — `CONDITIONAL`

**Lines:** 40 · **Canon cutscene:** 0 · **Runtime tokens:** 0 · **Conditional:** 40

**Conditional**

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m008_open_t01` | M008 · Opening | “Coach, give me the whistle. I'll break them gently.” | amused | insert (conditional) |
| `m012_mid1_t01` | M012 · Mid-scene 1 | “Give me twenty. I have arms. Bora!” | excited | insert (conditional) |
| `m014_mid1_t01` | M014 · Mid-scene 1 | “Fresher! You again. Good. I need a victim.” | amused | insert (conditional) |
| `m016_close_t01` | M016 · Closing | “Are you okay? I saw bubbles. I was over there!” | scared | insert (conditional) |
| `m001_play_t01` | M001 · gameplay | “Bora! Run, fresher, the goat is winning!” | — | gameplay (conditional) |
| `m001_play_t02` | M001 · gameplay | “Don't look at me, I'm on lap six!” | — | gameplay (conditional) |
| `m006_play_t01` | M006 · gameplay | “Pixel. Pixel! We live together. You can't just join a cult.” | — | gameplay (conditional) |
| `m006_play_t02` | M006 · gameplay | “They do this every evening. Nobody knows why. Pixel won't say.” | — | gameplay (conditional) |
| `m008_play_t01` | M008 · gameplay | “Bora! One lap. Easy lap. Baby lap.” | — | gameplay (conditional) |
| `m008_play_t02` | M008 · gameplay | “I lied. Two.” | — | gameplay (conditional) |
| `m008_play_t03` | M008 · gameplay | “You're not dying. I've seen dying. This is Tuesday.” | — | gameplay (conditional) |
| `m008_play_t04` | M008 · gameplay | “You tie that boot one more time, I'm taking it home.” | — | gameplay (conditional)<br><sub>Direction: to Jega.</sub> |
| `m008_play_t05` | M008 · gameplay | “Good! Now do it tired. Tired is where it counts.” | — | gameplay (conditional) |
| `m012_play_t01` | M012 · gameplay | “Give me ten. No, twenty. I have arms.” | — | gameplay (conditional) |
| `m012_play_t02` | M012 · gameplay | “Block C is lit. Block D is lit. Who's next? Don't make me choose.” | — | gameplay (conditional) |
| `m012_play_t03` | M012 · gameplay | “Pixel doesn't like them. Pixel doesn't like anybody. So that means nothing.” | — | gameplay (conditional) |
| `m012_play_t04` | M012 · gameplay | “I'm not scared. I'm fast. It's a different thing.” | — | gameplay (conditional) |
| `m014_play_t01` | M014 · gameplay | “Lift on my count. One. Two. I'm not helping, I'm just touching the bar. Three.” | — | gameplay (conditional) |
| `m014_play_t02` | M014 · gameplay | “You ate garri for dinner. I can see it in your soul.” | — | gameplay (conditional) |
| `m014_play_t03` | M014 · gameplay | “Last set. I lied. Second last.” | — | gameplay (conditional) |
| `m014_play_t04` | M014 · gameplay | “Big man! You fight fair or I make you run with me. Your choice.” | — | gameplay (conditional)<br><sub>Direction: to Bolaji.</sub> |
| `m014_play_t05` | M014 · gameplay | “See? You moved him. Last month you couldn't move his shadow.” | — | gameplay (conditional) |
| `m015_play_t01` | M015 · gameplay | “He says 'float'. I say 'kick'. Do both. Bora!” | — | gameplay (conditional) |
| `m015_play_t02` | M015 · gameplay | “You swim like a chair. A brave chair.” | — | gameplay (conditional) |
| `m015_play_t03` | M015 · gameplay | “Pixel thinks water is a mistake. Pixel is wrong about many things.” | — | gameplay (conditional) |
| `m016_play_t01` | M016 · gameplay | “I'll be up here. With the light. Go down, come up, simple.” | — | gameplay (conditional) |
| `m016_play_t02` | M016 · gameplay | “An eel? A big one? …How big? No. Don't tell me. Tell me.” | — | gameplay (conditional) |
| `m016_play_t03` | M016 · gameplay | “That wasn't me. I was on the other side. …Who pulled you out?” | — | gameplay (conditional) |
| `m016_play_t04` | M016 · gameplay | “Pixel, what? There's nothing there. Stop it.” | — | gameplay (conditional) |
| `m019_play_t01` | M019 · gameplay | “Drink. Breathe. You have forty-five more. Bora!” | — | gameplay (conditional) |
| `m019_play_t02` | M019 · gameplay | “Jega! Left boot! I'm not superstitious but LEFT BOOT!” | — | gameplay (conditional) |
| `m019_play_t03` | M019 · gameplay | “You lost. So what. You ran. Come here. Hug. Now we train.” | — | gameplay (conditional) |
| `m020_play_t01` | M020 · gameplay | “Pixel! That's evidence! …Okay it's string. But it's important string.” | — | gameplay (conditional) |
| `m022_play_t01` | M022 · gameplay | “Yes. What is it? Doesn't matter. Yes.” | — | gameplay (conditional) |
| `m022_play_t02` | M022 · gameplay | “Who's left? Give me the list. I'll run it. You talk, I fetch.” | — | gameplay (conditional) |
| `m023_play_t01` | M023 · gameplay | “Hospital says ward three is flickering. I'm going back. Don't let go of that thing.” | — | gameplay (conditional) |
| `m023_play_t02` | M023 · gameplay | “Four trips. I'm warm now. Keep going.” | — | gameplay (conditional) |
| `m024_play_t01` | M024 · gameplay | “Left side's mine! All of it! Don't send anyone, they'll slow me down!” | — | gameplay (conditional) |
| `m024_play_t02` | M024 · gameplay | “Wave three? That's all? Bora!” | — | gameplay (conditional) |
| `m024_play_t03` | M024 · gameplay | “Pixel's in my hood and she's furious. That's how you know we're winning.” | — | gameplay (conditional) |

## Madison — `CONDITIONAL`

**Lines:** 16 · **Canon cutscene:** 0 · **Runtime tokens:** 0 · **Conditional:** 16

**Conditional**

| Line ID | Scene | Line | Mood | Source |
|---|---|---|---|---|
| `m004_mid1_d01` | M004 · Mid-scene 1 | “Fly, fresher! Fly with dignity!” | excited | insert (conditional) |
| `m004_play_d01` | M004 · gameplay | “Aiya! That's not a gown, that's a tent. I love it. Don't move.” | — | gameplay (conditional) |
| `m004_play_d02` | M004 · gameplay | “Wait wait wait, film this. Okay: knot. Shoulder. Attitude.” | — | gameplay (conditional) |
| `m004_play_d03` | M004 · gameplay | “It's not too big, it's oversized. Different word, different price.” | — | gameplay (conditional) |
| `m004_play_d04` | M004 · gameplay | “Jiayou, fresher! Fly! Fly with dignity!” | — | gameplay (conditional) |
| `m010_play_d01` | M010 · gameplay | “Aiya! Tai gui le! (Too expensive!) Hajiya, look at his belt. GUCCY. He's poor.” | — | gameplay (conditional) |
| `m010_play_d02` | M010 · gameplay | “Okay okay okay, I take six, you give me price for ten. Deal? Deal.” | — | gameplay (conditional) |
| `m010_play_d03` | M010 · gameplay | “Boss, I'm a student. Look at my shoes. …Don't look at my shoes, they're nice. Look at HIS shoes.” | — | gameplay (conditional) |
| `m010_play_d04` | M010 · gameplay | “You don't bargain, you beg. I'll teach you. It's free. Today.” | — | gameplay (conditional)<br><sub>Direction: to Mubarak.</sub> |
| `m018_play_d01` | M018 · gameplay | “Hello hello hello, am I on? Okay. Play something with a beat, I have a trend to launch.” | — | gameplay (conditional) |
| `m021_play_d01` | M021 · gameplay | “Aiya! Flowers for an athlete? She'll use them as a towel.” | — | gameplay (conditional) |
| `m021_play_d02` | M021 · gameplay | “Ask her friend. Always ask the friend. The friend is the search engine.” | — | gameplay (conditional) |
| `m021_play_d03` | M021 · gameplay | “Corn. Hot. Trust me. Jiayou!” | — | gameplay (conditional) |
| `m022_play_d01` | M022 · gameplay | “No filming? Not even a little? …Okay. Okay! I'll be there. I'll remember it with my EYES. Aiya.” | — | gameplay (conditional) |
| `m024_play_d01` | M024 · gameplay | “Okay everybody, with me! Torch UP, step, torch UP, step!” | — | gameplay (conditional) |
| `m024_play_d02` | M024 · gameplay | “No filming, I promised. I PROMISED. Aiya, it's so beautiful.” | — | gameplay (conditional) |

---

## 4 · Recording order (recommended)

Record in this order to keep continuity of voice and to avoid re-booking minor parts:

1. **The Fresher** — short lines only; record in scene order so the year’s confidence arc is audible.
2. **The Roommate** (cast one) — the comic engine; record all shared lines, then the M018 booth lines if Bature.
3. **The five leads** — Jega, Shamsu, Mubarak, Nusaiba, Dr. Zainab. These carry the year’s warmth and authority; record their mission blocks together.
4. **The friend group** — Aleeya, Lyzzy, Lily, Abbas, Helen, Bolaji, Muhammad, Tunde, Kelechi.
5. **Family and staff** — Mum, Dad, Baba Porter, the Maker, the traders, the coaches, the medics, the administrators.
6. **Small parts** — one session, one actor if possible; each voice is a cameo, not a new regular.
7. **Conditional specials** — only after the named person has approved the content and the kill switch is confirmed working. Record the `[ELSE]` alternative at the same session.

**Direction defaults.** The Fresher is dry, understated and rarely the loudest person in a scene. The Roommate is fast and certain and loses confidence only twice in the year. Jega is loud and generous. Shamsu is precise and secretly delighted. Mubarak is a market. Nusaiba is a dossier with a pulse. Zainab is the smartest person in every room and has no patience for being told so.

---

## 5 · Audit checklist

- [ ] Every row has a mission, scene and line ID.
- [ ] Every canon cutscene line in `03_YEAR1_SCRIPT.md` appears here exactly once per casting.
- [ ] Every conditional row is inside a `special.*` block in the source and has an `[ELSE]` path.
- [ ] No token text has been sent to an actor.
- [ ] The Roommate is cast once; both variant scripts are complete.
- [ ] Small parts are resolved to individual speakers, not left as “Small Parts”.
- [ ] No line has been reworded to “sound more Nigerian”, “sound younger” or “fix the grammar”. The grammar is the character.
