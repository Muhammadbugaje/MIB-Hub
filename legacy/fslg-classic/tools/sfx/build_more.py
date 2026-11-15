#!/usr/bin/env python3
"""Round-2 sound library: more CC0 / public-domain recordings and original synthesized sounds.

    tools/voice/.venv/bin/python tools/sfx/build_more.py <download-folder>     # build files + merge
    tools/voice/.venv/bin/python tools/sfx/build_more.py --merge               # only merge (no downloads needed)

<download-folder> holds:
    fs_<id>.mp3 + fs_meta.json      Freesound previews of sounds released under CC0 1.0
    commons/*.ogg + commons/meta.json  Wikimedia Commons public-domain files
    synth/*.wav                     original sounds made by the synth script in this folder's history
                                    (tools/sfx/synth.py writes them)
It writes static/audio/sfx/<folder>/<name>.ogg and .m4a, saves what it added in tools/sfx/more_manifest.json,
and merges that into static/audio/sfx/manifest.json, CREDITS.md and sizes.json. build.py calls the merge step
at its end, so rebuilding the first round never loses these.

Processing is honest only: trim (or pick the loudest window of a recording), fade, level, mono mix-down,
equal-power crossfade to make loops seamless, and plain resampling for pitch. No voices of identifiable people:
crowd recordings are groups (walla, cheers, groans)."""
import json, os, re, subprocess, sys, datetime, shutil, wave
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "static", "audio", "sfx")
MORE = os.path.join(ROOT, "tools", "sfx", "more_manifest.json")
try:
    import imageio_ffmpeg
    FF = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FF = shutil.which("ffmpeg") or "ffmpeg"
SR = 44100


def F(src, **o):
    return dict(src=src, **o)


def fs(*ids, **o):
    return [F("fs_%s.mp3" % i, **o) for i in ids]


# folder/name -> (sources, runtime options). Source options: ss/t trim (seconds), best=t picks the loudest window of t
# seconds, loop=1 makes a seamless loop, rate resamples (pitch), fade/fin fades, hp high-pass Hz, lp low-pass Hz.
FILES = {
 # ---- FSLG vehicles: tyres, brakes, engines, horns, aircraft
 "fslg2/screech":    (fs(76804, ss=2.0, t=4.0, loop=1) + fs(71737, ss=2.5, t=4.0, loop=1), dict(bus="vehicles", g=.55, lazy=1)),
 "fslg2/screech_hit": (fs(71736, best=1.6, fade=.4) + fs(71741, best=1.4, fade=.4), dict(bus="vehicles", g=.8, p=.05, lazy=1)),
 "fslg2/brake":      (fs(456764, best=1.8, fade=.5), dict(bus="vehicles", g=.6, p=.05, lazy=1)),
 "fslg2/skid_dirt":  (fs(637161) + fs(185346), dict(bus="vehicles", g=.8, p=.08, lazy=1)),
 "fslg2/crash_squeal": (fs(426021), dict(bus="impacts", g=1, lazy=1)),
 "fslg2/eng_okada":  (fs(119455, ss=4, t=3.0, loop=1), dict(bus="vehicles", g=.5, lazy=1)),
 "fslg2/eng_okada_drive": (fs(510230, ss=5, t=3.0, loop=1), dict(bus="vehicles", g=.5, lazy=1)),
 "fslg2/eng_scooter": (fs(448130, ss=4, t=3.0, loop=1), dict(bus="vehicles", g=.45, lazy=1)),
 "fslg2/eng_keke":   (fs(723808, ss=8, t=3.0, loop=1), dict(bus="vehicles", g=.5, lazy=1)),
 "fslg2/keke_start": (fs(339682, best=3.5, fade=.6), dict(bus="vehicles", g=.6, lazy=1)),
 "fslg2/moto_pass":  (fs(432804 if False else 509522, best=4.0, fade=1.0, fin=.6), dict(bus="vehicles", g=.6, lazy=1)),
 "fslg2/horn_small": (fs(563346), dict(bus="vehicles", g=.8, p=.03, lazy=1, max=2)),
 "fslg2/horn_bus":   (fs(451697, best=1.6, fade=.2) + fs(635681, best=1.4, fade=.2), dict(bus="vehicles", g=.8, p=.02, lazy=1, max=2)),
 "fslg2/plane_takeoff": (fs(502670, best=6.0, fade=1.5, fin=.8), dict(bus="vehicles", g=.7, lazy=1, max=1)),
 "fslg2/plane_flyby": (fs(431206, best=5.0, fade=1.2, fin=.8), dict(bus="vehicles", g=.6, lazy=1, max=1)),
 "fslg2/touchdown":  (fs(71736, best=.35, fade=.15, rate=1.15) + fs(76806, best=.4, fade=.15, rate=1.1), dict(bus="vehicles", g=.8, p=.06, lazy=1)),
 "fslg2/siren_patrol": (F("commons/American_police_siren_i.ogg", ss=.5, t=5.0, loop=1), dict(bus="world", g=.32, lazy=1)),
 "fslg2/siren_hilo": (F("synth/siren_hilo.wav", loop=1), dict(bus="world", g=.3, lazy=1)),
 "fslg2/siren_whoop": (F("synth/siren_whoop.wav"), dict(bus="world", g=.45, lazy=1, max=1)),
 # ---- FSLG phone (ITU-style tones), people, world
 "fslg2/dtmf":       ([F("synth/dtmf_%s.wav" % k) for k in "1590s"], dict(bus="ui", g=.5, lazy=1)),
 "fslg2/dial_tone":  (F("synth/dial_tone.wav", loop=1), dict(bus="ui", g=.35, lazy=1)),
 "fslg2/ringback":   (F("synth/ringback.wav"), dict(bus="ui", g=.4, lazy=1, max=1)),
 "fslg2/busy":       (F("synth/busy.wav"), dict(bus="ui", g=.4, lazy=1, max=1)),
 "fslg2/phone_ring": (F("synth/phone_ring.wav"), dict(bus="ui", g=.55, lazy=1, max=1)),
 "fslg2/body_fall":  (fs(417994, best=1.0, fade=.2) + fs(82027) + fs(346695, best=1.0, fade=.2), dict(bus="impacts", g=.95, p=.07, lazy=1)),
 "fslg2/whoosh":     (fs(59988) + fs(420668) + fs(9509), dict(bus="impacts", g=.6, p=.1)),
 "fslg2/step_dirt":  (fs(353799, ss=.2, t=.42, fade=.08) + fs(353799, ss=1.5, t=.42, fade=.08) + fs(353799, ss=2.8, t=.42, fade=.08), dict(bus="feet", g=.5, p=.1, max=3, lazy=1)),
 "fslg2/door_creak": (fs(244425), dict(bus="world", g=.7, p=.05, lazy=1)),
 "fslg2/till":       (fs(209578, best=1.8, fade=.3), dict(bus="ui", g=.7, lazy=1)),
 "fslg2/scanner":    (fs(144418), dict(bus="ui", g=.5, lazy=1)),
 "fslg2/gasp":       (fs(264376, best=2.2, fade=.6), dict(bus="world", g=.55, lazy=1, max=1)),
 "fslg2/ooh":        (fs(264499, best=3.0, fade=.8, fin=.1), dict(bus="world", g=.55, lazy=1, max=1)),
 # ---- FSLG ambience beds (loops)
 "fslg2/amb_class":  (fs(636033, ss=6, t=8.0, loop=1), dict(bus="ambience", g=.22, lazy=1)),
 "fslg2/amb_canteen": (fs(653920, ss=4, t=8.0, loop=1), dict(bus="ambience", g=.22, lazy=1)),
 "fslg2/amb_club":   (fs(394290, ss=10, t=8.0, loop=1), dict(bus="ambience", g=.2, lazy=1)),
 "fslg2/amb_office": (fs(108695, ss=8, t=8.0, loop=1), dict(bus="ambience", g=.22, lazy=1)),
 "fslg2/amb_room":   (fs(426767, ss=3, t=6.0, loop=1), dict(bus="ambience", g=.3, lazy=1)),
 "fslg2/amb_rain":   (fs(595717, ss=2, t=8.0, loop=1), dict(bus="ambience", g=.35, lazy=1)),
 "fslg2/amb_wind":   (fs(697217, ss=6, t=8.0, loop=1), dict(bus="ambience", g=.3, lazy=1)),
 "fslg2/amb_night":  (fs(175020, ss=10, t=8.0, loop=1), dict(bus="ambience", g=.3, lazy=1)),
 "fslg2/thunder":    (fs(244053, best=6.0, fade=2.0) + fs(193170, fade=1.0), dict(bus="world", g=.8, lazy=1, max=1)),
 # ---- crowds, for Momentum Cup, Impulse Arena and FSLG events
 "crowd/roar":       (fs(130568, best=5.0, fade=1.5, fin=.2) + fs(397434, best=5.0, fade=1.5, fin=.2), dict(bus="world", g=.7, lazy=1, max=1)),
 "crowd/goal":       (fs(241630, best=6.0, fade=2.0, fin=.1), dict(bus="world", g=.75, lazy=1, max=1)),
 "crowd/groan":      (fs(763880, best=3.0, fade=1.0) + fs(619007, best=3.0, fade=1.0), dict(bus="world", g=.6, lazy=1, max=1)),
 "crowd/ooh":        (fs(264499, best=3.0, fade=.8, fin=.1), dict(bus="world", g=.55, lazy=1, max=1)),
 "crowd/stadium":    (fs(328623, ss=20, t=8.0, loop=1), dict(bus="ambience", g=.2, lazy=1)),
 "crowd/chant":      (fs(424354, ss=20, t=8.0, loop=1), dict(bus="ambience", g=.16, lazy=1)),
 "crowd/small_cheer": (fs(264377, best=4.0, fade=1.2, fin=.1) + fs(182825, best=4.0, fade=1.2, fin=.1) + fs(32260, best=4.0, fade=1.2), dict(bus="world", g=.65, lazy=1, max=1)),
 "crowd/small_applause": (fs(462362, fade=.8) + F("commons/Slow_starting_applause.ogg", ss=6, t=4.5, fade=1.2, fin=.3), dict(bus="world", g=.6, lazy=1, max=1)),
 "crowd/gym":        (fs(653920, ss=12, t=8.0, loop=1, lp=2500), dict(bus="ambience", g=.14, lazy=1)),
 # ---- sport
 "sport/kick":       (fs(261267) + fs(555042) + fs(446639), dict(bus="impacts", g=1, p=.08)),
 "sport/bell":       (fs(438626, best=2.5, fade=.8), dict(bus="world", g=.7, lazy=1, max=1)),
 # ---- workshop, grid and lab machines (Volt City, Motorworks, Storm Map, Drive Room, Maglev, puzzles)
 "lab/workshop":     (fs(547413, t=8.0, loop=1), dict(bus="ambience", g=.2, lazy=1)),
 "lab/factory":      (fs(629673, ss=2, t=8.0, loop=1), dict(bus="ambience", g=.18, lazy=1)),
 "lab/mains_hum":    (F("synth/mains_hum.wav", loop=1), dict(bus="ambience", g=.18, lazy=1)),
 "lab/buzz":         (fs(175278, ss=5, t=4.0, loop=1), dict(bus="ambience", g=.2, lazy=1)),
 "lab/relay":        (fs(384701) + fs(674028), dict(bus="ui", g=.7, p=.06)),
 "lab/breaker":      (fs(130152) + fs(130153) + fs(130154), dict(bus="impacts", g=.8, p=.05, lazy=1)),
 "lab/breaker_big":  (fs(131599, best=1.5, fade=.4), dict(bus="impacts", g=.9, lazy=1)),
 "lab/generator":    (fs(169940, ss=25, t=6.0, loop=1), dict(bus="ambience", g=.3, lazy=1)),
 "lab/sparks":       (fs(396470, best=1.5, fade=.4) + fs(189630) + fs(512471), dict(bus="impacts", g=.6, p=.1, lazy=1)),
 "lab/lights_on":    (fs(351430, best=3.0, fade=.8) + fs(262510, best=3.5, fade=1.0), dict(bus="world", g=.55, lazy=1)),
 "lab/power_down":   (fs(844244), dict(bus="world", g=.7, lazy=1)),
 "lab/motor_whine":  (F("synth/motor_whine.wav", loop=1), dict(bus="vehicles", g=.3, lazy=1)),
 "lab/maglev_hum":   (F("synth/maglev_hum.wav", loop=1), dict(bus="vehicles", g=.3, lazy=1)),
 "lab/coil_charge":  (F("synth/coil_charge.wav"), dict(bus="world", g=.45, lazy=1, max=1)),
 "lab/servo":        (fs(322021, best=1.2, fade=.2) + fs(505670), dict(bus="impacts", g=.55, p=.08, lazy=1)),
 "lab/robot_arm":    (fs(412204, ss=4, t=4.0, loop=1), dict(bus="ambience", g=.22, lazy=1)),
 "lab/typing":       (fs(331656, ss=1, t=4.0, loop=1), dict(bus="ui", g=.35, lazy=1)),
 "lab/mouse":        (fs(347544, best=.25, fade=.05), dict(bus="ui", g=.6, p=.08, lazy=1)),
 "lab/static":       (fs(38693, ss=4, t=5.0, loop=1), dict(bus="ambience", g=.18, lazy=1)),
 "lab/tune":         (fs(259706, best=2.5, fade=.6), dict(bus="ui", g=.4, lazy=1)),
 "lab/radio_noise":  (fs(50750, ss=10, t=5.0, loop=1), dict(bus="ambience", g=.16, lazy=1)),
 "lab/sonar":        (F("synth/sonar.wav"), dict(bus="ui", g=.5, lazy=1)),
 "lab/lock_on":      (F("synth/lock_on.wav"), dict(bus="ui", g=.55, lazy=1)),
 "lab/signal_ok":    (F("synth/signal_ok.wav"), dict(bus="ui", g=.55, lazy=1)),
 # ---- original stingers (short mallet phrases written for EE Hub)
 "stinger/win":      (F("synth/st_win.wav"), dict(bus="ui", g=.6, max=1)),
 "stinger/champion": (F("synth/st_champion.wav"), dict(bus="ui", g=.65, lazy=1, max=1)),
 "stinger/lose":     (F("synth/st_lose.wav"), dict(bus="ui", g=.55, max=1)),
 "stinger/levelup":  (F("synth/st_levelup.wav"), dict(bus="ui", g=.6, lazy=1, max=1)),
 "stinger/unlock":   (F("synth/st_unlock.wav"), dict(bus="ui", g=.6, lazy=1, max=1)),
 "stinger/pass":     (F("synth/st_pass.wav"), dict(bus="ui", g=.6, lazy=1, max=1)),
 "stinger/fail":     (F("synth/st_fail.wav"), dict(bus="ui", g=.55, lazy=1, max=1)),
 "stinger/newrecord": (F("synth/st_newrecord.wav"), dict(bus="ui", g=.6, lazy=1, max=1)),
 "stinger/countdown": (F("synth/countdown.wav"), dict(bus="ui", g=.55)),
 "stinger/go":       (F("synth/go.wav"), dict(bus="ui", g=.6)),
}

A = lambda stem, **o: dict(use=stem, **o)
# New core names every game can call (existing core names keep their first-round files)
CORE = {
 "whoosh": "fslg2/whoosh", "body_fall": "fslg2/body_fall", "relay": "lab/relay", "sparks": "lab/sparks",
 "countdown": "stinger/countdown", "go": "stinger/go", "stinger_win": "stinger/win", "stinger_lose": "stinger/lose",
 "stinger_champion": "stinger/champion", "stinger_levelup": "stinger/levelup", "stinger_unlock": "stinger/unlock",
 "stinger_pass": "stinger/pass", "stinger_fail": "stinger/fail", "stinger_record": "stinger/newrecord",
 "cheer_small": "crowd/small_cheer", "applause_small": "crowd/small_applause", "till": "fslg2/till",
}
# Pack additions and replacements (a name here overrides the first round's entry for that game)
PACKS = {
 "samaru-days": {
  "screech": "fslg2/screech", "screech_hit": "fslg2/screech_hit", "brake": "fslg2/brake", "skid_dirt": "fslg2/skid_dirt",
  "skid_bike": A("fslg2/skid_dirt", r=1.15, g=.7), "crash_squeal": "fslg2/crash_squeal",
  "eng_okada": "fslg2/eng_okada_drive", "eng_okada_idle": "fslg2/eng_okada", "eng_scooter": "fslg2/eng_scooter", "eng_keke": "fslg2/eng_keke",
  "keke_start": "fslg2/keke_start", "moto_pass": "fslg2/moto_pass",
  "horn_okada": "fslg2/horn_small", "horn_scooter": A("fslg2/horn_small", r=1.18, g=.75), "horn_keke": A("fslg2/horn_small", r=1.32, g=.7),
  "horn_bus": "fslg2/horn_bus", "plane_takeoff": "fslg2/plane_takeoff", "plane_flyby": "fslg2/plane_flyby", "touchdown": "fslg2/touchdown",
  "siren": "fslg2/siren_hilo", "siren_patrol": "fslg2/siren_patrol", "siren_whoop": "fslg2/siren_whoop",
  "dial": "fslg2/dtmf", "dial_tone": "fslg2/dial_tone", "ringback": "fslg2/ringback", "busy": "fslg2/busy", "phone_ring": "fslg2/phone_ring",
  "fall": "fslg2/body_fall", "whoosh": "fslg2/whoosh", "step_dirt": "fslg2/step_dirt", "door_creak": "fslg2/door_creak",
  "till": "fslg2/till", "scanner": "fslg2/scanner", "gasp": "fslg2/gasp", "ooh": "fslg2/ooh", "cheer": "crowd/small_cheer",
  "applause": "crowd/small_applause", "class_bell": A("sport/bell", g=.45, r=1.3),
  "amb_class": "fslg2/amb_class", "amb_canteen": "fslg2/amb_canteen", "amb_club": "fslg2/amb_club", "amb_office": "fslg2/amb_office",
  "amb_room": "fslg2/amb_room", "amb_rain": "fslg2/amb_rain", "amb_wind": "fslg2/amb_wind", "amb_night": "fslg2/amb_night",
  "amb_lab": A("lab/workshop", g=.12), "thunder": "fslg2/thunder", "stinger_win": "stinger/win", "stinger_lose": "stinger/lose",
  "mission_pass": "stinger/pass", "mission_fail": "stinger/fail", "levelup": "stinger/levelup", "unlock": "stinger/unlock",
  "generator": "lab/generator", "power_down": "lab/power_down", "lights_on": "lab/lights_on", "coil_charge": "lab/coil_charge", "sparks": "lab/sparks",
 },
 "momentum-cup": {
  "kick": "sport/kick", "goal": A("crowd/goal", both=1), "cheer": "crowd/roar", "roar": "crowd/roar", "groan": "crowd/groan", "ooh": "crowd/ooh",
  "miss": "crowd/groan", "save": "crowd/ooh", "_amb": A("crowd/stadium", g=.15), "chant": "crowd/chant", "countdown": "stinger/countdown",
  "go": "stinger/go", "champion": "stinger/champion", "applause": "crowd/small_applause",
 },
 "impulse-arena": {"bell": "sport/bell", "whistle": "sport/bell", "cheer": "crowd/small_cheer", "roar": "crowd/roar", "ooh": "crowd/ooh",
                   "groan": "crowd/groan", "fall": "fslg2/body_fall", "whoosh": "fslg2/whoosh", "_amb": A("crowd/gym", g=.12),
                   "countdown": "stinger/countdown", "go": "stinger/go"},
 "kinetic-kingdom": {"whoosh": "fslg2/whoosh", "fall": "fslg2/body_fall", "_amb": A("fslg2/amb_wind", g=.1), "checkpoint": "stinger/pass",
                     "levelup": "stinger/levelup"},
 "wavefront": {"_amb": A("lab/mains_hum", g=.1), "alarm": "fslg2/siren_whoop", "sparks": "lab/sparks", "lock": "lab/lock_on",
               "countdown": "stinger/countdown", "go": "stinger/go"},
 "induction-dash": {"_amb": A("lab/maglev_hum", g=.08), "hum": "lab/maglev_hum", "whoosh": "fslg2/whoosh", "countdown": "stinger/countdown",
                    "go": "stinger/go", "sparks": "lab/sparks"},
 "volt-city": {"_amb": A("lab/mains_hum", g=.1), "relay": "lab/relay", "breaker": "lab/breaker", "lights_on": "lab/lights_on",
               "power_down": "lab/power_down", "sparks": "lab/sparks", "generator": "lab/generator", "buzz": "lab/buzz"},
 "light-bender": {"_amb": A("fslg2/amb_room", g=.12), "lock": "lab/lock_on", "lights_on": "lab/lights_on"},
 "circuit-forge": {"_amb": A("lab/workshop", g=.08), "relay": "lab/relay", "sparks": "lab/sparks", "buzz": "lab/buzz", "lights_on": "lab/lights_on"},
 "logic-labyrinth": {"_amb": A("lab/mains_hum", g=.08), "relay": "lab/relay", "servo": "lab/servo", "lock": "lab/lock_on"},
 "motorworks": {"_amb": A("lab/workshop", g=.14), "motor": "lab/motor_whine", "relay": "lab/relay", "breaker": "lab/breaker",
                "breaker_big": "lab/breaker_big", "sparks": "lab/sparks", "generator": "lab/generator", "factory": "lab/factory", "hum": "lab/mains_hum"},
 "storm-map": {"_amb": A("fslg2/amb_wind", g=.16), "rain": "fslg2/amb_rain", "thunder": "fslg2/thunder", "breaker": "lab/breaker",
               "breaker_big": "lab/breaker_big", "power_down": "lab/power_down", "lights_on": "lab/lights_on", "generator": "lab/generator",
               "sparks": "lab/sparks", "relay": "lab/relay", "radio": "lab/radio_noise"},
 "signal-surfer": {"_amb": A("lab/static", g=.08), "static": "lab/static", "tune": "lab/tune", "noise": "lab/radio_noise", "lock": "lab/lock_on",
                   "decode": "lab/signal_ok", "sonar": "lab/sonar"},
 "maglev-rescue": {"_amb": A("lab/mains_hum", g=.08), "hum": "lab/maglev_hum", "coil": "lab/coil_charge", "relay": "lab/relay",
                   "lock": "lab/lock_on", "alarm": "fslg2/siren_whoop", "sparks": "lab/sparks"},
 "algorithm-garage": {"_amb": A("lab/robot_arm", g=.1), "type": "lab/typing", "mouse": "lab/mouse", "servo": "lab/servo", "relay": "lab/relay",
                      "run": "stinger/go", "ok": "lab/signal_ok", "error": "core/error"},
 "drive-room": {"_amb": A("lab/factory", g=.1), "motor": "lab/motor_whine", "relay": "lab/relay", "breaker": "lab/breaker",
                "breaker_big": "lab/breaker_big", "hum": "lab/mains_hum", "alarm": "fslg2/siren_whoop"},
}


def run(args):
    return subprocess.run([FF, "-hide_banner", "-nostdin"] + args, capture_output=True, text=True)


def decode(path, ss=None, t=None):
    pre = (["-ss", str(ss)] if ss else []) + (["-t", str(t)] if t else [])
    r = subprocess.run([FF, "-hide_banner", "-nostdin"] + pre + ["-i", path, "-vn", "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"], capture_output=True)
    return np.frombuffer(r.stdout, "<i2").astype(np.float64) / 32768.0


def loudest(x, secs):
    n = int(secs * SR)
    if len(x) <= n: return x
    e = np.convolve(x * x, np.ones(2048) / 2048, mode="same")
    c = np.cumsum(np.concatenate([[0], e])); w = c[n:] - c[:-n]; i = int(np.argmax(w))
    return x[max(0, i - int(.04 * SR)): i + n]


def make_loop(x, xf=.35):
    n = int(xf * SR)
    if len(x) < 3 * n: return x
    head, body, tail = x[:n], x[n:-n], x[-n:]
    a = np.sqrt(np.linspace(0, 1, n)); b = np.sqrt(np.linspace(1, 0, n))
    return np.concatenate([body, tail * b + head * a])  # the end flows straight back into the start


def resample(x, rate):
    if not rate or rate == 1: return x
    idx = np.arange(0, len(x) - 1, rate); return np.interp(idx, np.arange(len(x)), x)


def onepole(x, hz, kind):
    if not hz: return x
    a = np.exp(-2 * np.pi * hz / SR); y = np.zeros_like(x); z = 0.0
    for i in range(len(x)): z = (1 - a) * x[i] + a * z; y[i] = z
    return x - y if kind == "hp" else y


def process(src, s):
    x = decode(src, s.get("ss"), s.get("t"))
    if not len(x): raise RuntimeError("empty decode " + src)
    if s.get("best"): x = loudest(x, s["best"])
    elif not s.get("loop") and not s.get("t"):  # trim leading/trailing quiet
        nz = np.where(np.abs(x) > 10 ** (-46 / 20))[0]
        if len(nz): x = x[max(0, nz[0] - 200): nz[-1] + 2000]
    x = resample(x, s.get("rate"))
    x = onepole(x, s.get("hp", 40), "hp"); x = onepole(x, s.get("lp"), "lp")
    if s.get("loop"): x = make_loop(x)
    else:
        if s.get("fin"): k = int(s["fin"] * SR); x[:k] *= np.linspace(0, 1, k)
        if s.get("fade"): k = min(len(x), int(s["fade"] * SR)); x[-k:] *= np.linspace(1, 0, k)
        k = min(len(x), 64); x[:k] *= np.linspace(0, 1, k); x[-k:] *= np.linspace(1, 0, k)
    pk = np.max(np.abs(x)) or 1; x = x / pk * (10 ** ((-6 if s.get("loop") else -3) / 20))
    return x


def write_wav(path, x):
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


def credit(src, fsm, cm):
    if src.startswith("fs_"):
        sid = re.match(r"fs_(\d+)", src).group(1); m = fsm[sid]
        return (m["title"], m["url"], m["author"] + " (Freesound)", "CC0 1.0")
    if src.startswith("commons/"):
        m = cm.get(os.path.basename(src), {}); return (os.path.basename(src), m.get("url", "?"), m.get("author", "?") + " (Wikimedia Commons)", m.get("lic", "Public domain"))
    if src.startswith("synth/"):
        return ("Original synthesized sound " + os.path.basename(src)[:-4], "tools/sfx/synth.py", "Made for EE Hub", "CC0 1.0 (original work)")
    return (src, "?", "?", "?")


def build(dl):
    fsm = json.load(open(os.path.join(dl, "fs_meta.json")))
    cm = json.load(open(os.path.join(dl, "commons", "meta.json"))) if os.path.exists(os.path.join(dl, "commons", "meta.json")) else {}
    missing = [s["src"] for srcs, _ in FILES.values() for s in srcs if not os.path.exists(os.path.join(dl, s["src"]))]
    if missing: print("Missing sources:\n  " + "\n  ".join(sorted(set(missing)))); return 1
    stems, credits, sizes, durs = {}, [], {"ogg": {}, "m4a": {}}, {}
    today = datetime.date.today().isoformat(); tmp = os.path.join(dl, "_tmp.wav")
    for key, (srcs, opt) in FILES.items():
        folder, name = key.split("/"); os.makedirs(os.path.join(OUT, folder), exist_ok=True); stems[key] = []
        for i, s in enumerate(srcs):
            stem = "%s/%s_%d" % (folder, name, i + 1) if len(srcs) > 1 else "%s/%s" % (folder, name)
            x = process(os.path.join(dl, s["src"]), s); write_wav(tmp, x); loop = bool(s.get("loop"))
            for ext, enc in (("ogg", ["-c:a", "libopus", "-b:a", "36k" if loop else "48k", "-vbr", "on"]), ("m4a", ["-c:a", "aac", "-b:a", "48k" if loop else "64k"])):
                dst = os.path.join(OUT, stem + "." + ext)
                r = run(["-y", "-i", tmp, "-ar", "48000" if ext == "ogg" else "44100"] + enc + ["-map_metadata", "-1", dst])
                if r.returncode or not os.path.exists(dst): print("FAILED", stem, ext, r.stderr[-300:]); return 1
                sizes[ext][stem] = os.path.getsize(dst)
            stems[key].append(stem); durs[stem] = round(len(x) / SR, 2)
            t, url, who, lic = credit(s["src"], fsm, cm)
            credits.append([stem, os.path.basename(s["src"]), t, url, who, lic, today])
    os.remove(tmp)

    def ent(v):
        over = {}
        if isinstance(v, dict): over = {k: x for k, x in v.items() if k != "use"}; v = v["use"]
        if v.startswith("core/"): return {"ref": v, **over}  # resolved against the first round at merge time
        e = {"f": stems[v]}; e.update(FILES[v][1]); e.update(over)
        if FILES[v][0][0].get("loop"): e["loop"] = 1
        return e
    more = {"built": today, "core": {k: ent(v) for k, v in CORE.items()}, "packs": {s: {k: ent(v) for k, v in p.items()} for s, p in PACKS.items()},
            "credits": credits, "sizes": sizes, "durations": durs}
    json.dump(more, open(MORE, "w"), indent=1, sort_keys=True)
    return merge()


def merge():
    """Fold tools/sfx/more_manifest.json into manifest.json, CREDITS.md and sizes.json. Safe to run repeatedly."""
    if not os.path.exists(MORE): return 0
    more = json.load(open(MORE)); mp = os.path.join(OUT, "manifest.json"); man = json.load(open(mp))
    first = {}  # first-round stems by entry name, so a "core/x" reference can be resolved
    for name, e in man.get("core", {}).items():
        if e.get("f"): first.setdefault(e["f"][0].rsplit("_", 1)[0] if re.search(r"_\d+$", e["f"][0]) else e["f"][0], e)

    def resolve(e):
        if "ref" not in e: return e
        base = next((x for k, x in first.items() if k == e["ref"]), None)
        if base is None: return None
        out = dict(base); out.update({k: v for k, v in e.items() if k != "ref"}); return out
    for k, e in more["core"].items():
        r = resolve(e)
        if r: man["core"][k] = r
    for slug, p in more["packs"].items():
        dst = man["packs"].setdefault(slug, {})
        for k, e in p.items():
            r = resolve(e)
            if r: dst[k] = r
    man["v"] = 2; man["built2"] = more["built"]
    json.dump(man, open(mp, "w"), indent=1, sort_keys=True)
    cp = os.path.join(OUT, "CREDITS.md"); text = open(cp).read()
    mark = "\n## Round 2 additions\n"
    text = text.split(mark)[0].rstrip("\n") + "\n" + mark + (
        "\nFreesound items are CC0 1.0 (the search was filtered to CC0; each link shows the licence). The two Wikimedia\n"
        "Commons files are public domain. `synth/` sounds are original, generated by `tools/sfx/synth.py` for EE Hub.\n"
        "Freesound files were taken from the site's 128 kbps previews of those CC0 sounds.\n\n"
        "| File | From | Pack or page | Author | Licence | Fetched |\n|---|---|---|---|---|---|\n")
    for stem, orig, t, url, who, lic, day in more["credits"]:
        text += "| `%s` | %s | [%s](%s) | %s | %s | %s |\n" % (stem, orig, t.replace("|", "/"), url, who, lic, day)
    open(cp, "w").write(text)
    sp = os.path.join(OUT, "sizes.json"); sz = json.load(open(sp))
    for ext in ("ogg", "m4a"): sz["sizes"].setdefault(ext, {}).update(more["sizes"][ext])
    sz.setdefault("durations", {}).update(more["durations"])
    tot = {x: round(sum(sz["sizes"][x].values()) / 1024) for x in ("ogg", "m4a")}
    sz.setdefault("report", {})["total_kb"] = tot; sz["report"]["files"] = len(sz["sizes"]["ogg"])

    def used(scope):
        return {s for e in scope.values() for s in e.get("f", [])}
    core = used(man["core"]); coreeager = {s for e in man["core"].values() if not e.get("lazy") for s in e.get("f", [])}
    sz["report"]["core_kb"] = {x: round(sum(sz["sizes"][x].get(s, 0) for s in core) / 1024) for x in ("ogg", "m4a")}
    sz["report"]["core_first_load_kb"] = {x: round(sum(sz["sizes"][x].get(s, 0) for s in coreeager) / 1024) for x in ("ogg", "m4a")}
    sz["report"]["packs_kb"] = {}; sz["report"]["packs_first_load_kb"] = {}
    for slug, p in man["packs"].items():
        sz["report"]["packs_kb"][slug] = {x: round(sum(sz["sizes"][x].get(s, 0) for s in used(p) - core) / 1024) for x in ("ogg", "m4a")}
        eager = {s for k, e in p.items() if not e.get("lazy") or k == "_amb" for s in e.get("f", [])}
        sz["report"]["packs_first_load_kb"][slug] = {x: round(sum(sz["sizes"][x].get(s, 0) for s in eager | coreeager) / 1024) for x in ("ogg", "m4a")}
    json.dump(sz, open(sp, "w"), indent=1, sort_keys=True)
    print(json.dumps(sz["report"], indent=1)); return 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--merge": sys.exit(merge())
    sys.exit(build(os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(ROOT, "tools", "sfx", "downloads2")))
