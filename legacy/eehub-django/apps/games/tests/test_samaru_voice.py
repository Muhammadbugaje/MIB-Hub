"""Recorded human voices for Freshers School Life: the recording script, the cutter and the in-game lookup."""
import hashlib, json, re, shutil, subprocess, unicodedata, wave, struct, math
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
NODE = shutil.which("node") or next(iter(sorted(Path.home().glob(".nvm/versions/node/*/bin/node"))[-1:]), None)
VPY = ROOT / "tools" / "voice" / ".venv" / "bin" / "python"


def vid(text):
    s = unicodedata.normalize("NFKD", text.lower())
    s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    h = 0x811C9DC5
    for ch in s:
        h = ((h ^ ord(ch)) * 0x01000193) & 0xFFFFFFFF
    b36, n = "", len(s)
    while True:
        b36 = "0123456789abcdefghijklmnopqrstuvwxyz"[n % 36] + b36
        n //= 36
        if not n:
            break
    return "v%08x%s" % (h, b36)


@pytest.mark.skipif(not NODE, reason="needs Node")
def test_recording_script_is_stable_and_ids_match_the_text():
    f = ROOT / "docs" / "voice" / "lines.json"
    subprocess.run([str(NODE), "tools/voice/make_script.js"], cwd=ROOT, check=True, capture_output=True)
    first = f.read_bytes()
    subprocess.run([str(NODE), "tools/voice/make_script.js"], cwd=ROOT, check=True, capture_output=True)
    assert f.read_bytes() == first
    data = json.loads(first)
    roles = {r["id"]: r for r in data["roles"]}
    groups = {g["id"]: g for g in data["groups"]}
    assert 14 <= len(roles) <= 18 and {"player_m", "player_f", "bature_m", "firdausi_f", "crowd", "staff_m", "dj", "maker_m"} <= set(roles)
    assert set(roles) <= set(groups) and {"filler", "filler_m", "filler_f"} <= set(groups)
    assert [r["id"] for r in data["roles"] if r["owner"]] == ["player_m", "maker_m"]
    for r in data["roles"]:
        ls = r["lines"]
        assert len({l["id"] for l in ls}) == len(ls) and [l["n"] for l in ls] == [str(i + 1) for i in range(len(ls))]
        assert [l["tier"] for l in ls] == sorted(l["tier"] for l in ls), r["id"]  # tier A first, then B, then C
        assert sum(len(sc["lines"]) for sc in r["scenes"]) == len(ls) and r["minutes"] >= 1 and r["who"] and r["sound"]
        assert r["tiers"]["A"] <= 35, r["id"]  # tier A stays a sitting, not a marathon
        for l in ls:
            assert l["id"] == vid(l["text"]) and l["tier"] in "ABC" and "{" not in l["text"] and "[v:" not in l["text"] and not re.search(r"@[a-z]", l["text"])
    assert [l["text"] for l in roles["player_m"]["lines"]] == [l["text"] for l in roles["player_f"]["lines"]]
    first_a = [l for l in roles["bature_m"]["lines"] if l["tier"] == "A"][0]
    assert first_a["scene"].startswith("Mission 1:")  # one numbering from the start of the game
    md = (ROOT / "docs" / "voice" / "RECORDING_SCRIPT.md").read_text(encoding="utf8")
    assert "voice_in/" in md and "Do not read the numbers aloud" in md


@pytest.mark.skipif(not NODE, reason="needs Node")
def test_story_lines_roles_and_filler_bank():
    subprocess.run([str(NODE), "tools/voice/make_script.js"], cwd=ROOT, check=True, capture_output=True)
    data = json.loads((ROOT / "docs" / "voice" / "lines.json").read_text(encoding="utf8"))
    roles = {r["id"]: r for r in data["roles"]}
    total = sum(len(r["lines"]) for r in data["roles"])
    assert total > 3000 and data["counts"]["A"] >= 800 and len(data["skipped"]) <= 5
    texts = lambda rid: {l["text"] for l in roles[rid]["lines"]}
    scenes = lambda rid: {l["scene"] for l in roles[rid]["lines"]}
    who = lambda rid: set(roles[rid]["cast"])
    # the story, from Year 1, in every role that speaks in it
    assert any(s.startswith("Mission 1:") for s in scenes("player_m")) and any(s.startswith("Mission 120:") or s.startswith("Mission 119:") for s in scenes("maker_m"))
    assert "Energy in, light out. The rest is commentary." in texts("maker_m") and len([l for l in roles["maker_m"]["lines"] if l["scene"] == "The Maker's sayings"]) >= 40
    assert {"Bature"} <= who("bature_m") and {"Bolaji"} <= who("bolaji_m") and {"Sadiq", "Muktar", "Yusuf", "Khalid"} <= who("men_a")
    assert {"Nusaybah", "Fatima"} <= who("women_a") and {"Wednesday", "Lily"} <= who("women_b") and {"Emily", "Aleeya"} <= who("firdausi_f")
    assert {"Tanko"} <= who("lecturer_m") and {"Dr. Okonkwo", "Sgt. Bilkisu"} <= who("staff_f") and {"KB", "Baba Dam"} <= who("traders_m")
    roomie = [l["text"] for l in roles["bature_m"]["lines"] if "your roommate" in l["tone"]]
    assert roomie and set(roomie) <= texts("firdausi_f")  # "your roommate" lines exist in a male and a female voice
    # on-air lines carry the radio effect; lecture-hall lessons the hall echo
    assert any(l.get("fx") == "radio" for l in roles["dj"]["lines"]) and any(l.get("fx") == "hall" for l in roles["lecturer_m"]["lines"])
    assert not any(l.get("fx") == "hall" for l in roles["lecturer_m"]["lines"] if l["scene"].startswith("Mission"))
    # the game's own non-story lines are still there; its old story speeches are gone
    assert any(l["scene"].startswith("Around campus") for l in roles["crowd"]["lines"]) and any(l["scene"] == "Radio: station idents" for l in roles["dj"]["lines"])
    assert not any("Legedis Benz" in l["text"] for r in data["roles"] for l in r["lines"])
    # filler bank: shared phrases plus a men-only and a women-only section, each line tagged
    g = {x["id"]: x for x in data["groups"]}
    fm, ff, fa = g["filler_m"]["lines"], g["filler_f"]["lines"], g["filler"]["lines"]
    assert len(fa) >= 250 and len(fm) > len(fa) and len(ff) > len(fa) and fm[:len(fa)] == ff[:len(fa)] == fa
    moods = {"happy", "annoyed", "sad", "excited", "neutral", "worried", "flirty", "angry-light", "tired"}
    for l in fm + ff:
        assert l["mood"] in moods and l["use"] and l["id"] == vid(l["text"])
    assert {"greet", "bye", "agree", "refuse", "react", "laugh", "warn", "hurry", "broke", "exam", "prayer", "night", "shop", "drive", "phone", "fight", "flirt"} <= {l["use"] for l in fm}
    tags = json.loads((ROOT / "static" / "audio" / "voice" / "tags.json").read_text())
    assert len(tags) > 100 and all(re.match(r"^[a-z-]*\|[a-z]*$", v) for v in tags.values())


def test_hand_out_pdfs(tmp_path):
    pytest.importorskip("reportlab")
    import importlib.util
    spec = importlib.util.spec_from_file_location("make_pdfs", ROOT / "tools" / "voice" / "make_pdfs.py")
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    data = json.loads((ROOT / "docs" / "voice" / "lines.json").read_text(encoding="utf8"))
    m.OUT = tmp_path
    m.main()
    names = sorted(p.name for p in tmp_path.glob("*.pdf"))
    want = {"00_DIRECTOR_GUIDE.pdf", "ALL_ROLES.pdf", "FILLER_PHRASES.pdf"} | {"%02d_%s.pdf" % (i + 1, r["id"]) for i, r in enumerate(data["roles"])}
    assert set(names) == want
    for i, r in enumerate(data["roles"]):
        f = tmp_path / ("%02d_%s.pdf" % (i + 1, r["id"]))
        assert f.read_bytes().startswith(b"%PDF") and f.stat().st_size > 8000
    # the text is really in the files (reportlab compresses pages; read them back with its own parser when available)
    try:
        from pypdf import PdfReader
    except ImportError:
        try:
            from PyPDF2 import PdfReader
        except ImportError:
            return
    guide = "".join(p.extract_text() for p in PdfReader(str(tmp_path / "00_DIRECTOR_GUIDE.pdf")).pages)
    assert "Cast list" in guide and "Who plays whom" in guide and "Checklist" in guide
    role = PdfReader(str(tmp_path / "03_bature_m.pdf"))
    txt = "".join(p.extract_text() for p in role.pages)
    assert "Do Tier A first" in txt and "Tier A" in txt and "page 1 of %d" % len(role.pages) in txt


@pytest.mark.skipif(not NODE, reason="needs Node")
def test_runtime_lookup_and_fallback():
    p = subprocess.run([str(NODE), "games/tests/samaru_voice_harness.js"], cwd=ROOT, capture_output=True, text=True, timeout=60)
    assert p.returncode == 0, p.stderr[-800:]
    out = json.loads(p.stdout.strip().splitlines()[-1])
    assert out["base"] == "http://x/static/audio/voice/"
    assert out["ids"]["a"] == out["ids"]["b"] == vid("How far!") and out["ids"]["c"] != out["ids"]["a"] and out["ids"]["naira"] == vid("Pay ₦200 — now!")
    assert out["before"] == "blip" and out["emptyState"] == "ready" and out["empty"] == "blip" and out["robot"] == "robot"  # no recording: never a machine voice unless asked
    assert out["female"] == "player_f" and out["male"] == "player_m" and out["stable"] and out["ext"] and out["maleSpeakers"] == 2
    assert out["radio"].endswith("/dj/%s.radio.m4a" % vid("Fresh FM")) and out["guardNear"] == "" and out["guardFar"] == "mega"
    assert len(out["crowd"]) >= 2 and out["miss"] is None
    assert out["clip"] == "clip" and out["clipPlayed"] == 1 and out["clipNoBlip"]
    assert out["blip"] == "blip" and out["blipOsc"] >= 2 and out["missRobot"] == "robot"
    assert out["place"][0] == [1, 0] and out["place"][1][0] < 1 and out["place"][2][1] > 0.5
    assert out["subRet"] == 1 and out["emitRet"] == 2 and out["fetched"]
    f = out["filler"]
    assert f["inferred"] == [["happy", "greet"], ["angry-light", "react"], ["worried", "warn"], ["tired", "broke"], ["happy", "thanks"]]
    assert f["first"] == "filler" and f["firstUse"] == "greet" and f["female"].startswith("filler_f") and f["male"].startswith("filler_m")
    assert f["noRepeat"] and f["afterMinute"] and f["stable"] and f["noneFits"] == "blip" and f["murmurSetting"] == "blip" and f["tagged"] == "warn"
    assert out["said"][0] == ["There! By the road!", "guards", ""] and out["said"][1][1:] == ["guards", "mega"] and len(out["said"]) == 2


def _tones(path, n, sr=22050, gap=1.3, clap_after=()):
    frames = [0.0] * int(sr * 0.6)
    for i in range(n):
        d = 0.5 + 0.1 * (i % 3)
        frames += [0.4 * math.sin(2 * math.pi * (200 + 25 * i) * k / sr) * min(1, k / 400) for k in range(int(sr * d))]
        frames += [0.0] * int(sr * gap)
        if i in clap_after:  # a clap: 40 ms of loud noise, then the retake follows as the next burst
            frames += [0.8 * ((k * 7919) % 13 - 6) / 6 for k in range(int(sr * 0.04))] + [0.0] * int(sr * gap)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(b"".join(struct.pack("<h", int(v * 32767)) for v in frames))


@pytest.mark.skipif(not VPY.exists(), reason="run sh tools/voice/run.sh once to create the voice tool environment")
def test_cutter_end_to_end_on_tone_bursts(tmp_path):
    lines = json.loads((ROOT / "docs" / "voice" / "lines.json").read_text(encoding="utf8"))
    grp = {g["id"]: g for g in lines["groups"]}
    dj = [l for l in grp["dj"]["lines"] if l["tier"] == "A"][:12]
    sec = [l for l in grp["staff_m"]["lines"] if l["tier"] == "A"][:10]
    fil = grp["filler_f"]["lines"][:8]
    src, out, rev = tmp_path / "in", tmp_path / "out", tmp_path / "rev"
    (src / "staff_m@test").mkdir(parents=True); (src / "nonsense").mkdir()
    _tones(src / "DJ_Musa_1.wav", 6); _tones(src / "dj_musa_2.wav", len(dj) - 6)                 # a loose file per sitting, any case
    _tones(src / "staff_m@test" / "take.wav", len(sec) + 2, clap_after=(3,))                       # one retake marked by a clap, one bad take dropped by hand
    _tones(src / "filler_f_amina.wav", len(fil))
    (src / "offsets.json").write_text(json.dumps({"staff_m@test": {"skip": [2]}}))
    p = subprocess.run([str(VPY), "tools/voice/cut.py", "--input", str(src), "--out", str(out), "--review", "--review-dir", str(rev)], cwd=ROOT, capture_output=True, text=True, timeout=400)
    assert p.returncode == 0, p.stderr[-800:]
    man = json.loads((out / "manifest.json").read_text())
    by = lambda g: [c for v in man["clips"].values() for c in v if c["g"] == g]
    assert len(by("dj@musa")) == len(dj) and len(by("staff_m@test")) == len(sec) and len(by("filler_f@amina")) == len(fil), p.stdout
    for l in dj:
        e = [c for c in man["clips"][l["id"]] if c["g"] == "dj@musa"][0]
        assert e["k"] == "dj" and 0.3 < e["d"] < 1.2 and e.get("fx", "") == l.get("fx", "")
        assert (out / "dj@musa" / (l["id"] + ".m4a")).stat().st_size > 500
        if l.get("fx"):
            assert (out / "dj@musa" / (l["id"] + "." + l["fx"] + ".ogg")).stat().st_size > 500
    e = [c for c in man["clips"][sec[0]["id"]] if c["g"] == "staff_m@test"][0]
    assert e["x"] == ["mega"] and (out / "staff_m@test" / (sec[0]["id"] + ".mega.m4a")).exists()
    f0 = [c for c in man["clips"][fil[0]["id"]] if c["g"] == "filler_f@amina"][0]
    assert f0["k"] == "filler" and f0["t"] == [fil[0]["mood"], fil[0]["use"]] and set(f0["v"]) == {"", "lo", "hi"}
    assert "1 retakes after a clap" in p.stdout and "unknown group" in p.stdout
    assert (rev / "index.html").read_text().count("<audio") == len(dj) + len(sec) + len(fil)
    # a second run replaces, never duplicates
    subprocess.run([str(VPY), "tools/voice/cut.py", "--input", str(src), "--out", str(out)], cwd=ROOT, check=True, capture_output=True, timeout=400)
    assert json.loads((out / "manifest.json").read_text())["count"] == man["count"]
