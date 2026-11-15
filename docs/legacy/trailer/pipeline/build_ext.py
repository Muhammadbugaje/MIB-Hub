"""FSLG extended trailer (about 3:24, music only, room left for a voiceover).
Frames: $FSLG_WORK/frames/<shot>/NNNN.jpg from shots_ext.json (cap.py).  Run:  FSLG_WORK=... python build_ext.py
Writes docs/trailer/FSLG_extended_trailer.mp4, FSLG_extended_shotlist.md and pipeline/ext_timing.json.
If docs/trailer/extended_voiceover.wav exists (any rate, 16-bit), it is mixed over the score with ducking
(music about 12 dB under the voice, 80 ms attack, 400 ms release) and the music is otherwise left as is."""
import os, sys, json, math, wave, glob, shutil, subprocess, re
import numpy as np
from PIL import Image
import imageio_ffmpeg
import build as B

W, H, FPS, BAR = B.W, B.H, B.FPS, B.BAR
HERE, OUT = B.HERE, B.OUT; WORK = os.environ.get("FSLG_WORK", "/tmp/fslg-trailer-ext")
SR = 44100; BPM = 100.0; BEAT = 60 / BPM; FF = imageio_ffmpeg.get_ffmpeg_exe()

# movements: (title, [(shot, beats, opts)])   every movement is a whole number of bars
MOVES = [
 ("Arrival", [("gate_dawn", 10, {"fade": 1}), ("hero_walk", 4, {}), ("boulevard_sprint", 4, {"ramp": 1}), ("fountain_orbit", 6, {}), ("letters", 4, {"flip": 1}), ("senate_rise", 4, {})]),
 ("The campus", [("aerial_campus", 8, {"flash": 1}), ("p2_aerial", 6, {}), ("phase2", 4, {}), ("eng_quad", 6, {}), ("coil_day", 4, {})]),
 ("Classes and halls", [("lec_walk", 4, {"flash": 1}), ("lec_board", 8, {}), ("library", 4, {}), ("hostel_room", 4, {}), ("canteen", 4, {}), ("senate_lobby", 4, {}), ("lab", 4, {}), ("sickbay", 4, {}), ("library_night", 4, {})]),
 ("The mall", [("mall_atrium", 6, {"flash": 1}), ("mall_fashion", 4, {}), ("fitting", 4, {}), ("mib_store", 4, {}), ("arcade_room", 4, {}),
               ("mini_tabletennis", 2, {"off": 12}), ("mini_kola", 2, {"off": 12}), ("mini_run", 2, {"off": 12}), ("mini_patrol", 2, {"off": 12}), ("mini_ayo", 2, {"off": 12}), ("dance_floor", 8, {})]),
 ("Friends and life", [("bigmap", 6, {"flash": 1}), ("friends_walk", 4, {}), ("pillion", 6, {}), ("job", 6, {}), ("celebrate", 6, {}), ("friends_dance", 4, {})]),
 ("Day into night", [("pier_date", 6, {"fade": 1}), ("courts", 4, {}), ("lake_lapse", 8, {"fade": 1}), ("shinkafi_night", 6, {}), ("social_night", 4, {}), ("coil_night", 4, {})]),
 ("Trouble", [("fight", 8, {"flash": 1}), ("security", 8, {"flash": 1}), ("bike_sprint", 4, {}), ("okada", 4, {}), ("keke", 4, {}), ("drift", 8, {"off": 4, "flash": 1}), ("sport", 4, {}),
              ("takeoff", 8, {"off": 40}), ("bank", 4, {}), ("wild_hills", 4, {}), ("patrol", 4, {})]),
 ("The story", [("tease_coil", 8, {"fade": 1, "sup": "FIVE YEARS."}), ("tease_hall", 8, {"fade": 1, "sup": "120 MISSIONS."}), ("tease_lake", 8, {"fade": 1, "sup": "THE STRIKE YEAR."}),
                ("tease_senate", 8, {"fade": 1, "sup": "THE MAKER."}), ("tease_gate", 8, {"fade": 1, "sup": "SIX COILS. ONE LIGHT."})]),
 ("Finale", [("@montage", 16, {"flash": 1}), ("@credit", 10, {"flash": 1}), ("@cta", 10, {"fade": 1})]),
]
MONTAGE = ["boulevard_sprint", "drift", "takeoff", "dance_floor", "fight", "mall_atrium", "lec_board", "okada", "security", "aerial_campus", "shinkafi_night", "celebrate", "bank", "friends_walk", "coil_night", "sport"]

def schedule():
    out = []; b = 0
    for mi, (title, shots) in enumerate(MOVES):
        for shot, beats, opt in shots: out.append({"move": mi + 1, "title": title, "shot": shot, "start": b * BEAT, "end": (b + beats) * BEAT, "beats": beats, "opt": opt}); b += beats
    return out, b

SCHED, TOTAL_BEATS = schedule(); TOTAL = TOTAL_BEATS * BEAT + 3.0  # 3 s ring-out on the last card
MOVE_BARS = []; _b = 0
for title, shots in MOVES: n = sum(s[1] for s in shots); assert n % 4 == 0, (title, n); MOVE_BARS.append((title, _b // 4, (_b + n) // 4)); _b += n

def src(shot): return sorted(glob.glob(os.path.join(WORK, "frames", shot, "*.jpg")))

# ---------------- score ----------------
def score(total):
    n = int(total * SR); L = np.zeros(n); R = np.zeros(n); rng = np.random.default_rng(23); bar = BEAT * 4
    def add(sig, t0, g=1.0, pan=0.0):
        i = int(t0 * SR)
        if i < 0: sig = sig[-i:]; i = 0
        if i >= n or g == 0: return
        sig = sig[: n - i]; L[i:i + len(sig)] += sig * g * (1 - max(0, pan)); R[i:i + len(sig)] += sig * g * (1 + min(0, pan))
    tt = lambda d: np.arange(int(d * SR)) / SR; hz = lambda m: 440 * 2 ** ((m - 69) / 12)
    def env(d, a, r): m = int(d * SR); e = np.ones(m); ai = min(m, max(1, int(a * SR))); ri = min(m, max(1, int(r * SR))); e[:ai] *= np.linspace(0, 1, ai); e[-ri:] *= np.linspace(1, 0, ri); return e
    def lp(x, k): return np.convolve(x, np.ones(k) / k, "same") if k > 1 else x
    def piano(m, d=2.6, v=1.0): t = tt(d); f = hz(m); return sum((1 / k ** 1.35) * np.sin(2 * np.pi * f * k * (1 + .0004 * k * k) * t) * np.exp(-t * (1.1 + .55 * k)) for k in range(1, 9)) * env(d, .004, .3) * v
    def pad(m, d, det=1.003): t = tt(d); f = hz(m); return lp(sum((1 / k) * (np.sin(2 * np.pi * f * k * t) + np.sin(2 * np.pi * f * det * k * t + k)) for k in range(1, 7)), 9) * env(d, min(.9, d * .3), min(1.2, d * .35)) * .2
    def pluck(m, d=.22, br=5): t = tt(d); f = hz(m); return sum((1 / k) * np.sin(2 * np.pi * f * k * t) * np.exp(-t * (7 + 3 * k)) for k in range(1, br + 1)) * env(d, .003, .04)
    def kick(): t = tt(.36); return np.tanh(2.2 * np.sin(2 * np.pi * (46 * t + 95 / 26 * (1 - np.exp(-26 * t)))) * np.exp(-t * 8.5)) * .9
    def hat(o=False): t = tt(.16 if o else .045); x = np.diff(np.diff(rng.standard_normal(len(t) + 2))); return x * np.exp(-t * (22 if o else 95)) * .25
    def clap(): t = tt(.2); x = np.diff(rng.standard_normal(len(t) + 1)); return x * (np.exp(-t * 24) + .7 * np.exp(-np.abs(t - .011) * 320) + .5 * np.exp(-np.abs(t - .022) * 320)) * .3
    def snare(): t = tt(.25); return (np.diff(rng.standard_normal(len(t) + 1)) * np.exp(-t * 16) * .35 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * .5)
    def sub(m, d): t = tt(d); return np.tanh(1.6 * np.sin(2 * np.pi * hz(m) * t)) * env(d, .008, .06)
    def braam(m, d=2.2):
        t = tt(d); f = hz(m); s = sum((1 / k) * np.sin(2 * np.pi * f * k * t * (1 + .0015 * np.sin(2 * np.pi * 5 * t))) for k in range(1, 22)) + .6 * sum((1 / k) * np.sin(2 * np.pi * f * 1.007 * k * t) for k in range(1, 16))
        return np.tanh(s * 1.4) * env(d, .07, d * .55) * np.exp(-t * .7)
    def riser(d): t = tt(d); k = t / d; return (np.diff(rng.standard_normal(len(t) + 1)) * k ** 2.4 * .5 + np.sin(2 * np.pi * (140 * t + (1700 / (2 * d)) * t * t)) * k ** 2 * .25) * env(d, .05, .02)
    def impact(): t = tt(3.0); return np.sin(2 * np.pi * (34 * t + 60 / 5 * (1 - np.exp(-5 * t)))) * np.exp(-t * 1.5) + lp(rng.standard_normal(len(t)), 5) * np.exp(-t * 4.5) * .35
    def whoosh(d=.45): t = tt(d); return lp(rng.standard_normal(len(t)), 7) * np.hanning(len(t)) * .5
    def tick(): t = tt(.03); return np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 200) * .4
    PROG = {"warm": [[50, 57, 62, 65], [46, 53, 58, 62], [41, 53, 57, 60], [48, 55, 60, 64]],   # Dm Bb F C
            "lift": [[46, 53, 58, 62], [48, 55, 60, 64], [50, 57, 62, 65], [45, 52, 57, 60]],   # Bb C Dm Am
            "dark": [[38, 50, 53, 57], [34, 46, 50, 53], [36, 48, 51, 55], [33, 45, 48, 52]]}   # Dm Bb Cm Am (low)
    ROOT = {"warm": [38, 34, 29, 36], "lift": [34, 36, 38, 33], "dark": [26, 22, 24, 21]}
    LEAD = [[77, -1, 74, 72, -1, 74, -1, 69], [72, -1, 74, -1, 77, 76, 74, -1], [81, -1, 79, 77, -1, 76, 74, -1], [74, -1, 72, 69, -1, 72, 74, -1]]
    style = {}
    for mi, (title, b0, b1) in enumerate(MOVE_BARS):
        for b in range(b0, b1): style[b] = (mi + 1, b - b0, b1 - b0)
    nbars = max(style) + 1
    for b in range(nbars + 2):
        t0 = b * bar
        if t0 >= total - .5: break
        mv, k, nb = style.get(b, (10, 0, 1))
        prog = "dark" if mv == 8 else ("lift" if mv in (5, 7, 9) else "warm"); ch = PROG[prog][b % 4]; rt = ROOT[prog][b % 4]
        last = k == nb - 1
        # pads everywhere except the button tail
        if mv <= 9: [add(pad(m, bar * 1.2), t0, (.55 if mv in (1, 8) else .38) * .5, pan=(-.3, .3, -.15, .15)[j]) for j, m in enumerate(ch)]
        if mv == 1:  # piano opening
            for j, m in enumerate([ch[0], ch[2], ch[3], ch[1] + 12]): add(piano(m + 12, 2.8, .55), t0 + j * BEAT, .32, pan=-.1 + .07 * j)
            if k % 2 == 1: add(piano(LEAD[b % 4][0], 3.0, .5), t0 + BEAT * 2, .2, pan=.15)
        if mv == 2:  # pulse grows; soft kick in the second half
            g = .05 + .1 * k / max(1, nb - 1)
            for e in range(8): add(pluck(ch[0] + (12 if e % 2 == 0 else 19), .2, 3 + k // 2), t0 + e * BEAT / 2, g * (1 if e % 2 == 0 else .7), pan=.25 if e % 2 else -.25)
            if k >= nb // 2: [add(kick(), t0 + q * BEAT, .45) for q in range(4)]
            for j, m in enumerate([ch[0], ch[2]]): add(piano(m + 12, 2.4, .4), t0 + j * BEAT * 2, .22)
        if mv in (3, 4, 5, 7, 9):  # grooves
            full = mv in (4, 5, 7, 9); big = mv in (7, 9)
            for s in range(16):
                ts = t0 + s * BEAT / 4 + (BEAT / 4 * .1 if s % 2 else 0)
                if (s % 4 == 0 and full) or (s in (0, 8) and not full): add(kick(), ts, .85 if big else .7)
                if s % 4 == 2: add(hat(True), ts, .45 if full else .3, pan=.2)
                elif s % 2 == 1: add(hat(), ts, .3, pan=-.2)
                if s in (4, 12) and full: add(clap(), ts, .8 if big else .6)
                if s in (0, 3, 6, 10, 13): add(sub(rt + (12 if s == 13 else 0), BEAT * .7), ts, .5 if big else .42)
                if s % 2 == 0: add(pluck(ch[(s * 3) % 4] + 24, .18, 6), ts, .07 if full else .05, pan=.35 * math.sin(s))
            if full:
                ld = LEAD[b % 4]; up = 12 if mv == 5 else 0
                for e, m in enumerate(ld):
                    if m > 0: add(pluck(m + up, .3, 6), t0 + e * BEAT / 2, .1 if big else .08, pan=.15); add(pluck(m + up, .3, 4), t0 + e * BEAT / 2 + BEAT * .75, .03, pan=-.3)
            if big and k % 2 == 0: add(braam(rt if rt > 30 else rt + 12, 2.2), t0, .2)
            if mv == 3 and k % 2 == 0: add(piano(ch[3] + 12, 2.4, .5), t0, .2)
        if mv == 6:  # half-time sunset
            add(kick(), t0, .6); add(snare(), t0 + BEAT * 2, .45); add(kick(), t0 + BEAT * 2.5, .35)
            for s in range(8): add(hat(), t0 + s * BEAT / 2, .2, pan=-.2)
            for e in range(4): add(sub(rt, BEAT * .9), t0 + e * BEAT, .32)
            for j, m in enumerate([ch[3] + 12, ch[2] + 12, ch[1] + 12]): add(piano(m, 3.0, .6), t0 + j * BEAT * 1.33, .26)
        if mv == 8:  # story: drop, dark, ticking, building
            if k == 0: add(impact(), t0, .9); add(braam(26, 3.5), t0, .45)
            for q in range(4): add(tick(), t0 + q * BEAT, .25 + .05 * k)
            if k >= 2: add(sub(rt, bar * .95), t0, .25 + .03 * k)
            if k % 2 == 0: add(piano(ch[1] + 24, 4.0, .5), t0 + BEAT, .22); add(piano(ch[3] + 24, 4.0, .4), t0 + BEAT * 3, .16)
            if k >= 6: [add(kick(), t0 + q * BEAT, .25 + .08 * (k - 6)) for q in range(4)]
        if mv in (2, 3, 4, 5, 6, 7, 8) and last:  # riser into each new movement
            add(riser(bar * (1.0 if mv != 8 else 2.0)), t0 + bar - bar * (1.0 if mv != 8 else 2.0), .3 if mv != 8 else .55)
    for mi, (title, b0, b1) in enumerate(MOVE_BARS):  # hits on movement starts
        if mi >= 1: add(impact(), b0 * bar, .45 if mi != 7 else 0)
    # logo: big hit, held chord, button and ring
    cr = [s for s in SCHED if s["shot"] == "@credit"][0]["start"]; cta = [s for s in SCHED if s["shot"] == "@cta"][0]["start"]
    add(impact(), cr, .9); add(braam(26, 3.2), cr, .45)
    for m, p in zip((38, 50, 57, 62, 65, 69, 74), (0, -.3, .3, -.2, .2, -.1, .1)): add(pad(m, 6.5) * 1.6, cr, .5, pan=p)
    add(impact(), cta, .7)
    for m in (50, 57, 62, 69, 74): add(piano(m, 5.0, 1.0), cta, .4)
    for s in SCHED:  # whooshes on the flash cuts
        if s["opt"].get("flash") and s["start"] > 1: add(whoosh(), s["start"] - .3, .12, pan=.4 * math.sin(s["start"] * 3))
    for _ in range(30):  # birds over the opening
        t0 = rng.uniform(.3, 14); f0 = rng.uniform(2600, 4800); Ln = rng.uniform(.06, .14); t = tt(Ln)
        sg = np.sin(2 * np.pi * (f0 + 900 * np.sin(2 * np.pi * rng.uniform(18, 40) * t)) * t) * np.hanning(len(t))
        for q in range(rng.integers(1, 4)): add(sg, t0 + q * Ln * 1.5, .04)
    st = np.stack([L, R], 1); fi = int(.5 * SR); st[:fi] *= np.linspace(0, 1, fi)[:, None]; fo = int(2.5 * SR); st[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 2
    return st

def wr(p, a):
    with wave.open(p, "wb") as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(a, -1, 1) * 32767).astype("<i2").tobytes())
def loud(p):
    r = subprocess.run([FF, "-hide_banner", "-i", p, "-af", "loudnorm=print_format=json", "-f", "null", "-"], capture_output=True, text=True); j = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r.stderr, re.S).group(0)); return float(j["input_i"]), float(j["input_tp"])
def limit(a, ceil_db):
    c = 10 ** (ceil_db / 20); k = c * .8; s = np.sign(a); m = np.abs(a); o = m > k; m[o] = k + (c - k) * np.tanh((m[o] - k) / (c - k)); return s * m

def mix_audio():
    music = score(TOTAL); tmp = os.path.join(WORK, "ext_music.wav"); wr(tmp, limit(music, -1)); i, _ = loud(tmp); music *= 10 ** ((-14.5 - i) / 20)
    vo_p = os.path.join(OUT, "extended_voiceover.wav"); note = "music only"
    if os.path.exists(vo_p):
        tmpv = os.path.join(WORK, "ext_vo.wav"); subprocess.run([FF, "-y", "-loglevel", "error", "-i", vo_p, "-ac", "1", "-ar", str(SR), "-af", "highpass=f=80,acompressor=threshold=-20dB:ratio=2.5:attack=12:release=180:makeup=2", "-c:a", "pcm_s16le", tmpv], check=True)
        with wave.open(tmpv) as w: v = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(np.float64) / 32768
        v = np.pad(v[: len(music)], (0, max(0, len(music) - len(v)))); vi, _ = loud(tmpv); v *= 10 ** ((-16 - vi) / 20)
        e = np.convolve(np.abs(v), np.ones(882) / 882, "same"); gate = (e > 10 ** (-40 / 20)).astype(float); a_c, r_c = math.exp(-32 / (.08 * SR)), math.exp(-32 / (.4 * SR)); f = np.zeros_like(gate); y = 0.0
        for q in range(0, len(gate), 32): x = gate[q]; y = x + (y - x) * (a_c if x > y else r_c); f[q:q + 32] = y
        sp = gate > .5
        if sp.any():
            under = 20 * math.log10(np.sqrt(np.mean(music.mean(1)[sp] ** 2)) / np.sqrt(np.mean(v[sp] ** 2)))
            duck = 10 ** (min(0, -12 - under) / 20); music = music * (1 + (duck - 1) * f)[:, None]
        music = music + v[:, None]; note = "voiceover mixed with ducking"
    pre = os.path.join(WORK, "ext_pre.wav"); out = os.path.join(WORK, "ext_mix.wav"); i, _ = (wr(pre, limit(music, -1)), loud(pre))[1]; wr(pre, limit(music * 10 ** ((-15 - i) / 20), -1))
    # master: brick-wall limiter, then loudness to -14 LUFS with true peak capped at -1.5 dBTP
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", pre, "-af", "alimiter=limit=0.6:attack=3:release=60:level=disabled,loudnorm=I=-15.5:TP=-1.5:LRA=14", "-ar", str(SR), "-c:a", "pcm_s16le", out], check=True)
    i2, tp2 = loud(out)
    return out, {"lufs": i2, "true_peak": tp2, "note": note}

def frames():
    prev = None; done = 0; sups = {}
    for s in SCHED + [{"shot": "@hold", "start": TOTAL_BEATS * BEAT, "end": TOTAL, "opt": {}}]:
        shot, opt = s["shot"], s["opt"]; n = int(round(s["end"] * FPS)) - done; fs = [] if shot.startswith("@") else src(shot); card = None
        if shot == "@credit": card = np.asarray(B.logo_card(True)).astype(np.float32)
        if shot in ("@cta", "@hold"): card = np.asarray(B.logo_card(False)).astype(np.float32)
        if not fs and card is None and shot != "@montage": print("MISSING", shot); card = np.asarray(B.backdrop()).astype(np.float32)
        if opt.get("sup") and opt["sup"] not in sups:
            img = Image.new("RGB", (W, H), (0, 0, 0)); B.grad_text(img, opt["sup"], H / 2, 150); a = np.asarray(img).astype(np.float32); sups[opt["sup"]] = (a, np.clip(a.max(2) / 190.0, 0, 1)[..., None])
        off = opt.get("off", 0)
        for i in range(n):
            t = i / max(1, n - 1)
            if card is not None:
                z = 1.0 + .03 * t; cw, ch = W / z, H / z
                a = np.asarray(Image.fromarray(card.astype(np.uint8)).transform((W, H), Image.EXTENT, ((W - cw) / 2, (H - ch) / 2, (W + cw) / 2, (H + ch) / 2), Image.BILINEAR)).astype(np.float32)
            elif shot == "@montage":
                pick = [m for m in MONTAGE if src(m)][min(len(MONTAGE) - 1, int(i / (BEAT * FPS)))]; f = src(pick); a = B.grade(Image.open(f[min(len(f) - 1, len(f) // 2 + int(i % (BEAT * FPS)))]).convert("RGB"))
                if i % int(BEAT * FPS) < 2: a = a + (255 - a) * .35
            else:
                avail = len(fs) - off; u = t ** .62 if opt.get("ramp") else t
                a = B.grade(Image.open(fs[min(len(fs) - 1, off + int(round(u * (min(avail, n) - 1))))]).convert("RGB"), opt.get("flip"))
                if opt.get("sup"):
                    kk = max(0, min(1, (i - n * .25) / 12, (n * .9 - i) / 12)); a = a * (1 - .45 * kk); ov = sups[opt["sup"]]; a = a * (1 - ov[1] * kk) + ov[0] * ov[1] * kk
            if opt.get("fade") and i < 12: a = a * (i / 12) + (prev * (1 - i / 12) if prev is not None else 0)
            if opt.get("flash") and i < 4: a = a + (255 - a) * (.5 * (1 - i / 4))
            a = np.clip(a, 0, 255); yield a.astype(np.uint8)
        done += n; prev = a

def docs(info):
    def ts(x): return "%d:%04.1f" % (int(x // 60), x % 60)
    md = ["# Freshers School Life — extended trailer: shot list", "", "Length %s at %d bpm (one beat = %.2f s). Music only; room is left for a voiceover. Every cut is on the beat." % (ts(TOTAL), BPM, BEAT), ""]
    for mi, (title, shots) in enumerate(MOVES):
        rows = [s for s in SCHED if s["move"] == mi + 1]; md += ["## %d. %s (%s – %s)" % (mi + 1, title, ts(rows[0]["start"]), ts(rows[-1]["end"])), "", "| Time | Length | Shot | Note |", "|---|---|---|---|"]
        for s in rows: md.append("| %s | %.1f s | %s | %s |" % (ts(s["start"]), s["end"] - s["start"], s["shot"].lstrip("@"), DESC.get(s["shot"], "") + (" Super: \"%s\"" % s["opt"]["sup"] if s["opt"].get("sup") else "")))
        md.append("")
    md += ["Logo holds to %s with the ring-out." % ts(TOTAL), "", "Mix: %s, %.1f LUFS, true peak %.1f dB." % (info["note"], info["lufs"], info["true_peak"])]
    open(os.path.join(OUT, "FSLG_extended_shotlist.md"), "w").write("\n".join(md) + "\n")
    json.dump({"bpm": BPM, "beat": BEAT, "total": TOTAL, "moves": [{"title": t, "start": b0 * 4 * BEAT, "end": b1 * 4 * BEAT} for t, b0, b1 in MOVE_BARS], "shots": [{k: v for k, v in s.items() if k != "opt"} for s in SCHED]}, open(os.path.join(HERE, "ext_timing.json"), "w"), indent=1)

DESC = {"gate_dawn": "Dawn crane over the Main Gate.", "hero_walk": "M.I. BUGAJE walks in, front tracking.", "boulevard_sprint": "Sprint down the palm boulevard, dust.", "fountain_orbit": "Orbit of Fountain Circle and flags.",
 "letters": "Push in on the FSLG letters, Senate behind.", "senate_rise": "Crane up the Senate tower.", "aerial_campus": "High drift over the whole campus.", "p2_aerial": "Over Phase 2 and the long road.", "phase2": "Phase 2 hostels.",
 "eng_quad": "Engineering quad and the lecture theatres.", "coil_day": "The Tesla coil by day.", "lec_walk": "Into Kainji Theatre.", "lec_board": "Seated; the lecturer writes the lesson on the board.", "library": "Library.", "hostel_room": "Hostel room at night.",
 "canteen": "Canteen at lunch.", "senate_lobby": "Senate lobby.", "lab": "Department lab.", "sickbay": "Sick Bay.", "library_night": "Library late at night.", "mall_atrium": "Samaru Mall atrium.", "mall_fashion": "Fashion store.", "fitting": "Fitting room / wardrobe.",
 "mib_store": "The MIB Store.", "arcade_room": "Games Room cabinets.", "mini_tabletennis": "Mini-game: Table Smash.", "mini_kola": "Mini-game: Kola Stack.", "mini_run": "Mini-game: run.", "mini_patrol": "Mini-game: patrol.", "mini_ayo": "Mini-game: ayo.",
 "dance_floor": "Dance floor with friends.", "bigmap": "Big map: legend and zoom.", "friends_walk": "Friends walking with you.", "pillion": "Okada with a friend riding pillion.", "job": "ON A JOB.", "phone": "The phone.", "coop": "Co-op / room menu.",
 "celebrate": "MISSION PASSED.", "friends_dance": "Dancing at the fountain.", "pier_date": "A date at the pier, sunset.", "courts": "Social Centre courts from above.", "lake_lapse": "Sunset to night at The Dam.",
 "shinkafi_night": "Shinkafi lit at night.", "social_night": "Social Centre at night.", "coil_night": "The coil arcing at night.", "fight": "Fight: they swing, you block, your kick lands.", "security": "Security warning and chase (heat eye).",
 "bike_sprint": "Bicycle, out of the saddle.", "okada": "Okada leaning through a bend.", "keke": "Keke.", "drift": "Handbrake drift past pedestrians, smoke and skid marks.", "sport": "Sports car.", "takeoff": "Plane take-off: nose lifts, climbs.",
 "bank": "Banking over campus.", "wild_hills": "The wilderness hills beyond the fence.", "patrol": "Wilderness patrol warning.", "tease_coil": "The coil in the dark.", "tease_hall": "An empty lecture theatre.", "tease_lake": "The lake at night.",
 "tease_senate": "The Senate at dusk.", "tease_gate": "The gate at night, walking out.", "@montage": "Sixteen one-beat cuts of the best moments.", "@credit": "Logo: A game by M.I. BUGAJE — Muhammad Iliyasu Bugaje.", "@cta": "Play it on EE Hub."}

def main():
    os.makedirs(WORK, exist_ok=True); wav, info = mix_audio(); print("audio", info, "total %.1f s" % TOTAL); docs(info)
    if "--audio-only" in sys.argv: return
    mp4 = os.path.join(OUT, "FSLG_extended_trailer.mp4"); nf = int(round(TOTAL * FPS))
    p = subprocess.Popen([FF, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "%dx%d" % (W, H), "-r", str(FPS), "-i", "-", "-i", wav, "-vf", "fade=t=out:st=%.2f:d=1.5" % (TOTAL - 1.5),
                          "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", mp4], stdin=subprocess.PIPE)
    k = 0
    for fr in frames():
        if k >= nf: break
        p.stdin.write(fr.tobytes()); k += 1
    p.stdin.close(); p.wait(); print("frames", k, "->", mp4, "%.1f MB %.1f s" % (os.path.getsize(mp4) / 1e6, k / FPS))
    secs = [TOTAL * (j + .5) / 12 for j in range(12)]; pairs = []
    for nm in ("boulevard_sprint", "dance_floor", "drift", "takeoff"):
        s = [x for x in SCHED if x["shot"] == nm][0]; m = (s["start"] + s["end"]) / 2; pairs += [m, m + 1 / FPS]
    tiles = []
    for j, sec in enumerate(secs + pairs):
        o = os.path.join(WORK, "cx_%02d.jpg" % j); subprocess.run([FF, "-y", "-loglevel", "error", "-ss", "%.3f" % sec, "-i", mp4, "-frames:v", "1", "-vf", "scale=480:-1", o]); tiles.append(Image.open(o))
    sh = Image.new("RGB", (480 * 4, 270 * 3))
    for j, tl in enumerate(tiles[:12]): sh.paste(tl, ((j % 4) * 480, (j // 4) * 270))
    sh.save(os.path.join(WORK, "checks_ext.jpg"), quality=80)
    df = lambda a, b: np.abs(np.asarray(tiles[a]).astype(int) - np.asarray(tiles[b]).astype(int)).mean()
    print("motion:", ", ".join("%s %.2f" % (nm, df(12 + 2 * q, 13 + 2 * q)) for q, nm in enumerate(("sprint", "dance", "drift", "takeoff"))))

if __name__ == "__main__": main()
