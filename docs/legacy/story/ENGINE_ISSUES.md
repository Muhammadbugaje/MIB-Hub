# Story engine issues

Gaps the content files hit, by file. The engine owner resolves or answers each.

## Y3 needs (fslg-story-y3.js, m58–m78)

Workarounds are in place for every item; the missions run with them, but the scenes are thinner.

1. **Wilderness places.** The script uses the campus fence, the forest, a ridge, a flooded stream, Old Campus
   ruins, a ranger post and "the dark bend" on the Phase 2 road. None are place ids. Used instead: fence → gate,
   forest/ridge/stream → lowerdam, Old Campus and ranger post → checkpoint, dark bend → checkpoint. Wanted:
   `oldcampus` (a fixed ruin out in the wilderness, with rooms for the reel hunt), `forest_edge`, `rangerpost`,
   `p2bend`, and ideally `pitch`, `quad`, `fountain` as aliases.
2. **Idlers and the Long Silence.** New enemy kinds: grey seated figures beaten by noise (radio, clapping, bell,
   humming), not by hits; standing still 5 s makes you sit. Used instead: `shade` (defend/fight) and `entropy`
   as the m69 boss.
3. **Counted delivery.** m68 needs four jerrycans with a spill limit of two. Used: one careful `delivery`.
4. **Multi-pick choice.** m60 "pick two hustles": done as two choice steps; the second can repeat the first.
   A `pick: 2` option on `choice` would fix it. The chosen hustles should start the matching job kind.
5. **Single (no partner) path in m76.** The scene changes speaker to @best, place to the Dam pier, and only
   offers repair. Needs a flag the engine sets when the player has/has no partner (e.g. `has_partner`) so steps
   can branch with `if`/`unless`; content cannot use a flag nobody sets.
6. **World switches.** m59 starts the strike (campus population drops, night tutorials stop, place music at half
   layers) and m70 ends it (timetable compressed). Flags `strike_on` / `strike_off` are set; the engine or
   life/crowd modules need to react to them. m78 sets `road_lit` (Phase 2 road lamps on, ambient e6 retired)
   and `year4` (promotion to 400 level).
7. **Shop stock.** `buy` steps for new items `panel` (Bright Electricals → mk_electronics), `battery`
   (Chi-Tech → mk_phones), `groundnuts` (Kaka at the gate), `wedding_gift` (mk_gifts or mibstore) need those
   items stocked where named.
8. **Gentle rhythm.** m68 humming and m69 open mic use `rhythm` with a pass score; the script wants a soft
   variant (no fail) for m68.
9. **Item-gated mission.** m63 "needs a radio item or a friend"; no radio item exists; not enforced.
10. **Speakers.** Lines use speakers `mum`, `dad` (phone) and `radio`; please confirm those resolve.

## Y2 needs (fslg-story-y2.js, m37–m57)

All 21 missions validate and complete with the solver (first option and second option at every choice).
Workarounds are in place; these would make the scenes match the script.

1. **Result-dependent lines.** m40 (Basit, you won / you lost), m47 (Dr. Khadija, good / poor result) and m50
   (Bolaji, landed / fell) need a flag from the arcade, quiz and rhythm results. The final talk step carries the
   winning line in `lines` and the other in `linesLost`; please play `linesLost` when the previous step was
   lost/failed (or set `last_result_lost`).
2. **Enemies.** Hummers (m41, m52, m55) use `shade`. A `hummer` enemy (metal-chested shade that charges in
   straight lines) would fit. Iron Mama is done as four ordered `find` steps (plug1, plug2, plug3, plug_mains)
   plus `build`, which is the script's mechanic; wrong order surging is not modelled.
3. **Places.** No mall basement / plant room / management office / roof café: market and mk_food are used. A
   `mall_basement` interior and `mall_office` would help m44, m49, m55.
4. **Rewards the engine cannot pay**, set as flags for later content: `outfit_first_native` (m39: the first
   native outfit; please give it via the wardrobe), `station_8bit_buka` (m40 secret radio station),
   `free_haircuts` and `hassan_abbas_apprentices` (m46), `promote_300` (m57; promotion to 300 level),
   `p2_jobs_open` (m45: Phase 2 passenger jobs become repeatable), `drivers_paid` and `mall_power_honest` (m56).
   m40's ₦1,500 is paid as cash, not arcade tokens.
5. **Shop stock** for `buy` steps with new items: `fabric` (mk_fashion), `cap` (mk_sports), `dinner_ticket`
   (mibstore), `copper` (mk_electronics), `garri`, `groundnut`, `candle` (mk_supermarket), `markers` (mibstore).
   `fuse` should be on sale at mk_supermarket too.
6. **Dress code / wearing.** m39 "wear it in the Selfie Garden" and m43 "corporate or native" would check the
   outfit tag; not enforced.
7. **Money set to ₦340** (m54) is narration only; the engine cannot set the balance.
8. **Speakers.** Crowd lines use `crowd:<who>` (passenger, watchman, trader, senior, panel, walker) so the
   validator accepts them; please show them with a generic crowd voice and the label after the colon.
   `around.phone` uses `mum`, `dad`, `maker`, `@roomie`; `around.radio` uses `kabiru`, `advert`, `bugaje`,
   `hostelfunk`, `streetbreaks`, `arewacalm` (station voices).
9. **Partner flag.** m54 branches @crush vs @best on the m43 dinner flag (`dinner_with_crush`). A
   `has_partner` flag set by the engine would be more accurate.

## SIDE needs (fslg-story-side.js, s1–s50, e1–e31)

All 50 side missions (both options at every choice) and all 93 encounter variants validate and complete with
`ST.solve`. The solver completes steps from data, so the items below are about real play, not the tests.

1. **Encounter people do not exist yet.** Encounter steps use three tokens the engine does not resolve:
   `$who` (the person who called out), `$here` (where the offer happened) and `$other` (a second walker spawned
   nearby, for e16/e17). `ST.ambient` should spawn `$who` as a temporary walker beside the player with the
   variant's `who` look (`{ voice, top }`), pin `$here` to the player's position at the offer, and spawn `$other`
   20–40 m away. Without this, escort/walk/care/teach/look/watch/talk steps with these tokens cannot complete in
   play (13 of 31 templates).
2. **Encounter rewards are partly ignored.** `ST.ambient` reads only `help.cash` (and turns 0 into ₦150),
   `help.xp` and `help.standing`. Not applied: `help.friend` (keyed by `$who`; it should become that walker's
   memory), `help.flags`, `help.line` (Nurse Hauwa's thank-you in e8), `help.hidden` (e30: no reward shown, no
   sting), `twist.give`, `twist.then` (an extra step: e7 return the bike, e14 go to Chi-Tech, e26 play five-a-side),
   `twist.spawn` (e6 a shade), `twist.token` (e15 a kola nut). Please honour `cash: 0` as zero.
3. **Encounter lines are not spoken.** Each variant has `ask` + `askId` (the call-out), `thanks` + `thanksId`
   (said on success) and `setup` (one line of narration shown before the ask); templates have `decline` +
   `declineId` (said when you pick "Not now" or walk away). `ST.offer` shows `ask` but never voices it, and
   nothing plays `thanks` or `decline`.
4. **Bible §12 spawn rules.** `ambientRules` (minGap 180 s, twistChance .2, rememberAfter 2, giftAfter 5,
   never during mission limits, fights, chases, moments, jobs or lectures; "starts with a person, never a marker")
   is shipped in the SIDE pack but the engine uses its own 25 s / 90 s timers and a dialog box. Rule 1 asks for
   the person to call out in the world (bubble + wave), with E to accept, rather than a modal. Also `notAfter`
   (e6 retires after m78), `hot` (e8 only in the hot hours), `noMarker`/`noSting` (e30) and `needItem` (e31 only
   when you own garri) are not read.
5. **A "company" kind.** Wait with me, watch my bag, come and cheer, take our picture and sit with me are marked
   `company: true` (kind `escort`). A real kind would let the offer text and HUD say "Stay" rather than "Escort".
6. **Side missions offered by place.** `offers()` picks side missions whose `where` is within 60 m. Several
   givers move about (friends' routines), so the offer should also fire when the player talks to the giver anywhere.
   Faith: s46 and s47 are given by Pastor Sam (chapel); Ustaz Auwal co-hosts s46. If the player chose Muslim faith,
   offering them from the mosque via `auwal` would match the bible better.
7. **Rewards that need other systems.** `item: "soup", count: 7` (s1) assumes soup is eatable; s41's
   `greenset` is an outfit the wardrobe should own; flags `map_shortcuts_5` (s35) and `shortcut_blind_friend` (e5)
   should open map shortcuts; `sly_staff_discount` (s16) should discount Sly's barber; `micheal_met` (s24)
   introduces a romance option (`romance: "f"` on his npc entry); `hidden_room_open` (s8) should unlock the
   interiors' hidden library room for good.
8. **Bystanders.** The pack carries `bystanders` (bible §13: watcher, filmer, laugher, separator, caller, hype,
   elder with shares and lines) for the brawl/crowd code. Nothing reads it yet.
9. **Shop stock** for side `buy` steps: `ugu crayfish stockfish pepper palmoil seasoning` (market, Hajiya Ladi),
   `suyastick` (Shinkafi/market suya), `cake` (mk_food), `fruit` (mk_supermarket); for encounters `bread`
   (buka/p2shops), `purewater`, `sweets` (market).
10. **Shared item ids.** The SIDE pack defines `garri` and `groundnuts`; Y2 uses `groundnut` and Y3 `groundnuts`.
    One id (`groundnuts`) everywhere would be cleaner.

## Y5 needs (fslg-story-y5.js, m100–m120)

Every item has a workaround in the file (listed in its header comment); the campaign runs with them.

1. **`@super` token.** The supervisor chosen in m101 speaks or is visited in m101, m106, m107 and m111. Done as three
   copies of each beat with `if: "super_okonkwo" | "super_bello" | "super_khadija"`. A `@super` token resolved from
   those flags would let each beat be one step.
2. **Choice by standing.** m108 (which argument works), m110 (the class award) and m115 (how you refuse) should be
   picked from the player's highest standing, not by the player. Wanted: an option field such as `track:` plus a
   step flag `byStanding: true` that auto-picks the option for the top track (or highlights it).
3. **Gated option.** m104's third answer to Megawatt needs high Community (`need: { standing: { community: 40 } }`
   on the option). Currently always shown.
4. **Partner branch.** m117 beat 4 has a @crush line ("I'm not asking you to promise…") when the player is with
   someone, else @best's line. Same need as Y3 item 5: a flag such as `has_partner`. Also `twotimed_caught` (m110
   beat 4) is never set by any file; the beat is left out.
5. **Rooms.** Senate basement and roof (m103, m114–m116), the library's hidden room (m103), the mall office and
   basement (m104, m113), the porter's lodge (m105) use the building's place id. With interiors, a `room:` field
   would place these indoors.
6. **Places.** Old Campus (m113) uses `oldcampus` if the map gains it, else `checkpoint` (same as Y3). The pier and
   the dark bend photo spots (m117) use `dam` and `checkpoint`.
7. **Enemies.** Nulls (m109, m113) and Chancellor Null (m115) use `shade` and `entropy`. Chancellor Null should not
   attack: it erases (lamps, HUD edges, name tags, objective text) and hits thrown at it cost the player; phase 2 is
   "stand at the coil".
8. **World switches.** m112–m115 are a total blackout ("an absence"), wanted as a world state for the night;
   m116 sets `permanent_light` (all lamps and coils on for good) and `maker_free` (the Maker leaves the coil fence
   and follows his own routine with the 44 sayings, bible §18); m120 sets `story_done` and should move the world
   to the "years later" morning (suya man back, Maker feeding birds at the fountain) and open new-game-plus with
   the heir chosen in m119 (`heir_aminu` / `heir_aisha` / `heir_nowhere`).
9. **No-HUD walk.** m107 beats 2–3 should hide the HUD and objective text, in rain, with lamps leading to the
   fence. Wanted: a step field `hud: false` and a mission `weather: "rain"`.
10. **Crowds.** m112 escorts 300 students (done as escorting Aisha); m114 carries the coil with six crews; m118's
    family tour escorts Mum only (Dad follows in the lines). A crowd-follow escort would help.
11. **Boat.** m114 rides Baba Dam's boat; done as a `go` to the Dam.
12. **Title card and credits.** m120's last beat shows the title card "FRESHERS SCHOOL LIFE / A game by Muhammad
    Iliyasu Bugaje" and beat 1 rolls credits at the roadside; currently narration lines. A `title:` step field or
    a `Z.moment("finale")` hook would do it.
13. **Fire drill.** m106's drill (break glass, walk, count heads, guide the crew) is a timed run to the Fire Station.
14. **Items to stock.** `dinner_ticket` must be on sale at the MIB Store (m110, ₦3,000).

## Y4 needs (fslg-story-y4.js, m79–m99)

Workarounds are in place; Year 4 plays m79→m99 with the solver on every branch tested.

1. **`@place` token.** The script's industrial-training site. Done as five copies of each placement step with
   `if: "placement_<id>"` (mall → market, dam → dam, airfield → strip, radio → radio, Works → fire). A token
   resolved from the placement choice would remove the copies. Note: the contract (§5) says `@boss` comes from
   `set: "boss_<npcId>"`, but the engine reads an option's `boss` field; the file sets both.
2. **Echo enemy.** m83, m87, m96 want an `echo` that copies your last move and stalls when you do something it
   has not seen (emote, block, greet). Used `shade`. The Mirror (m96) is an unwinnable 30 s fight; done as
   `defend` with `shade`.
3. **Fame meter.** `fame` standing is used (m81 on); crowds reacting to fame/notoriety (m81, m89, m96) and the
   "Vibes −8 until m96" lock are not modelled; m89 applies a one-off −8 social.
4. **Fishing.** m90 wants a calm fishing routine (wait, tug, lift; no score). Used `look` at the Dam twice.
5. **Placement routine.** m80 logbook ×5 evenings → a choice; three placement tasks → one `job` (errand) with
   the on-a-job banner. Repeatable work shifts after m80 are not wired.
6. **Payday sliders.** m85 wants a three-way slider split of ₦60,000; done as four preset splits.
7. **Debate step.** m94: timed `choice` (clock 30); the `spoke_congress` bonus option from m59 is not offered
   (options cannot be conditional on a flag).
8. **m92 Version A** (you are seeing two people) needs a flag the romance system sets when the player is
   two-timing (e.g. `two_timing`). Only Version B is in the file. Version A, ready to add once the flag exists:
   phone ×2 (both messages, same time, same place) → go shinkafi (LILY passing: "We noticed in week three." /
   LYZZY: "We gave you till week six.") → turn: they are comparing notes (FIRST: "You told me you had a test
   that night." SECOND: "That was my birthday.") → choice: confess (`twotimed_confessed`, social −3; one may
   forgive after a cooling-off) / excuses (`twotimed_caught`, social −8 for a semester; both leave).
9. **Unnamed speakers.** WALKER, EVERYONE, FIRST/SECOND are narration lines; a generic `walker` speaker would
   let them be voiced. `colleague` and `fan` were added as small people for the same reason.
10. **Boat, plane night landing, wheelie.** m95's boat is `go dam`; m87's landing is `go strip`; m82's 5 s
    wheelie is `ride bike`. A `wheelie` and a `boat` ride would match the script.
11. **Roster clash.** The script makes Muhammad the Kanti Sports shopkeeper (m81); the bible roster reserves
    Muhammad for the fresher in the last mission. Kept as scripted (`muhammad`); the Y5 file may want another id.

## Engine answers (samaru-story.js) — see ENGINE.md §12

Done in the engine now; content can switch from the workarounds when convenient (all workarounds still run):
- `has_partner`, `two_timing`, `twotimed_caught`, `strike`, `last_result_lost`, `maker_free` are kept by the engine.
- `@super`, `@place`, `$who`, `$here`, `$other` resolve; `pitch quad fountain pier fence oldcampus rangerpost p2bend forest_edge` alias to real places.
- `pick: 2`, option `need` (standing/flags), `byStanding` + `track`, `linesLost`, `soft`, `anyResult`, counted `delivery` (`count`, `spill`), step `title`, `hud: false`.
- `buy` steps for new items are sold by the engine at `at`/`place` or any shop (price from the item) — stocking per shop is not needed.
- Encounters: spawned `$who`/`$other`, `ask`/`setup`/`thanks`/`decline` voiced, `help.cash: 0`, `help.flags/item/hidden`, `twist.give/then`, `notAfter`, `hot`, `needItem`, `ambientRules.minGap`; side missions offered when talking to the giver.
- Strike: while `strike` is on, `Z.life.next()`/`attending()` return nothing (no lectures, timetable paused) and `Z.crowd.scale()` returns .45.
- Speakers `crowd:<who>`, `phone:<who>`, `radio:<x>`, `mum`, `dad`, `advert` display with labels.

Still open (need other modules; the engine falls back as described):
- New places/rooms (`oldcampus` as a real ruin, ranger post, mall basement/office, Senate basement/roof, porter's lodge): map and interiors owners. Aliases above until then.
- New enemies (Idler beaten by noise, hummer, echo, null, Chancellor Null): core combat owner; `shade`/`entropy` stand in.
- Crowd density: `Z.crowd` must multiply its spawn count by `Z.crowd.scale()` for the strike to thin it; night tutorials off during the strike: interiors owner should check `P.flags.strike`.
- `Z.hideHud` must be read by the HUD draw in samaru-core.js.
- Fishing, boat, wheelie, night landing, fire drill, crowd-follow escort, payday sliders, debate with conditional options beyond `need`: not built; workarounds stand.
- Rewards needing other systems (outfits, secret radio station, haircut discounts, map shortcuts, hidden room unlock, new-game-plus heir): flags are set; the owning modules should read them.
- World switches `permanent_light`, `road_lit`, `story_done` epilogue morning: flags set; lighting/world owners should react.
- Bystanders pack (`D.BYSTANDERS`) is merged and exposed; brawl/crowd code should read it.
- Shared ids: prefer `groundnuts` everywhere (Y2 uses `groundnut`).
- Co-op: `fslg-story-coop.js` is still empty; `Z.story.coop(players)` lists whatever it registers. There is no co-op runner yet — the multiplayer owner needs to build one from `type` + `params`.

## COOP needs (fslg-story-coop.js, friends missions F1–F25)

Friends missions run on their own referee (`C.Host` / `C.Client` in fslg-story-coop.js), not on the story engine, so they need none of the story step types. What they would still like from the game:

1. **Speed limits for one player.** Keke Relay gives the smaller team an 8% faster keke and Blackout Shift wants the generator carrier slowed. There is no per-player speed multiplier the core reads, so the relay applies 0.92 to the smaller team's time instead, and the carrier is only required to walk (no vehicle). A `me.speedMul` read in the walk and vehicle code would make both literal.
2. **"Market day" twist.** It is listed and can be switched on, but there is no walker/traffic density control to turn up. Needs a density knob in the crowd code.
3. **Co-op cosmetics.** Wins record `P.coop.cos` ("shirt_cof", "scarf", "keke6"), but the wardrobe has no such items and no grant call. Needs three wardrobe items (Class of Friends shirt in the MIB Store, team scarf, six-seat keke skin) and `Z.wardrobe.grant(id)`.
4. **Decoy walkers in Hide and Seek, hill section in Bicycle Derby, roadworks in The Long Road, cloud banks in Sky Tag.** These variations are text only; the campus has no hills or road closures to switch on.
5. **Photo of a goat.** The subject is judged by place (near the market), because goats are not tracked entities.
6. **Touch.** Phone players press the on-screen "G" pill the mission HUD draws (it routes through `Z.click`). A real button in the touch layer would be nicer: an action id `coop` exists in samaru.js for keyboard (G) only.
7. **Offline LAN.** The missions only need `{k:"co", o, d}` events delivered to every peer, so the WebRTC transport can carry them unchanged; the host's own events are applied locally, never echoed.

## Engine notes, Year 1 rewrite (phase 1)

- The built-in m1–m36 are retired when `fslg-story-y1.js` loads; the new Year 1 is generated by `tools/story/build_y1.py`.
- `sly` is kept in `D.NPCS` but hidden (retired); `sly`/`bolaji` resolve to `bola` (Bolaji, male).
- Baba Porter's lodge is placed by the gate (`at: "gate"`): people whose `at` is your hostel are brought into your room by
  the interiors code, where he blocked the room's spots. The Y5 `bedfresher` was moved to `danfodio` for the same reason.
  Interiors owner: people brought into a room should keep clear of the room's marked spots.
- `samaru-interior.js`: pressing E on a marked spot now wins over a person within 3 m who is further away than the spot.
- For the people/security owner: from some positions guards stop 47 m away (blocked) and the chase ends in "escaped" while
  the player stands still. The old harness now runs its security checks from the Selfie Garden so it is not affected by
  where the story left the player; the guard pathing itself is unchanged.

## For the vehicles owner (seen while filming the opening)

- The plane and the four-wheel cars have no rider seat (`u.seat` is only set for two-wheelers), so the rider is drawn at
  ground level: in a car the driver's head pokes through the roof, and in a plane in the air the pilot stands on the
  runway below it (the film hides the player in those two shots). Please give closed vehicles a seat or hide the rider.
- **Vehicles owner, reply (Nov 2026):** every vehicle already has a driver anchor (`userData.anc`, the plane's is the
  cockpit), and the rider pose rides on it with `ry` = the vehicle mesh height, so in game the pilot is in the cockpit at
  any altitude (checked offscreen at 11 m). Two causes were found and fixed: getting in used a hop and an eased scale, so
  for a moment the head went through the roof (now no hop and the seated size at once under a roof), and tall hair poked
  out (each seat now has a `roof`, and a figure is drawn just small enough to fit). For the film: the rider only follows
  the seat if the film's vehicle is in `Z.cars` (so `pools.cars` has its mesh) and game time advances; the seat change
  is eased over 0.46 s. Passenger seats: `Z.veh.seats(v)`, door points `Z.veh.door(v, i)`; a passenger has
  `n.rideV = v`, `n.seatAnc`, `n.seatI` and `n.boardT` (seconds since boarding, for the animation worker).

## Resolved after the outside review (docs/FSLG_REVIEW.md), 14 Nov

- Search steps in the wrong place (m1 backpack and m4 torch at the gate; m10, m25, m32): `build_y1.py` now updates
  `last_place` after `@` places, and the scripts carry explicit `at` tags. Year 2–5 search steps were audited against
  their scenes; all match their text. m108.5 now spreads over seven departments (`collect` takes `places: [...]`).
- `go` steps that never fired when you were already standing there (19 cases): `Z.stepStart` clears `Z.lastPlace`,
  and the update loop caches the place before emitting.
- Beacons: the guide line points at the search item itself; gems show from 40 m and spawn on dry ground outdoors;
  `ride` steps point at the nearest vehicle of that type; `class` steps at your next lecture (or `@dept`); talk steps
  with a token (`@roomie`) point at the person.
- NPC homes: Maryam is at Page Turner Books (`mk_books`). A talk beat can place its person for that beat with `npcAt`
  (m7: Hassan waits outside your hostel).
- Test: `games/tests/test_samaru_replay.py` replays all 120 missions through `Z.update` and fails on any of the above.
- Earlier "Speakers" and "Partner flag" needs were answered in phase 1 (ENGINE.md §12); the strike still needs the crowd
  module to read `Z.crowd.scale()` (not checked here).
