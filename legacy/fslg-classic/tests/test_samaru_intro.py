"""The opening film: plays through every beat, carries the bags, uses m1's room choice, hands control back with m1
moved on; SKIP works before and after the choice; old saves never get it; a replay leaves the save unchanged."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

JS = Path(__file__).resolve().parents[2] / "static" / "js" / "games"


@pytest.mark.skipif(not shutil.which("node"), reason="node not installed")
def test_opening_film():
    res = subprocess.run(["node", str(Path(__file__).with_name("samaru_intro_harness.js")), str(JS)], capture_output=True, text=True, timeout=600)
    out = json.loads(res.stdout.strip().splitlines()[-1])
    assert out["ok"], out.get("error")
    assert not out["autoWithout3d"]  # the flat map view starts at the gate
    f = out["film"]
    assert f["phases"] == ["aerial", "arrive", "freshers", "brief", "logo", "hand"]
    assert f["captions"] == 7 and f["briefShots"] >= 12 and f["cards"] >= 8 and f["logoSeen"] and f["subtitles"] >= 15
    assert f["narration"] == sorted(["legend", "stories", "vehicles", "fly", "security", "friends", "welcome"])
    assert f["noTemps"] and f["timeBack"]
    assert f["roomSeen"] and f["bagsByBed"] and f["outsideAfter"]  # the porter sets the bags down by the bed, then the goodbye is outside
    assert all(out["skipDialog"].values()), out["skipDialog"]
    assert f["beats"] == [0, 1, 2, 3, 4, 5, 6] and f["ended"] and f["chose"] and f["introDone"] and f["control"]
    assert f["roomie"] == "sadiq" and f["home"] == "suleiman" and f["nearHome"] and f["m1Step"] == "m1:emote"
    assert all(f["carried"].values()) and f["hugged"] and f["waved"]
    assert f["carGone"] and f["parentsGone"] and f["camFree"]
    se = out["skipEarly"]  # skipping before the room choice asks it, then lands where watching does (MASTER_GAME_GUIDE §6.4)
    assert se["askedTheRoomFirst"] and se["off"] and se["sameEndStateAsWatching"] and se["timeRestored"] and se["noCar"], se
    assert out["meta"] and out["watchdog"]
    assert out["skipLate"]["off"] and out["skipLate"]["nearHome"]
    assert out["oldWanted"] is False and out["replay"] == {"ended": True, "unchanged": True}
