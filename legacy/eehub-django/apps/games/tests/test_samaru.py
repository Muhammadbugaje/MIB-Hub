"""Freshers School Life: the play page, the room relay rules, and a headless Node play-through of the real scripts."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest
from django.core.cache import cache

from games import rooms
from games.catalogue import BY_SLUG
from games.progress import MAX_STAGE, Rejected

JS = Path(__file__).resolve().parents[2] / "static" / "js" / "games"
STATE = {"x": 1.0, "y": 2.0, "a": 0.5, "v": "okada", "s": 3, "e": "wave", "c": "amina", "o": 1, "l": 3, "h": 90}


def test_catalogue_entry_and_scripts_exist():
    g = BY_SLUG["samaru-days"]
    assert g.playable and g.level == 100 and MAX_STAGE["samaru-days"] == 120
    for name in g.extra["deps"] + [g.script]:
        assert (JS / f"{name}.js").exists(), name


def test_room_relays_state_and_events():
    cache.clear()
    assert rooms.sync(1, {"code": "abu 1", "name": "Ada", "st": STATE}, now=100)["players"] == []
    out = rooms.sync(2, {"code": "ABU1", "name": "Bola", "st": STATE, "ev": [{"k": "chat", "p": 2}, {"k": "nonsense"}]}, now=100.2)
    assert [p["n"] for p in out["players"]] == ["Ada"] and out["players"][0]["st"]["v"] == "okada"
    seen = rooms.sync(1, {"code": "ABU1", "name": "Ada", "st": STATE, "since": 0}, now=100.4)
    assert [(e["k"], e["f"], e["p"]) for e in seen["ev"]] == [("chat", 2, 2)]
    assert rooms.sync(1, {"code": "ABU1", "name": "Ada", "st": STATE, "since": seen["ev"][-1]["i"]}, now=100.6)["ev"] == []


def test_room_is_capped_at_six_and_forgets_leavers():
    cache.clear()
    for pid in range(1, 7):
        rooms.sync(pid, {"code": "FULL", "name": f"P{pid}", "st": STATE}, now=50)
    with pytest.raises(Rejected):
        rooms.sync(7, {"code": "FULL", "name": "P7", "st": STATE}, now=51)
    assert len(rooms.sync(7, {"code": "FULL", "name": "P7", "st": STATE}, now=50 + rooms.STALE_S + 1)["players"]) == 0


def test_room_cleans_hostile_input():
    cache.clear()
    st = rooms.clean_state({"x": "1e99", "y": float("nan"), "v": "<script>", "e": "x", "c": "<b>", "l": 9999})
    assert st["x"] == 3000 and st["y"] == 0 and st["v"] == "" and st["e"] == "" and st["c"] == "tunde" and st["l"] == 150
    with pytest.raises(Rejected):
        rooms.clean_code("a")
    assert rooms.clean_event({"k": "chat", "p": 999}, 0)["p"] == rooms.CHAT_PHRASES - 1
    assert rooms.clean_event({"k": "chat", "text": "free text is not relayed"}, 0) == {"k": "chat", "p": 0}


@pytest.mark.skipif(not shutil.which("node"), reason="node not installed")
def test_headless_playthrough():
    res = subprocess.run(["node", str(Path(__file__).with_name("samaru_harness.js")), str(JS)], capture_output=True, text=True, timeout=600)
    out = json.loads(res.stdout.strip().splitlines()[-1])
    assert out["ok"], out.get("error")
    assert out["storyDone"] == {"done": 120, "total": 120} and out["story"][:36] == ["m%d" % i for i in range(1, 37)] and out["badPlaces"] == []
    assert out["tokens"] == 170 and out["raceWon"] and out["saveOk"] and out["blackout"] and out["shades"] > 0
    assert all(v == 1 for v in out["jobs"].values()) and out["veh"]["plane"]["alt"] == 1
    sh = out["shuttle"]  # eight stops; a skipped trip and a ride-along both arrive; the Phase 2 fare is the capped one
    assert sh["stops"] == 8 and sh["menu"] and sh["started"] and sh["skipArrived"] and sh["riding"] and sh["rideArrived"] and sh["busGone"] and sh["broke"], sh
    assert sh["fare"] == sh["paid"] == 200 and sh["keke"] == 300 and sh["km"] > 2.5, sh
    bm = out["bigmap"]  # the full map: tap a marker for its card, set a route from it, search, zoom, close
    assert all(bm[k] for k in ("routeClick", "routeTap", "closeClick", "closeTap", "shuttleClick", "shuttleTap", "xClick", "xTap")), bm
    assert bm["err"] == "" and bm["card"] and bm["info"] and bm["routed"] and bm["search"] and bm["zoom"] and bm["cats"] and bm["closed"], bm
    wd = out["wild"]  # beyond the fence: continuous ground, two warnings, a chase, and the player is brought back to the grounds
    assert wd["nan"] == 0 and wd["maxStep"] < 0.5 and wd["maxD"] > 500 and wd["flatCampus"] and wd["same"], wd
    assert wd["stages"][:3] == ["warn1", "warn2", "chase"] and wd["stages"][-1] in ("escorted", "ko") and wd["home"] and wd["trucks"] == 0, wd
    st = out["street"]  # walkers and traffic: nobody inside a wall, no jumps or snap turns, cars on the road and apart
    assert st["peds"] > 10 and st["cars"] > 5 and st["moving"] > 10
    assert st["pedIn"] == st["npcIn"] == st["pedJump"] == st["pedTurn"] == 0, st
    assert st["carJump"] == st["carTurn"] == st["carOff"] == 0 and st["carOverlap"] <= 40 and st["pedOverlap"] <= 2, st
    assert out["remote"]["jump"] == 0 and out["remote"]["turned"] < 0.1 and 5 < out["remote"]["spd"] < 7
    tired = out["tired"]  # an empty energy bar slows you down; it never knocks you over
    assert tired["faints"] == 0 and tired["fall"] == 0 and 12 < tired["moved"] < 40 and not tired["sprint"] and tired["sprintAgain"]
    assert out["ko"] == {"down": True, "moment": True, "hp": out["ko"]["hp"], "fee": 0, "faints": 1} and out["ko"]["hp"] >= 40
    assert out["moments"] == {"started": True, "retried": 1, "drained": True}
    poses = out["momentPoses"]  # wins cheer, losses hang their head, every one shows its banner and ends
    assert all(poses[k] == ["cheer", True, True] for k in ("mission", "level", "promotion", "raceWin", "escaped", "goal")), poses
    assert all(poses[k] == ["sad", True, True] for k in ("raceLose", "fail", "caught", "ko")), poses
    sec = out["security"]  # minor things are ignored, warnings come first, a chase can be outrun, callOff clears it
    assert sec["minor"] == {"guards": 0, "warns": 0, "state": ""}
    assert sec["chase"] and sec["warnsBefore"] == sec["allowed"] == 5 and sec["spawned"] >= 1 and sec["spawnDist"] >= 40
    assert sec["events"][:2] == ["wanted", "escaped"] and sec["escapedIn"] <= 45 and sec["after"]["state"] == ""
    assert sec["caught"]["events"] == "caught" and 0 < sec["caught"]["fine"] <= 200 and sec["caught"]["moved"] < 1
    assert sec["off"] == {"state": "", "heat": 0, "warns": 0, "guards": 0, "wanted": 0} and sec["rules"] == 6
    assert sec["stall"] == {"runs": 20, "stalls": 0}  # a chasing guard never stands still against a wall
    fr = out["friends"]  # a companion keeps up on foot and on wheels, a leader gets you there, friends keep their own day
    assert fr["follow"]["walked"] >= 300 and fr["follow"]["worst"] <= 6 and fr["follow"]["inside"] == 0 and fr["follow"]["still"]
    assert fr["pillion"] == {"riding": True, "on": True, "gap": fr["pillion"]["gap"]} and fr["pillion"]["gap"] < 1.5
    assert not fr["off"]["riding"] and fr["off"]["gap"] < 5 and not fr["off"]["inside"]
    assert not fr["bike"]["own"] and fr["bike"]["foot"] and fr["bike"]["off"] and fr["bike"]["gap"] < 25  # beside a bicycle they jog after you on foot (owner, Nov 2026)
    assert fr["lead"]["arrived"] == "library" and fr["lead"]["meToPlace"] <= 15 and fr["lead"]["walksOn"]
    assert min(fr["day"]["places"]) >= 3 and fr["day"]["inside"] == 0
    assert fr["offer"] == {"made": True, "leading": True}
    br = out["brawl"]  # knocked down means down, still, then up; people answer a punch by temperament; damage stays light
    assert br["down"]["lay"] >= 1.5 and br["down"]["movedWhileDown"] < 0.01 and br["down"]["gotUp"] and br["down"]["standing"] and br["down"]["upAfter"] < 8
    assert br["car"]["fell"] >= 2.4 and br["car"]["up"] and br["car"]["limp"]
    assert br["timid"]["away"] > 8 and br["timid"]["hurtYou"] == 0 and br["timid"]["up"]
    assert 1 <= br["normal"]["hitBack"] <= 2 and br["normal"]["windUp"] and br["normal"]["state"] != "fight" and br["normal"]["letGo"]
    assert br["tough"]["hitBack"] >= 2 and br["tough"]["perHit"] <= 7 and br["tough"]["blockedLost"] < br["tough"]["lost"] and br["tough"]["yields"] and br["tough"]["alive"]
    cb = out["combat"]  # no blows through walls either way; enemies come round buildings
    assert cb["found"] and cb["throughWall"] == 0 and cb["hurtThroughWall"] == 0 and cb["clearHit"] > 0, cb
    assert cb["chase"]["tries"] == 10 and cb["chase"]["reached"] >= 9, cb
    assert br["moves"] == {"kick": True, "kicked": True, "block": True, "unblock": True, "bound": True}
    jb = out["jobsPlus"]  # a job brings its vehicle and its passenger, chains stops, pays a tip, and can be cancelled for free
    assert jb["given"]["veh"] == "keke" and jb["given"]["parked"] == 1 and jb["given"]["near"] < 12 and jb["given"]["fee"] > 0 and jb["given"]["waiting"]
    assert jb["rides"] and jb["pickup"] == {"stage": 1, "aboard": True}
    assert jb["chain"]["legs"] == 1 and jb["chain"]["moved"] and jb["chain"]["still"] and jb["chain"]["fare"]
    d = jb["done"]
    assert d["over"] and d["vehGone"] and d["onFoot"] and d["paid"] >= d["atLeast"] and d["rated"] == 1 and d["out"] and d["stars"]
    assert jb["cancel"] == {"veh": "okada", "over": True, "vehGone": True, "onFoot": True, "cost": 0, "focus": "roam"} and jb["locked"]
    f = jb["focus"]  # while working: offers and lecture strips wait, one class warning, the first miss is excused
    assert f["idle"] == "roam" and f["offerIdle"] and f["kind"] == "job" and not f["offer"] and not f["strip"]
    assert f["warn1"] and not f["warn2"] and f["moment"] and f["excuse1"] and not f["excuse2"]
    cr = out["crowd"]  # the hour shows in the people
    a = cr["acts"]
    assert "queue" in a["13.2:food"] and a["13.2:mosque"] == ["pray"] and a["17.5:pitch"] == ["ball"] and "couple" in a["17.5:garden"]
    assert "chat" in a["20:social"] and a["23.5:market"] == ["sell"] and a["23.5:home"] == ["patrol"] and a["8:class"]
    assert cr["inside"] == 0 and cr["sitMoved"] == 0 and cr["trees"] == 0 and cr["rigs"] and cr["sunday"] and cr["night"]
    tc = out["touch"]  # two thumb sticks: left moves and sprints at the rim, right turns and tilts the camera
    assert tc["moved"] > 6 and tc["yaw"] > 1 and tc["pitch"] > .3 and tc["sprint"] and tc["walkOnly"] and tc["released"]
    assert all(out["cheats"].values()), out["cheats"]  # every default code matches by hash; old and wrong codes do not
    assert all(out["hero"].values()), out["hero"]  # hidden until the combo, locked until the code, then all the powers
    assert out["cheatFlags"] and out["picked"] and out["boards"] == {"closed": True, "open": True}


def test_cheat_codes_are_not_shipped_in_the_scripts():
    defaults = json.loads((Path(__file__).resolve().parents[1] / "cheat_defaults" / "samaru-days.json").read_text(encoding="utf-8"))
    shipped = "".join(p.read_text(encoding="utf-8").lower() for p in JS.glob("samaru*.js"))
    assert len(defaults["cheats"]) == 31 and len({c["typed"] for c in defaults["cheats"]}) == 31 and len({c["dial"] for c in defaults["cheats"]}) == 31
    for c in defaults["cheats"]:
        assert c["typed"].lower() not in shipped and c["dial"] not in shipped, c["id"]
        assert len(c["typed"]) >= 6 and c["dial"].count("*") == 2 and c["dial"].endswith("#")
    assert "code" not in defaults["hero"] and "iliyasu#1" not in shipped and "owambe" not in shipped and "*100#" not in shipped  # the hero's code lives only on the server



@pytest.mark.skipif(not shutil.which("node"), reason="node not installed")
def test_fast_ride_never_spawns_people_in_view_or_in_the_way():
    """Two minutes at 80 km/h round the campus: nobody appears in view, on the carriageway or in the car's path."""
    res = subprocess.run(["node", str(Path(__file__).with_name("samaru_soak.js")), str(JS), "ride", "2"], capture_output=True, text=True, timeout=600)
    out = json.loads(res.stdout.strip().splitlines()[-1])
    assert out["ok"], out.get("error")
    r = out["ride"]
    assert r["pedSpawns"] > 50 and r["carSpawns"] > 10
    assert r["pedInView"] == 0 and r["pedOnRoad"] == 0 and r["carInView"] == 0 and r["carInPath"] == 0, r
    assert r["pedInPath"] <= 2 and r["hits"] <= 3, r


@pytest.mark.skipif(not shutil.which("node"), reason="node not installed")
def test_soak_holds_its_invariants():
    """Eight simulated minutes of random play: no exceptions, no NaN, nobody moving while down, nobody in a wall, no stuck walker."""
    res = subprocess.run(["node", str(Path(__file__).with_name("samaru_soak.js")), str(JS), "soak", "8"], capture_output=True, text=True, timeout=900)
    out = json.loads(res.stdout.strip().splitlines()[-1])
    assert out["ok"], out.get("error")
    k = out["soak"]
    assert k["errors"] == [], k["errors"]
    mine = {name: v for name, v in k["problems"].items() if not name.startswith(("player cannot move", "player inside"))}
    assert mine == {}, mine


@pytest.mark.skipif(not shutil.which("node"), reason="node not installed")
def test_wardrobe_rules_and_room_field():
    res = subprocess.run(["node", str(Path(__file__).with_name("samaru_harness.js")), str(JS)], capture_output=True, text=True, timeout=600)
    w = json.loads(res.stdout.strip().splitlines()[-1])["wardrobe"]
    assert w["n"] >= 80 and w["brands"] == 10 and w["walkers"] == 200 and w["variety"] >= 8 and w["packLen"] <= 200
    bad = [k for k, v in w.items() if v is False]
    assert not bad, bad  # every item valid and modest, outfits survive save and network, shop and closet behave
    assert rooms.clean_state(dict(STATE, f="low,0,,,,kufi.0,,,,kaftan.1,,palms.0"))["f"] == "low,0,,,,kufi.0,,,,kaftan.1,,palms.0"
    assert rooms.clean_state(dict(STATE, f="<script>"))["f"] == "" and rooms.clean_state(dict(STATE, f="a" * 500))["f"] == "" and rooms.clean_state(STATE)["f"] == ""


@pytest.mark.skipif(not shutil.which("node"), reason="node not installed")
def test_every_vehicle_tracks_straight_slaloms_cleanly_and_recovers_from_a_handbrake_turn():
    """60 Hz handling runs: no wander or lean on a straight, one lean per slalom gate, handbrake turn and long slide both recover."""
    res = subprocess.run(["node", str(Path(__file__).with_name("samaru_drive.js")), str(JS)], capture_output=True, text=True, timeout=120)
    out = json.loads(res.stdout.strip().splitlines()[-1])
    for kind, r in out["veh"].items():
        assert r["lateral100m"] < 0.1 and r["straightHeadingDrift"] < 0.002 and r["straightLeanFlips"] == 0 and r["straightLeanPeak"] < 0.01, (kind, r)
        assert r["slalomLeanFlips"] <= r["slalomSteerFlips"] and r["slalomGrowth"] < 1.05 and r["slalomSlide"] < 1.5, (kind, r)  # grip holds without the handbrake
        if kind != "skate":  # a skateboard powerslides to a stop at about 80 degrees instead
            assert r["hbTurnTime"] is not None and r["hbTurnTime"] < 1.5 and r["hbRecover"] is not None and r["hbRecover"] < 1.5 and r["hbOverRotate"] < 0.35, (kind, r)
        assert r["driftTotalTurn"] < 2.6 and r["driftEndSlide"] < 0.3 and r["driftEndSpeed"] > 3, (kind, r)  # under 150 degrees: a slide, not a spin



@pytest.mark.skipif(not shutil.which("node"), reason="node not installed")
def test_living_city_incidents():
    """Thirty seeded minutes: small crimes happen at a sane rate, every one ends, nobody slides while down,
    nothing starts while you are on a job, and you can stop a thief yourself."""
    res = subprocess.run(["node", str(Path(__file__).with_name("samaru_soak.js")), str(JS), "city", "30"], capture_output=True, text=True, timeout=900)
    out = json.loads(res.stdout.strip().splitlines()[-1])
    assert out["ok"], out.get("error")
    c = out["city"]
    assert 4 <= c["total"] <= 30, c
    assert c["finished"] >= c["total"] - 1 and c["longest"] <= 120, c
    assert c["movedDown"] == 0 and c["busyStarts"] == 0, c
    assert c["rumours"] >= 1, c
    assert c["youCatch"]["result"] == "caught:you" and c["youCatch"]["paid"] > 0, c
