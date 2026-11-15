"""Cut the owner's trailer narration into intro clips: clean, normalise to -16 LUFS, write .m4a and .ogg."""
import subprocess, json, re, os, tempfile, imageio_ffmpeg  # run with a python that has imageio-ffmpeg
WORK = tempfile.mkdtemp()
FF = imageio_ffmpeg.get_ffmpeg_exe(); SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..") + "/docs/trailer/trailer_audio.m4a"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..") + "/static/audio/voice/intro"; os.makedirs(OUT, exist_ok=True)
CLIPS = [  # id, [source spans], what is said
 ("legend", [(0.10, 6.40)], "Every legend on this campus started the same way, as a fresher."),
 ("stories", [(6.70, 11.95)], "One school, a thousand stories. So, which one is yours?"),
 ("vehicles", [(13.86, 17.62), (18.78, 20.70)], "A variety of vehicles for you to ride and also drive."),
 ("fly", [(22.62, 29.50)], "Whoa, watch out there, whoa. And then sometimes you could even fly, so you could have the view from the top."),
 ("security", [(32.55, 35.40)], "Dodge security, bring your guys."),
 ("friends", [(37.00, 45.20)], "You can also play with friends, and when the sun goes down, the music changes, and there are lots of places you can visit at night."),
 ("welcome", [(45.86, 49.10)], "Fresher School Life, welcome to school."),
]
CLEAN = "highpass=f=80,afftdn=nr=8:nf=-45,acompressor=threshold=-20dB:ratio=2.5:attack=12:release=180:makeup=2,equalizer=f=4200:t=q:w=1.2:g=2.5"
def run(a): r = subprocess.run([FF, "-hide_banner", "-y", "-loglevel", "error"] + a, capture_output=True, text=True); assert r.returncode == 0, r.stderr; return r
meta = []
for cid, spans, text in CLIPS:
    parts = []
    for k, (a, b) in enumerate(spans):
        p = f"{WORK}/{cid}_{k}.wav"; run(["-ss", str(a), "-to", str(b), "-i", SRC, "-ac", "1", "-ar", "44100", "-af", f"{CLEAN},afade=t=in:d=0.03,areverse,afade=t=in:d=0.06,areverse", p]); parts.append(p)
    wav = f"{WORK}/{cid}.wav"
    if len(parts) == 1: os.replace(parts[0], wav)
    else:
        sil = WORK + "/sil.wav"; run(["-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "0.28", sil])
        lst = WORK + "/list.txt"; open(lst, "w").write("".join(f"file '{os.path.abspath(x)}'\n" for x in [parts[0], sil] + parts[1:]))
        run(["-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", wav])
    norm = "loudnorm=I=-16:TP=-1.5:LRA=7"
    run(["-i", wav, "-af", norm, "-ar", "44100", "-c:a", "aac", "-b:a", "96k", f"{OUT}/{cid}.m4a"])
    run(["-i", wav, "-af", norm, "-ar", "48000", "-c:a", "libopus", "-b:a", "64k", f"{OUT}/{cid}.ogg"])
    d = float(re.search(r"Duration: (\d+):(\d+):([\d.]+)", subprocess.run([FF, "-i", f"{OUT}/{cid}.m4a"], capture_output=True, text=True).stderr).group(3))
    meta.append({"id": cid, "text": text, "dur": round(d, 2)})
json.dump(meta, open(f"{OUT}/lines.json", "w"), indent=1); print(json.dumps(meta, indent=1))
