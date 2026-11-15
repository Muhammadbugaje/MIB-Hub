#!/usr/bin/env python3
"""Round-3 sound library: vehicle crashes for Freshers School Life (pack "samaru-days").

    tools/voice/.venv/bin/python tools/sfx/build_crash.py <download-folder>   # build files + merge
    tools/voice/.venv/bin/python tools/sfx/build_crash.py --merge             # only merge (no downloads needed)

<download-folder> holds:
    fs_<id>.mp3 + fs_meta.json   Freesound 128 kbps previews of sounds released under CC0 1.0
                                 (fs_meta.json: {"<id>": {"title", "url", "author"}})
    kenney_impact/...            Kenney "Impact Sounds" (CC0), unpacked anywhere under this sub-folder

It writes static/audio/sfx/fslg3/<name>_<n>.ogg and .m4a, records what it added in tools/sfx/crash_manifest.json,
and merges only those names into static/audio/sfx/manifest.json (packs["samaru-days"]), CREDITS.md (a
"## Round 3: vehicle crashes" section) and sizes.json. Other entries are never touched. Running it twice gives the
same result.

Processing is honest only: trim (or pick the loudest window), mix up to three CC0 recordings with small offsets,
high/low-pass, fade, level to -3 dB peak, mono.

Note: tools/sfx/build.py rewrites manifest.json from scratch; run this script with --merge after it."""
import json, os, re, sys, glob, datetime, shutil, subprocess, wave
import numpy as np

try:
    import imageio_ffmpeg
    FF = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FF = shutil.which("ffmpeg") or "ffmpeg"
SR = 44100


# The same small helpers as build_more.py, copied so this script stands alone.
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


def resample(x, rate):
    if not rate or rate == 1: return x
    idx = np.arange(0, len(x) - 1, rate); return np.interp(idx, np.arange(len(x)), x)


def onepole(x, hz, kind):
    if not hz: return x
    a = np.exp(-2 * np.pi * hz / SR); y = np.zeros_like(x); z = 0.0
    for i in range(len(x)): z = (1 - a) * x[i] + a * z; y[i] = z
    return x - y if kind == "hp" else y


def write_wav(path, x):
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "static", "audio", "sfx")
MAN = os.path.join(ROOT, "tools", "sfx", "crash_manifest.json")
PACK = "samaru-days"
FOLDER = "fslg3"
MARK = "\n## Round 3: vehicle crashes\n"
KENNEY = ("Kenney — Impact Sounds", "https://kenney.nl/assets/impact-sounds", "Kenney (kenney.nl)")


def L(src, g=1.0, at=0.0, **o):
    """One layer: a source file, its gain, its start offset in seconds and per-source options
    (ss/t trim, best=t loudest window, rate resample, hp/lp Hz)."""
    return dict(src=src, g=g, at=at, **o)


def fs(i, **o):
    return L("fs_%s.mp3" % i, **o)


def ke(name, **o):
    return L("kenney_impact/" + name + ".ogg", **o)


# name -> (variations, manifest options). A variation is (layers, mix options): t caps the length, fade is the
# tail fade in seconds, hp/lp filter the mix.
FILES = {
 # car into car: metal crunch, medium
 "crash_car": ([
    ([fs(151624), ke("impactPlate_heavy_002", g=.5)], dict(fade=.25)),
    ([fs(332058, t=.75), ke("impactSoft_heavy_001", g=.7)], dict(fade=.35)),
    ([fs(237375, best=.9)], dict(t=.95, fade=.45)),
 ], dict(bus="impacts", g=1, p=.07, max=2)),
 # small fender tap: a light, dull metal thunk
 "crash_car_light": ([
    ([fs(340539)], dict(fade=.12)),
    ([ke("impactPlate_heavy_003"), ke("impactSoft_medium_003", g=.6)], dict(fade=.12)),
    ([ke("impactPlate_heavy_001"), ke("impactSoft_medium_004", g=.6)], dict(fade=.15, lp=6000)),
 ], dict(bus="impacts", g=.85, p=.08, max=2)),
 # bus: a heavy, deep panel boom with some crunch
 "crash_bus": ([
    ([fs(879268), fs(151624, g=.3, at=.01), ke("impactPlate_heavy_004", g=.5)], dict(t=1.1, fade=.45, lp=3500)),
    ([fs(209772, best=.9, rate=.85), fs(332056, g=.5, at=.02)], dict(t=.9, fade=.5, lp=5000)),
 ], dict(bus="impacts", g=1, p=.05, lazy=1, max=2)),
 # motorbike: lighter metal plus a plastic crack / fairing clatter
 "crash_moto": ([
    ([fs(332056, g=.8), fs(697092, g=.9, at=.03)], dict(fade=.2)),
    ([ke("impactTin_medium_002", g=.7), fs(272065, best=.45, at=.02)], dict(t=.6, fade=.25, lp=8000)),
    ([ke("impactPlate_light_003", g=.6), fs(697091), fs(173598, g=.7, at=.09)], dict(fade=.2)),
 ], dict(bus="impacts", g=.95, p=.07, max=2)),
 # bicycle: light rattle and clatter, no heavy clang
 "crash_bicycle": ([
    ([fs(707010, ss=.55, t=.9)], dict(fade=.4)),
    ([fs(453764, t=.6)], dict(fade=.3, lp=5000)),
    ([fs(78483, best=.7)], dict(t=.7, fade=.35)),
 ], dict(bus="impacts", g=.85, p=.08, max=2)),
 # skateboard: wooden deck clack and little wheels
 "crash_skate": ([
    ([fs(717547, t=.6)], dict(fade=.25)),
    ([fs(262081, ss=.3, t=.6)], dict(fade=.25)),
    ([fs(515231, ss=.42, t=.6)], dict(fade=.3)),
 ], dict(bus="impacts", g=.85, p=.08, max=2)),
 # vehicle into a concrete wall or kerb: dull heavy thud
 "crash_wall": ([
    ([fs(457741, best=.6)], dict(t=.6, fade=.3)),
    ([fs(321477), ke("impactSoft_heavy_003", g=.8)], dict(t=.6, fade=.3, lp=4000)),
    ([fs(344402, ss=.27), ke("impactWood_heavy_000", g=.8, at=.005)], dict(t=.6, fade=.3, lp=3500)),
 ], dict(bus="impacts", g=1, p=.07, max=2)),
 # pole or tree: hollow wooden knock
 "crash_pole": ([
    ([fs(386228)], dict(t=.5, fade=.25)),
    ([ke("impactPlank_medium_001"), ke("impactSoft_medium_001", g=.5)], dict(t=.45, fade=.2)),
    ([fs(421929), ke("impactWood_heavy_002", g=.7)], dict(t=.45, fade=.2)),
 ], dict(bus="impacts", g=.95, p=.07, lazy=1, max=2)),
 # car body scraping along a wall
 "scrape": ([
    ([fs(874460, best=.85)], dict(t=.85, fin=.04, fade=.35)),
    ([fs(321488, best=.7)], dict(t=.7, fin=.04, fade=.3)),
 ], dict(bus="impacts", g=.8, p=.06, lazy=1, max=1)),
 # ---- foliage (pushing through bushes, hedges and crops)
 # soft bush or hedge rustle
 "rustle": ([
    ([fs(518799, best=.6)], dict(t=.6, fin=.02, fade=.25, lp=7000)),
    ([fs(106113, t=.65)], dict(fade=.3)),
    ([fs(106114, best=.6)], dict(t=.6, fin=.03, fade=.25)),
 ], dict(bus="world", g=.7, p=.1, max=3)),
 # heavier crash through a hedge or small tree, with a twig crack
 "rustle_big": ([
    ([fs(106114, best=1.0), fs(452570, g=.6, at=.15)], dict(t=1.0, fin=.03, fade=.4)),
    ([fs(569485, best=1.0), fs(106113, g=.7), fs(164472, g=.6, at=.2)], dict(t=1.0, fin=.03, fade=.4)),
 ], dict(bus="world", g=.8, p=.08, lazy=1, max=2)),
 # dry grass or maize-stalk swish
 "crops": ([
    ([fs(396013)], dict(t=.6, fin=.02, fade=.2, lp=9000)),
    ([fs(396012)], dict(t=.55, fin=.02, fade=.2)),
 ], dict(bus="world", g=.7, p=.1, lazy=1, max=2)),
}


def find_src(dl, src):
    p = os.path.join(dl, src)
    if os.path.exists(p): return p
    if src.startswith("kenney_impact/"):
        hits = glob.glob(os.path.join(dl, "kenney_impact", "**", os.path.basename(src)), recursive=True)
        if hits: return hits[0]
    return None


def layer(path, s):
    x = decode(path, s.get("ss"), s.get("t"))
    if not len(x): raise RuntimeError("empty decode " + path)
    if s.get("best"): x = loudest(x, s["best"])
    nz = np.where(np.abs(x) > 10 ** (-46 / 20) * np.max(np.abs(x)))[0]  # trim leading/trailing quiet
    if len(nz): x = x[max(0, nz[0] - 100): nz[-1] + 1000]
    x = resample(x, s.get("rate"))
    x = onepole(x, s.get("hp"), "hp"); x = onepole(x, s.get("lp"), "lp")
    k = min(len(x), 64); x[:k] *= np.linspace(0, 1, k)
    return x / (np.max(np.abs(x)) or 1) * s["g"]


def variation(dl, layers, o):
    parts = [(int(s["at"] * SR), layer(find_src(dl, s["src"]), s)) for s in layers]
    n = max(a + len(x) for a, x in parts); y = np.zeros(n)
    for a, x in parts: y[a:a + len(x)] += x
    if o.get("t"): y = y[:int(o["t"] * SR)]
    y = onepole(y, o.get("hp", 40), "hp"); y = onepole(y, o.get("lp"), "lp")
    if o.get("fin"): k = int(o["fin"] * SR); y[:k] *= np.linspace(0, 1, k)
    if o.get("fade"): k = min(len(y), int(o["fade"] * SR)); y[-k:] *= np.linspace(1, 0, k) ** 2
    k = min(len(y), 64); y[:k] *= np.linspace(0, 1, k); y[-k:] *= np.linspace(1, 0, k)
    return y / (np.max(np.abs(y)) or 1) * 10 ** (-3 / 20)


def credit(src, fsm):
    if src.startswith("fs_"):
        sid = re.match(r"fs_(\d+)", src).group(1); m = fsm[sid]
        title = re.sub(r" by %s$" % re.escape(m["author"]), "", m["title"])
        return (os.path.basename(src), title, m["url"], m["author"] + " (Freesound)", "CC0 1.0")
    return (os.path.basename(src),) + KENNEY[:2] + (KENNEY[2], "CC0 1.0")


def build(dl):
    fsm = json.load(open(os.path.join(dl, "fs_meta.json")))
    missing = sorted({s["src"] for vs, _ in FILES.values() for ls, _ in vs for s in ls if not find_src(dl, s["src"])})
    if missing: print("Missing sources:\n  " + "\n  ".join(missing)); return 1
    os.makedirs(os.path.join(OUT, FOLDER), exist_ok=True)
    stems, credits, sizes, durs = {}, [], {"ogg": {}, "m4a": {}}, {}
    today = datetime.date.today().isoformat(); tmp = os.path.join(OUT, FOLDER, "_tmp.wav")
    for name, (vs, _) in FILES.items():
        stems[name] = []
        for i, (ls, o) in enumerate(vs):
            stem = "%s/%s_%d" % (FOLDER, name, i + 1)
            y = variation(dl, ls, o); write_wav(tmp, y)
            for ext, enc in (("ogg", ["-c:a", "libopus", "-b:a", "48k", "-vbr", "on"]), ("m4a", ["-c:a", "aac", "-b:a", "64k"])):
                dst = os.path.join(OUT, stem + "." + ext)
                r = run(["-y", "-i", tmp, "-ar", "48000" if ext == "ogg" else "44100"] + enc + ["-map_metadata", "-1", dst])
                if r.returncode or not os.path.exists(dst): print("FAILED", stem, ext, r.stderr[-300:]); return 1
                sizes[ext][stem] = os.path.getsize(dst)
            stems[name].append(stem); durs[stem] = round(len(y) / SR, 2)
            for s in ls:
                orig, t, url, who, lic = credit(s["src"], fsm)
                credits.append([stem, orig, t, url, who, lic, today])
    os.remove(tmp)
    entries = {}
    for name, (_, opt) in FILES.items():
        e = {"f": stems[name]}; e.update(opt); entries[name] = e
    data = {"built": today, "pack": PACK, "entries": entries, "credits": credits, "sizes": sizes, "durations": durs}
    json.dump(data, open(MAN, "w"), indent=1, sort_keys=True)
    return merge()


def merge():
    """Fold tools/sfx/crash_manifest.json into manifest.json, CREDITS.md and sizes.json. Safe to run repeatedly."""
    if not os.path.exists(MAN): return 0
    data = json.load(open(MAN))
    # manifest.json: only our names under packs["samaru-days"] (read right before writing)
    mp = os.path.join(OUT, "manifest.json"); man = json.load(open(mp))
    man.setdefault("packs", {}).setdefault(data["pack"], {}).update(data["entries"])
    man["built3"] = data["built"]
    json.dump(man, open(mp, "w"), indent=1, sort_keys=True)
    # CREDITS.md: our section sits before a "## Round 2 additions" section if there is one (build_more.merge
    # rewrites everything from that heading on), otherwise at the end.
    cp = os.path.join(OUT, "CREDITS.md"); text = open(cp).read()
    sec = MARK + (
        "\nVehicle crash and foliage one-shots for Freshers School Life. Freesound items are CC0 1.0 (each link shows the licence;\n"
        "files were taken from the site's 128 kbps previews). Kenney Impact Sounds are CC0 1.0. Each file mixes the\n"
        "sources listed for it (one row per source), trimmed, faded and levelled by `tools/sfx/build_crash.py`.\n\n"
        "| File | From | Pack or page | Author | Licence | Fetched |\n|---|---|---|---|---|---|\n")
    for stem, orig, t, url, who, lic, day in data["credits"]:
        sec += "| `%s` | %s | [%s](%s) | %s | %s | %s |\n" % (stem, orig, t.replace("|", "/"), url, who, lic, day)
    if MARK in text:  # drop our old section (up to the next "## " heading)
        head, rest = text.split(MARK, 1)
        nxt = rest.find("\n## ")
        text = head.rstrip("\n") + "\n" + (rest[nxt:] if nxt >= 0 else "")
    r2 = "\n## Round 2 additions\n"
    if r2 in text:
        a, b = text.split(r2, 1); text = a.rstrip("\n") + "\n" + sec + r2 + b
    else:
        text = text.rstrip("\n") + "\n" + sec
    open(cp, "w").write(text)
    # sizes.json, with the same report build_more.merge writes
    sp = os.path.join(OUT, "sizes.json"); sz = json.load(open(sp))
    for ext in ("ogg", "m4a"): sz["sizes"].setdefault(ext, {}).update(data["sizes"][ext])
    sz.setdefault("durations", {}).update(data["durations"])
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
    added = {x: round(sum(data["sizes"][x].values()) / 1024) for x in ("ogg", "m4a")}
    print("round 3 added (KB):", added, "| files:", len(data["sizes"]["ogg"])); return 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--merge": sys.exit(merge())
    sys.exit(build(os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(ROOT, "tools", "sfx", "downloads3")))
