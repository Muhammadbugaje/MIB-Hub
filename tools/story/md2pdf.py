"""Turn the story Markdown files into laid-out PDFs for the owner.

Copied from the old Django project (eehub-2/tools/story/md2pdf.py) on 15 Nov 2026 and pointed at docs/plan.
Run with the local Python environment (see tools/story/README.md):
    .venv/bin/python tools/story/md2pdf.py                  # builds every PDF listed in BOOKS
    .venv/bin/python tools/story/md2pdf.py MISSION_SCRIPTS  # builds one

Handles the Markdown these files use: headings, paragraphs, bullet and numbered lists, block quotes,
pipe tables, fenced code blocks, **bold**, *italic* and `code`. Story packs add two blocks of their own:
    ::: Mission title | a small note          a coloured header band
    :: 1 | how to say it | The line to read   a line to read aloud, in big type (consecutive lines make one block)
"""
import re
import sys
import textwrap
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (KeepTogether, PageBreak, Paragraph, Preformatted, SimpleDocTemplate, Spacer, Table,
                                TableStyle)

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / "docs" / "plan"
AMBER, INK, SOFT, LINE, TINT = (colors.HexColor(c) for c in ("#b45309", "#111827", "#6b7280", "#e5e7eb", "#fff7ed"))

F, FB, FI, FM = "Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Courier"
UNI = False
for base in ("/System/Library/Fonts/Supplemental", "/Library/Fonts", "/usr/share/fonts/truetype/dejavu", "C:/Windows/Fonts"):
    for reg, bold, ital in (("Arial.ttf", "Arial Bold.ttf", "Arial Italic.ttf"), ("arial.ttf", "arialbd.ttf", "ariali.ttf"),
                            ("DejaVuSans.ttf", "DejaVuSans-Bold.ttf", "DejaVuSans-Oblique.ttf")):
        if not UNI and all((Path(base) / n).exists() for n in (reg, bold, ital)):
            pdfmetrics.registerFont(TTFont("SF", str(Path(base) / reg)))
            pdfmetrics.registerFont(TTFont("SF-B", str(Path(base) / bold)))
            pdfmetrics.registerFont(TTFont("SF-I", str(Path(base) / ital)))
            pdfmetrics.registerFontFamily("SF", normal="SF", bold="SF-B", italic="SF-I", boldItalic="SF-B")
            F, FB, FI, UNI = "SF", "SF-B", "SF-I", True

BOOKS = {  # key: (sources relative to docs/plan, title). The PDF is written to docs/plan/<key>.pdf
    "STORY_BIBLE_V2": (["STORY_BIBLE_V2.md"], "Story Bible v2"),
    "MISSION_SCRIPTS": (["missions/Y1.md", "missions/Y2.md", "missions/Y3.md", "missions/Y4.md", "missions/Y5.md",
                         "missions/INTEGRATION_Y3_5.md", "missions/FORMAT.md"], "The Complete Mission Scripts"),
    "STORY_AUDIT": (["STORY_AUDIT.md"], "Story Audit"),
    "ASSET_AND_MOTION_PLAN": (["ASSET_AND_MOTION_PLAN.md"], "Asset, Animation and Physics Plan"),
    "HOW_TO_RUN": (["../HOW_TO_RUN.md"], "How to Run MIB-Hub", "docs"),
    "DEPLOY_CLOUDFLARE": (["../DEPLOY_CLOUDFLARE.md"], "Deploying MIB-Hub to Cloudflare", "docs"),
    "JIYA_STORY_PACK": (["people/JIYA_STORY_PACK.md"], "Jiya's Story Pack", "docs/plan/people"),
    "TATY_STORY_PACK": (["people/TATY_STORY_PACK.md"], "Taty's Story Pack", "docs/plan/people"),
}

ST = {
    "body": ParagraphStyle("body", fontName=F, fontSize=9.6, leading=13.4, textColor=INK, spaceAfter=4),
    "h1": ParagraphStyle("h1", fontName=FB, fontSize=20, leading=24, textColor=INK, spaceBefore=6, spaceAfter=10),
    "h2": ParagraphStyle("h2", fontName=FB, fontSize=14.5, leading=18, textColor=AMBER, spaceBefore=12, spaceAfter=6),
    "h3": ParagraphStyle("h3", fontName=FB, fontSize=11.5, leading=15, textColor=INK, spaceBefore=10, spaceAfter=4),
    "h4": ParagraphStyle("h4", fontName=FB, fontSize=10, leading=13, textColor=INK, spaceBefore=6, spaceAfter=3),
    "li": ParagraphStyle("li", fontName=F, fontSize=9.6, leading=13.2, textColor=INK, leftIndent=12, bulletIndent=2, spaceAfter=2),
    "li2": ParagraphStyle("li2", fontName=F, fontSize=9.4, leading=13, textColor=INK, leftIndent=24, bulletIndent=14, spaceAfter=1.5),
    "quote": ParagraphStyle("quote", fontName=FI, fontSize=9.4, leading=13, textColor=SOFT, leftIndent=10, spaceAfter=4),
    "cell": ParagraphStyle("cell", fontName=F, fontSize=8.2, leading=10.6, textColor=INK),
    "cellh": ParagraphStyle("cellh", fontName=FB, fontSize=8.2, leading=10.6, textColor=colors.white),
    "code": ParagraphStyle("code", fontName=FM, fontSize=7.8, leading=10, textColor=INK, backColor=TINT, leftIndent=6),
    "title": ParagraphStyle("title", fontName=FB, fontSize=30, leading=36, textColor=INK, alignment=TA_CENTER),
    "sub": ParagraphStyle("sub", fontName=F, fontSize=12, leading=16, textColor=SOFT, alignment=TA_CENTER),
    # Story packs only: the "::: band" and ":: script line" blocks (see band() and script_lines()).
    "band": ParagraphStyle("band", fontName=FB, fontSize=12, leading=15, textColor=colors.white),
    "bandnote": ParagraphStyle("bandnote", fontName=F, fontSize=8.8, leading=11.6, textColor=colors.HexColor("#ffedd5")),
    "snum": ParagraphStyle("snum", fontName=FB, fontSize=11, leading=15, textColor=AMBER, alignment=TA_CENTER),
    "sline": ParagraphStyle("sline", fontName=F, fontSize=11, leading=15, textColor=INK),
}


def tx(s):
    s = s.replace("★", "*")  # no star glyph in Arial
    if not UNI:
        for a, b in (("₦", "N"), ("“", '"'), ("”", '"'), ("‘", "'"), ("’", "'"), ("—", "-"), ("–", "-"), ("…", "..."),
                     ("→", "->"), ("★", "*"), ("×", "x"), ("≤", "<="), ("·", "-")):
            s = s.replace(a, b)
    return s


def inline(s):
    """Markdown inline marks to reportlab markup."""
    s = tx(s)
    parts = re.split(r"(`[^`]+`)", s)
    out = []
    for p in parts:
        if p.startswith("`") and p.endswith("`") and len(p) > 1:
            out.append('<font face="%s" size="8.4">%s</font>' % (FM, escape(p[1:-1])))
            continue
        p = escape(p)
        p = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", p)
        p = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<i>\1</i>", p)
        p = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r'<link href="\2" color="#b45309">\1</link>', p)
        out.append(p)
    return "".join(out)


def table(rows, width):
    rows = [r for r in rows if not re.fullmatch(r"\s*:?-{2,}:?\s*", "".join(r).replace(" ", "")[:3] or "x")]
    rows = [r for r in rows if not all(re.fullmatch(r":?-{3,}:?", c.strip()) for c in r)]
    if not rows:
        return None
    n = max(len(r) for r in rows)
    rows = [r + [""] * (n - len(r)) for r in rows]
    lens = [max(len(r[i]) for r in rows) for i in range(n)]
    total = sum(min(max(l, 4), 60) for l in lens) or 1
    cw = [width * min(max(l, 4), 60) / total for l in lens]
    floor = min(44.0, width / n)
    short = sum(floor - w for w in cw if w < floor)
    big = sum(w for w in cw if w >= floor) or 1
    cw = [floor if w < floor else w - short * w / big for w in cw]
    data = [[Paragraph(inline(c.strip()), ST["cellh"] if i == 0 else ST["cell"]) for c in r] for i, r in enumerate(rows)]
    t = Table(data, colWidths=cw, repeatRows=1)
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), AMBER), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                           ("GRID", (0, 0), (-1, -1), 0.4, LINE), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, TINT]),
                           ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                           ("TOPPADDING", (0, 0), (-1, -1), 2.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5)]))
    return t


def band(text, width):
    """A coloured header band: '::: Title | optional small note'. It stays with the block that follows it."""
    title, _, note = (x.strip() for x in text.partition("|"))
    cell = [Paragraph(inline(title), ST["band"])] + ([Paragraph(inline(note), ST["bandnote"])] if note else [])
    t = Table([[cell]], colWidths=[width])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), AMBER), ("LEFTPADDING", (0, 0), (-1, -1), 8),
                           ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 5),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    t.keepWithNext = True
    return t


LONG_BLOCK = 16  # a block of lines longer than this cannot stay on one page with its band


def script_lines(rows, width, head=None):
    """Lines to read aloud: ':: number | how to say it | the line'. Big type, one row per line.

    A long block may be given its band text as `head`: the band then becomes the block's first row and is
    printed again at the top of each page the block runs on to.
    """
    data = []
    if head is not None:
        title, _, note = (x.strip() for x in head.partition("|"))
        data.append([[Paragraph(inline(title), ST["band"])] +
                     ([Paragraph(inline(note), ST["bandnote"])] if note else []), ""])
    for r in rows:
        r = r + [""] * (3 - len(r))
        mood = ('<font size="7.6" color="#b45309"><b>%s</b></font><br/>' % inline(r[1].upper())) if r[1] else ""
        cue = re.match(r"\(\((.+?)\)\)\s*(.*)$", r[2])  # optional "((the line said just before))", in small grey type
        if cue:
            mood += '<font size="8.4" color="#6b7280"><i>%s</i></font><br/>' % inline(cue.group(1))
            r[2] = cue.group(2)
        data.append([Paragraph(inline(r[0]), ST["snum"]), Paragraph(mood + inline(r[2]), ST["sline"])])
    t = Table(data, colWidths=[11 * mm, width - 11 * mm])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE),
                           ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, TINT]),
                           ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                           ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                           ("TOPPADDING", (0, 0), (0, -1), 13)]))
    if head is not None:
        t.repeatRows = 1
        t.setStyle(TableStyle([("SPAN", (0, 0), (-1, 0)), ("BACKGROUND", (0, 0), (-1, 0), AMBER),
                               ("LEFTPADDING", (0, 0), (-1, 0), 8), ("RIGHTPADDING", (0, 0), (-1, 0), 8),
                               ("TOPPADDING", (0, 0), (-1, 0), 5), ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                               ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, TINT])]))
    return t


def flow(md, width):
    out, lines, i = [], md.split("\n"), 0
    para = []

    def flush():
        if para:
            out.append(Paragraph(inline(" ".join(x.strip() for x in para)), ST["body"]))
            para.clear()

    while i < len(lines):
        ln = lines[i]
        s = ln.strip()
        if s.startswith("```"):
            flush()
            j = i + 1
            block = []
            cols = int((width - 6) / (0.6 * ST["code"].fontSize))  # Courier is 0.6 em wide
            while j < len(lines) and not lines[j].strip().startswith("```"):
                raw = tx(lines[j])
                pad = " " * (len(raw) - len(raw.lstrip()) + 4)
                block += textwrap.wrap(raw, cols, subsequent_indent=pad, drop_whitespace=False) or [""]
                j += 1
            out.append(Preformatted("\n".join(block), ST["code"]))
            out.append(Spacer(1, 4))
            i = j + 1
            continue
        if s.startswith(":::"):  # story packs: a header band
            flush()
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            rows = []
            while j < len(lines) and lines[j].strip().startswith("::") and not lines[j].strip().startswith(":::"):
                rows.append([c.strip() for c in lines[j].strip()[2:].split("|", 2)])
                j += 1
            if len(rows) > LONG_BLOCK:  # too long for one page: the band travels with the lines instead
                out += [script_lines(rows, width, head=s[3:]), Spacer(1, 10)]
                i = j
                continue
            out.append(band(s[3:], width))
            i += 1
            continue
        if s.startswith("::"):  # story packs: lines to read aloud
            flush()
            rows = []
            while i < len(lines) and lines[i].strip().startswith("::") and not lines[i].strip().startswith(":::"):
                rows.append([c.strip() for c in lines[i].strip()[2:].split("|", 2)])
                i += 1
            out += [script_lines(rows, width), Spacer(1, 10)]
            continue
        if s.startswith("|") and s.endswith("|"):
            flush()
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append([c for c in lines[i].strip().strip("|").split("|")])
                i += 1
            t = table(rows, width)
            if t:
                out += [t, Spacer(1, 6)]
            continue
        m = re.match(r"^(#{1,4})\s+(.*)$", s)
        if m:
            flush()
            lvl = len(m.group(1))
            if lvl == 1 and out:
                while isinstance(out[-1], Spacer) and len(out) > 1:
                    out.pop()  # a spacer pushed over the page end would leave a blank page before the break
                out.append(PageBreak())
            h = Paragraph(inline(m.group(2)), ST["h%d" % lvl])
            h.keepWithNext = True  # never leave a heading alone at the foot of a page
            out.append(h)
            i += 1
            continue
        if s.startswith("<!--") and s.endswith("-->"):  # a one-line comment: never printed
            flush()
            i += 1
            continue
        if s in ("---", "***"):
            flush()
            out.append(Spacer(1, 6))
            i += 1
            continue
        m = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)$", ln)
        if m:
            flush()
            text = m.group(3)
            j = i + 1
            while j < len(lines) and lines[j].strip() and not re.match(r"^\s*([-*]|\d+\.)\s+|^\s*[|#>]", lines[j]) \
                    and lines[j].startswith("  "):
                text += " " + lines[j].strip()
                j += 1
            deep = len(m.group(1)) >= 2
            bullet = m.group(2) if m.group(2)[0].isdigit() else "•"
            out.append(Paragraph(inline(text), ST["li2" if deep else "li"], bulletText=bullet))
            i = j
            continue
        if s.startswith(">"):
            flush()
            q = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                q.append(lines[i].strip().lstrip(">").strip())
                i += 1
            out.append(Paragraph(inline(" ".join(q)), ST["quote"]))
            continue
        if not s:
            flush()
            i += 1
            continue
        if s.startswith("**") and para:
            flush()  # "**Label.**" lines start their own paragraph
        para.append(s)
        i += 1
    flush()
    return out


# Owner-only planning documents. Everything else (story packs, voice scripts) is made to be sent to the person.
OWNER_ONLY = {"STORY_BIBLE_V2", "MISSION_SCRIPTS", "STORY_AUDIT", "ASSET_AND_MOTION_PLAN", "HOW_TO_RUN", "DEPLOY_CLOUDFLARE"}


# Opt-in, per document: a first line of "<!-- pack-style: roomy -->" sets bigger, airier reading type for that
# one PDF (made for reading on a phone). Every other book keeps the standard styles.
ROOMY = {"body": dict(fontSize=10.8, leading=16, spaceAfter=7),
         "li": dict(fontSize=10.8, leading=15.6, spaceAfter=4, leftIndent=16, bulletIndent=3),
         "li2": dict(fontSize=10.4, leading=15, spaceAfter=3),
         "quote": dict(fontSize=13, leading=18, textColor=AMBER, leftIndent=14, spaceBefore=4, spaceAfter=10),
         "h1": dict(fontSize=24, leading=29, spaceAfter=12),
         "h2": dict(fontSize=16.5, leading=21, spaceBefore=18, spaceAfter=8),
         "h3": dict(fontSize=13, leading=17, spaceBefore=14, spaceAfter=5),
         "h4": dict(fontSize=11.6, leading=15, spaceBefore=13, spaceAfter=3, textColor=AMBER)}


def restyle(changes):
    """Apply style changes and return what is needed to undo them."""
    old = {name: {k: getattr(ST[name], k) for k in attrs} for name, attrs in changes.items()}
    for name, attrs in changes.items():
        for k, v in attrs.items():
            setattr(ST[name], k, v)
    return old


def audience(key):
    if key in OWNER_ONLY:
        return "Private to the owner"
    if key.endswith("_STORY_PACK"):
        return "Made for you, with thanks"
    return "For the cast, please keep it private"


def cover_info(text):
    """A story pack can ask for a designed cover with "<!-- cover: Name | tagline -->" near the top."""
    m = re.search(r"<!--\s*cover:\s*([^|>]+?)\s*\|\s*([^|>]+?)\s*(?:\|\s*(#\w{6})\s*,\s*(#\w{6})\s*)?-->", text[:2000])
    return (m.group(1), m.group(2), m.group(3) or "#f59e0b", m.group(4) or "#22d3ee") if m else None


COVER_LABEL = "Your Story Pack"
COVER_INSIDE = "Inside: a letter  ·  the game  ·  the whole story  ·  your missions  ·  your lines"


def cover_extra(text, key, default):
    """Optional "<!-- cover-label: ... -->" and "<!-- cover-inside: ... -->" change the two fixed lines of the cover."""
    m = re.search(r"<!--\s*cover-%s:\s*(.+?)\s*-->" % key, text[:2000])
    return m.group(1) if m else default


def draw_cover(c, name, tagline, note, warm="#f59e0b", cool="#22d3ee", label=COVER_LABEL, inside=COVER_INSIDE):
    """Full-bleed dark cover: glowing bands, the person's name huge, the tagline, a small footer."""
    W, H = A4
    c.saveState()
    c.setFillColor(colors.HexColor("#0b1020"))
    c.rect(0, 0, W, H, stroke=0, fill=1)
    # soft diagonal light bands (gold and cyan), stacked with low alpha for a glow
    for col, x0, w in ((warm, -40, 230), (cool, 260, 150), (warm, 430, 90)):
        for k in range(18):
            c.setFillColor(colors.HexColor(col), alpha=0.022)
            p = c.beginPath()
            off = k * w / 38
            p.moveTo(x0 + off, H)
            p.lineTo(x0 + w - off, H)
            p.lineTo(x0 + w - off - 330, 0)
            p.lineTo(x0 + off - 330, 0)
            p.close()
            c.drawPath(p, stroke=0, fill=1)
    # a thin gold rule and the eyebrow
    m = 22 * mm
    c.setFillColor(colors.HexColor("#f59e0b"))
    c.rect(m, H - 40 * mm, 18 * mm, 1.6, stroke=0, fill=1)
    c.setFont(FB, 9.5)
    c.setFillColor(colors.HexColor("#fbbf24"))
    c.drawString(m, H - 46 * mm, tx("MIB-HUB  ·  A BROWSER GAME ABOUT FIVE YEARS OF CAMPUS LIFE"))
    # the name, huge
    size = 110 if len(name) <= 6 else 84
    wide = pdfmetrics.stringWidth(tx(name.upper()), FB, size)
    if wide > W - 2 * m:  # a long name: shrink it to fit between the margins
        size = max(36, size * (W - 2 * m) / wide)
    c.setFillColor(colors.white)
    c.setFont(FB, size)
    c.drawString(m - 3, H * 0.47, tx(name.upper()))
    c.setFont(FB, 30)
    c.setFillColor(colors.HexColor("#fbbf24"))
    c.drawString(m, H * 0.47 - 40, tx(label))
    # tagline, wrapped
    c.setFont(F, 14)
    c.setFillColor(colors.HexColor("#cbd5e1"))
    y = H * 0.47 - 78
    for ln in textwrap.wrap(tx(tagline), 52):
        c.drawString(m, y, ln)
        y -= 20
    # what's inside
    c.setFont(F, 10)
    c.setFillColor(colors.HexColor("#94a3b8"))
    c.drawString(m, 34 * mm, tx(inside))
    c.setFillColor(colors.HexColor("#334155"))
    c.rect(m, 28 * mm, W - 2 * m, 0.6, stroke=0, fill=1)
    c.setFillColor(colors.HexColor("#94a3b8"))
    c.drawString(m, 21 * mm, tx(note))
    c.restoreState()


def build(key):
    files, title, *where = BOOKS[key]
    srcs = [PLAN / f for f in files if (PLAN / f).exists()]
    if not srcs:
        print("skip", key, "(no source)")
        return None
    out = (ROOT / where[0] if where else PLAN) / (key + ".pdf")
    doc = SimpleDocTemplate(str(out), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm,
                            bottomMargin=16 * mm, title=("{{GAME_NAME}}: " if key in OWNER_ONLY else "MIB-Hub: ") + title, author="Muhammad Iliyasu Bugaje")
    width = A4[0] - 36 * mm
    el = [Spacer(1, 70 * mm), Paragraph("MIB-HUB · THE OPEN-WORLD GAME", ST["sub"]), Spacer(1, 8), Paragraph(tx(title), ST["title"]),
          Spacer(1, 10), Paragraph(tx(audience(key) + " · " + date.today().strftime("%d %B %Y")), ST["sub"]), PageBreak()]
    texts = [src.read_text(encoding="utf8") for src in srcs]
    cv = cover_info(texts[0])
    if cv:
        el = [Spacer(1, 1), PageBreak()]  # the cover is drawn straight onto page 1
    undo = restyle(ROOMY) if texts[0].lstrip().startswith("<!-- pack-style: roomy -->") else {}
    for k, text in enumerate(texts):
        if k:
            el.append(PageBreak())
        el += flow(text, width)

    def page(c, d):
        c.saveState()
        c.setFont(F, 7.5)
        c.setFillColor(SOFT)
        c.drawString(18 * mm, 9 * mm, tx("MIB-Hub — " + title + " — " + audience(key).lower()))
        c.drawRightString(A4[0] - 18 * mm, 9 * mm, str(d.page))
        c.restoreState()

    try:
        first = (lambda c, d: draw_cover(c, cv[0], cv[1], audience(key) + " · " + date.today().strftime("%d %B %Y"), cv[2], cv[3],
                                         cover_extra(texts[0], "label", COVER_LABEL),
                                         cover_extra(texts[0], "inside", COVER_INSIDE))) \
            if cv else (lambda c, d: None)
        doc.build(el, onFirstPage=first, onLaterPages=page)
    finally:
        restyle(undo)
    from reportlab.lib.utils import open_for_read  # noqa: F401  (keeps reportlab's lazy imports happy)
    pages = len(re.findall(rb"/Type\s*/Page[^s]", out.read_bytes()))
    print("%s.pdf  %d pages" % (key, pages))
    return pages


if __name__ == "__main__":
    for k in (sys.argv[1:] or list(BOOKS)):
        build(k)
