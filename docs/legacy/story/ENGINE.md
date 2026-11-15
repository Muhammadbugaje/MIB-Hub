# Story engine contract (for the content files)

Engine: `static/js/games/samaru-story.js`. Content: `fslg-story-y2.js`, `-y3.js`, `-y4.js`, `-y5.js`,
`-side.js`, `-coop.js` (all already registered; they load after `samaru-data.js`, before `samaru-core.js`).
Content files contain **data only** — no game logic. If you need something the engine does not do, write
it down in `docs/story/ENGINE_ISSUES.md` under your file's heading and use the nearest existing step.

## 1. Registering

```js
/* Freshers School Life — Year 2 story (m37–m57). Source: docs/story/scripts/Y2.md */
(function () {
  "use strict";
  var D = window.SamaruData; D.STORY = D.STORY || [];
  D.STORY.push({
    file: "y2", year: 2,
    npcs: [ /* new people, same shape as D.NPCS entries (see §6) */ ],
    items: { /* new items: id: { name, price, text } */ },
    missions: [ /* main missions m37–m57, in order */ ],
    side: [ /* side missions (SIDE file only) */ ],
    ambient: [ /* encounter templates (SIDE file only, §9) */ ],
    coop: [ /* friends missions (COOP file only, §10) */ ]
  });
})();
```

The engine merges everything at start-up: missions are appended to `D.MISSIONS` after m36 in year order,
npcs to `D.NPCS` (skipping ids that already exist), items into `D.ITEMS`. Never edit m1–m36 or other
files' data. Ids must be unique across all files: main `m37`…`m120`, side `s1`…`s50`, ambient `e1`…`e31`,
coop `f1`…`f25`; new npc ids lower-case, no spaces (e.g. `porter`, `ladi2` if taken).

## 2. Mission object

```js
{ id: "m42", ch: 13, year: 2, sem: 1, title: "Meter reader", gate: 36,
  giver: "audu", thread: "M", shape: "tail",
  intro: "Every evening a Works van leaves the substation. Audu wants to know why.",   // premise, 1–2 sentences
  need: { done: ["m41"], flags: ["mall_bright"], notFlags: [] },                    // lvl is filled from gate
  music: { start: "tension_low", turn: "sting_reveal", end: "motif_school" },
  steps: [ /* §3 */ ],
  fail: { text: "He's seen something. Try again at dusk.", resume: 1, wait: "dusk" }, // mission-wide default
  reward: { cash: 4000, standing: { street: 3, community: 1 }, friend: { audu: 5 }, flags: ["saw_switch", "marker_2"], item: "", count: 1 },
  around: { radio: [["kabiru", "If your bulb just died…"]], walker: ["Light just went. I was ironing."], phone: [["mum", "Have you eaten?"]] } }
```

- `ch`: chapter shown on the banner. Year 2 = 13–16, Year 3 = 17–20, Year 4 = 21–24, Year 5 = 25–28
  (about five missions per chapter, in order).
- `gate`: the script's "Gate N". The engine sets `need.lvl` from it and **computes the XP reward** so the
  story carries the player to the next gate; leave `reward.xp` out unless the script insists.
- `need.done`: normally the previous mission. `flags`/`notFlags`: optional story flags.
- `reward.standing` tracks: `academics`, `street`, `social`, `community`, `department`, `fame` (Year 4).
  `friend`: npc id → friendship change (negative allowed). `flags`: set on completion (the script's "Sets").
- `around`: radio/walker/phone lines played while the mission is active (speaker id, line).
- Side missions add `side: true`, and `where: "placeId"` (where the giver calls you), `repeat: false`.

## 3. Step object (fields every step may have)

| Field | Meaning |
|---|---|
| `t` | step type (§4) |
| `text` | HUD objective, a verb and a place, ≤ 60 characters |
| `lines` | `[[speaker, line, voiceId], …]` spoken when the step starts (talk steps: when you talk). Speaker = npc id, token (§5), `"me"` (player), `""` (narration, shown italic), `"radio"`, `"phone:mum"` |
| `say` | old single-line form `[speaker, line]`; still works |
| `turn` | `true` on the twist beat: plays the turn sting and a short banner |
| `if` / `unless` | flag name; the step is skipped when the condition fails (use with `choice`) |
| `limit` | seconds; failing the clock triggers `fail` |
| `fail` | `{ text, resume: stepIndex, wait: "now"|"dusk"|"morning"|"tomorrow", cost: { energy, money } }` overrides the mission's |
| `give` / `take` | item id given / taken when the step completes |
| `set` | flag (string) or flags (array) set when the step completes |
| `night` | step only counts at night |
| `music` | cue id while the step is active (§8) |

## 4. Step types

Existing ones keep working exactly as in m1–m36.

| `t` | Parameters | Completes when |
|---|---|---|
| `go` | `place`, `night?` | you arrive within 13 m of the place marker |
| `talk` | `npc` | you talk to that person (E) |
| `eat` / `sleep` | `place?` | you eat anything / sleep (at `place` if given, default your hostel) |
| `buy` | `item` | you buy that item |
| `ride` | `veh` (skate bike scooter okada keke car sport plane) | you get on one |
| `fight` / `boss` | `enemy` (shade bully sly leviathan entropy), `n`, `at` | you beat n of them (boss: n = 1) |
| `find` | `item`, `at` | you pick it up near the place |
| `race` | `race` (r1–r8) | you win that race |
| `emote` | `emote` (wave dance sit), `at?` | you do it (at the place if given) |
| `job` | `kind?` (delivery taxi lost errand) | you finish a job |
| `class` | `pass` (right answers), `place?` | you pass a lecture |
| `stat` | `stat`, `val` | that counter reaches val |
| `turn` | — | about 3 s after its lines end (a pure story beat; prefer `turn: true` on a real step) |
| `choice` (`choose`, `vote`) | `prompt`, `options: [{ label, set?, standing?, friend?, money?, partner?, breakup?, lines? }]`, `clock?` (seconds; debate) | you pick an option; later steps branch with `if`/`unless` on the flags set |
| `look` / `watch` / `listen` | `place` or `npc`, `secs` (6), `r` (20) | you stay near for `secs` |
| `social` | `place`, `secs` (20), `emote?` | you hang out there (sitting or dancing counts double) |
| `walk` | `place`, `npc` | you walk there on foot with the person beside you |
| `escort` | `npc`, `place`, `veh?` | you and the person both reach the place; fails if they are > 80 m behind for 15 s |
| `convoy` | `npc`, `place`, `veh` | you drive there with their vehicle following |
| `tail` | `npc`, `place`, `near` (25), `far` (60), `veh?` | they reach the place while you stayed between near and far (too close 3 s, horn, or too far 10 s → fail) |
| `chase` | `npc` | you catch them (within 2.5 m) |
| `stealth` | `place`, `guards` (2) | you reach the place without a security warning |
| `delivery` | `item`, `place`, `limit?`, `careful?` | you bring it there (careful: a crash or hard stop breaks it → fail) |
| `carry` | `item`, `place` | you carry it there on foot (no sprint, no vehicle while carrying) |
| `collect` | `item`, `n`, `at`, `r` (40) | you pick up n of them scattered round the place |
| `build` | `parts: { itemId: n }`, `place` | you are at the place holding the parts (they are used up) |
| `care` | `npc`, `place` ("sickbay") | first aid (hold E 3 s), then get them to the place |
| `quiz` / `teach` | `subject` (ee phys math chem gen), `n` (3), `pass` (2), `npc?` | you answer enough right (teach: you are explaining to the npc) |
| `rhythm` | `song?`, `pass` (score) | dance-floor rhythm game reaches the score |
| `arcade` | `game` (tabletennis kola run patrol ayo), `pass?` | you reach the score (or win, if no pass) |
| `sports` | `sport` (tabletennis five-a-side basketball tennis pool), `at`, `pass?` | you win / finish the match |
| `flight` | `route: [placeIds]`, `low?` | you fly the plane over each place in order (low: below rooftop height) |
| `routine` | `at: [[placeId, hour], …]` | you are at each place in the hour after each time, same day |
| `defend` | `place`, `enemy` (bully), `secs` (60) | you stay within 40 m of the place until the clock runs out |
| `keep` | `stat` ("money" or an item id), `min`, `days` | you keep at least `min` for `days` days |
| `bank` | `amount`, `place` ("bank") | you deposit that much at the place |
| `phone` | `npc` or `contact`, `incoming` (true) | you answer (or make) the call |
| `awards` | `title` | the ceremony plays to the end |

## 5. Tokens (in `npc`, `place`, `at`, speaker fields)

`@roomie` (Sadiq for a male player, Firdausi for a female one), `@best` (your closest friend, default the
roomie), `@crush` / `@partner` (set by choices with `partner:`), `@hod` (your department's head),
`@hostel` (= `@home`), `@dept` (your department building), `@boss` (Year 4 placement supervisor, set by a
choice with `set: "boss_<npcId>"`). Use them instead of hard-coding.

## 6. New people

Same shape as `D.NPCS`: `{ id, name, role, at, skin, hair, hairCol?, top, voice: "male"|"female", pitch, hi: [three greetings] }`.
`at` = a place id (§7). Hair: low fade afro coily braids bun cap hijab bald. Use the owner's friends' names
from the bible roster (§21) for new characters. Romance partners: opposite sex to the player only — mark
with `romance: "m"|"f"` (the sex of player who can date them).

## 7. Places you can use

Use only these ids (the map has no others): gate senate library bookshop ee chemeng physics maths fslt
theatre sculpture akenzua ribadu amina suleiman pepsi court chapel mosque sickbay fire bank market dam strip
demo radio club buka shayi quarters art education social shinkafi selfie love enggarden facgarden geogarden
dept_elect dept_comp dept_mech dept_civil dept_agric dept_metal dept_mining dept_water dept_telecom dept_chem
kt wt nelt compsci dangote danfodio p2shops p2canteen p2park p2mosque p2chapel lowerdam checkpoint stalls
mk_supermarket mk_electronics mk_phones mk_cinema mk_books mk_pharmacy mk_arcade mk_fashion mk_native
mk_modest mk_shoes mk_eyewear mk_sports mk_barber mk_thrift mk_gifts mk_food mk_dance mibstore
stop_market stop_gate stop_senate stop_social stop_eng stop_library stop_dam damcentre (the Dam Visitor Centre, §14)

Existing people: sadiq garba okonkwo bello emeka ada yakubu fatima bola (shown as Bolaji) kelechi nkechi audu
sly kabiru hauwa baba danladi uche maker ladi. Existing items: torch slipper notebook novel chocolate perfume
scarf kilishi calculator airtime fuse logbook key coil core capacitor ledger phonesack dynamo winding
sparkgap resonator voltshard.

## 8. Music cues

Any cue name from `04_MUSIC.md` may be used in `music`; the engine maps unknown names to the zone music
and the standard stingers (`sting_*` → a short stinger, `tension_*` → the tension layer, `motif_*` → the
place theme). No new audio files are needed.

## 9. Ambient templates (SIDE file)

`{ id: "e1", title: "Buy me something", kind: "errand"|"lift"|"escort"|"care"|"find"|"teach"|"settle"|"match"|"give",
  where: ["market", …] (places it can happen), time: "any"|"day"|"night",
  variants: [{ who: { voice: "female", top: "#…" }, ask: "Abeg, help me buy bread.", steps: [ /* 1–2 steps, §4 */ ], thanks: "…" }, … ×3],
  help: { cash: 200, standing: { community: 2 } }, decline: "…what they say", twist: { chance: .2, text: "…", cash: 5 } }`

## 10. Friends missions (COOP file)

`{ id: "f1", name, group: "racing"|"flying"|"hunt"|"sparring"|"party"|…, players: [2, 6], minutes: 6,
  rules: "one paragraph", type: "race"|"score"|"hunt"|"tag"|"hold"|"relay"|"collect"|"survive",
  params: { … }, scaling: "…", win: "…", awards: ["…", "…", "…"], vary: { routes: [...], … }, mutators: true }`
The co-op runner is built from `type` + `params`; describe anything unusual in `rules` and list the gap in ENGINE_ISSUES.md.

## 11. Checks the tests run on your file

Ids unique and continuous; every step type known; every place/npc/item/enemy/race id exists (or is added
by your file); `need.done` points to an earlier mission; every flag used in `if`/`unless`/`need.flags` is set
somewhere earlier; every choice option sets something; the headless campaign plays m1→m120 to the end.

## 12. Added after the first content pass (answers to ENGINE_ISSUES.md)

- **Level curve.** Script gates 31→130 are mapped onto levels 41→104 (`ST.GATE`), and story XP is computed so
  a story-only player meets each gate. Measured: end of Year 1 ≈ 41, Year 2 ≈ 64, Year 3 ≈ 79, Year 4 ≈ 94,
  Year 5 ≈ 110 (headless, both choice branches). Leave `reward.xp` out.
- **Flags the engine keeps up to date** (usable in `if`/`unless`/`need.flags`): `has_partner`, `two_timing`,
  `twotimed_caught`, `strike` (on between `strike_on` and `strike_off`), `last_result_lost` (last quiz /
  arcade / rhythm result), `maker_free` (after m116).
- **Tokens:** `@super` (from a `super_<npcId>` flag), `@place` (from `placement_<mall|dam|airfield|radio|works>`),
  `$who` / `$other` (people spawned for an encounter), `$here` (where the encounter started). Place aliases:
  `pitch`→court, `quad`→enggarden, `fountain`→selfie, `pier`→dam, `fence`→gate, `oldcampus` / `rangerpost` /
  `p2bend`→checkpoint, `forest_edge`→lowerdam (until the map gains real ones — then the real id wins).
- **Choice:** `pick: 2` (pick two different options); option `need: { standing: { community: 40 }, flags: [] }`
  hides it unless met; step `byStanding: true` + option `track: "<standing track>"` auto-picks the option for the
  player's highest track.
- **Talk:** `linesLost` is played instead of `lines` when `last_result_lost` is set.
- **Results:** `soft: true` on `rhythm`/`quiz`/`arcade` completes whatever the score (no fail); `anyResult: true`
  on `arcade`/`sports` completes on a loss too (and sets `last_result_lost`).
- **Delivery:** `count: 4, spill: 2` gives four, a hard stop or crash spills one, more than `spill` fails.
- **Buy:** any `buy` step is sellable by the engine at `at`/`place` if given, else at any shop, food stall or
  store, at the item's `price`. So new items only need `{ name, price, text }`.
- **Step `title`** (+ `titleSub`) shows a big title card when the step starts (m120 credits/title).
  **`hud: false`** sets `Z.hideHud` while the step runs (the HUD owner reads it).
- **Speakers** `crowd:<who>`, `phone:<who>`, `radio:<station>` and plain non-person ids (`mum`, `dad`, `advert`)
  are shown with a readable label and a generic voice.
- **Encounters:** `$who` spawns beside you with the variant's `who` look and speaks `ask` (and `setup` as
  narration), `thanks` on success, the template's `decline` if you say no. `help.cash: 0` is honoured; `help.flags`,
  `help.item`, `help.hidden`, `twist.give`, `twist.then` (extra steps) are applied; `notAfter`, `hot`, `needItem`
  and `ambientRules.minGap` are read. Side missions are also offered when you talk to their `giver` anywhere.

## 13. Year 1 (revision 4) and the cast

- `fslg-story-y1.js` is generated by `tools/story/build_y1.py` from `scripts/Y1.md`, `Y1b.md` and
  `CHARACTERS_BACKSTORY.md`. Registry keys it uses: `replaceYear1: true` (the built-in m1–m36 are retired; long
  goals stay), `retire: ["sly"]` (NPC records removed), `patch: { bola: {…} }` (fields merged into an existing NPC —
  Bolaji, male, is `bola`; `sly` and `bolaji` resolve to `bola` everywhere).
- A spoken line may carry a 4th field, a flag it needs: `["bature", "Riddle me this…", "", "room_bature"]` is only
  said in the Bature room.
- Choice options may carry `sex: "m"|"f"` (shown only to that player), `roomie: npcId` and `home: placeId` (set
  `@roomie` and the hostel), and `fate: true` (picks a random allowed room).
- `@roomie` defaults to Bature (male players) / Firdausi (female); `@best` likewise.
- Old saves: a save inside the old Year 1 restarts its current mission from step 1 and is paid ₦300 + 120 XP per
  step already done; saves past m36 are untouched.

## 14. Water, swimming and swimming races (`samaru-water.js`)

- **Place and people.** `damcentre` is the Dam Visitor Centre on the north shore (open 07:00–20:00; inside, an
  aquarium window into the reservoir and five panels). New npc: `lifeguard` (Okon), who keeps a chair by the
  visitor-centre steps. Both are added by `samaru-water.js`, so story files may use them like any other id.
- **Reading the water.** `Z.water.depth(x, y)` is metres of water (0 on land and on the pier); deeper than
  `S.RULES.swimWade` (1.05 m) the player swims. `Z.water.swimming()`, `Z.water.state()` →
  `{ on, under, depth, breath (0..1), wet }`. `Z.emit({ t: "swim", on })` fires on entering and leaving the water.
  Rules: `swimWade`, `swimBreath` (28 s), `swimDive` (2.6 m), `swimTow` (18 s), all in `S.RULES`.
  The diving spot is the springboard at the end of the pier (`Z.water.pierEnd()`, `Z.water.diveIn()`; dives are
  counted in `P.stats.dives`). Friends who follow you swim too (`npc.swimS.on`).
- **Races.** `Z.water.race(opts)` returns a race handle; nothing runs until you call `start()`.

  ```js
  var r = Z.water.race({
    id: "relay1", name: "Dam relay", mode: "swim",          // "swim" stops the race after 12 s out of the water
    gates: [{ x: -62, y: 470, r: 5 }, { x: -4, y: 522 }, { x: -95, y: 440, r: 5 }],  // in order; r defaults to 5 m
    laps: 2,                                               // the gate list is run this many times
    onGo: function (r) {}, onGate: function (r, i) {}, onFinish: function (r) { /* r.t, r.splits */ },
    onStop: function (r, why) {}                           // left the water, got in a vehicle, went inside, too far
  }).start(3);                                             // 3-second countdown (0 or nothing: go at once)
  r.state;  // "ready" | "count" | "run" | "done" | "stopped"
  r.t; r.gate; r.lap; r.splits; r.next(); r.stop("why");
  ```

  Only one race runs at a time (`Z.water.cur`); while it runs the HUD shows its clock and the GPS beam points at the
  next gate. `Z.water.site().gates` are the buoy-swim gates (start/finish by the steps), reusable for friends'
  races. The buoy swim itself is `Z.water.challenge()`; the best time is `P.stats.swimBest` (also
  `Z.water.best()`), and `Z.emit({ t: "swimrace", time, best })` fires at the finish. A story step can wait on it
  with `stat` (`swimN`, swims finished) until a dedicated step type exists.

## 15. Phone, texts, money from home and Pockets (`samaru-phone.js`, `samaru-texts.js`, `samaru-inv.js`)

**Pockets (inventory).** Counts stay canonical in `P.inv` (`{ id: count }`), so steps that read or write
`P.inv[k]` directly (parts, `give`, `take`, rewards) keep working; `P.pockets.slots` is only the slot layout and
follows `P.inv` on its own. Tools (`torch`, `slipper`, `calculator`, `airtime`) and every `quest: true` item never
take a slot and can never be dropped. 15 slots, +1 every two levels (to +10 at level 21), +5 with the school
backpack (₦4,500 at the market, the bookshop, Phase 2 shops, the supermarket): 30 at most.

```js
Z.inv.add("cement", 3)        // → how many went in (0..3); a "pockets are full" toast if not all fitted
Z.inv.add("fuse", 1)          // quest items and tools always go in
Z.inv.fits("wood", 4)         // → how many would fit, without adding
Z.inv.has("rice", 1)          // bool · Z.inv.count("rice") → number
Z.inv.take("rice", 1)         // bool, all or nothing (cooking, crafting, handing materials over)
Z.inv.give("ada", "flowers")  // gift from your pockets to a person standing near you → friendship gained, or false
Z.inv.use("edrink")           // eat or drink one (plays the eat pose, restores food and energy)
Z.inv.register("lamp", { name: "Hurricane lamp", kind: "mat", price: 900, icon: "bulb", col: "#f59e0b", text: "…" })
Z.inv.def(id)                 // { name, kind, price, hunger, energy, hp, stack, icon, col, text }
Z.inv.open() / close() / toggle() / isOpen()
```

Kinds: `food`, `drink` (stack 8, restore `hunger`/`energy`/`hp`), `ingr` cooking ingredients (stack 8: `rice`,
`oil`, `pepper`, `tomato`, `onion`, `egg`, `spice`, plus `indomie`), `mat` raw materials (stack 16: `wood`, `sand`,
`cement`, `cable`, `nails`, `paint`, `tape`, `bulb`, `cell`, `fabric`), `gift` (stack 4: `flowers`, `chocolate`,
`perfume`, `notebook`, `novel`, `scarf`; `kilishi` is food and a gift), `collect`, `tool`, `key` (quest).
Story items in `D.ITEMS` without a catalogue entry are pocketed automatically (`quest` → key row, `gift` → gift,
priced → misc). Gift value: the person's `likes.gift` (or `likes.gifts: [..]`) 15, other gifts 7, food 4,
ingredients 2, anything else 1; `hates` −3; flowers, perfume and chocolate count 1.5× for your partner; the third
gift to one person in a day is worth 1. Events: `{ t: "eat", item, pocket: true }`, `{ t: "gift", npc, item }`,
`{ t: "buy", item }`. Shops get a "🎒 Buy for your pockets" row (`Z.inv.SHOPS` lists stock by place id).

**Texts.** `Z.texts.send(from, text, opt)` delivers a text with a ping and a badge. `from` is an npc id, `"mum"`,
`"dad"`, `"uncle"`, or your own id such as `"story:porter"` (give `opt.name`). Options: `replies: [[label,
friendship, theirAnswer, action]]` (2–3 short ones; `action` `"invite"` makes an npc come to you, `"ask"` asks family
for money), `then(i)` called with the reply index, `quiet: true` (no ping), `kind`. A reply fires
`{ t: "text", npc, reply }`, so a step can wait on it. `Z.texts.unread()`, `Z.texts.thread(who)`.
Friends text on their own, seeded from the clock; nothing arrives during the intro, the walkthrough, a race or
while the phone is stolen.

**Calls.** `Z.phone.call({ who: "Mum", lines: [[speaker, text]], incoming: true, optional: false, then(ok) })`
rings the handset (Answer / Decline) and plays the lines through `Z.story.say`. The engine's `phone` step still uses
its own dialog; switching it to `Z.phone.call` is the story worker's choice.

**Money from home.** Bank app or Contacts → Mum, Dad or Uncle Sule → Text or Call. One ask a day across the family;
a refusal blocks that person for two days. Odds rise with attendance (`P.life.att/missed`), time since the last ask,
the start of term (`(day - 1) % 60 < 5`) and goodwill from family replies; they fall with every ask in the last week.
A yes arrives 30–150 game minutes later as a credit alert (`Z.money`). `{ t: "askHome", who, yes, amt }` fires.

**The phone itself.** `Z.phone.open(app)`, `close()`, `toggle()`, `isOpen()`, `app(id)`, `press(actionId)`,
`pressLabel(/re/)`, `back()`. App ids: goals, map, jobs, contacts, messages, friends, bank, dial, camera, radio,
net, pockets, life, mini, me, settings, help, quit. While it is out `Z.me.phoneK` is 1 (any figure with
`phoneK`/`emote: "phone"` holds one; walkers do it by themselves). `Z.phone.lost()` is true after a snatch; a step
that needs the phone should not start then (snatches never happen during a mission, a job, a race, a date or the
walkthrough). `Z.phone.recover(html)` gives it back from a story beat. Events: `{ t: "crime", kind: "snatch", phase:
"start" | "caught" | "escaped", you: true }`, `{ t: "photo", place }`.

## 16. Game name, text tokens, character overrides and credits (`fslg.config.js`, `samaru-overrides.js`)

- **Never write the game's name or initials.** The one place they are written is `static/js/games/fslg.config.js` (defaults);
  the super admin changes them in Arcade Management → FSLG Config. In any text use tokens: `{{GAME_NAME}}`,
  `{{GAME_SHORT}}`, `{{GAME_INITIALS}}`, `{{TAGLINE}}`, `{{CURRENCY}}`, `{{AUTHOR}}`, `{{PLAYER_NAME}}`, optionally with
  `|upper` or `|lower` (`"{{GAME_NAME|upper}}"`). Data strings (missions, lines, items, places) are resolved at load and
  again on every rename; `{{PLAYER_NAME}}` is filled in when the line is spoken (`Z.say` / `Z.sub`).
- **In code**: `Z.resolveText(text)` (same as `window.GameConfig.resolveText`), `Z.config()` for the live config,
  `Z.onConfig(fn)` to repaint something when the name changes (signs, liveries and the giant letters do this).
  `Z.text` (this engine) reads the same `D.CONFIG` object, so both agree.
- **Spoken lines can be edited** by the super admin per character. A line is identified by the voice id of its original
  words (`V.id` in `samaru-voice.js`), so rewording a line in a story file simply makes it a new line; nothing breaks.
- **People** can have their name, looks, attitude (`def.attitude`, `def.walk`, `def.routine`, `def.friend`), romance
  (`date: true` and `romance` always the opposite sex) and voice changed; the engine reads the same fields it always did.
- **Credits**: `Z.rollCredits({ onEnd })` plays the end credits (also from the title menu). They roll on their own once
  after `story_done` is set, and `Z.emit({ t: "credits", done: true })` fires when they end (headless: at once).
