"""Freshers School Life: save slots (static/js/games/samaru-saves.js), run headlessly by fslg_saves_harness.js.
Run: export PATH="$HOME/.nvm/versions/node/v24.22.2/bin:$PATH"; .venv/bin/python -m pytest games/tests/test_fslg_saves.py -q
"""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
JS = HERE.parents[1] / "static" / "js" / "games"
HARNESS = HERE / "fslg_saves_harness.js"

pytestmark = pytest.mark.skipif(not shutil.which("node"), reason="node not installed")


@pytest.fixture(scope="module")
def r(tmp_path_factory):
    env = {"FSLG_SAVES_HTML_DIR": str(tmp_path_factory.mktemp("saves"))}
    import os
    res = subprocess.run(["node", str(HARNESS), str(JS)], capture_output=True, text=True, timeout=600, env=dict(os.environ, **env))
    lines = res.stdout.strip().splitlines()
    assert lines, res.stderr[-3000:]
    out = json.loads(lines[-1])
    assert out["ok"], out.get("error")
    return out


def test_module_loads_with_six_slots(r):
    assert r["loaded"] and r["canSaveFresh"]["ok"]


def test_round_trip_in_every_slot(r):
    assert r["roundTrip"] == {k: True for k in ("auto", "1", "2", "3", "4", "5")}
    assert r["cardFields"], r["card"]


def test_autosave_when_sleeping_at_the_hostel_only(r):
    a = r["autosave"]
    assert a["written"] and a["afterSleep"], a
    assert a["notAway"], a


def test_overwrite_and_delete_ask_first(r):
    s = r["screen"]
    assert s["slots"] == 7 and s["back"] and s["last"]
    assert s["overAsks"] and s["overwritten"]
    assert s["delAsks"] and s["cancelKeeps"] and s["deleted"]
    assert s["loadAsks"] and s["closed"]


def test_old_save_migrates_through_a_slot(r):
    m = r["migrate"]
    assert m["ok"] and m["saveVersion"] == 1 and m["v"] == 2 and m["storyCurrent"], m
    assert m["active"] == "m12" and m["step"] == 0 and m["paid"] > 0, m  # the Year 1 rewrite: restart, paid per step done


def test_saving_is_refused_in_cutscenes_and_mid_step(r):
    b = r["blocked"]
    assert b["film"] and b["cutscene"] and b["talking"] and b["midStep"] and b["title"], b
    assert b["noWrite"], b       # a refused save writes nothing
    assert b["boundary"], b      # between steps it works


def test_slots_are_isolated(r):
    assert r["isolation"] == {"slot3Same": True, "loaded2": True, "readIsCopy": True}


def test_newer_slot_refused_untouched(r):
    assert r["newer"] == {"refused": True, "untouched": True}


def test_full_device_and_private_browsing(r):
    q = r["quota"]
    assert q["persistent"] and q["firstOk"] and q["droppedPicture"] and q["failsClearly"] and q["keptOld"], q
    assert r["privateNote"]
    assert r["perUser"]


def test_screen_markup(r):
    m = r["markup"]
    assert m["allActs"] and m["minHeight"] and m["smallScreen"] and m["groups"] >= 6, m
