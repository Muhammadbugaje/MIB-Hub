"""Freshers School Life: the in-world phone, texts, money from home and the Pockets inventory, driven headlessly."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

JS = Path(__file__).resolve().parents[2] / "static" / "js" / "games"
HERE = Path(__file__).resolve().parent


@pytest.fixture(scope="module")
def out():
    if not shutil.which("node"):
        pytest.skip("node not installed")
    res = subprocess.run(["node", str(HERE / "samaru_phone_inv_harness.js"), str(JS)], capture_output=True, text=True, timeout=600)
    data = json.loads(res.stdout.strip().splitlines()[-1])
    assert data["ok"], data.get("error")
    assert data["errs"] == []
    return data


def test_pockets_stack_fill_and_grow(out):
    inv = out["inv"]
    assert inv["kit"] == {"edrink": 2, "water": 2, "puffpuff": 1, "bread": 1} and inv["kitSlots"] == 4 and inv["cap"] == 15
    assert inv["added"] == 10 and inv["stacks"] == [8, 3] and inv["stackMax"] == 8
    assert inv["fullNow"] and inv["fitsMore"] == 0 and inv["addFull"] == 0 and inv["fullToast"] and inv["woodCount"] == 0
    assert inv["capL5"] == 17 and inv["capL21"] == 25 and inv["bag"] and inv["capBag"] == 30 and inv["capMax"] == 30


def test_eat_drop_pick_up_move_split(out):
    inv = out["inv"]
    assert inv["ate"] and inv["hunger"] == 38 and inv["energyAfterPuff"] == 36 and inv["eatPose"] and inv["puffLeft"] == 1
    assert inv["energyDrink"] == 65 and inv["cementNotEdible"]
    assert inv["panelShowsEat"] and inv["panelAte"] and inv["panelGrid"] >= 15
    assert inv["split"] and inv["moved"] and inv["merged"]
    assert inv["dropped"] and inv["notStraightBack"] and inv["pickedUp"] and inv["despawned"]


def test_quest_items_api_and_story_writes(out):
    inv = out["inv"]
    assert inv["questNotSlotted"] and inv["questNoDrop"] and inv["questAlwaysAdds"]
    assert inv["storyWrite"] and all(inv["api"].values())


def test_gifts_follow_likes(out):
    g = out["inv"]["gift"]
    assert g["liked"] == 15 and g["plain"] == 7 and g["odd"] == 1 and g["likedMore"] and g["rose"] and g["used"] and g["nearby"]
    assert out["inv"]["giftList"] and out["inv"]["giftByPanel"]


def test_shops_save_and_migration(out):
    inv = out["inv"]
    assert inv["shopBought"] and inv["packAtFood"]
    assert inv["saved"] and inv["migrated"] and inv["kitOnce"]


def test_pocket_lesson_and_nudge(out):
    t = out["tut"]
    assert t["waits"] and t["started"] and t["text"] and t["afterOpen"] and t["afterEat"] and t["ahead"] and t["done"]
    assert t["waitsForIntro"] and t["noPhoneInIntro"] and t["nudge"]


def test_phone_apps_keep_every_old_feature(out):
    ph = out["phone"]
    assert ph["opens"] and ph["pose"] and ph["home"] and ph["backHome"] and ph["putAway"]
    for app in ["goals", "map", "jobs", "contacts", "messages", "friends", "bank", "dial", "camera", "radio", "net", "pockets", "life", "mini", "me", "settings", "help", "quit"]:
        assert app in ph["apps"], app
    assert all(ph["views"].values()), ph["views"]
    assert ph["goalsByLabel"] and ph["mapOpens"] and ph["pocketsOpen"] and ph["help"] and ph["helpBack"]
    assert ph["dialCash"] and ph["dialWrong"]  # service codes work exactly as before
    assert ph["callRow"] and ph["called"] and ph["jobRows"] >= 1 and ph["tookJob"] and ph["outfit"]


def test_phone_on_a_vehicle_is_hands_free_and_slow_only(out):
    ph = out["phone"]
    assert ph["onBike"] and ph["fastBlocked"] and ph["slowOpens"] and ph["noPoseOnBike"] and ph["closesWhenFast"]


def test_texts_are_seeded_and_replies_matter(out):
    tx = out["texts"]
    assert tx["det"] and tx["whoVaries"] and tx["scheduled"]
    assert tx["unread"] and tx["replyUp"] and tx["answered"] and tx["replyDown"] and tx["noDoubleReply"]
    assert tx["threadRow"] and tx["threadView"] and tx["quickReplies"] and tx["repliedByTap"]


def test_money_from_home_has_a_cooldown_and_limits(out):
    mo = out["money"]
    assert mo["first"] and mo["cooldown"] and mo["deterministic"] and mo["termHelps"] and mo["amountSane"]
    if mo["firstYes"]:
        assert mo["pending"] and mo["notYet"] and mo["credited"]
    assert mo["oddsFall"] and mo["oddsLater"] < mo["odds0"] and mo["asked"] <= 6 and mo["notAlwaysYes"]
    assert mo["bankRows"] and mo["whoView"]


def test_snatch_takes_the_phone_and_it_comes_back(out):
    sn = out["snatch"]
    assert sn["warned"] and sn["started"] and sn["taken"] and sn["cantOpen"] and sn["thiefHasIt"]
    assert sn["recovered"] and sn["worksAgain"]
    assert sn["started2"] and sn["taken2"] and sn["escaped"] and sn["reportRow"] and sn["reported"] and sn["foundLater"]
    assert sn["noneOnMission"] and sn["cooldown"] and sn["rare"] and 0 < sn["chanceNight"] < 0.02 and sn["chanceNoon"] < sn["chanceNight"]
    assert sn["friendRow"] and sn["friendReport"] and sn["pedPhones"]


def test_scripts_are_listed_for_offline_and_the_bundle():
    from games.catalogue import BY_SLUG
    deps = BY_SLUG["samaru-days"].extra["deps"]
    for name in ("samaru-inv", "samaru-phone", "samaru-texts"):
        assert name in deps and (JS / (name + ".js")).exists()
    assert deps.index("samaru-ui") < deps.index("samaru-inv") < deps.index("samaru-phone") < deps.index("samaru-texts")
