"""Offline packages (games/offline.py), syncing results played offline (api/sync/), the service worker that serves
saved games, and the Wi-Fi play codes (static/js/games/arcade-lan.js)."""
import json
import shutil
import subprocess
import uuid
from pathlib import Path

import pytest
from django.contrib.staticfiles import finders
from django.urls import reverse

from games import offline
from games.catalogue import GAMES
from games.models import ArcadeProfile, OfflineSubmission
from memos.tests.helpers import as_user, set_setting, world  # noqa: F401

ROOT = Path(__file__).resolve().parents[2]
PLAYABLE = [g.slug for g in GAMES if g.playable]


@pytest.mark.parametrize("slug", PLAYABLE)
def test_package_lists_every_file_the_game_needs(slug):
    pkg = offline.build(slug)
    urls = {f["u"] for f in pkg["files"]}
    game = next(g for g in GAMES if g.slug == slug)
    names = list(game.extra.get("deps", [])) + [s for s, _ in game.extra.get("packs", {}).values()] + [game.script]
    for n in names:  # every script the play page loads is in the package (or the one-file bundle replaces them)
        want = ("/%s.js" if "/" in n else "/js/games/%s.js") % n  # a dep with a slash is a full static path
        assert any(u.split("?")[0].endswith(want) or "fslg.bundle" in u for u in urls), n
    for rel in offline.COMMON:
        assert any(u.split("?")[0].endswith(rel) for u in urls), rel
    if game.extra.get("three"):
        assert any("three.module.min.js" in u for u in urls)
    for rel in offline.static_files(game):
        assert finders.find(rel), rel  # nothing listed that does not exist
    assert pkg["size"] > 0 and len(pkg["version"]) == 12
    assert pkg["sounds"]["ogg"] or pkg["sounds"]["m4a"]
    for f in pkg["sounds"]["ogg"] + pkg["sounds"]["m4a"]:
        assert finders.find(f["u"].split("/static/", 1)[1]), f["u"]


def test_version_changes_when_a_file_changes(tmp_path, settings):
    settings.DEBUG = True
    v1 = offline.build("light-bender")["version"]
    target = Path(finders.find("js/games/bender.js"))
    original = target.read_bytes()
    try:
        target.write_bytes(original + b"\n// changed\n")
        v2 = offline.build("light-bender")["version"]
    finally:
        target.write_bytes(original)
    assert v1 != v2
    assert offline.build("light-bender")["version"] == v1


def test_lan_only_where_multiplayer_exists():
    assert offline.build("samaru-days")["lan"] is True
    assert any("arcade-lan.js" in f["u"] for f in offline.build("samaru-days")["files"])
    assert offline.build("momentum-cup")["lan"] is False


@pytest.fixture
def on(world):
    set_setting("features.games", True)
    return world


def test_package_api_needs_a_player_and_returns_json(on, client):
    r = client.get(reverse("games:api_package", args=["light-bender"]))
    assert r.status_code in (302, 401, 403)
    c = as_user(on["student"], "student")
    r = c.get(reverse("games:api_package", args=["light-bender"]), HTTP_ACCEPT="application/json")
    assert r.status_code == 200 and r["Cache-Control"] == "no-store"
    j = r.json()
    assert j["slug"] == "light-bender" and j["page"] == reverse("games:play", args=["light-bender"])
    r = c.get(reverse("games:api_packages"), HTTP_ACCEPT="application/json")
    assert r.status_code == 200 and any(g["slug"] == "light-bender" for g in r.json()["games"])


def _result(cid, at_ms, game="light-bender"):
    return {"cid": cid, "kind": "result", "at": at_ms, "data": {"game": game, "result": "win", "stage": 1, "score": 120, "mode": "solo"}}


def test_sync_counts_each_offline_result_once(on):
    import time
    c = as_user(on["student"], "student")
    now = int(time.time() * 1000)
    a, b = "a" + uuid.uuid4().hex, "b" + uuid.uuid4().hex
    body = {"items": [_result(a, now - 120_000), _result(b, now - 60_000)]}
    r = c.post(reverse("games:api_sync"), json.dumps(body), content_type="application/json")
    assert r.status_code == 200, r.content
    j = r.json()
    assert sorted(j["done"]) == sorted([a, b]) and j["rejected"] == []
    coins = ArcadeProfile.objects.get(user=on["student"]).coins
    assert coins > 0 and j["me"]["coins"] == coins
    # the same items again (a retry after a dropped connection): reported done, not counted twice
    r = c.post(reverse("games:api_sync"), json.dumps(body), content_type="application/json")
    assert sorted(r.json()["done"]) == sorted([a, b])
    assert ArcadeProfile.objects.get(user=on["student"]).coins == coins
    assert OfflineSubmission.objects.filter(cid__in=[a, b]).count() == 2


def test_sync_rejects_bad_items_and_needs_sign_in(on, client):
    import time
    r = client.post(reverse("games:api_sync"), json.dumps({"items": []}), content_type="application/json")
    assert r.status_code == 401
    c = as_user(on["student"], "student")
    now = int(time.time() * 1000)
    c1, c2 = "c" + uuid.uuid4().hex, "d" + uuid.uuid4().hex
    body = {"items": [_result(c1, now - 30_000, game="no-such-game"), {"cid": c2, "kind": "buy", "at": now, "data": {}}, {"cid": "short"}]}
    j = c.post(reverse("games:api_sync"), json.dumps(body), content_type="application/json").json()
    assert {x["cid"] for x in j["rejected"]} == {c1, c2} and j["done"] == []
    assert c.post(reverse("games:api_sync"), "not json", content_type="application/json").status_code == 400


def test_play_page_renders_offline_and_wifi_controls(on):
    c = as_user(on["student"], "student")
    page = c.get(reverse("games:play", args=["samaru-days"]))
    if page.status_code == 200:
        assert b"data-gm-offline" in page.content and b"arcade-offline.js" in page.content and b"arcade-lan.js" in page.content
    other = c.get(reverse("games:play", args=["momentum-cup"]))
    assert other.status_code == 200 and b"arcade-offline.js" in other.content and b"arcade-lan.js" not in other.content


def test_lan_page_is_generic(on, client):
    r = client.get(reverse("games:lan"))
    assert r.status_code == 200
    assert b"BroadcastChannel" in r.content and b"ee-arcade-lan" in r.content


def test_service_worker_serves_saved_games_and_keeps_their_caches(on, client):
    r = client.get("/sw.js")
    assert r.status_code == 200
    assert r["Service-Worker-Allowed"] == "/"
    body = r.content.decode()
    assert 'var ARCADE = "ee-arcade-"' in body
    assert "k.indexOf(ARCADE) !== 0" in body          # an update never deletes a saved game
    assert "arcadeNavigation" in body and "arcadeStatic" in body
    assert 'event.tag === "ee-arcade-outbox"' in body


def test_play_page_template_offers_offline_and_wifi_play():
    t = (ROOT / "templates" / "games" / "play.html").read_text(encoding="utf-8")
    assert "data-gm-offline" in t and "arcade-offline.js" in t
    assert "data-gm-lan" in t and "arcade-lan.js" in t and "qrcode-generator@1.4.4" in t


@pytest.mark.skipif(not shutil.which("node") and not (Path.home() / ".nvm/versions/node/v24.22.2/bin/node").exists(), reason="node not installed")
def test_wifi_codes_round_trip_and_host_room():
    node = shutil.which("node") or str(Path.home() / ".nvm/versions/node/v24.22.2/bin/node")
    res = subprocess.run([node, str(Path(__file__).with_name("lan_harness.js"))], capture_output=True, text=True, timeout=60)
    out = json.loads(res.stdout.strip().splitlines()[-1])
    assert out["ok"], out.get("error")
    assert out["roundTrip"] and out["fromUrl"] and out["keeps"] and out["noTcp"] and out["answer"] and out["badRejected"]
    assert out["urlLen"] < 300  # fits a QR code a phone camera reads easily
    assert all(out["room"].values()), out["room"]


@pytest.mark.skipif(not shutil.which("node") and not (Path.home() / ".nvm/versions/node/v24.22.2/bin/node").exists(), reason="node not installed")
def test_service_worker_behaviour_offline_and_online():
    """static/sw.js run in Node with a fake Cache Storage and a network that can be switched off."""
    node = shutil.which("node") or str(Path.home() / ".nvm/versions/node/v24.22.2/bin/node")
    res = subprocess.run([node, str(Path(__file__).with_name("sw_harness.js"))], capture_output=True, text=True, timeout=60)
    o = json.loads(res.stdout.strip().splitlines()[-1])
    assert o["ok"], o.get("error")
    assert o["keptGames"] and o["droppedOld"]                       # a site update never deletes a saved game
    assert o["pageRefreshed"] and o["offlinePage"] == "<html>fresh page</html>"
    assert o["onlineSound"] == "saved:click" and o["soundSkippedNetwork"]   # saved files do not hit the server
    assert o["onlineHashed"] == "saved:hashed" and o["onlineVersioned"] == "saved:opticsim" and o["versionedSkippedNetwork"]
    assert o["onlinePlainCode"].startswith("net:") and o["offlinePlainCode"] == "saved:bender"
    assert o["offlineSound"] == "saved:click" and "offline" in o["unsavedGame"].lower()
    assert o["jsonUntouched"]


# ---------- every game is installable, and its package holds everything its page loads ----------
import re as _re

_PAGE_REF = _re.compile(r"""(?:src|href|data-gm-three)=["'](/static/[^"']+)["']""")


@pytest.fixture
def anylevel(on, monkeypatch):
    from games import views
    monkeypatch.setattr(views, "viewer", lambda request: ("staff", 500, ""))
    return on


@pytest.mark.parametrize("slug", PLAYABLE)
def test_page_never_refers_to_a_file_missing_from_its_package(anylevel, slug):
    """New scripts, pictures or sounds must be declared (catalogue deps, extra['assets'] or
    games/offline_assets/<slug>.txt) so the downloaded game still works offline."""
    c = as_user(anylevel["student"], "student")
    page = c.get(reverse("games:play", args=[slug]))
    assert page.status_code == 200, slug
    html = page.content.decode()
    pkg = offline.build(slug)
    have = {f["u"].split("?")[0] for f in pkg["files"]}
    refs = {u.split("?")[0] for u in _PAGE_REF.findall(html)}
    missing = sorted(refs - have)
    assert not missing, "%s: page loads files that are not in its offline package: %s" % (slug, missing)
    # and the page installs as this game
    assert reverse("games:game_manifest", args=[slug]) in html
    assert "img/games/%s-192" % slug in html


@pytest.mark.parametrize("slug", PLAYABLE)
def test_game_scripts_only_load_files_in_the_package(slug):
    """Static file names written into a game's own scripts (a picture or data file it fetches) must be in its package."""
    game = next(g for g in GAMES if g.slug == slug)
    have = {f["u"].split("?")[0] for f in offline.build(slug)["files"]}
    names = list(game.extra.get("deps", [])) + [s for s, _ in game.extra.get("packs", {}).values()] + [game.script]
    lit = _re.compile(r"""["'](?:/static/)?((?:img|data|audio|js|css|fonts|vendor)/[A-Za-z0-9_@./-]+\.(?:png|jpe?g|webp|svg|json|ogg|m4a|mp3|js|css|woff2|glb|gltf|txt))["']""")
    for n in names:
        p = finders.find("js/games/%s.js" % n)
        if not p:
            continue
        for rel in lit.findall(Path(p).read_text(encoding="utf-8", errors="ignore")):
            if rel.startswith(("audio/sfx/", "audio/voice/")):
                continue  # sounds come through the sound manifests, checked above
            assert any(h.endswith("/" + rel) for h in have), "%s loads %s, which is not in its offline package" % (n, rel)


@pytest.mark.parametrize("slug", PLAYABLE)
def test_every_game_has_icons_and_a_manifest(on, client, slug):
    from games import icons
    for size in icons.SIZES:
        for mk in (False, True):
            assert finders.find(icons.rel(slug, size, mk)), "run: python manage.py build_game_icons"
    r = client.get(reverse("games:game_manifest", args=[slug]))
    assert r.status_code == 200 and r["Content-Type"].startswith("application/manifest+json")
    m = r.json()
    page = reverse("games:play", args=[slug])
    assert m["start_url"].startswith(page) and m["scope"] == page and m["id"] == page
    assert m["display"] == "fullscreen" and 0 < len(m["short_name"]) <= 12
    assert {i["purpose"] for i in m["icons"]} == {"any", "maskable"} and {i["sizes"] for i in m["icons"]} == {"192x192", "512x512"}


def test_arcade_has_its_own_manifest(on, client):
    m = client.get(reverse("games:manifest_arcade")).json()
    assert m["start_url"].startswith(reverse("games:index")) and m["scope"] == reverse("games:index")


def test_declared_assets_are_packaged(tmp_path, monkeypatch, settings):
    from games import offline as off
    monkeypatch.setattr(off, "ASSET_DIR", tmp_path)
    (tmp_path / "light-bender.txt").write_text("# extras\nimg/games/\nimg/icons/icon-192.png\n", encoding="utf-8")
    game = next(g for g in GAMES if g.slug == "light-bender")
    rels = off.static_files(game)
    assert "img/icons/icon-192.png" in rels and "img/games/arcade-512.png" in rels


def test_fslg_bundle_used_only_when_fresh(tmp_path, monkeypatch, settings):
    """Production serves (and packages) the one-file bundle only while it is newer than every source file."""
    import os
    import time
    from games import bundle
    src = Path(finders.find("js/games/arcade.js")).parent
    for n in bundle.deps():
        if (src / (n + ".js")).exists():
            shutil.copy(src / (n + ".js"), tmp_path / (n + ".js"))
    bundle.build(tmp_path)
    assert bundle.fresh(tmp_path)
    later = time.time() + 5
    first = tmp_path / (bundle.deps()[0] + ".js")
    os.utime(first, (later, later))
    assert not bundle.fresh(tmp_path)  # a source edited after the build: the bundle is skipped
    # the offline package follows what the page loads
    settings.DEBUG = False
    game = next(g for g in GAMES if g.slug == "samaru-days")
    monkeypatch.setattr(bundle, "fresh", lambda directory=bundle.DIR: True)
    if (bundle.DIR / (bundle.NAME + ".js")).exists():
        rels = offline.static_files(game)
        assert "js/games/%s.js" % bundle.NAME in rels and "js/games/samaru-core.js" not in rels
    monkeypatch.setattr(bundle, "fresh", lambda directory=bundle.DIR: False)
    rels = offline.static_files(game)
    assert "js/games/samaru-core.js" in rels and "js/games/%s.js" % bundle.NAME not in rels
