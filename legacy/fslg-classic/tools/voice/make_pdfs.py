#!/usr/bin/env python3
"""Hand-out PDFs for the voice cast: one per role (instructions inside), a director's guide, and one combined file.
Run with the project environment (it has reportlab):  .venv/bin/python tools/voice/make_pdfs.py
Reads docs/voice/lines.json (written by tools/voice/make_script.js) and writes docs/voice/pdf/."""
import json, sys
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "voice" / "pdf"
AMBER, INK, SOFT = colors.HexColor("#b45309"), colors.HexColor("#111827"), colors.HexColor("#6b7280")

F, FB, FI, UNI = "Helvetica", "Helvetica-Bold", "Helvetica-Oblique", False
for base in ("/System/Library/Fonts/Supplemental", "/Library/Fonts", "/usr/share/fonts/truetype/dejavu", "C:/Windows/Fonts"):
    for reg, bold, ital in (("Arial.ttf", "Arial Bold.ttf", "Arial Italic.ttf"), ("arial.ttf", "arialbd.ttf", "ariali.ttf"), ("DejaVuSans.ttf", "DejaVuSans-Bold.ttf", "DejaVuSans-Oblique.ttf")):
        if not UNI and all((Path(base) / n).exists() for n in (reg, bold, ital)):
            pdfmetrics.registerFont(TTFont("VF", str(Path(base) / reg))); pdfmetrics.registerFont(TTFont("VF-B", str(Path(base) / bold))); pdfmetrics.registerFont(TTFont("VF-I", str(Path(base) / ital)))
            pdfmetrics.registerFontFamily("VF", normal="VF", bold="VF-B", italic="VF-I", boldItalic="VF-B")
            F, FB, FI, UNI = "VF", "VF-B", "VF-I", True


def tx(s):
    s = str(s)
    if not UNI:  # the built-in fonts have no naira sign or curly quotes
        for a, b in (("₦", "N"), ("“", '"'), ("”", '"'), ("‘", "'"), ("’", "'"), ("—", "-"), ("–", "-"), ("…", "..."), ("→", "->"), ("☐", "[ ]")):
            s = s.replace(a, b)
        s = s.encode("latin-1", "replace").decode("latin-1")
    return escape(s)


S = {
    "title": ParagraphStyle("title", fontName=FB, fontSize=26, leading=30, textColor=INK, spaceAfter=4),
    "kicker": ParagraphStyle("kicker", fontName=FB, fontSize=10, leading=13, textColor=AMBER, spaceAfter=6),
    "h2": ParagraphStyle("h2", fontName=FB, fontSize=14, leading=18, textColor=INK, spaceBefore=10, spaceAfter=4),
    "scene": ParagraphStyle("scene", fontName=FB, fontSize=13, leading=17, textColor=AMBER, spaceBefore=12, spaceAfter=2),
    "ctx": ParagraphStyle("ctx", fontName=FI, fontSize=10.5, leading=14, textColor=SOFT, spaceAfter=5),
    "body": ParagraphStyle("body", fontName=F, fontSize=11, leading=15.5, textColor=INK, spaceAfter=4),
    "step": ParagraphStyle("step", fontName=F, fontSize=11, leading=15.5, textColor=INK, leftIndent=16, bulletIndent=0, spaceAfter=3),
    "line": ParagraphStyle("line", fontName=F, fontSize=14, leading=19, textColor=INK),
    "num": ParagraphStyle("num", fontName=FB, fontSize=13, leading=19, textColor=AMBER),
    "linec": ParagraphStyle("linec", fontName=F, fontSize=12.5, leading=16, textColor=INK),
    "numc": ParagraphStyle("numc", fontName=FB, fontSize=11, leading=16, textColor=AMBER),
    "scenec": ParagraphStyle("scenec", fontName=FB, fontSize=12, leading=15, textColor=AMBER, spaceBefore=8, spaceAfter=1),
    "tone": ParagraphStyle("tone", fontName=FI, fontSize=9.5, leading=12.5, textColor=SOFT),
    "cell": ParagraphStyle("cell", fontName=F, fontSize=9.5, leading=12.5, textColor=INK),
    "cellb": ParagraphStyle("cellb", fontName=FB, fontSize=9.5, leading=12.5, textColor=INK),
    "box": ParagraphStyle("box", fontName=F, fontSize=11, leading=17, textColor=INK),
    "center": ParagraphStyle("center", fontName=FI, fontSize=10, leading=14, textColor=SOFT, alignment=TA_CENTER),
}
P = lambda text, style="body": Paragraph(text, S[style])


class Numbered(rl_canvas.Canvas):
    """Footer 'Role X — page n of m' needs the page total, so pages are kept and stamped at the end."""
    footer = ""

    def __init__(self, *a, **k):
        rl_canvas.Canvas.__init__(self, *a, **k); self._pages = []

    def showPage(self):
        self._pages.append(dict(self.__dict__)); self._startPage()

    def save(self):
        total = len(self._pages)
        for i, st in enumerate(self._pages):
            self.__dict__.update(st)
            self.setFont(F, 8.5); self.setFillColor(SOFT)
            label = getattr(self, "_footer_label", None) or self.footer
            self.drawString(18 * mm, 10 * mm, tx("Freshers School Life — voice cast"))
            self.drawRightString(A4[0] - 18 * mm, 10 * mm, tx("%s — page %d of %d" % (label, i + 1, total)))
            rl_canvas.Canvas.showPage(self)
        rl_canvas.Canvas.save(self)


def steps_list(steps):
    return [Paragraph("<b>%d.</b>&nbsp; %s" % (i + 1, st if UNI else st.replace("“", '"').replace("”", '"').replace("…", "...")), S["step"]) for i, st in enumerate(steps)]


def instructions(fname, extra=None):
    steps = [
        "Find a <b>quiet room</b> with soft things in it: a bedroom is better than a hall or a corridor. Fan, TV and generator off if you can. Phone on Do Not Disturb.",
        "Open your phone's <b>voice memo / recorder app</b>. Hold the phone about <b>15 cm</b> (one hand-span) from your mouth, a little to the side so you do not blow on the microphone. Keep that distance the whole time.",
        "Read the lines <b>in order</b>, as they are numbered. <b>Do not read the numbers aloud</b>, and do not read the small grey notes: they tell you <i>who</i> is speaking and <i>how</i>.",
        "<b>Pause for a full second</b> (count “one thousand and one”) between lines. Do not pause that long inside a line.",
        "If you fluff a line: stop, <b>clap once</b>, wait a second, and say the whole line again. Then keep going. The clap tells us to throw the bad take away.",
        "Act it. Read the short scene note first, picture the moment, then say the line the way you would really say it. Shouts should be shouted.",
    ] + (extra or []) + [
        "Need a break? Stop and start a new recording, and number the files in order (…_1, …_2).",
        "Any format is fine (m4a, mp3, wav, ogg, opus, aac, amr). Name the file <b>%s</b> with your own name in it, and send it back to the person who gave you this <b>as a file</b> (on WhatsApp: as a document, not a voice note)." % tx(fname),
    ]
    return [P(tx("How to record"), "h2")] + steps_list(steps)


def consent():
    box = Table([[P("<b>Consent.</b> I agree that my voice, recorded from this script, may be used in the game <i>Freshers School Life</i> and in videos and adverts for it. Tick the box and write your name, or simply say “I agree, my name is …” at the very start of your recording.", "box")],
                 [P("[ &nbsp;&nbsp; ] I agree &nbsp;&nbsp;&nbsp; Name: ________________________ &nbsp; Date: ___________ &nbsp; Signature: ______________", "box")]], colWidths=[174 * mm])
    box.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.8, AMBER), ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fffbeb")), ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
    return [Spacer(1, 6), box]


TIER = {"A": ("A", colors.HexColor("#b45309"), "Must record"), "B": ("B", colors.HexColor("#2563eb"), "Nice to have"), "C": ("C", colors.HexColor("#6b7280"), "Optional")}


def badge(t):
    return Paragraph("<font color='%s'><b>%s</b></font>" % (TIER[t][1].hexval().replace("0x", "#"), t), S["num"])


def lines_table(lines, tiers=True, compact=False):
    ls, ns = ("linec", "numc") if compact else ("line", "num")
    rows = [[P(tx(l["n"]), ns)] + ([badge(l["tier"])] if tiers else []) + [P(tx(l["text"]), ls), P(tx(l.get("tone") or ""), "tone")] for l in lines]
    t = Table(rows, colWidths=[18 * mm, 7 * mm, 107 * mm, 42 * mm] if tiers else [18 * mm, 114 * mm, 42 * mm])
    pad = 3 if compact else 6
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#e5e7eb")), ("TOPPADDING", (0, 0), (-1, -1), pad), ("BOTTOMPADDING", (0, 0), (-1, -1), pad + 1), ("LEFTPADDING", (0, 0), (1 if tiers else 0, -1), 0)]))
    return t


def scenes_flow(scenes, tiers=True, compact=False):
    el = []
    for sc in scenes:
        head = [P(tx(sc["title"]), "scenec" if compact else "scene")] + ([P(tx(sc["context"]), "ctx")] if sc.get("context") else [])
        el.append(KeepTogether(head + [lines_table(sc["lines"][:1], tiers, compact)]))  # a scene heading never sits alone at the foot of a page
        if sc["lines"][1:]:
            el.append(lines_table(sc["lines"][1:], tiers, compact))
    return el


def tier_counts(lines):
    return {t: sum(1 for l in lines if l["tier"] == t) for t in "ABC"}


def size_table(role):
    c, m = tier_counts(role["lines"]), role.get("tiers") or {}
    rows = [[P(tx("Tier %s · %s" % (t, TIER[t][2])), "cellb") for t in "ABC"] + [P("All", "cellb")],
            [P("%d lines · about %d min" % (c[t], m.get(t, 0)) if c[t] else "—", "cell") for t in "ABC"] + [P("%d lines · about %d min" % (len(role["lines"]), role["minutes"]), "cell")]]
    t = Table(rows, colWidths=[43.5 * mm] * 4)
    t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d1d5db")), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fef3c7")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    return t


def tier_bar(t, n, minutes):
    return Table([[P("<font color='white'><b>Tier %s · %s</b> · %d lines, about %d minutes</font>" % (t, TIER[t][2], n, minutes), "box")]], colWidths=[174 * mm],
                 style=[("BACKGROUND", (0, 0), (-1, -1), TIER[t][1]), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)])


def role_story(role):
    if not role["lines"]:
        return []
    el = [P(tx("FRESHERS SCHOOL LIFE · VOICE CAST"), "kicker"), P(tx(role["label"]), "title"),
          P("<b>Who should read this:</b> %s" % tx(role["who"])), P("<b>Who you are playing:</b> %s" % tx(role.get("characters") or "—")),
          P("<b>How it should sound:</b> %s" % tx(role["sound"]))]
    if role.get("owner"):
        el.append(P("<b>This role is for the maker of the game himself.</b>"))
    el += [Spacer(1, 4), size_table(role), Spacer(1, 2),
           P("<b>Do Tier A first.</b> The lines are printed tier by tier: <font color='#b45309'><b>A</b></font> must record, then <font color='#2563eb'><b>B</b></font> if you can, then <font color='#6b7280'><b>C</b></font> only if you have time. Read in order from line 1 and stop wherever you run out of time; send what you have. Within each tier the lines follow the story from the first day of the game.", "body")]
    el += instructions("%s_yourname.m4a" % role["id"]) + consent() + [PageBreak()]
    for t in "ABC":
        sc = [x for x in role["scenes"] if x.get("tier") == t]
        if not sc:
            continue
        n = sum(len(x["lines"]) for x in sc)
        if t != "A":
            el.append(PageBreak())
        el.append(KeepTogether([tier_bar(t, n, (role.get("tiers") or {}).get(t, 0))]))
        el += scenes_flow(sc, tiers=False)
    el += [Spacer(1, 14), P(tx("End of %s. Thank you! Send your file back as %s_yourname.m4a" % (role["label"], role["id"])), "center")]
    return el


def filler_story(data):
    f = data.get("filler") or {}
    if not f.get("lines"):
        return []
    el = [P(tx("FRESHERS SCHOOL LIFE · VOICE CAST"), "kicker"), P(tx("Filler phrases"), "title"),
          P("<b>Who should read this:</b> anyone, and the more different people the better. Every reader records the shared phrases; then a man also reads <b>Men only</b> and a woman also reads <b>Women only</b> (skip the other one)."),
          P("<b>What it is for:</b> the game has thousands of lines and not all of them will be recorded. When a character has a line nobody has recorded, the words appear in the speech bubble and the game plays one of <i>your</i> phrases that fits the mood: a “Haba!”, a “How far?”, a laugh. So these are the voices people will hear most."),
          P("<b>How it should sound:</b> your own natural voice and your normal Nigerian English, with the Pidgin, Hausa, Yoruba or Igbo exactly as written. Do not put on a voice. Where a line says <i>(a short laugh)</i> or <i>(a sigh)</i>, make that sound; do not read the words."),
          P("<b>Size:</b> %d shared phrases, plus %d for men or %d for women. About %d minutes." % (f["shared"], f["men"], f["women"], f["minutes"] + 2))]
    el += instructions("filler_m_yourname.m4a (if you are a man) or filler_f_yourname.m4a (if you are a woman)", ["The grey note beside each phrase is its mood and what it is for. Give each one that feeling: “happy” should smile, “annoyed” should be annoyed."])
    el += consent() + [PageBreak()]
    shared_n = f["shared"]
    seen_m = seen_f = False
    for sc in f["scenes"]:
        first = sc["lines"][0] if sc["lines"] else None
        if first:
            idx = int(first["n"][1:])
            if idx > shared_n and not seen_m:
                seen_m = True
                el += [PageBreak(), P(tx("Men only"), "title"), P(tx("Only if you are a man. Women: skip to “Women only”. Keep the same recording going: carry straight on from the last shared phrase."), "ctx")]
            if idx > shared_n + f["men"] and not seen_f:
                seen_f = True
                el += [PageBreak(), P(tx("Women only"), "title"), P(tx("Only if you are a woman. Men: you have finished. Keep the same recording going: carry straight on from the last shared phrase."), "ctx")]
        el += scenes_flow([sc], tiers=False, compact=True)
    el += [Spacer(1, 14), P(tx("End of the filler phrases. Thank you! Send your file back as filler_m_yourname.m4a or filler_f_yourname.m4a."), "center")]
    return el


def build(path, story, footer, title):
    cls = type("C", (Numbered,), {"footer": footer})
    doc = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=18 * mm, title=title, author="Freshers School Life")
    doc.build(story, canvasmaker=cls)
    return doc.page


def director(data):
    roles, f = data["roles"], data.get("filler") or {}
    c = data.get("counts") or {}
    mA = sum((r.get("tiers") or {}).get("A", 0) for r in roles)
    mAB = sum((r.get("tiers") or {}).get("A", 0) + (r.get("tiers") or {}).get("B", 0) for r in roles)
    mAll = sum(r["minutes"] for r in roles)
    el = [P(tx("FRESHERS SCHOOL LIFE · VOICE CAST"), "kicker"), P(tx("Director's guide"), "title"),
          P(tx("%d roles plus the filler phrases, covering the whole game from the first day: all 120 missions, the side missions, the campus encounters, the Maker's sayings and the lines the game speaks around campus. %d recordings of %d different lines: %d must-record (A), %d nice-to-have (B), %d optional (C)."
               % (len(roles), sum(len(r["lines"]) for r in roles), data.get("unique", 0), c.get("A", 0), c.get("B", 0), c.get("C", 0)))),
          P(tx("Recording time: about %d minutes for every Tier A line, %d minutes for A and B, %d minutes for everything, plus about %d minutes per filler reader. Every role is printed tier by tier, so a reader who records only Tier A still lines up." % (mA, mAB, mAll, f.get("minutes", 0) + 2))),
          P(tx("Give each person ONE role PDF: instructions, tiers and a consent line are inside. Give the filler PDF to as many people as possible, including those with a role. Lines that many characters say are in several roles on purpose, so the same line is heard in different voices around campus.")),
          P(tx("Cast list"), "h2")]
    rows = [[P(tx(h), "cellb") for h in ("Role (PDF)", "Give it to", "Lines", "A / B / C", "Min: A / all", "Name")]]
    for i, r in enumerate(roles):
        k = tier_counts(r["lines"])
        rows.append([P(tx("%02d  %s" % (i + 1, r["label"])), "cellb"), P(tx(("YOU. " if r.get("owner") else "") + r["who"]), "cell"), P(str(len(r["lines"])), "cell"),
                     P("%d / %d / %d" % (k["A"], k["B"], k["C"]), "cell"), P("%d / %d" % ((r.get("tiers") or {}).get("A", 0), r["minutes"]), "cell"), P("", "cell")])
    if f.get("lines"):
        rows.append([P(tx("%02d  Filler phrases" % (len(roles) + 1)), "cellb"), P(tx("Everybody, as many people as possible"), "cell"), P(str(f["shared"] + max(f["men"], f["women"])), "cell"), P("all A", "cell"), P("%d" % (f["minutes"] + 2), "cell"), P("", "cell")])
    t = Table(rows, colWidths=[40 * mm, 50 * mm, 13 * mm, 25 * mm, 22 * mm, 24 * mm], repeatRows=1)
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d1d5db")), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fef3c7")), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    el += [t, PageBreak(), P(tx("Who plays whom"), "h2"), P(tx("Each role covers these characters, most lines first. New characters were given to the closest role by sex, age and type; change any of them in tools/voice/make_script.js (the SPEAK table) and run the command again."), "ctx")]
    rows = [[P("Role", "cellb"), P("Characters (most lines first)", "cellb")]]
    for r in roles:
        rows.append([P(tx(r["label"]), "cellb"), P(tx(", ".join(r.get("cast") or []) or (r.get("characters") or "—")), "cell")])
    t = Table(rows, colWidths=[44 * mm, 130 * mm], repeatRows=1)
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d1d5db")), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fef3c7")), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    el += [t, Spacer(1, 6), P(tx("Roommates. The player picks a roommate in m1. Lines written for “your roommate” are recorded by Bature (for male players) and Firdausi (for female players), the defaults. If a player picks another roommate (Sadiq, Muktar, Yusuf or Khalid; Nusaybah, Aleeya, Emily or Lily), that character's own named lines are recorded in their role, and the generic roommate lines fall back to a filler phrase in the right voice. Your crush and your best friend likewise have a male and a female version. Lines that contain a name filled in during play (@hostel, @dept) cannot be pre-recorded and are left out."), "ctx"), PageBreak(), P(tx("Collecting the recordings"), "h2")]
    el += steps_list([
        "Send each person their PDF (WhatsApp is fine) and a deadline. Ask them to send the audio back <b>as a file</b> (a document), not as a voice note, so it is not squeezed.",
        "Names: <b>&lt;role&gt;_&lt;name&gt;.m4a</b>, for example bature_m_musa.m4a; filler phrases as <b>filler_m_&lt;name&gt;.m4a</b> or <b>filler_f_&lt;name&gt;.m4a</b>. If a file arrives with another name, just rename it; the role id is printed on the first page of each PDF. Several sittings: add _1, _2.",
        "Drop every file into the <b>voice_in/</b> folder of the project. (A folder per person also works: <b>voice_in/bature_m@musa/</b> with any file names inside.)",
        "Two people can record the same role: both are used, and each character keeps one of them. More readers for <b>Crowd</b> and the <b>filler phrases</b> make the campus sound fuller.",
        "Run one command in the project folder: <b>sh tools/voice/run.sh</b>",
        "Open <b>voice_review/index.html</b>. For each person it lists every clip with a play button beside the line it should be. Rows in orange mean the number of clips does not match the script, which is normal when someone stopped after Tier A.",
        "To fix a file that is out of step, add it to <b>voice_in/offsets.json</b> and run the command again: <b>skip</b> drops a clip by its number, <b>merge</b> joins a line that was cut in two, <b>gap</b> changes how much silence separates lines. Example: {\"bature_m@musa\": {\"skip\": [12], \"merge\": [30]}}",
        "Reload the game. Recorded lines are spoken. A line nobody has recorded shows its words and plays a filler phrase that fits; with no filler recorded yet, a soft murmur. Players can switch this in Settings → Sound → “Fill unrecorded lines with”.",
    ])
    el += [P(tx("Checklist"), "h2")]
    for c2 in ["Every role has a name beside it in the cast list", "Each person has their PDF and knows the deadline", "You have recorded your own roles: " + ", ".join(r["label"] for r in roles if r.get("owner")), "At least two men and two women have recorded the filler phrases",
               "Every file is in voice_in/ and named <role>_<name>", "Everyone ticked the consent line or said “I agree” on the recording", "sh tools/voice/run.sh ran, and the only lines starting with “!” are people who stopped early",
               "Every clip on the review page says the right line", "You played the game and heard them"]:
        el.append(P("[ &nbsp;&nbsp; ]&nbsp; %s" % tx(c2), "step"))
    el += [P(tx("When the story changes"), "h2"), P(tx("The scripts in docs/story/scripts are read every time the command runs. A line's id comes from its words, so recordings of unchanged lines keep working whatever their number. If a script changes after someone has recorded, their clips may fall out of step from that point: the review page shows where, and offsets.json fixes it."))]
    return el


def main():
    data = json.loads((ROOT / "docs" / "voice" / "lines.json").read_text(encoding="utf8"))
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.pdf"):
        old.unlink()
    made, combined = [], []
    made.append(("00_DIRECTOR_GUIDE.pdf", build(OUT / "00_DIRECTOR_GUIDE.pdf", director(data), "Director's guide", "FSLG voice cast: director's guide")))
    for i, r in enumerate(data["roles"]):
        name = "%02d_%s.pdf" % (i + 1, r["id"])
        made.append((name, build(OUT / name, role_story(r), r["label"], "FSLG voice role: " + r["label"])))
        combined += role_story(r) + [PageBreak()]
    fs = filler_story(data)
    if fs:
        made.append(("FILLER_PHRASES.pdf", build(OUT / "FILLER_PHRASES.pdf", fs, "Filler phrases", "FSLG voice cast: filler phrases")))
        combined += fs + [PageBreak()]
    made.append(("ALL_ROLES.pdf", build(OUT / "ALL_ROLES.pdf", director(data) + [PageBreak()] + combined[:-1], "All roles", "FSLG voice cast: all roles")))
    print(json.dumps({"font": F, "files": made}))


if __name__ == "__main__":
    main()
