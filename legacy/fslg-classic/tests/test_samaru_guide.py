"""Freshers School Life: the new-player walkthrough, driven headlessly with synthesised input."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

JS = Path(__file__).resolve().parents[2] / "static" / "js" / "games"
STEPS = ["look", "walk", "sprint", "jump", "talk", "phone", "gps", "bike", "ride", "radio", "off", "punch", "wave", "needs", "sleep"]


@pytest.mark.skipif(not shutil.which("node"), reason="node not installed")
def test_walkthrough_from_first_step_to_hand_over():
    res = subprocess.run(["node", str(Path(__file__).with_name("samaru_guide_harness.js")), str(JS)], capture_output=True, text=True, timeout=300)
    out = json.loads(res.stdout.strip().splitlines()[-1])
    assert out["ok"], out.get("error")
    # every step is reached in order and only completes when the player does the thing
    assert out["log"] == STEPS + ["end"] and out["total"] == len(STEPS) and len(out["seen"]) == len(STEPS)
    assert out["noFreeTick"] and out["walkIsNotSprint"] and out["phoneAloneIsNotEnough"] and out["notThereYet"]
    assert out["riding"] == "bike" and out["rideTo"] == "fountain" and out["onFoot"] and out["talkDist"] < 40 and out["bikeDist"] < 40
    # wording follows the device in use
    assert out["devices"] == {"kb": True, "touch": True, "pad": True}
    # it never blocks: hidden under menus, and it hands over to mission one untouched
    assert out["hiddenAtFirst"] and out["menuHidesCard"] and out["done"] and out["endCard"] and out["endCardLeaves"]
    assert out["mission"] == "m1" and out["missionStep"] <= 2 and 15 * 5 + 40 <= out["xp"] <= 15 * 5 + 40 + 10  # a wave returned by a passer-by adds a little
    # saved, safe for old saves, tips shown once, replay / minimise / skip
    assert out["savedDone"] and out["oldHasNoField"] and out["oldSaveNoTutorial"]
    assert out["tip"] and out["tipDismissed"] and out["tipOnce"] and out["hintsSaved"] and out["warnTip"] and out["wantedTip"]
    assert out["helpOffersReplay"] and out["replays"] and out["minimised"] and out["restored"] and out["skipped"]
