"""Arcade endings and cheats: the shared ceremony kit, per-game win/lose wiring, cheat defaults and the hidden-character gate."""
import hashlib
import importlib.util
import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / "static" / "js" / "games"
DEFS = ROOT / "games" / "cheat_defaults"
NVM = sorted(Path.home().glob(".nvm/versions/node/*/bin/node"))
NODE = shutil.which("node") or (str(NVM[-1]) if NVM else None)

spec = importlib.util.spec_from_file_location("cheat_build", DEFS / "build.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)

WIN = ("win", "champion", "stageClear", "gameComplete", "newRecord")
LOSE = ("lose", "eliminated")
CAN_LOSE = {"momentum-cup", "impulse-arena", "kinetic-kingdom", "wavefront", "induction-dash"}


@pytest.fixture(scope="module")
def run():
    if not NODE:
        pytest.skip("node not installed")
    out = subprocess.run([NODE, str(Path(__file__).with_name("arcade_harness.js")), str(JS), str(DEFS)], capture_output=True, text=True, timeout=120)
    assert out.returncode == 0, out.stderr[-2000:]
    return json.loads(out.stdout.strip().splitlines()[-1])


def test_hash_matches_hashlib(run):
    want = [hashlib.sha256(s.encode()).hexdigest() for s in ("abc", "momentum-cup:héllo*1#", "x" * 200)]
    assert run["hash"] == want


def test_every_ceremony_kind_plays_hands_over_and_cleans_up(run):
    for kind, (started, handed, dialog_open, ended, confetti) in run["kinds"].items():
        assert started and handed == 1 and dialog_open and ended and confetti == 0, kind
    assert run["cancelled"] and "lateHandOver" not in run


def test_momentum_cup_win_and_loss_reach_a_ceremony_and_return_control(run):
    assert run["cup"]["champion"] == [True, "champion", True, True]
    assert run["cup"]["eliminated"] == [True, "eliminated", True, True]
    assert run["demoReports"] == 0  # the attract demo used to file real results


def test_cheats_work_and_block_reporting(run):
    c = run["cheat"]
    assert c["wrong"] is False and c["before"] is False
    assert c["typed"] and c["dial"] and c["keyboard"] and c["score"][0] == 2 and c["after"] is True
    assert c["blocked"] is True


def test_hidden_character_needs_the_server(run):
    g = run["gate"]
    assert g["before"] and not g["active"] and g["revealed"]      # the combo only opens the code box
    assert g["verifyOffline"] is False and g["after"]             # no server answer, no character


@pytest.mark.parametrize("slug", sorted(build.GAMES))
def test_game_endings_cheat_defaults_and_registration(slug, run):
    js_name, _title, _p, _n, _cheats, _hero = build.GAMES[slug]
    src = (JS / js_name).read_text(encoding="utf8")
    assert ".ceremony(" in src
    picking = "".join(m for line in src.splitlines() if ".ceremony(" in line or " kind = " in line for m in re.findall(r"(?:\.ceremony\(| kind = )[^{;]*", line))
    kinds = set(re.findall(r'"(win|lose|draw|champion|eliminated|newRecord|stageClear|gameComplete)"', picking))
    assert kinds & set(WIN), f"{slug}: no winning ceremony"
    if slug in CAN_LOSE:
        assert kinds & set(LOSE), f"{slug}: no losing ceremony"
    data = json.loads((DEFS / f"{slug}.json").read_text(encoding="utf8"))
    ids = [c["id"] for c in data["cheats"]]
    assert 6 <= len(ids) <= 12 and len(set(ids)) == len(ids) and "skip" in ids
    assert data["hero"]["name"] == "M.I. BUGAJE" and data["hero"]["combo"] and data["hero"]["swipe"]
    table = json.loads(re.search(r"/\*CH\[\*/(.*?)/\*\]CH\*/", src, re.S).group(1))
    assert table == build.table(slug), f"{slug}: run games/cheat_defaults/build.py"
    for c in data["cheats"]:
        assert re.search(r"\b%s: \{ label: " % re.escape(c["id"]), src) and f"h: CH.{c['id']}" in src, f"{slug}: {c['id']} not registered"
        assert table[c["id"]] == [hashlib.sha256(f"{slug}:{code.lower()}".encode()).hexdigest() for code in (c["typed"], c["dial"])]
    shipped = "".join(p.read_text(encoding="utf8") for p in JS.glob("*.js"))
    for c in data["cheats"]:
        assert c["typed"] not in shipped and c["dial"] not in shipped, f"{slug}: plain code {c['id']} is in shipped JavaScript"
    if slug == "momentum-cup":
        assert sorted(ids) == run["cheatIds"]
