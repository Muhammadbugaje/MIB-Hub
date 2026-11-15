# Arcade sound effects

Every game in the arcade now plays recorded sound effects where a clean one exists, and falls back to the old
synthesized effect where it does not. All recordings are CC0 (public domain dedication); the full list with sources
and authors is in [static/audio/sfx/CREDITS.md](../static/audio/sfx/CREDITS.md). There are no voices of real people
and no music in this set.

Nobody has listened to these in the game yet. They were chosen by name and length from the packs, levelled and
trimmed by the build script, and checked only for loading and decoding in a headless browser.

## How it works

| Part | File | What it does |
|---|---|---|
| Shared player | `static/js/games/arcade-audio.js` | Loaded on every game page after `arcade.js`. When a game calls `api.sound.sfx("click")`, it plays a recording for that name if there is one (the game's own pack first, then the shared core set), with small random pitch and level changes. Otherwise the synthesized effect plays as before. |
| Sound list | `static/audio/sfx/manifest.json` | Which files belong to which name, per game. |
| Files | `static/audio/sfx/<folder>/` | Each sound as `.ogg` (Opus) and `.m4a` (AAC, for Safari). 173 sounds, about 0.9 MB as `.ogg` and 1.4 MB as `.m4a` in total. |
| Freshers School Life extras | `static/js/games/samaru-audio.js` | Engines, tyres, wind, traffic, footsteps, doors, horns, siren and ambience. |
| Build tool | `tools/sfx/build.py` | Rebuilds the files, the manifest and the credits from the downloaded packs. |

Volume follows the existing Sound effects slider in each game's Settings. Sounds are fetched after the first tap or
key press; large or rare ones are fetched the first time they are needed. Spoken lines and ceremonies lower the
effects briefly.

## Replacing a sound

Put your own file at the same path with the same name, in both formats, for example
`static/audio/sfx/fslg/horn_car_1.ogg` and `static/audio/sfx/fslg/horn_car_1.m4a`. Nothing else needs changing.
To add a new variation or a new name, edit `FILES`, `CORE` or `PACKS` in `tools/sfx/build.py` and run it.

## Freshers School Life: what plays when

| Moment | Sound |
|---|---|
| Walking and running | Footsteps by surface: road and paving, grass, wood (pier, bridges), indoor floors. Five variations each; faster and louder when sprinting. |
| Jump, landing | A short swish, then a thump scaled by the height. |
| Knocked down, getting up | Body thud, then a cloth scuff. |
| Swinging a punch | A swish on every swing. |
| Punch lands | Fist impact (four variations); heavier impact for a heavy blow. |
| Kick lands | A deeper, heavier impact. |
| Bumping into someone | Soft thump. |
| Bicycle | Freewheel tick that speeds up with you; a bell for the horn. |
| Skateboard | Rolling wheels (silent in the air); squeeze horn. |
| Scooter, okada, keke | One motorbike engine recording, pitched differently for each; their own horn pitch. |
| Car | Engine loop that rises with speed and throttle; door open and close, engine start when you get in; engine off and doors when you get out. |
| Sports car | A racier engine loop with a wider pitch range. |
| Plane | Propeller loop, plus wind as speed builds. |
| Horn | Per vehicle: bicycle bell, squeeze horn (scooter, skateboard), car horn, higher for okada and keke, lower for the shuttle and plane. |
| Handbrake, sliding | Handbrake click, then tyre screech while the tyres slide (see "Not recordings" below). On earth and grass it is a dull scrubbing sound. |
| Hard braking at speed | Brake squeal (see below). |
| Fast driving | Wind that grows with speed. |
| Traffic | The three nearest moving vehicles each have a quiet engine placed left or right and fading with distance. |
| Vehicle crashes | Chosen by what met what (`samaru-veh.js`, `V.sounds`), level by how hard: car into car is a metal crunch (a light bump below about 4 m/s, plus the big crash and glass above 11 and 16); the shuttle bus or a pick-up is a heavier, deeper hit; an okada or scooter is light metal and plastic; a bicycle is a light rattle (never a metal clang); a skateboard is a wood clack; a wall or kerb is a concrete thud; a tree or pole is a wooden knock; a glancing hit along a wall scrapes. Files in `static/audio/sfx/fslg3/` (`tools/sfx/build_crash.py`). |
| Vehicle hits a person | A soft, low thud. Nothing gory. |
| Security | Whistle on warnings; a siren loop while a chase is on, quieter while they search. |
| Entering and leaving a building | Door opens, door closes. |
| Buying, finding a kola nut, class | Coins; a pluck; a bell. |
| Phone | Open sound. |
| Daytime outdoors | Birdsong loop (quieter in a vehicle). |
| Night outdoors | Crickets. |
| Fountain and lake | Running water, by distance. |
| Lecture hall, canteen, Social Centre hall | A low crowd murmur. |

## The other games

All of them get the shared core set with no change to their code: click, error, coins, thumps, punches, metal, glass,
swish, spring, explosion, laser, zap, power-up, whistle, bell and applause. On top of that:

| Game | Changes from the core set | Named sounds with recordings |
|---|---|---|
| Momentum Cup | Ball kick, goalpost, net, referee whistle, a crowd cheer added to the goal jingle, and a quiet crowd murmur throughout | 8 |
| Impulse Arena | Punch, kick, heavy hit, guard clank for blocks, bell, knock-out thud, dash swish | 8 |
| Kinetic Kingdom | Stomp, spring bounce, hurt, landing | 4 (jump stays synthesized) |
| Induction Dash | Dash swish, pick-up, metal crash | 4 |
| Wavefront | Shots, explosion, metal hits, shield, power-up | 5 |
| Volt City, Light Bender | Switch snap for clicks, spark, confirm, pick-up | 4 each |
| Circuit Forge, Logic Labyrinth | Switch snap, spark, confirm, part drop | 4 each |
| Win and lose ceremonies | Applause and a pop on wins, on top of the synthesized fanfare | shared |

## Not recordings

These stay synthesized because no recording with a clean licence was found:

- **Tyre screech, brake squeal, skid on dirt**: shaped noise made in the browser. A real recording would be better.
- **Jump (other games), win, lose and goal jingles**: the existing synthesized effects, kept on purpose.
- **Crowd gasp, crowd groan, a proper football-crowd roar**: not found. The cheer is hall applause.
- **Separate engines for scooter, okada and keke**: one motorbike recording at three pitches.
- **Okada, keke and shuttle horns**: one car horn at different pitches.
- **A real campus-security siren**: the siren is a generic alarm siren.
- **Aircraft touchdown chirp, gear noises, dial tones**: not included.

To supply any of these yourself, record or download a file you have the right to use and drop it in as described
under "Replacing a sound" (new names need a line in `tools/sfx/build.py`).

## Sources

- Kenney audio packs (CC0): Impact Sounds, Interface Sounds, RPG Audio, UI Audio, Digital Audio, Sci-fi Sounds, Casino Audio — https://kenney.nl/assets
- OpenGameArt pages marked CC0: car sounds, racing engine loops, motor loop, propeller loop, bicycle sounds, swishes, crash, siren, birds, crickets, crowd, applause, wind, and the "100 CC0 SFX" collections — https://opengameart.org
- Wikimedia Commons (CC0): referee whistle, car horn — https://commons.wikimedia.org

To rebuild: download and unpack those into one folder (Kenney packs under `x/<pack>/`, OpenGameArt items under
`oga/<page-slug>/`, Commons files under `commons/`), then run

```
tools/voice/.venv/bin/python tools/sfx/build.py <that folder>
```
