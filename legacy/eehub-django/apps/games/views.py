import json
from datetime import timedelta
from functools import wraps

from django.contrib.auth.hashers import check_password, make_password
from django.core.cache import cache
from django.http import Http404, JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

from django.conf import settings

from . import bundle
from . import cheats as C
from . import progress as P
from .access import GUEST_SESSION, can_play, current_guest, viewer
from .catalogue import BY_SLUG, GAMES, LEVELS
from .models import GuestPlayer


def _setting(key, default):
    try:
        import config
        return config.get(key, default)
    except Exception:
        return default


def player_required(view):
    """A signed-in account, or an unexpired guest session. Guests are sent to the guest sign-in page."""
    @wraps(view)
    def wrapped(request, *a, **k):
        if not request.user.is_authenticated:
            g = current_guest(request)
            if g is None:
                return redirect(reverse("games:guest") + "?next=" + request.path)
            request.arcade_guest = g
        return view(request, *a, **k)
    return wrapped


def _profile(request):
    g = getattr(request, "arcade_guest", None)
    return P.profile_for(guest=g) if g else P.profile_for(user=request.user)


def _ctx(request, **extra):
    guest = getattr(request, "arcade_guest", None)
    extra.update(base_template="games/base_guest.html" if guest else "games/base_app.html", guest=guest)
    return extra


def _app(game):
    """Head tags that make a page install as its own app: one per game, one for the whole arcade."""
    from django.templatetags.static import static
    from . import icons
    slug = game.slug if game else "arcade"
    return {"app_manifest": reverse("games:game_manifest", args=[slug]) if game else reverse("games:manifest_arcade"),
            "app_icon": static(icons.rel(slug, 192)), "app_title": (game.title if game else "EE Arcade")[:30]}


@player_required
def index(request):
    kind, max_level, note = viewer(request)
    shelves = []
    manager = C.can_manage(request.user)
    off = {g.slug for g in GAMES if g.playable and not C.game_enabled(g.slug)}  # switched off in Game Settings
    for lv in LEVELS:
        games = [g for g in GAMES if g.level == lv]
        if games:
            shelves.append({"level": lv, "open": bool(max_level and lv <= max_level),
                            "games": [{"g": g, "ok": can_play(g, max_level) and (g.slug not in off or manager)} for g in games]})
    prof = _profile(request)
    playable = [g for g in GAMES if g.playable and (g.slug not in off or manager)]
    boards = [{"g": g, "rows": P.leaderboard(g.slug, 5, me=prof), "mine": P.my_rank(g.slug, prof)} for g in playable]
    return render(request, "games/index.html", _ctx(request, **_app(None), can_manage_games=manager, shelves=shelves, max_level=max_level, note=note, kind=kind,
                                                    playable=playable, boards=boards, me=P.as_dict(prof), my_profile_id=prof.pk))


@player_required
def leaderboard(request):
    prof = _profile(request)
    playable = [g for g in GAMES if g.playable]
    week = request.GET.get("period") == "week"
    boards = [{"g": g, "rows": P.leaderboard(g.slug, 20, week=week, me=prof), "mine": P.my_rank(g.slug, prof)} for g in playable]
    return render(request, "games/leaderboard.html", _ctx(request, boards=boards, week=week, xp=P.xp_board(25, me=prof),
                                                          me=P.as_dict(prof)))


@player_required
def play(request, slug):
    game = BY_SLUG.get(slug)
    if game is None or not game.playable:
        raise Http404("No such game")
    if not C.game_enabled(slug) and not C.can_manage(request.user):
        raise Http404("This game is switched off")
    kind, max_level, note = viewer(request)
    if not can_play(game, max_level):
        return render(request, "games/locked.html", _ctx(request, game=game, max_level=max_level, note=note), status=403)
    if slug == "samaru-days":  # its name comes from the game config (games/fslg_admin.py, MASTER_GAME_GUIDE §5)
        import dataclasses
        from . import fslg_admin
        game = dataclasses.replace(game, title=fslg_admin.game_title())
    deps = bundle.scripts(game, settings.DEBUG)
    packs, locked = [], []
    for lv, (script, title) in sorted(game.extra.get("packs", {}).items()):
        (packs if max_level and lv <= max_level else locked).append({"level": lv, "script": script, "name": title})
    return render(request, "games/play.html", _ctx(request, **_app(game), can_manage_games=C.can_manage(request.user), game=game, kind=kind, note=note, scripts=deps + [p["script"] for p in packs],
                                                   config_json=json.dumps(C.page_config(slug, request), separators=(",", ":")),
                                                   locked_json=json.dumps([{"level": p["level"], "name": p["name"]} for p in locked])))


# ---------- guests: players from outside the department ----------
def _guest_days():
    return int(_setting("games.guest_days", 365) or 365)


def _too_many(request):
    key = "arcade-guest-fail:" + (request.META.get("REMOTE_ADDR") or "?")
    return (cache.get(key) or 0) >= 10, key


def guest(request):
    if request.user.is_authenticated:
        return redirect("games:index")
    if not _setting("games.guests_enabled", True):
        return render(request, "games/guest.html", {"closed": True})
    nxt = request.GET.get("next") or request.POST.get("next") or reverse("games:index")
    if not nxt.startswith("/arcade/"):
        nxt = reverse("games:index")
    ctx = {"next": nxt, "days": _guest_days(), "form": {}}
    if request.method == "POST":
        mode = request.POST.get("mode")
        name = " ".join((request.POST.get("name") or "").split())[:40]
        reg = " ".join((request.POST.get("reg_number") or "").split())[:30]
        pin = (request.POST.get("pin") or "").strip()
        ctx["form"] = {"name": name, "reg_number": reg, "mode": mode}
        blocked, key = _too_many(request)
        errors = []
        if blocked:
            errors.append("Too many attempts. Wait 15 minutes and try again.")
        elif len(name) < 2 or len(reg) < 3:
            errors.append("Enter your name and your registration number.")
        elif not (pin.isdigit() and 4 <= len(pin) <= 6):
            errors.append("Your PIN must be 4 to 6 digits.")
        if not errors:
            probe = GuestPlayer(name=name, reg_number=reg)
            probe.name_key = " ".join(name.lower().split())
            probe.reg_key = "".join(reg.upper().split())
            existing = GuestPlayer.objects.filter(name_key=probe.name_key, reg_key=probe.reg_key).first()
            if existing and existing.expires_at <= timezone.now():
                existing.delete()
                existing = None
            if mode == "new":
                if existing:
                    errors.append("That name and reg. number already have a player. Use 'I've played before'.")
                elif pin != (request.POST.get("pin2") or "").strip():
                    errors.append("The two PINs don't match.")
                else:
                    g = GuestPlayer(name=name, reg_number=reg, pin_hash=make_password(pin),
                                    expires_at=timezone.now() + timedelta(days=_guest_days()))
                    g.save()
                    request.session[GUEST_SESSION] = g.pk
                    return redirect(nxt)
            else:
                if existing and check_password(pin, existing.pin_hash):
                    existing.save(update_fields=["last_seen"])
                    request.session[GUEST_SESSION] = existing.pk
                    cache.delete(key)
                    return redirect(nxt)
                errors.append("We couldn't find that player. Check your name, reg. number and PIN.")
                cache.set(key, (cache.get(key) or 0) + 1, 15 * 60)
        ctx["errors"] = errors
    return render(request, "games/guest.html", ctx)


@require_POST
def guest_signout(request):
    request.session.pop(GUEST_SESSION, None)
    return redirect("games:guest")


# ---------- progression API (JSON, same-origin, CSRF-protected) ----------
def _body(request):
    if len(request.body) > 2048:
        raise P.Rejected("Request too large.")
    try:
        data = json.loads(request.body or b"{}")
    except ValueError:
        raise P.Rejected("Bad JSON.")
    if not isinstance(data, dict):
        raise P.Rejected("Bad JSON.")
    return data


def _api(fn):
    @wraps(fn)
    def wrapped(request, *a, **k):
        if not request.user.is_authenticated:
            g = current_guest(request)
            if g is None:
                return JsonResponse({"error": "Sign in to save progress."}, status=401)
            request.arcade_guest = g
        try:
            return JsonResponse(fn(request, *a, **k))
        except P.Rejected as e:
            return JsonResponse({"error": str(e)}, status=400)
    return wrapped


@require_GET
@_api
def api_me(request):
    return P.as_dict(_profile(request))


@require_POST
@_api
def api_result(request):
    data = _body(request)
    game = BY_SLUG.get(str(data.get("game", "")))
    _, max_level, _ = viewer(request)
    if game is None or not can_play(game, max_level):
        raise P.Rejected("This game is not open to you.")
    if not C.game_enabled(game.slug) and not C.can_manage(request.user):
        raise P.Rejected("This game is switched off.")
    return P.record(_profile(request), data, max_level=max_level)


@require_POST
@_api
def api_buy(request):
    return P.buy(_profile(request), str(_body(request).get("item", "")))


@require_POST
@_api
def api_equip(request):
    return P.equip(_profile(request), str(_body(request).get("item", "")))


@require_POST
@_api
def api_privacy(request):
    prof = _profile(request)
    prof.on_leaderboard = bool(_body(request).get("on_leaderboard"))
    prof.save(update_fields=["on_leaderboard", "updated"])
    return P.as_dict(prof)


@require_POST
@_api
def api_room(request):
    """Freshers School Life same-network multiplayer relay (games/rooms.py). Open to anyone who may play the game."""
    from . import rooms
    if len(request.body) > 4096:
        raise P.Rejected("Request too large.")
    try:
        data = json.loads(request.body or b"{}")
    except ValueError:
        raise P.Rejected("Bad JSON.")
    if not isinstance(data, dict):
        raise P.Rejected("Bad JSON.")
    _, max_level, _ = viewer(request)
    if not can_play(BY_SLUG["samaru-days"], max_level):
        raise P.Rejected("This game is not open to you.")
    return rooms.sync(_profile(request).pk, data)


HERO_TRIES, HERO_WINDOW = 8, 10 * 60


@require_POST
@_api
def api_hero(request):
    """Check the secret character's code for one game. The code itself never leaves the server; wrong guesses are
    limited to HERO_TRIES per player and per address every ten minutes."""
    data = _body(request)
    slug = str(data.get("slug", ""))
    game = BY_SLUG.get(slug)
    _, max_level, _ = viewer(request)
    if game is None or not can_play(game, max_level):
        raise P.Rejected("This game is not open to you.")
    keys = ["arcade-hero:p%s" % _profile(request).pk, "arcade-hero:ip" + (request.META.get("REMOTE_ADDR") or "?")]
    if any((cache.get(k) or 0) >= HERO_TRIES for k in keys):
        return {"ok": False, "wait": True, "error": "Too many tries. Wait ten minutes."}
    if C.check_hero(slug, str(data.get("code", ""))[:80], request):
        for k in keys:
            cache.delete(k)
        return {"ok": True, "name": C.defaults(slug)["hero"]["name"]}
    for k in keys:
        cache.set(k, (cache.get(k) or 0) + 1, HERO_WINDOW)
    return {"ok": False}


# ---------- offline packages and syncing results played offline (games/offline.py, static/sw.js) ----------
SYNC_MAX_ITEMS = 40          # one request
SYNC_DAILY_CAP = 60          # offline results accepted per player per day
SYNC_MAX_AGE_S = 14 * 86400  # older results are not counted


@player_required
@require_GET
def api_package(request, slug):
    """What a browser must download to play `slug` offline (files, sizes, version)."""
    from . import offline
    game = BY_SLUG.get(slug)
    if game is None or not game.playable:
        raise Http404("No such game")
    _, max_level, _ = viewer(request)
    if not can_play(game, max_level) or (not C.game_enabled(slug) and not C.can_manage(request.user)):
        return JsonResponse({"error": "This game is not open to you."}, status=403)
    resp = JsonResponse(offline.package(slug))
    resp["Cache-Control"] = "no-store"
    return resp


@player_required
@require_GET
def api_packages(request):
    """Every game this player can download, with sizes (the arcade's "Download all games")."""
    from . import offline
    _, max_level, _ = viewer(request)
    manager = C.can_manage(request.user)
    ok = {g.slug for g in GAMES if g.playable and can_play(g, max_level) and (C.game_enabled(g.slug) or manager)}
    resp = JsonResponse({"games": offline.all_packages(ok)})
    resp["Cache-Control"] = "no-store"
    return resp


@require_GET
def lan_page(request):
    """A tiny page the phone camera opens from a pairing QR code. It hands the code to the game running in the other
    tab (BroadcastChannel) or shows it for copying. Generic, never personal: the service worker keeps a copy."""
    from . import fslg_admin
    return render(request, "games/lan.html", {"game_name": fslg_admin.game_title()})


def _played_at(v, now):
    try:
        t = float(v) / 1000.0
    except (TypeError, ValueError):
        return now
    return now if not (now - SYNC_MAX_AGE_S <= t <= now + 60) else min(t, now)


@require_POST
@_api
def api_sync(request):
    """Results played offline, sent in one batch when the device is back online. Each item:
    {"cid": client id, "kind": "result", "at": ms timestamp, "data": the same payload as api/result/}.
    Returns {"done": [cid...], "rejected": [{"cid", "error"}], "me": profile}. Items already seen are "done"."""
    import time as _time
    from datetime import datetime, timezone as _tz
    from .models import OfflineSubmission
    if len(request.body) > 96 * 1024:
        raise P.Rejected("Request too large.")
    try:
        data = json.loads(request.body or b"{}")
    except ValueError:
        raise P.Rejected("Bad JSON.")
    items = data.get("items") if isinstance(data, dict) else None
    if not isinstance(items, list):
        raise P.Rejected("Bad JSON.")
    prof = _profile(request)
    _, max_level, _ = viewer(request)
    now = _time.time()
    cap_key = "arcade-sync:%s:%s" % (prof.pk, int(now // 86400))
    used = cache.get(cap_key) or 0
    done, rejected = [], []
    clean = []
    for it in items[:SYNC_MAX_ITEMS]:
        if not isinstance(it, dict):
            continue
        cid = "".join(ch for ch in str(it.get("cid", "")) if ch.isalnum() or ch in "-_")[:40]
        if len(cid) < 8:
            continue
        clean.append((_played_at(it.get("at"), now), cid, it))
    clean.sort()  # oldest first, so the 15-second rule between results of one game holds
    seen = set(OfflineSubmission.objects.filter(cid__in=[c for _, c, _ in clean]).values_list("cid", flat=True))
    for at, cid, it in clean:
        if cid in seen:
            done.append(cid)
            continue
        payload = it.get("data") if isinstance(it.get("data"), dict) else {}
        game = BY_SLUG.get(str(payload.get("game", "")))
        err = ""
        if it.get("kind") != "result":
            err = "Unknown item."
        elif game is None or not can_play(game, max_level):
            err = "This game is not open to you."
        elif not C.game_enabled(game.slug) and not C.can_manage(request.user):
            err = "This game is switched off."
        elif used >= SYNC_DAILY_CAP:
            err = "Too many offline results today; the rest were not counted."
        if not err:
            try:
                P.record(prof, payload, now=at, max_level=max_level)
                used += 1
            except P.Rejected as e:
                err = str(e)
        OfflineSubmission.objects.get_or_create(cid=cid, defaults={
            "profile": prof, "game": (game.slug if game else "")[:40], "ok": not err, "note": err[:200],
            "played_at": datetime.fromtimestamp(at, tz=_tz.utc)})
        (rejected.append({"cid": cid, "error": err}) if err else done.append(cid))
        seen.add(cid)
    cache.set(cap_key, used, 86400)
    prof.refresh_from_db()
    return {"done": done, "rejected": rejected, "me": P.as_dict(prof)}


@require_GET
def manifest_view(request, slug=None):
    """Web app manifest for one game (installs that game; opens full screen on its own page) or, without a slug, for
    the whole arcade. Public and generic, as browsers fetch manifests without the player's cookies."""
    from django.templatetags.static import static
    from . import icons
    if slug:
        game = BY_SLUG.get(slug)
        if game is None or not game.playable:
            raise Http404("No such game")
        start, title, short, colour = reverse("games:play", args=[slug]), game.title, game.title, game.accent
        desc, display = game.pitch, "fullscreen"
    else:
        slug, start, title, short, colour = "arcade", reverse("games:index"), "EE Hub Learning Arcade", "EE Arcade", icons.ARCADE[2]
        desc, display = "Physics and engineering games from the Department of Electrical Engineering, ABU Zaria.", "standalone"
    # home-screen labels show about 12 characters: the full title when it fits, else its first word
    if slug == "samaru-days":  # name and home-screen label from the game config (games/fslg_admin.py)
        from . import fslg_admin
        title, short = fslg_admin.game_title(), fslg_admin.short_name()
    short = short if len(short) <= 12 else short.split()[0].rstrip(":")[:12]

    def png(size, mk):
        return {"src": static(icons.rel(slug, size, mk)), "sizes": "%dx%d" % (size, size), "type": "image/png", "purpose": "maskable" if mk else "any"}
    resp = JsonResponse({
        "id": start, "name": title, "short_name": short, "description": desc[:300],
        "start_url": start + "?source=homescreen", "scope": start, "display": display,
        "display_override": [display, "standalone", "minimal-ui"], "orientation": "any",
        "background_color": "#070b09", "theme_color": colour, "lang": "en-GB", "categories": ["games", "education"],
        "icons": [png(192, False), png(512, False), png(192, True), png(512, True)],
    }, content_type="application/manifest+json")
    resp["Cache-Control"] = "public, max-age=3600"
    return resp
