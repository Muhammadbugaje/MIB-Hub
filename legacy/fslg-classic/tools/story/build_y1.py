"""Build static/js/games/fslg-story-y1.js from the written Year 1 scripts and the character sheets.

    python tools/story/build_y1.py

Reads docs/story/scripts/Y1.md + Y1b.md (m1–m36) and docs/story/CHARACTERS_BACKSTORY.md (every named
person), and writes data only, in the story-engine contract (docs/story/ENGINE.md). Mapping tables below turn
script words (place names, people, items) into game ids; anything unmapped is reported, never guessed silently.
Re-run after editing the scripts; hand-written choices live in CHOICES below.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = [ROOT / "docs/story/scripts/Y1.md", ROOT / "docs/story/scripts/Y1b.md"]
SHEETS = ROOT / "docs/story/CHARACTERS_BACKSTORY.md"
OUT = ROOT / "static/js/games/fslg-story-y1.js"

PLACES = set("""gate senate library bookshop ee chemeng physics maths fslt theatre sculpture akenzua ribadu amina suleiman pepsi court chapel mosque
sickbay fire bank market dam strip demo radio club buka shayi quarters art education social shinkafi selfie love enggarden facgarden geogarden
dept_elect dept_comp dept_mech dept_civil dept_agric dept_metal dept_mining dept_water dept_telecom dept_chem kt wt nelt compsci dangote danfodio
p2shops p2canteen p2park p2mosque p2chapel lowerdam checkpoint stalls mk_supermarket mk_electronics mk_phones mk_cinema mk_books mk_pharmacy
mk_arcade mk_fashion mk_native mk_modest mk_shoes mk_eyewear mk_sports mk_barber mk_thrift mk_gifts mk_food mk_dance mibstore stop_market
stop_gate stop_senate stop_social stop_eng stop_library stop_dam""".split())
PLACE_WORDS = {  # script words → place ids (longest match wins)
    "@hostel kitchen": "@hostel", "@hostel": "@hostel", "@dept": "@dept", "behind shinkafi": "shinkafi", "pitch": "court", "yard": "court",
    "kb": "@hostelshop", "@hostelshop": "@hostelshop", "pageturner": "mk_books", "page turner": "mk_books", "grandstand": "club", "gallery": "art", "cliff ridge": "lowerdam",
    "civil workshop": "dept_civil", "mechanical workshop": "dept_mech", "electrical workshop": "dept_elect", "over campus": "selfie",
    "the pier": "dam", "pier": "dam", "the coil": "enggarden", "coil": "enggarden", "radio studio": "radio", "fire station": "fire", "bank door": "bank",
    "bank side": "bank", "stone globe": "geogarden", "selfie letters": "selfie", "sculpture garden": "sculpture", "heart hedge": "love",
    "central mosque": "mosque", "samaru market": "market", "the dam": "dam", "dam road": "dam", "porter's lodge": "@hostel", "lodge": "@hostel",
    "the net": "dam", "three spots": "radio", "six spots": "enggarden", "main gate": "gate", "fountain": "selfie", "buka": "buka",
    "registry": "senate", "sick bay": "sickbay", "flying club": "strip", "airfield": "strip", "racing club": "club", "the floor": "mk_dance",
    "mall": "market", "mib store": "mibstore", "phase 2": "dangote", "kt": "kt", "wt": "wt", "nelt": "nelt", "physics lab": "physics",
}
RACES = {"theatre loop": "r1", "hostel run": "r2", "ring road grand prix": "r3", "senate sprint": "r4", "dam dash": "r5", "market madness": "r6",
         "east side drift": "r7", "school marathon": "r8", "checkpoint 2": "r5"}
NPC_WORDS = {"porter": "porter", "baba porter": "porter", "big sly": "bola", "sly": "bola", "bolaji": "bola", "bola": "bola", "baba dam": "baba",
             "corporal peter": "peter", "peter": "peter", "mum": "phone:mum", "dad": "phone:dad", "nurse hauwa": "hauwa", "malam garba": "garba",
             "dr. okonkwo": "okonkwo", "prof. bello": "bello", "dr. khadija": "khadija", "coach danladi": "danladi", "captain uche": "uche",
             "dj kabiru": "kabiru", "kabiru": "kabiru", "mai shayi audu": "audu", "mama nkechi": "nkechi", "hajiya ladi": "ladi", "the maker": "maker",
             "sgt. bilkisu": "bilkisu", "madam whistle": "bilkisu", "engr. aliyu": "aliyu", "mr. ezekiel": "ezekiel", "mrs. shehu": "shehu",
             "big baby": "bigbaby", "losers": "crowd:losers", "levy leader": "crowd:levy_leader", "player": "me", "@roomie": "@roomie",
             "@best": "@best", "@crush": "@crush", "@hod": "@hod", "chi-tech": "chitech", "dj sugar": "sugar", "aunty asiya": "asiya",
             "foreman danjuma": "danjuma", "foreman asabe": "asabe", "foreman ikenna": "ikenna", "ranger lawal": "lawal", "ranger": "lawal", "kaka": "kaka",
             "pastor sam": "sam", "ustaz auwal": "auwal", "baba shuttle": "linus", "iya risi": "risi", "mr. clement": "clement", "mrs. adebayo": "adebayo",
             "chief megawatt": "megawatt", "alhaji needle": "needle", "count entropy": "crowd:count_entropy", "entropy": "crowd:count_entropy",
             "radio": "radio", "walker": "crowd:walker", "crowd": "crowd:crowd", "everyone": "crowd:everyone"}
ITEM_WORDS = {"spark gap": "sparkgap", "ledger pages": "ledger", "statues": "statue", "coins": "coin", "plaque rubbings": "rubbing", "shea butter": "sheabutter",
              "chin-chin": "chinchin", "books": "book", "wood": "wood", "cement": "cement", "sand": "sand", "stakes": "stake", "flowers": "flowers", "tea": "tea"}
STANDING = {"academics": "academics", "books": "academics", "library": "academics", "street": "street", "vibes": "social", "social": "social",
            "community": "community", "department": "department", "fame": "fame"}

# Choices the scripts describe in prose ("At beat 6: …"); hand-written here. after = beat number the choice follows.
ROOMS = [("bature", "Ribadu 2-14 — Bature", "ribadu", "m"), ("sadiq", "Suleiman 1-07 — Sadiq", "suleiman", "m"), ("muktar", "Akenzua 3-02 — Muktar", "akenzua", "m"),
         ("yusuf", "Alex 2-21 — Yusuf", "ribadu", "m"), ("khalid", "Dan Fodio B-11 — Khalid", "danfodio", "m"),
         ("firdausi", "Queen Amina 1-09 — Firdausi", "amina", "f"), ("nusaybah", "Queen Amina 2-03 — Nusaybah", "amina", "f"), ("aleeya", "Queen Amina 3-12 — Aleeya", "amina", "f"),
         ("emily", "Dangote W-05 — Emily", "dangote", "f"), ("lily", "Queen Amina 1-16 — Lily", "amina", "f")]
CHOICES = {
    "m1": {"beat": 3, "prompt": "Choose your room", "options": [{"label": lab, "set": ["room_" + i], "roomie": i, "home": h, "sex": sx, "friend": {i: 5}} for i, lab, h, sx in ROOMS]
           + [{"label": "Let fate decide", "fate": True, "lines": [["porter", "You want God to choose? Okay. God has chosen. Don't complain to me."]]}]},
    "m2": {"after": 3, "prompt": "What do you cook first?", "options": [{"label": "Rice", "set": ["dish_rice"]}, {"label": "Yam", "set": ["dish_yam"]}, {"label": "Garri soaked with sugar", "set": ["dish_garri"]}]},
    "m3": {"after": 6, "prompt": "The pressed flower", "options": [{"label": "Keep the pressed flower", "set": ["flower_kept"]}, {"label": "Leave it in the book", "set": ["flower_left"], "standing": {"academics": 1}}]},
    "m7": {"after": 3, "prompt": "They want a fresher tax", "options": [{"label": "Pay the ₦500", "money": -500, "set": ["fresher_tax_paid"]}, {"label": "Refuse", "set": ["fresher_tax_refused"], "standing": {"street": 2}}]},
    "m9": {"after": 5, "prompt": "Bolaji is hurt", "options": [{"label": "Walk him to the buka yourself", "set": ["walked_bolaji"], "friend": {"bola": 5, "bigbaby": 3}}, {"label": "Call Nurse Hauwa", "set": ["called_hauwa"], "friend": {"bola": 2}}]},
    "m11": {"after": 7, "prompt": "Baba Dam goes quiet", "options": [{"label": "Please, Baba", "set": ["pressed_baba"]}, {"label": "Let it go", "set": ["let_baba_be"], "friend": {"baba": 5}}]},
    "m13": {"after": 7, "prompt": "Someone has crashed", "options": [{"label": "Stop and help", "set": ["gp_helped"], "standing": {"community": 3}, "friend": {"aleeya": 5, "basit": 3}}, {"label": "Race on", "set": ["gp_won"], "standing": {"street": 3}}]},
    "m16": {"after": 3, "prompt": "Who comes to the fight?", "options": [{"label": "The crew from your room and course", "set": ["brought_course"]}, {"label": "The court and the workshop", "set": ["brought_court"]}]},
    "m24": {"after": None, "prompt": "Two papers, one day", "options": [{"label": "Sign the petition", "set": ["committee_member"], "standing": {"department": 3}, "friend": {"muktar": 3}}, {"label": "Sit both papers back to back", "set": ["bello_stubborn"], "standing": {"academics": 3}}]},
    "m27": {"after": None, "prompt": "The sack of phones", "options": [{"label": "Hand them to Sgt. Bilkisu", "set": ["phones_bilkisu"], "standing": {"community": 3}}, {"label": "Give them to Chi-Tech first", "set": ["phones_chitech"], "standing": {"social": 3}}]},
    "m29": {"after": None, "prompt": "The levy boys", "options": [{"label": "Let them work the lantern line", "set": ["levy_helpers"], "standing": {"community": 4}}, {"label": "Report them to Sgt. Bilkisu", "set": ["levy_reported"], "standing": {"street": 2, "community": 1}}]},
    "m35": {"after": None, "prompt": "Engr. Aliyu's mistake", "options": [{"label": "Keep it between us", "set": ["aliyu_owes"], "standing": {"street": 2}}, {"label": "Tell Bilkisu", "set": ["aliyu_told"], "standing": {"community": 2}}]},
}

issues = []
HOOKS = {}  # mission id → [(when, beat, cutscene id)], filled in main() from the cutscene blocks


def slug(s):
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def place_of(word, ctx=""):
    w = word.strip().lower().replace("the ", "", 1) if word.strip().lower().startswith("the ") and word.strip().lower()[4:] in PLACES else word.strip().lower()
    if w in PLACES:
        return w
    for k in sorted(PLACE_WORDS, key=len, reverse=True):
        if k in w:
            return PLACE_WORDS[k]
    issues.append(f"{ctx}: place '{word}' unmapped → gate")
    return "gate"


def npc_of(word, known, ctx=""):
    w = re.sub(r"\(.*?\)", "", word).strip().lower()
    if w.startswith("phone"):
        m = re.search(r"\((.*?)\)", word)
        return "phone:" + slug(m.group(1)) if m else "phone:"
    if w.startswith("radio"):
        m = re.search(r"\((.*?)\)", word)
        return "radio:" + slug(m.group(1)) if m else "radio"
    if w in NPC_WORDS:
        return NPC_WORDS[w]
    if w.startswith("@"):
        return w
    s = slug(w)
    if s in known:
        return s
    first = s.split("_")[0]
    if first in known:
        return first
    for k, v in NPC_WORDS.items():
        if k in w:
            return v
    return "crowd:" + s


def item_of(word, items):
    w = word.strip().lower()
    i = ITEM_WORDS.get(w) or slug(w)
    if i not in items:
        items[i] = {"name": word.strip().capitalize(), "price": 0, "text": ""}
    return i


# ---------- people ----------
SKIN = [("light-brown", "#b07a4f"), ("light brown", "#b07a4f"), ("very light", "#e0b088"), ("light", "#d6a67c"), ("fair", "#d9a77a"), ("olive", "#c99a6b"),
        ("pale", "#e8c4a0"), ("deep", "#4f301c"), ("dark", "#5a3a22"), ("medium", "#8a5633"), ("brown", "#7a4a2b")]
HAIR = [("hijab", "hijab"), ("headscarf", "hijab"), ("gele", "hijab"), ("niqab", "hijab"), ("bald", "bald"), ("shaved head", "bald"), ("braid", "braids"),
        ("cornrow", "braids"), ("twist", "braids"), ("locs", "braids"), ("bun", "bun"), ("ponytail", "bun"), ("puff", "bun"), ("afro", "afro"),
        ("coil", "coily"), ("curl", "coily"), ("cap", "cap"), ("kufi", "cap"), ("zanna", "cap"), ("turban", "cap"), ("fade", "fade"), ("low cut", "low"), ("grey", "cap")]
AT = [("Electrical Engineering student", "dept_elect"), ("Page Turner", "mk_books"), ("Racing Club", "club"), ("Flying Club", "strip"), ("radio", "radio"), ("librar", "library"), ("Sick Bay", "sickbay"), ("security", "gate"), ("guard", "gate"),
      ("forest edge", "lowerdam"), ("forest", "checkpoint"), ("ranch", "checkpoint"), ("mechanical workshop", "dept_mech"), ("civil workshop", "dept_civil"), ("electrical workshop", "dept_elect"),
      ("buka", "buka"), ("tea", "shayi"), ("trader", "market"), ("fisherman", "dam"), ("mall developer", "market"), ("Works", "fire"), ("tailor", "mk_native"),
      ("phone", "mk_phones"), ("The Floor", "mk_dance"), ("MIB Store", "mibstore"), ("campus shop", "p2shops"), ("shuttle", "stop_gate"), ("Phase 2 canteen", "p2canteen"),
      ("Gift", "mk_gifts"), ("Kanti", "mk_sports"), ("registry", "senate"), ("bursary", "senate"), ("Senate", "senate"), ("hostel porter", "gate"),
      ("barber", "court"), ("court", "court"), ("football", "court"), ("arcade", "mk_arcade"), ("Page Turner", "mk_books"), ("sculpture", "sculpture"),
      ("Drama", "theatre"), ("artist", "art"), ("union", "social"), ("Phase 2", "dangote"), ("lecturer", "ee"), ("physics", "physics"), ("lab", "ee"),
      ("level adviser", "ee"), ("mechanic", "court"), ("influencer", "selfie"), ("riddler", "facgarden"), ("forest edge", "checkpoint")]
FEMALE = {"bigbaby", "risi", "idk", "summy", "faty", "jasmin", "asiya", "clemantine"}
MALE = {"muktar", "jega", "lula"}
PRICES = {"bread": 300, "tea": 100, "sheabutter": 800, "flowers": 1500, "backpack": 4000, "chinchin": 300, "garri": 300, "groundnuts": 200}
TOPS = ["#0ea5e9", "#f97316", "#22c55e", "#a855f7", "#ef4444", "#eab308", "#14b8a6", "#f43f5e", "#64748b", "#16a34a", "#2563eb", "#d97706"]


def people(text):
    out, cur = {}, None
    for line in text.splitlines():
        m = re.match(r"^###\s+(\d+[a-z]?)\.\s+(.*?)\s+\(([a-z0-9_]+)(?:;[^)]*)?\)\s*(?:—\s*(.*))?$", line)
        m2 = re.match(r"^###\s+\d+\.\s+.*?\(([a-z]+)\)\s+and\s+\d+\.\s+(.*?)\s+\(([a-z]+)\)", line)
        if m2:  # "Pastor Sam (sam) and 79. Ustaz Auwal (auwal)"
            for nid, nm in ((m2.group(1), "Pastor Sam"), (m2.group(3), m2.group(2))):
                out[nid] = {"id": nid, "name": nm, "role": "", "text": ""}
            cur = None
            continue
        if m:
            name = re.sub(r"[\s,/]+$", "", re.sub(r",?\s*/?\s*\"[^\"]*\"", "", m.group(2))).strip()  # drop every quoted nickname
            cur = out.setdefault(m.group(3), {"id": m.group(3), "name": name, "role": (m.group(4) or "").strip(), "text": ""})
            continue
        if line.startswith("## "):
            cur = None
        elif cur is not None:
            cur["text"] += line + "\n"
    return out


def npc_def(p, k):
    t, low = p["text"], p["text"].lower()
    looks = re.search(r"\*\*Looks:\*\*(.*)", t)
    lk = (looks.group(1) if looks else "").lower()
    skin = next((v for w, v in SKIN if w in lk), "#7a4a2b")
    hair = next((v for w, v in HAIR if w in lk), "low")
    rom = re.search(r"\*\*Romance:\*\*\s*yes, for (male|female) players", t)
    she, he = len(re.findall(r"\b(she|her)\b", low)), len(re.findall(r"\b(he|his|him)\b", low))
    female = p["id"] in FEMALE or (rom and rom.group(1) == "male") or "(a woman)" in p["role"] or re.search(r"girlfriend|sister|daughter|niece|aunty|mama|hajiya|mrs\\.|madam|nurse|iya ", (p["role"] + " " + p["name"]).lower()) is not None or (not rom and she > he)
    female = female and p["id"] not in MALE
    voice = "female" if female else "male"
    if voice == "male" and hair in ("hijab", "bun"):
        hair = "low"
    at = next((v for w, v in AT if w.lower() in (p["role"] + " " + lk).lower()), "selfie")
    gifts = {}
    g = re.search(r"\*\*Gifts:\*\*\s*loved\s*—\s*(.*?)\.\s*Liked\s*—\s*(.*?)\.\s*Hated\s*—\s*(.*?)\.", t, re.S)
    if g:
        gifts = {"loved": [x.strip() for x in re.split(r",| and ", g.group(1).split("(heard")[0]) if x.strip()], "liked": [x.strip() for x in re.split(r",| and ", g.group(2)) if x.strip()], "hated": [x.strip() for x in re.split(r",| and ", g.group(3)) if x.strip()]}
    speech = re.search(r"\*\*Speech:\*\*\s*(.*?)(?:\.\s|$)", t)
    hi = re.findall(r"\"([^\"]{4,70})\"", speech.group(0) if speech else "")[:3] or ["Hello.", "How far?", "See you around."]
    d = {"id": p["id"], "name": p["name"], "role": p["role"][:60] or "Student", "at": at, "skin": skin, "hair": hair, "top": TOPS[k % len(TOPS)], "voice": voice,
         "pitch": 1.05 if female else .95, "hi": hi}
    if rom:
        d["romance"] = "m" if rom.group(1) == "male" else "f"
    if gifts:
        d["gifts"] = gifts
    return d


# ---------- missions ----------
def parse_missions(text, known, items):
    blocks = re.split(r"^### (m\d+) — (.*)$", text, flags=re.M)
    out = []
    for i in range(1, len(blocks), 3):
        mid, title, body = blocks[i], blocks[i + 1].strip(), blocks[i + 2]
        out.append(mission(mid, title, body, known, items))
    return out


def lines_in(chunk, known, ctx, cond=None):
    out = []
    for m in re.finditer(r"^\s*-\s+([A-Z@][A-Z@ .'\-]*(?:\([^)]*\))?):\s+(.*?)\s*\[v:\s*\]\s*$", chunk, re.M):
        who, text = m.group(1).strip(), m.group(2).strip()
        sp = npc_of(who, known, ctx)
        cnd = cond
        if re.search(r"\(if roommate\)", who):
            cnd = "room_" + slug(re.sub(r"\(.*?\)", "", who))
        line = [sp, text, ""]
        if cnd:
            line.append(cnd)
        out.append(line)
    return out


def mission(mid, title, body, known, items):
    ctx = mid
    meta = re.search(r"^- Semester (\d+) · Gate (\d+) · Shape: (.*?) · Giver: (.*?) · Thread: (\w+)", body, re.M)
    sem, gate = (int(meta.group(1)), int(meta.group(2))) if meta else (1, 1)
    premise = re.search(r"\*\*Premise\.\*\*\s*(.*?)\n\n", body, re.S)
    beats_txt = body.split("**Beats**", 1)[1].split("\n**Choice", 1)[0] if "**Beats**" in body else ""
    beats = re.split(r"^(\d+)\.\s+", beats_txt, flags=re.M)
    steps, last_place, choice = [], "gate", CHOICES.get(mid)
    for j in range(1, len(beats), 2):
        num, chunk = int(beats[j]), beats[j + 1]
        head = chunk.split("\n", 1)[0]
        tags = re.findall(r"\[([^\]]*)\]", head)
        text = re.sub(r"\s*\(.*?\)", "", re.sub(r"\[[^\]]*\]\s*", "", head)).strip()
        text = (text.split(". ")[0].rstrip(".") if len(text) > 60 else text.rstrip("."))[:60]
        cond, segs = None, []
        for part in re.split(r"^\s*\*\*([A-Z][a-z]+)\*\*\s*—.*$", chunk, flags=re.M):
            segs.append(part)
        # roommate-specific lines (**Bature** — …) become conditional lines
        lines = []
        pieces = re.split(r"^\s*\*\*([A-Z][a-zA-Z]+)\*\*\s*—[^\n]*$", chunk, flags=re.M)
        lines += lines_in(pieces[0], known, ctx)
        for k in range(1, len(pieces), 2):
            lines += lines_in(pieces[k + 1], known, ctx, "room_" + slug(pieces[k]))
        turn = any(t.strip() == "turn" for t in tags)
        real = [t for t in tags if t.strip() not in ("turn", "quiet") and not t.startswith("switch")]
        st = step_of(real[0] if real else ("turn" if tags else "turn"), text, ctx, known, items, last_place)
        if st.get("place"):  # @hostel / @dept count too: the next unplaced find happens where the scene now is
            last_place = st["place"]
        elif st["t"] == "race":  # races start and finish at the Racing Club
            last_place = "club"
        elif st.get("npcAt"):
            last_place = st["npcAt"]
        if turn:
            st["turn"] = True
        if lines:
            st["lines"] = lines
        if choice and choice.get("beat") == num:
            st = {"t": "choice", "text": text or choice["prompt"], "prompt": choice["prompt"], "options": choice["options"], **({"lines": lines} if lines else {})}
        st["_beat"] = num
        steps.append(st)
        if choice and choice.get("after") == num:
            steps.append({"t": "choice", "text": choice["prompt"], "prompt": choice["prompt"], "options": choice["options"]})
    if choice and choice.get("after", 0) is None:
        steps.insert(max(1, len(steps) - 1), {"t": "choice", "text": choice["prompt"], "prompt": choice["prompt"], "options": choice["options"]})
    # cutscene hooks (docs/story/CUTSCENE_FORMAT.md): the blocks say which beat they belong to; the step carries the id
    for when, beat, cid in HOOKS.get(mid, []):
        tgt = steps[0] if beat == "first" else steps[-1] if beat == "last" else next((s for s in steps if s.get("_beat") == beat), None)
        key = {"before": "cutsceneBefore", "after": "cutsceneAfter", "enter": "cutsceneOnEnter"}[when]
        if tgt is None:
            issues.append(f"{mid}: cutscene {cid} is hooked to beat {beat}, which does not exist")
        elif tgt.get(key):
            issues.append(f"{mid}: two cutscenes on the same hook ({tgt[key]} and {cid})")
        else:
            tgt[key] = cid
    for s in steps:
        s.pop("_beat", None)
    # rewards
    rw = {}
    rtxt = re.search(r"\*\*Rewards\.\*\*(.*?)(?:\n\*\*|\Z)", body, re.S)
    rtxt = rtxt.group(1) if rtxt else ""
    cash = re.search(r"₦([\d,]+)", rtxt)
    if cash:
        rw["cash"] = int(cash.group(1).replace(",", ""))
    stand = {}
    for m in re.finditer(r"\b([A-Z][a-z]+) ([+−-]\d+)", rtxt):
        k = STANDING.get(m.group(1).lower())
        if k:
            stand[k] = stand.get(k, 0) + int(m.group(2).replace("−", "-"))
    if stand:
        rw["standing"] = stand
    fr = {}
    for m in re.finditer(r"(?:Friendship:?\s*)?(@\w+|[A-Z][a-z]+(?: [A-Z][a-z]+)?) \+(\d+)", rtxt):
        who = m.group(1)
        if STANDING.get(who.lower()) or who in ("XP",):
            continue
        sp = npc_of(who, known, ctx)
        if sp and not sp.startswith("crowd:") and not sp.startswith("phone:"):
            fr[sp] = fr.get(sp, 0) + int(m.group(2))
    if fr:
        rw["friend"] = fr
    sets = re.search(r"\*\*Sets / pays\.\*\*\s*Sets (.*?)(?:\.\s|\n)", body)
    if sets:
        chosen = {f for c in [CHOICES.get(mid)] if c for o in c["options"] for f in o.get("set", [])}
        fl = [f for f in re.findall(r"`([a-z0-9_<>]+)`", sets.group(1)) if "<" not in f and f not in chosen]
        rw["flags"] = [f for f in dict.fromkeys(fl) if not (f.endswith("_lost") and f[:-5] + "_won" in fl)]
    xp = re.search(r"([\d,]+) XP", rtxt)
    if xp:
        rw["xp"] = int(xp.group(1).replace(",", ""))
    fail = re.search(r"\*\*If it goes wrong\.\*\*\s*(.*?)(?:\n\n|\Z)", body, re.S)
    around = {"radio": [], "walker": [], "phone": []}
    at = body.split("**Around it.**", 1)[1] if "**Around it.**" in body else ""
    for m in re.finditer(r"^- (RADIO|WALKER|PHONE)[^:]*:\s*(.*?)\s*\[v:", at, re.M):
        k = m.group(1).lower()
        around[k].append(m.group(2) if k == "walker" else [k, m.group(2)])
    m = {"id": mid, "year": 1, "sem": sem, "gate": gate, "title": title, "intro": re.sub(r"\s+", " ", premise.group(1)).strip() if premise else title,
         "steps": steps, "reward": rw, "around": around}
    if fail:
        m["fail"] = {"text": re.sub(r"\s+", " ", fail.group(1)).strip().split(". ")[0][:140] + ".", "resume": 0}
    return m


def num(s):
    m = re.search(r"×\s*(\d+)", s)
    return int(m.group(1)) if m else 1


def step_of(tag, text, ctx, known, items, last_place):
    tag = tag.strip()
    kind, _, arg = tag.partition(":")
    kind, arg = kind.strip().lower(), arg.strip()
    kind = re.sub(r"\s*×\s*\d+", "", kind)
    night = ", night" in arg or arg.endswith(" night")
    arg0 = re.split(r",", arg)[0].strip()
    at = re.search(r"at ([@\w ]+)", arg)
    st = {"t": kind, "text": text}
    if kind == "go":
        st["place"] = place_of(arg0, ctx)
        if night:
            st["night"] = True
    elif kind in ("talk", "give"):
        if arg0:
            st["npc"] = npc_of(re.sub(r"\s+at\s+.*$", "", arg0), known, ctx)
            if at:
                st["npcAt"] = place_of(at.group(1), ctx)
            if st["npc"].startswith(("crowd:", "phone:")):
                st = {"t": "look", "text": text, "place": place_of(at.group(1), ctx) if at else last_place, "secs": 3}
        else:
            st = {"t": "turn", "text": text}
        if kind == "give":
            st["t"] = "talk" if st.get("npc") else "turn"
    elif kind == "choice":
        st = {"t": "turn", "text": text}
    elif kind == "eat" or kind == "sleep" or kind == "class":
        if kind == "class":
            p = re.search(r"pass (\d+)", arg)
            st["pass"] = int(p.group(1)) if p else 3
    elif kind == "emote":
        st["emote"] = arg0 or "wave"
        if at:
            st["at"] = place_of(at.group(1), ctx)
    elif kind == "ride":
        st["veh"] = {"plane": "plane", "keke": "keke", "car": "car", "bike": "bike", "okada": "okada", "scooter": "scooter"}.get(arg0, "bike")
    elif kind == "race":
        r = next((v for k, v in RACES.items() if k in arg.lower()), None) or (arg0 if re.match(r"r\d$", arg0) else None)
        st["race"] = r or "r1"
        if "finish" in arg.lower() or "restart" in arg.lower():
            st = {"t": "turn", "text": text}
    elif kind == "fight":
        st["enemy"] = arg0.split("×")[0].strip() or "shade"
        st["n"] = num(arg)
        st["at"] = place_of(at.group(1), ctx) if at else last_place
    elif kind == "find":
        name = re.sub(r"\s+at\s+.*$", "", re.sub(r"×\s*\d+", "", arg0)).strip()
        st["item"] = item_of(name, items)
        st["at"] = place_of(at.group(1), ctx) if at else last_place
        if num(arg) > 1:
            st = {"t": "collect", "text": text, "item": st["item"], "n": num(arg), "at": st["at"]}
    elif kind == "buy":
        st["item"] = item_of(re.sub(r"×\s*\d+", "", arg.split(",")[0]).strip(), items)
        if not items[st["item"]].get("price"):
            items[st["item"]]["price"] = PRICES.get(st["item"], 500)
    elif kind in ("watch", "listen", "photo", "look"):
        st = {"t": "look" if kind == "photo" else kind, "text": text, "place": place_of(arg0, ctx) if arg0 else last_place, "secs": 3 if kind == "photo" else 6}
    elif kind == "stealth":
        st["place"] = place_of(arg0, ctx)
    elif kind == "defend":
        s = re.search(r"(\d+)\s*s", arg)
        st.update({"place": place_of(arg0, ctx), "secs": int(s.group(1)) if s else 60, "enemy": "shade"})
    elif kind == "collect":
        cname = re.sub(r"\s+at\s+.*$", "", re.sub(r"×\s*\d+", "", arg0)).strip()
        many = re.search(r"\bat\s+(.+)$", arg)
        spots = [place_of(x.strip(), ctx) for x in many.group(1).split(",")] if many and "," in many.group(1) else None
        st.update({"item": item_of(cname, items), "n": num(arg), "at": spots[0] if spots else place_of(at.group(1), ctx) if at else last_place})
        if spots:
            st["places"] = spots
    elif kind == "carry":
        m = re.match(r"(.*?)\s*→\s*(.*)", arg)
        st.update({"item": item_of(m.group(1) if m else arg0, items), "place": place_of(m.group(2) if m else last_place, ctx)})
    elif kind == "job":
        m = re.match(r"carry (.*?)(?:,.*)?\s*→\s*(.*)", arg)
        if m:
            st = {"t": "carry", "text": text, "item": item_of(re.sub(r"×\s*\d+", "", m.group(1)).strip(), items), "place": place_of(m.group(2), ctx)}
        else:
            st["kind"] = "delivery" if "deliver" in arg else ""
            if not st["kind"]:
                del st["kind"]
    elif kind == "care":
        who = npc_of(arg0, known, ctx)
        st = {"t": "care", "text": text, "npc": who} if not who.startswith("crowd:") else {"t": "look", "text": text, "place": last_place, "secs": 6}
    elif kind == "build":
        st = {"t": "build", "text": text, "place": last_place, "parts": {}}
    elif kind == "rhythm":
        st.update({"soft": True, "pass": 1})
    elif kind == "flight":
        st["route"] = [place_of(arg0.replace("over the ", "").replace("over ", ""), ctx)]
    elif kind in ("turn", "quiet", "switch"):
        st = {"t": "turn", "text": text}
    else:
        issues.append(f"{ctx}: tag [{tag}] not mapped → turn")
        st = {"t": "turn", "text": text}
    return st


def main():
    sheets = people(SHEETS.read_text(encoding="utf8"))
    known = set(sheets) | {"porter", "bola"}
    items = {}
    missions = []
    import build_cutscenes as BC  # the cutscene blocks are cut out of the text here and built into fslg-cutscenes-y1.js there
    for p in SCRIPTS:
        text = p.read_text(encoding="utf8")
        HOOKS.update(BC.hooks(text))
        missions += parse_missions(BC.strip(text), known, items)
    npcs = [npc_def(p, k) for k, p in enumerate(sheets.values()) if p["id"] not in ("bolaji", "entropy", "maker")]
    bol = sheets.get("bolaji")
    patch = {"bola": {**(npc_def(bol, 3) if bol else {}), "id": "bola", "name": "Bolaji", "at": "court"}}
    for m in missions:  # an npc a step talks to must exist
        for s in m["steps"]:
            n = s.get("npc")
            if n and not n.startswith(("@", "crowd:", "phone:")) and n not in known:
                issues.append(f"{m['id']}: npc {n} has no sheet")
    data = {"file": "y1", "year": 1, "replaceYear1": True, "retire": ["sly"], "patch": patch, "npcs": npcs, "items": items, "missions": missions}
    js = ("/* Freshers School Life — Year 1 story (m1–m36), generated by tools/story/build_y1.py from docs/story/scripts/Y1.md,\n"
          "   Y1b.md and docs/story/CHARACTERS_BACKSTORY.md. Do not edit by hand: edit the scripts and re-run. */\n"
          "(function () {\n  \"use strict\";\n  var D = window.SamaruData; D.STORY = D.STORY || [];\n  D.STORY.push(" + json.dumps(data, ensure_ascii=False, indent=0) + ");\n})();\n")
    out = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else OUT  # --out FILE: a trial build somewhere else
    out.write_text(js, encoding="utf8")
    print(f"missions {len(missions)}, npcs {len(npcs)}, items {len(items)}, issues {len(issues)}")
    for i in issues:
        print("  -", i)


if __name__ == "__main__":
    sys.exit(main())
