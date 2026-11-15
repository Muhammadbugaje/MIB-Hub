"""Wavefront and Induction Dash, played headless on the real arcade runtime (games/tests/wd_harness.js).

Wavefront: the new stages' arenas, mid-bosses and bosses all resolve at phone width (no soft-lock), Survival escalates
with modifiers and a boss on wave 10 and records a board row, and upgrades are bought in order and take effect.
Induction Dash: induction physics is consistent for every cart, a bot finishes all 30 tracks, ghosts are saved, and the
endless line speeds up and ends on a leaderboard."""
import json
import shutil
import subprocess
import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / "static" / "js" / "games"
NVM = sorted(Path.home().glob(".nvm/versions/node/*/bin/node"))
NODE = shutil.which("node") or (str(NVM[-1]) if NVM else None)
pytestmark = pytest.mark.skipif(not NODE, reason="node not installed")


def run(which, width=360, **env):
    e = dict(os.environ, **{k: str(v) for k, v in env.items()})
    out = subprocess.run([NODE, str(Path(__file__).with_name("wd_harness.js")), str(JS), which, str(width)], capture_output=True, text=True, timeout=900, env=e)
    assert out.returncode == 0, out.stderr[-2000:]
    return json.loads(out.stdout.strip().splitlines()[-1])


def test_wavefront_new_stages_resolve_on_a_phone_and_survival_and_upgrades_work():
    o = run("wavefront", 360, WD_STAGES="8,9,10,11", WD_CAP=300)
    assert o["migrated"] and o["stageCount"] == 12
    for st in o["events"]:
        for kind, done, clear, secs in st["res"]:
            assert done and clear, (st["id"], kind, secs)        # every arena / mid-boss / boss starts and ends: no soft-lock
        assert st["bossDown"], st["id"]
    s = o["surv"]
    assert o["survStarted"] and s["maxWave"] >= 10 and s["sawMid"] and s["sawBoss"]   # boss on wave 10, mid-boss on wave 5
    assert len(s["mods"]) >= 1                                                       # a modifier from wave 5
    assert s["hpScale"] > 1.4                                                        # waves get tougher (+6% a wave)
    so = o["survOver"]
    assert so["board"] == 1 and so["photons"] > 0 and so["reported"] == 1 and so["dialog"]
    u = o["upgrades"]
    assert u["skipped"]                     # cannot buy the 2nd node of a branch before the 1st
    assert u["plate"] and u["hp"] == 4 and u["sine"] == 2 and u["ph"] == 1000 - 40 - 40


def test_induction_dash_tracks_carts_ghosts_and_endless():
    o = run("dash", 360)
    assert o["migrated"] and o["tracks"] == 30 and o["zones"] == 6
    for c in o["physics"]:
        assert c["E"] == pytest.approx(c["keLoss"], rel=0.05)          # harvested energy = kinetic energy lost (first order)
    assert all(r["done"] and r["win"] for r in o["runs"]), [r for r in o["runs"] if not r["win"]]
    assert all(r["E"] >= r["target"] for r in o["runs"])
    assert o["ghost"]["have"]
    e = o["endless"]
    assert e["ended"] and e["rows"] == 1 and e["cruise"] > e["v0"] + 2 and e["dist"] > 1000
    assert o["unlockRule"] == sorted(o["unlockRule"]) and o["unlockRule"][0] == 0
