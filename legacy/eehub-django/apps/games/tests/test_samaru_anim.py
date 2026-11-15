"""Freshers School Life: character animation, run headlessly against the real pose solver (games/tests/samaru_anim.js).

Every change of body state plays a transition: sitting down and standing up, the falls, getting up from the back and
from the front, getting on and off each machine, lifting a fallen bike. At 60 frames a second each one must finish,
end in the pose of the state it went to, never produce NaN, keep feet (and everything else) above the ground, keep
the layer weights summing to one, and move without snapping."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

JS = Path(__file__).resolve().parents[2] / "static" / "js" / "games"
CASES = ["sitGround", "sitChair", "sitRaised", "sitKneel", "trip", "punchBack", "shoveFront", "carHit", "faint", "noGetUpT", "bike", "okada",
         "scooter", "skate", "car", "keke", "kekePassenger", "okadaPillion", "liftBike", "offBike", "offOkada", "offSkate", "walkTurn", "shoveJump"]


@pytest.fixture(scope="module")
def out():
    if not shutil.which("node"):
        pytest.skip("node not installed")
    res = subprocess.run(["node", str(Path(__file__).with_name("samaru_anim.js")), str(JS)], capture_output=True, text=True, timeout=180)
    data = json.loads(res.stdout.strip().splitlines()[-1])
    assert data["ok"], data.get("error")
    return data["cases"]


@pytest.mark.parametrize("name", CASES)
def test_every_transition_is_clean(out, name):
    c = out[name]
    assert c["nan"] == 0  # no NaN in any joint or in the root, ever
    assert c["below"] == 0 and c["minY"] > -0.012  # soles, knees, hands, head never under the ground
    assert c["worstW"] < 1e-9  # layer weights stay in [0, 1] and add up to one
    assert c["maxJump"] < 0.45  # no joint jumps more than 0.45 rad in one 60 Hz frame (a flailing tumble is the fastest)
    assert c["hipSpeed"] < 5.5  # the hips never slide or teleport faster than a brisk walk
    end = c["end"]
    assert end["mode"] == "stand" and end["clip"] == ""  # the last transition completed
    assert abs(end["c"]["lean"]) < 0.12 and abs(end["lowest"]) < 0.02  # upright, standing on the ground (not floating)


def test_sitting_poses_match_their_state(out):
    g = out["sitGround"]["phases"][1]
    assert g["mode"] == "sit" and g["clip"] == "" and abs(g["lowest"]) < 0.01  # resting on the ground, not hovering
    assert g["pose"]["hL"] > 1.5 and g["pose"]["y"] < -0.6  # knees up, hips down
    k = out["sitKneel"]["phases"][1]
    assert k["mode"] == "sit" and k["pose"]["kL"] < -2.6 and abs(k["lowest"]) < 0.01
    assert out["sitChair"]["phases"][1]["pose"]["hL"] > 1.3  # thighs level on the seat
    r = out["sitRaised"]["phases"][1]  # a raised lecture seat: hips on the seat surface, feet on that row's floor
    assert r["mode"] == "sit" and abs(r["lowest"] * 1.08 - 1.5) < 0.04 and abs((r["pose"]["y"] + 0.77) * 1.08 - 1.8) < 0.02


@pytest.mark.parametrize("name,lie", [("trip", -1), ("shoveFront", -1), ("punchBack", 1), ("faint", 1), ("noGetUpT", -1), ("offBike", 1), ("offSkate", 1)])
def test_falls_end_lying_flat_on_the_ground(out, name, lie):
    p = out[name]["phases"][1]
    assert p["mode"] == "fall" and p["clip"] == ""  # the fall finished and they lie still
    assert abs(p["lean"] - lie * 1.5) < 0.08  # face down (-1.5) or on the back (+1.5)
    assert abs(p["lowest"]) < 0.01  # lying on the ground: neither sunk into it nor floating


def test_get_up_differs_from_back_and_front(out):
    assert "upFront" in out["trip"]["clips"] and "upBack" in out["punchBack"]["clips"]
    assert "tumbleFront" in out["carHit"]["clips"] or "tumbleBack" in out["carHit"]["clips"]
    for name in ("offBike", "offOkada", "offSkate"):
        assert any(cl.startswith("offBike") for cl in out[name]["clips"])  # sideways off the machine, not a plain fall


@pytest.mark.parametrize("name,clip_in,clip_out", [("bike", "inTwo", "outTwo"), ("okada", "inTwo", "outTwo"), ("scooter", "inTwo", "outTwo"),
                                                   ("skate", "inSkate", "outSkate"), ("car", "inCabL", "outCabL"), ("keke", "inCabL", "outCabL"),
                                                   ("kekePassenger", "inCabR", "outCabR"), ("okadaPillion", "inTwo", "outTwo")])
def test_mount_and_dismount(out, name, clip_in, clip_out):
    c = out[name]
    assert c["clips"][:3] == [clip_in, "-", clip_out]
    assert c["phases"][1]["mode"] == "ride" and c["phases"][1]["clip"] == ""  # seated before the ride starts


def test_car_door_opens_and_closes(out):
    for name in ("car", "keke"):
        c = out[name]
        assert c["doorMax"] > 0.99  # held open while getting in and out
        assert c["end"]["obj"]["doorT"] == 0  # and shut afterwards (the door does not swing again by itself)


def test_fallen_bike_is_lifted_then_ridden(out):
    c = out["liftBike"]
    assert c["clips"][0].startswith("liftBike") and c["liftMax"] == 1  # the lift ran to the end (o.animLift reaches 1)
    assert c["end"]["obj"]["tipA"] == 0  # the bike stands upright again


@pytest.mark.parametrize("name,speed,limit", [("feet_stroll", 1.2, 0.61), ("feet_walk", 3.5, 0.61), ("feet_jog", 5, 0.87), ("feet_sprint", 6.4, 0.87)])
def test_feet_stay_planted_and_legs_stay_in_range(out, name, speed, limit):
    c = out[name]
    assert c["slide"] < 0.2 * speed + 0.25  # the stance foot barely moves: cycle speed follows ground speed (was 1.4 m/s walking, 4.2 sprinting)
    assert c["thigh"] <= limit + 0.01  # leg swing within 35 degrees walking, 50 degrees running (MASTER_GAME_GUIDE 11.1)


def test_every_outfit_with_every_animation_keeps_legs_inside_the_cloth(out):
    """All 83 wardrobe items, worn one at a time, through every frame of every case above (MASTER_GAME_GUIDE 11.1)."""
    import json as _json
    res = subprocess.run(["node", str(Path(__file__).with_name("samaru_anim.js")), str(JS)], capture_output=True, text=True, timeout=180)
    cloth = _json.loads(res.stdout.strip().splitlines()[-1])["cloth"]
    assert cloth["items"] >= 80 and cloth["shells"] >= 20  # the robes, gowns, skirts, tunics and coats that hang over the legs
    assert cloth["miss"] == 0, cloth["bad"]  # no thigh, knee or shin ever pokes through the side of the cloth
    assert cloth["flare"] <= 2.0  # it flares and hitches up rather than ballooning


def test_animation_events_fire_from_the_motion(out):
    """Footfalls at heel strike, the body meeting the ground or a seat, doors opening and closing (MASTER_GAME_GUIDE 10.2)."""
    walk, sprint = out["feet_walk"]["events"].get("step", 0), out["feet_sprint"]["events"].get("step", 0)
    assert 6 <= walk <= 10 and 7 <= sprint <= 12  # about one per stride length covered in 3 s (10.5 m walking, 19 m sprinting)
    assert out["trip"]["events"].get("land") == 1 and out["sitGround"]["events"].get("seat") == 1
    for name in ("car", "keke"):
        ev = out[name]["events"]
        assert ev.get("doorOpen") == 2 and ev.get("doorClose") == 2  # opened and shut getting in, and again getting out


def test_cutscene_skip_snaps_to_the_end_pose(out):
    s = out["snapSit"]["phases"]
    assert s[1]["clip"] == "sitGround" and s[2]["mode"] == "sit" and s[2]["clip"] == "" and abs(s[2]["lean"] - 0.14) < 0.01  # one frame later: seated
    a = out["snapAll"]["phases"]
    assert a[1]["clip"].startswith("fall") and a[2]["clip"] == "" and abs(a[2]["lean"] + 1.5) < 0.01 and abs(a[2]["lowest"]) < 0.01


def test_hands_on_the_wheel_grips_and_rider():
    """Driver's hands ride the rim at ten to two as the wheel turns +-86 degrees (shuffling past 50, never crossing);
    on a motorbike they hold the grips; a pillion holds the rider's waist."""
    import json as _json
    res = subprocess.run(["node", str(Path(__file__).with_name("samaru_anim.js")), str(JS)], capture_output=True, text=True, timeout=180)
    h = _json.loads(res.stdout.strip().splitlines()[-1])["hands"]
    assert h["wheelErr"] < 0.05 and h["crossed"] == 0
    assert h["gripErr"] < 0.03 and h["waistErr"] < 0.06
