"""Find the spoken phrases in docs/trailer/trailer_audio.m4a by silence detection.
Writes pipeline/vo_segments.json and docs/trailer/vo_waveform.png. No speech recognition: order and length only."""
import os, json, subprocess, wave, sys
import numpy as np
from PIL import Image, ImageDraw
import imageio_ffmpeg
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.dirname(HERE); WORK = os.environ.get("FSLG_WORK", "/tmp/fslg-trailer"); SR = 44100
os.makedirs(WORK, exist_ok=True); raw = os.path.join(WORK, "vo_raw.wav")
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-i", os.path.join(OUT, "trailer_audio.m4a"), "-ac", "1", "-ar", str(SR), "-c:a", "pcm_s16le", raw], check=True)
with wave.open(raw) as w: v = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(np.float64) / 32768
dur = len(v) / SR; hop = int(.01 * SR); win = int(.03 * SR)
rms = np.array([np.sqrt(np.mean(v[i:i + win] ** 2) + 1e-12) for i in range(0, len(v) - win, hop)]); db = 20 * np.log10(rms)
floor = np.percentile(db, 10); top = np.percentile(db, 95); thr = max(floor + 10, top - 28)
on = db > thr; MIN_GAP = float(os.environ.get("VO_GAP", .38)); MIN_LEN = .12; segs = []; i = 0; n = len(on)
while i < n:
    if on[i]:
        j = i; last = i
        while j < n and (on[j] or (j - last) * .01 < MIN_GAP):
            if on[j]: last = j
            j += 1
        s, e = i * .01, last * .01 + .03
        if e - s >= MIN_LEN: segs.append([max(0, s - .04), min(dur, e + .08)])
        i = j
    else: i += 1
out = []
for k, (s, e) in enumerate(segs):
    x = v[int(s * SR):int(e * SR)]; out.append({"i": k + 1, "start": round(s, 2), "end": round(e, 2), "dur": round(e - s, 2), "peak_db": round(20 * np.log10(np.abs(x).max() + 1e-9), 1),
        "rms_db": round(20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9), 1), "gap_before": round(s - (segs[k - 1][1] if k else 0), 2)})
json.dump({"file": "trailer_audio.m4a", "duration": round(dur, 2), "noise_floor_db": round(float(floor), 1), "threshold_db": round(float(thr), 1), "min_gap": MIN_GAP, "segments": out}, open(os.path.join(HERE, "vo_segments.json"), "w"), indent=1)
Wd, Hd = 2400, 420; img = Image.new("RGB", (Wd, Hd), (14, 16, 22)); d = ImageDraw.Draw(img)
for s in out: d.rectangle([s["start"] / dur * Wd, 30, s["end"] / dur * Wd, Hd - 40], fill=(70, 48, 10)); d.text((s["start"] / dur * Wd + 3, 8), "%d  %.1fs" % (s["i"], s["dur"]), fill=(245, 158, 11))
cols = np.array_split(np.abs(v), Wd)
for x, c in enumerate(cols): h = c.max() * (Hd - 90) / 2 / max(1e-6, np.abs(v).max()); d.line([(x, Hd / 2 - 5 - h), (x, Hd / 2 - 5 + h)], fill=(230, 232, 240))
for t in range(0, int(dur) + 1, 5): d.line([(t / dur * Wd, Hd - 40), (t / dur * Wd, Hd - 28)], fill=(150, 150, 160)); d.text((t / dur * Wd + 3, Hd - 26), "%ds" % t, fill=(150, 150, 160))
img.save(os.path.join(OUT, "vo_waveform.png"))
print("duration %.2f floor %.1f thr %.1f" % (dur, floor, thr)); [print(s) for s in out]
