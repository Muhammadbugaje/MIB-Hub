"""Original score for the FSLG opening, in four cues: title (aerial), bed (loops under the arrival), brief (groove), logo (hit).
Synth voices are the trailer pipeline's (docs/trailer/pipeline/vo_mix.py), re-composed. Writes static/audio/fslg-intro/*.m4a|.ogg"""
import numpy as np, math, wave, subprocess, os, json, imageio_ffmpeg
SR = 44100; FF = imageio_ffmpeg.get_ffmpeg_exe(); OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "static", "audio", "fslg-intro"); os.makedirs(OUT, exist_ok=True)
BPM = 96.0; beat = 60 / BPM; bar = beat * 4; rng = np.random.default_rng(7)
tt = lambda d: np.arange(int(d * SR)) / SR
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
def env(d, a, r): m = int(d * SR); e = np.ones(m); ai = min(m, max(1, int(a * SR))); ri = min(m, max(1, int(r * SR))); e[:ai] *= np.linspace(0, 1, ai); e[-ri:] *= np.linspace(1, 0, ri); return e
def noise(m): return rng.standard_normal(m)
def lp(x, k): return np.convolve(x, np.ones(k) / k, "same") if k > 1 else x
def piano(m, d=2.6, vel=1.0): t = tt(d); f = hz(m); s = sum((1 / k ** 1.35) * np.sin(2 * np.pi * f * k * (1 + .0004 * k * k) * t) * np.exp(-t * (1.1 + .55 * k)) for k in range(1, 9)); return s * env(d, .004, .3) * vel
def pad(m, d, det=1.003): t = tt(d); f = hz(m); s = sum((1 / k) * (np.sin(2 * np.pi * f * k * t) + np.sin(2 * np.pi * f * det * k * t + k)) for k in range(1, 7)); return lp(s, 9) * env(d, min(.9, d * .3), min(1.2, d * .35)) * .2
def pluck(m, d=.22, bright=5): t = tt(d); f = hz(m); s = sum((1 / k) * np.sin(2 * np.pi * f * k * t) * np.exp(-t * (7 + 3 * k)) for k in range(1, bright + 1)); return s * env(d, .003, .04)
def kalimba(m, d=1.4): t = tt(d); f = hz(m); return (np.sin(2 * np.pi * f * t) + .35 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 9)) * np.exp(-t * 3.2) * env(d, .002, .2)
def kick(): t = tt(.36); return np.tanh(2.2 * np.sin(2 * np.pi * (46 * t + 95 / 26 * (1 - np.exp(-26 * t)))) * np.exp(-t * 8.5)) * .9
def hat(o=False): t = tt(.16 if o else .045); x = np.diff(np.diff(noise(len(t) + 2))); return x * np.exp(-t * (22 if o else 95)) * .25
def clap(): t = tt(.2); x = np.diff(noise(len(t) + 1)); return x * (np.exp(-t * 24) + .7 * np.exp(-np.abs(t - .011) * 320) + .5 * np.exp(-np.abs(t - .022) * 320)) * .3
def shaker(): t = tt(.07); x = np.diff(noise(len(t) + 1)); return x * np.exp(-t * 60) * .12
def talk(m, d=.14): t = tt(d); f = hz(m) * (1 + .25 * np.exp(-t * 30)); return np.sin(2 * np.pi * f * t) * np.exp(-t * 14)  # a talking-drum style slide
def sub(m, d): t = tt(d); return np.tanh(1.6 * np.sin(2 * np.pi * hz(m) * t)) * env(d, .008, .06)
def braam(m, d=2.2):
    t = tt(d); f = hz(m); s = sum((1 / k) * np.sin(2 * np.pi * f * k * t * (1 + .0015 * np.sin(2 * np.pi * 5 * t))) for k in range(1, 22)); s += .6 * sum((1 / k) * np.sin(2 * np.pi * f * 1.007 * k * t) for k in range(1, 16))
    return np.tanh(s * 1.4) * env(d, .07, d * .55) * np.exp(-t * .7)
def riser(d): t = tt(d); k = t / d; x = np.diff(noise(len(t) + 1)) * k ** 2.4 * .5 + np.sin(2 * np.pi * (140 * t + (1700 / (2 * d)) * t * t)) * k ** 2 * .25; return x * env(d, .05, .02)
def impact(): t = tt(3.0); return np.sin(2 * np.pi * (34 * t + 60 / 5 * (1 - np.exp(-5 * t)))) * np.exp(-t * 1.5) + lp(noise(len(t)), 5) * np.exp(-t * 4.5) * .35
def whoosh(d=.6): t = tt(d); return lp(noise(len(t)), 7) * np.hanning(len(t)) * .5
PROG = [[53, 60, 65, 69], [48, 55, 60, 64], [50, 57, 62, 65], [46, 53, 58, 62]]  # F  C  Dm  Bb  (warm, hopeful)
ROOTS = [41, 36, 38, 34]; TOP = [81, 79, 77, 74]
class Track:
    def __init__(s, dur): s.n = int(dur * SR); s.L = np.zeros(s.n); s.R = np.zeros(s.n)
    def add(s, sig, t0, g=1.0, pan=0.0):
        i = int(t0 * SR)
        if i < 0: sig = sig[-i:]; i = 0
        if i >= s.n: return
        sig = sig[: s.n - i]; s.L[i:i + len(sig)] += sig * g * (1 - max(0, pan)); s.R[i:i + len(sig)] += sig * g * (1 + min(0, pan))
    def st(s): return np.stack([s.L, s.R], 1)
def write(name, st, peak_db=-3.0, loop=False):
    if loop:  # fold the tail into the head so the bed loops with no click
        k = int(2 * bar * SR) if False else int(1.5 * SR); body = st[:-k].copy(); tail = st[-k:]; body[:k] += tail * np.linspace(1, 0, k)[:, None]; st = body
    st = st / (np.abs(st).max() + 1e-9) * 10 ** (peak_db / 20)
    p = f"{OUT}/{name}.wav"
    with wave.open(p, "wb") as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(st, -1, 1) * 32767).astype("<i2").tobytes())
    for ext, args in (("m4a", ["-c:a", "aac", "-b:a", "128k"]), ("ogg", ["-c:a", "libopus", "-b:a", "96k", "-ar", "48000"])):
        r = subprocess.run([FF, "-hide_banner", "-y", "-loglevel", "error", "-i", p, *args, f"{OUT}/{name}.{ext}"], capture_output=True, text=True); assert r.returncode == 0, r.stderr
    os.remove(p); return len(st) / SR

meta = {"bpm": BPM}
# 1. TITLE: kalimba motif over pads, slow and wide (the aerial over campus). 12 bars = 30 s, ends on a lift.
T = Track(12 * bar + 3); motif = [77, 81, 84, 81, 79, 77, 74, 77]
for b in range(12):
    t0 = b * bar; ch = PROG[b % 4]
    for j, m in enumerate(ch): T.add(pad(m, bar * 1.25), t0, .42 if b < 11 else .3, pan=(-.35, .35, -.15, .15)[j])
    if b >= 2:
        for e, m in enumerate(motif if b % 2 == 0 else motif[::-1]): T.add(kalimba(m - (12 if b < 4 else 0), 1.3), t0 + e * beat / 2, .16 if e % 2 == 0 else .1, pan=.3 * math.sin(e))
    if b >= 4: T.add(piano(ch[0] + 12, 2.8, .5), t0, .22); T.add(piano(TOP[b % 4], 3, .5), t0 + beat * 2, .16, pan=.2)
    if b >= 6:
        for s in range(8): T.add(shaker(), t0 + s * beat / 2, .5 if s % 2 else .3, pan=.25)
        T.add(sub(ROOTS[b % 4], beat * 1.6), t0, .25)
T.add(riser(bar * 1.5), 10.5 * bar, .4); T.add(whoosh(1.2), 12 * bar - .8, .35)
meta["title"] = round(write("title", T.st()), 2)
# 2. BED: 8 bars, gentle piano + kalimba + soft talking drum; loops seamlessly (arrival, freshers, the room choice).
B = Track(8 * bar + 1.5)
for b in range(8):
    t0 = b * bar; ch = PROG[b % 4]
    for j, m in enumerate(ch): B.add(pad(m, bar * 1.2), t0, .3, pan=(-.3, .3, -.15, .15)[j])
    for j, m in enumerate([ch[0], ch[2], ch[3], ch[1] + 12]): B.add(piano(m + 12, 2.6, .45), t0 + j * beat, .22, pan=-.1 + .07 * j)
    if b % 2 == 1: B.add(kalimba(TOP[b % 4], 1.6), t0 + beat * 2.5, .12, pan=.25)
    for s in (0, 3, 6, 10, 13): B.add(talk(ROOTS[b % 4] + 24 + (5 if s == 13 else 0)), t0 + s * beat / 4, .12, pan=-.2)
    for s in range(8): B.add(shaker(), t0 + s * beat / 2, .25 if s % 2 else .15, pan=.3)
meta["bed"] = round(write("bed", B.st(), -5.0, loop=True), 2)
# 3. BRIEF: groove, 16 bars = 40 s: four bars building, eight full, two lifted, two with a riser into the logo.
G = Track(16 * bar + .5)
for b in range(16):
    t0 = b * bar; ch = PROG[b % 4]; full = 4 <= b < 14; build = b < 4
    for j, m in enumerate(ch): G.add(pad(m, bar * 1.2), t0, .3 if full else .4, pan=(-.3, .3, -.15, .15)[j])
    for s in range(16):
        ts = t0 + s * beat / 4 + (beat / 4 * .1 if s % 2 else 0)
        if s % 4 == 0 and (full or (build and b >= 2)): G.add(kick(), ts, .75)
        if full and s % 4 == 2: G.add(hat(True), ts, .35, pan=.2)
        elif s % 2 == 1: G.add(hat(), ts, .3 if full else .15, pan=-.2)
        if full and s in (4, 12): G.add(clap(), ts, .6)
        if full and s in (0, 3, 6, 10, 13): G.add(sub(ROOTS[b % 4] + (12 if s == 13 else 0), beat * .7), ts, .45)
        if s % 2 == 0: G.add(pluck(ch[(s * 3) % 4] + 24, .18, 6 if full else 4), ts, .07 if full else .05, pan=.35 * math.sin(s))
        if full and s in (2, 7, 11, 14): G.add(talk(ROOTS[b % 4] + 31), ts, .14, pan=.25)
    if b in (4, 8, 12): G.add(impact(), t0, .4); G.add(braam(ROOTS[b % 4] - 12 if ROOTS[b % 4] > 33 else ROOTS[b % 4], 2), t0, .2)
    if b >= 12: G.add(piano(TOP[b % 4], 2.4, .9), t0, .26, pan=.1)
G.add(riser(bar * 2), 14 * bar, .6)
for k in range(8): G.add(clap(), 16 * bar - beat * 2 + k * beat / 4, .15 + .08 * k)
meta["brief"] = round(write("brief", G.st()), 2)
# 4. LOGO: the hit, a wide chord and a ringing piano; 8 s.
L = Track(8.0); L.add(impact(), 0, .9); L.add(braam(29, 3.4), 0, .45)
for m, p in zip((41, 53, 60, 65, 69, 72, 77), (0, -.3, .3, -.2, .2, -.1, .1)): L.add(pad(m, 6) * 1.5, 0, .5, pan=p)
for k, m in enumerate((65, 72, 77, 81)): L.add(piano(m, 5, 1), .02 + k * .09, .35)
L.add(kalimba(89, 2.5), 1.2, .15); L.add(kalimba(84, 2.5), 1.5, .12)
meta["logo"] = round(write("logo", L.st()), 2)
json.dump(meta, open(f"{OUT}/score.json", "w")); print(meta)
