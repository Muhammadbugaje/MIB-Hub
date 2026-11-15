# SPECIAL-CHARACTER INTEGRATION, YEARS 3–5 (M49–M120)

**Read with:** `FORMAT.md` §6 (the owner's rule and the Years 1–2 table), bible §8.9. This file is the Years 3–5 half of that table, as actually written in `Y3.md`, `Y4.md` and `Y5.md`.
**The rule:** when a special character is approved and switched on (`special.<name>` true) they join the listed main mission, use their power and add lines. Switched off, the mission plays identically through its `[ELSE]`. No special character carries plot, holds a seal, touches a coil or the bell, or sees Muhammad. Dr. Zainab is core cast (`npc.zainab`) and has no fallback per mission.
**Line ids:** `j` Jiya, `t` Taty, `d` Madison. All lines are drafts for the real person to change; a native speaker checks every Mandarin and Portuguese phrase.

## 1. The table

| Mission | Jiya | Taty | Madison | `[ELSE]` fallback | Power used | Line ids |
|---|---|---|---|---|---|---|
| **Year 3** | | | | | | |
| M050 Indefinite | Quotes congress standing orders so Nusaiba's motion is taken at once (seconders 8 → 4) | | | Nusaiba waits out three speakers and needs all 8 | Legal Immunity | `m050_open_j01`, `m050_play_j01`–`j04` |
| M052 Garri Economics | | | Sells the Sapa Combo with a jingle and a four-count dance; sell-out in half the stops | Mubarak's own patter, every stop | Trend Setter | `m052_mid1_d01`, `m052_play_d01`–`d04` |
| M054 Farm Hands | | Herds the far flank on foot when the tractor stalls; a farm cat joins Pixel (scatter timer doubled) | | Emily on a bicycle; standard timer | Never Tired | `m054_mid1_t01`, `m054_play_t01`–`t04` |
| M057 The Sit-Down | | Gets {{ROOMIE}} round the courtyard: "One lap. I lied, half." (wider pace window) | | Jega does it, ball under his arm | Never Tired (unhurried, for once) | `m057_play_t01`–`t04` |
| M063 Injury Time | | First to Jega with ice; keeps the leg still; runs beside the keke (wider carry window). She sees nobody in a white shirt; her cat stares at the centre circle | | Helen's teammate Summy brings the ice | Never Tired | `m063_mid1_t01`, `m063_play_t01`–`t04` |
| M066 The Idle King | | Plays the whole moonlight match without subbing, in a floral dress (passes 6 → 4) | | Emeka the okada rider plays in his helmet | Never Tired | `m066_open_t01`, `m066_play_t01`–`t04` |
| M068 Padlock Receipts | Reads the lease refusal and the memo: "Nothing illegal. How irritating." One free pass on the deduction board | | | Nusaiba alone, slower, same conclusion | Legal Immunity | `m068_mid1_j01`–`j02`, `m068_play_j01`–`j04` |
| M069 Ranger Lawal's Debt | | Swims the line across with you on the upstream side (drift halved) | | You swim alone, longer; Lawal throws a checkpoint line | Never Tired | `m069_open_t01`, `m069_play_t01`–`t04` |
| **Year 4** | | | | | | |
| M075 Lucky Goes Viral | | | Teaches Lucky what a real trend is and out-dances him (Fame gain doubled) | Lyzzy films; DJ Sugar calls the moves | Trend Setter | `m075_open_d01`, `m075_play_d01`–`d04` |
| M076 The Collab | | | Rides stunt two; peels half the mall crowd away with a dance (40 fans → 20) | Lucky rides; Mubarak "manages" the crowd | Trend Setter | `m076_play_d01`–`d04` |
| M078 Rehab | | Runs the pool sessions in the next lane; never lets Jega count wrong | | Coach Ngozi with a stopwatch | Never Tired | `m078_open_t01`, `m078_play_t01`–`t05` |
| M079 Manifesto | Finds the poster-size clause in the electoral guidelines; Muktar's banner comes down | | | Aleeya reads them and misses the clause | Legal Immunity | `m079_open_j01`, `m079_play_j01`–`j05` |
| M083 Proof of Work | The ethics judge: cross-examines the tool, fixes one line of code (ties to cameo J3) | | | The Dean of Computing with a printed rubric | Legal Immunity; "Objection!" teased | `m083_open_j01`, `m083_play_j01`–`j05` |
| M085 Election Day | Independent observer at the recount; rules on the seven-or-one | | | Comrade Sadiya observes | Legal Immunity | `m085_mid1_j01`, `m085_close_j01`, `m085_play_j01`–`j04` |
| M086 Payday | | | Hosts Black Friday at the Plug as a live sale (queue 12 → 8) | Mubarak on a carton with a failing megaphone | Trend Setter | `m086_play_d01`–`d04` |
| M088 Comeback | | Runs the warm-up; "left boot, right boot, who cares, run" (first-half stamina bonus) | | Coach Danladi, with proverbs | Never Tired | `m088_open_t01`, `m088_close_t01`, `m088_play_t01`–`t04` |
| **Year 5** | | | | | | |
| M100 The Missing Script | Drafts the complaint with Nusaiba; refuses to let anyone skip a stage. She does not find the script | | | The legal aid clinic's duty student | Legal Immunity | `m100_play_j01`–`j04`, `m100_close_j01` |
| M102 Megawatt's Offer | Reads Clause 9 of the buy-out to Mubarak, slowly; gives no advice on selling | | | Nusaiba by text, line by line | Legal Immunity | `m102_play_j01`–`j05` |
| M107 Contract | Reads the contract on the office step; drafts "left boot first" as a schedule | | | Nusaiba by text; the scout writes it in the margin | Legal Immunity | `m107_mid1_j01`–`j02`, `m107_play_j01`–`j03` |
| M111 The Longest Night | | Runs the lantern line's far end all night (no gaps behind you) | | Jega's teammates in relay; one double-back | Never Tired | `m111_play_t01`–`t05` |
| M112 Three by Road | | Runner between the three sites (one junction per leg un-blanked) | Turns the mall crowd with the Goat (one fewer changeover trip) | Okada riders carry word; Mubarak turns the mall's speakers up | Never Tired; Trend Setter (separate steps) | `m112_play_t01`–`t04`, `m112_play_d01`–`d04` |
| M114 The Ten Seals | Reads the right of way aloud at the door; carries no seal | | | Nusaiba reads it: three numbered lines | Legal Immunity | `m114_mid2_j01`–`j03`, `m114_play_j01`–`j02` |
| M115 Chancellor Null | One name on the naming wheel | One name on the naming wheel | One name on the naming wheel | Three fewer names on the wheel; the count needed is unchanged | none | `m115_play_j01`, `m115_play_t01`, `m115_play_d01` |
| M117 Gown | A possible photograph partner; one line | A possible photograph partner; one line | A possible photograph partner; one line | Core cast only in the five photographs | none | `m117_play_j01`, `m117_play_t01`, `m117_play_d01` |
| M118 Convocation | One line in the stand | One line at the rail | One line, filming | Crowd barks cover the same seconds | none | `m118_play_j01`, `m118_play_t01`, `m118_play_d01` |
| M119 Sign-Out | Signs the white shirt; one line | Signs the white shirt; one line | Signs the white shirt; one line | Core cast signatures only | none | `m119_play_j01`, `m119_play_t01`, `m119_play_d01` |

**Missions with no special helper (by design):** M049, M051, M053, M055, M056, M058–M062, M064, M065, M067, M070–M072; M073, M074, M077, M080–M082, M084, M087, M089–M096; M097–M099, M101, M103–M106, M108–M110, M113, M116, M120. These include every seal hand-over, every coil lighting, every Muhammad sighting where the mystery is the point, both relationship missions (M071, M093) and the last mission.

## 2. Counts, Years 3–5

| Character | Helper missions (power used) | One-line appearances | Total |
|---|---|---|---|
| Jiya | 9: M050, M068, M079, M083, M085, M100, M102, M107, M114 | 4: M115, M117, M118, M119 | 13 |
| Taty | 9: M054, M057, M063, M066, M069, M078, M088, M111, M112 | 4: M115, M117, M118, M119 | 13 |
| Madison | 5: M052, M075, M076, M086, M112 | 4: M115, M117, M118, M119 | 9 |

Never two special helpers lead the same step (M112: Taty on steps 1, 4, 7; Madison on step 6).

## 3. Signature moments and their echoes (bible §8.7)

| Character | Signature (written by writer A) | Echoed in Years 3–5 |
|---|---|---|
| Jiya | The courtroom roast, M031 | M068 ("Facts are ruder"), M085 (the recount), M114 (the right of way read aloud) |
| Taty | The cat chase, M037 | M054 (a farm cat joins Pixel), M066 (the horns sign on scoring), M088 (the cat on the bench) |
| Madison | The campus-wide trend, cameo D2, seeded in M026 | M052 (the jingle), M075–M076, M112 (the Goat turns the mall crowd) |
| Dr. Zainab | The night shift, M042 | **M064 Night Nurse** (diesel "like eggs" again; she is on the phone, the night is Hauwa's and yours) and **M094 Seoul or Stay** (her last night on call) |

## 4. Core threads the helpers never touch (Years 3–5)

| Thread | Missions | Why no helper |
|---|---|---|
| Muhammad sightings #13–#29 | M050, M053, M055, M061, M063, M072, M073, M077, M084, M094, M097, M100, M105, M111, M114, M116–M120 | Helpers never see him. Taty's cat may look at where he is (M063, M111) and nothing is said |
| Seals | M054, M064, M070, M081, M083, M090, M091, M114 | Each seal is won by its own faculty's skill and placed by its own bearer |
| Coils | M070, M081, M090, M104–M106, M112–M116 | Coils are lit by the people the story has earned |
| The Maker's big words and quotations | M061 (B4, Q1), M066 (Q8), M070 (B5), M071 (Q2), M081 (B6), M082 (Q9), M090 (Q11), M092 (B7, Q3), M098 (B8), M105 (Q7), M106 (B9), M111 (Q10), M114 (Q4), M116 (B10, Q12, Q13, Q14) | The asker of each big word is core cast |
