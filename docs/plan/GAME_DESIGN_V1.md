# GAME DESIGN DOCUMENT: the new game (version 1)

**For:** the owner, to read and change before anything is built. The story is in a separate document (`STORY_BIBLE_V2.md`), written from this design.
**Replaces:** the "one campus, many lenses" idea in the Master Game Guide v3 §7.4. The owner chose **one story, many playable characters**.
**Engine and platform:** see Master Game Guide v3. Nothing here depends on which engine wins the bake-off.

---

## 1. The game in one paragraph

You arrive at **{{UNI_NAME}}**, a big fictional federal university in northern Nigeria. You live five years there: lectures, exams, hostel life, sapa, friendship, love, football, hustles and a mystery that runs under the whole campus. One story, told the same way whoever you play. You can play as the fresher you design, or **unlock special characters**, each with their own look, voice and **superpower**. The campus runs on a real calendar: weekdays feel like school, weekends feel like freedom, exam weeks feel like panic, and nights are quiet. It is full of secrets, treasures and funny people, and it changes with you: your body, your stats, your money, your friends.

---

## 2. Decisions the owner has made (locked)

| Decision | What it means |
|---|---|
| **One story** | Every playable character plays the same missions and the same script. Differences come from the character's look, voice, perk or superpower and a few personal barks; the story itself doesn't change. |
| **Many playable characters** | A default fresher (custom), plus many **special characters**, locked by default. They unlock by code, purchase, event or achievement. |
| **A fictional university** | No real university name, crest or logo. Place names are original, "inspired by" northern Nigerian campus life. |
| **Full academic map** | Every faculty and department is on the map, and each faculty has missions. |
| **Planned, calm crowds** | Fewer people, each on a routine that follows a real calendar and timetable. |
| **A superpower shop** | Timed boosts you buy with in-game money, some given free before hard missions. Some cheats are also sold here. Prices are editable by the admin. |
| **A new git repository** | A new project, a new repo. Domain and Discord come later. |

---

## 3. The university ({{UNI_NAME}})

### 3.1 Name (owner to choose; the name lives in config)
Options (fictional, sounding real):
1. **Kufena Federal University** (KFU): named after a hill, like many northern landmarks.
2. **Amana University of Science and Arts** (AUSA): "amana" means trust.
3. **Sahel Federal University** (SFU).
4. **Northern Crescent University** (NCU).

The default in documents is the token **{{UNI_NAME}}**, and the town is **{{TOWN}}** (default: "Gidan Kwari"). The game's own name stays separate ({{GAME_NAME}}).

### 3.2 Map layout
The campus is a **ring road** around the academic core, with hostels north, sports east, market and town south, and the dam and forest west.

| District | What's there |
|---|---|
| **Main Gate and Admin** | Main Gate, security post, Senate building, Bursary, Registry, Admissions, the bank and ATMs, the bookshop, the Clock Tower (an original landmark) |
| **Faculty of Engineering** | Departments: Electrical, Mechanical, Civil, Chemical, Agricultural, Metallurgical and Materials, Mining (Petroleum), Computer, Telecommunications, Water Resources. Workshops, labs, a pilot plant. Theatres: the Twin Theatres (two large lecture theatres; original names, chosen by the owner) and the Engineering Garden |
| **Faculty of Medicine and Health Sciences** | Medicine and Surgery, Nursing, Pharmacy, Medical Laboratory Science, Physiotherapy, Anatomy, Physiology. The **teaching hospital** (wards, A&E, outpatients) is next door. Anatomy lab (respectful, never gory) |
| **Faculty of Life Sciences** | Biology, Botany, Zoology, Microbiology, Biochemistry. A greenhouse, a small zoo garden, a herbarium |
| **Faculty of Physical Sciences** | Physics, Chemistry, Mathematics, Statistics, Geology. Observatory dome, chemistry labs, rock garden |
| **Faculty of Computing** | Computer Science, Software Engineering, Cybersecurity, Information Systems. Hackathon hall, server room |
| **Faculty of Law** | Moot court, law library, legal aid clinic |
| **Faculty of Education** | Education departments, Demonstration School (primary and secondary pupils on weekdays) |
| **Faculty of Arts and Social Sciences** | English, History, Languages (Hausa, Arabic, French), Mass Communication with **campus radio and TV**, Economics, Political Science, Sociology |
| **Faculty of Environmental Design** | Architecture, Fine Arts (with the **Sculpture Garden and Art Gallery**), Urban Planning, Building |
| **Faculty of Agriculture** | Farms, animal science (goats, cattle, poultry), the farm shop, tractors |
| **Library** | The main library (4 floors, quiet zones, the rare books room: part of the mystery), plus faculty libraries |
| **Hostels** | Main-campus hostels (old, legendary, crowded) and New Site hostels (newer, far, the shuttle). Female and male blocks. Common rooms, kitchens, rooftops |
| **Sports Complex** | Stadium, football pitches, basketball, the pool (indoor swimming), the gym, tennis, the athletics track |
| **Student Life** | Student Union building, cafeteria, the "Spot" (a food court), mosque and chapel (respectful, open spaces), the Cinema Hall, the clubs' houses |
| **Market and town** | **Gidan Kwari market** and the mall (stores, arcade, dance floor), mama put, tailors, phone repair, print shops, the motor park |
| **Staff quarters** | Lecturers' houses (some missions), the staff club |
| **The dam and forest** | The reservoir with the visitor centre, fish, swimming, the forest ranger; the endless wilderness beyond the campus |
| **Secret places** | Old tunnels, rooftops, the abandoned observatory annex, the Maker's workshop (see the story) |

**Every faculty has:** its own look (colour accents, sign style), a building with an interior, at least **3 main or side missions**, 1 repeatable activity, 2 secrets and a faculty "legend".

### 3.3 Fictional, not fake
Buildings take inspiration from northern Nigerian campus architecture (louvres, verandas, laterite, concrete, shade trees) but are original designs. Signs are generated from config (the sign-slot system), so names can change.

---

## 4. The calendar and the living campus (fixes "too many people everywhere")

### 4.1 The calendar
- **The date is always visible:** weekday, day and month, semester week, and a label for the day type, for example "Tue 14 Nov · Week 6 · Lecture day".
- **The academic year:**
  1. Freshers' week (resumption);
  2. Semester 1: lectures with tests in weeks 5–8;
  3. Exam weeks;
  4. Break;
  5. Semester 2;
  6. Exams;
  7. Long vacation (summer jobs, the town).
  
  There are 5 years, and convocation at the end.
- **Day types:** lecture day (Mon–Fri), weekend (Sat, Sun), test week, exam week, public holiday, Sallah or Christmas break, strike (story year 3), and event days.
- **Time:** 1 real second is 1 game minute (as now), with an option to change it. Sleep skips to morning.

### 4.2 Population rules
**There is a fixed number of people:** everyone you see is a person with a schedule. The game generates a **population** of about 300–600 named "lightweight" students and staff, but only **25–60 are ever drawn near you** (by quality tier). Each has a faculty, a year, a hostel, a timetable, habits and friends.

**Where people are depends on the day type and the hour:**

| Time | Lecture day | Weekend | Exam week | Night (any) |
|---|---|---|---|---|
| 07:00–08:00 | Hostels → paths to faculties (the morning rush) | Hostels quiet, a few joggers | Paths to exam halls, people cramming on benches | — |
| 08:00–14:00 | **Faculties and lecture halls full**; library steady; market quiet | **Market and mall busy**, sports busy, hostels lively | Exam halls packed, library packed, everything else empty | — |
| 14:00–18:00 | Labs, tutorials, cafeteria, sports | Market, cinema, sports, visits | Library, reading groups | — |
| 18:00–22:00 | Hostels, cafeteria, small groups going to **evening tutorials**, the mosque and chapel, the Spot | Social events, parties, the cinema, the market's night stalls | Night reading, quiet | Few people outside; security patrols |
| 22:00–05:00 | Almost empty. Security, a few night readers, the odd generator | Late parties at the Spot (weekends only) | Night readers in reading rooms | Very quiet |

**Density caps:** each zone has a maximum number of people visible at once (for example a footpath shows 4, a lecture hall shows 40 inside but never spills into the road). Crowds appear only where the schedule puts them. Empty is allowed; empty at 2 a.m. feels right.

**Further rules:**
- **No spawning in view, no spawning on roads** (as now).
- People enter and leave buildings through doors.
- Friends follow their own timetable unless you invite them.
- **Planned life:** queues at the bank on allowance day, crowds at the noticeboard when results come out, a rush at the cafeteria at 13:00, football at 17:00, Friday prayers, Sunday service, the market's busiest day (Thursday).
- **Validator and bot checks:** a bot walks through a full simulated week and counts people per zone per hour. The test fails if any zone breaks its cap, or if students are in the market on lecture-day mornings.

### 4.3 Events from the calendar (automatic)
These are switched on automatically by date. Each is a data entry:
- Freshers' week (orientation, matriculation);
- inter-faculty football;
- departmental dinners;
- the **Faculty Week** of each faculty (each has its own one);
- harmattan festival;
- the cultural day (many cultures, food stalls);
- exam week (tense music, library rush);
- results day;
- elections week (the Student Union);
- Valentine's;
- Sallah and Christmas (respectful, optional activities);
- Independence Day;
- the sports gala;
- convocation.

The admin can add, edit, disable or kill any event without a code change.

---

## 5. Playable characters

### 5.1 How "one story, many characters" works
- **Every character plays the same missions and the same script.** The story refers to the player by name using tokens, so it reads right for anyone.
- **What changes with the character:**
  1. Looks.
  2. Voice: the special character's actor records the **player lines** (about 200–300 short lines; the player is a "light talker" so this stays affordable).
  3. **A superpower or perk** (it changes how you play, not what happens).
  4. A few personal **barks** (reactions, jokes, roasts) that play in shared moments.
  5. Their own phone contacts' nicknames for them.
  6. A personal **intro card** before the opening.
- **What never changes:** missions, story beats, choices, rewards and endings.
- **Saves are per character,** so you can have a separate save as each character (this uses the save slots).

### 5.2 The default character
**"The Fresher" (customisable):** body, face, skin tone, hair, outfit and voice tone. Perk: **"Fresh Legs"**, learns 10% faster (stats rise faster). Always unlocked.

### 5.3 Special characters (locked by default)
**Rules for every special character:**
- They are **locked** at the start.
- They unlock by code (server-checked), purchase, event, or achievement.
- Each has a superpower that is fun but doesn't break the story.
- Each can be edited by the admin (name, looks, script, barks, power numbers).
- The real person approves their character before it goes live.
- A **kill switch** hides any of them at once.

| Character | Who they are | Look | Voice | Superpower (playable) | Unlock |
|---|---|---|---|---|---|
| **M.I. BUGAJE (MIB)** | The creator. Calm, quiet confidence | Light-skinned, dark coily hair, white and gold "MIB" kit | The owner | **Undefeatable**: can't be knocked down; every fight and race won by skill | Owner-only secret code |
| **Jiya** | Studied law, now a software engineer and a serious gamer. Very funny, roasts everyone with a calm British delivery | Tall, lean, Indian heritage, British accent; smart-casual with a gamer hoodie | Real person (her approval needed) | **"Legal Immunity"**: security and fines can't touch her. She talks her way out of any arrest and offences cost nothing; heat drains fast. Also "Objection!", a dialogue option that wins any argument once per mission | Her personal code; later purchase |
| **Taty** | Loves games and cats, warm, cheeky, competitive | Portuguese or Italian-looking, curvy and fit, often with a cat on her shirt or bag | Real person | **"Never Tired"**: infinite stamina; sprint, swim, dance and football never drain her. Food matters less. A stray cat follows her around campus | Her personal code; later purchase |
| **Zainab** | **Doctor** (house officer at the teaching hospital, a recent graduate of the medical faculty). Loves cats and Korean culture (K-drama, K-food). Very nice, but sharp when you don't listen | Hijab styles, scrubs or smart modest outfits, a cat keychain | Real person or a voice actor | **"Doctor's Orders"**: heals herself and friends; knocked-down friends get up instantly near her; in co-op she can revive anyone; health regenerates. Bonus: patients at the hospital give her side quests | Achievement (finish Year 1), or code |
| **Madison** (Mandarin speaker) | Fast-talking, trend-copying, extremely funny, speaks Mandarin and English, makes everything a dance trend | Lean, East Asian heritage, streetwear | Real person | **"Trend Setter"**: when she dances, crowds copy her, raising reputation and money from tips. Her phone videos go "viral" (+reputation). Fast talk lets her skip any dialogue instantly and get the best bargaining price | Code; later purchase |
| **Jega** | Football star, big heart, local hero | Tall, athletic, the jersey | Actor or friend | **"Golden Boot"**: wins every football minigame shot; crowd chants when he walks by | Event (inter-faculty cup) |
| **Shamsu "Professor"** | The genius Electrical Engineering student | Neat, glasses, the pen in his pocket | Friend | **"Big Brain"**: auto-passes tests, sees hidden puzzle answers, explains everything | Achievement (finish Year 2) |
| **Nusaiba** | The organiser and debater | Elegant, always with a folder | Friend | **"Campaign Mode"**: everyone she talks to likes her more, and she can recruit any NPC to help in a mission | Event (elections week) |
| **Mubarak** | The hustler | Flashy but cheap | Friend | **"Plug"**: everything costs 40% less, and he sells anything for double | Achievement (earn ₦1m) |
| **More, from many cultures** | Planned slots for about 10 more, from Nigerian (Hausa, Yoruba, Igbo, Tiv, Kanuri, Ijaw…), West African, Arab, European, South Asian, East Asian, Latin American, Caribbean and African-American backgrounds, each respectful and specific | — | — | One power each, from a list (§5.4) | Mixed |

**Character sheet (one per special character, editable by the admin):**
- name and nicknames;
- real person (yes or no), contract reference, approval status;
- looks (photo references, morph values, hair, outfits);
- voice (actor, accent, pitch);
- personality;
- catchphrases;
- roast style;
- superpower (numbers editable);
- unlock rule;
- price (if sold);
- barks list;
- player-lines script;
- status (draft, approved, live, retired).

### 5.4 The power list (to give future characters)
Never Tired (stamina), Legal Immunity (security), Doctor's Orders (healing), Trend Setter (crowds and money), Golden Boot (sport), Big Brain (tests and puzzles), Campaign Mode (charm), Plug (prices), **Iron Lungs** (breath), **Night Owl** (sees in the dark, no fatigue at night), **Pathfinder** (sees secrets on the minimap), **Gearhead** (repairs vehicles, faster driving), **Chef** (food heals double), **Animal Whisperer** (goats and cats follow and help), **Lucky** (better loot), **Fast Learner**.

### 5.5 Photos → characters (the owner's question)
- **Yes:** send one clear front photo and one side photo per person, plus their height, build and a few outfit photos. **Only for people who've agreed in writing.**
- **How it becomes a character:**
  1. The photos are references.
  2. The face is matched by adjusting the face shapes of the base character (eyes, nose, lips, jaw, skin tone, hair) until it looks like them. Optionally, an image-to-3D tool can speed this up; check its licence and quality on the day.
  3. The result is **"inspired by"**: recognisable, in the game's art style, not a photo copy.
- **What I can do in this environment:** read the photos and write each character's look sheet (morph values, colours, hair, outfits), and later set them up in the game. The final likeness quality depends on the base models and art pipeline chosen in Stage 3.
- **Privacy:** photos are kept out of the public build and repo (only the generated character ships), and deleted on request.

### 5.6 Character editor and voices (the owner's decision)
- **Look:** when starting, the player picks any **unlocked** character and can edit their look: face, skin tone, hair, body, outfit and accessories. Special characters keep a signature look, with optional outfits.
- **Free voices:** about 8–12 voices, male and female across accents, all unlocked.
- **Locked voices:**
  - **A special character's voice belongs only to that character.** Jiya's voice is only ever Jiya's, and the same holds for every real person. Nobody else can pick it, and it is never used for another character.
  - **The exception, set by the owner per voice:** the owner's own voice (MIB) can be reused in several places (narrator, cameos, NPC lines) because the owner decides so.
  - Each voice has a **rights record**: owner, allowed uses, characters, and expiry or revocation.
- **Pitch and tone:** the player can adjust the pitch and tone of free voices only.

---

## 6. Your body and your stats
As in the Master Game Guide v3 §7.2 (health, stamina, endurance, breath, strength, body fat, muscle, smarts, charm, street sense), with **weight and muscle morphs** and a gym. Special characters keep their own looks by default; a setting lets their body change too.

---

## 7. The superpower shop ("The Plug Store")

### 7.1 What it is
A shop that unlocks at **level 8** (a short mission introduces it). There is a branch in the market and one in the Student Union, plus "delivery" via the phone at a higher price. It sells **timed boosts**: items that behave like cheats for a while, then run out.

### 7.2 Items (starting catalogue; all numbers editable by the admin)
| Item | Effect | Durations you can buy | Starting price | Matches cheat |
|---|---|---|---|---|
| **Turbo Sneakers** | +35% run speed | 10 / 30 / 60 game min | ₦800 / ₦2,000 / ₦3,500 | the speed cheat |
| **Zobo Max** (drink) | Infinite stamina | 10 / 30 min | ₦600 / ₦1,500 | the stamina cheat |
| **Iron Lungs Gum** | Breath ×3 underwater | 1 dive / 30 min | ₦300 / ₦1,200 | — |
| **Ghost Hoodie** | Security ignores you | 10 / 30 min | ₦1,500 / ₦4,000 | "send security away" |
| **Lawyer's Card** | Next fine or arrest cancelled | 1 use | ₦2,500 | — |
| **Brain Booster Tea** | Test and puzzle hints | 1 lecture / 1 day | ₦700 / ₦2,500 | — |
| **Charm Spray** | +Charm for conversations | 30 min | ₦1,000 | — |
| **Bike Nitro** | Bike and okada sprint never tires | 10 min | ₦900 | — |
| **Lucky Kola** | Better loot drops | 1 hour | ₦1,500 | — |
| **Full Tank** | Vehicle fuel and repair | 1 use | ₦500 | — |
| **Time-Freeze Watch** (rare) | Mission timers paused | 2 min | ₦6,000 | the timer cheat |

### 7.3 Rules
- **In-game money only at launch.** A real-money version is a later decision, switched off, and **never** for story progress.
- **Free boosts before hard missions:** a friend or the mission gives you one ("Bolaji gave you Zobo Max: you'll need it"). This also teaches the shop.
- **Clear timers** on the HUD; they pause in cutscenes. You can stack different items, not the same one.
- **Leaderboards:** runs using shop boosts or cheats are tagged, as today.
- **The admin can edit** prices, durations, effects, availability, sale days ("Black Friday at the Plug") and free gifts per mission.
- **Cheat codes still work** for those who know them (typed or dialled), and the owner's secret codes stay secret.

---

## 8. Discovery, treasures and Easter eggs
As in the Master Game Guide v3 §7.3: stat treasures, collectible sets, loot, hidden places, campus legends, Easter eggs and photo spots. **New:** every faculty has 2 secrets and 1 legend (§3.2). There is also a **faculty collection**: one item per department (for example a vintage slide rule from Mechanical, a Petri dish trophy from Microbiology). Collecting them all unlocks the "Know Your Campus" achievement and a special outfit.

---

## 9. Missions: structure and quality

### 9.1 Shape of the game
- **Main story:** 120 missions over 5 years, written in the story bible.
- **Faculty missions:** at least 3 per faculty (12 faculties, so 36+). Each teaches something real and funny about that field. Examples:
  - Law: a moot court battle;
  - Medicine: a hospital night shift;
  - Agriculture: the runaway ram;
  - Physics: the observatory night;
  - Mass Communication: run the campus radio;
  - Education: teaching a class of wild primary pupils.
- **Side missions:** 60+ (people asking for help, hustles, legends).
- **Friends (co-op) missions:** 25+ for 2–6 players.
- **Repeatable activities:**
  - jobs (okada, keke, delivery, tutoring, campus radio DJ, library assistant, farm hand);
  - races;
  - football;
  - the gym;
  - cooking;
  - dance battles;
  - the swimming challenge;
  - arcade minigames.
- **Event missions:** from the calendar (§4.3).
- **Special character missions:** each special character has 2–3 short "cameo" missions you can do with them as an NPC friend, even before unlocking them. That is a teaser for unlocking.

### 9.2 Quality bar (every mission)
1. A clear goal within 3 seconds.
2. One new idea or twist.
3. A reason for every trip, with no back-and-forth across campus without a story reason.
4. A funny line in the first 30 seconds.
5. A cutscene at the start and the end (short, skippable).
6. A reward that changes something (money, stat, item, place, friend, story).
7. It fits the calendar: missions happen at believable times (lectures on lecture days, parties on weekends).
8. Readable on a phone.

### 9.3 The first 10 minutes ("must feel like gold")
| Minute | What happens | Why |
|---|---|---|
| 0:00–2:30 | The **opening film**: aerial shots of {{UNI_NAME}}, the car at the gate, your parents, the porter carrying the bags into the room, the hug, the goodbye, other freshers, the logo. Skippable | Emotion and "wow" |
| 2:30–3:30 | **Your room**: your roommate greets you and a funny first exchange. You learn to move and look by walking to the window: the campus view | Control in a safe place, with a reason |
| 3:30–5:00 | **The first walk**: the roommate takes you to the Spot for food (you learn the Pockets, eating and money). The morning rush is happening around you, and the planned crowd shows the calendar working | A living world right away |
| 5:00–6:30 | **The first wow moment**: a runaway goat from the Agriculture farm crashes the food court. You chase it, and the chase teaches sprinting and jumping | Action, comedy |
| 6:30–8:00 | **The first ride**: you return the goat by bicycle to the farm, a short scenic ride past the Engineering faculty and the Clock Tower | Teaches riding, shows the map |
| 8:00–9:30 | **The first secret**: a farmhand gives you a hint; behind the barn is your first **stat treasure** (Kola of Vigour, +stamina) | Teaches discovery |
| 9:30–10:00 | **The hook**: back at the hostel at sunset, you find a strange note under your door with an old engineering symbol, "The Maker is watching. Welcome." Title card: Year 1 | The mystery that pulls you forward |

**Rules:** no menu longer than 10 seconds, no tutorial text box over 1 line, no failing in the first 10 minutes, at least 3 laughs, and at least 1 moment worth recording.

---

## 10. Cutscenes
Everywhere they make the game feel real (Master Game Guide v2 §6 rules: data-driven Director, skip equals watch, endState, maxDuration, watchdog, replayable). Minimum: the opening; both ends of every main mission; first entry to every faculty and key building; vehicle moments; calendar events (results day, elections, convocation); ambient moments; the finale with credits.

---

## 11. Online and social (later, after the game is stable)
- **Co-op friends missions** (the system already exists) and shared campus sessions.
- **Leaderboards:** races, the gym, the swim challenge, the dance battles, collections.
- **Community missions:** players build missions from templates (deliver, find, race, collect, escort, quiz) using existing places and approved rewards. No code is allowed in them. There is a moderation queue, ratings and creator credit. The data format is defined now; the tools come later.
- **Photo mode and clip mode** for sharing (with the logo from config).
- **Creator spotlight events** for special characters.

---

## 12. Money (switched off at launch)
As in the Master Game Guide v3 §10:
- sign-slot sponsorships first;
- cosmetics;
- special character purchases (with the creator's revenue share);
- optional rewarded ads (for example "watch an ad for a free Turbo Sneakers");
- the portal demo;
- a season pass later.

**Never pay-to-win, never story locks.**

---

## 13. Graphics direction (what the new engine brings)
- **Art style: fun, cartoon-styled characters (the owner's decision, 15 Nov), in a richly lit world.** This **replaces** "grounded stylised realism" for characters. Characters are not bulky or bodybuilder-like. Think friendly, expressive, slightly exaggerated proportions (bigger heads and eyes, soft shapes, clean colours), like modern animated films and popular cartoon-style games. They read well on small phone screens, are cheaper to render, and suit the comedy.
- **Bodies still change:** characters can get fat, lean or fit, shown in the cartoon style, not with muscle-man anatomy.
- **The world keeps good lighting:** warm Sahel light, laterite dust, the rainy season and harmattan, soft shadows, and three quality tiers. The lighting and materials are richer than before, while the shapes stay stylised.
- **Likenesses** of real people (§5.5) are made in this cartoon style: recognisable, never photoreal.
- **The prototype screenshots** in `docs/plan/visual_prototype/` (made with free CC0 assets in a quick Babylon.js test) show the lighting, materials, shadows and sky that the new engine gives, **not** final art. Final characters and buildings come from the Stage 3 art pipeline.

### 13.1 "Won't the new engine fix the old problems?" (honest answer)
- **The engine gives us for free:**
  - realistic rendering, lighting and shadows;
  - skeletal animation with smooth blending (no more stick limbs);
  - proper skinned clothes that move with the body;
  - physics for collisions and vehicles;
  - culling and streaming.
  
  That removes most of the **look** problems (blocky people, stiff limbs) and makes the rest much easier.
- **What we still write ourselves:**
  - the game's own rules (seats and door positions in each vehicle, who sits where, crash rules, the quest manager, NPC routines and the calendar, the phone and Pockets, saves, cutscenes, the shop);
  - choosing and tuning animations.
- **Our old fixes become specs and tests** for the new game. The "head through the roof" test, the "no crowds in the market on lecture mornings" test and the roommate test all move over. We don't redo the thinking; we redo the wiring, once.
- **So the owner is right:** the big carry-over work is the **story, missions, cutscenes, characters, the first 10 minutes and the systems' rules**, not the old renderer's fixes.

---

## 14. Admin tools (everything editable)
On the new admin dashboard (Master Game Guide v2 §25), with roles, audit log and rollback:
- **Characters:** looks, script, barks, powers, unlock rules, prices, status.
- **The shop:** items, prices, durations, gifts.
- **The calendar and events.**
- **Population** caps per zone.
- **Missions**, plus the review queue for community missions.
- **Branding:** name, university name, town.
- **Sponsors:** sign slots.
- **Codes:** issue and revoke personal codes.
- **Credits.**

---

## 14a. Retention and mystery features (approved by the owner, 15 Nov)
1. **The Theories board** (a phone app): players pin clues they've found (photos, notes, symbols, overheard lines) and draw links between them. It never tells them if they're right. The board can be shared as an image, which drives talk on social media.
2. **Muhammad sightings, a hidden collectible:** each sighting is quietly logged. See him in all 29 and something happens that is never explained. Players won't know the count exists until someone online finds out.
3. **The weekly mystery drop (live ops):** after launch, one new clue appears each week through a live event (a radio broadcast, a new note, a door that's open for one night). It's data only, so no new build is needed. Keep a backlog of a year's worth.
4. **The unlock greeting:** when a player first unlocks a special character, that real person's recorded line plays in their own voice (for example "Oh, you actually found me…").
5. **Signature moments:** each special guest has one big, clip-worthy scene in the story, built for fans to record and share (Jiya's courtroom roast, Taty's cat chase across the stadium, Madison's campus-wide dance trend, Dr. Zainab's night shift).
6. **Story packs and the concept trailer** go to each real guest together, so they can see it before they say yes.

---

## 15. What happens next
1. The owner reads this design and the story bible, and marks changes.
2. After approval, the story becomes **full scripts**, and the voice scripts are split per character (about 20–25 dedicated scripts, the leads and special characters longest).
3. Stage 0 of the Master Game Guide v3: new git repository, Classic backup, audit.
4. The owner sends **photos and details** for each special character (with consent), and I prepare their look sheets.
5. Engine bake-off, then the vertical slice: **the first 10 minutes**, exactly as in §9.3, at full quality.

### Open questions for the owner
1. University and town names: decided later; tokens {{UNI_NAME}} and {{TOWN}} stay.
2. Names of the Twin Theatres and the Clock Tower (or keep these).
3. The Mandarin-speaking character is Madison. (Decided.)
4. Zainab is a house officer (new doctor) at the teaching hospital. (Decided.)
5. All special characters are voiced by the real people. (Decided.)
6. Should special characters' bodies change with food and exercise like everyone else's, or stay fixed by default (this design: fixed, with a setting)?
