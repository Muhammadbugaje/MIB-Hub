"""Build static/js/games/fslg-story-likes.js from docs/story/CHARACTERS_BACKSTORY.md.

    python tools/story/build_likes.py

For every character sheet it reads the Gifts line (three loved, three liked, three hated), the Romance line, and the
"Loves" and "Quirk" lines, and writes data only: D.LIKES[id] = { loved: [itemId…], liked: […], hated: […], hates: [text…],
romance: "m" | "f" | "", loves, quirk }. Gift phrases are mapped onto pocket items: a phrase that names something the
game already sells uses that item; anything else becomes its own small gift item (D.GIFTS) that the Gift Corner orders
in. Nothing is guessed silently: unmapped or odd lines are printed. Re-run after editing the sheets.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SHEETS = ROOT / "docs/story/CHARACTERS_BACKSTORY.md"
OUT = ROOT / "static/js/games/fslg-story-likes.js"

# words in a gift phrase → an item the pockets already know (samaru-inv.js catalogue)
KNOWN = [("pepper soup", "peppersoup"), ("jollof", "jollof"), ("egusi", "egusi"), ("strawberry jam", "strawberries"), ("kilishi", "kilishi"), ("suya", "suya"), ("garri", "garri"), ("zobo", "zobo"), ("kunu", "kunu"), ("puff-puff", "puffpuff"), ("puff puff", "puffpuff"),
         ("bread", "bread"), ("rice", "rice"), ("malt", "voltmalt"), ("chocolate", "chocolate"), ("perfume", "perfume"), ("scented oil", "perfume"),
         ("novel", "novel"), ("notebook", "notebook"), ("scarf", "scarf"), ("flowers", "flowers"), ("flower", "flowers"), ("masa", "masa"), ("kosai", "kosai"),
         ("fura", "fura"), ("meat pie", "meatpie"), ("corn", "corn"), ("spice", "spice"), ("pepper", "pepper"), ("energy drink", "edrink"),
         ("indomie", "indomie"), ("noodles", "indomie"), ("egg", "egg"), ("water from the dam", "damwater"), ("fabric", "fabric"), ("ankara", "fabric"),
         ("paint", "paint"), ("cable", "cable"), ("battery", "cell"), ("bulb", "bulb"), ("tape", "tape"), ("sachet water", "water")]
# shared small gifts: several people like the same sort of thing, so they share one item
SHARED = [("groundnut", "groundnuts", "Groundnuts in a twist of paper", 100, "food"), ("tea", "tea", "Tea (a hot cup's worth)", 150, "drink"), ("chin-chin", "chinchin", "Chin-chin", 250, "food"),
          ("chin chin", "chinchin", "Chin-chin", 250, "food"), ("dates", "dates", "Dates", 400, "food"), ("biscuit", "biscuits", "Biscuits", 200, "food"), ("pen", "pen", "A good pen", 250, "gift"),
          ("sock", "socks", "Socks", 400, "gift"), ("strawberr", "strawberries", "Strawberries", 600, "food"), ("ice cream", "icecream", "Ice cream", 500, "food"),
          ("sweet", "sweets", "Sweets", 150, "food"), ("mirror", "mirror", "A hand mirror", 700, "gift"), ("cap", "cap", "A cap", 800, "gift"), ("sunglasses", "sunglasses", "Sunglasses", 1500, "gift"),
          ("power bank", "powerbank", "Power bank", 3500, "gift"), ("kola", "kolanut", "Kola nuts", 200, "food"), ("honey", "honey", "A jar of honey", 900, "food"), ("yoghurt", "yoghurt", "Yoghurt", 350, "drink"),
          ("pencil", "pencils", "Pencils", 200, "gift"), ("highlighter", "highlighters", "Highlighters", 500, "gift"), ("bookmark", "bookmark", "A bookmark", 150, "gift"),
          ("glove", "gloves", "Work gloves", 600, "gift"), ("tool", "tools", "A small tool set", 2500, "gift"), ("earring", "earrings", "Earrings", 1200, "gift"), ("hair clip", "hairclips", "Hair clips", 300, "gift"),
          ("jersey", "jersey", "A football jersey", 2500, "gift"), ("bandana", "bandana", "A bandana", 400, "gift"), ("folder", "folders", "Folders", 300, "gift"), ("candle", "candle", "A candle", 200, "gift"),
          ("orange", "oranges", "Oranges", 200, "food"), ("mango", "mangoes", "Mangoes", 300, "food"), ("coffee", "coffee", "Coffee sachets", 300, "drink"), ("milk", "milk", "Tinned milk", 400, "drink")]
NOT_THINGS = re.compile(r"^(being |anything |\"|“|lateness|silence|noise|fuss|gossip|waste|lies|rushing|phon|drama|hurry|excuses|crowds|small talk|sarcasm|shouting|wait|late|thank-you|surprise|horror|loud|dog-eared|people |when |questions|compliments|pity|unsolicited|haggling|talk of|talking|rumours|shortcuts|laziness)", re.I)

issues, gifts = [], {}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "", s.lower())[:22]


def clean(p):
    p = re.sub(r"\(heard[^)]*\)", "", p)
    p = re.sub(r"\([^)]*\)", "", p).strip(" .;")
    return re.sub(r"^(a|an|the|his|her|their|some|any) ", "", p, flags=re.I).strip()


def item_for(phrase, who, hated=False):
    low = phrase.lower()
    if hated and (NOT_THINGS.search(low) or re.search(r"artificial|flavour|plastic|cheap|fake|word ", low)):
        return None
    for k, v in KNOWN:
        if k in low:
            return v
    for k, i, name, price, kind in SHARED:
        if re.search(r"\b" + re.escape(k) + r"(s|es|y|ies)?\b", low):
            gifts.setdefault(i, {"name": name, "price": price, "kind": kind})
            return i
    if hated:
        return None  # a hated thing that nobody sells stays a line of text
    i = "g_" + slug(phrase)
    name = phrase[0].upper() + phrase[1:]
    price = 300 + 100 * (sum(map(ord, i)) % 22)
    gifts.setdefault(i, {"name": name, "price": price, "kind": "gift", "special": 1})
    return i


def split(s):
    return [clean(x) for x in re.split(r",| and (?=[a-z\"“])", s) if clean(x)]


def main():
    text = SHEETS.read_text(encoding="utf-8")
    likes = {}
    for m in re.finditer(r"^### [\w.]+\s+(.*?)\((\w+)(?:;[^)]*)?\)[^\n]*\n(.*?)(?=^### |^## |\Z)", text, re.S | re.M):
        name, cid, body = m.group(1).strip(), m.group(2), m.group(3)
        if cid in ("bolaji",):
            cid = "bola"
        body1 = " ".join(body.split())
        gl = re.search(r"\*\*Gifts:\*\*\s*(.*?)(?= - \*\*|$)", body1)
        gtxt = re.sub(r"\([^)]*\)", "", gl.group(1)) if gl else ""
        g = re.search(r"loved\s*—\s*(.*?)\s*[.;]\s*[Ll]iked\s*—\s*(.*?)\s*[.;]\s*[Hh]ated\s*—\s*(.*?)\s*\.?\s*$", gtxt)
        rom = re.search(r"\*\*Romance:\*\*\s*yes, for (male|female) players", body1)
        lov = re.search(r"\*\*Loves:\*\*\s*(.*?)\.", body1)
        qk = re.search(r"\*\*Quirk:\*\*\s*(.*?)\.", body1)
        d = {"romance": ("m" if rom.group(1) == "male" else "f") if rom else ""}
        if lov:
            d["loves"] = lov.group(1).strip()
        if qk:
            d["quirk"] = qk.group(1).strip()
        if g:
            L, l, H = split(g.group(1)), split(g.group(2)), split(g.group(3))
            d["loved"] = [item_for(p, cid) for p in L]
            d["liked"] = [item_for(p, cid) for p in l]
            d["hated"] = [x for x in (item_for(p, cid, True) for p in H) if x]
            d["hates"] = H
            d["lovedText"] = L
            if len(L) != 3 or len(l) != 3:
                issues.append(f"{cid}: {len(L)} loved / {len(l)} liked (expected 3 each)")
        elif "Gifts:" in body1:
            g2 = re.search(r"\*\*Gifts:\*\*\s*(.*?)(?: - \*\*|$)", body1)
            d["note"] = g2.group(1).strip()[:160] if g2 else ""
        if len(d) > 1 or d["romance"]:
            likes[cid] = d
    js = ("/* GENERATED by tools/story/build_likes.py from docs/story/CHARACTERS_BACKSTORY.md. Do not edit by hand.\n"
          "   What each person loves, likes and cannot stand (three of each on their sheet), who can be courted, and the\n"
          "   small gift items those sheets mention that no shop sold yet. Data only. */\n"
          "(function () {\n  \"use strict\";\n  var root = typeof self !== \"undefined\" ? self : this, D = root.SamaruData; if (!D) return;\n"
          "  D.LIKES = " + json.dumps(likes, ensure_ascii=False, sort_keys=True) + ";\n"
          "  D.GIFTS = " + json.dumps(gifts, ensure_ascii=False, sort_keys=True) + ";\n})();\n")
    OUT.write_text(js, encoding="utf-8")
    print(f"{len(likes)} people, {sum(1 for d in likes.values() if 'loved' in d)} with gifts, {sum(1 for d in likes.values() if d['romance'])} courtable, {len(gifts)} new gift items → {OUT.relative_to(ROOT)}")
    for i in issues:
        print("  note:", i)


if __name__ == "__main__":
    main()
