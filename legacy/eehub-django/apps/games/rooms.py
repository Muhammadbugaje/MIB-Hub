"""Freshers School Life rooms: up to six players on the same network share one campus. The server only relays:
each browser posts its own position a few times a second and reads the others'. State lives in the cache
for seconds, never in the database. Chat is a fixed phrase list (an index, not free text)."""
import time

from django.core.cache import cache

from .progress import Rejected

MAX_PLAYERS = 6
STALE_S = 8          # a player who has not posted for this long has left
ROOM_TTL = 120
MAX_EVENTS = 40
VEHICLES = {"", "skate", "bike", "scooter", "okada", "keke", "car", "sport", "plane"}
EMOTES = {"", "wave", "dance", "sit", "spar"}
CHAT_PHRASES = 10
RACE_ROUTES = 8
CO_MAX = 1000        # friends missions: the host's snapshot or a player's claim, as compact JSON text


def _num(v, lo, hi, default=0.0):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return default
    if v != v:  # NaN
        return default
    return max(lo, min(hi, v))


def clean_state(st):
    if not isinstance(st, dict):
        raise Rejected("Bad state.")
    veh = st.get("v") if st.get("v") in VEHICLES else ""
    emote = st.get("e") if st.get("e") in EMOTES else ""
    char = str(st.get("c", ""))[:12]
    if not char.isalnum():
        char = "tunde"
    fit = st.get("f") if isinstance(st.get("f"), str) and len(st["f"]) <= 200 and all(ch in "abcdefghijklmnopqrstuvwxyz0123456789.,_" for ch in st["f"]) else ""
    return {"f": fit, "x": round(_num(st.get("x"), -3000, 3000), 1), "y": round(_num(st.get("y"), -3000, 3000), 1),
            "a": round(_num(st.get("a"), -100, 100), 2), "v": veh, "s": round(_num(st.get("s"), -80, 80), 1), "e": emote,
            "c": char, "o": int(_num(st.get("o"), 0, 9)), "l": int(_num(st.get("l"), 1, 150, 1)),
            "z": 1 if st.get("z") else 0, "h": int(_num(st.get("h"), 0, 999))}


def clean_event(ev, now_ms):
    if not isinstance(ev, dict):
        return None
    k = ev.get("k")
    if k == "emote" and ev.get("e") in EMOTES:
        return {"k": k, "e": ev["e"]}
    if k == "chat":
        return {"k": k, "p": int(_num(ev.get("p"), 0, CHAT_PHRASES - 1))}
    if k == "race":
        return {"k": k, "r": int(_num(ev.get("r"), 0, RACE_ROUTES - 1)), "at": int(_num(ev.get("at"), now_ms, now_ms + 30000, now_ms + 8000))}
    if k == "fin":
        return {"k": k, "id": str(ev.get("id", ""))[:24], "time": round(_num(ev.get("time"), 0, 3600), 1)}
    if k == "hit":
        return {"k": k, "to": int(_num(ev.get("to"), 0, 10 ** 9)), "d": int(_num(ev.get("d"), 0, 20))}
    if k == "co" and isinstance(ev.get("o"), str) and isinstance(ev.get("d"), str) and len(ev["d"]) <= CO_MAX:
        # friends missions (static/js/games/fslg-story-coop.js): relayed as printable text only; every
        # receiving game parses it as data and the host's game referees it
        return {"k": k, "o": ev["o"][:2], "d": "".join(ch for ch in ev["d"] if 32 <= ord(ch) < 127)}
    return None


def clean_code(code):
    code = "".join(ch for ch in str(code or "").upper() if ch.isalnum())[:8]
    if len(code) < 3:
        raise Rejected("Room codes need at least 3 letters or numbers.")
    return code


def sync(pid, data, now=None):
    """One round trip for player `pid`: store its state and events, return everyone else's."""
    now = time.time() if now is None else now
    now_ms = int(now * 1000)
    code = clean_code(data.get("code"))
    name = " ".join(str(data.get("name") or "Player").split())[:16] or "Player"
    name = "".join(ch for ch in name if ch.isalnum() or ch in " -'") or "Player"
    state = clean_state(data.get("st"))
    key = f"samaru-room:{code}"
    room = cache.get(key) or {"m": {}, "ev": [], "seq": 0}
    members = {int(k): v for k, v in room["m"].items() if now - v["t"] < STALE_S}
    if pid not in members and len(members) >= MAX_PLAYERS:
        raise Rejected("That room is full (6 players).")
    changed = pid not in members or now - members[pid]["t"] > 2 or members[pid]["n"] != name
    members[pid] = {"n": name, "t": now}
    events = data.get("ev") or []
    if isinstance(events, list):
        for raw in events[:5]:
            ev = clean_event(raw, now_ms)
            if ev:
                room["seq"] += 1
                ev.update(i=room["seq"], f=pid)
                room["ev"].append(ev)
                changed = True
    room["ev"] = room["ev"][-MAX_EVENTS:]
    room["m"] = members
    if changed:  # the shared record is only rewritten on joins, heartbeats and events, not on every position
        cache.set(key, room, ROOM_TTL)
    cache.set(f"{key}:{pid}", state, STALE_S * 2)
    since = int(_num(data.get("since"), 0, 10 ** 12))
    if since > room["seq"]:
        since = 0
    players = []
    for other, meta in members.items():
        if other == pid:
            continue
        st = cache.get(f"{key}:{other}")
        if st:
            players.append({"id": other, "n": meta["n"], "st": st})
    return {"me": pid, "now": now_ms, "players": players, "ev": [e for e in room["ev"] if e["i"] > since]}
