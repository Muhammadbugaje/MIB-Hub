#!/usr/bin/env python3
"""Water sounds for Freshers School Life (pack "samaru-days"): swimming, splashes, bubbles, fish jumps.

    tools/voice/.venv/bin/python tools/sfx/build_water.py           # synthesize the files + merge
    tools/voice/.venv/bin/python tools/sfx/build_water.py --merge   # only merge (files already built)

Every sound here is synthesized from scratch by this script (shaped noise and decaying, rising sine "bubbles"),
seeded so it builds the same every time. Nothing is recorded or downloaded, so there is no third-party licence:
the files are released under CC0 1.0 like the rest of the library.

It writes static/audio/sfx/fslg_water/<name>_<n>.ogg and .m4a, records what it added in
tools/sfx/water_manifest.json, and merges only those names into static/audio/sfx/manifest.json
(packs["samaru-days"]), CREDITS.md (a "## Water sounds (synthesized)" section) and sizes.json.
Other entries are never touched. Note: tools/sfx/build.py rewrites manifest.json from scratch; run this script
with --merge after it."""
import json, os, sys, datetime, shutil, subprocess, wave
import numpy as np

try:
    import imageio_ffmpeg
    FF = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FF = shutil.which("ffmpeg") or "ffmpeg"
SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "static", "audio", "sfx")
MAN = os.path.join(ROOT, "tools", "sfx", "water_manifest.json")
PACK = "samaru-days"
FOLDER = "fslg_water"
MARK = "\n## Water sounds (synthesized)\n"


def onepole(x, hz, kind):
    if not hz: return x
    a = np.exp(-2 * np.pi * hz / SR); y = np.zeros_like(x); s = 0.0
    for i in range(len(x)):
        s = (1 - a) * x[i] + a * s; y[i] = s
    return x - y if kind == "hp" else y


def env(n, att, dec, curve=1.0):
    t = np.arange(n) / SR; e = np.minimum(1, t / max(att, 1e-4)) * np.exp(-np.maximum(0, t - att) / dec)
    return e ** curve


def bubble(n, at, f0, tau, rise, amp):
    """One bubble: a sine whose pitch rises as it decays (the Minnaert resonance of a shrinking bubble)."""
    y = np.zeros(n); a = int(at * SR); m = min(n - a, int(tau * 7 * SR))
    if m <= 0: return y
    t = np.arange(m) / SR; f = f0 * (1 + rise * t / tau * .12)
    y[a:a + m] = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / tau) * amp
    return y


def bubbles(rng, n, count, t0, t1, lo, hi, amp):
    y = np.zeros(n)
    for _ in range(count):
        y += bubble(n, rng.uniform(t0, t1), rng.uniform(lo, hi), rng.uniform(.006, .03), rng.uniform(1, 3), amp * rng.uniform(.3, 1))
    return y


def noise(rng, n): return rng.standard_normal(n)


def splash(seed, big=True):
    r = np.random.default_rng(seed); dur = 1.1 if big else .45; n = int(dur * SR)
    body = onepole(onepole(noise(r, n), 2600 if big else 3800, "lp"), 120, "hp") * env(n, .006, .12 if big else .05, 1.2)
    spray = onepole(noise(r, n), 2500, "hp") * env(n, .02, .35 if big else .12) * .45
    plop = np.sin(2 * np.pi * np.cumsum(np.linspace(180 if big else 380, 90 if big else 220, n)) / SR) * env(n, .002, .05) * (.9 if big else .6)
    bub = bubbles(r, n, 46 if big else 12, .03, dur * .7, 500, 2200, .35)
    return body + spray + plop + bub


def stroke(seed):
    r = np.random.default_rng(seed); n = int(.42 * SR)
    sw = onepole(onepole(noise(r, n), 1800, "lp"), 300, "hp") * env(n, .09, .09, 1.4)
    slap = onepole(noise(r, n), 1200, "hp") * env(n, .003, .025) * .5
    drip = bubbles(r, n, 7, .08, .35, 700, 1800, .25)
    return sw + slap + drip


def under(seed):
    r = np.random.default_rng(seed); n = int(.6 * SR)
    w = onepole(onepole(noise(r, n), 420, "lp"), 60, "hp") * env(n, .15, .18, 1.2) * 2.2
    return w + bubbles(r, n, 10, .05, .5, 250, 900, .3)


def burble(seed):
    r = np.random.default_rng(seed); n = int(.7 * SR)
    return bubbles(r, n, 26, .0, .55, 300, 1400, .5) + onepole(noise(r, n), 500, "lp") * env(n, .05, .2) * .3


def out_of_water(seed):
    r = np.random.default_rng(seed); n = int(1.0 * SR)
    pour = onepole(onepole(noise(r, n), 3000, "lp"), 250, "hp") * env(n, .05, .3, 1.1)
    drips = np.zeros(n)
    for _ in range(9): drips += bubble(n, r.uniform(.25, .9), r.uniform(900, 1600), r.uniform(.008, .015), 2.5, r.uniform(.2, .45))
    return pour + drips


def gasp(seed):
    r = np.random.default_rng(seed); n = int(.5 * SR)
    # a quick breath in: band-limited noise swelling then cut, no voice
    b = onepole(onepole(noise(r, n), 2400, "lp"), 700, "hp"); e = np.minimum(1, np.arange(n) / (.22 * SR)) ** 2 * np.exp(-np.maximum(0, np.arange(n) / SR - .26) / .05)
    return b * e * .8 + bubbles(r, n, 5, 0, .12, 600, 1500, .25)


# name -> (variations, manifest options)
FILES = {
    "splash": ([lambda: splash(11), lambda: splash(12)], dict(bus="world", g=.85, p=.06, max=2)),
    "splash_small": ([lambda: splash(21, False), lambda: splash(22, False), lambda: splash(23, False)], dict(bus="world", g=.6, p=.1, max=3)),
    "swim_stroke": ([lambda: stroke(31), lambda: stroke(32), lambda: stroke(33)], dict(bus="world", g=.42, p=.08, max=2)),
    "swim_under": ([lambda: under(41), lambda: under(42)], dict(bus="world", g=.5, p=.08, max=2, lazy=1)),
    "bubbles": ([lambda: burble(51), lambda: burble(52)], dict(bus="world", g=.5, p=.1, max=2, lazy=1)),
    "water_out": ([lambda: out_of_water(61), lambda: out_of_water(62)], dict(bus="world", g=.6, p=.05, max=1, lazy=1)),
    "gasp": ([lambda: gasp(71)], dict(bus="world", g=.45, p=.06, max=1, lazy=1)),
}


def write_wav(path, x):
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


def finish(y):
    y = onepole(y, 35, "hp"); k = min(len(y), 64); y[:k] *= np.linspace(0, 1, k)
    k = min(len(y), int(.04 * SR)); y[-k:] *= np.linspace(1, 0, k) ** 2
    return y / (np.max(np.abs(y)) or 1) * 10 ** (-3 / 20)


def build():
    os.makedirs(os.path.join(OUT, FOLDER), exist_ok=True)
    stems, credits, sizes, durs = {}, [], {"ogg": {}, "m4a": {}}, {}
    today = datetime.date.today().isoformat(); tmp = os.path.join(OUT, FOLDER, "_tmp.wav")
    for name, (vs, _) in FILES.items():
        stems[name] = []
        for i, make in enumerate(vs):
            stem = "%s/%s_%d" % (FOLDER, name, i + 1); y = finish(make()); write_wav(tmp, y)
            for ext, enc in (("ogg", ["-c:a", "libopus", "-b:a", "40k", "-vbr", "on"]), ("m4a", ["-c:a", "aac", "-b:a", "56k"])):
                dst = os.path.join(OUT, stem + "." + ext)
                r = subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", "-i", tmp, "-ar", "48000" if ext == "ogg" else "44100"] + enc + ["-map_metadata", "-1", dst], capture_output=True, text=True)
                if r.returncode or not os.path.exists(dst): print("FAILED", stem, ext, r.stderr[-300:]); return 1
                sizes[ext][stem] = os.path.getsize(dst)
            stems[name].append(stem); durs[stem] = round(len(y) / SR, 2)
            credits.append([stem, today])
    os.remove(tmp)
    entries = {}
    for name, (_, opt) in FILES.items():
        e = {"f": stems[name]}; e.update(opt); entries[name] = e
    json.dump({"built": today, "pack": PACK, "entries": entries, "credits": credits, "sizes": sizes, "durations": durs}, open(MAN, "w"), indent=1, sort_keys=True)
    return merge()


def merge():
    """Fold tools/sfx/water_manifest.json into manifest.json, CREDITS.md and sizes.json. Safe to run repeatedly."""
    if not os.path.exists(MAN): return 0
    data = json.load(open(MAN))
    mp = os.path.join(OUT, "manifest.json"); man = json.load(open(mp))   # read right before writing
    man.setdefault("packs", {}).setdefault(data["pack"], {}).update(data["entries"])
    json.dump(man, open(mp, "w"), indent=1, sort_keys=True)
    cp = os.path.join(OUT, "CREDITS.md"); text = open(cp).read()
    sec = MARK + (
        "\nSwimming, splash, bubble and fish-jump one-shots for Freshers School Life. Synthesized from scratch by\n"
        "`tools/sfx/build_water.py` (shaped noise and rising-pitch sine bubbles, fixed seeds): no recordings and no\n"
        "third-party material. Released under CC0 1.0.\n\n"
        "| File | From | Pack or page | Author | Licence | Fetched |\n|---|---|---|---|---|---|\n")
    for stem, day in data["credits"]:
        sec += "| `%s` | synthesized | tools/sfx/build_water.py | EE Hub (original) | CC0 1.0 | %s |\n" % (stem, day)
    if MARK in text:
        head, rest = text.split(MARK, 1); nxt = rest.find("\n## ")
        text = head.rstrip("\n") + "\n" + (rest[nxt:] if nxt >= 0 else "")
    r2 = "\n## Round 2 additions\n"
    if r2 in text:
        a, b = text.split(r2, 1); text = a.rstrip("\n") + "\n" + sec + r2 + b
    else:
        text = text.rstrip("\n") + "\n" + sec
    open(cp, "w").write(text)
    sp = os.path.join(OUT, "sizes.json"); sz = json.load(open(sp))
    for ext in ("ogg", "m4a"): sz["sizes"].setdefault(ext, {}).update(data["sizes"][ext])
    sz.setdefault("durations", {}).update(data["durations"])
    tot = {x: round(sum(sz["sizes"][x].values()) / 1024) for x in ("ogg", "m4a")}
    sz.setdefault("report", {})["total_kb"] = tot; sz["report"]["files"] = len(sz["sizes"]["ogg"])

    def used(scope):
        return {s for e in scope.values() for s in e.get("f", [])}
    core = used(man["core"])
    sz["report"].setdefault("packs_kb", {})
    for slug, p in man["packs"].items():
        sz["report"]["packs_kb"][slug] = {x: round(sum(sz["sizes"][x].get(s, 0) for s in used(p) - core) / 1024) for x in ("ogg", "m4a")}
    json.dump(sz, open(sp, "w"), indent=1, sort_keys=True)
    return 0


if __name__ == "__main__":
    sys.exit(merge() if len(sys.argv) > 1 and sys.argv[1] == "--merge" else build())
