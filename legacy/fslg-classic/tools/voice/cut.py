#!/usr/bin/env python3
"""Cut the owner's voice recordings into game clips.

    voice_in/<role>_<name>.<any audio format>   or   voice_in/<role>@<name>/*.<any format>   ->   static/audio/voice/<group>[@speaker]/<id>[.variant].{ogg,m4a}
                                                                  static/audio/voice/manifest.json
                                                                  voice_review/index.html   (with --review)

A person's files are read in name order as one long take of their role: the Nth sound separated by silence is line N of
the role's script (numbered tier A first, so someone who stops early still lines up). A single clap means "that take
was bad": the sound before it is dropped. (Files named A/B/C in a folder still mean one tier, as in the first version.) Fix
misalignments in voice_in/offsets.json:  {"friend_a_m@musa": {"start": 1, "skip": [4], "merge": [7], "gap": 0.7}}
  start: line number (within that tier/file) the first kept clip belongs to     skip: clip numbers to drop (bad takes)
  merge: clip numbers to join with the clip after them (a line broken by a pause)  gap: silence in seconds that splits lines

Everything here is plain signal processing on real recordings: trim, high-pass, gentle gate, level, small pitch
variety, and radio / megaphone / hall treatments. No speech is generated.
Needs numpy and an ffmpeg binary (pip package imageio-ffmpeg bundles one); tools/voice/run.sh sets both up.
"""
import argparse, html, json, os, shutil, subprocess, sys, tempfile
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SR = 48000
AUDIO = {".m4a", ".mp3", ".wav", ".ogg", ".opus", ".aac", ".amr", ".3gp", ".flac", ".webm", ".mp4", ".caf", ".aiff", ".aif", ".wma"}
VARIETY = {"lo": "asetrate=%d,aresample=%d,atempo=%.5f" % (SR * 0.95, SR, 1 / 0.95), "hi": "asetrate=%d,aresample=%d,atempo=%.5f" % (SR * 1.05, SR, 1 / 1.05)}
TREAT = {
    "radio": "highpass=f=350,lowpass=f=3200,volume=6dB,asoftclip=type=tanh,volume=-5dB",
    "mega": "highpass=f=500,lowpass=f=2600,volume=10dB,asoftclip=type=hard,volume=-8dB,aecho=0.8:0.5:35:0.25",
    "hall": "aecho=0.8:0.6:60|130|210:0.3|0.2|0.12",
}
PLAIN_VARIETY = {"crowd", "friends", "extras", "filler", "filler_m", "filler_f"}  # groups where one recording should sound like several people


def ffmpeg_exe():
    exe = os.environ.get("FFMPEG") or shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        sys.exit("No ffmpeg found. Run: sh tools/voice/run.sh  (it installs a private copy), or set FFMPEG=/path/to/ffmpeg")


def decode(ff, path):
    """Any format -> mono float32 at 48 kHz, with rumble below 80 Hz removed."""
    p = subprocess.run([ff, "-v", "error", "-i", str(path), "-af", "highpass=f=80", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True)
    if p.returncode:
        raise RuntimeError(p.stderr.decode(errors="replace").strip()[:300] or "could not read audio")
    return np.frombuffer(p.stdout, dtype="<f4").astype(np.float32)


def envelope(x, hop):
    n = len(x) // hop
    return np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)


def split(x, gap=0.7, min_len=0.15, pad=0.06):
    """Find the spoken stretches: louder than the room, separated by at least `gap` seconds of quiet.
    Returns (segments, threshold). A segment is (start, end, is_clap): a very short loud bang is a clap, which
    means "the take before this was bad, the next one replaces it"."""
    hop = SR // 100
    env = envelope(x, hop)
    if not len(env):
        return [], 0.0
    floor = float(np.percentile(env, 10))
    peak = float(np.percentile(env, 99.5))
    thr = max(floor * 4.0, peak * 0.035, 1e-4)
    loud = env > thr
    segs, start, quiet = [], None, 0
    for i, v in enumerate(loud):
        if v:
            if start is None:
                start = i
            quiet = 0
        elif start is not None:
            quiet += 1
            if quiet * 0.01 >= gap:
                segs.append((start, i - quiet + 1))
                start, quiet = None, 0
    if start is not None:
        segs.append((start, len(loud) - quiet))
    out = []
    for a, b in segs:
        if (b - a) * 0.01 < min_len:
            if float(env[a:b].max()) > peak * 0.6:
                out.append((a * hop, b * hop, True))
            continue
        out.append((max(0, int(a * hop - pad * SR)), min(len(x), int(b * hop + pad * SR)), False))
    return out, thr


def clean(x, thr, target_rms=0.1):
    """Gentle gate under the speech threshold, short fades, then the same loudness for every clip."""
    hop = SR // 200
    env = envelope(x, hop)
    g = np.clip(env / max(thr, 1e-6), 0.25, 1.0)
    k = np.ones(8) / 8
    g = np.convolve(g, k, mode="same")
    gain = np.interp(np.arange(len(x)), np.arange(len(g)) * hop + hop / 2, g).astype(np.float32)
    y = x * gain
    f = min(int(0.008 * SR), len(y) // 2)
    if f:
        ramp = np.linspace(0, 1, f, dtype=np.float32)
        y[:f] *= ramp
        y[-f:] *= ramp[::-1]
    voiced = env > thr
    rms = float(np.sqrt(np.mean(env[voiced] ** 2))) if voiced.any() else float(np.sqrt(np.mean(y ** 2) + 1e-12))
    y = y * (target_rms / max(rms, 1e-6))
    pk = float(np.max(np.abs(y))) if len(y) else 0
    if pk > 0.89:
        y = y * (0.89 / pk)
    return y


def encode(ff, wav, base, filt=None):
    af = ["-af", filt] if filt else []
    for ext, codec in ((".ogg", ["-c:a", "libopus", "-b:a", "32k", "-application", "voip"]), (".m4a", ["-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart"])):
        p = subprocess.run([ff, "-v", "error", "-y", "-i", str(wav)] + af + ["-ac", "1", "-ar", str(SR)] + codec + [str(base) + ext], capture_output=True)
        if p.returncode:
            raise RuntimeError(p.stderr.decode(errors="replace").strip()[:300])


def write_wav(path, y):
    import wave
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype("<i2").tobytes())


def tier_of(name):
    stem = Path(name).stem
    return stem[:1].upper() if stem[:1].upper() in "ABC" and (len(stem) == 1 or not stem[1].isalnum()) else ""


def sessions(src, groups):
    """Every recording, as {"<group>[@speaker]": [files]}. Accepts folders (voice_in/<group>@<name>/...) and loose
    files named <group>_<name>[_2].<ext> straight in voice_in/."""
    out, unknown = {}, []
    if not src.exists():
        return out, unknown
    for d in sorted(src.iterdir()):
        if d.is_dir():
            if d.name.split("@")[0] in groups:
                fs = sorted(p for p in d.iterdir() if p.suffix.lower() in AUDIO)
                if fs:
                    out.setdefault(d.name, []).extend(fs)
            elif not d.name.startswith("."):
                unknown.append(d.name)
        elif d.suffix.lower() in AUDIO:
            stem = d.stem.lower().replace(" ", "_").replace("-", "_")
            gid = max((g for g in groups if stem == g or stem.startswith(g + "_")), key=len, default=None)
            if not gid:
                unknown.append(d.name); continue
            who = stem[len(gid):].strip("_")
            who = "_".join(w for w in who.split("_") if not (w.isdigit() or w in ("part2", "p2", "part1")))
            out.setdefault(gid + ("@" + who if who else ""), []).append(d)
    return out, unknown


def run(args):
    ff = ffmpeg_exe()
    src, out = Path(args.input), Path(args.out)
    script = json.loads(Path(args.lines).read_text(encoding="utf8"))
    groups = {g["id"]: g for g in script["groups"]}
    offsets = {}
    off_file = src / "offsets.json"
    if off_file.exists():
        offsets = json.loads(off_file.read_text(encoding="utf8"))
    man_file = out / "manifest.json"
    manifest = {"version": 1, "clips": {}}
    if man_file.exists() and not args.fresh:
        try:
            manifest = json.loads(man_file.read_text(encoding="utf8"))
        except Exception:
            pass
    report, review = [], []
    found, unknown = sessions(src, groups)
    for u in unknown:
        report.append({"file": u, "problem": "unknown group (name the file <role>_<yourname>.m4a; roles are listed in docs/voice/RECORDING_SCRIPT.md)"})
    if not found:
        print("Nothing to do: put recordings in %s (see docs/voice/README.md)." % src)
    for name, files in sorted(found.items()):
        gid = name.split("@")[0]
        g = groups[gid]
        for cid in list(manifest["clips"]):  # replace this speaker's old clips
            manifest["clips"][cid] = [c for c in manifest["clips"][cid] if c["g"] != name]
            if not manifest["clips"][cid]:
                del manifest["clips"][cid]
        dest = out / name
        if dest.exists():
            shutil.rmtree(dest)
        dest.mkdir(parents=True)
        # A file named A/B/C holds one tier (first version of the script). Everything else is read in name order as one
        # long take of the role; files with "part2" in the name belong to the Part 2 script.
        batches = {}
        for f in files:
            t = tier_of(f.name)
            p2 = "part2" in f.stem.lower() or "_p2" in f.stem.lower()
            key = (name + "/" + f.name) if t else (name + (":part2" if p2 else ""))
            wanted = [l for l in g["lines"] if l["tier"] == t] if t else (g.get("part2") or []) if p2 else g["lines"]
            batches.setdefault(key, {"files": [], "wanted": wanted})["files"].append(f)
        for key, bt in batches.items():
            o = offsets.get(key, {})
            clips, bad = [], ""
            for f in bt["files"]:
                try:
                    x = decode(ff, f)
                except RuntimeError as e:
                    bad = "%s: %s" % (f.name, e); break
                segs, thr = split(x, gap=float(o.get("gap", args.gap)))
                for a, b, clap in segs:
                    if clap:  # the take before the clap was a fluff
                        if clips and not clips[-1].get("dropped"):
                            clips[-1]["dropped"] = "clap"
                        continue
                    clips.append({"x": x, "a": a, "b": b, "thr": thr, "file": f.name})
            if bad:
                report.append({"file": key, "problem": bad}); continue
            claps = sum(1 for c in clips if c.get("dropped"))
            clips = [c for c in clips if not c.get("dropped")]
            merge, skip = set(o.get("merge", [])), set(o.get("skip", []))
            joined, i = [], 0
            while i < len(clips):  # clip numbers are 1-based, as shown on the review page
                c = dict(clips[i]); c["n"] = i + 1
                while (i + 1) in merge and i + 1 < len(clips) and clips[i + 1]["file"] == c["file"]:
                    i += 1; c["b"] = clips[i]["b"]
                joined.append(c); i += 1
            kept = [c for c in joined if c["n"] not in skip]
            first = int(o.get("start", 1)) - 1
            wanted, rows = bt["wanted"], []
            with tempfile.TemporaryDirectory() as tmp:
                for j, c in enumerate(kept):
                    li = first + j
                    line = wanted[li] if 0 <= li < len(wanted) else None
                    y = clean(c["x"][c["a"]:c["b"]].copy(), c["thr"])
                    dur = round(len(y) / SR, 2)
                    row = {"clip": c["n"], "at": round(c["a"] / SR, 2), "dur": dur, "line": line, "file": c["file"]}
                    if line:
                        wav = Path(tmp) / (line["id"] + ".wav"); write_wav(wav, y)
                        fx = line.get("fx") or g.get("fx") or ""  # radio for on-air lines, hall for lecture lines
                        variants = [""] + (list(VARIETY) if gid in PLAIN_VARIETY and not fx else [])
                        extra = list(g.get("x") or [])
                        encode(ff, wav, dest / line["id"])
                        for v in variants[1:]:
                            encode(ff, wav, dest / (line["id"] + "." + v), VARIETY[v])
                        for v in ([fx] if fx else []) + extra:
                            encode(ff, wav, dest / (line["id"] + "." + v), TREAT[v])
                        entry = {"id": line["id"], "g": name, "d": dur, "p": line["tier"], "v": variants}
                        if fx:
                            entry["fx"] = fx
                        if extra:
                            entry["x"] = extra
                        if g.get("kind"):
                            entry["k"] = g["kind"]
                        if line.get("mood") or line.get("use"):
                            entry["t"] = [line.get("mood") or "", line.get("use") or ""]
                        manifest["clips"].setdefault(line["id"], []).append(entry)
                        row["src"] = "%s/%s%s.m4a" % (name, line["id"], "." + fx if fx else "")
                    rows.append(row)
            used = sum(1 for r in rows if r["line"])
            report.append({"file": key, "clips": len(joined) + claps, "kept": len(kept), "expected": len(wanted), "mapped": used, "claps": claps,
                           "problem": "" if len(kept) == len(wanted) - first else "clip count does not match the script: check the review page"})
            review.append({"file": key, "group": g["label"], "rows": rows, "expected": len(wanted), "skipped": sorted(skip), "missing": [l for l in wanted[max(0, first + len(kept)):]]})
    out.mkdir(parents=True, exist_ok=True)
    manifest["count"] = sum(len(v) for v in manifest["clips"].values())
    man_file.write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf8")
    if args.review:
        write_review(Path(args.review_dir), out, review)
    for r in report:
        print(("! " if r.get("problem") else "  ") + r["file"] + ": " + (("%d sounds found (%d retakes after a clap), %d kept, %d lines expected, %d written" % (r["clips"], r["claps"], r["kept"], r["expected"], r["mapped"])) if "clips" in r else "") + ((" — " + r["problem"]) if r.get("problem") else ""))
    print("manifest: %d clips for %d lines -> %s" % (manifest["count"], len(manifest["clips"]), man_file))
    return report


def write_review(rdir, out, review):
    rdir.mkdir(parents=True, exist_ok=True)
    rel = os.path.relpath(out, rdir).replace(os.sep, "/")
    h = ["<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Voice review</title>",
         "<style>body{font:15px system-ui,sans-serif;margin:16px;max-width:980px}table{border-collapse:collapse;width:100%;margin:8px 0 28px}td,th{border-bottom:1px solid #8884;padding:6px 8px;text-align:left;vertical-align:middle}audio{height:32px;width:240px}.bad{background:#f9731633}.muted{opacity:.6}code{background:#8882;padding:1px 4px;border-radius:4px}</style>",
         "<h1>Voice review</h1><p>Play each clip and check it says the line beside it. If a file is out of step, add an entry for it to <code>voice_in/offsets.json</code> (<code>skip</code> a bad take by its clip number, <code>merge</code> a line that was cut in two, or change <code>gap</code>), then run <code>sh tools/voice/run.sh</code> again.</p>"]
    for f in review:
        ok = len([r for r in f["rows"] if r["line"]]) == f["expected"] and not f["missing"]
        h.append("<h2>%s <small class='muted'>%s</small></h2><p%s>%d clips kept, %d lines expected.%s</p><table><tr><th>Clip</th><th>At</th><th>Listen</th><th>Line</th><th>Should say</th></tr>" % (
            html.escape(f["file"]), html.escape(f["group"]), "" if ok else " class='bad'", len(f["rows"]), f["expected"], "" if ok else " <b>These do not match.</b>"))
        for r in f["rows"]:
            l = r["line"]
            h.append("<tr%s><td>%d</td><td>%.1fs</td><td>%s</td><td>%s</td><td>%s</td></tr>" % (
                "" if l else " class='bad'", r["clip"], r["at"],
                "<audio controls preload='none' src='%s/%s'></audio>" % (rel, html.escape(r["src"])) if l else "(%.1fs, not used)" % r["dur"],
                html.escape(l["n"]) if l else "—", html.escape(l["text"]) if l else "<i>extra sound: no line left for it</i>"))
        for l in f["missing"]:
            h.append("<tr class='bad'><td>—</td><td></td><td>not recorded</td><td>%s</td><td>%s</td></tr>" % (html.escape(l["n"]), html.escape(l["text"])))
        h.append("</table>")
    (rdir / "index.html").write_text("\n".join(h), encoding="utf8")
    print("review page: %s" % (rdir / "index.html"))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--input", default=str(ROOT / "voice_in"))
    ap.add_argument("--out", default=str(ROOT / "static" / "audio" / "voice"))
    ap.add_argument("--lines", default=str(ROOT / "docs" / "voice" / "lines.json"))
    ap.add_argument("--review", action="store_true", help="also write voice_review/index.html to listen and check alignment")
    ap.add_argument("--review-dir", default=str(ROOT / "voice_review"))
    ap.add_argument("--gap", type=float, default=0.7, help="seconds of silence that separate two lines")
    ap.add_argument("--fresh", action="store_true", help="forget clips from folders that are no longer in voice_in")
    return run(ap.parse_args(argv))


if __name__ == "__main__":
    main()
