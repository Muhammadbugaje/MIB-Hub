"""Freshers School Life: student life (creator choices, timetable, lecture scenes), driven headlessly."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

JS = Path(__file__).resolve().parents[2] / "static" / "js" / "games"


@pytest.mark.skipif(not shutil.which("node"), reason="node not installed")
def test_student_life():
    res = subprocess.run(["node", str(Path(__file__).with_name("samaru_life_harness.js")), str(JS)], capture_output=True, text=True, timeout=300)
    out = json.loads(res.stdout.strip().splitlines()[-1])
    assert out["ok"], out.get("error")
    assert not out["err"], out["err"]
    # creator: sex filters hostels, choices persist, the day starts in your hostel
    assert out["hostelsF"] and out["hostelsM"] and out["filterF"] and out["filterM"] and out["creatorHasRows"]
    assert out["created"] == {"sex": "f", "dept": "civil", "faith": "muslim", "acad": 100, "home": True} and out["persist"] and out["startsAtGate"]  # the rewritten Year 1 opens at the Main Gate
    # registration day: roommate, Senate, file, department; still 36 story missions
    assert out["m1"][0] == "go:gate" and "go:senate" in out["m1"] and "go:@dept" in out["m1"] and out["count"] == 120 and out["deptPlace"] and "Civil" in out["deptText"]
    # every department and level has a sane week: 2 to 4 lectures a weekday inside 08:00-18:00, none at weekends
    assert out["weekBad"] == 0 and out["minClasses"] >= 2 and out["maxClasses"] <= 4
    # a whole day in order, lecture scenes complete, then bed
    assert out["inOrder"] and out["allDone"] and out["hallShown"] and out["summary"] and out["attending"] and out["prayerToday"]
    assert out["att"] == out["classesToday"] == out["streak"] == out["asked"] and out["xpGained"] and out["statClasses"] == out["att"]
    assert out["nextIsSleep"] and out["followLeadsHome"] and out["newDay"]
    # nothing is forced; promotion follows the story; old saves load
    assert out["missed"] and out["promoted"] == 200 and out["newCourses"]
    assert out["migrated"] == {"sex": "f", "dept": "elect", "faith": "none", "acad": 100}


@pytest.mark.skipif(not shutil.which("node"), reason="node not installed")
def test_walk_in_interiors():
    res = subprocess.run(["node", str(Path(__file__).with_name("samaru_life_harness.js")), str(JS)], capture_output=True, text=True, timeout=300)
    out = json.loads(res.stdout.strip().splitlines()[-1])
    assert out["ok"], out.get("error")
    io = out["interior"]
    assert not io["err"] and not io.get("paintErr")
    # every kind of room exists somewhere on the map
    assert set(io["types"]) >= {"theatre", "lab", "hostel", "library", "canteen", "senate", "social", "shop"}
    # E at the door takes you in (no menu at the door); the room has its own walls for you and for the camera
    assert io["promptOutside"] and io["entered"] and io["noMenuAtDoor"] and io["farAway"] and io["walls"] and io["camWall"] and io["pedsCleared"]
    assert io["crowd"] >= 30 and io["seats"] >= 60
    # sit, the board lesson runs, raise your hand three times, marks, stand up, walk out to where you came in
    assert io["seatPrompt"].startswith("Sit in row") and io["sat"] and io["lecture"] and io["raisePrompt"] == "Raise your hand"
    assert io["asked"] == 3 and io["painted"] and io["summary"] and io["lectureDone"] and io["stoodUp"] and io["left"]
    # hostel room, saving inside, a collectible that pays once
    assert io["hostel"] and io["saveOutside"] and io["bedMenu"] and io["tokenOnce"]
    # library: shushed for running, hidden room opens
    assert io["secretShut"] and io["secretOpen"] and io["secretReach"] and io["shush"] and io["every"]
    # every room type three times in and out, and every way of getting stuck
    lp = io["loop"]
    assert lp["types"] >= 8 and lp["bad"] == []
    assert lp["midStarted"] and lp["midLeft"] and lp["midOut"] and lp["selfEnds"] and lp["selfFree"]
    assert lp["teleport"] and lp["stranded"] and lp["oob"] and lp["unwedged"] and lp["pockets"] == 0 and lp["checked"] > 5000
    assert io["skin"]["n"] == 6 and io["skin"]["applied"] and io["skin"]["oldKeeps"]


@pytest.mark.skipif(not shutil.which("node"), reason="node not installed")
def test_mall_arcade_club_store_sickbay():
    res = subprocess.run(["node", str(Path(__file__).with_name("samaru_life_harness.js")), str(JS)], capture_output=True, text=True, timeout=300)
    out = json.loads(res.stdout.strip().splitlines()[-1])
    assert out["ok"], out.get("error")
    ml = out["interior"]["mall"]
    assert not ml["err"] and ml["type"] == "mall" and ml["stores"] == ml["have"]
    # two levels joined by the stairs; the gallery edge is walled off
    assert ml["ground"] and ml["galleryWalled"] and ml["climbed"]
    if not ml.get("noBooks"):
        assert ml["storePrompt"].endswith("counter") and ml["booksMenu"] and ml["boost"] and ml["rescue"]
    assert ml.get("wardrobe", True)
    # arcade: cabinets open mini-games, spectators gather, the door leads back to the mall
    assert ml["arcade"] and ml["cabLabel"] == "Play Snake" and ml["cabOpened"] and ml["spectators"] and ml["backToMall"]
    # club rhythm game
    assert ml["dancePrompt"].startswith("Dance") and ml["danceOn"] and ml["danceHits"] >= ml["danceNotes"] - 1 and ml["danceStayed"]
    assert ml["danceDone"] and ml["danceMiss"] and ml["danceCap"]
    # MIB Store and Sick Bay
    assert ml["caseShut"] and ml["caseHero"]
    assert ml["wake"] and ml["gotUp"] and ml["reception"] and ml["admit"] and ml["outAtSickbay"]
    # opening hours: halls lock at night, shops and the library stay open, a tutorial opens its door
    hr = ml["hours"]
    assert hr["dayOpen"] and hr["nightShut"] and hr["opens"] == "07:30" and hr["prompt"].startswith("Locked") and hr["refused"]
    assert hr["mallLate"] and hr["libPass"] and hr["libShut"]
    assert hr["tut"] and hr["started"] and hr["card"] and hr["done"]
    # MIB Store stock: passes, a delivered ride, the custom shirt; story items are labelled as such
    st = ml["stock"]
    assert st["pass"] and st["ride"] and st["noDouble"] and st["shirt"] and st["shirtOff"] and st["later"] and st["menu"] and st["spent"]
