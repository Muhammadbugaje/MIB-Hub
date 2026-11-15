"""Guest players from other departments, the public link and the real leaderboard page."""
import json
from datetime import timedelta

import pytest
from django.core.management import call_command
from django.test import Client
from django.urls import reverse
from django.utils import timezone

from games import progress as P
from games.models import ArcadeProfile, GuestPlayer
from memos.tests.helpers import as_user, set_setting, world  # noqa: F401


@pytest.fixture
def on(world):
    set_setting("features.games", True)
    return world


def join(c, name="Amina Bello", reg="U22ME1001", pin="4821", mode="new"):
    return c.post(reverse("games:guest"), {"mode": mode, "name": name, "reg_number": reg, "pin": pin, "pin2": pin})


def test_guest_signup_play_and_return(on):
    c = Client()
    assert c.get(reverse("games:index")).status_code == 302  # anonymous → guest page
    r = join(c)
    assert r.status_code == 302 and r["Location"] == reverse("games:index")
    g = GuestPlayer.objects.get()
    assert g.pin_hash != "4821" and g.expires_at > timezone.now() + timedelta(days=300)
    page = c.get(reverse("games:index"))
    assert page.status_code == 200 and b"Playing as" in page.content and b"Amina Bello" in page.content
    assert c.get(reverse("games:play", args=["momentum-cup"])).status_code == 200
    forge = c.get(reverse("games:play", args=["circuit-forge"])).content.decode()
    assert "circuit-200" not in forge  # guests get the 100-level chapter only
    res = c.post(reverse("games:api_result"), json.dumps({"game": "light-bender", "result": "win", "stage": 1, "score": 320}), content_type="application/json")
    assert res.status_code == 200 and res.json()["coins"] > 0
    c.post(reverse("games:guest_signout"))
    assert c.get(reverse("games:index")).status_code == 302
    c2 = Client()
    assert join(c2, pin="0000", mode="return").status_code == 200  # wrong PIN
    assert join(c2, name="  amina   bello ", reg="u22me 1001", mode="return").status_code == 302  # forgiving match
    assert c2.get(reverse("games:api_me")).json()["coins"] == res.json()["coins"]


def test_guest_duplicate_and_bad_input(on):
    c = Client()
    join(c)
    r = join(Client())
    assert b"already have a player" in r.content
    assert b"4 to 6 digits" in join(Client(), name="Zed", reg="ABC1", pin="12").content


def test_guest_lockout_after_failed_attempts(on):
    from django.core.cache import cache
    cache.clear()
    c = Client()
    for _ in range(10):
        join(c, pin="9999", mode="return")
    assert b"Too many attempts" in join(c, mode="return").content


def test_guests_blocked_from_higher_levels_and_when_disabled(on):
    c = Client()
    join(c)
    r = c.post(reverse("games:api_result"), json.dumps({"game": "circuit-forge", "result": "win", "stage": 6}), content_type="application/json")
    assert r.status_code == 400
    set_setting("games.guests_enabled", False)
    assert b"switched off" in Client().get(reverse("games:guest")).content


def test_expired_guests_are_purged_and_cannot_play(on):
    c = Client()
    join(c)
    GuestPlayer.objects.update(expires_at=timezone.now() - timedelta(days=1))
    assert c.get(reverse("games:index")).status_code == 302
    call_command("purge_arcade_guests")
    assert not GuestPlayer.objects.exists() and not ArcadeProfile.objects.filter(guest__isnull=False).exists()


def test_leaderboard_is_real_and_mixed(on):
    stu = on["student"]
    P.record(stu, {"game": "volt-city", "result": "win", "stage": 1, "score": 300}, now=1.0)
    c = Client()
    join(c, name="Musa Danjuma Ali")
    c.post(reverse("games:api_result"), json.dumps({"game": "volt-city", "result": "win", "stage": 1, "score": 450}), content_type="application/json")
    rows = P.leaderboard("volt-city")
    assert [r["score"] for r in rows] == [450, 300] and rows[0]["guest"] and rows[0]["name"] == "Musa A."
    assert P.leaderboard("volt-city", week=True)[0]["score"] == 450
    page = as_user(stu, "student").get(reverse("games:leaderboard")).content.decode()
    assert "Musa A." in page and "guest" in page and "450" in page
    assert P.my_rank("volt-city", P.profile_for(user=stu)) == {"rank": 2, "score": 300}


def test_public_menu_link_follows_the_switch(world):
    page = Client().get("/").content.decode()
    assert "/arcade/guest/" not in page
    set_setting("features.games", True)
    assert "/arcade/guest/" in Client().get("/").content.decode()
