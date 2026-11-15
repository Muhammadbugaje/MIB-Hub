# ASSET AND MOTION PLAN

**For:** whoever builds the new 3D game ({{GAME_NAME}} at {{UNI_NAME}}, {{TOWN}}): the asset and character pipeline, animation, physics, game feel and audio, from the engine bake-off to the vertical slice.
**Status:** plan only. Written 15 Nov 2026. Nothing has been downloaded or installed for it.
**Builds on:** `MASTER_GAME_GUIDE_V3.md` (stages, budgets; it wins over v2), `GAME_DESIGN_V1.md` (systems, first 10 minutes), `STORY_BIBLE_V2.md` (scuffle rule), `missions/FORMAT.md` (cutscene anims), `READ-CLAUDE.md` §4 steps 5–7 and §6.
**Learns from:** the old game's own records in `docs/legacy/` (KNOWN_ISSUES, FSLG_REVIEW, AUDIT, STATE, FABLE, SOUND, OFFLINE, MASTER_GAME_GUIDE). Section 1 turns every problem in them into a rule.

How to read it: §1 is the list of rules. §2–§6 are the specs. §7 is the order of work. Every number here is a starting value. Tune it by feel in the slice, then write the tuned value back into this file and into `packages/config`.

Short names used below: **KI** = `docs/legacy/KNOWN_ISSUES.md`, **REV** = `FSLG_REVIEW.md`, **AUD** = `AUDIT.md`, **ST** = `STATE.md`, **FAB** = `FABLE.md`, **SND** = `SOUND.md`, **OFF** = `OFFLINE.md`, **MGG1** = `docs/legacy/MASTER_GAME_GUIDE.md`, **V2/V3** = master guides v2/v3, **GDD** = `GAME_DESIGN_V1.md`, **RC** = `READ-CLAUDE.md`, **MEM** = the owner's taste notes (the coordinator's memory: look and feel in the first minute; rich scenery and music; top-down and the "desert" look rejected; console-grade smoothness).

---

## 0. Decisions this plan makes (owner may overrule)

| # | Decision | Why |
|---|---|---|
| D1 | **Look: soft-lit stylised PBR, no ink outlines.** Cartoon shapes, PBR materials with a high roughness floor, warm sun, HDRI ambient, baked AO. | The owner liked the lighting and shadow pass (MEM) and the Babylon prototype (`visual_prototype/`). Outlines need an extra pass on phones and push the look towards anime. |
| D2 | **Characters: our own two base meshes (male, female) built in Blender from a CC0 base**, on one Mixamo-compatible skeleton. VRoid is used for reference only. Leads can be commissioned later on the same rig. | We own and control every vertex: noses, hair cards, morphs. VRoid is anime-shaped, uses a toon shader (MToon) and many spring bones (§3.1). |
| D3 | **Animation: keyframed library clips (Mixamo + CC0) retargeted to one rig, plus blend trees and IK.** No procedural sine walk cycles. No motion matching. | The old procedural cycles slid and looked stiff (FAB §1, MGG1 §10.2). Motion matching costs too much memory and CPU on a ₦60,000 phone (§4.4). |
| D4 | **Physics: Rapier (WASM) in both bake-off builds**, own arcade raycast vehicles, own kinematic character controller. Havok is tested as an option in the Babylon build only. | Using the same physics in both builds keeps the renderer comparison fair. The vehicles and the character have to *feel* arcade, so we write those ourselves anyway. |
| D5 | **Fixed 60 Hz simulation with interpolated rendering**, on every platform. | The old ram damage depended on frame rate (REV 4.1). |
| D6 | **Formats:** GLB + Meshopt geometry + KTX2 (Basis: ETC1S for colour, UASTC for normals and hero textures); Opus `.ogg` + AAC `.m4a` audio. | V2 §20.7, V3 §11.4, SND. |
| D7 | **First playable download under 15 MB** (V3 §4). Then stream by district pack. | V3 wins over V2's 20–30 MB. |

---

## 1. "Never again": every old mistake, and the rule that stops it

Each row is one distinct problem found in the old game's docs. The **Rule / test** column says what the new build does instead, and the check that fails if it comes back. Tests are named so the team can grep for them. "Validator" means the data validator, "bot" the replay or monkey bot, "asset lint" the asset build checker (§2.9), and "feel suite" the scripted feel tests (§5.10).

### 1.1 Rendering and look

| # | Old problem | Source | Rule / test in the new build |
|---|---|---|---|
| R1 | A top-down 2.5D build was rejected ("no one plays such games anymore") | MEM | Third-person 3D only. A 2D view exists only as a no-WebGL fallback page. |
| R2 | The 3D pass on the real street map looked like a **desert** | MEM | Palette rule §2.3. `look_not_desert`: at 8 fixed camera spots in rainy season, the share of pixels in the dry tan or orange hue band must be ≤ 35%, and green vegetation ≥ 20%. It runs on screenshots from `scripts/screenshot.py`. Every street gets shade trees at most 15 m apart. |
| R3 | Blocky jointed characters with stick limbs | V3 §5, GDD §13.1 | Skinned meshes on one skeleton (§3). No character is built from primitive shapes in game code. Asset lint fails any human GLB without a skin. |
| R4 | The game name was hard-coded in 3D signs, the HUD, the bus livery and the save key | AUD §8, KI-019 | Every sign is a **sign slot** (`signSlots` data) drawn from config tokens. Validator `HARDCODED_NAME` scans the code, GLB texture names and baked text atlases. No baked text that names the game or the university. |
| R5 | An "odd purple figure" in the freshers shots | FAB §6A | Asset lint fails any GLB with a missing texture or the engine's default material. Debug builds draw missing materials loud magenta. Release builds fail the build instead. |
| R6 | Pop-in of distant things | MGG1 §9, §12.4 | Every LOD switch uses a dithered cross-fade (0.25 s) or happens beyond fog distance. Stream-in happens beyond the view range (§2.8). `no_pop` test: a camera fly-through records each LOD or stream event with its screen-space size. Any event over 2% of the screen fails. |
| R7 | Mixed art styles across assets | V2 §20.6 | Style guide §2.3, plus the **re-skin pass**: no store asset ships with its original materials. Asset lint checks each material's colours against the palette and its roughness and metallic ranges. |
| R8 | A real university crest exists in the old static images | RC §5 | Asset lint keeps a denylist hash of that crest image. No real logos or brand names on props: fictional brands only (GDD §3.3). |
| R9 | Real people's photos near the repo | RC §5, CLAUDE.md | Likeness work keeps only **morph values** in the repo (§3.6). Asset lint and a pre-commit hook reject any `.jpg/.png` under `assets/` larger than 64 KB that is not in the credits file. |

### 1.2 Characters

| # | Old problem | Source | Rule / test |
|---|---|---|---|
| C1 | Noses built from primitive shapes never looked natural | RC §6 | The nose is sculpted into the base mesh, with nose morphs held to safe ranges (§3.3). Close-up turntable renders at 0°/45°/90° go to the owner before any character is approved. |
| C2 | Hair made of ribbons with a shiny material looked like glass or plastic | RC §6 | Hair cards or painted shells (§3.4). Material lint on any `hair_*` or `hijab_*` material: roughness ≥ 0.55, metallic = 0, clearcoat off, specular ≤ 0.35. |
| C3 | Feet and legs poked through trousers and skirts when running | MGG1 §1.2, §11.1; FAB §6D | Clothes are skinned to the same rig and carry the same body morphs. Hidden body parts are deleted under opaque clothes, using **body-part masks** (§3.5). `cloth_clip_matrix` test covers every outfit × 5 body shapes × 12 key poses. |
| C4 | The seated player was invisible, and cars had no seats | MGG1 §1.2 | Every vehicle has seat sockets and a drawn interior (§2.6). `seated_visible` test: in each seat of each vehicle, at least 60% of the head and torso is visible from the default camera. |
| C5 | Heads went through car roofs | MGG1 §1.2, FAB §1 | Head-clearance rule from V3 §5: seat height + seated torso + head + 3 cm < roof height. It runs for every seat × every body shape × the tallest hairstyle or headwear. |
| C6 | The okada with 3 riders looked crowded; named NPCs were drawn at 1.12× scale | FAB §7 | **One scale for all humans.** Height varies only through a morph, within ±6%. No per-NPC uniform scale. Seat-fit tests run at the extremes. |
| C7 | Test pages showed dark skin while the real default player is light-skinned | FAB §1 | Default look comes from config (`player.defaultLook`). Every capture and test scene loads it. Zainab's skin tone is locked in her character sheet (very fair); validator `LOCKED_SKIN`. |
| C8 | The wrong roommate appeared in the room | FAB §1 | Cast and spawn are data-driven, with one spawner (§1.10 X3). The bot checks the room's occupants. |
| C9 | Body change risked clipping clothes | V3 §2.2 | Clothes carry the body morphs (transferred in Blender). Covered by the `cloth_clip_matrix` test. |

### 1.3 Animation

| # | Old problem | Source | Rule / test |
|---|---|---|---|
| A1 | People slid "like snakes" | FAB §1 | Locomotion is in place, and its play rate comes from **stride matching** (§4.3). `foot_slide` test: while a foot is planted it may drift ≤ 2 cm per step, for every gait and every NPC LOD that has feet. |
| A2 | Procedural sine walk and run cycles | MGG1 §10.2 | Keyframed clips plus blend trees. The old "procedural first" rule is reversed. Procedural motion is allowed only for secondary motion (breathing, spring bones, IK). |
| A3 | Cycle speed did not match ground speed on bicycles | FAB §6D | Pedal and wheel phase come from distance travelled (§4.5). The `foot_slide` test also runs on the pedals. |
| A4 | The porter and Dad walked through each other | FAB §6A | Cutscene paths go through the same avoidance as gameplay. `cutscene_overlap` test: no two actor capsules overlap by more than 5 cm in any frame of any cutscene. |
| A5 | The hug was not a real hug; arms didn't wrap round | FAB §6A | **Paired animations** with an alignment root (§4.6). Both actors are placed on the pair's sockets before the clip starts, and hand IK targets the partner's back bones. |
| A6 | Hands drifted off the steering wheel | FAB §6D | Two-hand IK to wheel grip sockets every frame, ≤ 1 cm error (the old target was 2.4 cm). The same applies to handlebars and okada grips. |
| A7 | Missing clips: hug, carry bags, handshake, clap, throw cap, wave from a car, lie in bed | AUD §10.4 | Full clip list §4.1. Validator `ANIM_EXISTS` checks every `actor.anim` name in the mission files against the clip registry. |
| A8 | Skipping a cutscene did not reach the same end state; a skip flag was set before Skip was pressed | FAB §6A, KI-023 | Every clip can be forced to its end pose. Every cutscene declares `endState`, `maxDuration` and `skippable`. `skip_equals_watch` test compares the world snapshot after skip with the snapshot after watching. |
| A9 | Snapping and popping between states | FAB §8 | Blend times §4.2 (100–200 ms; 50–80 ms in fights). `pose_pop` test: no bone may rotate more than 35° between two rendered frames, except during a declared cut. |
| A10 | Animation polish was done in the old renderer and then thrown away | V3 §3, §5 | Animation is tuned only on the chosen engine, after the bake-off, in this order: rig, then clips, then blend trees (§7). |

### 1.4 Controls and camera

| # | Old problem | Source | Rule / test |
|---|---|---|---|
| K1 | The camera clipped into walls | FAB §8 | Spring-arm sphere-cast (§5.3). `camera_clip` test: on a scripted path through every slice interior and alley, the near plane never ends up inside geometry. |
| K2 | E talked to the first person within 3 m, and a parked bike beat the person you needed | KI-013 | One `InteractionTargeter`: the current step's target first, then people over vehicles, then the nearest by facing angle. The prompt shows *who* or *what* it will act on. The bot checks this on every talk step. |
| K3 | No lock-on and no dodge window in fights | REV §7 | Soft lock-on (§5.3) and a dodge with 0.2 s of invulnerability (§5.8). |
| K4 | Phone players were second-class | FAB §1 | Touch layout first: 44 px minimum targets, playable at 844×390 and 390×844, and a movable button editor (as in the arcade). Gamepad and remappable keys too (MEM arcade bar). |
| K5 | Room-choice buttons were smaller than 44 px | FAB §6A | UI lint checks every interactive element's bounding box in phone screenshots at 360 px width. |
| K6 | Walking paused while the full map was open, so the monkey bot thought it was stuck | KI-015 | Pausing is explicit game state (`PAUSED_MAP`). The bots read state, not position. |
| K7 | Input felt late | MGG1 §13.1 | Feedback within 100 ms (animation, sound or UI). Input buffering §5.9. `input_latency` test: from a synthetic key to the first changed pose is ≤ 2 sim frames. |

### 1.5 Vehicles

| # | Old problem | Source | Rule / test |
|---|---|---|---|
| V1 | Ram damage every frame with no cooldown could delete a boss in one pass | REV 4.1, KI-028 | Per-pair hit cooldown of 0.35 s, and damage scaled by the relative speed along the contact normal (§5.5). `ram_once` test. |
| V2 | Potholes ignored hops, so a bike could never clear a kerb | REV 4.5, KI-028 | Potholes and kerbs are real collider shapes. Wheels raycast against them, so a hop clears them naturally. |
| V3 | No-op code lines in the vehicle file | REV 4.4 | ESLint `no-self-assign`, `no-self-compare` and a custom rule against `clamp(x, x, x)`. |
| V4 | The plane's seat table was empty although the plane had 1 seat | KI-022 | Validator: `seats.length === spec.seats` for every vehicle, and every seat has an anchor, a door or mount side, and a pose. |
| V5 | Bikes clanged like metal on impact | FAB §1, SND | Crash sounds come from a material pair table (§6.3). The bicycle is "light rattle", never "metal clang". |
| V6 | One motorbike recording pitched three ways for scooter, okada and keke; one car horn for all | SND "Not recordings" | Each vehicle type has its own engine loop set and horn (§6.2). Asset lint fails if two vehicle types share an engine sample. |
| V7 | Vehicles that entered water had no rule | FAB §6E | §5.6: they float, stall, and get pushed out with a comedy beat. |
| V8 | Ride steps had no beacon; the car was at the Racing Club with no star | REV §3.2 | Every vehicle spawn and every `ride` step has a target in data. Validator `NO_BEACON`. |
| V9 | Crashes that hurt riders | FAB §1 (content rule) | Non-lethal: riders tumble off (a cartoon tumble clip), get up, and pick the bike up (§4.1). Nobody is ever left lying on the ground. |
| V10 | Hard braking felt unreal until a late handling pass | FAB §5 | Handling numbers live in one config table per vehicle (§5.5) and are tuned in the slice with the feel suite, not across scattered code. |

### 1.6 Physics and collision

| # | Old problem | Source | Rule / test |
|---|---|---|---|
| P1 | Melee hit through building walls | REV 4.2, KI-028 | Every hit needs a line-of-sight raycast from chest to chest. `melee_los` test. |
| P2 | Enemies chased in straight lines and bunched on walls | REV 4.3, KI-028 | Navmesh pathfinding (Recast) for everyone who chases or follows. `chase_reaches` test: the chaser reaches the target round three building corners within 1.5× the path time. |
| P3 | Find items spawned in water or inside buildings | REV §6 | Spawn points are authored or sampled on the navmesh only, never by random offset. Validator `SPAWN_ON_NAVMESH`. |
| P4 | Stuck spots and falling through the world | MGG1 §11.3, KI-015 | Controller unstick: if input is held and the player moves < 5 cm in 1.5 s, push out along the contact normal. Below-world recovery: teleport to the last safe grounded spot. The monkey bot logs both events, and the build fails if either is reached in the slice. |
| P5 | Behaviour depended on frame rate | REV 4.1 | Fixed 60 Hz step (D5). `determinism` test: the same seed and the same input log give the same end state at 30 and at 144 render fps. |
| P6 | Collision with render meshes | MGG1 §11.3 | Collision uses simple proxy shapes authored as `*_col` nodes in each GLB. Asset lint fails a building without a collision proxy. |

### 1.7 Audio

| # | Old problem | Source | Rule / test |
|---|---|---|---|
| S1 | "Nobody has listened to these in the game yet" | SND | Every sound passes an **ear review** in context before it can be marked `approved` in the audio manifest. The release build warns on unapproved sounds. |
| S2 | Tyre screech, brake squeal and dirt skid were synthesized noise | SND | Recorded or properly designed samples in the slice (§6.2). Synthesized sound is a placeholder only, flagged `placeholder: true`. |
| S3 | No football crowd roar, gasp or groan | SND | Crowd set (murmur, cheer, roar, gasp, groan, chant) is required before the football milestone (§7). |
| S4 | A generic alarm stood in for the campus security siren | SND | A dedicated security siren and whistle set. |
| S5 | Voice lines were keyed by a hash of the text, so editing text silently dropped the recording | AUD §8 | Voice files are named by **line ID** (V3 §8.5). Validator `VOICE_ID`. An edited line is flagged "needs re-record" and keeps playing its old audio until replaced. |
| S6 | The intro score was a 3.2 MB file in the download | AUD §6 | Music streams. It is never part of the first-load pack beyond the first 30 s of the title theme (§6.4). |
| S7 | Browsers unlock audio only after a tap | MGG1 §14 | An explicit "tap to start" on the title screen unlocks audio. A test checks that no sound is queued before the unlock. |
| S8 | The owner wants music by place and time, and radios on bikes and cars | MEM | §6.4 and §6.5 are milestone requirements, not polish. |

### 1.8 Performance

| # | Old problem | Source | Rule / test |
|---|---|---|---|
| F1 | All 111 people ticked every step, hidden ones included; worst step 242 ms | KI-027, AUD §6 | Simulation LOD (§4.7). Off-screen people far away tick at 1 Hz on a schedule; hidden people don't tick at all. `sim_budget` test: p99 sim step ≤ 4 ms in the Node bench with 600 people. |
| F2 | FPS, GPU time, draw calls and memory were never measured in a browser or on a phone | AUD §6, FAB §7 | Perf overlay plus a JSON recorder (§5.11). Every milestone ends with real-device numbers from the device lab (V3 §14). |
| F3 | A stale bundle meant production served 43 separate files | KI-017 | The build is the only path to production. CI fails if the bundle hash doesn't match its sources. |
| F4 | Per-frame allocations in the game loop | MGG1 §9 | `no_alloc` test: a heap snapshot diff over 600 sim steps of the bench shows zero growth in game-owned objects. Pools for particles, sounds, projectiles and decals. |
| F5 | `Math.random` in the renderer made runs unrepeatable | AUD §4 | One seeded RNG service. Lint bans `Math.random` outside `packages/rng`. |
| F6 | Three.js alone was 652 KB, and the first load grew | AUD §6 | Per-pack size budget in config. The build fails when it is exceeded (§2.8). |

### 1.9 UI and wayfinding (where motion and assets touch the UI)

| # | Old problem | Source | Rule / test |
|---|---|---|---|
| U1 | Raw `@roomie` on the HUD | KI-004 | One `objective()` reader for HUD, distance, minimap, beam and map. Validator `HUD_TOKEN`. |
| U2 | The arrow pointed at the place centre while the item was 16–46 m away and drawn only within 18 m ("0 m" and nothing visible) | REV §3.1, KI-012 | The objective target is the item itself. Find items are visible (with a sparkle) from 45 m. Bot check `ARROW_NOT_AT_ITEM`. |
| U3 | No arrow for class, eat or job steps | KI-006 | Validator `NO_BEACON` on every step. |
| U4 | A refused save showed no message | KI-029 | Load errors are visible UI. Test: a save from a newer version shows the message. |
| U5 | Map labels overlapped at night | FAB §7 | Label collision avoidance on the map. A screenshot test at night and by day. |
| U6 | A portrait HUD clipped at the left; chart labels were tiny on phones | FAB §7 | Safe-area layout. Screenshot tests at 390×844 and 844×390; text ≥ 12 px CSS at 360 px width. |
| U7 | The map, shuttle and phone were never taught | REV §7 | The first 10 minutes (GDD §9.3) teach move, look, sprint, jump, ride and map, each with a one-line prompt. |

### 1.10 Content, flow and process (from the old docs, so the motion work doesn't repeat them)

| # | Old problem | Source | Rule / test |
|---|---|---|---|
| X1 | Generator defaults put objectives at the Main Gate | REV §1, KI-001/002 | The build fails instead of falling back to a default place. Validator `DEFAULT_GATE`. |
| X2 | A `go` step to the place you stood on never fired | REV §2, KI-003 | Triggers re-evaluate on step start. The bot uses the `goWhileStanding` probe. |
| X3 | Duplicate systems: two find spawners, two tutorials, five spawn paths, monkey-patched update chains | AUD §3 | One system per job, registered in an ECS-style system list with an explicit order. Lint bans reassigning a system's methods. |
| X4 | Tests drove the data directly and never ran the engine loop, so the P0 bugs passed CI | REV §9 | The bots play through the real update loop (`Game.step`) headlessly, with the renderer stubbed. |
| X5 | Too much walking: 45 km in Year 1, the first bike in m3 | REV §5, §8 | The bicycle is in the first 10 minutes (GDD §9.3). Travel ≤ 20% of steps (V3 §7.5). Validator travel table per mission. |
| X6 | Repeat locations and a thin verb mix | REV §7, §8 | Validator verb mix per mission (V3 §7.5). Animation sets per verb (§4.1) make variety possible. |
| X7 | No "wait until dusk" | REV §8 | A wait action at benches and beds, with sit and sleep clips (§4.1). |
| X8 | Retired NPC came back after a load; collect state was lost on reload | KI-016, KI-014 | Saves record spawn state. The bot saves and reloads at every step. |
| X9 | Workers overwrote each other's files | FAB §4 | One owner per file. Small, exact edits only (CLAUDE.md). |
| X10 | Claims of "works" without saying how it was checked | FAB §4.7 | Every milestone report lists what was measured, on which device, and what was not checked (feel by hand, sound by ear, real phones). |
| X11 | The opening film ran about 3 minutes and may be too long | FAB §7 | The new opening is ≤ 2:30 (GDD §9.3), skippable, and skip equals watch (A8). |
| X12 | Long renders in a dying engine wasted days | V3 §5 | No marketing renders before the slice passes M6 (§7). |

### 1.11 The top 10 rules (print these)

1. **Measure on a real low-end phone** at the end of every milestone: p95 frame time, draw calls, memory. A feature that breaks the budget is not done. (F2)
2. **One skeleton, one scale, one shared clip set for every human.** No per-NPC scaling, no primitive-built people. (C6, R3)
3. **Clothes and body share morphs and masks**, and every outfit × body shape × key pose passes the clip test. (C3, C9)
4. **Hair and skin materials are never glossy:** roughness ≥ 0.55 and no clearcoat, enforced by lint. Noses are sculpted, not assembled. (C1, C2)
5. **Feet never slide:** in-place locomotion with stride-matched play rate, foot IK, and pedal phase from distance travelled. (A1, A3)
6. **Fixed 60 Hz simulation with interpolation, and cooldowns on every repeated hit.** Nothing depends on frame rate. (P5, V1)
7. **Every hit needs line of sight, and every chaser uses the navmesh.** (P1, P2)
8. **Seats are data:** anchors, doors, a visible seated body, head clearance, hands on grips, tested for every seat × body × hairstyle. (C4, C5, A6, V4)
9. **Every vehicle has its own engine sound, and every impact sound comes from the material pair.** Nothing ships before an ear review. (V5, V6, S1)
10. **No assets without a credits entry, no real logos or photos, nothing that names the game baked into a texture.** (R4, R8, R9, §2.2)

---

## 2. Asset plan

### 2.1 Sources and licences (verify each one on the day you download)

| Source | What we take | Licence (as of Nov 2026, re-check) | Our rule |
|---|---|---|---|
| **Kenney** (kenney.nl) | City, car, furniture and nature kits; UI icons; prototype blockout | CC0 1.0 | Free to use and modify. Credit anyway (good manners, and needed for our record). |
| **Quaternius** (quaternius.com) | Base characters, animated characters, nature, buildings, cars; any animation library they publish | CC0 1.0 (licence file in each pack) | The prototype already used the Ultimate Animated Character Pack (`visual_prototype/CREDITS.md`). Keep the pack's `License.txt` next to our record. |
| **Poly Haven** (polyhaven.com) | HDRIs, PBR textures (laterite, plaster, concrete, corrugated iron), a few hero props | CC0 1.0 | Use at 1k on phones and 2k on high. Bake to our palette (§2.3). |
| **ambientCG** (ambientcg.com) | PBR textures and decals: tiles, terrazzo, asphalt, fabrics | CC0 1.0 | Same as Poly Haven. |
| **Mixamo** (Adobe) | Character animations (and the auto-rig, for test only) | Adobe's Mixamo terms: free with an Adobe account, royalty-free in games and films, including commercial ones. **You may not redistribute the raw animation files as files** (for example as an asset pack). | Ship clips only inside our own game GLBs, retargeted to our rig. Never commit raw Mixamo FBX files to a public repo. Record the download date and the account owner. Re-read the FAQ on the day. |
| **Sketchfab** | Single hero props where nothing CC0 fits | **Per model.** Allowed: CC0, CC-BY 4.0 (with credit). Forbidden: CC-BY-NC (we will earn money), CC-BY-ND (we must restyle), "Editorial", and anything without a stated licence. Store purchases: check the Standard licence on the day. | Copy the licence text and the page URL into the credits entry at download time. |
| **Poly Pizza** | Low-poly props | Per model (CC0 or CC-BY) | Same as Sketchfab. |
| **OpenGameArt, Wikimedia Commons, Freesound** | Sounds | Only files marked CC0, or CC-BY with credit | The old CC0 SFX library carries over (SND, V3 §5) together with its `CREDITS.md`. |
| **VRoid Studio** | Reference only (hair shapes, proportions) | Output and preset terms are pixiv's; re-check | Not shipped (D2). |
| **Commissioned artist** | Lead and special character faces and hair, later | Work-for-hire contract: full rights to us, credit to them | Delivered on our rig and morph set (§3). |
| **Our own work** | Everything modified, the base meshes, trim sheets | Ours | Credit "MIB-Hub team" with the source asset IDs it was derived from. |

**Forbidden in every case:** NC or ND licences, "free for personal use", ripped game assets, AI image or 3D output whose terms don't allow commercial use, real brands or logos, real university crests, and real people's likeness without a signed release (V3 §9.3).

### 2.2 Credits file format

One machine-readable file per asset family, merged by the build: `assets/credits/*.yaml`. From it the build generates `assets/ASSET_LICENSES.md` (V3 §11.2) and the in-game credits data (MGG1 §7). Every shipped `.glb`, `.ktx2`, `.ogg/.m4a` and font must map to an entry, or the build fails.

```yaml
- id: qtn-ubc-female-base          # stable id, used in derived_from
  title: Universal Base Character (female)
  author: Quaternius
  source_url: https://quaternius.com/...         # the exact page, not the home page
  licence: CC0-1.0                               # SPDX id, or MIXAMO-ADOBE, or SKETCHFAB-STANDARD
  licence_url: https://creativecommons.org/publicdomain/zero/1.0/
  licence_copy: credits/licences/qtn-ubc.txt     # the pack's own licence text, as downloaded
  retrieved: 2026-11-20
  retrieved_by: <first name>
  archive_sha256: 9f2c...                        # hash of the downloaded zip, proves which version
  modified: true
  modifications: "retopologised head, new nose, morphs added, re-rigged to mib_rig v1"
  derived_from: []
  attribution: "Base character by Quaternius (CC0)"   # the line shown in credits
  ships_as: [chars/base_f_lod0.glb, chars/base_f_lod1.glb]
  commercial_ok: true
  redistribution: ok                              # ok | inside-game-only (Mixamo) | no
  notes: ""
```

The build checks:
- `licence` is on the allow list;
- `redistribution: inside-game-only` files are never published raw;
- every `ships_as` path exists;
- every shipped file has an entry;
- `derived_from` points at real IDs.

### 2.3 Style guide: making free assets look original and consistent

**One look:** soft-lit stylised PBR (D1). The rule is *shapes cartoon, light real*.

| Area | Rule |
|---|---|
| **Palette** (master swatches; every albedo snaps to the nearest of about 40 swatches built from these) | Laterite earth `#B5562F` / `#9C4A2A` (paths only, never whole areas); neem and mango leaf `#3F7D3A` / `#5E9B3F` / `#86B04C`; rainy-season grass `#7FAF4E`; dry-season grass `#B9A55B` (harmattan only); whitewash `#EFE6D2`; cream plaster `#E3CFA6`; faculty accents (one each, used on doors, louvres and signs): Engineering `#2F6DB5`, Medicine `#2E9C8E`, Law `#7A2E3B`, Agriculture `#6E8B2A`, Arts `#C9772B`, Sciences `#5B4BA8`, Computing `#1F9BB4`, Education `#D9A92B`, Environmental Design `#B04A7A`, Admin `#4A5A6A`; sky `#7FB8E6`; corrugated roofs `#8A8F93` with rust `#9B5A34`; keke yellow `#E8B828`; generator glow `#FFB35A`. |
| **Saturation** | Albedo saturation ≤ 70%, value 20–90%. No pure black or pure white in albedo. |
| **Green rule** (anti-"desert", R2) | Rainy season is the default. Every district has ≥ 30% vegetation cover in a top-down view (grass verges, hedges, trees). Shade trees at most every 15 m along paths. Laterite shows only on paths, roads and verges. |
| **Materials** | Metallic-roughness PBR. Roughness floor 0.45 (props), 0.55 (skin, hair, fabric). No clearcoat or transmission on low and medium tiers. Glass is a cheap fake (a tinted reflection probe on high only). |
| **Lighting** | One sun (dynamic, its direction from time of day), HDRI ambient tinted by time of day, baked AO in vertex colours or a second UV channel. At night: emissive windows, light cards, and ≤ 4 real point lights near the player (generators, kiosks). No baked lightmaps that would fight the day/night cycle. |
| **Shape language** | Bevel every hard edge (2–5 cm, 1–2 segments) so light catches it. Slightly chunky proportions (+10% thickness on railings, poles and window frames) so they read on a phone. Characters: head about 1/6 of height, eyes +15%, hands +10%. |
| **Texel density** | Near props and characters: 512 px/m (high), 256 (medium), 128 (low). Buildings: 256/128/64 px/m via shared **trim sheets** (one 2k sheet per district family: plaster, louvres, trims, signs blank). Terrain: tiled 1k sets with a macro variation map. |
| **Re-skin pass** (applies to every store asset) | (1) Strip the original materials. (2) Re-UV onto our trim sheet or atlas where possible. (3) Recolour to the palette. (4) Add bevels or a weighted-normals pass. (5) Kitbash at least one local detail: louvres, a burglar-proof grille, water tank, satellite dish, kiosk awning, hand-painted fictional sign. Nothing ships looking like its store thumbnail. |
| **Local character** | Louvred windows, verandas, concrete breeze blocks, corrugated roofs, overhead water tanks, painted kerbs (black and white), umbrella kiosks, hand-painted signs, neem-lined roads, open drains with slab covers. Original designs, never copies of real buildings (GDD §3.3). |
| **Signs and text** | Never baked into textures. Sign slots render text from config at run time, onto shared blank sign meshes (R4). |

### 2.4 Per-asset budgets (LOD0 triangles / max texture per tier, low · medium · high)

LOD rule: LOD1 ≈ 50% of LOD0 tris, LOD2 ≈ 20%, LOD3 = impostor billboard or culled. Switch by **screen size** (not distance): LOD0 above 25% of screen height, LOD1 10–25%, LOD2 3–10%, impostor or cull below 3%. Low tier starts at LOD1.

| Category | LOD0 tris | Textures (low · med · high) | LODs | Notes |
|---|---|---|---|---|
| Player / lead character (body + head) | 14–18k | 512 · 1k · 2k (albedo, normal, ORM atlas) | 0–2 | Face morphs on LOD0 only. |
| Named NPC | 8–12k | 512 · 1k · 1k | 0–2 | |
| Crowd NPC | 4–6k | shared 1k atlas (256 per person region) | 1–3 + VAT | §4.7 |
| Hair (cards or shell) | 2–6k | 256 · 512 · 1k | 0–1 | Alpha test on low, alpha-to-coverage on high. |
| Outfit piece | 1–4k | from the character atlas | follows body | Body under it is masked out (§3.5). |
| Car (saloon, SUV, pickup) | 8–12k incl. interior | 512 · 1k · 1k shared vehicle atlas | 0–2 | Interior is LOD0–1 only. |
| Danfo minibus | 10–14k | 1k | 0–2 | Livery from data. |
| Campus shuttle bus | 12–16k incl. interior | 1k | 0–2 | Livery from sign slots (`{{UNI_NAME}}`). |
| Okada (motorbike) | 4–6k | 512 | 0–2 | |
| Keke (tricycle) | 6–8k incl. cabin | 512 · 1k | 0–2 | |
| Bicycle | 2–3k | 256 · 512 | 0–1 | |
| Tractor | 7–9k | 512 · 1k | 0–2 | |
| Modular building piece | 50–2k | district trim sheet | 0–1 | Merged per building at build time. |
| Whole ordinary building (merged) | 6–15k | trim sheet | 0–2 + far proxy | Far proxy ≤ 300 tris. |
| Landmark (Clock Tower, Senate, Twin Theatres, Stadium) | 20–40k | trim + 1 unique 1k | 0–3 | Visible from far; needs a good LOD2. |
| Interior room kit | ≤ 60k per room loaded | trim + props atlas | 0–1 | Interiors stream (§2.8). |
| Tree (neem, mango, baobab, palm) | 2–4k (cards) | 512 · 1k atlas | 0–1 + impostor | Thin-instanced. |
| Shrub, hedge, grass clump | 50–600 | foliage atlas | 0 + cull | GPU-instanced, culled by distance per tier. |
| Small prop (chair, bucket, crate, sign) | 50–800 | props atlas | 0–1 | Instanced if repeated more than 4 times. |
| Medium prop (kiosk, generator, water tank, goalpost) | 800–3k | props atlas | 0–1 | |
| Animals (goat, ram, cat, chicken, cow, fish) | 1.5–4k | 256 · 512 | 0–1 + VAT for flocks | |

**Scene-wide limits (visible at once):**

| Measure | Low (phone) | Medium | High (desktop) |
|---|---|---|---|
| Triangles | ≤ 300k | ≤ 600k | ≤ 1.5M |
| Draw calls | ≤ 120 | ≤ 200 | ≤ 350 |
| Skinned characters with full update | 8 | 15 | 25 |
| Drawn people total (with VAT crowd) | 25 | 40 | 60 (GDD §4.2) |
| GPU texture memory | ≤ 160 MB | ≤ 320 MB | ≤ 700 MB |
| Shadows | Player only (1×1024, 30 m) plus blob shadows | 1 cascade 2048, 50 m | 2 cascades 2048, 120 m |
| Render scale | 0.7 × DPR, capped at 1.5 | 0.85, cap 2 | 1.0, cap 2 |
| Post-processing | Tone map, FXAA | + bloom (half-res) | + SSAO (half-res), colour grading LUT |

### 2.5 Compression, instancing and the asset build

- **Pipeline (one command, `npm run assets`):** Blender export (glTF) → `gltf-transform` (dedup, prune, weld, resample animations, quantize, **Meshopt**) → textures to **KTX2** (ETC1S for albedo and ORM, UASTC + RDO for normals and hero faces, mipmaps on) → LOD generation (`meshoptimizer` simplify, then hand-fix heroes) → the size and lint report.
- **Instancing:** thin instances (Babylon) or hardware instancing (PlayCanvas) for trees, foliage, streetlights, chairs, kerbs and statues. Build-time merge for static building pieces per 64 m cell. Crowds use VAT instancing beyond 15 m (§4.7).
- **Atlases:** one props atlas and one trim sheet per district family, one vehicle atlas, one crowd atlas. Target ≤ 3 materials per building and ≤ 2 per vehicle.
- **Asset lint** (CI, fails the build): over-budget tris or textures; a missing LOD or collision proxy; a missing credits entry; default material (R5); hair or skin gloss (C2); palette drift (> 12 ΔE from the nearest swatch over 20% of texels); non-power-of-two textures; uncompressed textures; denylisted images (R8).

### 2.6 Vehicle authoring contract (every vehicle GLB)

Named empty nodes (sockets), checked by the validator:

| Socket | Purpose |
|---|---|
| `seat_<n>` | Seat root: position, rotation, `pose` = `drive_car`, `pass_car`, `ride_okada`, `pillion_okada`, `drive_keke`, `pass_keke_back`, `pass_bus`, `cycle`, `tractor`. |
| `door_<n>` + `door_<n>_hinge` | Door mesh and its pivot, open angle, which seats it serves. Two-wheelers have `mount_L` and `mount_R` instead. |
| `grip_L`, `grip_R` | Steering wheel or handlebar grips, for hand IK (A6). |
| `pedal_L`, `pedal_R`, `foot_L`, `foot_R` | Pedals or footpegs, for foot IK. |
| `wheel_<FL/FR/RL/RR/F/R>` | Wheel pivots; radius in metadata. |
| `steer` | Steering wheel or handlebar pivot (±90° on cars, ±35° on bars). |
| `roof` | Lowest point of the roof above each seat, for the head-clearance test (C5). |
| `radio` | Where the radio sound comes from (§6.5). |
| `exhaust`, `headlight_L/R`, `brakelight` | Effects. |
| `*_col` | Collision proxy: box hull, plus the cabin. |

### 2.7 The full asset list, by district and category

Counts are **unique models** (variants share meshes and recolour through material parameters). "Slice" marks what the vertical slice needs (GDD §9.3: hostel room → the Spot → past Engineering and the Clock Tower → Agriculture farm and barn).

#### 2.7.1 Shared everywhere (the "core kit")

| Category | Items | Count |
|---|---|---|
| Roads and ground | Asphalt road pieces (straight, bend, T, cross, roundabout), laterite path pieces, kerbs (painted black and white), speed bumps, potholes (collider), open drains with slab covers, culverts, interlocking paving | ~30 (slice) |
| Street furniture | Streetlight (2 types), bollard, bench (concrete, wooden), bin (drum, wire), noticeboard, bus stop shelter, sign blanks (6 sizes), sign posts, fence (block wall, chain-link, iron railing), gate (sliding, swing), security booth, speed sign | ~35 (slice) |
| Utility | Overhead water tank (plastic, steel stand), generator (small, large with housing), NEPA pole + wires, transformer, satellite dish, AC unit, solar streetlight, borehole tap | ~14 (slice) |
| Vegetation | Neem (3 sizes), mango (2), baobab (1, landmark), palm (2), dogonyaro hedge, flowering shrub (bougainvillea, ixora), grass clumps (rain and dry variants), elephant grass, flowerbeds, crops (maize, sorghum, groundnut rows), creepers on walls | ~22 (slice) |
| Small props | Plastic chairs (the monobloc), crates, buckets, kettles (buta), jerrycans, mats, umbrellas, food coolers, trays, plates, bowls, cups, books, bags (backpack, ghana-must-go bag, suitcase), phone, laptop, keys, torch, footballs, cones | ~40 (slice) |
| Animals | Goat (+ Sarki variant), ram (Senator), chicken, cat (+ Taty's cat), cow, dog, lizard (agama), birds (egret, kite) | 9 (goat, chicken, cat, birds in slice) |
| Sky and weather | HDRIs (dawn, day, golden hour, dusk, night, overcast), cloud layer, rain particles, harmattan haze LUT, dust puffs, puddle decals | 6 HDRIs + FX |

#### 2.7.2 Vehicles

| Vehicle | Variants (shared mesh, recoloured) | Seats | Slice? |
|---|---|---|---|
| Bicycle | Roadster (the classic black), mountain bike, child's bike | 1 (+ a carrier rack for props) | **Yes** (first ride) |
| Okada (125 cc motorbike) | 3 liveries, delivery box option | Rider + 2 pillion (FAB §5) | Parked and NPC traffic |
| Keke (tricycle) | Yellow-green, blue, faded "old" keke, mobile-clinic keke (Zainab's free clinic day, Y3) | Driver + 3 behind | NPC traffic |
| Saloon car | 3 body shapes × 6 colours (fictional makes) | 4 | NPC traffic |
| SUV / pickup | Pickup (farm, security), SUV (lecturer) | 2 / 5 | Pickup at the farm |
| Danfo minibus | Yellow with black stripes, white "staff bus" | 1 + 12 | Background only |
| Campus shuttle | Livery from config | 1 + 20, interior | Background only |
| Tractor | Farm tractor + trailer | 1 | **Yes** (parked at the farm, drivable later) |
| Skateboard, scooter | Carry-over from the old game (optional) | 1 | No |
| Wheelbarrow, handcart | Props you push (market, workshop) | — | Wheelbarrow at the farm |

#### 2.7.3 Districts (GDD §3.2)

Size budget per district pack (compressed, downloaded once): see §2.8.

| District | Buildings and landmarks | District props and shops | Slice? |
|---|---|---|---|
| **Main Gate and Admin** | Main Gate arch (sign slots), security post, Senate, Bursary, Registry, Admissions, bank with ATM bay, bookshop, **Clock Tower** | Queue barriers, ATM, flagpoles, noticeboards, bookshop shelves | Clock Tower seen from the route (LOD2 far proxy plus LOD0 near) |
| **Engineering** | Department blocks (one modular kit, 10 accent variants), Twin Theatres, workshops, labs, pilot plant, Engineering Garden | Lathes, workbenches, oscilloscopes, robot parts, gas cylinders, generators | **Yes** (façades along the route) |
| **Medicine and teaching hospital** | Faculty block, hospital wards, A&E entrance, outpatients, anatomy lab (never gory) | Beds, drip stands, wheelchairs, stretchers, nurses' station, ambulance (car variant) | No |
| **Life Sciences** | Faculty block, greenhouse, zoo garden, herbarium | Plant tables, cages, microscopes | No |
| **Physical Sciences** | Faculty block, observatory dome, chemistry labs, rock garden | Telescope, rock samples, fume hoods | No |
| **Computing** | Faculty block, hackathon hall, server room | Desks, monitors, server racks, cable trays | No |
| **Law** | Faculty block, moot court, law library, legal aid clinic | Court benches, gavel, robes on stands | No |
| **Education** | Faculty block, Demonstration School | Child desks, blackboards, playground set | No |
| **Arts and Social Sciences** | Faculty block, **campus radio and TV** studio | Mixing desk, microphones, on-air sign, cameras | No |
| **Environmental Design** | Studio block, **Sculpture Garden**, Art Gallery | Statues (people, animals, frogs; instanced), plinths, easels, plaques (sign slots) | No (bake-off scene uses a mini garden) |
| **Agriculture** | Farm buildings, **barn**, animal pens, poultry house, farm shop, silo | Feed troughs, hay bales, sacks, fences, tractor, crops in rows, scarecrow | **Yes** (goat return, first stat treasure) |
| **Library** | Main library (4 floors; rare books room interior later), reading garden | Shelves, reading tables, lamps, card catalogue | No |
| **Hostels (main campus)** | 3 hostel block types (old, legendary, crowded), common room, kitchen, rooftop | Bunk beds, lockers, mattresses, buckets, clothes lines with clothes, kettles, stoves, posters (sign slots) | **Yes** (your block, your room interior, corridor) |
| **Hostels (New Site)** | 2 newer block types, shuttle terminus | Same kit, newer recolour | No |
| **Sports Complex** | Stadium, football pitches, basketball court, indoor pool, gym, tennis courts, athletics track | Goalposts, nets, corner flags, bleachers, scoreboards (sign slots), gym equipment (bench, barbell, dumbbells, treadmill, rope), lane ropes, diving board | No (football milestone M7) |
| **Student Life** | Student Union building, cafeteria, **the Spot** (food court), mosque, chapel, Cinema Hall, clubs' houses | Food stalls (suya grill, rice and stew, akara, zobo cooler), tables and umbrellas, menu boards (sign slots), prayer mats (respectful), cinema seats | **Yes** (the Spot and its stalls) |
| **Market and town** ({{TOWN}}) | Market sheds, the mall (stores, arcade, dance floor), mama put, tailors, phone repair, print shops, motor park | Stall tables, produce piles, fabric bolts, sewing machines, phone counters, photocopiers, keke and danfo rank | No |
| **Staff quarters** | Bungalows (2 types), staff club | Garden furniture, cars, gates | No |
| **The dam and forest** | Dam wall, visitor centre (with aquarium wall), pier, cliff with tower stakes, forest edge, ranger post | Fish (tilapia, catfish, Nile perch), buoys, rowing boat, rocks, reeds, lily pads | Bake-off scene uses the dam edge |
| **Secret places** | Tunnel pieces, rooftop hangout, observatory annex, the Maker's workshop | Lockers, old machines, notes (sign slots) | One secret behind the barn |

#### 2.7.4 People (NPC variety)

| Item | Count at launch | Notes |
|---|---|---|
| Base bodies | 2 (male, female) on one rig | §3 |
| Body morphs | heavy, lean, fit, height, plus belly and arm sub-morphs | §3.5 |
| Face presets | 24 (12 per base), each a set of morph values | Plus unlimited player faces |
| Skin tones | 10 swatches, from very fair (Zainab) to very deep | Palette-locked |
| Hairstyles | 22: low cut, fade, afro (3 sizes), coils, cornrows, braids (2), locs, bun, ponytail, relaxed, bald, kufi cap, fila cap, baseball cap, **6 hijab styles**, gele (events) | §3.4 |
| Outfits (modest) | 34: kaftan, babban riga (events), jalabiya, shirt + trousers (3), polo + chinos, tee + jeans, hoodie + joggers (Jiya), ankara dress (3), abaya (2), skirt + blouse (long, 3), lab coat, scrubs (Zainab), security uniform, porter's uniform, farm overalls, sports kit (football, gym), swim set (full-length rash guard + leggings, for everyone), suit (lecturers), the MIB white-and-gold kit | §3.5 |
| Shoes | 8: sandals (2), sneakers (2), school shoes, boots, slippers, football boots | |
| Accessories | Glasses (Shamsu), backpack, cross-body bag, phone, watch, cat keychain (Zainab), cat shirt or bag (Taty), pen in pocket, folder (Nusaiba) | Prop sockets |
| Combinations | 2 bases × 24 faces × 10 tones × 22 hair × 34 outfits ≈ 360k; the crowd generator draws from **weighted rules** (faculty, role, time of day, event) | Seeded per person, so a person always looks the same |

### 2.8 Streaming and size budgets

- **World cells:** 128 m square grid. Each cell has a static batch (merged buildings), instances (foliage, props), a collision set and a navmesh tile.
- **Load radius:** 2 cells on high, 1.5 on medium, 1 cell plus far proxies on low. Far proxies (≤ 300 tris per building, one district impostor atlas) are always loaded for the whole campus so the skyline never pops.
- **Interiors:** a separate small pack per building. Preload starts when the player is within 30 m of the door. If it isn't ready, the door shows a 0.5 s "opening" beat (never a blank wait). The "rooms parked 6 km away" trick is not repeated; interiors load as additive scenes at their real location or behind a door portal.
- **Packs** (V2 §24.3): manifest with version, size, checksum and areas. Choices: "Wi-Fi only", "download everything", "download as I go". The game never enters an area whose pack is missing.

| Pack | Contents | Budget (compressed) |
|---|---|---|
| `core` | Engine, game code, UI, fonts, core kit (shared props, vegetation, sky), player base bodies + 8 hair + 10 outfits, locomotion clips, UI sounds, the first 30 s of the title theme | **≤ 6 MB** |
| `slice` (first 10 minutes) | Hostel block + room interior, the Spot, the route past Engineering, Agriculture farm + barn, bicycle, goat, slice music and ambience (streamed parts excluded), 12 crowd presets | **≤ 9 MB** (core + slice ≤ 15 MB, D7) |
| Each further district | Its buildings, district props, district music | **6–12 MB** each |
| Each large interior (library, hospital, stadium, mall) | Interior kit and props | **2–5 MB** each |
| `people-extra` | All other hair, outfits, faces | ≤ 8 MB |
| `vehicles-extra` | Danfo, shuttle, tractor, keke variants | ≤ 5 MB |
| Music | Streamed per track (Opus 96 kbps) | Not counted in packs; cached when played |
| Voice | Per year, optional (OFF) | ≤ 15 MB per year |
| **Year 1 total** | | **≤ 120 MB** (V2 allows 200 MB; we aim lower) |

The build fails if a pack exceeds its budget (V2 §9).

### 2.9 Working on this Mac (disk about 4–5 GB free)

- Raw downloads (zips, FBX, `.blend` files) **never** go in git. They live in `~/Downloads/games-files/asset-src/` (outside the repo), one folder per source, each with its licence text. Prune each zip once its contents are converted and its hash is recorded in the credits file.
- Before any download, install (Blender is about 1 GB) or render, run `df -h /System/Volumes/Data`. Stop if under 3 GB free.
- Shipped, compressed assets live in the repo under `apps/game-fsl/assets/` with a CI size cap (start at 150 MB total). Later they move to R2 (V3 §6).
- Tools needed later (not now): Blender (LTS version that supports macOS 12, check on the day), `@gltf-transform/cli` and `meshoptimizer` (pinned npm versions), KTX-Software `toktx` (or the gltf-transform KTX2 path).

---

## 3. Characters

### 3.1 Base mesh path

| Option | For | Against | Verdict |
|---|---|---|---|
| **VRoid Studio** (free, exports VRM) | Fast, good hair tools, loads in Babylon via VRM loaders | Anime proportions and faces; MToon toon shader; many spring bones; high polycount hair; harder to control noses and modest outfits; likeness drifts towards anime | Reference only |
| **CC0 base (Quaternius base characters) + Blender** | We own every vertex, can sculpt nose and face, add our morphs and masks, keep polycount low; CC0 | Needs Blender skill and time (about 2–3 weeks for two bases with morphs) | **Chosen (D2)** |
| **Commissioned Nigerian 3D artist** | Best quality, best marketing story (V3 §11.2) | Cost, time | **For leads later**, delivered on our base topology and rig, so every clip and outfit still fits |

**Steps:** (1) pick a CC0 base with clean quad topology and a humanoid rig. (2) Re-proportion to the cartoon rules (§2.3: head about 1/6 of height, +15% eyes, softer hands). (3) Re-sculpt the head: nose, lips, ears, eyelids. (4) Retopologise to the budget (§2.4) with face loops for morphs. (5) UV to a 2k body + head atlas. (6) Re-rig to `mib_rig` (§3.7). (7) Add morphs (§3.5, §3.6). (8) Export LOD0–2.

### 3.2 Proportions and silhouette

- Adult height 1.60–1.85 m via the `height` morph only (C6). The camera, seats and doors are tuned for 1.75 m.
- Cartoon, not bulky: shoulders at most 2.3 heads wide on the fit extreme; no visible muscle striations; no six-pack.
- Every character must read by silhouette at 64 px tall (MGG1 §10.1): hair or headwear shape plus outfit outline.

### 3.3 Noses and faces

- The nose is part of the head mesh: a soft wedge with a rounded tip, gentle nostril wings and no hard ridge. Its shading comes from a baked normal and AO, plus a slight warm tint on the tip.
- Nose morphs: width (±30%), bridge height (±25%), tip size (±25%), tip angle (±15°), nostril flare (±20%). Ranges are clamped in data, so the editor can't make a broken nose.
- Eyes are separate meshes with a painted iris, a single highlight card and a lid-follow morph. Eye whites are off-white, never pure white.
- Skin: one albedo per tone (palette-locked) + shared normal + subsurface faked by a warm wrap-lighting term (cheap). Roughness 0.55–0.7.
- **Approval:** turntable renders at 0°, 45° and 90°, in daylight and at night, sent to the owner before any face preset is approved.

### 3.4 Hair and headwear

| Type | Method | Material |
|---|---|---|
| Short coils, low cut, fade, bald | Shell mesh hugging the scalp + painted coil texture + normal map | Roughness 0.75–0.9, no specular highlight band |
| Afro, puffs | Sculpted volume mesh + noise-based normal + edge cards for a soft silhouette | Roughness 0.7–0.85 |
| Braids, cornrows, locs | Mesh strands (low-poly tubes) + painted texture | Roughness 0.6–0.75 |
| Straight or wavy hair (Jiya, Taty, Madison) | **Hair cards** (painted strand atlas, alpha) in 3–4 layers | Roughness 0.55–0.7, specular ≤ 0.35, an optional *soft* anisotropic highlight on high only |
| Hijab styles, kufi, fila, gele, caps | Cloth meshes skinned to head and neck, with 1–2 spring bones for hijab tails | Fabric roughness 0.7–0.9 |

Alpha test on low, alpha-to-coverage on medium and high, and no alpha blending (avoids sorting errors). The material lint rule from C2 applies to all.

### 3.5 Bodies and outfits

- **Body morphs** (on the body and on every outfit, transferred in Blender with Surface Deform or Data Transfer, then hand-fixed): `heavy` (0–1), `lean` (0–1), `fit` (0–1), `height` (−1…1), `belly`, `arms`. The engine maps the stats onto them (V3 §7.2): `heavy = bodyFat`, `fit = muscle × 0.7`.
- **Body-part masks:** the body is split into 8 regions (head, neck, torso, upper arms, forearms, hands, thighs, shins and feet). Each outfit declares which regions it covers fully, and the engine hides those regions. This removes clipping at the source (C3).
- **Layers:** base body → under-layer (trousers, leggings) → over-layer (dress, kaftan, abaya, lab coat) → outerwear and accessories. Each layer is inflated 3–8 mm (not the old 1.05–1.1× scale, which breaks at joints).
- **Long garments** (abaya, kaftan, long skirts): extra skirt bones (front, back, left, right, 2 segments each), driven by a cheap spring that follows the thighs and is clamped so the hem never reveals the legs. Physics cloth is never used.
- **Modesty rules** (RC §5): no exposed midriff; dresses and skirts below the knee or worn with trousers; sleeves at least to the elbow on all women's outfits except sports kit; swimwear is full-length for everyone. A character-data validator checks the `modest: true` flag on every outfit.
- **Clip test (`cloth_clip_matrix`):** every outfit × {neutral, heavy 1, lean 1, fit 1, heavy 1 + fit 1} × 12 poses (run peak, sprint peak, sit chair, sit floor, cycle top, okada ride, keke drive, swim stroke, kick, header, scuffle shove, knock-down sit). It runs as a headless Blender script that measures the body vertices outside the cloth, or as an in-engine depth test with the body drawn red. Fail if any visible body vertex pokes out by more than 2 mm.

### 3.6 Face morphs and likeness

- **Shape morphs (about 30):** head width, jaw width, chin length and width, cheek fullness, cheekbones, brow height and depth, eye size, spacing, tilt and lid shape, nose (5, §3.3), lip thickness (upper and lower), mouth width, ear size, forehead height.
- **Expression morphs (about 18):** blink L/R, brows up, brows frown, smile, wide smile, frown, sneer, surprise, squint, puff cheeks, tongue out (comedy), jaw open, plus look-follow lids.
- **Visemes (15)** for recorded lines, driven from phoneme timings made offline per voice line.
- **Likeness ("inspired by"):** only for people with a signed release (V3 §9.3, GDD §5.5). Photos stay on the owner's machine (RC §5), never in git, never in the build. The repo holds only the result: morph values, palette indices, hair and outfit IDs, in the character sheet. Each sheet has a required `consent_ref`. The validator refuses `status: live` without it. Special characters (Jiya, Taty, Zainab, Madison) appear only inside `[IF special.x]` content with fallbacks.

### 3.7 One rig, one animation set

- **`mib_rig` v1:** Mixamo-compatible humanoid bone names (so Mixamo and most libraries retarget with no renaming): hips, spine ×3, neck, head, shoulders, arms, forearms, hands, fingers (3 joints × 5 fingers, LOD0 only), legs, feet, toes. Extras: `hand_L_prop`, `hand_R_prop`, `back_prop`, `head_prop`, `hip_prop` sockets; skirt bones (8); hijab and hair spring chains (≤ 3 chains × 3 bones); `root` on the ground for root motion. Total ≤ 75 bones at LOD0, ≤ 30 at LOD2 (fingers and springs dropped).
- **Rest pose:** A-pose, Y-up, 1 unit = 1 m, facing +Z, so Mixamo clips need no correction.
- **Retargeting:** done once, offline, in Blender (or the engine's retarget tool), with a per-clip check of the foot-plant curves after retargeting. Clips are exported **into clip-only GLBs** (no mesh) grouped by use (`anim_locomotion.glb`, `anim_vehicles.glb`, `anim_social.glb`, …) so the core pack carries only what the slice needs.
- **The secret character (MIB), special characters and crowds** all use the same rig and clips. Special characters can have 1–3 signature clips (Taty's `horns`, Madison's dance).

### 3.8 Character LOD

| LOD | Screen height | Mesh | Skeleton | Face | Update |
|---|---|---|---|---|---|
| 0 | > 25% | Full (14–18k) | 75 bones, springs on | All morphs, eyes, visemes | Every frame, IK on |
| 1 | 10–25% | 50% | No fingers (fist and open-hand poses baked) | Blink only | Every frame, foot IK only |
| 2 | 3–10% | 20% | ≤ 30 bones | None | 15 Hz, no IK |
| 3 | < 3% or > 40 m crowd | VAT instance (vertex animation texture of 8 loops) | none | none | GPU only |

---

## 4. Animation and motion

### 4.1 Full clip list

Legend: **RM** = root motion (the clip moves the capsule, through the controller so collisions apply), **IP** = in place (the controller moves, the clip follows). **Src**: MX = Mixamo, LIB = CC0 library, MC = made by us (keyed or edited in Blender). **Events** fire sounds or gameplay from named frames (MGG1 §10.2): `fs` = footstep, `hit`, `door`, `grab`, `release`, `seat`.

#### Locomotion (on foot)

| Clip | Loop | RM/IP | Src | Events |
|---|---|---|---|---|
| idle_breathe, idle_look_around, idle_impatient, idle_phone_check, idle_tired (low stamina) | yes | IP | MX | — |
| walk_fwd, walk_back, walk_strafe_L/R | yes | IP | MX | fs |
| jog_fwd, run_fwd, sprint_fwd | yes | IP | MX | fs |
| walk_start, run_start (from idle, 0°/90°L/90°R/180°) | no | RM | MX + MC | fs |
| walk_stop, run_stop (left-foot and right-foot versions), sprint_skid_stop | no | RM | MX + MC | fs, skid |
| turn_in_place_90L/R, turn_180 | no | RM | MX | fs |
| run_pivot_180 (plant and turn) | no | RM | MC | fs, skid |
| walk_slope_up/down additive, stairs_up/down | yes | IP | MX | fs |
| carry_walk/idle (box, bucket on head, suitcase, bag), push_wheelbarrow | yes | IP | MX + MC | fs |
| jump_start, jump_air (loop), fall_loop, land_soft, land_hard (roll), land_run (no stop) | mixed | IP | MX | fs, land |
| vault_low (≤ 1.1 m), climb_ledge (≤ 1.8 m), drop_down | no | RM | MX | grab, fs |
| stumble_fwd/back (bumped) | no | RM | MX | — |
| crouch_idle, crouch_walk (secrets and stealth) | yes | IP | MX | fs |

#### Everyday and cutscene clips (`missions/FORMAT.md` `actor.anim` set, plus AUD §10.4)

| Clip | Loop | Notes |
|---|---|---|
| sit (chair, bench, floor, bed edge, lecture seat), sit_idle (3 variants), stand_up | enter/loop/exit | Sit target sockets on furniture; RM to the socket. |
| hug (paired), handshake (paired), high_five (paired), carry_bags_handover (paired; porter → room) | no | §4.6 |
| wave, wave_from_car (passenger, upper body), point, nod, shake_head, gesture_talk (4 variants), laugh, shock, facepalm, cheer, clap, kneel, write, look (look-at target), throw_cap (finale) | mostly no | Upper-body layer where possible, so they play while walking. |
| phone (out, idle, call, text, photo, put away) | enter/loop/exit | `hand_R_prop` phone. |
| eat (standing, seated, from a plate, suya stick), drink | loop | Props in hand sockets. |
| carry (see locomotion), pick_up_low, put_down, give, receive | no | grab and release events. |
| sleep (lie down, lie idle, wake up, sickbay wake), yawn | enter/loop/exit | Bed sockets. |
| pray (respectful, generic sit-and-bow; only on prayer mats in mosque or chapel settings, data-placed) | loop | Check with the owner before use. |
| **horns** (Taty's rock hand sign on a win; `special.taty` only) | no | Signature clip, upper-body layer. |
| dance (6 loops: 3 general, 2 Madison trend dances, 1 crowd copy), dance_battle moves (8) | yes | Madison's crowd-copy uses the same clips on the crowd (VAT on LOD3). |

#### Scuffles (cartoon, non-lethal; STORY_BIBLE_V2: "knocked down means sit, shake your head and get up")

| Clip | Notes |
|---|---|
| guard_idle, guard_step (4 directions) | Lock-on stance. |
| shove (light), shove_heavy (charged), jab_cartoon (an open-hand "bap", no closed-fist face hits), sweep_trip, grab_and_push | Each has anticipation (6–10 frames), an active window, recovery. |
| block, block_hit, dodge_L/R/back | Dodge has 0.2 s of invulnerability. |
| hit_react_light (front, back, left, right), hit_react_heavy | Additive on the upper body for light hits. |
| **knock_down_sit**: stumble back → plop to sitting (no ragdoll) | Ends sitting on the ground. |
| **dazed_shake_head** (1.2 s, optional cartoon stars or birds VFX) | Plays seated. |
| **get_up_from_sit**, get_up_from_front, get_up_from_back | RM; 1.0 s of invulnerability after. |
| taunt (Big Sly's knuckle crack + apology), give_up (hands up, comic) | Story beats. |
| guard_escort (two security guards walk you out, paired) | Non-lethal ending (FAB §1). |

#### Vehicles

| Clip | Notes |
|---|---|
| car_enter_L/R (open door, step in, sit, close), car_exit_L/R | Door hinge animated from the `door` event. Separate passenger versions. |
| car_drive_idle, car_steer (additive, driven by steering), car_look_back (reversing), car_horn | Hands on `grip_*` via IK (A6). |
| car_passenger_idle (3 variants), car_passenger_chat, wave_from_car | |
| bike_mount_L/R, bike_dismount, cycle (pedal cycle; phase from the wheel, §4.5), cycle_stand (pedal standing), cycle_freewheel, cycle_foot_down (stopped), bike_fall (cartoon tumble) + get_up + bike_pick_up | |
| okada_mount, okada_ride (lean additive), okada_foot_down, okada_dismount, **okada_pillion_mount/ride/dismount** (2 pillion poses: side-saddle option and astride) | |
| **keke_driver_enter/drive/exit**, **keke_passenger_enter_back/sit/exit** (3 seats), keke_tip_comedy (everyone leans and yelps; §5.5) | |
| bus_board, bus_sit, bus_stand_hold_rail, bus_alight (shuttle and danfo) | |
| tractor_climb_in, tractor_drive, tractor_climb_out | |
| thrown_off_tumble (from any two-wheeler) + get_up | Non-lethal (V9). |

#### Swimming and diving

| Clip | Notes |
|---|---|
| water_enter_wade, swim_idle_tread, swim_surface_fwd (breaststroke-like, readable), swim_sprint (front crawl), swim_turn | IP. |
| dive_from_edge, dive_from_board (pool), duck_under (surface → underwater) | RM. |
| swim_underwater_fwd, swim_underwater_up, swim_underwater_down | IP, pitch from input. |
| surface_gasp (breath refill), out_of_breath_pop_up (non-lethal: a buoyancy push and a cough; never "drown", which replaces MGG1 §10.3's item) | |
| climb_out_ledge, climb_ladder | RM. |

#### Football (the owner's favourite; MEM arcade bar)

| Clip | Notes |
|---|---|
| dribble_jog, dribble_run (ball touch every 2nd step, `touch` event) | IP. |
| pass_short (inside foot), pass_long (lofted), shot_power, shot_finesse (curl), chip, volley, bicycle_kick (special, Jega's Golden Boot) | Contact frame event `kick`; ball impulse applied there. |
| header_stand, header_jump, chest_control, first_touch_trap | |
| tackle_standing (poke), tackle_slide (cartoon, never injuring in play), shoulder_barge (light) | |
| keeper_idle, keeper_dive_L/R (low, high), keeper_catch, keeper_punch, keeper_throw, keeper_kick | |
| celebrate (6: knee slide, run arms out, dance, point to sky, team pile-up (paired loops), Jega's shake-every-hand), dejected | |
| penalty_runup, penalty_kick, keeper_penalty_wait | |

#### Gym and body

| Clip | Notes |
|---|---|
| bench_press, squat, deadlift (cartoon light form), bicep_curl, pushups, situps, skipping_rope, treadmill_walk/run, stretching | Each with a "fail" variant (wobble, set it down, comedic) for the timing minigames. |
| jog_morning (ring road), tired_hands_on_knees, drink_water | |

#### Minigame and job clips

| Clip | Notes |
|---|---|
| cook_stir, cook_pound (pestle), serve_food, carry_on_head (market), sweep, farm_hoe, farm_feed_animals, herd_wave_arms, workshop_saw, workshop_hammer, measure_tape, hold_torch_steady (steady-hand minigame), type_laptop, writing_exam, raise_hand (class), dj_scratch (radio), deliver_hand_over | Upper body where possible. |
| chase_goat_lunge, catch_goat_hug (paired with the goat rig) | First 10 minutes. |

**Total:** about 260 clips. About 60% come from Mixamo or CC0 libraries, 40% are edited or made by us. The slice needs about 90 of them (§7, M3).

### 4.2 Blend trees and the state graph

- **Layers:** (1) full body base: locomotion, vehicle, swim, scuffle; (2) upper-body override with a spine-3 mask: phone, wave, carry, eat, gesture, look; (3) additive: breathing, lean, steering, hit reacts; (4) face: expressions and visemes; (5) IK pass (§4.3).
- **Locomotion blend space (1D speed × turn):** speed points 0 (idle), 1.6 (walk), 3.6 (jog), 5.0 (run), 7.0 (sprint) m/s. A turn-lean additive is driven by angular velocity (±15° body lean at a full sprint turn).
- **Transitions:** start and stop clips are picked by speed and **foot phase** (left or right foot planted), so a stop never snaps the feet. A pivot plays when the input reverses by more than 135° at a speed above 3 m/s.
- **Blend times:** locomotion 150 ms, upper body in 120 ms out 200 ms, vehicle enter and exit 100 ms, scuffle 60 ms, hit reacts 50 ms, cutscene cuts 0 ms (hard cut allowed by design) or 250 ms (soft).
- **Priorities** (MGG1 §10.2): knock-down > hit > dodge > attack > jump and fall > interaction > locomotion > idle. One owner per body part per frame.
- **Anticipation and follow-through** (MGG1 §10.1): kept in the clips. The state machine never cuts the anticipation of attacks or jumps (they're short: 80–120 ms), but jump input is answered in the same frame by the `jump_start` clip, so it still feels instant.

### 4.3 Root motion vs in place, and IK

| Kind | Choice | Why |
|---|---|---|
| Locomotion loops | **In place**, play rate = actual ground speed ÷ clip's authored speed (clamped 0.8–1.2×, outside that the blend space moves to the next gait) | Responsive control, and no sliding (A1). |
| Starts, stops, pivots, turns | Root motion, then blended back into the controller's velocity (**distance matching**: the stop clip is chosen and time-warped so the feet land where the controller will stop) | Planted feet at the start and the end. |
| One-shots (vault, get-up, enter vehicle, sit, dive, tackle) | Root motion, applied as a desired move to the controller (so walls and other people still block it) | No teleports, no walking through things. |
| Cutscenes | Root motion along authored splines, with avoidance (A4) | |

- **Foot IK** (player and named NPCs within 15 m): two-bone IK on each leg to raycast ground hits, pelvis lowered by the lower foot's offset (max 25 cm), foot rotation aligned to the ground normal (max 30°). Blended off in the air and while swimming. Feet are locked during plant (by the `fs` event) until lift.
- **Hand IK:** steering wheel and handlebars (A6), carried objects, paired anims (hug, handshake), and ledges for vault and climb.
- **Look-at IK:** head 50%, neck 30%, spine-3 20%. Clamp yaw ±70°, pitch ±30°, speed 180°/s. Targets: the current speaker, the interaction target, a passing horn, a nearby friend, an "interesting thing" tag (goats, crashes, music). NPCs look at the player when the player is within 4 m and faces them (crowd LOD1+: head only).
- **Motion matching: no.** It needs large clip databases and per-frame search. That's too much memory and CPU on our low tier, and harder to author in a small team. Blend trees + foot-phase transitions + distance matching give 90% of the smoothness. Revisit after launch for the player on the high tier only.

### 4.4 Secondary motion (cheap)

Spring bones on hijab tails, skirts, long hair cards, backpacks and keychains: one Verlet step per frame, LOD0 only, ≤ 12 spring bones per character, clamped angles. Breathing additive on idle. Blink every 2–6 s (random, seeded). Eye saccades on LOD0.

### 4.5 Vehicle rider motion

- Pedal phase = wheel rotation × gear ratio (pedal cycle = distance ÷ (wheel circumference × 1.8)). Legs follow pedals by foot IK. Standing pedalling above 80% effort.
- Okada and bicycle body lean = vehicle lean × 0.8, plus the turn-lean additive. A foot goes down below 1 m/s.
- Wheels: rotation = distance ÷ radius; front wheels steer (MGG1 §11.2).
- Passengers sway with the vehicle's lateral acceleration (additive, ±8°).

### 4.6 Paired animations (hug, handshake, carry-handover, escort, goat catch)

Each pair clip has an **alignment root**. When it starts, both actors are moved (over 0.2–0.3 s, root motion with collision) onto their sockets relative to the root, then both clips play in sync. Hand IK targets the partner's bones (`spine_2` for a hug, `hand` for a handshake) to absorb body-shape differences. Test: hand-to-target error ≤ 2 cm across body shape extremes (heavy 1 with lean 1).

### 4.7 Crowd animation LOD and simulation LOD

| Distance or state | Animation | Simulation |
|---|---|---|
| < 15 m, visible | Full skeleton, blend trees, foot IK for named people only | Full AI at 60 Hz (routes, reactions) |
| 15–35 m, visible | Skeleton at 15 Hz, no IK, no face | AI at 10 Hz |
| 35–70 m, visible | VAT instancing (8 baked loops: idle, walk, talk, sit, phone, cheer, dance, carry), random phase offset | AI at 2 Hz |
| > 70 m or off-screen near | Not drawn (or district impostors) | Schedule only, 1 Hz (where am I on my timetable) |
| Hidden (inside a building, off the active cells) | — | No tick. Position is computed from the schedule when needed (fixes F1) |

The population of 300–600 named people (GDD §4.2) is data. Only 25–60 are ever drawn (tier table §2.4).

---

## 5. Physics and feel

### 5.1 Simulation loop

- **Fixed timestep 1/60 s** for gameplay and physics. Render runs at the display rate with **interpolation** between the last two sim states (positions, rotations, camera).
- **Spiral-of-death guard:** at most 4 sim steps per render frame; any leftover time is dropped and counted in the perf log.
- All tuning numbers live in `packages/config/feel.ts`, editable at run time from a dev panel (`window.__test.feel`). The team tunes in the slice, not in scattered code.
- **Determinism:** seeded RNG (F5), input logs, and a replay harness that runs the real `Game.step` headless (X4).

### 5.2 Character controller (kinematic capsule)

| Parameter | Value | Notes |
|---|---|---|
| Capsule | radius 0.30 m, height 1.75 m (scaled with the height morph) | |
| Speeds | walk 1.6, jog 3.6, run 5.0, sprint 7.0 m/s (−8% per 0.5 heavy, +5% fit) | Sprint uses stamina (V3 §7.2). Turbo Sneakers +35% (GDD §7.2). |
| Acceleration curve | 0 → walk in 0.12 s; 0 → run in 0.30 s (ease-out); run → sprint in 0.35 s | Stick deflection maps to speed on touch and pad; keyboard uses walk/run toggle + sprint key. |
| Deceleration | run → 0 in 0.22 s (ground), sprint → 0 in 0.35 s with skid stop clip | |
| Turn rate | 720°/s at walk, 540°/s at run, 300°/s at sprint | Above 135° reversal at > 3 m/s: pivot (§4.2). |
| Air control | 35% of ground acceleration, no extra speed | |
| Jump | height 0.9 m (cartoon), rise gravity 22 m/s², fall gravity 32 m/s², terminal 25 m/s, short-hop if released before 0.12 s (height 0.5 m) | |
| **Coyote time** | 0.12 s after leaving a ledge | |
| **Jump buffer** | 0.12 s before landing | |
| Slopes | walkable ≤ 40°; 40–50° slow (×0.6); > 50° slide down at 4 m/s | |
| Steps | step-up height 0.35 m (kerbs, stairs), step-down snap 0.30 m (no floating off stairs) | |
| Pushing | Player pushes NPCs softly (they step aside 0.5 m with a "watch it" bark, cooldown 3 s); NPCs never push the player through walls | |
| Fall damage | None (non-lethal). Falls over 4 m play land_hard (roll); over 8 m a comedic flop + get-up | |
| Unstick and void recovery | §1.6 P4 | |
| Interaction radius | 2.5 m, ±60° of facing, targeting rules from K2 | |

### 5.3 Camera

| Parameter | On foot | Indoors | Car | Okada / bicycle / keke | Swimming | Scuffle lock-on |
|---|---|---|---|---|---|---|
| Arm length | 3.2 m | 2.4 m | 5.5 m (+0.6 at top speed) | 4.0 m | 3.5 m | by distance to target (3–5 m) |
| Pivot height | 1.55 m | 1.5 m | 1.4 m above roof | 1.6 m | 0.4 m above water | midpoint of both chests |
| FOV | 60° → 68° at sprint | 62° | 60° → 75° by speed | 60° → 72° | 62° | 58° |
| Position lag (critically damped, half-life) | 0.08 s | 0.06 s | 0.12 s | 0.10 s | 0.12 s | 0.06 s |
| Rotation lag | 0.05 s | 0.05 s | 0.15 s (follows velocity) | 0.12 s | 0.10 s | 0.06 s |
| Auto-recentre behind | after 1.5 s without look input while moving | off | after 0.8 s | after 1.0 s | after 2 s | always framing |

- **Collision:** sphere cast (radius 0.25 m) from pivot to the desired spot. Pull in instantly, ease back out over 0.4 s. Thin occluders (trees, poles, signs, NPCs) are **faded** (dithered to 30%), not avoided, so the camera doesn't jitter around them (K1).
- **Look input:** mouse 0.12°/count, touch drag 0.25°/px, pad 240°/s at full deflection with a response curve (exponent 2). Pitch limits −35° to +60°. Invert option.
- **Lock-on (scuffles):** soft auto-select of the nearest threat within 6 m inside a 60° cone, switch target with a flick or a button. The camera keeps both in frame. The player strafes around the target (guard_step).
- **Shake:** hits 0.05–0.12 m, 0.15 s, falloff. Off with the "reduced motion" setting. Never on the low-stamina idle.
- **Cutscenes:** the Director blends from the gameplay camera into the first shot and back with the same easing (AUD §10.3).

### 5.4 Ground surfaces

Every collider and terrain splat carries a **surface tag**: `laterite`, `grass`, `concrete`, `paving`, `asphalt`, `tile`, `wood`, `metal`, `sand`, `mud`, `water_shallow`, `carpet`. The tag drives footsteps (§6.1), dust and splash VFX, vehicle grip (table §5.5) and ball rolling friction (§5.7).

### 5.5 Vehicles

**One arcade raycast vehicle model** for wheeled vehicles: a rigid body (Rapier) with one suspension raycast per wheel, lateral grip from a slip curve, engine force from a torque curve, and arcade helpers (anti-roll, downforce, yaw damping). All numbers are config, starting values below.

| Vehicle | Mass (kg) | Top speed (km/h) | 0–50 km/h (s) | Brake decel (m/s²) | Max steer (°, at 0 → top speed) | Grip (lat. g) | Susp. rest / stiffness / damping | CoM height (m) | Special |
|---|---|---|---|---|---|---|---|---|---|
| Bicycle | 15 + rider | 28 (sprint 34) | 6.0 | 5.5 | 35 → 12 | 0.7 | rigid (wheel rays only) | 0.9 | Lean model; pedal stamina; hop 0.25 m (clears kerbs, V2) |
| Okada | 120 + riders | 85 | 4.0 | 7.0 | 30 → 8 | 0.85 | 0.15 / 30k / 2.5k | 0.6 | Lean model; pillion weight shifts CoM back |
| Keke | 300 + riders | 55 | 6.5 | 5.5 | 32 → 14 | 0.55 | 0.18 / 25k / 2k | 0.75 | Tipping comedy |
| Saloon car | 1200 | 120 | 4.5 | 8.5 | 35 → 10 | 0.95 | 0.30 / 35k / 3.5k | 0.50 | Handbrake drift (rear grip × 0.45) |
| Pickup / SUV | 1800 | 110 | 5.5 | 7.5 | 33 → 10 | 0.85 | 0.35 / 40k / 4k | 0.70 | More body roll |
| Danfo | 2600 | 90 | 7.5 | 6.5 | 30 → 9 | 0.75 | 0.32 / 55k / 5k | 0.95 | Big sway, comedic horn |
| Shuttle bus | 7000 | 70 | 10 | 5.5 | 28 → 8 | 0.70 | 0.30 / 120k / 10k | 1.10 | Driven by NPCs; fast travel |
| Tractor | 3000 | 32 | 7.0 | 6.0 | 35 → 25 | 0.80 (1.0 on mud) | 0.20 / 60k / 6k | 0.90 | Bouncy rear, trailer hitch |

- **Feel rules:** brake to stop from 50 km/h in under 2 s on cars; steering reduces with speed (no twitch at top speed); a yaw-damping term stops spin-outs unless the handbrake is held; landing from a bump never flips a car (roll-over assist rights it within 1.5 s with a comic bounce).
- **Two-wheel lean (bicycle, okada):** the bike is never physically balanced. Lean angle = atan(v² × curvature ÷ g), clamped to 35° (okada) or 28° (bicycle), smoothed with a half-life of 0.08 s. Below 2 m/s the lean fades to 0 and the rider's foot goes down. The physics body is upright; lean is visual plus a grip curve.
- **Keke tipping comedy:** when lateral acceleration exceeds 0.55 g above 25 km/h with steering beyond 70%, the keke lifts onto two wheels. Visual roll up to 22°, grip × 0.7, a wobble sound and passengers leaning and yelping. It always lands back after 0.6–1.5 s. A full tip-over happens only in scripted story beats (and then everyone tumbles out, sits, shakes their head and gets up).
- **Crashes:** mass-based impulses for every pair (FAB §5). Damage and reactions are scaled by the relative speed along the contact normal, with a **0.35 s per-pair cooldown** (V1). Two-wheeler riders are thrown off at more than 18 km/h impact: thrown_off_tumble → sit → get up → bike_pick_up. Pedestrians hit by vehicles: a stumble or knock_down_sit, never worse; NPCs step aside from fast vehicles (FAB §5).
- **Seats and doors:** entering means walking to the door socket (≤ 1.5 s, path on the navmesh), then the enter clip. The player can't enter a full seat. While seated, the character capsule is off and the vehicle collider is used (MGG1 §11.2). Friends take free seats in order.

### 5.6 Water and buoyancy

- **Swim state** starts when the water depth at the chest is greater than 1.1 m (wading below that, at 0.6× speed).
- Surface swim 1.6 m/s, sprint 2.4 m/s (stamina), underwater 1.8 m/s in 3D. Buoyancy pulls the player to the surface at 0.8 m/s when there's no dive input.
- **Breath:** 20 s base, + up to 10 s from the Breath stat (and ×3 with Iron Lungs Gum, GDD §7.2). Warning at 30% (heartbeat, screen-edge tint, bubble burst). At 0: `out_of_breath_pop_up` (pushed to the surface, cough, −20% stamina). **Nobody drowns.**
- **Water surface:** scrolling normals, depth-fade colour, foam at the shore; planar reflection on high only. Underwater: fog, tint, caustics decal on high, bubbles, audio low-pass at 800 Hz.
- **Splash and ripples:** pooled particles and ripple decals, sized by entry speed (MGG1 §11.4).
- **Vehicles in water:** stall when the engine socket is under water; float for 2 s with a bob; then a fade-and-tow beat puts the vehicle on the nearest shore road with a funny line. Never lost.
- **Currents** (M78-style flood mission): a flow field adds velocity; the swim line (rope) is a spline constraint.

### 5.7 Football ball physics

| Parameter | Value |
|---|---|
| Ball | sphere r = 0.11 m, mass 0.43 kg, CCD on |
| Restitution | grass 0.55, concrete 0.70, post and bar 0.65 (a "clang" is right here; it's the goalpost) |
| Rolling resistance | grass 0.06, worn pitch 0.09, concrete 0.03 |
| Air drag | quadratic, Cd 0.25 |
| Magnus | lift = 0.00012 × (spin × velocity) (enough curl to see, for Shamsu's "Magnus effect" joke) |
| Possession ("sticky dribble") | Below 5.5 m/s, a ball within 0.9 m in front is held by a soft spring to a point ahead of the dribbling foot, touched on every 2nd step event. Lost on a tackle or a sharp turn above 6 m/s |
| Kicks | Charge 0–0.6 s → impulse 6–30 m/s; aim assist: passes snap within a 25° cone to the best teammate; shots aim within the goal frame with error by stamina and skill (Jega's Golden Boot: error 0) |
| Headers | Available when the ball is 1.4–2.2 m high within 1.0 m; jump header auto-times within a 0.15 s window |
| Tackles | Standing poke: 1.2 m reach, 60° cone; slide: 2.5 m, commits for 0.8 s; a cartoon tumble for the tackled player, never an injury in play (injuries only in story beats) |
| Keeper | Reaction time 0.18–0.35 s by difficulty; dive reach 2.4 m |
| Sim | The ball runs in the same 60 Hz step; no prediction across the network needed for single-player |

### 5.8 Scuffles (cartoon, non-lethal)

- **Balance, not health:** each fighter has a balance bar (100). Shove −15, heavy shove −30, cartoon jab −10, sweep −35, block reduces by 80%. At 0: `knock_down_sit` → `dazed_shake_head` (1.2 s) → `get_up_from_sit` → 1.0 s invulnerable. Balance refills at 20/s after 1.5 s without a hit.
- **Timing:** anticipation 0.10–0.18 s, active window 0.08–0.12 s, recovery 0.25–0.45 s. Dodge 0.35 s with 0.2 s of invulnerability. Block is instant.
- **Hit feel:** hit-stop 60 ms (both fighters freeze), small camera shake, a whoosh on the swing and an impact sound on contact, a dust puff. Hit reacts directional.
- **Fairness:** line-of-sight required for every hit (P1); a per-attacker hit cooldown; at most 2 enemies attack at once (the others circle and taunt).
- **The ending is never violent:** losing a fight means sitting on the ground, a funny line and a small cost (money or pride). Security escorts you out with the paired `guard_escort` (FAB §1). MIB's "Undefeatable": balance never drops below 1.

### 5.9 Input

- **Buffering:** attack, jump, interact and dodge inputs are buffered for 150 ms and consumed on the first sim step where they're legal (jump uses the 120 ms jump buffer, §5.2).
- Inputs are sampled every render frame, timestamped, and handed to the sim in order.
- Touch: a floating left stick (dead zone 12%), a right-side drag for look, context buttons (jump, sprint, interact, attack and vehicle buttons that change with state). The layout editor carries over (FAB §5).
- Pad: standard mapping, rebindable. Keyboard: rebindable (MEM arcade bar).
- Haptics: short vibration on hits, crashes and goals on phones that support it (off by default with the reduced-motion setting).

### 5.10 Feel suite (automated, runs in CI headless via the sim harness)

| Test | Pass when |
|---|---|
| `accel_curve` | Player reaches 95% of run speed in 0.30 ± 0.03 s, and stops from run in 0.22 ± 0.03 s |
| `coyote_and_buffer` | A jump pressed 0.10 s after leaving a ledge works; one pressed 0.10 s before landing fires on landing |
| `steps_and_slopes` | Climbs a 0.35 m kerb, not a 0.40 m one; stays grounded walking down stairs (no air frames) |
| `foot_slide` | ≤ 2 cm drift per planted foot for every gait (A1) and the pedals (A3) |
| `pose_pop` | No bone rotates > 35° between rendered frames outside declared cuts (A9) |
| `camera_clip` | Near plane never inside geometry on the slice path (K1) |
| `seat_matrix` | Every seat × 5 body shapes × tallest headwear: head clearance, visibility ≥ 60%, hands within 1 cm of grips (C4, C5, A6) |
| `ram_once`, `melee_los`, `chase_reaches` | V1, P1, P2 |
| `keke_tip_recovers` | 200 random hard turns: the keke lands back every time, nobody ends up inside geometry |
| `okada_lean` | Lean matches the formula within 2°, and never above the clamp |
| `breath_never_kills` | 10 min underwater on the bot: the player is always pushed up |
| `ball_sanity` | 1,000 seeded kicks: the ball never tunnels through posts or nets, and comes to rest within 20 s |
| `determinism` | P5 |
| `input_latency` | K7 |

### 5.11 Performance targets and measurement

| Measure | Desktop (MacBook Air class) | Low-end phone (2–3 GB RAM Android) | How it's measured |
|---|---|---|---|
| Frame rate | 60 fps | 30 fps (locked, rather than an unsteady 40) | Perf recorder over the scripted **benchmark run** |
| p95 frame time | ≤ 16.7 ms | ≤ 33 ms | Same |
| 1% low | ≥ 50 fps | ≥ 25 fps | Same |
| Long frames (> 50 ms) | ≤ 1 per minute, none during play | ≤ 2 per minute | Same, plus `PerformanceObserver` long tasks |
| Sim step (logic) | p99 ≤ 2 ms | p99 ≤ 4 ms | Node bench (`sim_budget`, F1) |
| Draw calls, triangles | §2.4 tier table | §2.4 tier table | Engine counters in the recorder |
| JS heap | stable ±10 MB over 30 min | stable ±10 MB over 30 min | `performance.memory` (Chromium) plus device tools |
| Total memory | — | ≤ 450 MB tab | Android Chrome remote devtools |
| First playable | ≤ 5 s on broadband | ≤ 15 s on 4G (≤ 15 MB, D7) | Lighthouse-style throttled load plus real 4G |
| Stream-in hitches | none > 50 ms | none > 66 ms | Recorder, while riding the bicycle across cell borders |
| Battery saver | — | Caps at 30 fps, low tier, half-res shadows | Setting |

- **Benchmark run** (scripted camera and player path through the slice): hostel room → corridor → the Spot at 13:00 (busiest crowd) → bicycle ride past Engineering → farm, goat chase → dusk at the hostel. It runs on every milestone in: (a) desktop Chrome, (b) this Mac via the WKWebView pipeline (`scripts/screenshot.py`, WebGL2), (c) the device lab (V3 §14). Results go to `perf/<date>-<device>.json` and a summary table in the milestone report.
- **Automatic tier choice:** a 3-second GPU probe on first launch picks low, medium or high; the player can change it. If p95 is over budget for 10 s in play, drop one tier and say so with a small toast.
- **Pause everything when the tab is hidden** (MGG1 §9).

---

## 6. Audio for feel

### 6.1 Footsteps by surface

- Triggered by the `fs` animation events (never by timers), so they always match the feet.
- Surfaces (§5.4): laterite, grass, concrete/paving, asphalt, tile, wood, metal, sand, mud, shallow water, carpet. **6 variations each, per gait** (walk, run, sprint), plus jump-land and scuffs. Random pitch ±5%, volume ±2 dB, never the same file twice in a row.
- Modifiers: shoes (sandal slap vs sneaker), body (heavier players are a little louder and lower), wet ground in rain (adds a splash layer).
- NPC footsteps only within 10 m, max 6 at once.

### 6.2 Engines and vehicle sounds

| Vehicle | Engine layers (crossfaded by RPM and load) | Other sounds |
|---|---|---|
| Bicycle | Freewheel tick (rate from wheel speed), chain whirr when pedalling | Bell, brake squeak, light rattle on bumps |
| Okada | Idle, low, mid, high loops from **a 125 cc single-cylinder recording** | Horn (high, two-tone), gear clicks, kickstand |
| Keke | Idle, low, high from **a two-stroke or small four-stroke tricycle recording** (distinct from the okada, V6) | Horn (nasal "pep"), rattling cabin, passenger yelps on tipping |
| Saloon car | Idle, low, mid, high, plus a load layer | Door open and close, start, stop, indicator ticks, horn, handbrake |
| Pickup / SUV | Deeper loops | Same set, heavier doors |
| Danfo | Rough diesel loops, exhaust rattle | Conductor call barks, sliding door |
| Shuttle bus | Diesel, air brakes | Door hiss, stop chime |
| Tractor | Slow diesel thump | Hydraulic whine, trailer clank |

- Tyres: **recorded** screech on asphalt, scrub on laterite and grass, gravel crunch (S2). Wind rises with speed.
- Crashes come from a **material-pair table** (carried over from SND, round 3): car–car metal crunch levels at 4, 11 and 16 m/s; bicycle = light rattle (never a clang, V5); two-wheelers = light metal and plastic; walls and kerbs = concrete thud; trees and poles = wooden knock; person = soft low thud.
- NPC traffic: the 3 nearest moving vehicles get spatialised engine loops; the rest are silent.

### 6.3 Radios in vehicles

- Every car, keke, okada (a phone speaker on the handlebar) and danfo has a `radio` socket. The player's vehicle radio is on by default (setting), with **station switching** (a button or the phone's radio app).
- **Stations (data-driven):** e.g. "Campus FM" (talk, Bature as DJ from the story, campus news that reacts to the calendar and the story), an afrobeats-style station, a Hausa-music-style station, highlife and juju, gospel and nasheed hours (respectful, opt-in), a news bulletin. **All music is original or properly licensed.** No real songs without a written licence. Record each track in the credits.
- **Continuity:** stations "keep playing" while you aren't listening. The track offset comes from the global clock, so getting back in a car drops you mid-song, like a real radio.
- **NPC vehicles** play their station through their socket, spatialised and filtered (muffled when windows are closed), so passing kekes and danfos carry music past you. At most 2 NPC radios audible at once.
- The radio is ducked under dialogue (§6.6) and goes quiet in tense mission moments if the mission says so.

### 6.4 Music by place and time

- **A matrix in data:** district × time band (dawn 05–08, day 08–17, evening 17–21, night 21–05) × day type (lecture day, weekend, exam week, event). Each cell names a playlist or a stem set. Examples: Engineering on a lecture day = busy, rhythmic; the Sculpture Garden = calm strings and kora; the market on a weekend = bright percussion; exam week everywhere = tense, sparse; night = soft, low.
- **Zones** have a 10 m hysteresis band; crossfade 3 s. A mission can override music with its own cue (the Director's music track, MGG1 §6.5).
- **Stems** where possible (percussion, bass, melody) so the same track gets busier with crowd density or chases without a hard change.
- **Stingers** for discoveries, level-ups, mission passed, goals.
- **Streaming:** music is never in the first pack beyond the first 30 s of the title theme (S6). Tracks stream in Opus (Android, desktop) or AAC (iPhone) and are cached once played.

### 6.5 Ambience

Layered by place and time: birds by day, crickets at night (SND), wind in trees (louder in harmattan), distant traffic, crowd murmur by density (ties to the population, so an empty campus at 2 a.m. is quiet), generator hum near generators during NEPA outages, call to prayer and church bells at their times (respectful, low, from data), rain layers, water by distance (fountain, dam). Interiors swap to their own room tone with a short reverb (lecture hall, canteen, hostel corridor, mosque, chapel).

### 6.6 Mix and ducking

| Bus | Default | Ducked by | Duck amount, attack / release |
|---|---|---|---|
| Dialogue and voice | 0 dB | — | — |
| Music | −10 dB | Dialogue | −8 dB, 150 ms / 600 ms |
| Radio | −8 dB | Dialogue, cutscenes | −10 dB, 150 ms / 800 ms |
| SFX | −4 dB | Dialogue (non-critical SFX only) | −4 dB, 100 ms / 400 ms |
| Ambience | −14 dB | Cutscenes | −6 dB, 300 ms / 1 s |
| UI | −6 dB | — | — |

- Voice limit: 24 simultaneous sounds on phones, 48 on desktop, with priorities (dialogue > player SFX > vehicles > NPC SFX > ambience).
- A compressor and limiter on the master bus (prevents crash and horn spikes).
- Settings: a separate slider for each bus, captions, mono option.
- Underwater: low-pass and muffled music. Indoors: radio and music from outside muffled.

---

## 7. Build order

### 7.1 The engine bake-off (Stage 2, V3 §3; V2 §20.2)

**Build the same scene twice** (Babylon.js and PlayCanvas engine-only, no editors), with the same assets, camera, lighting goals, and the same physics (Rapier, D4). Time box: 2 weeks per engine. Babylon gets a third build variant swapping Rapier for Havok, to measure it.

**The scene (about 150 × 150 m):** a hostel block with one room interior, a street with a kiosk and plastic chairs, 12 neem trees and foliage, a mini sculpture garden (6 statues, instanced frogs), the dam edge with water, a car with doors and 4 seats, an okada, a keke, a bicycle, and 40 crowd NPCs (8 skinned near, 32 VAT). Golden hour, then night with a generator glow, then rain.

**What to build in each (the same checklist):**
1. Load GLB + Meshopt + KTX2 (both ETC1S and UASTC) from a pack.
2. Player on `mib_rig` with a real outfit: idle, walk, run, sprint, start, stop, jump, sit on a bench (with foot IK).
3. Retarget 10 Mixamo clips at run time or build time; upper-body layer (phone while walking); a face morph blink.
4. Car: enter with a door, drive, wheels turning, steering wheel and hands IK, horn, exit. Okada lean. Keke tip.
5. Swim at the dam edge: enter, surface swim, dive, breath pop-up.
6. Camera spring arm with collision and occlusion fade.
7. Crowd VAT instancing; thin instances for foliage.
8. Day → night → rain transitions; one shadow cascade.
9. The perf recorder, quality tiers.
10. A sign slot rendering `{{UNI_NAME}}` from config.

**Measure and score** (weights in brackets; record numbers in `docs/ENGINE_DECISION.md`):

| Criterion | How measured | Weight |
|---|---|---|
| Low-end phone p95 frame time and 1% low (benchmark run) | Device lab | 25 |
| First-load size of the scene (engine + code + assets, gzip/brotli) | Build output | 15 |
| Animation: blending quality, retarget ease, layers, IK, morphs | Clips list above, feel suite subset | 15 |
| Look in the 8 fixed screenshots (owner judges blind, A/B) | `scripts/screenshot.py` plus phone captures | 15 |
| Memory on the phone after 10 min | Device tools | 10 |
| Developer experience: TypeScript types, docs, errors, debugging tools (Babylon Inspector vs PlayCanvas tools) | Team notes | 10 |
| WebGPU/WebGL2 support and fallbacks; WKWebView on macOS 12 works | Run on each target | 5 |
| Licence and cost (engine, plugins, Havok terms) | Read on the day | 5 |

**Decision rule:** the higher weighted total wins, **unless** either engine fails the low-end phone budget, in which case the other wins, whatever the score. A difference under 5 points: pick Babylon.js (TypeScript-native, which helps an owner new to TypeScript, and the prototype is already in Babylon). The owner makes the final call (V2 §20.2).

**Deliverables:** `docs/ENGINE_DECISION.md`, `docs/GRAPHICS_COMPARISON.md` (side by side), both builds tagged in git, perf JSON from every device.

### 7.2 Vertical-slice milestones (after the decision)

Each milestone ends with: the acceptance tests passing, perf numbers from the device lab, screenshots at the fixed spots, and a short report (what was measured, on what, and what was not checked, X10). The owner looks at it on his phone.

| # | Milestone | Contents | Acceptance tests |
|---|---|---|---|
| **M0** | Pipeline and rules | Asset build (`npm run assets`), credits YAML + build check, asset lint, palette swatches, `feel.ts` config, perf recorder, feel-suite harness skeleton, seeded RNG, fixed-step loop with interpolation | Lint fails on a planted bad asset (glossy hair, missing credit, default material, over-budget texture); `determinism` passes; an empty scene ships within budget |
| **M1** | Characters v1 (Stage 3) | Two base meshes, 6 face presets, 8 hair, 10 outfits, body morphs and masks, LOD0–2, `mib_rig` v1 | `cloth_clip_matrix` passes; hair/skin material lint passes; turntables approved by the owner (noses, hair); 25 characters on screen within the low-tier budget |
| **M2** | Locomotion and camera | The controller (§5.2), the locomotion set with starts, stops and pivots, foot and look IK, the camera (§5.3), touch, pad and keyboard input | `accel_curve`, `coyote_and_buffer`, `steps_and_slopes`, `foot_slide`, `pose_pop`, `camera_clip`, `input_latency`; owner's "first minute" feel check on his phone |
| **M3** | The slice world, block-out → art | Hostel block + room, the Spot, the route past Engineering and the Clock Tower, farm and barn; streaming cells; vegetation; day/night; sign slots; slice ambience and music cells | `look_not_desert`; `no_pop`; slice packs ≤ 15 MB with core; benchmark run within budget on the low-end phone |
| **M4** | Bicycle and the first ride | Bicycle physics, mount and dismount, pedal phase, hop over kerbs, falls and pick-up, bicycle sounds | `foot_slide` (pedals), `seat_matrix` (bicycle), kerb hop clears a 0.15 m kerb; owner ride test |
| **M5** | People and the first 10 minutes | Crowd VAT, population schedule for the slice zones, interactions (K2), the goat chase (paired catch), eating, Pockets hook-up, the 13:00 rush at the Spot | `sim_budget`, density cap test (GDD §4.2), `chase_reaches`, `cutscene_overlap`; the first-10-minutes script plays end to end with no failure; ≥ 3 laughs in a playtest of 3–5 students (V3 §14) |
| **M6** | Cutscenes and the opening | The Director, the opening film (≤ 2:30) with paired hug and bag carry, the roommate scene, mission 1–3 briefings | `skip_equals_watch` on every cutscene; `ANIM_EXISTS`; A4/A5 tests; owner review of the opening on phone |
| **M7** | Motorised vehicles and scuffles | Okada (with pillions), keke (driver and passengers, tipping), car with doors, radio stations, crash table; scuffle set with lock-on, knock-down sit and get-up | `seat_matrix` all, `okada_lean`, `keke_tip_recovers`, `ram_once`, `melee_los`; ear review of engines, radios and crashes |
| **M8** | Water, football and gym taste tests | Dam edge swimming and diving (breath), a 5-a-side football kick-about at the slice pitch, one gym lift minigame | `breath_never_kills`, `ball_sanity`; owner plays a 5-minute football match on his phone and rates it against Momentum Cup |
| **M9** | Slice lock | Polish pass on the first 10 minutes, full benchmark run on all devices, all feel tests green, all sounds ear-reviewed, credits complete | V3 Stage 4 gate: **"This is the game"** |

**Parallel tracks** (from M0, owned by different people, one owner per file): story data and validator (exists), voice scripts (in progress), UI shell, and the save system. The asset pipeline and motion work in this plan don't block them.

### 7.3 What the team needs before M0 starts

1. The owner approves this plan and the engine bake-off go-ahead (V3 §16, decision 4).
2. Disk check, then install Blender LTS and the asset CLI tools (pinned versions), one at a time.
3. Adobe account for Mixamo (the owner's or the team's), recorded in the credits notes.
4. A low-end Android test phone (2–3 GB RAM) for the device lab. No milestone is "done" without it (top rule 1).
