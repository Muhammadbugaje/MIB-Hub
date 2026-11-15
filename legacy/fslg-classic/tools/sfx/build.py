#!/usr/bin/env python3
"""Build the arcade's sampled sound effects from downloaded CC0 packs.

    python tools/sfx/build.py <download-folder>

<download-folder> holds the unpacked sources (see docs/SOUND.md for the list of URLs):
    x/<kenney-pack>/Audio/*.ogg      Kenney packs (CC0)
    oga/<opengameart-slug>/...       OpenGameArt items (CC0), with meta.json beside oga/
    commons/*.wav + commons/meta.json  Wikimedia Commons files (CC0)
It writes static/audio/sfx/<folder>/<name>.ogg (Opus) and .m4a (AAC), manifest.json and CREDITS.md.
Only honest processing is done: trim, fade, level, and mono mix-down. Needs the ffmpeg bundled with
imageio-ffmpeg (tools/voice/.venv has it)."""
import json, os, re, subprocess, sys, datetime, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "static", "audio", "sfx")
SRC = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(ROOT, "tools", "sfx", "downloads")
try:
    import imageio_ffmpeg
    FF = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FF = shutil.which("ffmpeg") or "ffmpeg"

K = {"imp": "x/impact-sounds/Audio/", "ifc": "x/interface-sounds/Audio/", "rpg": "x/rpg-audio/Audio/", "ui": "x/ui-audio/Audio/",
     "dig": "x/digital-audio/Audio/", "sci": "x/sci-fi-sounds/Audio/", "cas": "x/casino-audio/Audio/",
     "a1": "oga/100-cc0-sfx/100-CC0-SFX_0/", "a2": "oga/100-cc0-sfx-2/sfx_100_v2/", "lp": "oga/30-cc0-sfx-loops/sfx_loops/",
     "sf": "oga/50-cc0-sci-fi-sfx/sci-fi-sfx/", "car": "oga/car-sound-effects-pack-low-quality/car_sound_effects_pack/",
     "bik": "oga/bicycle-sounds/bicycle_sounds/", "sw": "oga/swishes-sound-pack/swishes/swishes/", "rc": "oga/racing-car-engine-sound-loops/",
     "og": "oga/", "cm": "commons/"}

def S(key, pat, nums=None, **o):
    """sources: S('imp', 'impactPunch_medium_00%d.ogg', [0,1,2])"""
    return [dict(src=K[key] + (pat % n if nums is not None else pat), **o) for n in (nums if nums is not None else [0])]

# folder/name -> sources (each source becomes name_1, name_2, ...), plus how the runtime treats it
# g gain, p random pitch spread, bus, max voices, lazy (not fetched until first used), r base rate, loop
FILES = {
 # ---- shared core: the names every game already calls
 "core/click":   (S("ifc", "click_00%d.ogg", [1, 2, 3]), dict(bus="ui", g=.8, p=.04)),
 "core/hover":   (S("ui", "rollover%d.ogg", [1, 2]), dict(bus="ui", g=.5)),
 "core/back":    (S("ifc", "back_00%d.ogg", [1, 2]), dict(bus="ui", g=.8)),
 "core/confirm": (S("ifc", "confirmation_00%d.ogg", [1, 2]), dict(bus="ui", g=.8)),
 "core/error":   (S("ifc", "error_00%d.ogg", [4, 5, 6]), dict(bus="ui", g=.8)),
 "core/toggle":  (S("ifc", "switch_00%d.ogg", [1, 2, 3]), dict(bus="ui", g=.8)),
 "core/coin":    (S("rpg", "handleCoins%s.ogg", ["", "2"]) + S("cas", "chips-collide-%d.ogg", [1, 2]), dict(bus="ui", g=.9, p=.08)),
 "core/pluck":   (S("ifc", "pluck_00%d.ogg", [1, 2]), dict(bus="ui", g=.9, p=.08)),
 "core/thud":    (S("imp", "impactSoft_heavy_00%d.ogg", [0, 1, 2]), dict(bus="impacts", g=1, p=.08)),
 "core/thump":   (S("imp", "impactSoft_medium_00%d.ogg", [0, 1, 2]), dict(bus="impacts", g=.9, p=.08)),
 "core/punch":   (S("imp", "impactPunch_medium_00%d.ogg", [0, 1, 2, 3]), dict(bus="impacts", g=1, p=.08)),
 "core/punch_heavy": (S("imp", "impactPunch_heavy_00%d.ogg", [0, 1, 2, 3]), dict(bus="impacts", g=1, p=.07)),
 "core/guard":   (S("imp", "impactPlate_light_00%d.ogg", [0, 1, 2]), dict(bus="impacts", g=.8, p=.08)),
 "core/metal":   (S("imp", "impactMetal_medium_00%d.ogg", [0, 1, 2]), dict(bus="impacts", g=.9, p=.08)),
 "core/metal_heavy": (S("imp", "impactMetal_heavy_00%d.ogg", [0, 1, 2]), dict(bus="impacts", g=1, p=.07, lazy=1)),
 "core/glass":   (S("imp", "impactGlass_medium_00%d.ogg", [0, 1, 2]), dict(bus="impacts", g=.8, p=.06, lazy=1)),
 "core/wood":    (S("imp", "impactWood_medium_00%d.ogg", [0, 1, 2]), dict(bus="impacts", g=.9, p=.08, lazy=1)),
 "core/bell":    (S("imp", "impactBell_heavy_00%d.ogg", [0, 1]), dict(bus="world", g=.8, p=.02, lazy=1)),
 "core/swish":   (S("sw", "swish-%d.wav", [1, 3, 5, 7]), dict(bus="impacts", g=.7, p=.1)),
 "core/spring":  (S("a1", "spring_0%d.ogg", [1, 3, 5]), dict(bus="impacts", g=.8, p=.08, lazy=1)),
 "core/boom":    (S("a1", "explosion.ogg") + S("sf", "explosion_0%d.ogg", [1, 2]), dict(bus="impacts", g=1, p=.08, lazy=1)),
 "core/laser":   (S("sci", "laserSmall_00%d.ogg", [0, 1, 2]), dict(bus="impacts", g=.6, p=.08, lazy=1)),
 "core/zap":     (S("dig", "zap%d.ogg", [1, 2]) + S("dig", "zapTwoTone.ogg"), dict(bus="impacts", g=.55, p=.08, lazy=1)),
 "core/powerup": (S("dig", "powerUp%d.ogg", [2, 5, 8]), dict(bus="ui", g=.55, p=.04, lazy=1)),
 "core/special": (S("dig", "phaserUp%d.ogg", [2, 4]), dict(bus="ui", g=.55, p=.04, lazy=1)),
 "core/whistle": (S("cm", "218318_splicesound_referee-whistle-blow-gymnasium.wav", t=.75, fade=.12), dict(bus="world", g=.7, p=.03)),
 "core/whistle_long": (S("cm", "218318_splicesound_referee-whistle-blow-gymnasium.wav", t=2.2, fade=.4), dict(bus="world", g=.7, lazy=1)),
 "core/applause": (S("og", "applause-in-a-large-hall-or-church/applause-clapping-church-crowd-immersive.wav", ss=2, t=5.5, fade=1.6, fin=.15), dict(bus="world", g=.6, lazy=1, max=1)),
 "core/pop":     (S("a1", "plop_0%d.ogg", [1, 2]), dict(bus="ui", g=.8, p=.1, lazy=1)),
 # ---- Freshers School Life
 "fslg/step_road":  (S("imp", "footstep_concrete_00%d.ogg", [0, 1, 2, 3, 4]), dict(bus="feet", g=.5, p=.1, max=3)),
 "fslg/step_grass": (S("imp", "footstep_grass_00%d.ogg", [0, 1, 2, 3, 4]), dict(bus="feet", g=.55, p=.1, max=3)),
 "fslg/step_wood":  (S("imp", "footstep_wood_00%d.ogg", [0, 1, 2, 3, 4]), dict(bus="feet", g=.55, p=.1, max=3, lazy=1)),
 "fslg/step_floor": (S("rpg", "footstep0%d.ogg", [0, 2, 4, 6, 8]), dict(bus="feet", g=.5, p=.1, max=3, lazy=1)),
 "fslg/cloth":      (S("rpg", "cloth%d.ogg", [1, 2, 3]), dict(bus="feet", g=.6, p=.08, lazy=1)),
 "fslg/slap":       (S("imp", "impactGeneric_light_00%d.ogg", [0, 1, 2]), dict(bus="impacts", g=.9, p=.1, lazy=1)),
 "fslg/eng_car":    (S("car", "Car_Engine_Loop.ogg", loop=1), dict(bus="vehicles", g=.5, lazy=1)),
 "fslg/eng_sport":  (S("rc", "loop_2_0.wav", loop=1), dict(bus="vehicles", g=.4, lazy=1)),
 "fslg/eng_moto":   (S("og", "motor-sound-effect/motor_looping_0.mp3", loop=1), dict(bus="vehicles", g=.45, lazy=1)),
 "fslg/eng_plane":  (S("og", "propeller-cartoon-loop/propeller_cartoon_loop_0.ogg", loop=1), dict(bus="vehicles", g=.5, lazy=1)),
 "fslg/bike_tick":  (S("bik", "bicycle_spokes-1.ogg", loop=1), dict(bus="vehicles", g=.5, lazy=1)),
 "fslg/roll":       (S("lp", "rolling.ogg", loop=1), dict(bus="vehicles", g=.5, lazy=1)),
 "fslg/wind":       (S("og", "wind-whoosh-loop/wind woosh loop.ogg", loop=1), dict(bus="vehicles", g=.5, lazy=1)),
 "fslg/car_start":  (S("car", "Car_Engine_Start_Up.ogg"), dict(bus="vehicles", g=.6, lazy=1)),
 "fslg/car_off":    (S("car", "Car_Engine_Turning_Off.ogg"), dict(bus="vehicles", g=.5, lazy=1)),
 "fslg/car_door_open":  (S("car", "Car_Door_Open.ogg"), dict(bus="vehicles", g=.8, lazy=1)),
 "fslg/car_door_close": (S("car", "Car_Door_Close.ogg"), dict(bus="vehicles", g=.8, lazy=1)),
 "fslg/handbrake":  (S("car", "Car_Parking_Brake.ogg"), dict(bus="vehicles", g=.7, lazy=1)),
 "fslg/horn_car":   (S("car", "Car_Horn.ogg") + S("cm", "Car_Horn.wav", t=.9, fade=.15), dict(bus="vehicles", g=.8, p=.02, lazy=1, max=2)),
 "fslg/horn_bike":  (S("bik", "rotating_bicycle_bell-1.ogg"), dict(bus="vehicles", g=.8, p=.03, lazy=1, max=2)),
 "fslg/horn_squeeze": (S("bik", "bicycle_horn-1.ogg"), dict(bus="vehicles", g=.8, p=.03, lazy=1, max=2)),
 "fslg/crash":      (S("og", "crash-collision/qubodup-crash.ogg"), dict(bus="impacts", g=1, p=.08, lazy=1)),
 "fslg/siren":      (S("og", "sirens-and-alarm-noise/siren_0.mp3", ss=1, t=6, loop=1), dict(bus="world", g=.35, lazy=1)),
 "fslg/door_open":  (S("rpg", "doorOpen_%d.ogg", [1, 2]), dict(bus="world", g=.8, p=.05, lazy=1)),
 "fslg/door_close": (S("rpg", "doorClose_%d.ogg", [1, 2, 3]), dict(bus="world", g=.8, p=.05, lazy=1)),
 "fslg/phone_open": (S("ifc", "open_00%d.ogg", [1, 2]), dict(bus="ui", g=.8, lazy=1)),
 "fslg/phone_close": (S("ifc", "close_00%d.ogg", [1, 2]), dict(bus="ui", g=.8, lazy=1)),
 "fslg/dial":       (S("ifc", "tick_00%d.ogg", [1, 2, 4]), dict(bus="ui", g=.8, p=.12, lazy=1)),
 "fslg/book":       (S("rpg", "bookFlip%d.ogg", [1, 2, 3]), dict(bus="world", g=.7, lazy=1)),
 "fslg/class_bell": (S("a1", "bell_0%d.ogg", [1, 2]), dict(bus="world", g=.7, lazy=1)),
 "fslg/amb_birds":  (S("og", "ambient-bird-sounds/birds-isaiah658_0.ogg", ss=2, t=14, loop=1), dict(bus="ambience", g=.35, lazy=1)),
 "fslg/amb_crickets": (S("og", "crickets-ambient-noise-loopable/crickets_1.mp3", loop=1), dict(bus="ambience", g=.3, lazy=1)),
 "fslg/amb_water":  (S("lp", "water_flowing.ogg", loop=1), dict(bus="ambience", g=.35, lazy=1)),
 "fslg/amb_crowd":  (S("og", "crowd-shoutingspeaking-ambience/crowd_shouting_0.ogg", ss=3, t=10, loop=1), dict(bus="ambience", g=.22, lazy=1)),
 # ---- Momentum Cup
 "cup/ball":   (S("imp", "impactSoft_medium_00%d.ogg", [3, 4]) + S("imp", "impactPunch_medium_004.ogg"), dict(bus="impacts", g=1, p=.1)),
 "cup/post":   (S("imp", "impactMetal_light_00%d.ogg", [0, 1, 2]), dict(bus="impacts", g=1, p=.06)),
 "cup/net":    (S("rpg", "cloth%d.ogg", [1, 4]), dict(bus="impacts", g=.9, p=.08)),
 "cup/cheer":  (S("og", "applause-in-a-large-hall-or-church/applause-clapping-church-crowd-immersive.wav", ss=9, t=4.5, fade=1.5, fin=.1), dict(bus="world", g=.7, max=1)),
 "cup/crowd":  (S("og", "crowd-shoutingspeaking-ambience/crowd_shouting_0.ogg", ss=14, t=9, loop=1), dict(bus="ambience", g=.2, lazy=1)),
 # ---- Wavefront
 "wave/shot":  (S("sci", "laserSmall_00%d.ogg", [3, 4]) + S("sci", "laserRetro_00%d.ogg", [0, 1]), dict(bus="impacts", g=.5, p=.08, max=5)),
 "wave/boom":  (S("sci", "explosionCrunch_00%d.ogg", [0, 1, 2]), dict(bus="impacts", g=.9, p=.08)),
 "wave/hit":   (S("sci", "impactMetal_00%d.ogg", [0, 1, 2]), dict(bus="impacts", g=.8, p=.08)),
 "wave/shield": (S("sci", "forceField_00%d.ogg", [0, 1]), dict(bus="impacts", g=.6, p=.04)),
 # ---- puzzle games
 "puzzle/snap":  (S("ui", "switch%d.ogg", [2, 5, 9]), dict(bus="ui", g=.8, p=.06)),
 "puzzle/spark": (S("dig", "zap%d.ogg", [1, 2]), dict(bus="ui", g=.4, p=.12)),
 "puzzle/drop":  (S("ifc", "drop_00%d.ogg", [1, 2, 3]), dict(bus="ui", g=.8, p=.06)),
}

A = lambda stem, **o: dict(use=stem, **o)   # a name that reuses another entry's files
# name -> entry for each scope. "synth": the runtime's synthesized effect is kept on purpose.
CORE = {
 "click": "core/click", "hover": "core/hover", "back": "core/back", "confirm": "core/confirm", "error": "core/error", "toggle": "core/toggle",
 "coin": "core/coin", "pluck": "core/pluck", "stomp": "core/thud", "thump": "core/thump", "block": "core/error", "whistle": "core/whistle",
 "whistle_long": "core/whistle_long", "kick": "core/punch", "heavy": "core/punch_heavy", "hit": "core/punch", "ko": A("core/punch_heavy", r=.8, g=1),
 "dash": "core/swish", "swish": "core/swish", "bounce": "core/spring", "boom": "core/boom", "laser": "core/laser", "zap": "core/zap",
 "power": "core/powerup", "special": "core/special", "applause": "core/applause", "pop": "core/pop", "guard": "core/guard", "metal": "core/metal",
 "metal_heavy": "core/metal_heavy", "glass": "core/glass", "wood": "core/wood", "bell": "core/bell",
 "jump": "synth", "win": "synth", "lose": "synth", "goal": "synth",
}
PACKS = {
 "samaru-days": {
  "step_road": "fslg/step_road", "step_grass": "fslg/step_grass", "step_wood": "fslg/step_wood", "step_floor": "fslg/step_floor",
  "jump": A("core/swish", g=.45, r=1.15), "land": A("core/thump", g=.7), "fall": A("core/thud", g=1), "getup": "fslg/cloth",
  "whoosh": A("core/swish", g=.7), "punch": "core/punch", "punch_heavy": "core/punch_heavy", "kick": A("core/punch_heavy", r=.9), "hit": "core/punch",
  "heavy": "core/punch_heavy", "guard": "core/guard", "shove": A("core/thump", g=.9), "slap": "fslg/slap", "stomp": A("core/thump", g=.8),
  "eng_car": "fslg/eng_car", "eng_sport": "fslg/eng_sport", "eng_okada": "fslg/eng_moto", "eng_scooter": A("fslg/eng_moto", r=1.3, g=.35),
  "eng_keke": A("fslg/eng_moto", r=.72, g=.5), "eng_plane": "fslg/eng_plane", "bike_tick": "fslg/bike_tick", "skate_roll": "fslg/roll", "wind": "fslg/wind",
  "car_start": "fslg/car_start", "car_off": "fslg/car_off", "car_door_open": "fslg/car_door_open", "car_door_close": "fslg/car_door_close", "handbrake": "fslg/handbrake",
  "horn_car": "fslg/horn_car", "horn_sport": A("fslg/horn_car", r=1.12), "horn_okada": A("fslg/horn_car", r=1.35, g=.7), "horn_keke": A("fslg/horn_car", r=1.6, g=.65),
  "horn_bus": A("fslg/horn_car", r=.74, g=.9), "horn_bike": "fslg/horn_bike", "horn_scooter": "fslg/horn_squeeze", "horn_skate": "fslg/horn_squeeze",
  "crash_light": "core/metal", "crash_heavy": "fslg/crash", "crash_metal": "core/metal_heavy", "hit_person": A("core/thud", g=1, r=.9), "kerb": "core/wood", "glass": "core/glass",
  "siren": "fslg/siren", "door_open": "fslg/door_open", "door_close": "fslg/door_close", "till": "core/coin", "phone_open": "fslg/phone_open",
  "phone_close": "fslg/phone_close", "dial": "fslg/dial", "pickup": "core/pluck", "book": "fslg/book", "class_bell": "fslg/class_bell",
  "amb_birds": "fslg/amb_birds", "amb_crickets": "fslg/amb_crickets", "amb_water": "fslg/amb_water", "amb_crowd": "fslg/amb_crowd",
  "screech": "synth", "brake": "synth", "skid_dirt": "synth",
 },
 "momentum-cup": {"kick": "cup/ball", "bounce": "cup/post", "stomp": A("core/thump", g=.8), "net": "cup/net", "goal": A("cup/cheer", both=1),
                  "cheer": "cup/cheer", "whistle": "core/whistle", "_amb": A("cup/crowd", g=.16)},
 "impulse-arena": {"hit": "core/punch", "kick": A("core/punch_heavy", r=.92), "heavy": "core/punch_heavy", "block": "core/guard", "stomp": "core/thud",
                   "ko": A("core/punch_heavy", r=.75, both=1), "whistle": "core/bell", "dash": "core/swish"},
 "kinetic-kingdom": {"stomp": "core/thump", "bounce": "core/spring", "hit": A("core/punch", g=.8), "land": "core/thump"},
 "induction-dash": {"dash": "core/swish", "coin": "core/pluck", "hit": "core/metal", "boom": "core/metal_heavy"},
 "wavefront": {"laser": "wave/shot", "boom": "wave/boom", "hit": "wave/hit", "block": "wave/shield", "power": "core/powerup"},
 "volt-city": {"click": "puzzle/snap", "zap": "puzzle/spark", "coin": "core/pluck", "power": "core/confirm"},
 "light-bender": {"click": "puzzle/snap", "zap": "puzzle/spark", "power": "core/confirm", "coin": "core/pluck"},
 "circuit-forge": {"click": "puzzle/snap", "zap": "puzzle/spark", "power": "core/confirm", "coin": "puzzle/drop"},
 "logic-labyrinth": {"click": "puzzle/snap", "zap": "puzzle/spark", "power": "core/confirm", "coin": "puzzle/drop"},
}

def run(args):
    return subprocess.run([FF, "-hide_banner", "-nostdin"] + args, capture_output=True, text=True)

def peak(path, pre):
    r = run(pre + ["-i", path, "-af", "volumedetect", "-f", "null", "-"]); m = re.search(r"max_volume: (-?[\d.]+) dB", r.stderr)
    return float(m.group(1)) if m else 0.0

def duration(path):
    r = run(["-i", path]); m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    return (int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))) if m else 0.0

def credit_for(rel, meta, cmeta):
    if rel.startswith("x/"):
        pack = rel.split("/")[1]
        return ("Kenney — " + pack.replace("-", " ").title(), "https://kenney.nl/assets/" + pack, "Kenney (kenney.nl)", "CC0 1.0")
    if rel.startswith("oga/"):
        slug = rel.split("/")[1]; m = meta.get(slug, {})
        return (m.get("title", slug), m.get("url", "https://opengameart.org/content/" + slug), m.get("author", "?") + " (OpenGameArt)", "CC0 1.0")
    if rel.startswith("commons/"):
        m = cmeta.get(os.path.basename(rel), {})
        return (os.path.basename(rel), m.get("url", "?"), m.get("author", "?") + " (Wikimedia Commons)", "CC0 1.0")
    return (rel, "?", "?", "?")

def main():
    meta = json.load(open(os.path.join(SRC, "meta.json"))) if os.path.exists(os.path.join(SRC, "meta.json")) else {}
    cmeta = json.load(open(os.path.join(SRC, "commons", "meta.json"))) if os.path.exists(os.path.join(SRC, "commons", "meta.json")) else {}
    missing = [s["src"] for srcs, _ in FILES.values() for s in srcs if not os.path.exists(os.path.join(SRC, s["src"]))]
    if missing:
        print("Missing sources:\n  " + "\n  ".join(missing)); return 1
    stems, credits, sizes = {}, [], {"ogg": {}, "m4a": {}}
    today = datetime.date.today().isoformat()
    for key, (srcs, opt) in FILES.items():
        folder, name = key.split("/"); os.makedirs(os.path.join(OUT, folder), exist_ok=True); stems[key] = []
        for i, s in enumerate(srcs):
            stem = "%s/%s_%d" % (folder, name, i + 1) if len(srcs) > 1 else "%s/%s" % (folder, name)
            src = os.path.join(SRC, s["src"]); pre = (["-ss", str(s["ss"])] if s.get("ss") else []) + (["-t", str(s["t"])] if s.get("t") else [])
            loop = bool(s.get("loop")); gain = (-3.0 if not loop else -6.0) - peak(src, pre); af = []
            if not loop and not s.get("t") and not s.get("ss"):
                af.append("silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.005")
            af.append("volume=%.2fdB" % gain)
            if s.get("fin"): af.append("afade=t=in:d=%s" % s["fin"])
            if s.get("fade") and s.get("t"): af.append("afade=t=out:st=%.3f:d=%s" % (s["t"] - s["fade"], s["fade"]))
            for ext, enc in (("ogg", ["-c:a", "libopus", "-b:a", "40k" if loop else "48k", "-vbr", "on"]), ("m4a", ["-c:a", "aac", "-b:a", "64k"])):
                dst = os.path.join(OUT, stem + "." + ext)
                r = run(["-y"] + pre + ["-i", src, "-vn", "-ac", "1", "-ar", "48000" if ext == "ogg" else "44100", "-af", ",".join(af)] + enc + ["-map_metadata", "-1", dst])
                if r.returncode or not os.path.exists(dst): print("FAILED", stem, ext, r.stderr[-300:]); return 1
                sizes[ext][stem] = os.path.getsize(dst)
            stems[key].append(stem); t, url, who, lic = credit_for(s["src"], meta, cmeta)
            credits.append((stem, os.path.basename(s["src"]), t, url, who, lic, today, round(duration(os.path.join(OUT, stem + ".ogg")), 2)))

    def ent(v):
        if v == "synth": return {"synth": 1}
        over = {}
        if isinstance(v, dict): over = {k: x for k, x in v.items() if k != "use"}; v = v["use"]
        e = {"f": stems[v]}; e.update({k: x for k, x in FILES[v][1].items()}); e.update(over)
        if FILES[v][0][0].get("loop"): e["loop"] = 1
        return e
    man = {"v": 1, "built": today, "formats": ["ogg", "m4a"], "core": {k: ent(v) for k, v in CORE.items()}, "packs": {s: {k: ent(v) for k, v in p.items()} for s, p in PACKS.items()}}
    json.dump(man, open(os.path.join(OUT, "manifest.json"), "w"), indent=1, sort_keys=True)
    with open(os.path.join(OUT, "CREDITS.md"), "w") as f:
        f.write("# Sound effect credits\n\nEvery file here is a recording released under CC0 1.0 (public domain dedication): free to use and\nredistribute, no attribution required. The sources are listed anyway. Each file exists as `.ogg` (Opus) and `.m4a` (AAC).\nProcessing: trimmed, faded, levelled and mixed to mono by `tools/sfx/build.py`. No voices of real people, no music.\n\n| File | From | Pack or page | Author | Licence | Fetched |\n|---|---|---|---|---|---|\n")
        for stem, orig, t, url, who, lic, day, _ in credits: f.write("| `%s` | %s | [%s](%s) | %s | %s | %s |\n" % (stem, orig, t, url, who, lic, day))
    def used(scope):
        out = set()
        for e in scope.values():
            if not e.get("lazy") or True: out.update(e.get("f", []))
        return out
    core = used(man["core"]); rep = {"files": len(credits), "core_kb": {x: round(sum(sizes[x][s] for s in core) / 1024) for x in sizes}, "total_kb": {x: round(sum(sizes[x].values()) / 1024) for x in sizes}, "packs_kb": {}}
    for slug, p in man["packs"].items(): rep["packs_kb"][slug] = {x: round(sum(sizes[x][s] for s in used(p) - core) / 1024) for x in sizes}
    json.dump({"sizes": sizes, "report": rep, "durations": {c[0]: c[7] for c in credits}}, open(os.path.join(OUT, "sizes.json"), "w"), indent=1, sort_keys=True)
    print(json.dumps(rep, indent=1)); return 0

if __name__ == "__main__":
    sys.exit(main())
