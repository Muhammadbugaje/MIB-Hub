"""Freshers School Life: vehicle crashes, run headlessly against the real game scripts (games/tests/samaru_crash.js).

Every pair is set up on open ground or a straight road and run at 120 Hz: no overlap afterwards, nobody stuck, the
push goes the right way, the lighter rider comes off, and the sound named for the materials fires."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

JS = Path(__file__).resolve().parents[2] / "static" / "js" / "games"
OLD_METAL = {"crash_light", "crash_metal", "metal", "metal_heavy"}


@pytest.fixture(scope="module")
def out():
    if not shutil.which("node"):
        pytest.skip("node not installed")
    res = subprocess.run(["node", str(Path(__file__).with_name("samaru_crash.js")), str(JS)], capture_output=True, text=True, timeout=300)
    data = json.loads(res.stdout.strip().splitlines()[-1])
    assert data["ok"], data.get("error")
    return data


def test_car_into_car(out):
    c = out["cases"]["carCar"]
    assert c["gap"] > -0.05 and c["minGap"] > -0.1  # never inside each other
    assert c["pushedX"] > 1  # the parked car is shoved the way you were going
    assert "crash_car" in c["names"] and not OLD_METAL & set(c["names"])
    assert c["kick"] > 5 and c["speedAfter"] < 6  # a jolt, and the speed is gone
    assert c["free"]  # you can reverse away: not stuck


def test_glancing_hit_keeps_going(out):
    g = out["cases"]["glance"]
    assert g["past"] and g["speed"] > 8 and g["spinB"] > 0.02  # a brush deflects and spins the other car, you carry on


def test_car_into_bicycle(out):
    c = out["cases"]["carBike"]
    assert c["dirX"] > 3 and c["tip"] > 1.2 and c["rest"]  # thrown forward, down on its side, then at rest
    assert c["inWall"] < 0.05 and c["carSpeed"] > 5  # a bicycle barely slows a car
    assert "crash_bicycle" in c["names"] and "crash_car" not in c["names"] and not OLD_METAL & set(c["names"])  # a rattle, never a clang
    assert c["pickedUp"]  # and it can be picked up and ridden again


def test_fallen_bike_rises_with_the_hands(out):
    r = out["cases"]["lift"]
    assert r["heldDown"] > 1.3 and 0.6 < r["half"] < 0.85 and r["up"] < 0.01 and r["noAnimUp"] < 0.01, r  # follows me.animLift; eases up when nothing animates


def test_car_into_okada_and_skateboard(out):
    assert "crash_moto" in out["cases"]["car_okada"]["names"] and out["cases"]["car_okada"]["tip"] > 1.2
    s = out["cases"]["car_skate"]
    assert "crash_skate" in s["names"] and "crash_car" not in s["names"] and s["moved"] > 2
    for k in ("car_okada", "car_skate"):
        assert out["cases"][k]["gap"] > -0.05


def test_you_come_off_a_bicycle(out):
    b = out["cases"]["bikeIntoCar"]
    assert b["thrown"] and b["fell"] > 1 and b["bikeTip"] > 1.2 and b["hp"]
    assert b["carMoved"] < 0.5 and not b["meInCar"] and b["gapBikeCar"] > -0.05  # the car barely moves; you are not inside it
    assert "crash_bicycle" in b["names"] and "fall" in b["names"]
    assert b["upAgain"]


def test_traffic_rider_comes_off_and_rides_on(out):
    t = out["cases"]["carOkadaTraffic"]
    assert t["spilled"] and t["riderDown"] and t["bikeTipped"] and t["rodeOn"]
    assert "crash_moto" in t["names"] and "fall" in t["names"]


def test_bus_is_heavy_and_traffic_reacts(out):
    b = out["cases"]["carBus"]
    assert "crash_bus" in b["names"] and b["gap"] > -0.05 and b["minGap"] > -0.1
    assert b["stunned"] and b["honked"] and b["busMoved"] < 3
    t = out["cases"]["carTraffic"]
    assert t["shoved"] > 1 and t["gap"] > -0.05 and t["honked"] and "crash_car" in t["names"]  # same weight: shoved well forward


def test_walls(out):
    w = out["cases"]["carWall"]
    assert w["maxIn"] < 0.05 and w["speedAfter"] < 2 and w["kick"] > 8 and w["backedOff"] and "crash_wall" in w["names"]
    g = out["cases"]["glanceWall"]
    assert g["maxIn"] < 0.05 and g["speed"] > 7 and g["along"] > 6  # slides along the wall instead of sticking
    for k in ("bikeWall", "skateWall", "okadaWall"):
        assert out["cases"][k]["maxIn"] < 0.05
    assert "crash_bicycle" in out["cases"]["bikeWall"]["names"] and not OLD_METAL & set(out["cases"]["bikeWall"]["names"])
    assert "crash_skate" in out["cases"]["skateWall"]["names"]
    assert "crash_moto" in out["cases"]["okadaWall"]["names"]


def test_people(out):
    s = out["cases"]["pedSlow"]
    assert "hit_person" in s["names"] and not s["fell"] and s["minGap"] > -0.1 and s["moved"] > 0.3  # a stumble aside
    f = out["cases"]["pedFast"]
    assert f["down"] and f["upAgain"]  # knocked down, then up again: nobody dies


def test_plants(out):
    h = out["cases"]["hedge"]
    assert h["maxBend"] > 0.15 and h["leanedForward"] and h["back"] and h["through"] and h["unplanted"]  # bends away, springs back
    assert "rustle" in h["names"] or "rustle_big" in h["names"]
    t = out["cases"]["trunk"]
    assert t["stoppedBefore"] and t["worstGap"] > -0.05 and "crash_pole" in t["names"]  # a big trunk is solid


def test_horn(out):
    h = out["cases"]["horn"]
    assert h["reacted"] >= 2 and h["looked"] and h["aside1"] > 1 and h["aside2"] > 1 and h["farMoved"] < 0.3 and not h["down"]
    assert out["cases"]["hornTraffic"]["yield"]


def test_friends_ride_along(out):
    f = out["cases"]["friends"]
    c = f["car"]
    assert 0 < c["boarded"] < 7 and c["anc"] and c["visible"] and c["maxStep"] < 0.2 and c["offAfterExit"]  # walked to the door (no teleport), seated, visible, out with you
    o = f["okada"]
    assert o["riders"] == 2 and o["seats"] == [0, 1] and o["third"] == "on foot" and o["loadK"] < 0.8 and o["stillOn"] == 2
    assert f["keke"]["riders"] == 3 and sorted(f["keke"]["seats"]) == [0, 1, 2]
    b = f["bike"]
    assert not b["boarded"] and not b["ownBike"] and b["gapEnd"] < 12  # on foot beside a bicycle, and keeps up
    s = f["shuttle"]
    assert s["started"] and s["rode"] and s["paid"] == 2 * s["one"] and s["off"]  # you pay for both; they ride and get off with you
    ld = out["cases"]["loads"]
    assert 0 <= ld["keke"] <= ld["kekeMax"] == 3 and 0 <= ld["okada"] <= ld["okadaMax"] == 2


def test_sound_table(out):
    t = out["sounds"]["table"]
    assert t["car_car"] == ["crash_car"] and t["car_car_soft"] == ["crash_car_light"]
    assert "crash_bus" in t["car_bus"] and "crash_moto" in t["moto_car"] and "crash_pole" in t["car_pole"] and "crash_wall" in t["car_wall"]
    assert t["car_bicycle"][0] == "crash_bicycle" and "crash_car" not in t["car_bicycle"]
    assert t["skate_wall"][0] == "crash_skate" and t["car_ped"][0] == "hit_person" and "scrape" in t["car_scrape"]
    assert "crash_heavy" in t["hard"] and "glass" in t["hard"]
    every = {n for v in t.values() for n in v}
    assert not OLD_METAL & every
    assert set(out["sounds"]["registered"]) >= {"crash_car", "crash_bicycle", "crash_skate", "crash_bus", "crash_moto", "crash_wall", "crash_pole", "scrape"}
    assert out["sounds"]["leanOrder"]  # two-wheelers lean about their own length


def test_crash_sounds_have_files():
    man = json.loads((JS.parents[2] / "static" / "audio" / "sfx" / "manifest.json").read_text())
    pack = man["packs"]["samaru-days"]
    for n in ("crash_car", "crash_car_light", "crash_bus", "crash_moto", "crash_bicycle", "crash_skate", "crash_wall", "crash_pole", "scrape", "hit_person"):
        assert pack.get(n, {}).get("f"), n
        for stem in pack[n]["f"]:
            assert (JS.parents[2] / "static" / "audio" / "sfx" / (stem + ".ogg")).exists(), stem


def test_handling_numbers():
    """Pedal feel and brakes after the handling pass (before: instant full power, 1.3-1.6 g stops on every machine)."""
    if not shutil.which("node"):
        pytest.skip("node not installed")
    res = subprocess.run(["node", str(Path(__file__).with_name("samaru_feel.js")), str(JS / "samaru-sim.js")], capture_output=True, text=True, timeout=120)
    f = json.loads(res.stdout.strip().splitlines()[-1])
    for k, r in f.items():
        assert r["t80"] and r["t80"] < 4, (k, r)  # still quick off the line
        assert r["jerk0"] < 5, (k, r)  # but the first instant is a push, not a jolt
        assert r["revTop"] < -2.5, (k, r)
    assert 3 < f["bike"]["brake"] < 8 and 18 < f["car"]["brake"] < 35 and f["sport"]["brake"] < 55, f  # about 0.75 g on a bicycle, 1.2-1.3 g in cars
    assert f["car"]["radius50"] < 20 and f["bike"]["radius50"] < 7, f


def test_head_clearance_rule():
    """Guide 11.2: seat height + seated torso + head must be under the roof for every seat of every closed machine.
    A seated figure is 1.28 rig units from hips to the top of the head (a big NPC is drawn at 1.12), and a tall hairstyle
    may be drawn smaller to fit, but never below 80 % of its normal seated size."""
    if not shutil.which("node"):
        pytest.skip("node not installed")
    code = ("global.window=global; global.SamaruSim=require(process.argv[1]+'/samaru-sim.js'); global.SamaruGame={};"
            "require(process.argv[1]+'/samaru-veh.js'); const V=SamaruGame.veh; console.log(JSON.stringify({cab:V.CABIN, seats:V.SEATS}))")
    res = subprocess.run(["node", "-e", code, str(JS)], capture_output=True, text=True, timeout=60)
    d = json.loads(res.stdout.strip().splitlines()[-1])
    HEAD, BIG, MINFIT, bad = 1.28, 1.12, 0.8, []
    for k, c in d["cab"].items():
        if (c["roof"] - c["seat"]) / (HEAD * BIG * c["scale"]) < MINFIT:
            bad.append((k, "driver"))
    for k, seats in d["seats"].items():
        for i, s in enumerate(seats):
            if s.get("roof") and (s["roof"] - s["seat"][1]) / (HEAD * BIG * s.get("scale", 1)) < MINFIT:
                bad.append((k, i))
    assert {"car", "taxi", "sport", "pickup", "bus", "keke", "plane"} <= set(d["cab"]), d["cab"].keys()  # every closed machine, the taxi and the plane cockpit too
    assert not bad, bad


def test_full_load_bodies_do_not_overlap():
    """Every machine at full load: no two seated bodies (hip to shoulder, 0.13 m thick at full size) intersect."""
    if not shutil.which("node"):
        pytest.skip("node not installed")
    code = ("global.window=global; global.SamaruSim=require(process.argv[1]+'/samaru-sim.js'); global.SamaruGame={};"
            "require(process.argv[1]+'/samaru-veh.js'); const V=SamaruGame.veh; console.log(JSON.stringify({d:V.DRIVER, seats:V.SEATS}))")
    res = subprocess.run(["node", "-e", code, str(JS)], capture_output=True, text=True, timeout=60)
    d = json.loads(res.stdout.strip().splitlines()[-1])

    def seg(p, q, r, s):  # closest distance between 2D segments p-q and r-s (sampled)
        best = 9e9
        for i in range(11):
            a = (p[0] + (q[0] - p[0]) * i / 10, p[1] + (q[1] - p[1]) * i / 10)
            for j in range(11):
                b = (r[0] + (s[0] - r[0]) * j / 10, r[1] + (s[1] - r[1]) * j / 10)
                best = min(best, ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** .5)
        return best
    bad = []
    for kind, drv in d["d"].items():
        bodies = [drv] + [dict(s, scale=s.get("scale", drv["scale"])) for s in d["seats"].get(kind, [])]
        caps = []
        for b in bodies:
            sc = b.get("scale", 1); x, z = b["seat"][0], b.get("side", 0)
            caps.append(((x, z), (x - b.get("lean", .1) * .5 * sc, z), .13 * sc))
        for i in range(len(caps)):
            for j in range(i + 1, len(caps)):
                if seg(caps[i][0], caps[i][1], caps[j][0], caps[j][1]) < caps[i][2] + caps[j][2]:
                    bad.append((kind, i, j))
    assert {"car", "taxi", "sport", "pickup", "bus", "keke", "okada", "scooter", "plane"} <= set(d["d"]), d["d"].keys()
    assert not bad, bad
