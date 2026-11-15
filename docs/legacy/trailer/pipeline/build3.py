"""FSLG trailer v3: picture cut on the beat grid of the score that was fitted to the owner's voiceover.
Needs: vo_analyse.py and vo_mix.py run first (v3_timing.json, $FSLG_WORK/mix_v3.wav) and frames from shots3.json.
FSLG_WORK=... python build3.py   ->  docs/trailer/FSLG_trailer.mp4 (previous cut kept as FSLG_trailer_v2.mp4)"""
import os, json, glob, shutil, subprocess
import numpy as np
from PIL import Image, ImageDraw
import imageio_ffmpeg
import build as B

W, H, FPS, BAR = B.W, B.H, B.FPS, B.BAR
HERE, OUT, WORK = B.HERE, B.OUT, B.WORK
TM = json.load(open(os.path.join(HERE, "v3_timing.json"))); BEAT = TM["beat"]; PH = TM["phase"]; TOTAL = TM["total"]
# (shot folder, beats, options)   off = first source frame;  line = which voiceover line should sit over it
TL = [
 ("gate_dawn", 6, {"fade": 1, "line": "L1"}),
 ("hero_gate", 3, {"line": "L1"}),
 ("sprint", 3, {"ramp": 1, "line": "L1"}),
 ("fountain", 3, {"line": "L2"}),
 ("letters", 3, {"flip": 1, "line": "L2"}),
 ("int_senate", 2, {"line": "L2"}),
 ("int_lecture", 2, {}),
 ("mission", 2, {"flash": 1, "line": "L3"}),
 ("fight", 2, {"off": 22, "line": "L3"}),
 ("fight", 2, {"off": 74, "flash": 1, "line": "L3"}),
 ("bike", 2, {"line": "L3"}),
 ("okada", 2, {"line": "L3"}),
 ("keke", 2, {"line": "L3"}),
 ("car", 2, {"line": "L3"}),
 ("sport", 2, {"off": 4, "line": "L3"}),
 ("drift", 3, {"off": 4, "flash": 1, "line": "L4"}),
 ("drift", 3, {"off": 66, "line": "L4"}),
 ("takeoff", 2, {"off": 70, "flash": 1, "line": "L5"}),
 ("aerial", 2, {"line": "L5"}),
 ("bank", 2, {"line": "L5"}),
 ("int_library", 1, {"sup": "WALK INTO EVERY BUILDING"}),
 ("int_hostel", 1, {"sup": "WALK INTO EVERY BUILDING"}),
 ("int_canteen", 1, {"sup": "WALK INTO EVERY BUILDING"}),
 ("int_shop", 1, {"sup": "WALK INTO EVERY BUILDING"}),
 ("security", 3, {"flash": 1, "line": "L6"}),
 ("friends_walk", 3, {"line": "L6"}),
 ("int_social", 1, {}),
 ("int_lab", 1, {}),
 ("friends_dance", 2, {"line": "L7"}),
 ("lake_lapse", 6, {"fade": 1, "line": "L7/L8"}),
 ("shinkafi_night", 1, {"flash": 1, "line": "L8"}),
 ("coil_night", 2, {"slow": 2, "line": "L8"}),
 ("phase2_night", 2, {"slow": 2, "line": "L8"}),
 ("@riser", 1, {}),
 ("@credit", 6, {"flash": 1, "line": "L9"}),
 ("@cta", 0, {"fade": 1}),
]
if os.path.exists(os.path.join(HERE, "v3_offsets.json")):
    for k, v in json.load(open(os.path.join(HERE, "v3_offsets.json"))).items(): TL[int(k)][2].update(v)

def schedule():
    out = []; k = 0
    for shot, beats, opt in TL:
        st = 0.0 if k == 0 else PH + k * BEAT; en = TOTAL if beats == 0 else PH + (k + beats) * BEAT; out.append((shot, st, en, opt)); k += beats
    return out

def sup_layer(text):
    img = Image.new("RGB", (W, H), (0, 0, 0)); B.grad_text(img, text, H - BAR - 120, 96); a = np.asarray(img).astype(np.float32); alpha = np.clip(a.max(2) / 190.0, 0, 1)[..., None]
    yy = np.arange(H, dtype=np.float32)[:, None, None]; band = np.clip(1 - np.abs(yy - (H - BAR - 120)) / 200, 0, 1) ** 1.5 * .6; return a, alpha, band

def frames():
    prev = None; done = 0; sups = {}; sched = schedule(); sup_run = {}
    for idx, (shot, st, en, opt) in enumerate(sched):  # a super that spans several shots fades once over the run
        if opt.get("sup"):
            j = idx
            while j > 0 and sched[j - 1][3].get("sup") == opt["sup"]: j -= 1
            e = idx
            while e + 1 < len(sched) and sched[e + 1][3].get("sup") == opt["sup"]: e += 1
            sup_run[idx] = (sched[j][1], sched[e][2])
    for idx, (shot, st, en, opt) in enumerate(sched):
        n = int(round(en * FPS)) - done; fs = [] if shot.startswith("@") else B.src(shot); card = None; picks = []
        if shot == "@riser": picks = [s for s in ("sprint", "drift", "takeoff", "fight", "okada", "bank", "security", "coil_night") if B.src(s)]
        if shot == "@credit": card = np.asarray(B.logo_card(True)).astype(np.float32)
        if shot == "@cta": card = np.asarray(B.logo_card(False)).astype(np.float32)
        if not fs and card is None and not picks: print("MISSING", shot); card = np.asarray(B.backdrop()).astype(np.float32)
        off = opt.get("off", 0)
        if opt.get("sup") and opt["sup"] not in sups: sups[opt["sup"]] = sup_layer(opt["sup"])
        for i in range(n):
            t = i / max(1, n - 1); now = (done + i) / FPS
            if card is not None:
                z = 1.0 + .03 * t; cw, ch = W / z, H / z
                a = np.asarray(Image.fromarray(card.astype(np.uint8)).transform((W, H), Image.EXTENT, ((W - cw) / 2, (H - ch) / 2, (W + cw) / 2, (H + ch) / 2), Image.BILINEAR)).astype(np.float32)
            elif picks:
                f = B.src(picks[min(len(picks) - 1, int(t * len(picks) * .999))]); a = B.grade(Image.open(f[min(len(f) - 1, len(f) // 2 + (i % 4) * 2)]).convert("RGB"))
            else:
                avail = len(fs) - off; u = t ** .62 if opt.get("ramp") else t
                si = off + (i // opt["slow"] if opt.get("slow") else int(round(u * (min(avail, n) - 1)))); a = B.grade(Image.open(fs[min(len(fs) - 1, si)]).convert("RGB"), opt.get("flip"))
                if opt.get("sup"):
                    s0, s1 = sup_run[idx]; kk = max(0, min(1, (now - s0) / .25, (s1 - now) / .25)); ov = sups[opt["sup"]]; a = a * (1 - ov[2] * kk); a = a * (1 - ov[1] * kk) + ov[0] * ov[1] * kk
            if opt.get("fade") and i < 12: a = a * (i / 12) + (prev * (1 - i / 12) if prev is not None else 0)
            if opt.get("flash") and i < 4: a = a + (255 - a) * (.55 * (1 - i / 4))
            a = np.clip(a, 0, 255); yield a.astype(np.uint8)
        done += n; prev = a

def report():
    sched = schedule(); rows = []; L = {"L1": (1, 2), "L2": (3, 4), "L3": (5, 6, 7), "L4": (9,), "L5": (10,), "L6": (11, 12), "L7": (13,), "L8": (14, 15), "L9": (16,)}; P = {p["i"]: p for p in TM["phrases"]}
    for name, ids in L.items():
        a, e = P[ids[0]]["at"], P[ids[-1]]["end"]; over = [s for s, st, en, o in sched if st < e - .1 and en > a + .1]; seen = []
        [seen.append(x) for x in over if x not in seen]; rows.append("%s %.1f-%.1f s -> %s" % (name, a, e, ", ".join(seen)))
    return rows

def main():
    for r in report(): print(r)
    mp4 = os.path.join(OUT, "FSLG_trailer.mp4"); v2 = os.path.join(OUT, "FSLG_trailer_v2.mp4")
    if os.path.exists(mp4) and not os.path.exists(v2): shutil.move(mp4, v2)
    ff = imageio_ffmpeg.get_ffmpeg_exe(); nf = int(round(TOTAL * FPS)); wav = os.path.join(WORK, "mix_v3.wav")
    p = subprocess.Popen([ff, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "%dx%d" % (W, H), "-r", str(FPS), "-i", "-", "-i", wav,
        "-vf", "fade=t=out:st=%.2f:d=1.2" % (TOTAL - 1.2), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", mp4], stdin=subprocess.PIPE)
    k = 0
    for fr in frames():
        if k >= nf: break
        p.stdin.write(fr.tobytes()); k += 1
    p.stdin.close(); p.wait(); print("frames", k, "->", mp4, "%.1f MB, %.1f s" % (os.path.getsize(mp4) / 1e6, k / FPS))
    for s in ("drift", "sport", "gate_dawn"):
        f = B.src(s)
        if f:
            po = Image.fromarray((B.grade(Image.open(f[min(len(f) - 1, 90)]).convert("RGB")) * .5).clip(0, 255).astype(np.uint8)); L2 = B.logo(900); po.paste(L2, ((W - 900) // 2, 60), L2)
            d = ImageDraw.Draw(po); fn = B.font(50); tx = "A GAME BY M.I. BUGAJE"; d.text(((W - d.textlength(tx, font=fn)) / 2, 985), tx, font=fn, fill=B.AMBER); po.save(os.path.join(OUT, "FSLG_poster.jpg"), quality=92); break
    sched = schedule(); secs = [TOTAL * (j + .5) / 10 for j in range(10)]; pairs = []
    for nm in ("sprint", "drift", "takeoff"):
        st = [s for s in sched if s[0] == nm][-1 if nm == "drift" else 0]; m = (st[1] + st[2]) / 2; pairs += [m, m + 1 / FPS]
    tiles = []
    for j, sec in enumerate(secs + pairs):
        o = os.path.join(WORK, "c3_%02d.jpg" % j); subprocess.run([ff, "-y", "-loglevel", "error", "-ss", "%.3f" % sec, "-i", mp4, "-frames:v", "1", "-vf", "scale=512:-1", o]); tiles.append(Image.open(o))
    sh = Image.new("RGB", (512 * 5, 288 * 2))
    for j, tl in enumerate(tiles[:10]): sh.paste(tl, ((j % 5) * 512, (j // 5) * 288))
    sh.save(os.path.join(WORK, "checks3.jpg"), quality=80)
    df = lambda a, b: np.abs(np.asarray(tiles[a]).astype(int) - np.asarray(tiles[b]).astype(int)).mean()
    print("motion (mean abs diff between consecutive frames): sprint %.2f drift %.2f takeoff %.2f" % (df(10, 11), df(12, 13), df(14, 15)))

if __name__ == "__main__": main()
