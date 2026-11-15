"""The learning-arcade catalogue and roadmap (one list, no database).

Course codes, levels and topics are taken from knowledge/data/breakdown.json (the
owner's department notes summary). `playable` games ship JavaScript in
static/js/games/; the rest are the roadmap and render as "planned". Entries marked
`confirm=True` rest on a course whose topic fit needs lecturer confirmation.
Online friend matches are NOT built yet: `modes` only lists what exists today.
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Game:
    slug: str
    title: str
    genre: str
    level: int
    courses: tuple
    topics: tuple
    pitch: str
    loop: str
    modes: tuple = ("Single player",)
    playable: bool = False
    script: str = ""
    accent: str = "#3dd68c"
    confirm: bool = False
    planned_online: bool = False
    extra: dict = field(default_factory=dict)
    # Card presentation metadata (index page): estimated session length, control hint
    # for playable games, and filter tags (quick, puzzle, physics, versus, open).
    session: str = ""
    controls: str = ""
    tags: tuple = ()


GAMES = [
    Game("momentum-cup", "Momentum Cup", "Scientist head-football", 100, ("PHYS 111",),
         ("Motion in 2D: projectiles", "Collisions", "Force and Newton's laws"),
         "Big-headed scientists play head-football in seven arenas, with superpowers, a roaring crowd and a six-round cup against Count Entropy.",
         "Read the ball's arc, get under it, dash, pick the kick angle and fire your superpower at the right moment.",
         ("Career: 5 leagues and the Legends ladder", "Classic six-round cup", "Quick match", "Two players, one device"), True, "kickoff", "#3dd68c", planned_online=True,
         extra={"deps": ["kickoff-career"]},
         session="3–5 min a match", controls="A/D move · double-tap dash · W jump · S/Q kick · E power", tags=("quick", "versus", "physics")),
    Game("impulse-arena", "Impulse Arena", "Scientist arena fighter", 100, ("PHYS 111",),
         ("Force and Newton's laws", "Impulse and momentum", "Work, energy and power"),
         "One-on-one lab duels where every hit is an impulse and heavier fighters really are harder to shove.",
         "Read your opponent, land an impulse, watch Δv = J/m decide the knockback, counter.",
         ("Circuit story ladder", "Survival", "Time attack", "Combo trials", "Versus CPU", "Two players, one device", "Training room"), True, "clash", "#f6c445", planned_online=True,
         extra={"deps": ["clashdata", "clashcareer"]},
         session="2–4 min a duel", controls="WASD move · J/U punch · K/I kick · L block · O special", tags=("quick", "versus", "physics")),
    Game("volt-city", "Volt City", "Open-world lite: charge puzzles", 100, ("PHYS 122",),
         ("Electrostatics", "Coulomb's law; superposition", "Electric field and field lines"),
         "Walk a blacked-out city and restore each district by steering a charge with fields you build.",
         "Explore, find a dark district, place charges, release, watch superposition steer the probe, restore power.",
         ("Single player",), True, "fieldbound", "#7ef0ff", extra={"deps": ["fieldsim", "voltworld", "voltlab"]},
         session="5–10 min a district", controls="WASD walk · E interact", tags=("open", "physics")),
    Game("kinetic-kingdom", "Kinetic Kingdom", "Side-scrolling platformer", 100, ("PHYS 111",),
         ("Kinematics: jumps as projectiles", "Friction f = μN", "Work–energy and springs", "Circular motion", "Net force ΣF = ma", "Weight w = mg"),
         "Run, jump and stomp through seven worlds of Count Entropy's minions (41 levels), earning new abilities from every boss, with the physics of every jump on screen.",
         "Read the jump, run, leap, stomp, find the secrets, beat each world's boss, race your own ghost.",
         ("Single player",), True, "platformer", "#4ade80", extra={"deps": ["platformer-levels"]},
         session="3–5 min a level", controls="←/→ move · Space jump · Shift run / air dash · ↓ pound", tags=("physics",)),
    Game("wavefront", "Wavefront", "Run-and-gun wave shooter", 100, ("PHYS 124", "PHYS 122"),
         ("Wave nature of light, c = fλ, E = hf", "Huygens' principle and diffraction gratings, d sinθ = nλ",
          "Young's double slit, y = nλL/d", "Polarisation and Malus's law, I = I₀cos²θ", "Electromagnetic waves and pulses"),
         "Fight Count Entropy's machines across eight stages with weapons made of light: every one follows a real wave law.",
         "Run and aim, tune your frequency, pick the right wave weapon, cross your polariser to his beams, beat the boss.",
         ("Single player", "Two players, one device"), True, "shooter", "#7ef0ff", extra={"deps": ["shooterdata"]},
         session="3–6 min a stage", controls="A/D run · W/S aim · Space jump · J fire · E/Q frequency · I shield",
         tags=("physics", "versus")),
    Game("samaru-days", "Freshers School Life", "3D open-world school life", 100, ("PHYS 111", "ENGG 102"),
         ("Motion in 2D: momentum, drag and grip", "Campus general knowledge and first-year revision questions"),
         "Your first year at a beautiful school: classes, MACD at Shinkafi, okada, friends, races, seven gardens, and the mystery of who keeps taking the light.",
         "Explore, eat and rest, attend class to level up, earn licences from skateboard to aircraft, follow the story, then chase the long goals.",
         ("Story", "Free roam", "Up to 6 players on the same Wi-Fi"), True, "samaru", "#f59e0b",
         extra={"three": True, "deps": ["fslg-map", "samaru-sim", "samaru-data", "fslg.config", "fslg-story-y1", "fslg-story-y2", "fslg-story-y3", "fslg-story-y4", "fslg-story-y5", "fslg-story-side", "fslg-story-coop", "fslg-story-choices", "fslg-story-likes", "samaru-draw", "samaru-core", "samaru-story", "samaru-overrides", "samaru-intro", "samaru-3d", "samaru-anim", "samaru-wardrobe", "samaru-veh", "samaru-fx", "samaru-touch", "samaru-settings", "samaru-guide", "samaru-moment", "samaru-life", "samaru-interior", "samaru-mall", "samaru-friends", "samaru-brawl", "samaru-jobs", "samaru-crowd", "samaru-city", "samaru-ui", "samaru-inv", "samaru-phone", "samaru-texts", "samaru-travel", "samaru-wild", "samaru-map", "samaru-voice", "samaru-minigames", "samaru-audio", "samaru-water", "samaru-kit", "samaru-switch", "samaru-conseq", "samaru-romance", "samaru-prosper", "samaru-cook", "samaru-workshop", "samaru-maker", "samaru-weather", "samaru-worldlife", "samaru-saves"]},
         session="As long as you like", controls="WASD move · mouse look · Shift run · E do · J hit · Q phone", tags=("open", "versus")),
    # ---- Roadmap: one game per later iteration ----
    Game("motorworks", "Motorworks Trails", "Open-world lite: workshop", 300, ("EEEN 309",),
         ("Electromechanical energy conversion", "DC machine construction"),
         "Explore a machine workshop; change supply, load and field to make each machine do its job.",
         "Explore a bay, test input and load, observe speed and torque, unlock the next bay.",
         ("Single player",), True, "motorworks", "#f6c445", extra={"deps": ["motorsim"]},
         session="3–8 min a bay", controls="Arrows walk · E open · Tab pick control · Q/E turn it", tags=("open", "physics")),
    Game("storm-map", "Gridkeepers: Storm Map", "Open-world lite: grid restoration", 300, ("EEEN 327",),
         ("Electric energy sources", "Transmission and distribution"),
         "After a storm, travel a small network, find faults and restore supply in a safe order.",
         "Patrol, diagnose, isolate, restore, keep the lights on.", ("Single player",), True, "stormmap", "#ffd84a", confirm=True,
         extra={"deps": ["gridsim"]}, session="5–10 min a storm", controls="Tap to drive · tap a line to switch · E act", tags=("open", "puzzle")),
    Game("induction-dash", "Induction Dash", "Magnet-cart runner", 100, ("PHYS 122", "ENGG 205"),
         ("Electromagnetic induction", "Faraday's and Lenz's laws", "Generator principle e = Blv"),
         "Ride a magnet cart through copper coils. Every coil pays out energy, and Lenz's law brakes you for it.",
         "Pick a lane, hit coils at speed, jump crates, dodge drones, bank enough joules.",
         ("Single player",), True, "dash", "#ffd86b", extra={"deps": ["inductionsim"]},
         session="2–4 min a run", controls="▲/▼ lane · Space jump", tags=("quick", "physics")),
    Game("logic-labyrinth", "Logic Labyrinth", "Logic puzzle-platformer", 300, ("EEEN 307", "EEEN 405"),
         ("Number systems and codes", "Boolean algebra & logic gates", "De Morgan; universal gates", "K-maps: SOP and POS",
          "Adders, MUX and decoders", "Flip-flops and counters"),
         "Doors, bridges, lasers and lifts obey the logic you wire. Count Entropy has scrambled all of it.",
         "Read the lock, flip levers, place gates from a limited box, check the truth table, walk out.",
         ("Single player",), True, "logic", "#7ef0ff",
         extra={"deps": ["logicsim"], "packs": {300: ("logic-300", "Gates, De Morgan and K-maps (EEEN 307)"),
                                                400: ("logic-400", "Adders, MUX, decoders and flip-flops (EEEN 405)")}},
         session="3–6 min a room", controls="A/D walk · E flip · N/G gates", tags=("puzzle",)),
    Game("signal-surfer", "Signal Surfer", "Wave arcade", 300, ("EEEN 342",),
         ("Overview of telecommunication systems", "Noise"),
         "Shape amplitude and frequency to ride a signal through a noisy channel to the receiver.",
         "Tune, transmit, beat the noise, decode.",
         ("Single player",), True, "surfer", "#7ef0ff", extra={"deps": ["labkit", "signalsim"]},
         session="3–6 min a channel", controls="W/S tune · A/D power · Q/E bit rate", tags=("physics",)),
    Game("circuit-forge", "Circuit Forge", "Circuit puzzle, 100 to 500 level", 100, ("PHYS 162", "PHYS 122", "ENGG 205", "EEEN 309", "EEEN 415", "EEEN 527"),
         ("Ohm's law", "Series/parallel resistors", "Kirchhoff's laws", "Network theorems", "RC time constants", "AC reactance and resonance", "Op-amps", "DC machines", "Voltage drop", "Power factor", "Fault analysis"),
         "Fix 51 circuits Count Entropy sabotaged by filling every slot from the parts tray. New chapters open at every level, from Ohm's law to op-amps, power factor and fault currents.",
         "Read the goal, pick a part, switch on, read the meters, refine.",
         ("Single player",), True, "forge", "#e9c46a",
         extra={"deps": ["circuitsim", "circuit-100"], "packs": {200: ("circuit-200", "Network theorems, dividers and RC timing (ENGG 205)"),
                                                  300: ("circuit-300", "DC machines, AC reactance, filters and resonance (EEEN 309)"),
                                                  400: ("circuit-400", "Op-amps, cable sizing and voltage drop (EEEN 415)"),
                                                  500: ("circuit-500", "Power factor correction and fault currents (EEEN 527)")}},
         session="3–6 min a circuit", controls="1–8 parts · Space switch on · H hint", tags=("puzzle",)),
    Game("light-bender", "Light Bender", "Laser-and-mirror puzzle", 100, ("PHYS 124", "PHYS 162"),
         ("Reflection: plane mirrors", "Beam splitters", "Refraction, Snell's law", "Critical angle and total internal reflection", "Thin lenses", "Colour filters"),
         "45 laser puzzles in seven chapters: turn mirrors and splitters, thread glass, prisms, lenses and colour filters to light Count Entropy's broken receivers. Plus a daily beam and a free optics lab.",
         "Predict the bounce, turn a mirror, watch the beam, refine, light the receiver.",
         ("Single player",), True, "bender", "#ff8080", extra={"deps": ["opticsim", "bender-levels"]},
         session="2–5 min a level", controls="Q/E turn · N select · H hint", tags=("quick", "puzzle", "physics")),
    Game("maglev-rescue", "Maglev Rescue", "Magnetic-control challenge", 300, ("EEEN 320",),
         ("Time-varying fields", "Magnetic force"),
         "Hold a levitating pod steady by tuning coil current against gravity.",
         "Sense the gap, adjust current, settle, deliver.", ("Single player",), True, "maglev", "#a78bfa", confirm=True,
         extra={"deps": ["labkit", "maglevsim"]}, session="3–6 min a line", controls="Tune gains · W/S gap · T retune", tags=("physics",)),
    Game("algorithm-garage", "Algorithm Garage", "Programming robot challenge", 300, ("EEEN 316",),
         ("Getting started", "Arrays", "Control flow"),
         "Write short MATLAB-style instruction lists that drive a workshop robot.",
         "Plan steps, run, debug, optimise.", ("Single player",), True, "garage", "#7ef0ff",
         extra={"deps": ["js/matlab/mlab", "js/matlab/mlab-lib", "garagesim"]}, session="3–8 min a job", controls="C code · R run · F fast replay", tags=("puzzle",)),
    Game("drive-room", "Drive Room", "Motor-control sim", 500, ("EEEN 524",),
         ("Introduction to electric drives",),
         "Pick converter and control settings so a drive meets a load's speed profile.",
         "Read the load, set the drive, run, tune.",
         ("Single player",), True, "driveroom", "#ffb347", extra={"deps": ["labkit", "drivesim"]},
         session="3–6 min a job", controls="Pick a converter · tune · Q/E Kp", tags=("physics",)),
]

BY_SLUG = {g.slug: g for g in GAMES}
LEVELS = (100, 200, 300, 400, 500)
