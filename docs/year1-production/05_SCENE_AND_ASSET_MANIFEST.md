# 05 — SCENE & ASSET MANIFEST (YEAR ONE)

**Status:** production reference · **Scope:** M001–M024 · **Source of truth:** `docs/plan/missions/Y1.md` (blocking, camera, props, sound) + `docs/plan/STORY_BIBLE_V2.md` (what the places mean) + `games/work-in-progress/src/game/cast.ts` (cast looks).

This is the build list for everything that is **not a character performance**: places, camera anchors, set dressing, props, wardrobe overlays, effects, sound, music, lighting, animation, crowds, vehicles, and items. Character bodies, faces, rigs and voices live in `01_CHARACTER_BIBLE.md`; shots and timings live in `04_CUTSCENE_TECHNICAL_SPEC.md`.

Read this document with `03_YEAR1_SCRIPT.md` open. If a line here contradicts a cutscene block, **the cutscene block wins** and this file is wrong.

---

## 0. How to use this document

### 0.1 The four kinds of asset

| Kind | What it is | Where it lives in the engine | Can it be renamed? |
|---|---|---|---|
| **Location** | A named place the story visits (`loc.hostel.room`) | world scene / level | No — referenced by missions and saves |
| **Anchor** | A fixed camera or staging point in a location (`room_desk_low`) | empty transform in the set | No — referenced by `from:` in cutscenes |
| **Look target** | What a camera points at (`clock_hands_606`, `prop.note`, `ZAINAB`) | aim target on a set, prop or actor | No — referenced by `look:` |
| **Prop / item** | An object that can be shown, hidden, moved, held or collected (`prop.note`, `item.torch`) | prop prefab / inventory | No — save keys |

### 0.2 Status tags

| Tag | Meaning |
|---|---|
| `CANON` | Written in `Y1.md` or locked by the story bible. Build exactly. |
| `LOCKED` | A rule that cannot be changed without a canon revision (Zainab's skin, one human scale, specials-only content). |
| `DERIVED` | Not written in `Y1.md`, but required by a written action (e.g. the barn wall the goat runs behind). Build as described; it is not new story. |
| `PROPOSED` | A production suggestion. Safe to change, but announce the change so downstream docs stay aligned. |
| `GAP` | Something with no source and no proposal yet. **Do not invent silently** — raise it. |

### 0.3 Rules that apply to every asset

1. **One human scale.** Every human uses the same skeleton scale; character height stays within ±6% (`cast.ts`). Doors, beds, desks, chairs, hoops, counters and vehicle seats are built to that scale. No hero-sized furniture.
2. **Modest outfits, no exposed midriffs, no tight clothing.** This is a campus comedy, not a fashion shoot.
3. **No real brands, logos, club crests, or readable real phone numbers.** Invented names only (MIB-Hub, Kola of Vigour, Zobo Max, Turbo Sneakers).
4. **Skin palette is fair-to-caramel; nobody is very dark.** Dr. Zainab is `#f1d6c2` and locked. Do not "correct" a set's lighting to darken skin.
5. **Colour is meaning.** Warm amber = safety, food, the Spot, home. Cyan-green = the humming garden, the Maker, wrongness. Sodium orange = night campus. Cold blue = the dam and the count. Red = danger, failure, the Count's tally. Use these consistently across sets.
6. **Every location must read in three seconds** from its establishing anchor, and must still read at night under one practical light.
7. **Props that carry a clue are hero props.** They get a close-up model, a clean silhouette, and a readable texture at 0.5 m. Everything else can be a dressed kit piece.
8. **No gore, no corpses, no weapons.** Danger is weather, water, electricity, embarrassment and time.
9. **Anchors are empty transforms, not meshes.** Do not parent geometry to an anchor. Name them exactly as written, including lowercase and underscores.
10. **If an anchor is used from a vehicle or an actor (`from: PLAYER`, `from: JEGA`, `from: MAKER`), it is a runtime rig**, not a world transform. It follows the actor's eye height and facing.

### 0.4 Counts in this document

| Thing | Count |
|---|---|
| Locations (`loc.*`) | 72 location IDs used in steps |
| World camera anchors | 160 |
| Actor-relative camera rigs | 3 (`PLAYER`, `JEGA`, `MAKER`) |
| Look targets | 119 (55 cast, 35 world, 29 props) |
| Prop entities and prop states | 63 |
| Wardrobe overlays | 14 |
| VFX | 17 |
| Sound cues (SFX + music) | 56 |
| Music cues | 13 |
| Lighting presets | 7 |
| Animation tokens | 16 + 6 loops |
| Crowd types | 4 |
| Vehicles | 5 |
| Persistent items | 29 |
| Step-only tools | 21 |

---

## 1. The world in one page

**Genre look.** A West African campus comedy with a mystery underneath: sun-bleached concrete, red laterite, green neem and mango, painted walls in faded cream/ochre/teal, corrugated zinc, visible wiring, hand-painted signs. Everything is used, repaired, and slightly crooked. Nothing is glossy or futuristic except the Maker's room and the relay core, which should feel **too clean** for the world around them.

**Camera language.** Mostly eye-level and low, documentary framing; wide establishing shots are static or slow; comedy holds longer than expected; the mystery uses slow push-ins and one impossible detail in an otherwise ordinary frame. No Dutch angles except M016 underwater and M024's count reveal.

**Time of day.** Freshers' Week is hot and bright. Test and exam weeks are harmattan-dry, dusty, orange. Night scenes are sodium-orange with pools of darkness, never blue "movie night" except the dam.

**Weather.** Harmattan haze from M012 onward: pale sky, dusty air, visible breath at night in M015–M016. One rain-free year — no rain scenes in Year 1.

**The campus loop.** Main Gate → ring road → Senate/Registry → Twin Theatres → Engineering garden → hostels → the Spot → market → sports complex → dam road. Every location should be reachable on foot in the fiction, and the geography must stay consistent: the dam is north-east and downhill; the market is south of the gate; the hostel cluster is west of the Senate; the Engineering garden is between the theatres and the library.

**What "home" looks like.** The hostel room is small, over-lit by one bulb, with two beds, a shared desk, a window with a view of the clock tower and the twin theatres. It is the only set that must feel safe at every hour.

---

# PART A — SETS AND ANCHORS

Each cluster below is a **build unit**: one environment kit, one lighting rig, one ambience bed. Anchor tables give the exact camera/staging transforms and what the frame must contain. Mission numbers show when the anchor is used; `COND` means it is only used inside an `[IF special.*]` block.

---

## A01 — Main Gate, Ring Road & Arrival Road

**Locations:** `gate.ring_road_start`, `admin.boulevard`, `admin.senate_steps` (approach), plus the unnamed gate exterior and ring-road stretch.
**Story function:** the threshold. M001 arrives here; M024 leaves/returns here; M017 races here; M023's van exits here.
**Build:** a wide laterite approach road, a concrete gatehouse with a boom barrier that is more paint than mechanism, a hand-painted sign reading the university name (use `{{UNI_NAME}}`), a low wall with faded posters, one flame tree, and a security post with a fan that does not turn. The ring road is a two-lane loop with no markings, deep red laterite shoulders, and a clock tower visible above the tree line. The boulevard is the formal spine: avenue trees, senate steps at the far end, working streetlights only on the first 200 m.

| Anchor | Missions | What the shot must contain |
|---|---|---|
| `air_dam_east` | M001 | High aerial from the dam side looking west at dawn: water haze, campus core, clock tower, one road. |
| `air_gate_high` | M001 | High aerial over the gate: car small on the approach, barrier, guard post, sign. |
| `air_ring_road` | M001, M024 | High tracking anchor on the ring road; the whole loop and both theatres readable in one frame. |
| `gate_crane` | M001 | Jib down from sign to barrier as the family car arrives; gatehouse in middle ground. |
| `gate_crane_b` | M001 | Reverse jib from inside the gate: car nose, guard, open barrier, campus behind. |
| `gate_kerb_low` | M001 | Low kerb-level: tyres, dust, feet, the Ghana-must-go bag landing. |
| `car_back_seat` | M001 | Interior rear bench: Mum in frame, Dad's shoulder, windscreen with gate beyond. |
| `clock_tower_face` | M001 | Straight-on tower face; hands at **6:06**; one hand visibly hesitant. |
| `road_kerb` | M017 | Kerb-level start line of the keke race; chalk mark, three wheels, crowd feet. |
| `last_bend_kerb` | M017 | Kerb-level final bend; barrier, market stalls, finish banner beyond. |
| `boulevard_front` | M012 | Frontal boulevard: crowd silhouettes, senate steps, one working lamp. |
| `boulevard_crane` | M012, M024 | Crane up the boulevard as lights fail or come on; whole avenue in one move. |
| `boulevard_end` | M012, M024 | Ground-level down the boulevard to the senate; vanishing point on the steps. |
| `boulevard_side` | M024 | Side-on boulevard at night: lantern procession, long shadows, trees. |
| `van_rear` | M023 | Rear doors of the works van at the substation; cable, rain-free dust, Aliyu's silhouette. |

**Set dressing:** boom barrier (counterweighted, chipped red/white), guard stool, hand-written logbook, faded matriculation posters, one broken speed bump, flame-tree litter, a "NO U-TURN" sign facing the wrong way. Ring road: mile markers, a fallen road-sign, kiosks at the shoulder. Boulevard: low hedges, benches, one dead streetlight, senate steps with a worn centre.

**Lighting:** dawn = low warm sun + long shadows + mist in the dam direction. Day = hard overhead. Night = sodium pools with 40% of lamps dead. M024 = warm bulbs strung in the trees, one cool rim from the senate.

**Sound bed:** gate = birds, distant generator, barrier creak, one radio in the guard post. Ring road = wind, goats, distant traffic, keke horns. Night boulevard = insects, one transformer hum, footsteps on concrete.

**Continuity:** the barrier is broken in M001 (guard lifts it by hand) and still broken in M017 (tied up with cloth). By M024 it has been painted but not fixed. The "NO U-TURN" sign is always backwards.

---

## A02 — Hostel, Hall & Rooms

**Locations:** `hostel.room`, `hostel.corridor`, `hostel.window`, `hostel.common_room`, `hostel.kitchen`, `hostel.steps`, `hostel.roof`, `hostel.lodge`, `hostel.kadanya_gate`.
**Story function:** the player's only private space, the place where clues are kept, and the place that must feel changed by the end of the year.
**Build:** four-storey walk-up blocks, faded cream walls with a green damp line at the base, open-air walkways with iron railings, doors in mismatched colours, one bulb per landing on a timer. The room: two single beds (one always better made), a shared desk under the window, a wardrobe with one door, a ceiling fan that wobbles, a wall of previous occupants' stickers, a kettle, a bucket, a mirror with a crack. The corridor: long, narrow, doors on one side, railing on the other, noticeboard at the far end. The kitchen: two gas rings, a shelf of shared pots, a window with no glass, a bucket of onions.

| Anchor | Missions | What the shot must contain |
|---|---|---|
| `hall_forecourt` | M001 | Hostel entrance from the car: bags, parents, one working light, the porter's route to the stairs. |
| `hostel_window` | M001 | From inside the room at the window: clock tower, twin theatres, the line of water; the "kingdom" reveal. |
| `door_floor` | M001, M003 | Low on the door gap: light under the door, note being pushed through, feet. |
| `room_centre` | M001 | Centre of the room: both beds, desk, window; symmetric, small, safe. |
| `room_corner` | M001, M003, M014 | Desk corner / wardrobe corner; where objects accumulate and clues are pinned. |
| `room_door` | M001, M014, M024 | The door from inside: note slot, coat hook, corridor light bleeding under. |
| `corridor_far_end` | M001, M003 | Long corridor to the far window; vanishing point, one bulb, night darkness beyond. |
| `corridor_mid` | M003, M011, M023 | Mid-corridor: doors, railing, noticeboard edge, a bulb that flickers. |
| `corridor_wall` | M011 | Wall beside the door: timetable, red circles, lantern light, shadow. |
| `common_room_door` | M011 | Common-room doorway: group visible inside, warm light, chairs. |
| `kitchen_door` | M003 | Kitchen doorway from the corridor; steam, one candle, darkness behind. |
| `kitchen_high` | M003 | High corner of the kitchen: shelf, pots, bulb, two heads below. |
| `kitchen_shelf` | M003 | Shelf-level: onion, matches, radio, chipped plates. |
| `hostel_steps_low` | M012 | Low on the outdoor steps at night: feet, torch cone, generator cable. |
| `hostel_roof_edge` | M012 | Roof edge looking over campus: blackout grid, senate roof, count. |
| `hostel_roof_tank` | M012 | Rooftop tank silhouette; antenna, cable, sky. |
| `lodge_window` | M022 | Porter's lodge window from outside: grill, desk lamp, list, Porter's face. |
| `room_table` | M003, M022 | Table top: food, notes, everybody-list, two pairs of hands. |
| `room_wall` | M011 | Wall above the desk: lamp bracket, sticky notes, the sketch. |
| `room_desk_low` | M024 | Desk-level at the end: the note, the tin, the year's objects arranged. |
| `switch_wall` | M023 | Light-switch plate on the corridor wall; hand, spark, darkness. |

**Set dressing:** room — two mattresses with different sheets, a shared kettle, a bucket, a broom, a wall calendar, a framed Bible verse, a poster of a footballer (invented), a stack of textbooks, a Ghana-must-go bag under the bed, a broken chair, a fan. Corridor — noticeboard, mop, bucket, a wardens' notice, a "QUIET PLEASE" sign ignored. Kitchen — pots, onions, matches, a radio, a candle stub. Lodge — key rack, ledger, fan, radio, a mattress.

**Lighting:** room = one warm bulb, window key by day, practical lamp at night. Corridor = one bulb per landing, 40% dead; the far end always darker. Kitchen = candle + one bulb; M003 uses candle only after the blackout. Roof = moonlight + campus glow. M024 room = warm lamp, everything slightly golden.

**Sound bed:** room = fan, insects, distant hostel radio, footsteps on the walkway. Corridor = echo, a door, a bucket, someone laughing two floors down. Kitchen = gas hiss, pot lid, radio. Roof = wind, generator, the count hum.

**Continuity:** the room accumulates objects across the year. By M024 the desk must visibly hold the year: tin, logbook stub, sketch, twine, boot, sticker, note. The cracked mirror is always cracked. The fan always wobbles. The corridor bulb repaired in M011 must still be working in M023 (until the blackout).

---

## A03 — The Spot

**Locations:** `student.spot`, `student.spot_counter`.
**Story function:** the social heart; first kindness; where the year's friendships are seeded.
**Build:** an open-air food court under a corrugated canopy: long shared tables, benches, a counter of steaming pots, a hand-painted menu board, a fridge that hums, a stack of plastic chairs, a suya grill at the edge, strings of bulbs, a wall of faded soft-drink signs (invented). The ground is packed earth and concrete patches. The roof has a gap where the goat lands.

| Anchor | Missions | What the shot must contain |
|---|---|---|
| `suya_table_low` | M001 | Low across a table: two plates, the goat's shadow, the bench the player vaults. |
| `spot_rafters` | M001 | Up into the canopy: corrugated sheets, a gap, the goat silhouetted, one bulb. |

**Set dressing:** pots (jollof, stew, rice), stacked plates, a ladle, a hand-written price list, a bucket of water, a washing-up bowl, a radio, a wall clock that is wrong, a poster for a missing goat (added after M001 as a joke), a bench with a broken slat.

**Lighting:** day = canopy shade with hot rim; night = bulb strings, warm, moths. The grill gives a red underlight.

**Sound bed:** serving clatter, conversation murmur, radio highlife, the fridge, a generator, birds in the canopy.

**Continuity:** Mama Nkechi's counter is the same in M003 (night, closed) and M014 (morning, open). The missing-goat poster appears from M002 onward.

---

## A04 — Agric Farm

**Locations:** `agric.farm_gate`, `agric.barn`, `agric.suya_fence`.
**Story function:** the first clue (the tin under the kola tree) and the first mention of "one engineering boy".
**Build:** a working teaching farm at the edge of campus: a rutted track, a metal gate with a chain, a low barn of unpainted block and zinc, a fenced pen, a water trough, a mango tree, a kola tree with a bare patch beneath it, sacks, a wheelbarrow, a stack of firewood. The barn's back wall has a loose stone at the base. The farm must feel quiet and slightly out of time.

| Anchor | Missions | What the shot must contain |
|---|---|---|
| `farm_gate_low` | M001 | Low at the gate: bicycle wheel, goat in basket, Sule's hands, chain. |
| `farm_gate_post` | M001 | Gate-post height: the sign, the track beyond, the barn roof, sky. |

**Set dressing:** chain and padlock, hand-painted "AGRIC FARM — NO TRESPASSING" sign, sacks of feed, a hoe, a wheelbarrow, a stool, a radio, a tin cup, a kola tree with fallen leaves, the loose stone, the tin (hero prop).

**Lighting:** late afternoon sun, long shadows, dust; the barn interior is 3 stops darker with one shaft of light.

**Sound bed:** goats, wind in zinc, a distant radio, insects, the chain.

**Continuity:** the loose stone is displaced in M001 and never reset. The tin is gone from M002 onward. The missing-goat poster from the Spot is visible on the barn wall in M022 (a callback, not a clue).

---

## A05 — Senate, Registry, Bursary & Bank

**Locations:** `admin.senate_steps`, `admin.senate_basement`, `admin.registry`, `admin.bursary`, `admin.bank`, `eng.noticeboard`, `eng.quad`, `eng.substation`.
**Story function:** bureaucracy as comedy and as obstacle; door 7; the queue; the results board; the substation that fails.
**Build:** a long low senate building with a colonnade, worn steps, a noticeboard of pinned papers, a queue rail made of rope and stanchions, registry windows with grilles, a bursary hatch, a bank of two ATMs (one always out of service), a basement corridor of pipes and filing cabinets, and the engineering quad with benches and a noticeboard under a tree. The substation is a fenced concrete hut with a transformer, warning signs, and a gate that is never quite locked.

| Anchor | Missions | What the shot must contain |
|---|---|---|
| `senate_crane_high` | M002 | High crane over senate lawn and queue: roof line, steps, crowd, door 7. |
| `senate_lawn` | M002, M012, M024 | Lawn-level across to the steps; queue by day, crowd by night, ceremony by M024. |
| `senate_steps_low` | M012, M024 | Low on the steps: feet, lanterns, the Maker's shoes, the dean's robe hem. |
| `senate_door` | M024 | The main door from outside at night: light, seal, two figures. |
| `senate_roof` | M012 | Roof line against the blackout grid; antenna, sky, count. |
| `basement_corridor` | M002 | Basement corridor: pipes, one cage light, door 7 at the end. |
| `basement_stair` | M010 | Basement stair from above: SUG porter, boxes, fuse box. |
| `queue_side` | M002 | Side-on queue: rope, stanchions, folded chairs, impatience. |
| `registry_window` | M002 | Registry grille at eye height: clerk, forms, stamp, hands. |
| `bursary_window` | M002 | Bursary hatch: smaller grille, longer queue, a sign that says "BACK AT 2". |
| `bank_high` | M015 | High over the ATM alcove: two machines, one queue, one shade. |
| `garba_desk_low` | M002 | Garba's desk from below: ledger, stamp, glasses, a fan. |
| `garba_desk_side` | M002 | Side of the desk: drawer, keys, the mark on the wall. |
| `noticeboard_face` | M013 | Straight-on results board: lists, red circles, a gap where a name should be. |
| `noticeboard_side` | M013 | Side angle: crowd pressing in, one figure at the edge. |
| `quad_high` | M013 | High over the quad: noticeboard, benches, paths, students. |
| `quad_bench` | M013 | Bench-level: Khadija's notebook, the board beyond, shade. |
| `quad_edge` | M013 | Edge of quad toward Engineering: path, bin, poster, exit. |
| `substation_door` | M023 | Substation door: chain, warning sign, Aliyu's van, cable. |
| `eng_office_door` | M013 | Engineering office door: results-day notice, clerk, corridor behind. |

**Set dressing:** queue rope and stanchions, plastic chairs, forms on clipboards, a stamp pad, a wall fan, a water dispenser, a dead potted plant, pinned lists, a "no cell phones" sign, a mop, a filing cabinet, a generator, hazard tape, a transformer hum, a burnt smell (M023).

**Lighting:** day = hard sun + deep colonnade shade. Basement = one cage bulb, green-grey. Bank = fluorescent. Substation = sodium security light, long shadows, spark glow in M023.

**Sound bed:** queue murmur, stamp thud, fan, phone ring, generator, transformer hum, the odd burst of laughter.

**Continuity:** the queue rail is bent in M002 and still bent in M013. The "BACK AT 2" sign is always wrong. Door 7 is ordinary and must not look magical — the clue is that it is the seventh door in a row of six plaques (payoff M020).

---

## A06 — Lawns, Park, Neem & Campus Green

**Locations:** `eng.theatre_lawn`, `gate.flowers`, `eng.garden` (approach), `hostel.kadanya_gate`, `sports.gate`, `student.mai_shayi`, plus the unnamed park and neem tree.
**Story function:** breathing space, romance-free friendship, the neem tree, the bench, the quiet conversations.
**Build:** open lawns of patchy grass, mature neem and mango trees, low concrete benches, a park with a cracked path and a dry fountain, a football pitch visible beyond, a flower bed at the gate that is mostly weeds. The neem tree at the Kadanya gate is thin, tall and unmistakable; its shade is the coolest place on campus. The theatre lawn has a low stage edge and a backdrop of the twin theatres.

| Anchor | Missions | What the shot must contain |
|---|---|---|
| `theatre_lawn_high` | M005 | High over the lawn: students crossing, theatre fronts, path to the wrong theatre. |
| `lawn_crane` | M004 | Crane over matriculation lawn: crowd, canopy, gowns, queue. |
| `lawn_edge` | M004 | Lawn edge: flower bed, path, photographer's tripod. |
| `lawn_path` | M004 | Path through the crowd: gowns, families, confetti, feet. |
| `lawn_row_side` | M004 | Side of the seated row: gowns, hands, a gap. |
| `lawn_high` | M011, M012 | High over the lawn at dusk/night: lamps, paths, blackout grid. |
| `park_bench` | M017 | Bench-level in the park: Lula, Faty, the examiner, a joke book, shade. |
| `park_shade` | M017 | Deep shade under the tree: silhouettes, dappled light, a path beyond. |
| `neem_side` | M021 | Side of the neem trunk: thin trunk, gate, Helen, a scooter beyond. |
| `kadanya_gate_path` | M021 | Path to the Kadanya gate: hostel wall, neem, gate bar, evening light. |
| `tree_line` | M015 | Tree line at the dam road: palms, haze, water beyond. |
| `tree_line_low` | M015 | Low through grass to the tree line: feet, bags, the dam. |

**Set dressing:** benches, bins, a broken fountain, a football, a kite in a tree, handwritten posters on trunks, a memorial plaque, a flower bed, a path of cracked slabs, a bicycle leaned on a tree.

**Lighting:** day = dappled shade, hot highlights. Dusk = amber, long shadows. Night = one lamp, moon, fireflies (M006/M015).

**Sound bed:** wind in leaves, birds, distant lectures, a radio, football shouts, insects at night.

**Continuity:** the neem tree is thin in every shot; do not make it a big shady oak. The park bench has a carving on the arm (an initial, not a clue). The gate flower bed is always more weed than flower.

---

## A07 — Twin Theatres

**Locations:** `eng.theatre_gabas`, `eng.theatre_yamma`, `eng.theatre_lawn`, plus the exam hall.
**Story function:** the first lecture in the wrong theatre; the exam; the stage where Shamsu holds court.
**Build:** two near-identical lecture theatres facing each other across a lawn, built in the 1970s: concrete fins, narrow vertical windows, steep raked seating, wooden desks, a stage with a lectern, a chalkboard, ceiling fans, and a smell of chalk and old wood. The only difference is the sign: GABAS and YAMMA. The exam hall is a larger flat-floor version with rows of single desks and a clock at the front.

| Anchor | Missions | What the shot must contain |
|---|---|---|
| `gabas_stage` | M005 | From the stage into the raked seats: empty rows, one student, the wrong lecture. |
| `gabas_row_three` | M005 | Row three: desks, bags, the back of heads, a lecturer's shoes. |
| `gabas_row_six` | M005 | Row six: higher angle, more empty seats, the doors at the back. |
| `gabas_door` | M011 | Theatre door from the corridor: light, noise, a group arriving late. |
| `gabas_steps_side` | M011 | Side of the steps: Shamsu, notes, the lamp, the group. |
| `yamma_stage` | M005 | The other stage: the correct lecture already over, a cleaner, chalk dust. |
| `yamma_aisle` | M005 | Aisle of the correct theatre: empty seats, a dropped timetable. |
| `exam_desk_over` | M023 | Over a single exam desk: paper, pen, shaking hand, clock beyond. |

**Set dressing:** wooden desks with carved initials, chalk ledge, dust, a lectern, a broken fan, a wall clock, fire extinguisher, notice boards, a mop and bucket, a lost umbrella, a stack of past papers.

**Lighting:** day = shafts through high windows, dust motes. Night = fluorescent tubes, one flickering. Exam = flat, slightly green, no shadows.

**Sound bed:** echo, fans, chalk, distant lawn mower, a door, the exam clock.

**Continuity:** GABAS and YAMMA signs are swapped in M005 as a joke (the letters are loose); they are corrected by M011. The clock in the exam hall runs four minutes fast, always.

---

## A08 — Engineering Garden, Labs & Pond

**Locations:** `eng.garden`, `eng.garden_fence`, `eng.garden_gate`, `eng.elec_lab`, `eng.workshop_civil`, `envd.sculpture_garden`, `envd.sculpture_garden_pond`, `student.mai_shayi` (approach).
**Story function:** the humming garden, the fish-girl statue, the six plaques, the pond, the Maker's territory, the relay core.
**Build:** a walled garden behind Engineering: overgrown, humid, with a pond, a small pavilion, a fish-girl statue on a plinth, six brass plaques on a low wall, a seventh blank space, ten sockets in a rusted box, a web of twine between the neem and the fence, and a weathervane on the roof above. The electrical lab is a long bench room with oscilloscopes, a fuse board, and a smell of hot dust. The sculpture garden is the public face: mown lawn, concrete plinths, a bench, a pond with lilies.

| Anchor | Missions | What the shot must contain |
|---|---|---|
| `lab_bench_low` | M005 | Bench-level: logbook, fuse, tools, hands, the missing page. |
| `lab_bench_end` | M005 | End of the bench: Abbas, Wednesday, the door, the corridor beyond. |
| `lab_bench_over` | M005 | Over the bench: open logbook, page 40, the stub at 41. |
| `garden_fence_gate` | M006 | The garden gate from outside: chain, gap, the hum audible in the frame. |
| `garden_fence_east` | M006, M018 | East fence: wire, twine, the statue beyond, the radio mast. |
| `garden_bench_low` | M006, M022 | Bench in the garden: Mai Shayi, the Maker, the pond, the statue. |
| `bench_fire` | M006 | The bench by the brazier: firelight, faces, the statue behind. |
| `bench_end` | M006 | End of the bench: empty space, a folded wrapper, the path. |
| `pond_far_bank` | M006 | Far bank of the pond: statue base, lilies, dark water, reflection. |
| `neem_tree_branch` | M006 | Up into the neem: branch, twine, a hanging tin, sky. |
| `prop.statue_fish_girl` | M006 | The statue as a look target: face, hands, fish, wet stone. |
| `eng_office_door` | M013 | Engineering office door (results day): notice, handle, corridor. |
| `garden_gate_low` | M020 | Low at the garden gate: chain, hinge, the six plaques beyond. |
| `garden_gate_post` | M006, M020, M022, M024 | Gate post: sign, hinge, the garden beyond; four different times of day. |
| `garden_over` | M020 | High over the garden: six plaques, seventh space, pond, gate. |
| `sculpture_gate_arch` | M020 | The sculpture-garden arch: concrete, creepers, the mall roof beyond. |
| `sculpture_bench` | M020 | Bench in the sculpture garden: Maker, Okonkwo, Tanko, the plaques. |
| `sculpture_pond_bank` | M020 | Pond bank: plinth, reflection, the seventh space. |
| `drummer_statue_side` | M020 | Side of the drummer statue: drum, hands, plinth inscription. |
| `plinth_north` | M020 | North side of the plinth: six plaques in a row, one gap. |
| `plinth_rim` | M020, M024 | Rim of the plinth: feet, lantern, the seal, the count. |
| `plinth_orbit` | M020, M024 | Orbiting crane around the plinth: full circle, crowd, night sky. |

**Set dressing:** pond (lilies, algae, a stone edge, koi optional), fish-girl statue (weathered, one hand missing a finger), six brass plaques (readable names and years), blank seventh space with screw holes, rusted socket box with ten sockets, twine web, weathervane (a cockerel, slightly bent), lab benches, oscilloscopes, fuse board, logbook, tools, a kettle, a calendar, a mop, a bucket, a warning sign, a fire extinguisher, a hand-written "DO NOT SWITCH" note.

**Lighting:** day = green shade, humid haze, god rays through leaves. Night = one sodium lamp at the gate, firelight at the bench, the pond black. M020 = plaques lit one by one, warm; M024 = lantern + cool moon.

**Sound bed:** the hum (a low 50 Hz thrum with a beat), water, frogs, insects, a generator, the lab fan, the maker's radio.

**Continuity:** the hum is audible only inside the garden; it stops in M024 when the core is set right. The statue is turned to face the pond in M006 and stays turned. The seventh space is empty until M024, when the new plaque is placed. The weathervane's cape (M012) is still there in M024.

---

## A09 — Medical: A&E

**Locations:** `med.ae`, `med.ae_bay`, `med.corridor`.
**Story function:** Jega's injury; Zainab's first appearance; the Maker seen at a distance.
**Build:** a small teaching-hospital A&E: fluorescent corridor, plastic chairs, a triage desk, a curtained bay, a trolley, a wall clock, a hand-sanitiser station, a noticeboard of health posters, a bench outside in a small garden. It must feel understaffed but clean.

| Anchor | Missions | What the shot must contain |
|---|---|---|
| `ae_desk` | M009 | Triage desk: Hauwa, forms, pen, Jega's foot beyond. |
| `ae_bay_foot` | M009 | Foot of the curtained bay: Jega's leg, boot, curtain edge, Zainab's shoes. |
| `ae_curtain` | M009 | Curtain from the side: silhouette, light through fabric, a hand. |
| `ae_window` | M009 | Window of the A&E: car park, ambulance, the Maker passing. |

**Set dressing:** curtain rails, trolley, IV stand, sanitiser, posters, a plastic chair row, a fan, a clock, a mop, a bin, a vending machine (invented), a wheelchair.

**Lighting:** fluorescent green-white, one warm desk lamp, night darkness beyond the glass.

**Sound bed:** fluorescent buzz, trolley wheels, a distant PA, a fan, a phone, suppressed voices.

**Continuity:** the clock is correct here (contrast with the campus clocks). The poster of a smiling nurse is crooked in every shot.

---

## A10 — Sport: Pitch, Court, Gym & Stadium

**Locations:** `sports.pitch`, `sports.pitch_centre`, `sports.touchline`, `sports.court`, `sports.court_centre`, `sports.gym`, `sports.stadium`, `sports.stadium_gate`, `sports.gate`.
**Story function:** football, the left boot, the gym tax, the Vice-Chancellor's Cup.
**Build:** a grass pitch with worn goalmouths and a running track, floodlights on concrete poles, a water cooler, a covered stand, a basketball court with cracked tarmac, a small gym with a scale, a locker room, and a stadium bowl with a running track, a tunnel, and a scoreboard. All are believable campus-build, not professional venues.

| Anchor | Missions | What the shot must contain |
|---|---|---|
| `pitch_centre` | M008, M019 | Centre circle: kick-off, players, floodlights, stand. |
| `pitch_grass_low` | M008 | Grass-level: boots, ball, left boot, a bib. |
| `pitch_touchline` | M008 | Touchline: coach, water cooler, subs, the player. |
| `pitch_touchline_far` | M008 | Far touchline: Jega, Helen, the fence, the gate. |
| `pitch_floodlight` | M008, M009 | Floodlight pylon against dusk sky; one lamp out. |
| `water_cooler` | M008 | Water cooler at the touchline: cups, ice, a hand. |
| `goalmouth_side` | M008 | Side of the goal: net, post, goalkeeper, shot. |
| `goalmouth_low` | M009 | Low in the goalmouth: ball, boot, Jega down, the net. |
| `locker_side` | M010 | Locker row from the side: open door, towel, Mubarak, the plug sign. |
| `court_gate` | M007 | Court gate from outside: chain, Sly, the court beyond. |
| `court_gate_inside` | M007 | From inside the court: gate, Sly's silhouette, fence. |
| `court_floor_low` | M007 | Low on the tarmac: ball, feet, chalk line, shadow. |
| `court_hoop_high` | M007 | High at the hoop: backboard, rim, sky, Sly's hand. |
| `court_side` | M007 | Side of the court: bench, bags, fence, the challenge. |
| `court_touchline` | M007 | Court touchline: chalk, feet, the bet. |
| `court_centre_low` | M014 | Centre of the court, low: the challenge note, the tax table, Sly. |
| `court_bench_front` | M014 | Bench front: clippers, zobo, towel, Big Baby, Hassan. |
| `gym_door` | M014 | Gym door: sign, scale, NGOZI beyond. |
| `gym_scale_side` | M014 | Side of the scale: feet, dial, the number, a joke. |
| `gym_floor` | M014 | Gym floor: mats, weights, mirror, the tax table. |
| `stadium_roof` | M019 | Stadium roof: floodlights, sky, the crowd noise below. |
| `stand_row` | M019 | A row of the stand: crowd, banner, Shamsu, the boy. |
| `tunnel_mouth` | M019 | Tunnel mouth: players emerging, dark interior, light at the end. |
| `tunnel_bench` | M019 | Tunnel bench: Jega, boots, the twelfth pair, the wall. |
| `behind_goal` | M019 | Behind the goal: net, keeper, crowd, the missed shot. |
| `goal_line` | M019 | Along the goal line: post, line, ball, boot, the Cup. |
| `penalty_spot_low` | M019 | Penalty spot, low: ball, grass, the wait. |
| `centre_circle_low` | M019 | Centre circle, low: kick-off, boots, the trophy on a table. |
| `touchline_low` | M019 | Touchline, low: coach, fourth official, the bench. |
| `volleyball_net_post` | M021 | Volleyball net post: sand, net, Helen, the gate beyond. |

**Set dressing:** goal nets, corner flags, chalk, bibs, water cooler, cones, a roller, a scoreboard, banners, a drum, a trophy table, gym mats, a scale, a mirror, lockers, a bench, a first-aid kit, a mop.

**Lighting:** day = hard sun, sharp shadows. Dusk = floodlights, one pylon out. Night = pools of light, dark stands. Stadium = four pylons, cool white, crowd in shadow.

**Sound bed:** boots, ball, whistle, crowd, drum, PA, birds, a generator, the gate.

**Continuity:** the left boot is on the wrong foot in M008 and stays a joke in M019. One floodlight pylon is dead all year. The scoreboard is manually operated and always one goal behind.

---

## A11 — Radio Station

**Locations:** `arts.radio`, `arts.mast`, `studio.*`.
**Story function:** the pirate broadcast, Bature's audition, the truth about Zainab, the count on air.
**Build:** a small campus radio station on the top floor of Arts: a stairwell with posters, a studio with a glass window, a desk with two mics, a phone bank, a wall of CDs/records, an "ON AIR" sign, a transmitter room, and a mast outside with a red light. It should feel analogue, patched together, and beloved.

| Anchor | Missions | What the shot must contain |
|---|---|---|
| `radio_stairs` | M018 | Stairwell: posters, handrail, Bature climbing, the studio door above. |
| `studio_desk` | M018 | Desk: two mics, script, phone, cart machine, Bature's hands. |
| `studio_glass` | M018 | Through the glass: Bature in the studio, Wednesday outside, the ON AIR sign. |
| `studio_corner` | M018 | Corner: CD wall, headphones, a broken chair, the transmitter. |
| `studio_wall` | M018 | Wall: frequency chart, poster, clock at 18:06, a phone. |
| `studio_phone_bank` | M018 | Phone bank: lines lit, caller display, a hand hovering. |

**Set dressing:** mics, headphones, mixing desk, cart machine, CD racks, posters, a kettle, a fan, a clock, a phone bank, a transmitter, a red bulb, a "SILENCE" sign, a handwritten playlist.

**Lighting:** studio = warm desk lamp + red ON AIR glow; corridor = fluorescent; mast = red aviation light at night.

**Sound bed:** static, hum, a fan, a vinyl crackle, the transmitter, a phone ring, the show's theme.

**Continuity:** the studio clock reads **18:06** in M018 and is the second clock clue. The ON AIR sign is a physical bulb, not LED. The phone lines are physical buttons.

---

## A12 — Dam, Pier & Water

**Locations:** `dam.pier`, `dam.shallows`, `dam.shallows_far`, `dam.underwater`, `dam.underwater_core`.
**Story function:** Baba Dam's pier, the midnight swim, the relay core underwater, the year's biggest set piece.
**Build:** a wide, still reservoir with a concrete spillway, a long wooden pier on stilts, a boat house, a bank of tall grass, a road crest above, and a drowned forest of dead trees in the shallows. Underwater: green-brown murk, silt, reeds, a sunken concrete post, the core on a plinth. The dam must feel beautiful by day and enormous at night.

| Anchor | Missions | What the shot must contain |
|---|---|---|
| `dam_road_crest` | M015, M016 | Crest of the dam road: water, pier, sunset/haze, the car. |
| `pier_end` | M015 | End of the pier: Baba Dam, Lawal, the Maker, water below. |
| `pier_end_low` | M015, M016 | Low at the pier end: feet, planks, water, the core glow. |
| `pier_mid` | M015, M016 | Middle of the pier: walkway, posts, two figures, the far end. |
| `pier_post` | M015, M016 | Pier post: rope, algae, waterline, a hand. |
| `pier_side_low` | M015 | Side of the pier, low: stilts, reflection, a dive. |
| `pier_foot_low` | M016 | Foot of the pier at night: mud, torch, footprints, water. |
| `pier_over` | M016 | Over the pier: whole structure, torchlight, the count, the water. |
| `underwater_post` | M016 | Underwater: the concrete post, silt, the core beyond. |
| `underwater_silt` | M016 | Underwater: silt bed, reeds, a hand reaching, bubbles. |

**Set dressing:** pier planks (worn, gaps), rope, tyres, a boat hook, a life ring, a warning sign, a boat house, a bench, a lamp post, dead trees, reeds, a sunken post, the relay core (hero prop, cyan glow), a towel, a torch.

**Lighting:** day = hazy sun, silver water. Sunset = orange, long shadows. Night = moonlight, torch cones, core cyan. Underwater = green gloom, caustics, one warm torch.

**Sound bed:** water lap, wood creak, wind, insects, frogs, a distant generator, underwater muffled hum and heartbeat.

**Continuity:** the water level is low (dry season) and stays low. The pier's missing plank is missing in both missions; the player steps over it. The core's glow is the only cyan in the natural world.

---

## A13 — Market, Town & Cinema

**Locations:** `market.main`, `market.ladi_stall`, `market.kb_shop`, `market.clemantine`, `market.corn_seller`, `market.photo_kiosk`, `market.motor_park`, `market.tailor`, `student.cinema`, `life.labs`.
**Story function:** the tailor and the gown, the plug, the cinema non-date, the keke race, the sticker clue.
**Build:** a dense market street: stalls under tarpaulins, a tailor's shop with a treadle machine, a phone-accessory kiosk, a corn seller with a coal grill, a photo kiosk with a backdrop, a motor park of kekes and minibuses. The cinema is a small single-screen hall with a faded marquee, a tiled foyer, red velvet seats, a balcony, and a projector that smells hot.

| Anchor | Missions | What the shot must contain |
|---|---|---|
| `tailor_doorway` | M004 | Tailor's doorway: gown on a hanger, mirror, Needle, the street beyond. |
| `ladi_stall_front` | M010 | Ladi's stall front: fabrics, counter, Ladi, Mubarak, the plug sign. |
| `keke_dash` | M017 | Keke dashboard: hands, key, mirror, the road, the race. |
| `cinema_aisle` | M021 | Cinema aisle: seats, screen glow, Helen, the companion, a bucket of popcorn. |
| `cinema_back_row` | M021 | Back row: two heads, screen light, the exit sign. |
| `cinema_row_behind` | M021 | Row behind: the companion's shoulder, the screen, a phone. |

**Set dressing:** fabric bolts, mannequins, a treadle machine, a mirror, hangers, a counter, tins, a coal grill, corn husks, a phone kiosk, a photo backdrop, a motorbike, kekes, a cinema marquee, posters, a ticket booth, red seats, a projector beam, a popcorn machine, a bin.

**Lighting:** market = tarpaulin shade + hot spots; bulbs at dusk; grill red. Cinema = screen light (moving), exit green, aisle warm. Tailor = one warm bulb + mirror bounce.

**Sound bed:** market murmur, haggling, a radio, a generator, a sewing machine, a keke horn, cinema projector, audience laughter, a phone.

**Continuity:** the cinema marquee advertises an invented film; the title changes once (M021 joke) but the poster stays the same. The tailor's mirror has a sticker on one corner. The photo kiosk backdrop is a painted campus gate.

---

## A14 — Library

**Locations:** `lib.main`, `lib.reading_room`.
**Story function:** exam fever; the mattress in the library; the page-41 clue hidden in a book.
**Build:** a 1970s library with a high atrium, concrete fins, long reading tables with green lamps, shelves on rails, a card catalogue, a photocopier, a "SILENCE" sign, and a mezzanine. By M023 it is overcrowded: bags on chairs, mattresses on the floor, extension cables, flasks.

| Anchor | Missions | What the shot must contain |
|---|---|---|
| `library_atrium_high` | M023 | High atrium: floors, lamps, students asleep, the exam clock. |
| `library_aisle` | M023 | Aisle: shelves, a mattress, a reader, the wrong book. |
| `library_desk` | M023 | Reading desk: lamp, books, glucose, a note, a hand. |

**Set dressing:** books, green lamps, chairs, tables, a card catalogue, a photocopier, a trolley, a ladder, a mattress, a blanket, a flask, extension leads, a fan, a clock.

**Lighting:** warm green desk lamps, dark shelves, cold daylight from the atrium. Night = pools of lamp light, deep shadow.

**Sound bed:** page turns, a cough, a fan, a distant door, the clock, a whispered conversation.

**Continuity:** the mattress is in the same aisle in every M023 shot. The clock is wrong (fast) like the exam hall's.

---

## A15 — SUG & Public Rooms

**Locations:** `student.sug_hall`, `student.sug_basement`, `admin.bookshop`.
**Story function:** matriculation gown collection; the plug's basement; the bookshop queue.
**Build:** a student union hall with a stage, plastic chairs, banners, a table for collection, and a basement storeroom of crates, a fuse board, and a handcart. The bookshop is a narrow room of shelves, a counter, and a queue that never moves.

| Anchor | Missions | What the shot must contain |
|---|---|---|
| `sug_hall_door` | M004 | Hall door: queue, gowns, table, banner, Mubarak. |
| `hall_forecourt` | M001 | (Shared with hostel; see A02 — the SUG hall uses the same forecourt kit at a different dressing.) |

**Set dressing:** plastic chairs, stage, banners, a PA, a table, gowns in stacks, a ledger, crates, a trolley, a fuse board, a handcart, shelves, a counter, a queue rope.

**Lighting:** hall = fluorescent + stage wash; basement = one bulb, green; bookshop = warm shop light.

**Sound bed:** echo, chatter, a PA feedback whine, a fan, crates, a handcart.

**Continuity:** the SUG hall banner changes colour between M004 and M024 (old vs new session), but the stage is the same.

---

## A16 — Actor-Relative Camera Rigs

These are not world anchors. They attach to the named actor's eye line at runtime and must be built as camera sockets on the rig, not as scene transforms.

| Rig | Used | Specification |
|---|---|---|
| `PLAYER` | M001–M024 (16 missions) | Eye height 1.62 m; pitch limited to ±35°; usable in POV, over-shoulder and top-down. Must not clip through the player's own body or hands. |
| `JEGA` | M008 | Eye height 1.78 m; used for a reverse over-shoulder on the pitch. Track his head turn; do not snap. |
| `MAKER` | M024 | Eye height 1.70 m; used for the final POV on Muhammad. Slightly lower than the player's, to make the Maker feel physically present. |

**Rule:** if an actor-relative rig is missing, the shot falls back to the nearest world anchor and the frame will be wrong. Build all three.

---

## A17 — Anchor hygiene and naming

- Anchors are **lowercase**, `.` only for prop targets, no spaces.
- Actor-relative rigs are **uppercase** and match the cast/subtitle name.
- Never rename an anchor to "fix" a shot; add a new one and leave the old one in place.
- Each anchor needs: position, rotation, focal-length hint, and a one-line purpose in the set's metadata.
- Anchors used in more than one mission (`garden_gate_post`, `pier_mid`, `senate_lawn`) must be validated at every time of day listed in the table.
- Anchor count: **160 world + 3 actor-relative = 163**. If the build has fewer, shots are missing.

---

# PART B — LOOK TARGETS

Look targets are what a camera points at. They are not decoration: if one is missing or misnamed, the shot fires at nothing. There are **119**: 35 world targets, 29 prop targets, 55 cast targets.

## B1 — World look targets (35)

These are places, views or authored states that are not props and not characters. Build each as an aim transform plus a validation render at the listed time of day.

| Target | Missions | What the camera must see | Notes |
|---|---|---|---|
| `campus_core` | M001, M012, M024 | The heart of campus from above: senate roof, twin theatres, clock tower, roads, trees. | Used three times; must read at dawn, blackout night, and convocation night. |
| `twin_theatres` | M001, M005 | The two theatre fronts side by side, signs readable. | GABAS/YAMMA signs swapped in M005. |
| `clock_hands_606` | M001, M002 | The tower clock face, hands at **6:06**, one hand a beat behind. | Animated: minute hand twitches once. Hero clue. |
| `gate_road` | M001 | Approach road through the gate, car small, campus beyond. | Dust and heat shimmer. |
| `crowd_freshers` | M001 | A believable freshers' crowd: gowns, bags, parents, queue. | Crowd type `crowd.freshers`; 40–60 agents. |
| `family_car` | M001 | The family car from outside: dust, roof rack, bag on the back seat. | Vehicle `family_car`; also a prop target. |
| `room_door` | M001 | The hostel-room door from inside, light under it. | Note slot must be visible. |
| `door7` | M002 | A plain door numbered **7** at the end of the basement corridor. | Must look ordinary; number hand-painted. Hero clue. |
| `muhammad_mark` | M002 | A small mark/sigil on a form or wall that Muhammad's thumb covers. | Seen for 1.5 s; must be reproducible. |
| `senate_queue` | M002 | The queue from above/side: rope, stanchions, folded chairs, impatience. | 25–35 agents. |
| `candle_circle` | M003 | A ring of candles on the kitchen floor/table in the blackout. | Warm pool, faces above. |
| `corridor_empty` | M003 | The hostel corridor with no people, one bulb, darkness at the far end. | Must feel long. |
| `corridor_far_end` | M001, M003 | The far window of the corridor, silhouetted. | Same framing both times. |
| `idris_door_light` | M003 | Light under/around Idris's door, radio glow. | Practical source inside. |
| `pitch_centre` | M008, M019 | Centre circle, floodlights, stand, players. | Day/dusk and Cup night variants. |
| `goalmouth` | M009 | The goalmouth from the pitch: net, post, Jega down. | No gore; injury is a twisted ankle. |
| `med_garden_bench` | M009 | The bench outside A&E, car park, ambulance, Maker passing. | Maker in soft focus. |
| `hospital_lights_far` | M006 | Distant hospital lights from the garden at night. | Tiny, cold, far. |
| `locker_row` | M010 | A row of lockers, one open, plug sign inside. | Hero clue. |
| `gabas_steps_empty` | M011 | Theatre steps with no people, a lamp, notes left behind. | Dusk. |
| `lawn_high` | M011, M012 | Campus lawn from above at dusk/night: lamps, paths, blackout grid. | Two lighting states. |
| `senate_steps_top` | M012, M024 | Top of the senate steps looking down: crowd, boulevard, city lights. | Night, two occasions. |
| `boulevard_tree_far` | M012 | A tree down the boulevard, lights failing beyond it. | Power-down sweep. |
| `cliff_stakes` | M015 | The drop from the dam road to the water; stakes, warning sign. | Vertigo without danger. |
| `dam_water` | M015 | Open water to the horizon, haze, pier small. | Sunset silver. |
| `forest_light_far` | M015 | A light moving in the drowned forest across the water. | One warm dot; unexplained. |
| `water_surface_haze` | M016 | The water surface from below/at level, haze, torch glow. | Night, harmattan. |
| `pier_end` | M016 | The pier end from the bank, torchlight, two figures. | Night. |
| `finish_line` | M017 | The chalk finish line, banner, crowd, keke nose. | Day. |
| `keke_back_seat` | M017 | Inside the keke: bench, frame, the road behind. | Vehicle interior. |
| `cinema_screen` | M021 | The cinema screen with an invented film playing. | Moving image, no real footage. |
| `gym_floor` | M014 | Gym floor: mats, scale, mirror, the tax table. | Morning light. |
| `sculpture_lawn` | M020 | The sculpture garden lawn: plinths, pond, arch, mall roof beyond. | Late afternoon. |
| `mall_roof_far` | M020 | The mall roof beyond the garden wall, satellite dish, sky. | Establishes the town edge. |
| `reading_desks` | M023 | Long reading tables under green lamps, students asleep. | Night. |

## B2 — Cast aim targets (55)

Every speaking or visible named character needs an **aim socket** at eye height, plus `head` and `chest` sockets for over-shoulder shots. The table gives the look-target label used in `look:` and the cast key it resolves to. Local labels are context-sensitive and must not be collapsed.

| Look label | Cast key | Missions | Aim note |
|---|---|---|---|
| `MUM` | `npc.mum` | M001 | Hijab; aim at eyes, not face centre. |
| `DAD` | `npc.dad` | M001 | Cap; aim slightly low so eyes read under brim. |
| `PORTER` | `npc.baba_porter` (M001, M003, M022) / `npc.sug_porter` (M010) | M001, M003, M010, M022 | **Context-sensitive.** Two different men. |
| `MUHAMMAD` | `npc.muhammad` | M002, M011, M024 | Tall; chest socket for low shots. |
| `ROOMIE` | `npc.roomie` (resolves `.m`/`.f`) | M001, M003, M006, M007, M012–M016, M022, M023 | Aim height differs by casting (Bature shorter). |
| `GOAT` | `prop.goat_sarki` | M001 | Aim at head; bell at neck. |
| `SUYA` | `npc.suya_man` | M001 | Cap, apron. |
| `SULE` | `npc.malam_sule` | M001 | Hat/scarf; weathered. |
| `ALEEYA` | `npc.aleeya` | M002, M017 | Hijab; taller than average. |
| `CLERK` | `npc.mrs_adebayo` (M002) / `npc.eng_clerk` (M013) | M002, M013 | **Context-sensitive.** Different women. |
| `CLEMENT` | `npc.mr_clement` | M002 | Glasses; aim at eyes. |
| `GARBA` | `npc.garba` | M002, M024 | Short, cap, ledger. |
| `NKECHI` | `npc.mama_nkechi` | M003 | Hijab, apron. |
| `IDRIS` | `npc.idris` | M003 | Hoodie; face half-lit. |
| `RADIO` | `prop.radio` (M003) / `prop.old_transmitter` (M018) | M003, M018 | **Not a person.** Aim at speaker/grille. |
| `NEEDLE` | `npc.needle` | M004 | Glasses, cap, measuring tape. |
| `MUBARAK` | `npc.mubarak` | M004, M010, M012 | Sunglasses; aim at mouth for expression. |
| `LILY` | `npc.lily` | M004, M020 | Camera extra. |
| `LYZZY` | `npc.lyzzy` | M004, M018, M020 | Camera extra. |
| `LAWLEC` | `npc.law_lecturer` | M005 | Glasses, suit. |
| `OKONKWO` | `npc.okonkwo` | M005, M020 | Glasses; senior. |
| `SHAMSU` | `npc.shamsu` | M005, M008, M011, M019, M023, M024 | Glasses, pens, cap. |
| `NUSAIBA` | `npc.nusaiba` | M005, M019 | Hijab, folder. |
| `ABBAS` | `npc.abbas` | M007, M014 | Spanner; overalls. |
| `WEDNESDAY` | `npc.wednesday` | M005, M018 | Brown hair, grey outfit. |
| `SHAYI` | `npc.mai_shayi` | M006, M024 | Cap, kettle, stall. |
| `MAKER` | `npc.maker` | M006, M015, M020, M022, M024 | Labcoat; grey hair; too clean. |
| `TANKO` | `npc.tanko` | M006, M020 | Cap; farmer build. |
| `CATS` | `prop.cats_ring` | M006, M018 | **Not a person.** Aim at the ring/cats. |
| `SLY` | `npc.bolaji` | M007, M012, M014 | Huge; use `width`; aim at chest for low shots. |
| `HASSAN` | `npc.hassan` | M007, M014 | Notebook. |
| `BABY` | `npc.big_baby` | M007, M014 | Hijab, apron. |
| `JEGA` | `npc.jega` | M008, M009, M012, M019, M021 | Jersey 10; actor-relative rig too. |
| `COACH` | `npc.danladi` | M008, M019 | Whistle, cap. |
| `HELEN` | `npc.helen` | M008, M021 | Volleyball; nicknamed "IDK". |
| `ZAINAB` | `npc.zainab` | M009, M019 | **Locked skin `#f1d6c2`**; stethoscope, torch. |
| `HAUWA` | `npc.hauwa` | M009 | Hijab, nurse dress. |
| `LADI` | `npc.hajiya_ladi` | M010 | Hijab, gold trim. |
| `CUSTOMER` | `npc.sophomore` | M010 | Hoodie. |
| `TUNDE` | `npc.tunde` | M011 | Sketchbook. |
| `KHADIJA` | `npc.khadija` | M013 | Notebook; watching. |
| `NGOZI` | `npc.ngozi` | M014 | Gym staff. |
| `BABADAM` | `npc.baba_dam` | M015, M016 | Pier owner; weathered. |
| `LAWAL` | `npc.lawal` | M015 | Fisherman. |
| `EEL` | `prop.eel` | M016 | **Not a person.** Aim at head; practical puppet. |
| `LULA` | `npc.lula` | M017 | Market examiner. |
| `FATY` | `npc.faty` | M017 | Joke book. |
| `EXAMINER` | `npc.examiner` | M017 | Clipboard. |
| `BASIT` | `npc.basit` | M017 | Keke owner; actor-relative rig. |
| `EMEKA` | `npc.emeka` | M017 | Rival driver. |
| `BATURE` | `npc.bature` | M018 | Radio audition; 3 extra lines. |
| `KABIRU` | `npc.kabiru` | M018 | Engineer. |
| `ALIYU` | `npc.aliyu` | M023 | Works van driver. |
| `KELECHI` | `npc.kelechi` | M020 | Student. |
| `COMPANION` | `npc.partner_or_roomie` | M021 | Runtime token; casting depends on player. |
| `DEAN` | `npc.dean_eng` | M024 | Robe. |
| `BOY` | `npc.small_boy` | M019 | Child rig gap; see §K. |
| `CROWD` | `crowd.*` | M004, M012, M013, M024 | Aim at crowd centroid, not an individual. |
| `PLAYER` | player avatar | M003, M004, M005, M007, M008, M011, M013, M016, M018, M024 | Mirror shots; hide hands if first-person. |

Missing from this list but speaking only inside `[IF special.*]`: `JIYA`, `TATY`, `MADISON`. Give each an aim socket anyway; they will be used by conditional shots and by any later approved scene.

---

# PART C — PROPS

**63 prop/state keys.** Of these, **14 are hero clue props** that must survive close-up, and **4 are item-held states** (the same object as an inventory item). Everything else is set dressing or a state swap.

## C1 — Hero clue props (build first, highest fidelity)

| Prop | Missions | What it is | Required states | Close-up requirement |
|---|---|---|---|---|
| `prop.note` | M001, M002, M006, M024 | A folded note, cheap paper, blue ink, one line plus a symbol. | folded / open / pinned / in hand | Readable at 0.4 m; fibre and crease visible. |
| `prop.note_second_line` | M024 | The same note with a second line revealed by heat/light. | hidden / revealed | Reveal must be legible without a text pop-up. |
| `prop.plaques_six` | M020 | Six brass plaques, names and years, one per missing student. | unlit / lit one-by-one / all lit | Engraving readable; tarnish and screw heads. |
| `prop.seventh_space` | M020 | The blank seventh space on the plaque wall: screw holes, clean rectangle. | empty / measured / filled (M024) | Must read as an absence, not a missing texture. |
| `prop.sockets_ten` | M020 | A rusted box with ten sockets, nine live, one dead. | closed / open / one live / all live | Numbers readable; scorch on the dead one. |
| `prop.twine_web` | M020 | Twine strung between neem, fence and plaque wall: a physical diagram. | intact / one strand cut / collapsed | Must be followable in one wide shot. |
| `prop.weathervane` | M012, M024 | Roof cockerel weathervane, bent, with a scrap of cape caught on it. | bare / cape caught / cape removed | Silhouette against sky; cape colour is a clue. |
| `prop.logbook` | M005 | Lab logbook, clothbound, page 40 present, page 41 torn out. | closed / open at 40 / stub at 41 | Page numbers and a margin note readable. |
| `prop.logbook_p40` | M005 | Page 40 as a separate readable state. | — | Handwriting consistent with the note. |
| `prop.logbook_stub_p41` | M005 | The torn stub at page 41. | — | Ragged edge matches the missing page. |
| `prop.slip_page41` | M013 | The missing page 41, folded, in a results-day envelope. | folded / open | Same handwriting; the payoff of M005. |
| `prop.mall_sticker` | M023 | A mall sticker on a phone/kiosk, with a date and a counter number. | stuck / peeled | Adhesive residue; printed, not handwritten. |
| `prop.feeder_label_2` | M023 | A feeder label "2" on a cable, matching the substation. | in place / removed | Small but legible; the clue is the number. |
| `prop.right_boot_first` | M019 | A single right football boot, placed first in the tunnel. | placed / moved | Wear pattern; the joke is the wrong foot. |

## C2 — Story props

| Prop | Missions | Description / states |
|---|---|---|
| `prop.goat_sarki` | M001 | White goat, brass bell, chewed ear. States: loose, on table, in basket, caught. Animated rig. |
| `prop.onion` | M003 | One onion, sprouting. Held, cut, in pot. |
| `prop.gown_huge` | M004 | An oversized matriculation gown on a hanger. Comedy scale, not magic. |
| `prop.camera_screen` | M004 | Photographer's camera back screen with the back-row gap visible. |
| `prop.photo_backrow_gap` | M004 | The printed photo with a gap where a figure should be. | 
| `prop.challenge_note` | M014 | Sly's handwritten challenge/tax table, pinned to the court fence. |
| `prop.clippers` | M014 | Hair clippers, silent, on the bench. The threat is social. |
| `prop.zobo_max` | M014 | A bottle of Zobo Max (invented drink). Also `item.zobo_max`. |
| `prop.lucky_socks` | M019 | Mismatched lucky socks, one inside out. |
| `prop.team_photo` | M019 | Team photo with eleven players and a twelfth pair of shoes. |
| `prop.team_photo_twelfth_shoes` | M019 | The detail state of the same photo. |
| `prop.armband` | M019 | Captain's armband, worn, no logo. |
| `prop.bib` | M008 | Training bib, number 10, safety pins. |
| `prop.joke_book` | M017 | A battered joke book Lula reads from. |
| `prop.keke_wheel` | M017 | A removed keke wheel, greasy. |
| `prop.gold_exhaust` | M017 | A ridiculous gold exhaust fitted to a keke. |
| `prop.timetable_red_circles` | M011 | Exam timetable with red circles, one date circled twice. |
| `prop.sketch_y1` | M011 | Tunde's sketch of the figure from the note. |
| `prop.blue_pen` | M011 | A cheap blue pen, same ink as the note. |
| `prop.everybody_list` | M022 | The porter's list of every student and where they are. |
| `prop.garden_gate_ajar` | M022 | The garden gate standing ajar, chain hanging. |
| `prop.phone_ringing` | M013 | A phone ringing on a desk, screen lit. |
| `prop.phone_text` | M023 | A phone with a text from an unknown number. |
| `prop.phone_news` | M018 | A phone playing/news item about the blackout. |
| `prop.phone_lines_lit` | M018 | Studio phone bank with lines lit. |
| `prop.on_air_sign_lit` | M018 | Physical "ON AIR" bulb sign, lit. |
| `prop.studio_clock_1806` | M018 | Studio clock at **18:06**. |
| `prop.cats_ring` | M006 | A ring of cats sitting on the garden wall. Practical/animatronic; no harm. |
| `prop.cats_ring_inward` | M018 | The same cats, all facing inward at the radio mast. |
| `prop.statue_fish_girl` | M006 | Weathered fish-girl statue, one finger missing. |
| `prop.statue_fish_girl_turned` | M006 | The statue rotated to face the pond. |
| `prop.relay_core` | M016, M020 | Cylinder core, cyan glow, wet, heavy. Also `item.relay_core`. |
| `prop.torch_in_hand` | M012 | Torch beam cone in hand; state, not a separate model. |
| `prop.towel` | M016 | A cheap towel, wet. |
| `prop.wet_footprints` | M016 | Footprints leading to the water, not back. |
| `prop.wet_footprints_end` | M016 | The same prints, older, at the pier foot. |
| `prop.plug_sign` | M010 | Hand-painted "THE PLUG" sign inside the locker. |
| `prop.turbo_sneakers` | M010 | Absurd chunky sneakers. Also `item.turbo_sneakers`. |
| `prop.glass_dam_water` | M015 | A glass of dam water, held up to the light. |
| `prop.lantern` | M024 | A paper lantern on a wire, warm. |
| `prop.count_entropy` | M012 | The Count's tally board/screen: entropy rising. |
| `prop.count_entropy_tall` | M024 | The same board, taller, final count. |
| `prop.cape_scrap` | M012 | A scrap of cape/cloth caught on the weathervane. |
| `prop.seal_engineering` | M024 | The Engineering seal, wax/brass, used to stamp the new plaque. Also item. |
| `prop.mattress_in_library` | M023 | A mattress on the library floor, blanket, flask. |
| `prop.glucose_and_note` | M023 | Glucose sachet and a handwritten note on a desk. |
| `prop.neem_thin` | M021 | The thin neem trunk at the Kadanya gate. |

## C3 — Kit pieces (not prop keys)

Everything named in Part A's set dressing — pots, benches, desks, buckets, books, chairs, mattresses, ladders, bins, mops — is a **kit piece**. It is instanced per set, has no save key, and may be swapped for a similar object without breaking a mission.

The only exceptions are objects that a mission **shows, hides, moves, holds or collects**. Those are listed in C1/C2 and must keep their exact IDs.

**Rule:** if you find yourself wanting a new `prop.*` key, first check whether the object is already a kit piece. If it is, dress it; do not invent a key.

---

# PART D — WARDROBE OVERLAYS

Base looks come from `cast.ts`. These are the **14 overlays** that change per scene. Overlays must not alter skin, hair or body scale.

| # | Overlay | Who | Missions | Specification |
|---|---|---|---|---|
| 1 | Matriculation gown | Player, Mubarak, freshers | M004 | Cheap black polyester, open front, cap with tassel; oversized on the player for comedy. |
| 2 | Photographer's vest | Lyzzy, Lily | M004 | Khaki vest, press card (invented), camera strap. |
| 3 | Tailor's measuring tape | Alhaji Needle | M004 | Tape around neck, pins on lapel, chalk. |
| 4 | Football kit (training) | Jega, Shamsu, players | M008 | Green/white jersey 10, shorts, socks; bibs for subs; boots. |
| 5 | Goalkeeper gloves | Player/Jega | M008, M019 | Cheap gloves, too large. |
| 6 | Lab coat | Maker, Abbas, Wednesday | M005, M006, M015, M020, M022, M024 | Off-white, pen pocket, name unreadable. |
| 7 | Gym kit | Player, Hassan, NGOZI | M014 | Plain t-shirt, shorts, towel; no logos. |
| 8 | Referee/coach kit | Coach Danladi | M008, M019 | Red polo, dark shorts, whistle, cap. |
| 9 | Swimming trunks | Player, Jega, Muhammad | M015, M016 | Modest knee-length; towel; no bare torsos in wide shots. |
| 10 | Team kit (Cup final) | Jega, team, Shamsu | M019 | Full kit, numbers, captain's armband; boots (right boot joke). |
| 11 | Radio station shirt | Bature | M018 | Plain station t-shirt (invented logo), headphones. |
| 12 | Works overalls | Aliyu, works crew | M023 | Navy overalls, reflective strips, tool belt, torch. |
| 13 | Convocation robe | Dean, seniors, Maker | M024 | Academic robe, hood; Dean's is richer; Maker's is plain and wrong for the occasion. |
| 14 | Traditional finery | Mum, Dad, Garba, Shayi | M024 | Modest lace/kaftan in family colours; no real brands. |

**Rules:** no overlay may hide the face; no high heels on grass; no white shoes in the market; every overlay must survive a 360° turn and a sit animation. The player's gown is deliberately too big in M004 and fits by M024 (tailor callback).

---

# PART E — VFX

13 authored effects, plus 4 systemic weather layers. All are practical-looking; no glossy game VFX.

| FX id | Missions | What it does | Trigger / duration |
|---|---|---|---|
| `flicker` | M001 | Corridor light stutters as the family arrives. | 0.8 s, twice. |
| `shade_drift` | M003, M012 | Darkness moves across a wall as if something passes. | 2 s, no source. |
| `dust` | M004, M013, M016 | Dust motes in a shaft / on a road. | Continuous, density by lighting. |
| `big_shadow` | M007 | Sly's shadow crosses the court before he does. | 1.5 s. |
| `blackout_rows` | M012 | Campus windows go dark in a wave. | 4 s, direction-specific. |
| `torch_bloom` | M012, M024 | Torch/lantern bloom in humid air. | Continuous while held. |
| `shade_gather` | M012, M024 | Darkness thickens at the edge of the light. | 3 s, subtle. |
| `bulb_string_on` | M012 | Bulb string lights up segment by segment. | 2 s. |
| `torch_click_on` | M015 | Torch clicks on; cone snaps into dust. | 0.3 s. |
| `hand_reach` | M016 | A hand reaches through silt toward the core. | 2 s, underwater. |
| `plaques_light_six` | M020 | Six plaques light one by one. | 6 s, one per second. |
| `boulevard_bulbs_on` | M024 | Boulevard bulbs come on in a wave. | 5 s. |
| `prosperity_wave_1` | M024 | A warm wave passes through the crowd/strings at the end. | 3 s, one-shot. |

**Weather layers (systemic, 4):** `harmattan_haze` (M012–M024, distance desaturation), `heat_shimmer` (M001–M011, day exteriors), `dust_motes` (interiors with shafts), `water_caustics` (M015–M016, underwater and pier undersides). These are set dressing, not `fx.play` calls.

**Hard rules:** the hum is never a visible effect; the blackout is never a particle; the core glow is a light, not a lens flare; nothing sparkles except water.

---

# PART F — SOUND & MUSIC

## F1 — SFX (43)

| Cue | Missions | Description |
|---|---|---|
| `cock_crow_wrong_time` | M001 | A rooster at the wrong hour; slightly flat. |
| `clock_strike_single_far` | M001 | One distant tower strike, not six. |
| `goat_bell_fast` | M001 | Brass bell, rapid, comic. |
| `rubber_stamp` | M002 | Heavy stamp on a form. |
| `book_shut` | M005 | A heavy logbook closed. |
| `knuckle_crack` | M007 | Sly cracks his knuckles. |
| `hostel_groan_wave` | M003 | Building pipes/wood groan in the blackout. |
| `radio_static` | M003 | Radio between stations. |
| `three_notes` | M003, M018 | Three notes on a cheap keyboard; the station's ident. |
| `power_down_whine` | M003, M009, M011, M018 | Electrical whine falling. |
| `kettle_boil` | M006 | Kettle rising in the garden. |
| `bench_creak` | M014 | Bench under Sly. |
| `locker_creak_grand` | M010 | A locker door opened slowly for drama. |
| `locker_slam` | M010 | The same door, slammed. |
| `keys_jingle_stairs` | M010 | Keys on a belt, stairs. |
| `generator_start` | M012 | Generator catches, then settles. |
| `power_up_surge` | M012 | Power returns with a surge. |
| `ball_miss_whoosh` | M008 | A shot missed entirely. |
| `goalpost_clang` | M009 | Ball off the post. |
| `crossbar_bell` | M019 | Ball off the crossbar, bell-like. |
| `stadium_drums` | M019 | Crowd drums, competitive. |
| `splash_big` | M015 | A body entering water. |
| `plank_long_creak` | M015 | Pier plank under weight. |
| `heartbeat_underwater` | M016 | Muffled heartbeat, slow. |
| `coil_hum_low` | M006 | The garden hum, 50 Hz, with a beat. |
| `coil_hum_thin` | M018 | The same hum through a radio/mast, thinner. |
| `coil_hum_underwater` | M016 | The hum through water, huge. |
| `coil_in_tune` | M024 | The hum resolving into a clean chord. |
| `core_click` | M020 | The core seating into the plinth. |
| `gate_latch_old` | M020 | Old gate latch, worn. |
| `bank_alert` | M013 | ATM alert beep. |
| `pin_push` | M013 | A pin into a noticeboard. |
| `polite_stampede` | M013 | Many students moving fast but apologising. |
| `phone_ring_dread` | M013 | A phone ring with too few rings. |
| `phone_buzz_night` | M023 | Phone vibrating on a desk at night. |
| `can_open_phone` | M018 | A can opening next to a live mic. |
| `fader_slam` | M018 | Fader slammed down; feedback cut. |
| `projector_whirr` | M021 | Projector running. |
| `scale_announce_beep` | M014 | Gym scale beeps a verdict. |
| `rubber_band_snap` | M017 | Rubber band/engine mount snapping. |
| `wheel_pop` | M017 | Keke wheel letting go. |
| `wind_gust` | M004 | Gown/canopy gust. |
| `dark_quiet` | M003 | Not silence: room tone dropping out. (Music cue; see F2.) |

## F2 — Music cues (13)

| Cue | Missions | Function | Palette |
|---|---|---|---|
| `main_theme_dawn` | M001 | Opening; hope, size, humour. | Highlife guitar, strings, soft percussion. |
| `queue_theme` | M002 | Bureaucratic comedy. | Marimba, woodblock, bassoon. |
| `dark_quiet` | M003 | Blackout; remove music, keep room tone. | Near-silence, one low pad. |
| `anthem_brass` | M004 | Matriculation, pomp, wrong-key. | Brass band, slightly flat. |
| `mystery_thread` | M005–M024 (12 missions) | The clue theme; never resolves. | Solo kora, reversed piano, low hum. |
| `plug_theme` | M010 | Mubarak's hustle. | 808, hand percussion, cheeky flute. |
| `count_theme` | M012, M024 | The Count; mechanical dread. | Ticking, detuned strings, choir. |
| `dam_theme` | M015 | Scale and loss. | Low strings, waterphone, voice. |
| `stadium_drums` | M019 | Cup final. | Talking drums, crowd, brass. |
| `exam_tension` | M023 | Exam fever. | Clock, pizzicato, breath. |
| `convocation_brass` | M024 | Ceremony, warm. | Full brass, choir, drums. |
| `main_theme_full` | M024 | Year-end; the theme completes. | Full orchestra + highlife band. |
| `all` | M001 | Stop-all token (not a cue). | — |

**Rules:** no music under the note reveal or the core retrieval; `mystery_thread` never plays to a cadence; diegetic music (radio, cinema, market) must be separate stems and duckable.

---

# PART G — LIGHTING PRESETS (7)

| Preset | Used | Specification |
|---|---|---|
| `dawn` | M001 | 3200 K low sun, long shadows, mist, 30% desaturation. |
| `day` | M001–M011 exteriors | 5600 K hard sun, deep shade, warm bounce from laterite. |
| `dusk` | M004, M008, M011, M017 | 3800 K, amber, shadows lengthening; practicals starting. |
| `night` | M003, M006, M009, M012, M013, M015, M016, M018, M019, M021, M023, M024 | Sodium 2200 K pools, 60% darkness, cool moon rim. |
| `blackout` | M003, M012 | No practicals; moon + candle/torch only; faces 1 stop under. |
| `fluorescent` | M009, M023 | 4300 K green-white, flat, no shadow. |
| `underwater` | M016 | Green-blue 7000 K, caustics, 4 m visibility, torch warm. |

**Rules:** skin must stay in the fair-to-caramel range under every preset; never colour-grade Zainab darker; the blackout must still show eyes; the dam night must still show the far bank; practicals must have visible sources.

---

# PART H — ANIMATION

## H1 — Authored tokens (16)

| Token | Missions | Use |
|---|---|---|
| `stand` | M007, M019, M021 | Idle with weight shift; not frozen. |
| `sit` | M002, M003, M005, M006, M009, M014, M019, M021 | Chair, bench, floor, desk; must work with all seats. |
| `walk` | — | Locomotion; 1.2–1.4 m/s. |
| `run` | — | Locomotion; 3 m/s; used in the goat chase and race. |
| `wave` | M009, M021 | Short, friendly, not royal. |
| `point` | M001, M008 | Index finger; comedy exaggeration allowed. |
| `nod` | M010, M014 | Two speeds: agreement, dismissal. |
| `shock` | M004, M005, M007, M008, M010, M014, M016–M019, M024 | Eyes wide, hands up, no scream. |
| `laugh` | M001, M005, M008, M009, M015, M019 | Real laugh, head back; not a loop. |
| `eat` | M001, M003 | Jollof, spoon, talking with mouth full. |
| `write` | M002, M008, M010, M011, M017, M022 | Pen on paper; readable motion. |
| `phone` | M003, M009, M013 | Hold, scroll, answer; no real UI. |
| `hug` | M001 | Family hug; awkward, warm. |
| `kneel` | M001, M008, M015, M016, M019 | Pick up, pray, reach water; knee contact. |
| `carry` | M001, M015 | Bag on head/shoulder; weight in the spine. |
| `gesture` | M001, M003–M005, M007, M010, M012, M019–M021, M024 | Talking with hands; the default conversational layer. |
| `cheer` | M012, M019 | Arms up, jump optional. |
| `sleep` | M023 | Seated/desk sleep; no snoring animation. |

## H2 — Loops and systemic states (6)

`idle_breath` (all), `crowd_idle` (4 variants), `walk_talk` (dialogue while moving), `sit_shift` (long scenes), `read` (library/noticeboard), `work_bench` (lab/stall). Loops must not pop at 0/100%.

**Rules:** no dance loops in Year 1; no romantic couple animations; no combat; the goat has its own 6-state rig (stand, trot, bolt, eat, headbutt, be carried).

---

# PART I — CROWDS & VEHICLES

## I1 — Crowd types (4)

| Type | Used | Size | Behaviour |
|---|---|---|---|
| `crowd.freshers` | M001, M002, M004 | 40–60 | Queuing, photo poses, parents, luggage; slow. |
| `crowd.students` | M005, M011, M012, M013, M023, M024 | 15–30 | Walking with purpose, phones, books; ignores the player. |
| `crowd.fans` | M019 | 80–120 | Stand singing, drums, waves; reacts to goals. |
| `crowd.families` | M024 | 30–50 | Robes, photos, children, lanterns; slow, warm. |

Crowd agents must use the same scale and modest dress; no duplicates in the front row; no real team colours.

## I2 — Vehicles (5)

| Vehicle | Missions | Specification |
|---|---|---|
| `family_car` | M001 | Dusty saloon, roof rack, faded paint, one working window. |
| `keke_test` | M017 | Three-wheeler, yellow/black, test livery, roll cage. |
| `keke_aleeya` | M017 | Aleeya's keke, green, one sticker, better tyres. |
| `works_van` | M023 | White panel van, ladders, cable drum, works logo (invented). |
| `bicycle` | M001 | Borrowed bicycle, no lock, basket big enough for a goat. |

**Rules:** all vehicles are right-hand drive; keke seats three plus driver; no real plates; the bicycle bell works.

---

# PART J — ITEMS & TOOLS

## J1 — Persistent items (29)

These survive scene changes and appear in the inventory/save. `item.*` names are exact in steps (`collect(item.kola_vigour)`); `endState` inventory blocks drop the prefix (`kola_vigour`). Both refer to the same object — do not create two items.

| Item | First | Last | Use |
|---|---|---|---|
| `item.kola_vigour` | M001 | M024 | The tin's kola; a keepsake, eaten or kept. |
| `item.plate_jollof` | M001 | M001 | Two plates; one for the Roomie. |
| `item.passport_x4` | M002 | M002 | Four passport photos; bureaucracy. |
| `item.gown` | M004 | M024 | Matriculation gown; too big, then altered. |
| `item.belt` | M004 | M004 | Belt for the gown. |
| `item.safety_pins` | M004 | M004 | Pins; comedy. |
| `item.fuse_13a` | M005 | M005 | 13A fuse; the lab fix. |
| `item.jollof_kit` | M003 | M003 | Midnight jollof ingredients. |
| `item.sugar` | M003 | M003 | Sugar; borrowed, never returned. |
| `item.plate_protein` | M014 | M014 | Post-gym protein plate. |
| `item.zobo_max` | M010, M014 | M014 | Zobo Max bottle; also a prop. |
| `item.lucky_kola` | M010 | M010 | A "lucky" kola nut from Mubarak. |
| `item.turbo_sneakers` | M010 | M010 | Comedy sneakers; speed joke. |
| `item.battery` | M010 | M010 | Battery for the plug's sign. |
| `item.crate_stock` | M010 | M010 | One crate of stock. |
| `item.crate_stock_2` | M010 | M010 | Second crate; the heavier one. |
| `item.old_paper` | M011 | M011 | Old exam paper; Tunde's sketch surface. |
| `item.record_highlife` | M018 | M018 | Highlife record for the radio. |
| `item.torch` | M012 | M016 | Torch; battery drains across missions. |
| `item.generator` | M012 | M012 | Portable generator; heavy, loud. |
| `item.relay_core` | M016, M020 | M024 | The core; carried, installed, stamped. |
| `item.iron_lungs_gum` | M016 | M016 | Gum; underwater breath joke. |
| `item.plank` | M015 | M015 | Pier repair plank. |
| `item.sand` | M015 | M015 | Sand for grip. |
| `item.cement` | M015 | M015 | Cement for the pier post. |
| `item.rule_14c` | M019 | M019 | The rulebook page that wins the Cup. |
| `item.gift_any` | M021 | M021 | A generic gift for Helen; player choice. |
| `item.coil_switch` | M024 | M024 | The switch that tunes the core. |
| `item.seal_engineering` | M024 | M024 | The Engineering seal; stamps the plaque. |

## J2 — Step-only tools (21)

Used inside a mission step, not kept. Names are step verbs, not inventory keys: `bicycle`, `bucket`, `mop`, `ladder`, `handcart`, `trolley`, `wheelbarrow`, `spanner`, `screwdriver`, `pliers`, `test_lamp`, `multimeter`, `clipboard`, `pen`, `stamp`, `keys`, `whistle`, `pump`, `hose`, `rope`, `torch` (when borrowed, not the persistent one).

**Rule:** if a step says "use the mop", the mop must exist in the set; it does not need an inventory icon.

---

# PART K — GAPS, RISKS & EXPLICIT NON-CANON

| Gap | Risk | Decision |
|---|---|---|
| **Child rig** for `npc.small_boy` (M019) | Reusing adult rig reads wrong | Build one child rig at 1.25 m; same scale family. `PROPOSED`. |
| **Beard mesh** for Baba Dam / Sule | Beards read as masks | Use fibre cards, not sculpted mesh; keep short. `PROPOSED`. |
| **Headphones mesh** for Bature/radio | None in base pack | Small prop mesh, over-ear, no brand. `PROPOSED`. |
| **Goat rig** | Comedy timing depends on it | 6-state rig, bell physics, no ragdoll. `CANON` (character), rig `PROPOSED`. |
| **Cat ring** | Real cats are a welfare/anim issue | Practical animatronic heads + tails, or locked-off silhouettes; never CGI-photoreal. `PROPOSED`. |
| **Eel** | Horror tone | Practical head on a pole, one appearance, no attack. `CANON` beat, method `PROPOSED`. |
| **Crowd scale** | 120 agents at Cup final | Use 60 unique + instanced back rows; never let duplicates share a front row. |
| **Underwater set** | Whole mission M016 | Build a bounded underwater volume with a fake surface; no full-fluid sim. |
| **Rain** | Not in Year 1 | Do not add rain for mood. `LOCKED`. |
| **Special characters' looks** | Jiya/Taty/Madison are conditional only | Use placeholder looks from `cast.ts`; never present them as default cast or in marketing. `LOCKED`. |
| **Legacy "very dark" descriptions** | Conflict with project rule | Follow `cast.ts` palette. Do not darken any character. `LOCKED`. |
| **"Kaltume"** | Renamed | She is **Helen** (`npc.helen`). Any asset named Kaltume is obsolete. `ALIAS`. |
| **Zainab's skin** | Locked | `#f1d6c2`, test-enforced. Never "fix" in lighting. `LOCKED`. |

---

# PART L — BUILD ORDER & ACCEPTANCE

## L1 — Build order (dependency-safe)

1. **Scale kit** — one door, bed, desk, chair, counter, vehicle seat; validate against every cast height.
2. **Cluster A01 + A02** — gate, ring road, hostel room/corridor. These carry M001 and the most screen time.
3. **Hero props C1** — note, tin, logbook, plaques, sockets, twine, weathervane, sticker, feeder label, boot.
4. **Clusters A05, A07, A08** — admin, theatres, garden/lab. The clue spine.
5. **Clusters A10, A12** — sport and dam. The two biggest set pieces.
6. **Clusters A03, A04, A06, A09, A11, A13, A14, A15** — the remaining social/utility sets.
7. **Wardrobe overlays, crowds, vehicles.**
8. **VFX, audio, music, lighting presets, animation.**
9. **Items and save keys.**
10. **Full anchor sweep** — every `from:` in `Y1.md` resolves; every `look:` resolves.

## L2 — Acceptance tests

- [ ] All **160 world anchors** + **3 actor rigs** exist with exact names.
- [ ] All **35 world look targets** resolve at every listed mission/time.
- [ ] All **55 cast aim sockets** exist; local labels (`PORTER`, `CLERK`, `RADIO`) resolve by mission context.
- [ ] All **63 prop/state keys** exist; the 14 hero props pass a 0.4 m close-up.
- [ ] All **14 wardrobe overlays** survive walk, sit, run, hug and 360° turn.
- [ ] All **13 FX** + **4 weather layers** fire at the written times.
- [ ] All **43 SFX** and **13 music cues** exist; `mystery_thread` never resolves.
- [ ] All **7 lighting presets** keep skin in palette and faces readable.
- [ ] All **16 animation tokens** + **6 loops** are in the rig; no T-pose in any cutscene.
- [ ] All **4 crowd types** and **5 vehicles** are placed and scaled.
- [ ] All **29 persistent items** and **21 tools** exist; no item is required before it is obtainable.
- [ ] Zainab's skin is `#f1d6c2` in every lighting preset.
- [ ] No rain, no gore, no weapons, no real brands, no romance/marketing use of specials.
- [ ] Every set reads in three seconds at its establishing anchor, day and night.

## L3 — What not to build

- No interiors for locations never entered (the town, the dam far bank, the mall interior).
- No crowd simulation for the whole campus; only the four listed crowd pockets.
- No vehicles beyond the five listed.
- No props that exist only in a line of dialogue and are never seen or used.
- No photoreal humans, no realistic child, no realistic animal harm.
- No extra named characters. If a scene needs a face, use `crowd.*` or an existing cast member.

---

*End of 05. Character bodies and voices: `01_CHARACTER_BIBLE.md`. Shots and timings: `04_CUTSCENE_TECHNICAL_SPEC.md`. Story meaning: `02_YEAR1_STORY.md`. Execution contract: `06_BUILD_BRIEF_FOR_CLAUDE.md`. Flow and state: `07_FLOW_AND_CONTINUITY.md`.*
