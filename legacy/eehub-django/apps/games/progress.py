"""Arcade progression rules, all server-side: the browser reports what happened in a match; this module decides
the coins, XP, badges and leaderboard entry, with caps and a per-game cooldown. Casual, not cheat-proof: a
determined player could still forge a "win" report, so rewards are small and purely cosmetic (no real money)."""
import math
import time

from django.db import transaction

from .catalogue import BY_SLUG
from .models import ArcadeProfile, ArcadeScore

COOLDOWN_S = 15
MAX_SCORE = 5000
REWARD = {"win": 30, "draw": 15, "lose": 8}
MAX_STAGE = {"momentum-cup": 6, "impulse-arena": 100, "volt-city": 12,"induction-dash": 30, "light-bender": 45,"circuit-forge": 51, "logic-labyrinth": 40, "kinetic-kingdom": 41, "wavefront": 12, "samaru-days": 120, "signal-surfer": 26, "maglev-rescue": 26, "drive-room": 26, "motorworks": 30, "storm-map": 26, "algorithm-garage": 26}
# Circuit Forge stages belong to academic-level chapters (static/js/games/circuit-*.js): a stage can only be reported by a
# player whose level opens that chapter.
STAGE_LEVEL = {"circuit-forge": [100] * 13 + [200] * 12 + [300] * 11 + [400] * 8 + [500] * 7,
               "logic-labyrinth": [300] * 22 + [400] * 18}
FINAL = {"induction-dash": ("dash-champion", 30), "light-bender": ("optics-ace", 45), "circuit-forge": ("master-electrician", 51),
         "volt-city": ("ring-restored", 12), "logic-labyrinth": ("logic-master", 40),"kinetic-kingdom": ("kingdom-restored", 16), "wavefront": ("wavefront-hero", 12),
         "samaru-days": ("light-of-samaru", 17), "signal-surfer": ("signal-master", 26), "maglev-rescue": ("line-restored", 26),
         "drive-room": ("chief-engineer", 26), "motorworks": ("workshop-master", 30), "storm-map": ("gridkeeper", 26),
         "algorithm-garage": ("robot-whisperer", 26)}
RANKS = ["Apprentice", "Technician", "Engineer", "Senior engineer", "Chief engineer", "Fellow"]

SHOP = {  # id: (label, price, kind, value)
    "kit-volt": ("Volt yellow kit", 120, "kit", "#c9a227"),
    "kit-ocean": ("Ocean blue kit", 120, "kit", "#1f6fb2"),
    "kit-crimson": ("Crimson kit", 150, "kit", "#a4161a"),
    "kit-emerald": ("Emerald kit", 150, "kit", "#1b7a4b"),
    "kit-gold": ("Gold champion kit", 400, "kit", "#d4a017"),
    "trail-plasma": ("Plasma ball trail", 200, "trail", "#c084fc"),
    "trail-solar": ("Solar ball trail", 200, "trail", "#ffb703"),
    "arena-sunset": ("Momentum Cup arena: Sunset Bowl", 150, "arena", "sunset"),
    "arena-rain": ("Momentum Cup arena: Rainy Derby", 200, "arena", "rain"),
    "arena-snow": ("Momentum Cup arena: Snow Classic", 250, "arena", "snow"),
    "arena-grand": ("Momentum Cup arena: Grand Volt Arena", 400, "arena", "grand"),
    "wpn-rule": ("Impulse Arena weapon: metre rule", 150, "weapon", "rule"),
    "wpn-fork": ("Impulse Arena weapon: tuning fork", 160, "weapon", "fork"),
    "wpn-wrench": ("Impulse Arena weapon: big wrench", 180, "weapon", "wrench"),
    "wpn-staff": ("Impulse Arena weapon: coil staff", 220, "weapon", "staff"),
    "char-groove": ("DJ Groove (guest fighter)", 300, "char", "groove"),
    "char-kai": ("Master Kai (guest fighter)", 300, "char", "kai"),
}
BADGES = {
    "first-win": ("First win", "Won your first match or puzzle."),
    "cup-champion": ("Cup champion", "Won the Momentum Cup final against Count Entropy."),
    "arena-champion": ("Arena champion", "Cleared the first chapter of the Impulse Arena Circuit."),
    "arena-legend": ("Circuit legend", "Cleared all ten chapters of the Impulse Arena Circuit."),
    "city-restored": ("City restored", "Brought all six inner Volt City districts back online."),
    "ring-restored": ("The Ring is lit", "Restored all twelve Volt City districts, Outer Ring included."),
    "all-rounder": ("All-rounder", "Won in Momentum Cup, Impulse Arena and Volt City."),
    "dash-champion": ("Storm rider", "Lit the final beacon on Entropy's Rail in Induction Dash."),
    "optics-ace": ("Optics ace", "Lit the receiver in Count Entropy's hall of mirrors."),
    "master-electrician": ("Master electrician", "Fixed the final 500-level Circuit Forge circuit."),
    "level-10": ("Level 10", "Reached player level 10."),
    "kingdom-restored": ("Kingdom restored", "Beat Count Entropy in Entropy's Engine (Kinetic Kingdom 4-4)."),
    "wavefront-hero": ("Wavefront hero", "Silenced Entropy's Echo, the last stage of Wavefront."),
    "logic-master": ("Logic master", "Beat Count Entropy's clock tower in Logic Labyrinth."),
    "light-of-samaru": ("Light of Samaru", "Beat Count Entropy at the Senate Building in Freshers School Life."),
    "signal-master": ("Signal master", "Carried the final relay through the worst channel in Signal Surfer."),
    "line-restored": ("Line restored", "Brought the last pod home on the Golden line in Maglev Rescue."),
    "chief-engineer": ("Chief engineer", "Ran the station's biggest drive through the Grand finale in Drive Room."),
    "workshop-master": ("Workshop master", "Got the last machine in Motorworks Trails doing its job."),
    "gridkeeper": ("Gridkeeper", "Brought every customer back after the final storm in Storm Map."),
    "robot-whisperer": ("Robot whisperer", "Beat Count Entropy's scrambler in Algorithm Garage."),
    "level-5": ("Level 5", "Reached player level 5."),
    "collector": ("Collector", "Bought three items in the arcade shop."),
}


def level_for(xp):
    return int((math.sqrt(1 + 8 * xp / 100) - 1) // 2) + 1


def xp_for_level(n):
    return 100 * (n - 1) * n // 2


def profile_for(user=None, guest=None):
    if guest is not None:
        prof, _ = ArcadeProfile.objects.get_or_create(guest=guest)
    else:
        prof, _ = ArcadeProfile.objects.get_or_create(user=user)
    return prof


def _locked(owner):
    """Lock the profile row of `owner` (a User, a GuestPlayer or an ArcadeProfile)."""
    if isinstance(owner, ArcadeProfile):
        return ArcadeProfile.objects.select_for_update().get(pk=owner.pk)
    from .models import GuestPlayer
    if isinstance(owner, GuestPlayer):
        return ArcadeProfile.objects.select_for_update().get_or_create(guest=owner)[0]
    return ArcadeProfile.objects.select_for_update().get_or_create(user=owner)[0]


def as_dict(prof):
    lv = level_for(prof.xp)
    return {"xp": prof.xp, "coins": prof.coins, "level": lv, "rank": RANKS[min(len(RANKS) - 1, (lv - 1) // 2)],
            "next_xp": xp_for_level(lv + 1), "this_xp": xp_for_level(lv), "owned": prof.owned, "equipped": prof.equipped,
            "badges": [{"id": b, "name": BADGES[b][0], "text": BADGES[b][1]} for b in prof.badges if b in BADGES],
            "on_leaderboard": prof.on_leaderboard,
            "shop": [{"id": k, "label": v[0], "price": v[1], "kind": v[2], "value": v[3]} for k, v in SHOP.items()]}


class Rejected(ValueError):
    pass


def _clean_result(data):
    game = str(data.get("game", ""))
    if game not in MAX_STAGE or game not in BY_SLUG:
        raise Rejected("Unknown game.")
    result = data.get("result")
    if result not in REWARD:
        raise Rejected("Result must be win, draw or lose.")
    try:
        stage = int(data.get("stage", 1))
        score = int(data.get("score", 0))
    except (TypeError, ValueError):
        raise Rejected("Stage and score must be numbers.")
    if not 1 <= stage <= MAX_STAGE[game]:
        raise Rejected("Stage out of range.")
    mode = data.get("mode", "solo")
    if mode not in ("solo", "duo"):
        raise Rejected("Unknown mode.")
    return game, result, stage, max(0, min(MAX_SCORE, score)), mode


def _clean_board(game):
    """True when cheat-assisted results are kept off this game's boards and earn nothing (the Game Settings switch)."""
    from . import cheats
    return not cheats.cheats_on_boards(game)


@transaction.atomic
def record(owner, data, now=None, max_level=500):
    game, result, stage, score, mode = _clean_result(data)
    # A result reported with a cheat code or the secret character in use. The score is always saved and flagged;
    # while the "cheats on leaderboards" switch is off it stays off the boards and earns no coins, XP or badges.
    cheated = bool(data.get("cheated") or data.get("hero"))
    barred = cheated and _clean_board(game)
    need = STAGE_LEVEL.get(game)
    if need and need[stage - 1] > (max_level or 0):
        raise Rejected("That chapter is above your level.")
    prof = _locked(owner)
    now = now or time.time()
    st = prof.stats or {}
    g = st.setdefault(game, {"plays": 0, "wins": 0, "best": 0, "stages": [], "last": None})
    if g.get("last") and 0 <= now - g["last"] < COOLDOWN_S:
        raise Rejected("Results are counted at most once every 15 seconds per game.")
    g["last"] = now
    g["plays"] += 1
    coins = REWARD[result] + (5 * stage if result == "win" else 0)
    if mode == "duo":
        coins //= 2  # same-device friendly: half rewards, no leaderboard entry
    if barred:
        coins = 0
    xp = coins * 2
    before = level_for(prof.xp)
    if result == "win" and not barred:
        g["wins"] += 1
        if stage not in g["stages"]:
            g["stages"].append(stage)
    new_badges = []

    def award(b):
        if b not in prof.badges:
            prof.badges.append(b)
            new_badges.append(b)
    if result == "win" and not barred:
        award("first-win")
        if game == "momentum-cup" and stage == MAX_STAGE["momentum-cup"] and mode == "solo":
            award("cup-champion")
        if game == "impulse-arena" and stage >= 10 and mode == "solo":  # Circuit rung 10 = chapter 1 boss; 100 = chapter 10
            award("arena-champion")
        if game == "impulse-arena" and stage == MAX_STAGE["impulse-arena"] and mode == "solo":
            award("arena-legend")
        if game == "volt-city" and set(g["stages"]) >= {1, 2, 3, 4, 5, 6}:
            award("city-restored")
        if all(st.get(k, {}).get("wins") for k in ("momentum-cup", "impulse-arena", "volt-city")):
            award("all-rounder")
        if game in FINAL and stage == FINAL[game][1]:
            award(FINAL[game][0])
    prof.coins += coins
    prof.xp += xp
    if level_for(prof.xp) >= 5:
        award("level-5")
    if level_for(prof.xp) >= 10:
        award("level-10")
    if mode == "solo" and score:
        if not barred:
            g["best"] = max(g["best"], score)
        ArcadeScore.objects.create(profile=prof, game=game, score=score, cheated=cheated)
    prof.stats = st
    prof.save()
    out = as_dict(prof)
    out.update(earned_coins=coins, earned_xp=xp, levelled_up=level_for(prof.xp) > before, cheated=cheated, counted=not barred,
               new_badges=[{"id": b, "name": BADGES[b][0], "text": BADGES[b][1]} for b in new_badges])
    return out


@transaction.atomic
def buy(owner, item):
    if item not in SHOP:
        raise Rejected("No such item.")
    prof = _locked(owner)
    if item in prof.owned:
        raise Rejected("You already own this.")
    price = SHOP[item][1]
    if prof.coins < price:
        raise Rejected(f"You need {price - prof.coins} more coins.")
    prof.coins -= price
    prof.owned.append(item)
    if sum(1 for i in prof.owned if i in SHOP) >= 3 and "collector" not in prof.badges:
        prof.badges.append("collector")
    prof.save()
    return as_dict(prof)


@transaction.atomic
def equip(owner, item):
    prof = _locked(owner)
    if item.startswith("none-"):
        prof.equipped.pop(item[5:], None)
    else:
        if item not in prof.owned or item not in SHOP:
            raise Rejected("Buy this item first.")
        kind = SHOP[item][2]
        if kind in ("char", "arena", "weapon"):
            raise Rejected("This item is unlocked, not worn.")
        prof.equipped[kind] = item
    prof.save()
    return as_dict(prof)


def _week_start():
    from datetime import timedelta

    from django.utils import timezone
    now = timezone.now()
    return (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)


def leaderboard(game, limit=10, week=False, me=None):
    """Best real saved score per player for one game (all time or this week). Rows come only from ArcadeScore."""
    from django.db.models import Max
    qs = ArcadeScore.objects.filter(game=game, profile__on_leaderboard=True)
    if _clean_board(game):
        qs = qs.filter(cheated=False)
    if week:
        qs = qs.filter(created__gte=_week_start())
    rows = list(qs.values("profile").annotate(best=Max("score")).order_by("-best", "profile")[:limit])
    # a row is marked when the best score shown for that player was set with a cheat or the secret character
    marked = {(r["profile"], r["score"]) for r in qs.filter(cheated=True, profile__in=[x["profile"] for x in rows]).values("profile", "score")}
    clean = {(r["profile"], r["score"]) for r in qs.filter(cheated=False, profile__in=[x["profile"] for x in rows]).values("profile", "score")}
    profs = {p.pk: p for p in ArcadeProfile.objects.filter(pk__in=[r["profile"] for r in rows]).select_related("user__person", "guest")}
    return [{"rank": i, "name": display_name(profs.get(r["profile"])), "score": r["best"], "profile_id": r["profile"],
             "cheated": (r["profile"], r["best"]) in marked and (r["profile"], r["best"]) not in clean,
             "guest": bool(profs.get(r["profile"]) and profs[r["profile"]].guest_id), "me": bool(me and me.pk == r["profile"])}
            for i, r in enumerate(rows, 1)]


def my_rank(game, prof):
    """This player's position on the all-time board, or None."""
    from django.db.models import Max
    scores = ArcadeScore.objects.filter(game=game)
    if _clean_board(game):
        scores = scores.filter(cheated=False)
    mine = scores.filter(profile=prof).aggregate(b=Max("score"))["b"]
    if mine is None:
        return None
    better = (scores.filter(profile__on_leaderboard=True).values("profile").annotate(b=Max("score"))
              .filter(b__gt=mine).count())
    return {"rank": better + 1, "score": mine}


def xp_board(limit=20, me=None):
    rows = ArcadeProfile.objects.filter(on_leaderboard=True, xp__gt=0).select_related("user__person", "guest").order_by("-xp", "pk")[:limit]
    return [{"rank": i, "name": display_name(p), "xp": p.xp, "level": level_for(p.xp), "badges": len(p.badges),
             "guest": bool(p.guest_id), "me": bool(me and me.pk == p.pk)} for i, p in enumerate(rows, 1)]


def display_name(owner):
    """First name and last initial only (no email, reg. number or full name)."""
    if isinstance(owner, ArcadeProfile):
        if owner.guest_id:
            parts = owner.guest.name.split()
            return (parts[0] + (" " + parts[-1][:1] + "." if len(parts) > 1 else "")) if parts else "Guest"
        owner = owner.user
    user = owner
    if user is None:
        return "Player"
    person = getattr(user, "person", None)
    first = (getattr(person, "first_name", "") or getattr(user, "first_name", "") or "Player").strip()
    last = (getattr(person, "last_name", "") or getattr(user, "last_name", "") or "").strip()
    return f"{first} {last[:1]}." if last else first
