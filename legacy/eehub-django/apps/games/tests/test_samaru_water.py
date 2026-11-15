"""Freshers School Life: water. Swimming, breath, banks and steps, vehicles in the lake, fish staying in the water,
walkers kept out, the Dam Visitor Centre and the buoy-swim timer, driven headlessly (samaru_water_harness.js)."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / "static" / "js" / "games"
_OUT = {}


def run():
    if not _OUT:
        res = subprocess.run(["node", str(Path(__file__).with_name("samaru_water_harness.js")), str(JS)], capture_output=True, text=True, timeout=300)
        _OUT.update(json.loads(res.stdout.strip().splitlines()[-1]))
    assert _OUT["ok"], _OUT.get("error")
    assert not _OUT["err"], _OUT["err"]
    return _OUT


need_node = pytest.mark.skipif(not shutil.which("node"), reason="node not installed")


@need_node
def test_deep_water_switches_to_swimming():
    o = run()
    assert o["lake"]["name"] == "The Dam" and o["lake"]["deepMid"] > 5 and o["lake"]["dryOutside"] and o["lake"]["shelf"]
    s = o["swim"]
    assert o["startDry"] and s["waded"] and s["on"] and s["splash"] and s["toast"]
    assert s["slower"], s["speed"]          # surface swimming is slower than walking
    assert s["sprintCost"] > 1              # the sprint stroke drains energy
    assert {"splash", "swim_stroke", "swim_under", "water_out"} <= set(o["sounds"])


@need_node
def test_dive_and_breath_never_drown_you():
    o = run()
    d, b = o["dive"], o["breath"]
    assert d["want"] and d["z"] == 0 and d["under"] and d["breathFalls"] and d["toggleUp"]  # the jump key dives, never jumps
    assert b["ranOut"] and b["surfaced"] and b["hpKept"] and b["toast"] and b["refilled"]
    assert o["landJump"]  # on land the jump key jumps again
    assert 20 <= b["secs"] <= 30 and b["lowWarn"]  # guide 11.4: 20-30 s of air, warned by sight and sound


@need_node
def test_diving_spot_friends_and_deep_water_warning():
    o = run()
    d = o["diveSpot"]
    assert d == {"prompt": "Dive in", "onDeck": True, "airborne": True, "inWater": True, "under": True, "surfaced": True, "counted": True}, d
    assert o["friend"] == {"stays": True, "swims": True, "outAfter": True}, o["friend"]
    assert o["deepWarn"]


@need_node
def test_climb_out_at_a_bank_and_the_steps():
    o = run()
    assert o["bank"] == {"was": True, "out": True, "dryish": True, "wet": True, "sound": True}
    assert o["steps"] == {"swimming": True, "prompt": "Climb out", "out": True}


@need_node
def test_a_vehicle_in_the_lake_stops_and_you_swim_clear():
    c = run()["car"]
    assert c["inCar"] and c["inLake"] and c["stopped"] and c["ejected"] and c["swimming"] and c["drowned"] and c["toast"]
    assert c["stays"] and c["refused"] and c["towed"]


@need_node
def test_fish_stay_in_the_water_and_walkers_stay_out():
    o = run()
    f = o["fish"]
    assert f["n"] >= 60 and f["species"] >= 6 and f["bad"] == 0 and f["deepBad"] == 0
    assert f["moved"] >= f["n"] * .8 and f["jumped"] and f["idleFar"] and f["ducks"] >= 5 and f["egrets"] >= 1
    assert o["npcOut"] and o["lifeguard"]


@need_node
def test_the_visitor_centre_can_be_entered_and_read():
    io = run()["centre"]
    assert io["lockedAtNight"] and io["prompt"] == "Enter Dam Visitor Centre" and io["entered"] and io["tank"] and io["cantReachTank"]
    assert set(io["panels"]) == {"purpose", "dam", "treat", "safety", "fish", "swim"} and set(io["read"]) == set(io["panels"])
    assert io["damText"] and io["treatText"] and io["fishText"] and io["safetyText"] and io["inspired"] and io["allBonus"]
    assert io["seatPrompt"] == "Sit and watch the fish" and io["sat"] and io["left"] and not io["err"]


@need_node
def test_the_buoy_swim_timer_and_race_api():
    r = run()["race"]
    assert r["prompt"] == "Start the buoy swim" and r["count"] and r["running"] and r["target"] == "Buoy 1" and r["swimming"]
    assert r["order"] and r["done"] and r["t"] > 0 and r["best"] == r["t"] and r["splits"] == 4 and r["reward"]
    assert r["slowerKeeps"] and r["fasterSets"] and r["abandon"]
    assert r["api"] == {"laps": 2, "done": True, "time": True, "splits": 4}


def test_water_script_is_registered_everywhere():
    from games.catalogue import BY_SLUG
    deps = BY_SLUG["samaru-days"].extra["deps"]
    assert "samaru-water" in deps and deps.index("samaru-water") > deps.index("samaru-interior")
    for h in ("samaru_harness.js", "samaru_crash.js"):
        assert '"samaru-water"' in (Path(__file__).with_name(h)).read_text()
    man = json.loads((ROOT / "static" / "audio" / "sfx" / "manifest.json").read_text())["packs"]["samaru-days"]
    for n in ("splash", "splash_small", "swim_stroke", "swim_under", "bubbles", "water_out", "gasp"):
        assert man[n]["f"], n
