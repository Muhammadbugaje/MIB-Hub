# MISSION FORMAT v1 (shared by both writers)

**Read with:** `../STORY_BIBLE_V2.md` (the authority for plot, cast, twists, the Muhammad tracker and the [OWNER ONLY] truth). This file fixes **how a mission is written** so that Years 1–2 (`Y1.md`, `Y2.md`) and Years 3–5 (`Y3.md`, `Y4.md`, `Y5.md`) read as one book and the cutscene blocks can be built by the Cutscene Director without rewriting.

## 1. The mission template (copy exactly)

````
#### M### · Title
**When:** year · semester and week · day type · time. **Where:** district: places. **Who:** core cast. **Special helpers (if enabled):** names.
**Connects to:** M## (what the callback is); M## (…).
**Mystery:** plants CLUE-ID (what the player sees); pays CLUE-ID (what now makes sense).

**Story.** 400–800 words. Setup, beats, the twist, the ending. Rich humour, specific places and objects. Never explain everything.

**Steps.**
1. `objective text with {{TOKENS}}` · `loc.id` · completeWhen: `…` · fail: `…` → retry: `…`
2. …

**Special characters.**
- **[IF special.jiya]** how she joins · what she does · power used · 3–6 draft lines with IDs.
- **[ELSE]** who does it instead, or how the step changes. The story must be identical without her.
(repeat for special.taty, special.madison where they fit)

**Cutscenes.**
```cutscene
…one block per cutscene…
```

**Reward:** … **System taught:** … **Calendar fit:** …
````

**Rules.**
1. **Story length:** 400–800 words. Present tense, second person ("you"). The player speaks little: 1–8 words a line.
2. **One new idea, one twist, a laugh in the first 30 seconds,** a reason for every trip, a reward that changes something (bible §9.2 of the design).
3. **Never explain** a background mystery in a mission. Plant, call back, and leave. Check every clue against bible §13.
4. **Steps** are 4–9 per mission. Objective text is what the HUD shows: under 60 characters, tokens allowed.
5. **Special characters never carry plot.** Remove every `[IF special.*]` block and the mission must still work and still be funny.
6. **No failing** in M1. Elsewhere a fail always has a kind retry from the last step; nobody dies, nobody is expelled.
7. **Modest, non-lethal, opposite-sex romance only, laugh with people.** Hausa, Mandarin, Korean and Portuguese/Italian phrases are drafts for native review and always subtitled.
8. **Art direction (new):** fun cartoon-styled characters, expressive and readable, not bulky. Describe looks and acting accordingly (big gestures, clear silhouettes, elastic comic timing).

## 2. Tokens
`{{PLAYER_NAME}}`, `{{ROOMIE}}` (Bature for a male player, Firdausi for a female player; id `npc.roomie`), `{{UNI_NAME}}`, `{{UNI_SHORT}}`, `{{TOWN}}`, `{{GAME_NAME}}`, `{{PARTNER}}` (current romance partner, falls back to `{{ROOMIE}}`).

## 3. IDs

### 3.1 Cast ids
| Kind | Pattern | Examples |
|---|---|---|
| Player | `player` | role name `PLAYER` |
| Core NPC | `npc.<name>` | `npc.roomie`, `npc.jega`, `npc.shamsu`, `npc.mubarak`, `npc.nusaiba`, `npc.zainab`, `npc.bolaji`, `npc.big_baby`, `npc.maker`, `npc.muhammad`, `npc.baba_porter`, `npc.lawal`, `npc.maryam`, `npc.lyzzy`, `npc.lily`, `npc.emily`, `npc.aleeya`, `npc.helen`, `npc.okonkwo`, `npc.khadija`, `npc.dr_minus`, `npc.garba`, `npc.mrs_adebayo`, `npc.mr_clement`, `npc.mrs_shehu`, `npc.mai_shayi`, `npc.kb`, `npc.hajiya_ladi`, `npc.mama_nkechi`, `npc.megawatt`, `npc.aliyu`, `npc.bilkisu`, `npc.hauwa`, `npc.abbas`, `npc.kelechi`, `npc.tunde`, `npc.tanko`, `npc.wednesday`, `npc.lula`, `npc.faty`, `npc.ab`, `npc.basit`, `npc.lucky`, `npc.kabiru`, `npc.asiya`, `npc.baba_dam`, `npc.danladi`, `npc.mum`, `npc.dad` |
| Special | `special.<name>` | `special.jiya`, `special.taty`, `special.madison`, `special.mib` |
| Animal or prop actor | `prop.<name>` | `prop.goat_sarki`, `prop.eel`, `prop.cat_pixel` (Taty's cat), `prop.robot` |
| Crowd | `crowd.<tag>` | `crowd.freshers`, `crowd.traders`, `crowd.fans` |

**Dr. Zainab is core cast** (`npc.zainab`), not a conditional helper: the story needs her. `special.zainab` only switches her *playable* form and her cameo missions. **[OWNER: if the real Zainab ever withdraws, the role is recast globally as a stand-in house officer with the same lines; no mission changes.]**

### 3.2 Location ids
`loc.<district>.<place>`; camera and mark anchors are `<place>_<name>`.
Districts: `gate`, `admin`, `eng`, `med`, `life`, `phys`, `comp`, `law`, `edu`, `arts`, `envd`, `agric`, `lib`, `hostel`, `sports`, `student`, `market`, `mall`, `staff`, `dam`, `forest`, `secret`, `town`.
Examples: `loc.gate.main`, `loc.admin.senate_steps`, `loc.admin.registry`, `loc.admin.bursary`, `loc.admin.bank`, `loc.admin.clock_tower`, `loc.admin.door7`, `loc.eng.theatre_gabas`, `loc.eng.theatre_yamma`, `loc.eng.garden`, `loc.eng.elec_lab`, `loc.eng.workshop_mech|civil|elec`, `loc.med.ae`, `loc.med.childrens_ward`, `loc.med.garden`, `loc.arts.radio`, `loc.envd.sculpture_garden`, `loc.agric.farm_gate`, `loc.agric.barn`, `loc.lib.main`, `loc.hostel.room`, `loc.hostel.corridor`, `loc.hostel.kitchen`, `loc.hostel.roof`, `loc.hostel.lodge`, `loc.sports.court`, `loc.sports.pitch`, `loc.sports.stadium`, `loc.sports.gym`, `loc.student.spot`, `loc.student.sug_basement`, `loc.student.cinema`, `loc.student.love_garden`, `loc.student.mai_shayi`, `loc.market.main`, `loc.market.tailor`, `loc.market.motor_park`, `loc.mall.atrium`, `loc.mall.basement`, `loc.mall.loading_bay`, `loc.staff.club`, `loc.dam.pier`, `loc.dam.cliff`, `loc.dam.underwater`, `loc.forest.edge`.
A new place may be added by either writer: use the pattern and list it at the top of your file.

### 3.3 Line ids (every spoken line has one)
`m<NNN>_<scene>_<seq>` where scene is `open`, `mid1`, `mid2`, `close`, or `play` (gameplay barks), and seq is two digits. Player lines use `p` + two digits. Special-character lines use a letter prefix: `j` Jiya, `t` Taty, `d` Madison, `b` MIB.
Examples: `m002_open_01` · `m002_open_p01` · `m002_play_j02` · `m014_close_t01`.
The voice scripts are later split per character by `who`, so **never reuse an id**, and never give one line to two speakers.

### 3.4 Clue ids (for the "Mystery" line)
| Id | Thread | Id | Thread |
|---|---|---|---|
| `C-NOTE` | the note; "Five more"; Baba Porter | `C-SYMBOL` | six dots and a seventh |
| `C-CLOCK` | stopped at 6:06 | `C-HUM` | the garden coil's note |
| `C-BROADCAST` | the 6:06 radio count | `C-PAGE41` | the missing logbook page |
| `C-DOOR7` | the Senate basement door | `C-606` | Room 606 and its post |
| `C-STATUE` | the girl feeding fish | `C-BENCH` | the warm bench; the hospital garden bench |
| `C-PHOTO` | old photographs | `C-CAPE` | the weathervane cloth |
| `C-KB` | KB's prices | `C-BOARD` | the night noticeboard |
| `C-CATS` | the ring of cats | `C-SACK` | the sack marked T |
| `C-SISTER` | the Maker's sister | `C-AWAY` | his absences |
| `C-SEVENTH` | the seventh space, stool, plaque | `C-SEALS` | ten sockets, ten seals |
| `C-SNITCH` | who told Dr. Khadija | `C-PADLOCK` | who wanted the halls empty |
| `C-ECHO` | copies of you | `C-COAT` | the second name |
| `C-LETTER` | "Stay" | `C-LAUGH` | page nine |
| `C-GOAT` | Sarki; who opened the gate | `C-IDK` | Helen's name |
| `C-TANKO` | the riddler's past | `MS-##` | Muhammad sighting number, from bible §10.6 |

## 4. Steps: the `completeWhen` vocabulary
`reach(loc)` · `talk(npc)` · `choice(id)` · `collect(item, n)` · `deliver(item, npc|loc)` · `use(item)` · `ride.arrive(vehicle, loc)` · `follow(npc, maxDist)` · `escort(npc|crowd, loc)` · `minigame.pass(name[, score])` · `timer(seconds)` · `time(HH:MM)` · `flag(name)` · `photo(subject)` · `switch(role)` (companion switching) · `cutscene.end(id)`.
Minigame names in use: `lecture`, `queue`, `cook`, `steady_hand`, `football.pass`, `football.shoot`, `scuffle`, `lift`, `swim`, `dive`, `bargain`, `rhythm`, `search`, `stealth`, `tail`, `drive`, `carry`, `switchboard`, `sequence`, `wind_coil`, `moot`, `crowd_gather`.
Fail states are optional and gentle: `fail: spotted → retry: last step`. Use `fail: none` where the step cannot be failed.

## 5. The cutscene block

```cutscene
id: cut_m002_open
type: full            # full | ambient | vehicle | entry | event
skippable: true
maxDuration: 35       # seconds; the watchdog ends it here
playOnce: true
cast: { PLAYER: player, ALEEYA: npc.aleeya, CLERK: npc.mrs_adebayo, JIYA?: special.jiya }
timeline:
  - at: 0.0  camera.cut: { shot: wide, from: senate_crane_high, look: senate_queue, dur: 4.0 }
  - at: 0.5  music.play: { cue: queue_theme, duck: true }
  - at: 1.0  actor.walk: { who: PLAYER, to: queue_end }
  - at: 4.0  say: { who: CLERK, id: m002_open_01, text: "Four passports.", mood: bored }
  - if: special.jiya
    then:
      - at: 6.0  say: { who: JIYA, id: m002_open_j01, text: "Right.", mood: amused }
  - at: 9.0  camera.return: { blend: 1.0 }
endState: { PLAYER: { at: queue_end }, flags: { m002_started: true } }
```

**Rules for blocks.**
1. **Ids:** `cut_m<NNN>_open`, `cut_m<NNN>_mid_<K>`, `cut_m<NNN>_close`. Every main mission has an open and a close. A mid block is added whenever a scene needs one.
2. **Length:** 10–40 seconds. `maxDuration` is the hard cap. **One exception:** the opening film (M1) is a chain of five blocks, `cut_m001_film_a` to `_e`, each within the cap, played back to back, skippable as one.
3. **Skip equals watch:** `endState` must leave the world exactly as if the scene had played: positions, items, flags.
4. **Optional roles** end in `?` in `cast` and may only act inside `if: special.<name>` … `then:`. An `else:` list is allowed when the fallback needs its own line.
5. **Timeline keys** (one per entry, after `at:` seconds):
   - `camera.cut`, `camera.move`, `camera.follow` `{ shot: wide|medium|close|over_shoulder|pov|top, from, look|who, dur }`, `camera.shake { amt, dur }`, `camera.return { blend }`
   - `actor.walk|run { who, to }`, `actor.anim { who, anim }` with anim one of `sit, stand, hug, wave, phone, eat, look, gesture, laugh, shock, point, nod, shake_head, carry, write, kneel, sleep, cheer, facepalm, horns` (`horns`: Taty's rock-concert hand sign when she wins; only for `special.taty`)
   - `actor.look { who, at }`, `actor.enter|exit { who, vehicle }`, `actor.ride { who, vehicle, to }`, `actor.show|hide { who }`
   - `say { who, id, text, mood }` with mood one of `neutral, warm, amused, bored, stern, sharp, shy, proud, scared, sad, excited, dry, whisper`
   - `sfx.play { cue }`, `music.play|stop { cue, duck }`, `light.set { preset }` (`day, dusk, night, blackout, candle, torch, coil_glow`), `prop.show|hide|move { id, at }`, `fx.play { id, at }` (`shade_drift, coil_spark, dust, rain, flicker`), `title.card { text }`, `calendar.show { text }`
6. **Speech is short.** No line over 90 characters. Subtitles carry the translation in brackets after non-English text.
7. **Humour reads without sound:** every funny line has a matching visible action.
8. **Mystery beats are silent** where possible (a look, an object, a light), so skipping subtitles does not spoil or explain them.

## 6. Special-character integration (the owner's rule)

When a special character is approved and switched on (`special.<name>` true), they turn up in certain **main** missions to help: they join a step, use their power, and add lines. Switched off, the mission plays identically through its `[ELSE]`.

| Character | How they help in play | Power used | Voice notes for the writer |
|---|---|---|---|
| **Jiya** | Reads the rule nobody read; talks security, clerks and bullies to a standstill; cancels a fine; hands you a one-use "Objection!" | Legal Immunity | Calm British delivery. Never shouts. Roasts politely and at length. "Right." "Mate." "With respect, and I mean none." She enjoys being right, and enjoys you getting there even more |
| **Taty** | Runs when nobody else can: messages, torches, water, fuel; paces you in the gym and the pool; her cat notices what people miss | Never Tired | Warm, cheeky, competitive. "Bora!" Laughs while she laps you. Kind underneath every tease |
| **Madison** | Gets the best price; turns a crowd by starting a dance; skips a queue by talking faster than it | Trend Setter | Very fast; Mandarin and English mid-sentence; narrates her own life as content. "Aiya!" "Jiayou!" "Wait wait wait, film this" |

Every one of their lines is a **draft for the real person to change**; their voices are theirs alone and are never used for any other character. (Only the owner's voice, as MIB, may be reused.)

### 6.1 Appearances, Years 1–2 (written in `Y1.md`, `Y2.md`)
| Mission | Jiya | Taty | Madison |
|---|---|---|---|
| M2 Queue Theory | Reads the fee notice; cancels the "shortcut" fine | | |
| M4 Matric Fit | | | Restyles the giant gown as a "look"; films the kite moment |
| M7 Fresher Tax | Informs Big Sly what his tax is called in law | | |
| M8 Left Boot First | | Runs the warm-up; laps the squad | |
| M10 The Plug | | | Bargains Mubarak's stock down |
| M12 Count Entropy | | Carries torches between blocks | |
| M14 Sly's Last Stand | | Your gym partner; referee's assistant | |
| M16 The Dam at Midnight | | Surface swimmer; her cat watches the pier | |
| M17 Keke Grand Prix | Argues your licence past the examiner | | |
| M19 The Vice-Chancellor's Cup | Finds the guest-player rule (with Nusaiba) | Fitness coach on the bench | |
| M26 Grand Opening | | | Starts a dance on the one-way escalator |
| M27 Plug and Play | | | The third bargaining round |
| M28 Okada Diploma | | Order three's customer (a visiting team's keeper); races your okada to the gate on foot | |
| M30 Meter Reader | Talks a guard out of noticing you | | |
| M31 Point of Order | Coaches you in the law library | | |
| M37 Scout in the Stands | | Out-runs the goat | |
| M39 New Site Goes Dark | | Runs beside the convoy with water | |
| M42 Night Shift | | The diesel relay | |
| M43 The Plan | Reads the by-laws; defines "trespass" | Scouts the mall on a jog | |
| M46 The Hearing | Sits behind Nusaiba; one "Objection." | | |
| M47 Two Papers, One Day | A judge at the robotics qualifier; gives the robot its one perfect mark | Clears the path for the okada through the change-over crowd | |

### 6.2 Planned appearances, Years 3–5 (guidance for the second writer; change the detail, keep the spread)
| Mission | Who | Suggested help | Suggested fallback |
|---|---|---|---|
| M50 Indefinite | Jiya | Quotes congress standing orders so Nusaiba's motion is heard | Nusaiba does it herself, slower |
| M52 Garri Economics | Madison | Sells the Sapa Combo with a jingle and a dance | Mubarak's own patter |
| M54 Farm Hands | Taty | Herds on foot when the tractor stalls; a farm cat joins hers | Emily on a bicycle |
| M57 The Sit-Down | Taty | Gets {{ROOMIE}} outside for "one lap, I lied, half" | Jega does it |
| M63 Injury Time | Taty | First to Jega with ice; keeps him still | Helen's teammate |
| M66 The Idle King | Taty | Plays the whole moonlight match without subbing | A town player |
| M68 Padlock Receipts | Jiya | Reads the lease refusal: "Nothing illegal. How irritating." | Nusaiba alone |
| M69 Ranger Lawal's Debt | Taty | Swims the line across with you | You swim it alone, longer |
| M75–M76 Viral, Collab | Madison | Teaches Lucky what a real trend is; out-dances him | Lyzzy films instead |
| M78 Rehab | Taty | Pool laps with Jega; never lets him count wrong | Coach Ngozi |
| M79 Manifesto | Jiya | Checks the electoral rules; finds the poster-size clause | Aleeya reads them |
| M83 Proof of Work | Jiya | The ethics judge (ties to cameo J3) | The Dean judges |
| M85 Election Day | Jiya | Independent observer at the recount | Comrade Sadiya |
| M86 Payday | Madison | Hosts Black Friday at the Plug as a live sale | Mubarak hosts |
| M88 Comeback | Taty | Warm-up; "left boot, right boot, who cares, run" | Coach Danladi |
| M100 The Missing Script | Jiya | Drafts the complaint; refuses to let anyone skip a step | The legal aid clinic |
| M102 Megawatt's Offer | Jiya | Reads Clause 9 of the buy-out to Mubarak, slowly | Nusaiba by text |
| M107 Contract | Jiya | "Left boot first" becomes a schedule to the contract | Nusaiba by text |
| M111 The Longest Night | Taty | Runs the lantern line's far end all night | Jega's teammates |
| M112 Three by Road | Taty, Madison | Runner between sites; Madison turns the mall crowd with a dance | Okada riders; Mubarak |
| M114 The Ten Seals | Jiya | Reads the right of way aloud at the door | Nusaiba reads it |
| M118 Convocation | all | One line each in the crowd | None needed |

**Balance for the whole game, as written (counted by `tools/story/check_missions.py`):** Jiya 32 main missions, Taty 34, Madison 21, including one-line appearances, plus their cameo missions (bible §8.9). Never two special helpers leading the same step.

## 6.3 Changes from the owner (both writers must apply)
1. **Kaltume is now Helen.** Jega's girlfriend ("IDK") is named **Helen** everywhere: id `npc.helen`, role `HELEN`. "IDK" stays as her nickname (the joke is Jega's "Ban sani ba", not her name). The Year 5 dinner beat (M109) now reveals "Helen": "Sunanta Helen. Her name is Helen."
2. **Signature moments** (one big clip-worthy scene each; keep them intact when editing):
   - **Jiya:** the courtroom roast at the moot court, in **M31 Point of Order** (Year 2).
   - **Taty:** the cat chase across the stadium, in **M37 Scout in the Stands** (Year 2).
   - **Madison:** the campus-wide dance trend, in cameo **D2 Trend First**, seeded in **M26 Grand Opening**.
   - **Dr. Zainab:** the night shift, **M42 Night Shift** (Year 2), echoed in M64 and M94.
3. **Looks (from the owner's reference photos; cartoon style, modest outfits).**
   - **Jiya:** tall and slim; long wavy dark-brown hair with caramel ends; sunglasses pushed up on her head. Outfits: smart-casual with a gamer hoodie; a red football cap and jersey (she loves football); a law graduation gown for court scenes. She also loves **chess** (cameo J4: she crushes Shamsu).
   - **Taty:** long straight black hair; a black choker. Outfits: gym wear; a floral dress with white sneakers; a black romantic dress for dinners; rock-concert energy (she throws the horns sign when she wins). Cats and games.
   - **Dr. Zainab:** very fair-skinned; her friends' affectionate nickname for her is **"Snow White"** (used by friends in a few warm barks, never mocking, never by patients). Hijab styles, scrubs or smart modest outfits, a cat keychain, a pen torch, tired eyes and a perfect eyebrow. No text may describe her as dark or deep-skinned.
4. **Voices:** special characters are voiced by the real people. Their voices are locked to them. Only the owner's (MIB's) voice may be reused. The character editor's free voices are for the custom fresher only.

## 7. Checklist before you save a mission
- [ ] Header, Connects to, Mystery, Story (400–800 words), Steps, Special characters, Cutscenes, Reward line.
- [ ] Every `say` has a unique id. Every optional role is under an `if:`.
- [ ] `endState` matches the first step's start.
- [ ] The mission works with every `[IF]` removed.
- [ ] One clue planted or paid; nothing explained that bible §13 keeps hidden.
- [ ] A Muhammad sighting appears only if it is in bible §10.6.
