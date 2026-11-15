"""Turn the story Markdown files into laid-out PDFs for the owner.

Copied from the old Django project (eehub-2/tools/story/md2pdf.py) on 15 Nov 2026 and pointed at docs/plan.
Run with the local Python environment (see tools/story/README.md):
    .venv/bin/python tools/story/md2pdf.py                  # builds every PDF listed in BOOKS
    .venv/bin/python tools/story/md2pdf.py MISSION_SCRIPTS  # builds one

Handles the Markdown these files use: headings, paragraphs, bullet and numbered lists, block quotes,
pipe tables, fenced code blocks, **bold**, *italic* and `code`. Nothing else is needed.
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
                out.append(PageBreak())
            h = Paragraph(inline(m.group(2)), ST["h%d" % lvl])
            out.append(h)
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


def build(key):
    files, title, *where = BOOKS[key]
    srcs = [PLAN / f for f in files if (PLAN / f).exists()]
    if not srcs:
        print("skip", key, "(no source)")
        return None
    out = (ROOT / where[0] if where else PLAN) / (key + ".pdf")
    doc = SimpleDocTemplate(str(out), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm,
                            bottomMargin=16 * mm, title="{{GAME_NAME}}: " + title, author="Muhammad Iliyasu Bugaje")
    width = A4[0] - 36 * mm
    el = [Spacer(1, 70 * mm), Paragraph("MIB-HUB · THE OPEN-WORLD GAME", ST["sub"]), Spacer(1, 8), Paragraph(tx(title), ST["title"]),
          Spacer(1, 10), Paragraph(tx("Private to the owner · " + date.today().strftime("%d %B %Y")), ST["sub"]), PageBreak()]
    for k, src in enumerate(srcs):
        if k:
            el.append(PageBreak())
        el += flow(src.read_text(encoding="utf8"), width)

    def page(c, d):
        c.saveState()
        c.setFont(F, 7.5)
        c.setFillColor(SOFT)
        c.drawString(18 * mm, 9 * mm, tx("MIB-Hub — " + title + " — private to the owner"))
        c.drawRightString(A4[0] - 18 * mm, 9 * mm, str(d.page))
        c.restoreState()

    doc.build(el, onFirstPage=lambda c, d: None, onLaterPages=page)
    from reportlab.lib.utils import open_for_read  # noqa: F401  (keeps reportlab's lazy imports happy)
    pages = len(re.findall(rb"/Type\s*/Page[^s]", out.read_bytes()))
    print("%s.pdf  %d pages" % (key, pages))
    return pages


if __name__ == "__main__":
    for k in (sys.argv[1:] or list(BOOKS)):
        build(k)
