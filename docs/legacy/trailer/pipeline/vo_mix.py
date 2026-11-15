"""Trailer v3 audio: the owner's own voice (docs/trailer/trailer_audio.m4a), cleaned and placed phrase by phrase,
over an original synthesized score whose tempo is solved from his phrase starts. No synthesized speech, no samples.
Run vo_analyse.py first.  Writes pipeline/v3_timing.json, $FSLG_WORK/mix_v3.wav and docs/trailer/v3_audio_preview.m4a."""
import os, json, math, subprocess, wave, re
import numpy as np
import imageio_ffmpeg

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.dirname(HERE); WORK = os.environ.get("FSLG_WORK", "/tmp/fslg-trailer")
SR = 44100; FF = imageio_ffmpeg.get_ffmpeg_exe(); LEAD = 1.0  # seconds of picture and music before his first word

# What each detected phrase most likely is. There is no speech recognition here: this is matched by ORDER and LENGTH only.
GUESS = {1: ("L1a 'Every legend on this campus started the same way,'", "high"), 2: ("L1b 'as a fresher.'", "high"),
 3: ("L2a 'One school, a thousand stories.'", "high"), 4: ("L2b 'So, which one is yours?'", "high"), 5: ("L3a '36 missions and a variety of vehicles'", "medium"),
 6: ("L3b 'for you'", "medium"), 7: ("L3c 'to ride and also drive.'", "medium"), 8: ("quiet 0.3 s blip between lines: breath or click (left out)", "low"),
 9: ("L4 'Whoa, watch out there, whoa. And then sometimes you could even'", "high"), 10: ("L5 'fly, so you could have the view from the top.'", "high"),
 11: ("L6a 'Dodge security,'", "high"), 12: ("L6b 'bring your guys.'", "high"), 13: ("L7a 'You can also play with friends'", "high"),
 14: ("L7b/L8a 'and when the sun goes down, the music changes'", "high"), 15: ("L8b 'and there are lots of places you can visit at night.'", "high"),
 16: ("L9 'Fresher School Life, welcome to school.'", "high")}
KEY = [1, 3, 5, 7, 9, 10, 11, 13, 14, 15, 16]  # phrases whose starts should land on a bar or half-bar

def ffrun(args): return subprocess.run([FF, "-hide_banner"] + args, capture_output=True, text=True)
def rd(p):
    with wave.open(p) as w: a = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(np.float64) / 32768; return a.reshape(-1, w.getnchannels())
def wr(p, a):
    a = np.atleast_2d(a.T).T if a.ndim == 1 else a
    with wave.open(p, "wb") as w: w.setnchannels(a.shape[1]); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(a, -1, 1) * 32767).astype("<i2").tobytes())
def loud(p):
    r = ffrun(["-i", p, "-af", "loudnorm=print_format=json", "-f", "null", "-"]); m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r.stderr, re.S); j = json.loads(m.group(0)); return float(j["input_i"]), float(j["input_tp"])
def limit(a, ceil_db):
    c = 10 ** (ceil_db / 20); k = c * .8; s = np.sign(a); m = np.abs(a); over = m > k; m[over] = k + (c - k) * np.tanh((m[over] - k) / (c - k)); return s * m

def clean_voice():
    """High-pass, light denoise, de-ess, gentle compression, presence lift; then gain to -16 LUFS, true peak under -1.5 dB."""
    raw = os.path.join(WORK, "vo_raw.wav"); out = os.path.join(WORK, "vo_clean.wav")
    chains = ["highpass=f=80,afftdn=nr=8:nf=-45,deesser=i=0.3,acompressor=threshold=-20dB:ratio=2.5:attack=12:release=180:makeup=2,equalizer=f=4200:t=q:w=1.2:g=2.5,equalizer=f=220:t=q:w=1:g=-1.5",
              "highpass=f=80,acompressor=threshold=-20dB:ratio=2.5:attack=12:release=180:makeup=2,equalizer=f=4200:t=q:w=1.2:g=2.5", "highpass=f=80"]
    used = None
    for c in chains:
        r = ffrun(["-y", "-loglevel", "error", "-i", raw, "-af", c, "-ar", str(SR), "-ac", "1", "-c:a", "pcm_s16le", out])
        if r.returncode == 0: used = c; break
    i, tp = loud(out); v = rd(out)[:, 0] * 10 ** ((-16 - i) / 20); v = limit(v, -1.8); wr(out, v); i2, tp2 = loud(out)
    return v, {"chain": used, "lufs_before": i, "lufs_after": i2, "true_peak_after": tp2}

def solve_tempo(segs):
    """Pick bpm and phase so the key phrase starts sit on half-bar lines; then nudge phrases (max 0.3 s) onto the grid."""
    st = {s["i"]: s["start"] + LEAD for s in segs}; best = None
    for bpm in np.arange(88, 126.01, .25):
        hb = 120.0 / bpm
        for ph in np.arange(0, hb, .02):
            d = [((st[k] - ph + hb / 2) % hb) - hb / 2 for k in KEY]; cost = sum(min(abs(x), .6) ** 2 for x in d) + .02 * sum(abs(x) > .3 for x in d)
            cost += .0006 * abs(bpm - 108)  # mild preference for a confident mid tempo
            if best is None or cost < best[0]: best = (cost, float(bpm), float(ph))
    _, bpm, ph = best; hb = 120.0 / bpm; placed = []; prev_end = -1
    for s in segs:
        t = s["start"] + LEAD; g = ph + round((t - ph) / hb) * hb; nud = max(-.3, min(.3, g - t)) if s["i"] in KEY else (placed[-1]["nudge"] if placed else 0)
        if t + nud < prev_end + .1: nud = prev_end + .1 - t
        placed.append({"i": s["i"], "src_start": s["start"], "src_end": s["end"], "at": round(t + nud, 3), "end": round(t + nud + s["dur"], 3), "nudge": round(nud, 3),
                       "on_grid": bool(s["i"] in KEY and abs(t + nud - g) < .03), "guess": GUESS.get(s["i"], ("?", "low"))[0], "confidence": GUESS.get(s["i"], ("?", "low"))[1]}); prev_end = t + nud + s["dur"]
    return bpm, ph, placed

def place_voice(v, placed, total):
    out = np.zeros(int(total * SR)); f = int(.03 * SR)
    for p in placed:
        if p["confidence"] == "low" and p["src_end"] - p["src_start"] < .4: continue  # the tiny blip
        x = v[int(p["src_start"] * SR):int(p["src_end"] * SR)].copy(); x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f); i = int(p["at"] * SR); x = x[: len(out) - i]; out[i:i + len(x)] += x
    return out

# ---------------- score ----------------
def score(total, bpm, ph, T):
    n = int(total * SR); L = np.zeros(n); R = np.zeros(n); rng = np.random.default_rng(11); beat = 60.0 / bpm; bar = beat * 4
    def add(sig, t0, g=1.0, pan=0.0):
        i = int(t0 * SR)
        if i < 0: sig = sig[-i:]; i = 0
        if i >= n: return
        sig = sig[: n - i]; L[i:i + len(sig)] += sig * g * (1 - max(0, pan)); R[i:i + len(sig)] += sig * g * (1 + min(0, pan))
    tt = lambda d: np.arange(int(d * SR)) / SR
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)
    def env(d, a, r): m = int(d * SR); e = np.ones(m); ai = min(m, max(1, int(a * SR))); ri = min(m, max(1, int(r * SR))); e[:ai] *= np.linspace(0, 1, ai); e[-ri:] *= np.linspace(1, 0, ri); return e
    def noise(m): return rng.standard_normal(m)
    def lp(x, k): return np.convolve(x, np.ones(k) / k, "same") if k > 1 else x
    def piano(m, d=2.6, vel=1.0):
        t = tt(d); f = hz(m); s = sum((1 / k ** 1.35) * np.sin(2 * np.pi * f * k * (1 + .0004 * k * k) * t) * np.exp(-t * (1.1 + .55 * k)) for k in range(1, 9)); return s * env(d, .004, .3) * vel
    def pad(m, d, det=1.003):
        t = tt(d); f = hz(m); s = sum((1 / k) * (np.sin(2 * np.pi * f * k * t) + np.sin(2 * np.pi * f * det * k * t + k)) for k in range(1, 7)); return lp(s, 9) * env(d, min(.9, d * .3), min(1.2, d * .35)) * .2
    def pluck(m, d=.22, bright=5):
        t = tt(d); f = hz(m); s = sum((1 / k) * np.sin(2 * np.pi * f * k * t) * np.exp(-t * (7 + 3 * k)) for k in range(1, bright + 1)); return s * env(d, .003, .04)
    def kick(): t = tt(.36); return np.tanh(2.2 * np.sin(2 * np.pi * (46 * t + 95 / 26 * (1 - np.exp(-26 * t)))) * np.exp(-t * 8.5)) * .9
    def hat(o=False): t = tt(.16 if o else .045); x = np.diff(np.diff(noise(len(t) + 2))); return x * np.exp(-t * (22 if o else 95)) * .25
    def clap(): t = tt(.2); x = np.diff(noise(len(t) + 1)); return x * (np.exp(-t * 24) + .7 * np.exp(-np.abs(t - .011) * 320) + .5 * np.exp(-np.abs(t - .022) * 320)) * .3
    def sub(m, d): t = tt(d); return np.tanh(1.6 * np.sin(2 * np.pi * hz(m) * t)) * env(d, .008, .06)
    def braam(m, d=2.2):
        t = tt(d); f = hz(m); s = sum((1 / k) * np.sin(2 * np.pi * f * k * t * (1 + .0015 * np.sin(2 * np.pi * 5 * t))) for k in range(1, 22)); s += .6 * sum((1 / k) * np.sin(2 * np.pi * f * 1.007 * k * t) for k in range(1, 16))
        return np.tanh(s * 1.4) * env(d, .07, d * .55) * np.exp(-t * .7)
    def riser(d):
        t = tt(d); k = t / d; x = np.diff(noise(len(t) + 1)) * k ** 2.4 * .5 + np.sin(2 * np.pi * (140 * t + (1700 / (2 * d)) * t * t)) * k ** 2 * .25; return x * env(d, .05, .02)
    def impact(): t = tt(3.0); return np.sin(2 * np.pi * (34 * t + 60 / 5 * (1 - np.exp(-5 * t)))) * np.exp(-t * 1.5) + lp(noise(len(t)), 5) * np.exp(-t * 4.5) * .35
    def whoosh(d=.45): t = tt(d); return lp(noise(len(t)), 7) * np.hanning(len(t)) * .5
    prog = [[50, 57, 62, 65], [46, 53, 58, 62], [41, 53, 57, 60], [48, 55, 60, 64]]  # Dm  Bb  F  C  (voiced low-mid)
    roots = [38, 34, 29, 36]; top = [77, 74, 81, 79]
    b0 = ph - math.ceil(ph / bar) * bar  # first bar line at or before 0
    def barix(t): return int(math.floor((t - b0) / bar + 1e-6))
    def snap(t, unit=bar): return b0 + round((t - b0) / unit) * unit
    tPulse, tGroove, tHit, tStop, tBig, tLogo, tButton = snap(T["pulse"], bar / 2), snap(T["groove"], bar / 2), snap(T["hit"], bar / 2), snap(T["stop"], bar / 2), snap(T["big"], bar / 2), snap(T["logo"], bar / 2), snap(T["button"], beat)
    nb = barix(total) + 1
    for b in range(barix(0), nb):
        t0 = b0 + b * bar; ch = prog[b % 4]
        if t0 >= tButton - .01: break
        big = t0 >= tBig - .01 and t0 < tLogo - .01; groove = (tGroove - .01 <= t0 < tStop - .01) or big; stop = tStop - .01 <= t0 < tBig - .01; logo = t0 >= tLogo - .01
        pg = .55 if t0 < tPulse else (.38 if groove and not big else (.6 if stop or logo else .5))
        for j, m in enumerate(ch): add(pad(m, bar * 1.2), t0, pg * .5, pan=(-.3, .3, -.15, .15)[j])
        if t0 < tGroove or stop or logo:  # piano: broken chord, gentle
            for j, m in enumerate([ch[0], ch[2], ch[3], ch[1] + 12]): add(piano(m + 12, 2.8, .5 if t0 < tPulse else .4), t0 + j * beat * (1 if not logo else .5), .32, pan=-.1 + .07 * j)
            if stop or t0 < tPulse: add(piano(top[b % 4], 3.2, .5), t0 + beat * 2, .22, pan=.15)
        if t0 >= tPulse - .01 and not stop and not logo:  # eighth-note pulse that grows
            grow = min(1.0, (t0 - tPulse) / max(1e-3, tGroove - tPulse)) if t0 < tGroove else 1.0
            for e in range(8): add(pluck(ch[0] + (12 if e % 2 == 0 else 19), .2, 3 + int(3 * grow)), t0 + e * beat / 2, (.05 + .09 * grow) * (1.0 if e % 2 == 0 else .7), pan=.25 if e % 2 else -.25)
        if groove:
            for s in range(16):
                ts = t0 + s * beat / 4 + (beat / 4 * .10 if s % 2 else 0)  # light swing on the sixteenths
                if s % 4 == 0: add(kick(), ts, .85 if big else .7)
                if s % 4 == 2: add(hat(True), ts, .5 if big else .35, pan=.2)
                elif s % 2 == 1: add(hat(), ts, .35 if s in (3, 11) else .22, pan=-.2)
                if s in (4, 12): add(clap(), ts, .8 if big else .6)
                if s in (0, 3, 6, 10, 13): add(sub(roots[b % 4] + (12 if s == 13 else 0), beat * .7), ts, .5 if big else .42)
                if s % 2 == 0 or big: add(pluck(ch[(s * 3) % 4] + 24, .18, 6), ts, .09 if big else .06, pan=.35 * math.sin(s)); add(pluck(ch[(s * 3) % 4] + 24, .18, 4), ts + beat * .75, .03, pan=-.3)
            if big:
                add(braam(roots[b % 4] - 12 if roots[b % 4] > 33 else roots[b % 4], 2.0), t0, .22); add(piano(top[b % 4] + 0, 2.4, .9), t0, .3, pan=.1); add(piano(top[b % 4] - 12, 2.4, .7), t0, .22, pan=-.1)
    # build-ups, hits and the button
    for th, d, g in ((tGroove, min(3.0, tGroove - tPulse), .5), (tHit, 1.2, .35), (tBig, min(2.4, tBig - tStop - .2), .7), (tLogo, 1.4, .45)):
        add(riser(d), th - d, g); add(impact(), th, .5 if th != tBig else .8); add(braam(26, 2.6), th, .30 if th != tBig else .45)
    if "whoa" in T: add(impact(), snap(T["whoa"], bar / 2), .45); add(whoosh(.7), snap(T["whoa"], bar / 2) - .5, .3)
    for k in range(8): add(clap(), tBig - beat * 2 + k * beat / 4, .15 + .08 * k)
    for m, p in zip((38, 50, 57, 62, 65, 69, 74), (0, -.3, .3, -.2, .2, -.1, .1)): add(pad(m, 4.5) * 1.6, tLogo, .5, pan=p)
    add(impact(), tButton, .9); add(braam(26, 3.2), tButton, .4)
    for m in (50, 57, 62, 69, 74): add(piano(m, 4.0, 1.0), tButton, .4)
    for c in T["cuts"]: add(whoosh(), c - .3, .10, pan=.4 * math.sin(c * 3))
    st = np.stack([L, R], 1); fi = int(.5 * SR); st[:fi] *= np.linspace(0, 1, fi)[:, None]
    return st, {"pulse": tPulse, "groove": tGroove, "hit": tHit, "stop": tStop, "big": tBig, "logo": tLogo, "button": tButton}

def main():
    os.makedirs(WORK, exist_ok=True); A = json.load(open(os.path.join(HERE, "vo_segments.json"))); segs = A["segments"]
    v, vinfo = clean_voice(); bpm, ph, placed = solve_tempo(segs); P = {p["i"]: p for p in placed}; beat = 60 / bpm
    T = {"pulse": P[3]["at"], "groove": P[5]["at"], "hit": P[10]["at"], "whoa": P[9]["at"], "stop": P[13]["at"], "big": P[15]["at"], "logo": P[16]["at"], "button": P[16]["end"] + .6}
    total = T["button"] + 6.0; grid = [ph + k * beat * 2 for k in range(int(total / (beat * 2)) + 1)]
    T["cuts"] = [g for g in grid if T["groove"] - .1 <= g < T["button"] and not (T["stop"] <= g < T["big"] - .1)]
    music, marks = score(total, bpm, ph, T); voice = place_voice(v, placed, total)
    # sidechain: 80 ms attack, 400 ms release; music about 13 dB under the voice while he speaks
    e = np.abs(voice); k = int(.02 * SR); e = np.convolve(e, np.ones(k) / k, "same"); gate = (e > 10 ** (-38 / 20)).astype(float); a_c, r_c = math.exp(-1 / (.08 * SR)), math.exp(-1 / (.4 * SR)); f = np.zeros_like(gate); y = 0.0
    for i in range(0, len(gate), 32):
        x = gate[i]; c = a_c ** 32 if x > y else r_c ** 32; y = x + (y - x) * c; f[i:i + 32] = y
    sp = gate > .5; v_rms = np.sqrt(np.mean(voice[sp] ** 2)); m_mono = music.mean(1); m_rms = np.sqrt(np.mean(m_mono[sp] ** 2)); duck_db = -6.0
    g_music = v_rms * 10 ** (-13 / 20) / (m_rms * 10 ** (duck_db / 20)); gain = g_music * (1 + (10 ** (duck_db / 20) - 1) * f)
    mix = music * gain[:, None] + voice[:, None]; tail = int(1.5 * SR); mix[-tail:] *= np.linspace(1, 0, tail)[:, None] ** 2
    tmp = os.path.join(WORK, "mix_v3.wav"); wr(tmp, limit(mix, -1.0)); i, tp = loud(tmp); mix = limit(mix * 10 ** ((-14 - i) / 20), -1.0); wr(tmp, mix); i2, tp2 = loud(tmp)
    wr(os.path.join(WORK, "music_v3.wav"), limit(music * g_music, -1.0))
    ffrun(["-y", "-loglevel", "error", "-i", tmp, "-c:a", "aac", "-b:a", "192k", os.path.join(OUT, "v3_audio_preview.m4a")])
    under = 20 * math.log10(np.sqrt(np.mean((m_mono * gain)[sp] ** 2)) / v_rms)
    info = {"bpm": bpm, "phase": round(ph, 3), "beat": round(beat, 4), "bar": round(beat * 4, 4), "lead_in": LEAD, "total": round(total, 2), "marks": {k: round(x, 3) for k, x in marks.items()},
            "phrases": placed, "voice": vinfo, "mix": {"lufs": i2, "true_peak": tp2, "music_under_voice_db": round(under, 1)}, "cuts": [round(c, 3) for c in T["cuts"]]}
    json.dump(info, open(os.path.join(HERE, "v3_timing.json"), "w"), indent=1)
    print("bpm", bpm, "phase %.2f" % ph, "total %.2f" % total, "marks", info["marks"]); print("voice", vinfo); print("mix", info["mix"])
    print("on grid:", [(p["i"], p["nudge"], p["on_grid"]) for p in placed if p["i"] in KEY])

if __name__ == "__main__": main()
