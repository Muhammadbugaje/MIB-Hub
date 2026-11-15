# MASTER GAME GUIDE, version 3

**Freshers School Life (working name; the name lives in config and is never hard-coded).**
**For:** the owner (M.I. BUGAJE) and every AI or human working on the game.
**Status:** plan only. No code is written until the owner approves Stage 0.
**Builds on:** Master Game Guide v2, which stays the engineering rulebook. This file adds the business, content and growth plan, fixes the parts of v2 that would slow us down, and puts everything in one order.

> How to use it: read sections 1–3 first (the why, the honest answers, the order). Each later section is a self-contained spec for one area. When v2 and v3 disagree, v3 wins, and the difference is listed in section 4.

---

## 1. What we are building, in one page

**The product:** a website that is a home for many games, launched by one flagship game: a 3D open-world Nigerian university life game, funny, warm and real, that people play in the browser on cheap phones and can install for offline play.

**Why it can make money:**
1. **Nothing else like it exists.** No polished open-world game is about Nigerian campus life. Students, alumni, the diaspora and their parents all recognise it.
2. **The audience is huge and online.** Nigerian youth are among the most active short-video audiences anywhere, and campus comedy is already a top content genre there.
3. **Influencers can live inside the game.** Real creators appear as characters with their own voice, their fans come to see them, and the creator gets a personal code to play as themselves. That is a growth engine, not just a feature.
4. **The website hosts more games later,** so every new player is also an audience for the next game.

**The flagship's promise (the pitch in one line):** *"Live your five years on campus: make friends, survive sapa, fall in love, get fit or get fat, find every secret, and graduate a legend."*

**The core loop:** take a goal → travel across a lively campus → do it (talk, ride, race, fight, learn, cook, build, swim) → get rewarded (money, XP, stats, items, story) → discover something unexpected on the way → unlock the next goal.

**Three pillars every feature must serve:**
1. **Alive:** the campus feels busy, reactive and full of secrets.
2. **You:** your body, your friends, your choices and your character change the game.
3. **Ours:** it looks, sounds and jokes like a real Nigerian campus, and real Nigerian people are in it.

---

## 2. Honest answers to what the owner asked

### 2.1 "Graphics incredibly improved; characters should almost look real"
- **It is achievable, with one condition.** Moving to Babylon.js or PlayCanvas gives real lighting, PBR materials, soft shadows, skinned characters with real skeletons, facial expressions and proper animation blending. The jump from the current blocky look will be very large.
- **The condition is phones.** Fully photoreal humans (film-like skin, hair strands, cloth simulation) don't run on a ₦60,000 Android phone in a browser. Games that try look great in a trailer and stutter for real players.
- **Recommendation: "grounded stylised realism".** Think of the look of The Sims 4 or Fortnite's realistic skins rather than a photo. Realistic proportions, skin tones and faces, good fabrics, believable lighting, slightly simplified detail. It reads as "almost real" on a phone, it stays consistent, and it scales across three quality tiers (low, medium, high). On high-end PCs and phones we turn on extras (better shadows, reflections, post-processing).
- **What it really costs:** art, not code. A realistic campus needs real 3D models (buildings, props, characters, clothes). That is the biggest budget and time item in the whole plan (section 11).

### 2.2 "Gain and lose weight, build muscle, get fat"
- **Yes, and it is cheap to run.** Each character model has a few **body morph targets** (thin, heavy, muscular, plus belly and arms). The engine blends them with two numbers per character: **body fat** and **muscle**. No extra models are needed.
- Clothes are made with the same morph targets, so they stretch with the body and never clip. This is a rule for the art pipeline (section 11.4).
- The numbers move slowly from what you eat and do (section 7.2). The player sees the change over in-game weeks: a beer belly from too much suya, shoulders from gym visits.
- **Care point:** body change must never be used to mock anyone. Both directions have perks and costs, and nobody in the game is shamed for their size.

### 2.3 "Treasures, loot, Easter eggs that raise stamina, health, endurance, breath"
- **Yes. This is the best single way to make exploring fun.** It is section 7.3: a collectibles and discovery system with permanent stat upgrades (like heart pieces in adventure games and stats in classic open-world games), hidden places, campus legends and secret items.

### 2.4 "Make Jega, Nusaiba and others playable; the story tilts towards whoever you pick"
- **Yes, but not as five full separate campaigns.** That would multiply writing, voice recording and testing by five and the game would never ship.
- **Recommendation: "one campus, many lenses".**
  - One shared main story.
  - Each playable lead gets: their own opening (a different arrival scene); their own perk and weakness; about **8–12 personal missions** that only they get; different reactions from other characters; some story choices that only they can make; and a personal ending scene.
  - About 80% of the content is shared and 20% is personal.
  - That still feels like a different experience, at a cost we can carry.
- **Launch with 2 leads** (the default fresher plus one star lead), and add a new lead with each content update. Each new lead is a marketing moment.

### 2.5 "Real influencers as characters, with secret codes, and paid unlocks later"
- **This is the strongest growth idea in the plan.** It needs to be done carefully. Section 9 covers it, including permission contracts, the code system and revenue share.
- **Nothing is built until the owner names the people and they agree in writing.** For now we build the **system** (special characters behind server-checked codes), and the M.I. BUGAJE secret character becomes its first user.

### 2.6 "One script per voice actor, with the name on top"
- **Yes.** Section 8.4: every character with enough lines gets their own script PDF with the character's name, a picture, a voice brief and only their lines. Minor characters are grouped so one actor voices several.
- For about 50 characters, this gives about **20–25 dedicated scripts**, as asked.
- The leads (Jega, Shamsu, Mubarak, Nusaiba, Zainab and others) get much longer, richer dialogue.

### 2.7 "Room for ads, money and expansions"
- **Yes.** Every money system is designed now and switched off (section 10). The rule that keeps players' trust: **free to play, never pay-to-win, and ads only ever optional.**

### 2.8 "Copy everything into the new website project"
- **Yes. Copy, never move or delete.** The Django site stays exactly as it is (v2 section 18). The new project is a separate TypeScript project.

---

## 3. The order of work (the master timeline)

v2 has nine strict phases with an approval gate before each. That is safe, but it is slow, and it delays the first thing people can see by months. v3 keeps the gates and reorganises the work into **stages that ship something visible** early, because marketing (section 12) needs real footage every week.

| Stage | Name | What exists at the end | Gate (owner approves) |
|---|---|---|---|
| **0** | Freeze, back up, audit | Git repo and backup of the current game; AUDIT, Django inventory, "before" screenshots; a list of what carries over | Audit and carry-over list |
| **1** | New home | The new TypeScript monorepo, website shell on Cloudflare, local SQLite dev database, run guide; the old game embedded and playable as "Classic" | Website live (even if bare) |
| **2** | Engine bake-off | The same small scene (player, car with seats, sculpture garden, dam edge) in Babylon.js and PlayCanvas, with real measurements and side-by-side screenshots | **Engine decision** |
| **3** | Art direction and character pipeline | Style guide; 2 finished playable characters with face, hair, clothes, weight and muscle morphs, and the full animation set; one finished street of campus | Look approved |
| **4** | Vertical slice | Opening film → missions 1–3 → one district, on the new engine, with the new systems (quest manager, saves, cutscenes, stats, discovery), at the performance budget on a real low-end phone | **"This is the game"** |
| **5** | Soft launch (Early Access) | Slice public on the website as free Early Access, plus the devlog, Discord and feedback tools | Launch go or no-go |
| **6** | Content waves | Year 1 complete; then each update adds a district, missions, a new playable lead and an event | Each wave |
| **7** | Platform and money | Accounts, cloud saves, cosmetics shop, optional rewarded ads, special character sales, portal demo | Each switch-on |
| **8** | More games | The second game on the same platform | Per game |

**Why this order:**
- Story, data and design work happen in Stages 0–4 alongside the art, because they don't depend on the engine.
- Animation and physics are fixed **once**, on the new engine. We stop polishing animation in the old renderer now.
- The game is visible to the public at Stage 5. The social media series (section 12) starts at Stage 0, because the journey itself is the content.

---

## 4. Changes to Master Game Guide v2 (and why)

| v2 rule | Change in v3 | Why |
|---|---|---|
| "Complete files only" (output whole files) | Replace with "**small, exact edits, with the whole file re-checked by tests**" | AI agents edit files directly; rewriting whole files caused lost work in this project. |
| No new features until Phases 0–3 are done | Keep for the **old** game. On the new engine, features are built inside the vertical slice from the start. | Otherwise we'd build systems twice. |
| Nine phases, each gated | Eight stages (section 3), each ending in something visible | Marketing needs footage, and morale needs progress. |
| First load 20–30 MB | **First playable in under 15 MB**, then stream | Nigerian mobile data is expensive; the first impression decides everything. |
| Playwright screenshots | Keep, but note that on the owner's Mac (macOS 12) Playwright doesn't work; we use the offscreen WebKit pipeline already built | Real constraint, already solved. |
| Credits: approved flag | Keep, and add **signed release forms** for influencers and voice actors (section 9.3) | Legal protection. |
| v2 has no git yet in practice | **Stage 0 step 1: make it a git repository today** | The current project isn't under version control at all. That is the biggest risk right now. |

Everything else in v2 stays: single source of truth, dynamic config and tokens, cutscene Director rules (endState, maxDuration, skippable), validator, bots, versioned saves, the data layer, the platform layer, packs, live ops, the admin dashboard.

---

## 5. What carries over from the current game

We have built a lot. Most of the **design, data and writing** carries over; most of the **rendering code** does not.

| Carries over as-is or nearly | Carries over as a spec (rebuilt on the new engine) | Left behind |
|---|---|---|
| The 120-mission story, side missions, co-op missions, ambient encounters (data and scripts) | Vehicles and crash physics (masses, impulses, seat anchors, the head-clearance rule) | The custom three.js renderer and its blocky characters |
| Characters' backstories, the cast, humour, quotes | Animation system design (clips, blends, foot planting, clothing rules) | The hand-drawn 2D-era leftovers |
| Voice pipeline, recordings, fillers, role PDFs | Phone UI, Pockets inventory, texts and money from home | Animation polish done in the old engine |
| The validator rules, bots and audit method | Living city (needs, crimes, chases), security heat system, friends who follow and ride along | |
| Map layout and place names (as a design reference) | Dam, swimming, fish, visitor centre | |
| Save-slot design, sound library (CC0) and Sounds editor design | Opening film (rebuilt with the new Director and real characters) | |
| Cheats, the hero system, the Arcade Management ideas | Editors (become the new admin dashboard) | |

**Work in progress when the plan changed** (see the coordinator's memory file `fslg-open-work-2026-11-15`). Each item gets a decision:

| Item | Decision |
|---|---|
| Fable mission review, Year 1 rewrite, new cutscene scripts | **Continue.** Writing and data carry over 100%. The cutscene scripts become data for the new Director. |
| Fable story systems (choices, switching, romance, cooking, workshop, the Maker, weather) | **Continue as design and data only:** finish the rules, data and tests in plain logic, but stop wiring them to the old renderer. |
| Opening film polish and re-render in the old engine | **Stop after the review list** (the list becomes the spec for the new opening). Don't spend another long render. |
| Animation fixes, car-door clips | **Stop.** Rebuilt on the new engine; the rules carry over. |
| Character, config and credits editors in Django | **Stop.** They become the new admin dashboard (v2 section 25). The specs are written. |
| People and combat fixes (melee through walls, pathfinding) | **Stop in the old game**; carry the fixes over as requirements. |
| The rebuilt PDFs and voice PDFs | **Continue**, since script work carries over. The final rebuild happens after the new cast and leads are added. |
| Full test run and bundle rebuild of the old game | **Do once** to freeze a clean "Classic" version that stays playable on the old site. |

---

## 6. The new technical foundation (summary; v2 has the detail)

- **Monorepo:** `apps/web` (Astro site plus React islands), `apps/game-fsl`, `packages/engine-core`, `engine-adapter`, `platform`, `config`, `data`, `ui-kit`, `tools`, and `content/` and `assets/` per game.
- **Engine:** chosen in Stage 2.
  - Babylon.js is written in TypeScript, Apache-2.0 licensed, strong on WebGPU and characters.
  - PlayCanvas's engine is MIT licensed and very light on phones; its editor is a paid cloud service.
  - We don't need either editor. **Verify the licences on the day we decide.**
- **Physics:** Havok (Babylon's official plugin, free for web; check the terms) or Rapier (open source, WebAssembly).
- **Characters:** GLB files with one shared skeleton for every human, so all animations work on everyone. Body and face morph targets, and KTX2 textures.
- **Data:** SQLite in development behind repositories; Supabase (or similar) in production with row-level security; offline-first saves.
- **Hosting:** Cloudflare Pages for the site, R2 for large packs. **Verify the free limits and per-file limits on the day.**
- **Version control and backups:** GitHub (private), with a backup tag before every big change.

---

## 7. Game design: what makes it big, alive and fun

### 7.1 The world: districts and density
- **Districts:** the Main Gate and Senate; the Engineering quad (KT and WT theatres); hostels (old main campus and Phase 2); Samaru Market and mall; the Sculpture Garden and Art Gallery; the dam and visitor centre; sports complex; staff quarters; the forest edge (Ranger Lawal); plus off-campus Samaru town later.
- **Density rule:** something worth stopping for every **30–60 seconds** of walking: a person doing something, a secret, a shortcut, a funny sign, a mini-event.
- **Time and weather:** a day/night cycle with different crowds, rainy season and harmattan haze, NEPA outages (lights go off in the hostels and generators start), exam season (libraries full, everyone stressed), and festivals.
- **Interiors:** every main building has a real interior. Small buildings have one "peek" room.

### 7.2 Your body and your stats (new)
These are your character's own numbers. They change slowly and permanently, and you can see them change.

| Stat | What it does | Goes up by | Goes down by |
|---|---|---|---|
| **Health (max)** | How much you can take before you're knocked down | Health treasures, eating well, fitness | Nothing permanent (non-lethal game) |
| **Stamina** | Sprint length, bike sprint, dance and football length | Running, cycling, football, gym, stamina treasures | Long inactivity (slowly) |
| **Endurance** | How fast stamina refills, and resistance to hunger and fatigue | Long walks, jobs, carrying loads | Too little sleep |
| **Breath** | Time underwater; shouting and singing contests | Swimming and diving, breath treasures | — |
| **Strength** | Pushes, carrying, the fight power cap, gym lifts, building in the workshop | Gym, construction jobs, carrying | Long inactivity |
| **Body fat** | Look (morph), slightly slower sprint, warmer in harmattan, some funny reactions | Eating more than you burn, too much suya and soft drinks | Exercise, fasting, walking |
| **Muscle** | Look (morph), higher strength cap | Gym, sports, jobs | Inactivity, under-eating |
| **Smarts** | Lecture and test results, puzzle hints, special dialogue options | Attending class, library, tutorials, Shamsu's help | Missing class |
| **Charm** | Romance, bargaining at the market, persuasion choices | Good outfits, grooming, kind choices | Rumours, bad choices |
| **Street sense** | Spotting pickpockets, prices, shortcuts | Exploring, market life | — |

- **Body maths (kept simple and fair):** every in-game day, energy eaten is compared with energy spent. The difference moves body fat slowly. Exercise moves muscle slowly. The limits are wide, so any shape is possible. A "look lock" setting freezes your body for players who want that.
- **Each shape has fun pros and cons:**
  - Bigger: wins the eating contest, harder to knock down, slower sprint.
  - Lean: fast, tires in tug-of-war.
  - Muscular: wins arm wrestling, eats more.
- **The gym:** the sports complex gym has mini-games for lifts (timing), treadmill and skipping. A personal trainer NPC gives you programmes. Morning jogs around the campus ring road are a daily activity.

### 7.3 Discovery: treasures, secrets and Easter eggs (new)
The aim: players should talk about secrets with friends ("did you find the thing under the dam?").

**Kinds of secrets:**
1. **Stat treasures.** Permanent upgrades hidden in hard-to-reach places:
   - "Kola of Vigour" (+stamina);
   - "Mallam's Lost Prayer Beads" (+endurance);
   - "Old Swimming Medal" (+breath);
   - "Grandma's Pepper Soup Recipe" (+health).

   About 10 of each, each one a little puzzle (a roof reached by climbing, a dive spot, a riddle).
2. **Collectible sets with rewards:**
   - 170 kola nuts (already designed);
   - lost student ID cards (return them for money and friendship);
   - old exam papers (boost Smarts);
   - campus graffiti tags;
   - vintage campus photos (unlock the "Then and now" gallery);
   - lost keys that open lockers.
3. **Loot:** lockers, abandoned bags, bins and the hostel "storeroom of forgotten things". These are random but seeded, they refill weekly, and they hold food, cash, clothes and materials.
4. **Hidden places:** a rooftop hangout, the old tunnel under the Senate, the forest shrine (respectful, not spooky-mocking), the abandoned lab, the "secret beach" at the dam, the Maker's workshop.
5. **Campus legends:** stories NPCs whisper. Each one leads to a short investigation: the night-crying corridor, the lecturer who never ages, the ghost okada that only runs at 3 am.
6. **Easter eggs:** in-jokes, nods to Nigerian pop culture (original, never using others' trademarks), developer cameos, and the owner's hidden messages. Some are only findable by the playable lead who knows about them.
7. **Photo spots:** 30 spots that reward a good photo in photo mode.

**Rules:**
- every secret is listed in the data (validator-checked);
- a "Discoveries" journal on the phone shows found and unfound (as silhouettes) by district;
- a percentage on the save card;
- no secret needs the internet;
- no secret is paid.

### 7.4 Playable leads: "one campus, many lenses" (new)
- **The roster at launch:** the custom fresher (you design them) plus one star lead. More leads come with updates.
- **Each lead has:**
  - their own arrival cutscene;
  - a starting hostel, department and friends;
  - a **perk** (Jega: football and crowd charisma; Shamsu: Smarts and explaining puzzles; Nusaiba: persuasion and organising; Mubarak: business and bargaining; Zainab: …, to be set when the owner gives details);
  - a **weakness**;
  - 8–12 personal missions;
  - unique dialogue lines in shared scenes, using a "lens" tag in the data;
  - their own phone contacts and texts;
  - a personal ending.
- **How the story "tilts":** shared missions have small variations (lines, a choice, a shortcut, a different helper) chosen by the lead's tag. The engine already supports per-character line variants (the roommate system), so this extends that.
- **Switching:** in some missions you switch between leads (the companion-switching system).
- **Unlocking leads:**
  - by playing (finish Year 1 to unlock a second lead);
  - by an event;
  - special characters: by code or by purchase (section 9).

### 7.5 Missions: more, longer, better
- **The target, unchanged:** 120 main missions over 5 years, 50+ side missions, 25 co-op friends missions. Plus:
  - **personal lead missions:** 8–12 per lead;
  - **repeatable activities:** jobs, races, football, the gym, cooking, the market hustle, campus radio DJ, tutoring;
  - **event missions:** freshers' week, harmattan week, exam survival, Independence Day, Sallah and Christmas.
- **Mission quality bar (the Fable review rules):**
  - a clear goal in 3 seconds;
  - one new idea per mission;
  - a reason for every trip;
  - a funny line in the first 30 seconds;
  - a cutscene at the start and the end;
  - a reward that changes something.
- **Variety mix target:** talk ≤ 25%, travel ≤ 20%, plus action (race, chase, fight, ride), skill (minigame, gym, cook, build), social (choice, romance, persuasion) and discovery.

### 7.6 Cutscenes everywhere (v2 section 6, unchanged; more of them)
Opening, both ends of every mission, first entry to every key place, vehicle moments, events, ambient moments, failures, and the finale with credits. With the new characters' faces, cutscenes become far more emotional, so this is where realism pays off most.

### 7.7 Social life and relationships
Friendship tiers, gifts, romance (opposite-sex only; either side can end it; reunions possible; being broke alone never ends it), rumours, reputation, roommates and group chats on the phone. All already designed; it carries over.

### 7.8 Economy (the sapa meter)
Money from home (with funny lectures), jobs, hustles, prizes, the market. Costs are food, transport, data, clothes, gym fees and gifts. **Sapa is a mood, not a punishment:** when broke you get garri-based survival options and funnier dialogue.

---

## 8. Characters, writing and voices

### 8.1 The cast structure
| Tier | Count (target) | Lines each | Script | Examples |
|---|---|---|---|---|
| **Leads** (playable) | 4–6 | 800–2,000 | Own script, own actor | Jega, Shamsu, Mubarak, Nusaiba, Zainab, the custom fresher (owner) |
| **Main friends** | 8–10 | 300–800 | Own script, own actor | Bature, Bolaji, Firdausi, Maryam, Lyzzy… |
| **Recurring** | 10–15 | 80–300 | Own script, or shared by 2 | Baba Porter, Ranger Lawal, Mama Put, the lecturers |
| **Special/influencer** | per deal | 200–600 | Own script, the real person | to be named by the owner |
| **Minor and crowd** | many | < 80 | Grouped scripts (one actor voices several) | traders, seniors, crowd |

**About 50 characters gives about 22–25 scripts.**

### 8.2 Expanding the leads (the owner asked for this)
- **Jega:**
  - a football star with a big heart;
  - a stronger personal dialect: Hausa-English code-switching with his own catchphrases;
  - written with a Hausa-speaking reviewer so it is authentic and never a caricature;
  - more lines, his own storyline (a scout, injury, comeback), and a romance arc.
- **Shamsu ("Professor Shamsu", "Sheikh Biru"):**
  - a brilliant Electrical Engineering student who explains everything with long words and wrong analogies;
  - pious, kind, secretly anxious about his parents' expectations;
  - personal arc: the national robotics competition.
- **Mubarak:** the hustler-entrepreneur, always selling something. His arc: building a real campus business, with failures and a comeback.
- **Nusaiba:** the organiser and debater. Her arc: student union elections and campus politics (fair, not partisan), and standing up to a bully lecturer.
- **Zainab (new):** to be shaped with the owner. A suggested start: Nusaiba's best friend and rival; an artist and photographer who runs the campus gallery and knows every secret spot (a natural guide for the discovery system).
- **New people the owner will name:** they get a slot in this structure when the details arrive.

### 8.3 Dialect and tone rules
- Humour is affectionate. Every group is laughed **with**, never at, so no ethnic or religious jokes as punchlines.
- Each lead has a **voice sheet** before any writing: speech patterns, catchphrases, languages mixed in, topics they love and avoid, how they swear (clean substitutes only), and how they comfort someone.
- Pidgin, Hausa, Yoruba and Igbo phrases are checked by a native speaker, and subtitles always give the meaning.

### 8.4 Scripts for voice actors (deliverables)
For each character with their own script, a PDF:
- **Cover:** the character's name in large type, a portrait or render, age, role and a one-paragraph personality.
- **Voice brief:** pitch, pace, accent, energy, 3 reference moods, and the catchphrases.
- **The lines:** numbered with the line ID (the file name the audio must have), the scene, who they're talking to, the emotion, and the line. Tier A lines first (must-record).
- **Recording instructions:** phone recording tips, takes, the clap-to-retake trick, and the file naming. This exists already and carries over.
- **The fillers sheet:** short reactions, for when a line isn't recorded yet.

**Plus a director's guide** and an **all-roles master PDF** for the owner. Release forms (section 9.3) are attached to each actor's pack.

### 8.5 Voice pipeline
- Real recordings first: friends, volunteers, influencers.
- Generated voices only as clearly labelled placeholders until a real voice exists; check each model's licence.
- Every line's audio is named by its ID, so a recording can be replaced without touching code.
- Every voice actor is in the credits (approved flag).

---

## 9. Special characters and influencers (design now, build when names arrive)

### 9.1 The idea
A real creator becomes a character in the game:
- an NPC who lives on campus with their real voice and personality;
- their own missions;
- a **personal code** that lets them play as themselves.

Their fans come to find them. Later, with the creator's agreement, other players can unlock that character (code drop, event or purchase), and the creator shares the revenue.

### 9.2 How it works (system)
- **Special character record (data):**
  - id;
  - display name;
  - likeness pack (model, face, outfits);
  - voice pack;
  - personality and lines;
  - home and routine on campus;
  - personal missions;
  - **unlock rules**: owner-only, personal code, event, purchase or free;
  - revenue share percentage;
  - status: draft, approved, live or retired;
  - contract reference.
- **Codes are checked on the server,** never shipped in the game files (the M.I. BUGAJE hero system already works this way).
  - Each code is single-person, can be revoked, and is logged.
  - "Gift codes" can be issued in batches for giveaways.
- **Playing as a special character:** they use the lead system (section 7.4), with lighter content (a perk, 3–5 personal missions, unique lines).
- **Kill switch:** any special character can be hidden immediately. This matters if a creator asks to leave, or a controversy happens.
- **M.I. BUGAJE** stays the first and secret one: owner-only code, undefeatable, light-skinned, dark coily hair, white and gold "MIB" kit.

### 9.3 Legal and trust (must be done before anyone appears)
- **Written agreement with each person:**
  - permission to use their name, likeness and voice;
  - where it appears;
  - for how long;
  - the revenue share;
  - the right to approve their character's look and lines;
  - the right to leave, with what happens then (we remove them within a set time).
- **Minors:** no creators under 18 without a parent's or guardian's signed consent; better to avoid them at first.
- **Their lines are approved by them.** Nothing they'd be embarrassed by.
- **Taxes and payments:** revenue share needs a payment route (section 10.4).
- Have a lawyer look at the template agreement once, before the first deal. **This is a recommendation, not legal advice.**

### 9.4 Why it grows the game
Each creator launch is a marketing event:
- a teaser;
- the creator posts "I'm in a game!";
- fans hunt for them on campus;
- the creator's code goes live;
- clips of fans meeting the creator's NPC.

Plan one per month once the game is live.

---

## 10. Money (designed now, switched off until the owner decides)

### 10.1 Principles
- Free to play, everywhere, always.
- **Never pay-to-win:** no stat boosts for money. Body and stat progress is earned in play only.
- Ads only ever optional, and never in the middle of play.
- **Nothing that was free becomes paid.**
- Prices are clear. No loot boxes or gambling mechanics. Be careful with minors.

### 10.2 Revenue options, in the order to switch them on
1. **Sponsorship through sign slots.** Real local brands on campus billboards, shops and jerseys, through the sign-slot system (v2 §5.3). No code change for each sponsor. This is likely the **first and best** income in Nigeria: student brands, telecoms, food delivery, banks.
2. **Supporter packs and cosmetics.** Outfits, phone cases, bike skins and room decorations. Bought once, and they work for all leads.
3. **Special characters** (section 9), with the creator's revenue share.
4. **Optional rewarded ads,** for example "watch an ad to double tonight's job pay". Always optional, capped per day.
5. **Portal revenue:** the demo build on game portals, where they share ad revenue. Each portal's rules go in `docs/PORTALS.md`, checked on the day.
6. **Season pass (later):** an event track with cosmetics and one free track for everyone.
7. **Merch** (later): T-shirts with in-game campus jokes.

### 10.3 Built now (switched off)
- `AdService`, `RewardService`, `ShopService` and `EntitlementService` interfaces with empty implementations.
- Sign slots with sponsor fields.
- A cosmetics catalogue in the database.
- Purchase records tied to accounts.

### 10.4 Payments from Nigeria (research when switching on)
- Local processors for naira payments; check Paystack, Flutterwave and others for their current terms and fees.
- A route for foreign payments, through a domiciliary account or a payout service.
- **Verify on the day:** rules and fees change.
- Privacy policy and consent, under Nigeria's data protection law (NDPA 2023).

---

## 11. Graphics, art and assets

### 11.1 Art direction
- **"Grounded stylised realism".** Realistic proportions and skin, believable fabrics, warm Sahel light, red laterite dust, green rainy season, hazy harmattan.
- **Reference board:**
  - real photos of the campus (taken by the owner, with permission where needed);
  - Nigerian street style;
  - lighting references for golden hour, NEPA night (generator glow) and harmattan.

### 11.2 Characters
- **One base body** per gender with a **shared skeleton.** Faces come from blend shapes (face shape, nose, lips, eyes), so many unique faces come from one model.
- **Body morphs:** fat and muscle (section 7.2).
- **Facial animation:** blinking, eye and head tracking, expressions for cutscenes, and visemes (mouth shapes) for recorded lines.
- **Hair:** many styles as cards or meshes, from low cut to braids, cornrows, locs, hijab styles, caps and natural coils (the owner's character has dark coily hair).
- **Clothing:** separate meshes that follow the body morphs and are layered by rule so nothing clips. The wardrobe carries over: modest, many cultures, fictional brands.
- **Sources:**
  - a commissioned Nigerian 3D artist for the leads (the best quality and the best story for marketing);
  - open bases (check licences) for crowds;
  - animation libraries (check terms) retargeted to our skeleton;
  - every asset recorded in `ASSET_LICENSES.md`.

### 11.3 World
- **Buildings:** modular kits (walls, windows, roofs, louvres, verandas) to rebuild campus landmarks recognisably but not as exact copies of private buildings. Photo-based textures, baked lighting.
- **Nature:** neem, mango and baobab trees, laterite paths, grass with seasons, dust, puddles in rain.
- **Life:** instanced crowds with level of detail, birds, goats (of course), generators, kekes and okadas.
- **Water:** a proper shader for the dam, with underwater fog and fish.

### 11.4 Pipeline rules
- GLB models, KTX2 textures and Meshopt compression.
- Texture size caps per quality tier.
- Every clothing item is tested on every body shape (thin, heavy, muscular) and every key animation. A validator rule enforces this.
- A **"before and after" screenshot set** at fixed camera positions (v2 §20.3). It is also marketing gold (section 12).

### 11.5 What realism costs (honest budget view)
| Item | Rough effort | Cheaper option |
|---|---|---|
| 2 lead characters, full quality | Weeks of a 3D artist | Start from licensed bases and customise |
| 20 crowd variants | Days to weeks | Face and body morphs on 2 bases |
| One district rebuilt | Weeks | Modular kit reused across districts |
| Full animation set | Weeks | A licensed library plus retargeting |

**Plan:** start with one district and 2 characters at full quality (the vertical slice), then widen.

---

## 12. Growth: website, community and the social media series

### 12.1 The website
**Pages:**
- Home: Play button, trailer, features, devlog, latest event, creator spotlight.
- Play.
- Games (more games later).
- Devlog.
- Credits.
- Account (saves, codes, purchases later).
- Community (Discord link).
- Press kit.
- Hidden admin.

**Every page is fast on 3G.** The game only loads when you press Play.

### 12.2 Community
- **Discord:** announcements, bug reports, fan art, voting on features and names.
- **The in-game devlog and voting** (v2 §23.3).
- **Monthly events,** plus a creator spotlight.
- **Community missions:** the data format now, the tools later (v2 §26.3).

### 12.3 The "building a game from zero" series
A separate document (`SOCIAL_MEDIA_JOURNEY.md`) has the full day-by-day scripts. In short:
- **Start now.** The journey so far (the 2D start, the blocky campus, the trailer, the AI agents, the bugs) is already episodes 1–10.
- **Post 3–5 short videos a week:** progress, a bug, a funny moment, a decision, a "you vote" post.
- **Format:**
  - your voice, or a game character as narrator;
  - captions always on;
  - face optional.
- Before-and-after clips are the strongest format, so **capture "before" shots of everything now.**

---

## 13. Live operations
v2 section 23, unchanged, plus:
- **Event calendar for year one:**
  - freshers' week (launch);
  - harmattan festival;
  - exam survival week;
  - Valentine's (romance missions);
  - Ramadan and Eid, and Christmas (respectful, inclusive, opt-in);
  - Independence Day;
  - a sports gala;
  - convocation (the graduation finale event).
- **Each event:** a banner, 3–5 missions, a limited cosmetic, a leaderboard, and sometimes a creator cameo.

---

## 14. Quality and testing
v2 sections 8 and 15 stay, plus:
- **Real-device lab:** one low-end Android (2–3 GB RAM), one mid-range Android, one iPhone, one laptop. Every stage ends with FPS and memory numbers from real devices.
- **Weekly playtest:** 3–5 real students play for 20 minutes. Note where they get lost, bored or laugh.
- **"First 10 minutes" polish rule:** most players decide in the first 10 minutes, so that part gets the most polish.

---

## 15. Risks (new or bigger in v3)

| Risk | Mitigation |
|---|---|
| Realism ambition sinks performance on phones | Quality tiers, real-device lab, the budget wins |
| Art cost and time | One district first, modular kits, commission only the leads |
| Influencer controversy or exit | Contracts, approval rights, kill switch, no dependency on one person |
| Too many leads and scripts to record | "One campus, many lenses"; launch with 2 leads |
| Scope explosion | Stages with visible ends; Must, Should, Could lists per stage |
| No version control today | Stage 0 step 1: git and a backup |
| Using real campus names, logos and buildings | Use a fictional university name in the game (inspired by, not named after, a real one), no real logos, landmarks rebuilt as originals; ask for advice before using any real institution's name commercially |
| Money features hurt trust | Principles in 10.1, announced to the community first |
| AI-generated content rules on social platforms | Label AI use where platforms require it; real footage from the game |

> **About the real university.** The game currently uses real ABU and Samaru place names. For a commercial product, the safest path is a **fictional university** that is obviously inspired by northern Nigerian campus life ("affectionately inspired by"), with real-sounding but original place names, and no real crests or logos. Real landmarks can be referenced in the style. Decide this in Stage 0, because it affects every script and sign. The dynamic name and token system makes the switch cheap.

---

## 16. Stage 0: the exact first steps (when the owner says go)

1. **Back up and version the project:** `git init`, a first commit, a private GitHub repo, and a tag `classic-final`. Copy the database file and media to a dated backup folder.
2. **Freeze "Classic":** run the full test suite once, rebuild the bundle, and record its state. It stays playable on the old site.
3. **Write the carry-over list** (section 5) as `docs/CARRY_OVER.md`, item by item.
4. **Audit and Django inventory** (v2 §2.1 and §18.2): the coordinator already has AUDIT.md and STATE.md, so extend them.
5. **"Before" screenshots** at fixed camera positions (v2 §20.3): the pipeline exists.
6. **Decisions for the owner:**
   1. fictional or real university name;
   2. the first star lead;
   3. art budget (commission or licensed bases);
   4. Babylon.js or PlayCanvas bake-off go-ahead;
   5. domain name for the website;
   6. Discord now or later.
7. **Start the social media series:** episodes 1–3 use material we already have.

---

## 17. Glossary additions
| Term | Meaning |
|---|---|
| **Lead** | A playable main character with their own lens on the story |
| **Lens** | The variations in shared content shown to a particular lead |
| **Special character** | A real person's character, unlocked by code, event or purchase |
| **Stat treasure** | A hidden collectible that permanently raises a stat |
| **Morph target** | A shape the model can blend towards (heavier, more muscular, a different face) |
| **Sign slot** | A data-driven place for a sign or billboard (used for branding and sponsors) |
| **Classic** | The current three.js version, frozen and kept playable |
