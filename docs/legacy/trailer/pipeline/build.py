"""FSLG trailer: captured frames ($FSLG_WORK/frames/<shot>/NNNN.jpg) -> docs/trailer/FSLG_trailer.mp4, poster, logo.
Run with a Python that has numpy, pillow and imageio-ffmpeg:   FSLG_WORK=/tmp/fslg-trailer python build.py
Music is synthesized here (no samples, no speech). If docs/trailer/voiceover.wav exists (16-bit PCM WAV), it is
mixed over the music and the music ducks under it."""
import os, sys, math, glob, wave, shutil, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import imageio_ffmpeg

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.dirname(HERE)
WORK = os.environ.get("FSLG_WORK", "/tmp/fslg-trailer")
W, H, FPS, BPM = 1920, 1080, 30, 104
BEAT = 60.0 / BPM; BAR = 100; SR = 44100
AMBER, CREAM, INK = (245, 158, 11), (255, 243, 214), (10, 12, 18)

# (shot, beats, overlay lines, options)   "@..." are generated cards
TL = [
 ("gate", 6, ["EVERY LEGEND STARTS AS A FRESHER."], {"fade": 1}),
 ("sprint", 6, None, {"ramp": 1}),
 ("fountain", 6, ["ONE CAMPUS. A THOUSAND STORIES."], {}),
 ("selfie", 4, None, {"flip": 1}),
 ("punch", 4, ["36 MISSIONS"], {"flash": 1}),
 ("bike", 4, ["RIDE. DRIVE. FLY."], {}),
 ("okada", 4, None, {}),
 ("car", 6, None, {"ramp": 1, "flash": 1}),
 ("slide", 4, None, {}),
 ("takeoff", 8, None, {}),
 ("bank", 4, None, {}),
 ("security", 6, ["OUTRUN SECURITY"], {"flash": 1}),
 ("traffic", 4, ["PLAY WITH 6 FRIENDS", "ON THE SAME WI-FI"], {}),
 ("timelapse", 6, ["MUSIC THAT CHANGES", "WITH THE PLACE AND THE HOUR"], {"fade": 1}),
 ("shinkafi", 4, None, {"fade": 1}),
 ("coil", 4, None, {}),
 ("moment", 4, None, {"flash": 1}),
 ("hud", 2, None, {}),
 ("@riser", 2, None, {}),
 ("@credit", 10, None, {"flash": 1}),
 ("@cta", 6, None, {"fade": 1}),
]
TOTAL = sum(t[1] for t in TL)

def font(size, heavy=True):
    for p in (["/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf", "/System/Library/Fonts/Supplemental/Impact.ttf",
               "/System/Library/Fonts/Supplemental/Arial Black.ttf"] if heavy else
              ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Helvetica.ttc"]):
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except Exception: pass
    return ImageFont.load_default()

def grad_text(img, text, cy, size, top=(255, 214, 120), bot=(245, 120, 20), track=6):
    f = font(size); d = ImageDraw.Draw(img)
    def measure(): ws = [d.textlength(c, font=f) + track for c in text]; return ws, sum(ws) - track
    ws, tw = measure()
    while tw > W - 200 and size > 30: size -= 6; f = font(size); ws, tw = measure()
    mask = Image.new("L", img.size, 0); md = ImageDraw.Draw(mask); x = (img.size[0] - tw) / 2
    asc, desc = f.getmetrics(); y = cy - (asc + desc) / 2
    for c, w in zip(text, ws): md.text((x, y), c, font=f, fill=255); x += w
    g = np.linspace(0, 1, asc + desc)[:, None, None]; col = np.array(top) * (1 - g) + np.array(bot) * g
    layer = np.zeros((img.size[1], img.size[0], 3), np.uint8); y0 = int(max(0, y)); y1 = min(img.size[1], y0 + asc + desc)
    layer[y0:y1] = col[: y1 - y0].astype(np.uint8)
    img.paste(Image.new("RGB", img.size, (245, 130, 20)), (0, 0), mask.filter(ImageFilter.GaussianBlur(18)).point(lambda v: v * .35))
    img.paste(Image.fromarray(layer), (0, 0), mask)

def backdrop():
    a = np.zeros((H, W, 3), np.float32) + np.array(INK); yy = np.linspace(-1, 1, H)[:, None, None]
    a += np.array([60, 26, 6]) * np.exp(-((yy - .15) ** 2) * 9); return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def logo(size=1080):
    """Original mark: the Main Gate arch and two palms against a sunset disc, FSLG monogram, wordmark."""
    S = size * 2; img = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(img); cx, cy, r = S / 2, S * .40, S * .30
    g = np.linspace(0, 1, S)[:, None]; t = np.clip((g - (cy - r) / S) / (2 * r / S), 0, 1)
    col = np.zeros((S, S, 4), np.uint8); col[..., :3] = (np.array([255, 208, 96]) * (1 - t) + np.array([240, 84, 28]) * t).astype(np.uint8)[:, None, :].repeat(S, 1); col[..., 3] = 255
    disc = Image.new("L", (S, S), 0); ImageDraw.Draw(disc).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255); img.paste(Image.fromarray(col), (0, 0), disc)
    ink = INK + (255,); pw, gh, gw = r * .2, r * 1.15, r * 1.5; base = cy + r * .78
    d.rectangle([cx - gw / 2, base - gh, cx - gw / 2 + pw, base], fill=ink); d.rectangle([cx + gw / 2 - pw, base - gh, cx + gw / 2, base], fill=ink)
    d.rounded_rectangle([cx - gw / 2 - pw * .5, base - gh - pw * .9, cx + gw / 2 + pw * .5, base - gh + pw * .35], radius=pw * .25, fill=ink)
    d.polygon([(cx - pw * .25, base - gh * .55), (cx + pw * .25, base - gh * .55), (cx + gw * .26, base), (cx - gw * .26, base)], fill=ink)
    d.rectangle([cx - r * 1.25, base, cx + r * 1.25, base + r * .07], fill=AMBER + (255,))
    for sx in (-1, 1):
        px = cx + sx * r * 1.02; top = (px + sx * r * .05, base - r * .7); d.line([(px, base), top], fill=ink, width=int(r * .045))
        for k in range(6):
            ang = -math.pi / 2 + (k - 2.5) * .5; d.line([top, (top[0] + math.cos(ang) * r * .34, top[1] + math.sin(ang) * r * .2 + abs(k - 2.5) * r * .06)], fill=ink, width=int(r * .04))
    def centered(text, y, f, track, top, bot):
        ws = [d.textlength(c, font=f) + track for c in text]; x = (S - (sum(ws) - track)) / 2; m = Image.new("L", (S, S), 0); md = ImageDraw.Draw(m)
        for c, w in zip(text, ws): md.text((x, y), c, font=f, fill=255); x += w
        asc, desc = f.getmetrics(); gg = np.linspace(0, 1, asc + desc)[:, None, None]; lay = np.zeros((S, S, 4), np.uint8); y0 = int(y); y1 = min(S, y0 + asc + desc)
        lay[y0:y1, :, :3] = (np.array(top) * (1 - gg) + np.array(bot) * gg)[: y1 - y0].astype(np.uint8); lay[..., 3] = np.asarray(m); img.alpha_composite(Image.fromarray(lay))
    centered("FSLG", S * .70, font(int(S * .21)), S * .02, (255, 236, 180), (245, 150, 20))
    centered("FRESHERS SCHOOL LIFE", S * .895, font(int(S * .074)), S * .012, CREAM, CREAM)
    return img.resize((size, size), Image.LANCZOS)

def logo_card(credit):
    img = backdrop(); lg = logo(820); img.paste(lg, ((W - 820) // 2, 40), lg); d = ImageDraw.Draw(img)
    def line(t, y, f, fill): d.text(((W - d.textlength(t, font=f)) / 2, y), t, font=f, fill=fill)
    if credit: line("A GAME BY M.I. BUGAJE", 880, font(54), AMBER); line("Muhammad Iliyasu Bugaje", 942, font(34, False), CREAM)
    else: line("PLAY IT ON EE HUB", 890, font(60), CREAM)
    return img

yy_, xx_ = np.mgrid[0:H, 0:W].astype(np.float32); rr_ = ((xx_ - W / 2) / (W / 2)) ** 2 + ((yy_ - H / 2) / (H / 2)) ** 2
VIG = np.clip(1 - .28 * np.clip(rr_ - .35, 0, None), .55, 1)[..., None]

def src(shot): return sorted(glob.glob(os.path.join(WORK, "frames", shot, "*.jpg")))

def overlay(lines):
    img = Image.new("RGB", (W, H), (0, 0, 0)); n = len(lines); size = 120 if n == 1 else 100; y = H - BAR - 150 - size * (n - 1) / 2
    for i, l in enumerate(lines): grad_text(img, l, y + i * size, size)
    a = np.asarray(img).astype(np.float32); alpha = np.clip(a.max(2) / 190.0, 0, 1)[..., None]
    yy = np.arange(H, dtype=np.float32)[:, None, None]; band = np.clip(1 - np.abs(yy - y) / (170 + 60 * n), 0, 1) ** 1.5 * .62
    return a, alpha, band

def grade(im, flip=False):
    if im.size != (W, H): im = im.resize((W, H), Image.LANCZOS)
    if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    a = np.asarray(im).astype(np.float32); a = (a - 127.5) * 1.07 + 127.5; a[..., 0] *= 1.03; a[..., 2] *= .97
    a *= VIG; a[:BAR] = 0; a[H - BAR:] = 0; return a

def frames():
    prev = None; acc = 0.0; done = 0
    for shot, beats, lines, opt in TL:
        acc += beats * BEAT * FPS; n = int(round(acc)) - done; done += n
        ov = overlay(lines) if lines else None; fs = [] if shot.startswith("@") else src(shot); card = None; picks = []
        if shot == "@riser": picks = [s for s in ("sprint", "car", "takeoff", "punch", "okada", "bank", "security", "coil") if src(s)]
        if shot in ("@credit", "@cta"): card = np.asarray(logo_card(shot == "@credit")).astype(np.float32)
        if not fs and card is None and not picks: print("MISSING", shot); card = np.asarray(backdrop()).astype(np.float32)
        for i in range(n):
            t = i / max(1, n - 1)
            if card is not None:
                z = 1.0 + .04 * t; cw, ch = W / z, H / z
                a = np.asarray(Image.fromarray(card.astype(np.uint8)).transform((W, H), Image.EXTENT, ((W - cw) / 2, (H - ch) / 2, (W + cw) / 2, (H + ch) / 2), Image.BILINEAR)).astype(np.float32)
            elif picks:
                f = src(picks[min(len(picks) - 1, int(t * len(picks) * .999))]); a = grade(Image.open(f[min(len(f) - 1, len(f) // 2 + (i % 5) * 2)]).convert("RGB"))
            else:
                u = t ** .62 if opt.get("ramp") else t  # speed ramp: fast in, easing to real time
                a = grade(Image.open(fs[min(len(fs) - 1, int(round(u * (min(len(fs), n) - 1))))]).convert("RGB"), opt.get("flip"))
                if ov is not None:
                    k = max(0, min(1, i / 8, (n - 1 - i) / 8)); a = a * (1 - ov[2] * k); a = a * (1 - ov[1] * k) + ov[0] * ov[1] * k
            if opt.get("fade") and i < 12: a = a * (i / 12) + (prev * (1 - i / 12) if prev is not None else 0)
            if opt.get("flash") and i < 4: a = a + (255 - a) * (.6 * (1 - i / 4))
            a = np.clip(a, 0, 255); yield a.astype(np.uint8)
        prev = a

def music(total):
    n = int(total * SR) + SR; out = np.zeros(n); rng = np.random.default_rng(7)
    def add(sig, t0, gain=1.0):
        i = int(t0 * SR)
        if 0 <= i < n: sig = sig[: n - i]; out[i:i + len(sig)] += sig * gain
    def env(length, a=.01, r=.2):
        m = int(length * SR); e = np.ones(m); ai = max(1, int(a * SR)); ri = min(m, max(1, int(r * SR))); e[:ai] = np.linspace(0, 1, ai); e[-ri:] *= np.linspace(1, 0, ri); return e
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)
    def tone(f, length, harm=(1, .5, .33, .25, .2)):
        t = np.arange(int(length * SR)) / SR; s = np.zeros_like(t)
        for k, a in enumerate(harm, 1): s += a * np.sin(2 * np.pi * f * k * t)
        return s / sum(harm)
    def noise(m): return np.diff(rng.standard_normal(m), prepend=0)
    chords = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 55, 60, 64], [55, 59, 62, 67]]; roots = [45, 41, 36, 43]; bar = BEAT * 4; nbars = int(math.ceil(total / bar))
    for b in range(nbars):  # pad
        g = .30 if b < 4 else (.16 if b < 22 else .30)
        for m in chords[b % 4]: add((tone(hz(m), bar * 1.15, (1, .4, .2, .1)) + tone(hz(m) * 1.004, bar * 1.15, (1, .4, .2, .1))) * env(bar * 1.15, .5, .7), b * bar, g * .25)
    for _ in range(26):  # birds over the opening
        t0 = rng.uniform(.2, 8.6); f0 = rng.uniform(2600, 4800); L = rng.uniform(.06, .14); t = np.arange(int(L * SR)) / SR
        s = np.sin(2 * np.pi * (f0 + 900 * np.sin(2 * np.pi * rng.uniform(18, 40) * t)) * t) * np.hanning(len(t))
        for k in range(rng.integers(1, 4)): add(s, t0 + k * L * 1.5, .05)
    step = BEAT / 4
    def kick(): t = np.arange(int(.32 * SR)) / SR; return np.sin(2 * np.pi * (48 * t + 70 / 22 * (1 - np.exp(-22 * t)))) * np.exp(-t * 9)
    def rim(): t = np.arange(int(.07 * SR)) / SR; return (np.sin(2 * np.pi * 1700 * t) + .6 * np.sin(2 * np.pi * 2600 * t)) * np.exp(-t * 70)
    def shaker(a): t = np.arange(int(.05 * SR)) / SR; return noise(len(t)) * np.exp(-t * 60) * a
    def clap(): t = np.arange(int(.16 * SR)) / SR; return noise(len(t)) * (np.exp(-t * 28) + .6 * np.exp(-np.abs(t - .012) * 300))
    def logdrum(m, L=.34): t = np.arange(int(L * SR)) / SR; f = hz(m); return (np.sin(2 * np.pi * (f * t + f * .5 / 30 * (1 - np.exp(-30 * t)))) + .35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 14)) * np.exp(-t * 6.5) * env(L, .003, .05)
    def pluck(m, L=.3): t = np.arange(int(L * SR)) / SR; f = hz(m); return (np.sin(2 * np.pi * f * t) + .45 * np.sin(2 * np.pi * 2 * f * t) + .2 * np.sin(2 * np.pi * 3 * f * t)) * np.exp(-t * 9) * env(L, .004, .04)
    K = [0, 3, 8, 11]; RM = [3, 6, 10, 12, 15]; LD = [0, 3, 7, 10, 14]; pent = [69, 72, 74, 76, 79, 81]
    phrase = [[4, -1, 3, 4, -1, 2, -1, 3, 1, -1, 2, -1, 0, -1, 1, 2], [5, -1, 4, 3, -1, 4, -1, 2, 3, -1, 1, -1, 2, -1, 0, -1]]
    g0 = 3; g1 = (TOTAL - 16) // 4  # groove from bar 3 to the logo hit (16 beats before the end)
    for b in range(g0, g1):
        t0 = b * bar; full = b >= 6; lite = g1 - 4 <= b < g1 - 2
        for s in range(16):
            ts = t0 + s * step + (step * .12 if s % 2 else 0)
            if s in K and not lite: add(kick(), ts, .95)
            if s in RM: add(rim(), ts, .16)
            add(shaker(.9 if s % 4 == 2 else .45), ts, .10)
            if s in (4, 12) and full: add(clap(), ts, .13)
            if s in LD: add(logdrum(roots[b % 4] + (12 if s in (7, 14) else 0)), ts, .55)
            if full and phrase[b % 2][s] >= 0: pl = pluck(pent[phrase[b % 2][s]]); add(pl, ts, .17); add(pl, ts + step * 3, .06)
    t_hit = g1 * bar; L = BEAT * 4; t = np.arange(int(L * SR)) / SR  # riser, then the hit under the logo
    add(noise(len(t)) * (t / L) ** 2.2, t_hit - L, .16); add(np.sin(2 * np.pi * (180 * t + (1400 / (2 * L)) * t * t)) * (t / L) ** 2, t_hit - L, .10)
    for k in range(8): add(clap(), t_hit - BEAT * 2 + k * BEAT / 4, .06 + .02 * k)
    t = np.arange(int(5 * SR)) / SR
    add(np.sin(2 * np.pi * (36 * t + 50 / 6 * (1 - np.exp(-6 * t)))) * np.exp(-t * 1.3), t_hit, .95); add(noise(len(t)) * np.exp(-t * 3.2), t_hit, .14)
    for m in [45, 57, 64, 69, 72, 76]: add(tone(hz(m), 5) * np.exp(-t * .7) * env(5, .005, .5), t_hit, .10)
    for i, m in enumerate([81, 79, 76, 72, 69]): add(pluck(m, .9), t_hit + BEAT * (1 + i), .13)
    t2 = t_hit + BEAT * 10
    add(np.sin(2 * np.pi * (40 * t + 30 / 6 * (1 - np.exp(-6 * t)))) * np.exp(-t * 1.6), t2, .6)
    for m in [48, 60, 64, 67, 72]: add(tone(hz(m), 5, (1, .5, .3, .2)) * np.exp(-t * .8) * env(5, .005, .5), t2, .09)
    out = out[: int(total * SR)]; d = int(.013 * SR); R = np.concatenate([np.zeros(d), out[:-d]]) * .9 + out * .1
    st = np.stack([out * .95 + R * .05, R], 1); rms = np.sqrt(np.mean(st[int(18 * SR):int(45 * SR)] ** 2)); st *= 10 ** (-15 / 20) / rms
    return st

def voiceover(st):
    """Mix docs/trailer/voiceover.wav over the music, ducking the music while the voice is present."""
    p = os.path.join(OUT, "voiceover.wav")
    if not os.path.exists(p): return st, False
    with wave.open(p, "rb") as w:
        if w.getsampwidth() != 2: print("voiceover.wav must be 16-bit PCM; ignoring it"); return st, False
        v = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(np.float64) / 32768; v = v.reshape(-1, w.getnchannels()).mean(1); r = w.getframerate()
    if r != SR: v = np.interp(np.arange(int(len(v) * SR / r)) * r / SR, np.arange(len(v)), v)
    v = v[: len(st)]; v = np.pad(v, (0, len(st) - len(v))); pk = np.abs(v).max() or 1; v *= .8 / pk
    k = int(.25 * SR); e = np.convolve(np.abs(v), np.ones(k) / k, "same"); duck = 1 - .65 * np.clip(e / .04, 0, 1)
    return st * duck[:, None] + v[:, None], True

def main():
    total = TOTAL * BEAT; print("beats", TOTAL, "seconds %.2f" % total); os.makedirs(WORK, exist_ok=True)
    st, has_vo = voiceover(music(total)); print("voiceover mixed" if has_vo else "no voiceover.wav: music only")
    st = np.tanh(st * 1.15) / 1.15; fo = int(1.2 * SR); st[-fo:] *= np.linspace(1, 0, fo)[:, None]; st *= .97 / max(.97, np.abs(st).max())
    wav = os.path.join(WORK, "music.wav")
    with wave.open(wav, "wb") as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype("<i2").tobytes())
    logo(1080).save(os.path.join(OUT, "FSLG_logo.png"))
    if "--audio-only" in sys.argv: return
    mp4 = os.path.join(OUT, "FSLG_trailer.mp4"); v1 = os.path.join(OUT, "FSLG_trailer_v1.mp4")
    if os.path.exists(mp4) and not os.path.exists(v1): shutil.move(mp4, v1)
    ff = imageio_ffmpeg.get_ffmpeg_exe(); nf = int(round(total * FPS))
    p = subprocess.Popen([ff, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "%dx%d" % (W, H), "-r", str(FPS), "-i", "-", "-i", wav,
        "-vf", "fade=t=out:st=%.2f:d=1.0" % (total - 1.0), "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
        "-shortest", "-movflags", "+faststart", mp4], stdin=subprocess.PIPE)
    k = 0
    for fr in frames():
        if k >= nf: break
        p.stdin.write(fr.tobytes()); k += 1
    p.stdin.close(); p.wait(); print("frames", k, "->", mp4, "%.1f MB" % (os.path.getsize(mp4) / 1e6))
    for s in ("car", "sprint", "gate"):  # poster from a moving frame
        f = src(s)
        if f:
            po = Image.fromarray((grade(Image.open(f[len(f) // 2]).convert("RGB")) * .5).clip(0, 255).astype(np.uint8)); L2 = logo(900); po.paste(L2, ((W - 900) // 2, 60), L2)
            d = ImageDraw.Draw(po); fn = font(50); tx = "A GAME BY M.I. BUGAJE"; d.text(((W - d.textlength(tx, font=fn)) / 2, 985), tx, font=fn, fill=AMBER); po.save(os.path.join(OUT, "FSLG_poster.jpg"), quality=92); break
    secs = [total * (j + .5) / 9 for j in range(8)] + [10.0, 10.0 + 1 / FPS, 24.0, 24.0 + 1 / FPS]; tiles = []  # 8 spread frames + 2 consecutive pairs
    for j, sec in enumerate(secs):
        o = os.path.join(WORK, "chk%02d.jpg" % j); subprocess.run([ff, "-y", "-loglevel", "error", "-ss", "%.3f" % sec, "-i", mp4, "-frames:v", "1", "-vf", "scale=640:-1", o]); tiles.append(Image.open(o))
    sh = Image.new("RGB", (640 * 4, 360 * 3))
    for j, tl in enumerate(tiles): sh.paste(tl, ((j % 4) * 640, (j // 4) * 360))
    sh.save(os.path.join(WORK, "checks.jpg"), quality=80)
    df = lambda a, b: np.abs(np.asarray(tiles[a]).astype(int) - np.asarray(tiles[b]).astype(int)).mean()
    print("consecutive-frame mean abs diff: %.2f %.2f" % (df(8, 9), df(10, 11)))

if __name__ == "__main__": main()
