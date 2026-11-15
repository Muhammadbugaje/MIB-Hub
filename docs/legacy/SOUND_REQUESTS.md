# Sound requests

Add a line for each sound your game needs; the sound worker fetches a CC0 recording (or makes an honest synthetic one),
adds it to `static/audio/sfx/manifest.json` under your game's pack, and ticks the line.

| Game (slug) | Name to call with `api.sound.sfx(name)` | What it should sound like | Status |
|---|---|---|---|
| momentum-cup | `crowd_small` | Small campus crowd murmur loop (Campus/Regional League), light claps | requested |
| momentum-cup | `crowd_big` | Big stadium crowd bed loop (Continental/World League, finals) | requested |
| momentum-cup | `chant` | Non-verbal crowd chant: rhythmic claps and stomps, no words | requested |
| momentum-cup | `whistle_long` | Referee full-time whistle, three blasts | requested |
| momentum-cup | `whistle_short` | Single short whistle for kick-off | requested |
| momentum-cup | `net` | Ball hitting the back of a net (soft rustle-thump) | requested |
| momentum-cup | `post` | Ball hitting a metal goalpost (clang) | requested |
| momentum-cup | `power_curve` | Rising whoosh for the Curve Shot | requested |
| momentum-cup | `power_well` | Deep low hum/pull for the Gravity Well | requested |
| momentum-cup | `power_magnet` | Short magnetic zap-hum for the Magnetic Dribble | requested |
| momentum-cup | `trophy_lift` | Big crowd cheer swell for lifting a trophy | requested |
| impulse-arena | `super` | Short rising power-up whoosh into a heavy boom, for a fighter's super (about 0.8 s) | requested |
| impulse-arena | `tech` | Sharp double clack: two hands slapping apart when a throw is escaped | requested |
| impulse-arena | `trial` | Bright two-note success chime for clearing a combo trial | requested |
| impulse-arena | `bell` | Boxing-style round bell, single ding | requested |
| kinetic-kingdom | `kk_dash` | Short airy whoosh for the hero's air dash (about 0.25 s); currently uses `dash` | requested |
| kinetic-kingdom | `kk_fan` | Soft looping fan/air hum for updraft columns (World 5); currently silent | requested |
| kinetic-kingdom | `kk_gust` | Wind gust swell, 1 to 1.5 s, for gust zones and the Gale Harpy's wingbeat; currently uses `dash` | requested |
| kinetic-kingdom | `kk_vent` | Steam venting hiss, about 1 s, for the Lunar Mech cooling down; currently uses `heavy` | requested |
| kinetic-kingdom | `kk_kite` | Fluttering paper-kite rattle for gust kites diving | requested |
| kinetic-kingdom | `kk_moonhop` | Soft springy boing, lower than `bounce`, for moon hoppers | requested |
| kinetic-kingdom | `kk_phase` | Dark rising sting for Entropy Prime's phase two | requested |
| kinetic-kingdom | `kk_ghost` | Faint shimmer when a time-attack ghost overtakes you | requested |
| wavefront | `wf_plate` | Metallic ping when a shot bounces off a shield warden's plate; currently uses `block` | requested |
| wavefront | `wf_split` | Wet pop as a scatter cell breaks into two wheels | requested |
| wavefront | `wf_snipe` | Rising charge whine (about 0.9 s) while a laser sniper aims, ending in a sharp zap | requested |
| wavefront | `wf_wave` | Short alarm for "Wave N" in Survival; currently uses `whistle` | requested |
| induction-dash | `id_coil` | Electric hum swell as the cart passes a coil (pitch up for double coils); currently uses `zap` | requested |
| induction-dash | `id_plate` | Low friction whoosh for an eddy-current brake plate; currently uses `block` | requested |
| induction-dash | `id_bolt` | Lightning crack for a bolt strike, with a short pre-strike crackle | requested |
| induction-dash | `id_rail` | Looping rail rumble whose pitch follows speed (endless mode) | requested |
| volt-city | `tram` | Short electric tram bell plus motor whine, for riding to an Outer Ring district (about 1 s) | requested |
| volt-city | `magnet_tile` | Soft magnetic clunk when a magnet tile is laid on a board | requested |
| volt-city | `breakdown` | Sharp electrical arc/spark crackle when a capacitor's dielectric breaks down (about 0.5 s) | requested |
| volt-city | `lamp_on` | Filament lamp buzzing on with a gentle hum, for a solved lamp circuit | requested |
| volt-city | `rung` | Bright two-note rising chime for clearing a challenge-ladder rung | requested |
| light-bender | `mirror_turn` | Short glassy click-and-slide for turning a mirror 15° (under 0.2 s) | requested |
| light-bender | `receiver_lit` | Rising electric hum with a soft chime when a receiver lights | requested |
| light-bender | `beam_split` | Faint crystalline shimmer when a beam splitter first divides the beam | requested |
| circuit-forge | `part_fit` | Snap of a component clicking into a breadboard slot | requested |
| circuit-forge | `switch_on` | Heavy toggle switch throw followed by a low mains hum (about 0.6 s) | requested |
| circuit-forge | `burn_out` | Small pop and fizz for a lamp or LED burning out | requested |
| logic-labyrinth | `clock_tick` | Crisp clock edge tick for a flip-flop clock pulse | requested |
| samaru-days | `crash_car` | Car hits car: medium metal crunch with some crumple (3 variations, 0.5 to 0.95 s) | done (`fslg3/`, round 3) |
| samaru-days | `crash_car_light` | Small fender bump: light, dull metal thunk, no ringing clang (3 variations) | done (`fslg3/`, round 3) |
| samaru-days | `crash_bus` | Bus or other big vehicle hit: heavy, deep panel boom with a little crunch (2 variations) | done (`fslg3/`, round 3) |
| samaru-days | `crash_moto` | Motorbike hit: lighter metal plus a plastic fairing crack and clatter (3 variations) | done (`fslg3/`, round 3) |
| samaru-days | `crash_bicycle` | Bicycle hit or falling over: light rattle and clatter, short tail, no heavy metal clang (3 variations) | done (`fslg3/`, round 3) |
| samaru-days | `crash_skate` | Skateboard hit or drop: wooden deck clack plus small wheel rattle (3 variations) | done (`fslg3/`, round 3) |
| samaru-days | `crash_wall` | Vehicle into a concrete wall or kerb: dull, heavy thud, not ringing (3 variations) | done (`fslg3/`, round 3) |
| samaru-days | `crash_pole` | Vehicle into a pole or tree: hollow wooden knock (3 variations) | done (`fslg3/`, round 3) |
| samaru-days | `scrape` | Car body scraping along a wall: short metal scrape, 0.7 to 0.85 s (2 variations) | done (`fslg3/`, round 3) |
| samaru-days | `rustle` | Short, soft bush or hedge rustle when pushing through leaves (3 variations, 0.6 s) | done (`fslg3/`, round 3) |
| samaru-days | `rustle_big` | Heavier crash through a hedge or small tree: branches swishing plus a twig crack (2 variations, 1.0 s) | done (`fslg3/`, round 3) |
| samaru-days | `crops` | Dry grass or maize-stalk swish (2 variations, 0.55 to 0.6 s) | done (`fslg3/`, round 3) |
| samaru-days | `splash`, `splash_small`, `swim_stroke`, `swim_under`, `bubbles`, `water_out`, `gasp` | Swimming at The Dam: jumping in, fish jumps, front-crawl strokes, an underwater kick, bubbles, climbing out with drips, a breath on surfacing | done (`fslg_water/`, synthesized by `tools/sfx/build_water.py`, CC0); a recorded CC0 splash would be an upgrade |
| samaru-days | `phone_ping`, `phone_buzz`, `phone_out`, `credit_alert`, `snatch` | The in-world phone: a short text-message ping, a two-pulse vibration buzz, cloth rustle of a phone coming out of a pocket (0.3 s), a bright two-note bank "credit alert", a quick grab-and-run whoosh. Today the phone uses `click`, `coin`, `power` and `dash` | requested |
