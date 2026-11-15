"""Freshers School Life mini-games (static/js/games/samaru-minigames.js), played headlessly by simple bots under Node."""
import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

JS = Path(__file__).resolve().parents[2] / "static" / "js" / "games"
NVM = Path.home() / ".nvm" / "versions" / "node"
if not shutil.which("node") and NVM.is_dir():
    for d in sorted(NVM.iterdir(), reverse=True):
        if (d / "bin" / "node").exists():
            os.environ["PATH"] = str(d / "bin") + os.pathsep + os.environ.get("PATH", "")
            break

pytestmark = pytest.mark.skipif(not shutil.which("node"), reason="node not installed")


@pytest.fixture(scope="module")
def out():
    res = subprocess.run(["node", str(Path(__file__).with_name("samaru_mini_harness.js")), str(JS)], capture_output=True, text=True, timeout=300)
    data = json.loads(res.stdout.strip().splitlines()[-1])
    assert data["ok"], data.get("error")
    return data


def test_table_smash_rules(out):
    t = out["tt"]
    assert t["over"] and t["hardOver"] and t["winBy2"] and t["same"] and t["res"]
    assert max(t["sc"]) >= 11 and t["rally"] >= 2
    # serve changes every two points, then every point from 10-10
    assert t["serve"] == "00110011001100110011" + "010101"


def test_kola_stack_rules(out):
    k = out["kola"]
    assert k["rows"] >= 1 and k["score"] > 0 and k["same"]
    assert k["fullLeft"] == 0 and k["bad"] == 0 and k["held"] and k["risingHusks"]
    assert k["shapes"] == 7 and k["reward"] == 120


def test_fresher_run_levels_and_feel(out):
    r = out["run"]
    assert r["check"] == [], r["check"]
    assert r["levels"] == 6 and r["reached"] >= 1 and r["notes"] > 0 and r["same"]
    assert r["coyoteOk"] and not r["coyoteLate"] and r["buffer"] and r["noJumpDies"]


def test_harmattan_patrol_runs(out):
    p = out["patrol"]
    assert p["score"] > 0 and p["boss"] and p["same"] and p["maxFoes"] <= p["pool"]


def test_ayo_rules(out):
    a = out["ayo"]
    assert a["sow"] == "4,4,0,5,5,5,5,4,4,4,4,4" and a["c1"] == 0 and a["c2"] == 0
    assert a["c3"] == 2 and a["b3"] == "0,0,0,0,0,1,0,2,4,0,0,0"          # last seed makes two: taken
    assert a["c4"] == 7 and a["b4"] == "0,0,0,0,0,0,0,0,0,0,0,5"          # a run of twos and threes is taken together
    assert a["c5"] == 0 and a["b5"] == "0,0,0,0,0,0,2,3,2,0,0,0"          # taking everything is not allowed
    assert a["l6"] == [4, 5]                                              # you must feed an empty opponent
    assert a["b7"] == "1,1,1,0,2,2,1,1,1,1,1,1"                           # twelve or more seeds skip their own house
    assert a["over"] and a["total"] == [48, 48] and a["same"]


def test_cabinet_fee_cap_and_high_scores(out):
    c = out["cab"]
    assert c["list"] == "tabletennis,kola,run,patrol,ayo" and c["unknown"] and c["active"] and c["playing"]
    assert c["paid"] == 450 and c["free"] == 450 and c["broke"] and c["closed"] and c["picked"]
    assert c["capCash"] == c["cap"] == 600
    assert c["best"] == 99999 and c["bestAfterSave"] == 99999 and c["saved"] and c["keptBest"] and c["newDay"]


def test_every_game_plays_by_touch_alone(out):
    t = out["touch"]
    assert t["minDiameter"] >= 68                    # 49 CSS px on an 844x390 phone
    assert t["tt"][0] >= 2                            # drag the bat, SERVE button
    assert t["swipeCols"] == 2 and t["tapTurns"] and t["flickDrops"] and t["basket"] and t["kolaRows"] >= 2
    assert t["run"] > 0 and t["runNotes"] > 0 and t["multi"]   # ▶ held while JUMP is pressed
    assert t["patrol"] >= 200 and t["bomb"] == 1
    assert t["ayoOver"] and t["ayoTaps"] > 5 and t["ayo"][0] > 0
    assert t["paused"] and t["left"] and t["restored"] and t["released"] and t["keysHide"]
