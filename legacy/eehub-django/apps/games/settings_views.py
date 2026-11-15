"""Arcade Management (/arcade/settings/): the owner's console for the arcade. Open to the super admin and to accounts
given the permission games.manage_game_settings; everyone else gets a 404, so the section is not advertised.
All reads and writes go through games.cheats, which also writes the audit entries."""
import csv
from functools import wraps
from io import BytesIO, StringIO

from django.contrib import messages
from django.http import Http404, HttpResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils import timezone

from . import cheats as C
from .catalogue import BY_SLUG, GAMES

TABS = (("general", "General"), ("rules", "Rules"), ("cheats", "Cheat codes"), ("hero", "Secret character"))
FLASH = "arcade_hero_code_once"
FORMATS = {"pdf": "application/pdf", "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
           "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "csv": "text/csv; charset=utf-8", "html": "text/html"}


def manager_required(view):
    @wraps(view)
    def wrapped(request, *a, **k):
        if not C.can_manage(request.user):
            raise Http404()
        resp = view(request, *a, **k)
        resp["Cache-Control"] = "no-store"
        return resp
    return wrapped


def _playable():
    return [g for g in GAMES if g.playable]


def _tri(value):
    """A three-way choice from a form: follow the site default, on, or off."""
    return {"on": True, "off": False}.get(value)


def _summary(g):
    d = C.defaults(g.slug)
    cheats = C.cheats(g.slug)
    return {"g": g, "enabled": C.game_enabled(g.slug), "boards": C.cheats_on_boards(g.slug), "hero": C.hero_enabled(g.slug),
            "cheats_on": C.cheats_enabled(g.slug), "cheats": len(cheats), "off": sum(1 for c in cheats if not c["on"]),
            "changed": sum(1 for c in cheats if c["changed"]), "rules": len(d["rules"]),
            "rules_changed": sum(1 for r in C.rules(g.slug) if r["changed"])}


def _access_from(request, kind, errors):
    """Read an access rule ("cheat" or "hero") from a form: returns (mode or None for 'follow', user ids)."""
    choices = dict(C.CHEAT_ACCESS if kind == "cheat" else C.HERO_ACCESS)
    mode = request.POST.get(kind + "_access", "")
    if mode not in choices:
        return None, None
    ids, unknown = C.users_from_text(request.POST.get(kind + "_users", ""))
    if unknown:
        errors.append("No account has this e-mail address: " + ", ".join(unknown[:6]) + ".")
    if mode == "named" and not ids and not unknown:
        errors.append("Name at least one person (their sign-in e-mail), or choose a different rule.")
    return mode, ids


def _hero_form(request, slug, errors):
    code = request.POST.get("code", "")
    if len(C.norm(code)) < 8:
        errors.append("The secret code needs at least 8 characters (spaces and capitals are ignored).")
    elif code != request.POST.get("code2", ""):
        errors.append("The two codes don't match.")
    else:
        C.set_hero_code(slug, code, actor=request.user)
        return True
    return False


@manager_required
def settings_home(request):
    fresh = C.ensure_hero_code(actor=request.user)
    if fresh:
        request.session[FLASH] = fresh
    errors = []
    if request.method == "POST":
        act = request.POST.get("action")
        if act == "defaults":
            cmode, cids = _access_from(request, "cheat", errors)
            hmode, hids = _access_from(request, "hero", errors)
            if not errors:
                C.update(C.GLOBAL, actor=request.user, note="Arcade site-wide defaults changed",
                         cheats_enabled=request.POST.get("cheats_enabled") == "on", cheats_on_boards=request.POST.get("cheats_on_boards") == "on",
                         hero_enabled=request.POST.get("hero_enabled") == "on", cheat_access=cmode or "everyone", cheat_users=cids or [],
                         hero_access=hmode or "code", hero_users=hids or [])
                messages.success(request, "Site-wide settings saved.")
        elif act == "hero_set":
            if _hero_form(request, C.GLOBAL, errors):
                messages.success(request, "Secret character code changed. The old code no longer works.")
        elif act == "hero_new":
            code = C.new_code()
            C.set_hero_code(C.GLOBAL, code, actor=request.user)
            request.session[FLASH] = code
        elif act in ("toggle", "toggle_cheats") and request.POST.get("slug") in BY_SLUG:
            slug = request.POST["slug"]
            if act == "toggle":
                C.update(slug, actor=request.user, note="Game switched on or off", enabled=not C.game_enabled(slug))
            else:
                C.update(slug, actor=request.user, note="Cheats switched on or off for one game", cheats_enabled=not C._flag(slug, "cheats_enabled", True))
        if not errors:
            return redirect("games:settings")
    glob = C.global_settings()
    return render(request, "games/settings_home.html", {
        "rows": [_summary(g) for g in _playable()], "glob": glob, "errors": errors, "shown_code": request.session.pop(FLASH, None),
        "cheat_access": C.CHEAT_ACCESS, "hero_access": C.HERO_ACCESS,
        "cheat_users": request.POST.get("cheat_users") if errors else C.users_text(glob["cheat_users"]),
        "hero_users": request.POST.get("hero_users") if errors else C.users_text(glob["hero_users"])})


@manager_required
def settings_game(request, slug):
    game = BY_SLUG.get(slug)
    if game is None or not game.playable:
        raise Http404()
    tab = request.GET.get("tab") if request.GET.get("tab") in dict(TABS) else "general"
    here = reverse("games:settings_game", args=[slug])
    errors, submitted = [], None
    if request.method == "POST":
        act = request.POST.get("action")
        tab = request.POST.get("tab") if request.POST.get("tab") in dict(TABS) else tab
        if act == "general":
            cmode, cids = _access_from(request, "cheat", errors)
            hmode, hids = _access_from(request, "hero", errors)
            if not errors:
                C.update(slug, actor=request.user, note=f"{game.title}: general settings", enabled=request.POST.get("enabled") == "on",
                         cheats_enabled=request.POST.get("cheats_enabled") == "on",
                         cheats_on_boards=_tri(request.POST.get("cheats_on_boards")), hero_enabled=_tri(request.POST.get("hero_enabled")),
                         cheat_access=cmode, cheat_users=cids if cmode else None, hero_access=hmode, hero_users=hids if hmode else None)
                messages.success(request, "Saved.")
        elif act == "rules":
            clean = {}
            for r in C.defaults(slug)["rules"]:
                if request.POST.get("reset") == r["key"] or request.POST.get("reset") == "*":
                    continue
                raw = request.POST.get("rule-" + r["key"], "" if r["type"] != "bool" else "off")
                try:
                    val = C.coerce(r, raw)
                except ValueError as e:
                    errors.append(str(e))
                    continue
                if val != r["default"]:
                    clean[r["key"]] = val
            if not errors:
                C.update(slug, actor=request.user, note=f"{game.title}: rules", rules=clean or None)
                messages.success(request, "Rules reset to their defaults." if request.POST.get("reset") == "*" else "Rules saved.")
        elif act == "cheats":
            reset = request.POST.get("reset")
            base = C.defaults(slug)["cheats"]
            if reset == "*":
                C.update(slug, actor=request.user, note=f"{game.title}: all cheat codes reset", cheats=None)
                messages.success(request, "Every code is back to its default and switched on.")
            else:
                submitted = {c["id"]: {"typed": request.POST.get("typed-" + c["id"], c["typed"]), "dial": request.POST.get("dial-" + c["id"], c["dial"]),
                                       "how": request.POST.get("how-" + c["id"], c["how"]), "off": request.POST.get("on-" + c["id"]) != "on"}
                             for c in base}
                for c in base:
                    if reset == c["id"]:
                        submitted[c["id"]].update(typed=c["typed"], dial=c["dial"], how=c["how"])
                clean, errors = C.validate_cheats(slug, submitted)
                if not errors:
                    C.update(slug, actor=request.user, note=f"{game.title}: cheat codes", cheats=clean or None)
                    messages.success(request, "Cheat codes saved. They apply the next time the game page is loaded.")
        elif act == "hero_set":
            if _hero_form(request, slug, errors):
                messages.success(request, f"{game.title} now has its own secret code.")
        elif act == "hero_clear":
            C.set_hero_code(slug, "", actor=request.user)
            messages.success(request, "This game uses the site-wide secret code again.")
        elif act == "starter_off":
            C.update(slug, actor=request.user, note=f"{game.title}: starter secret code retired", starter_off=True)
            messages.success(request, "The starter code no longer works.")
        if not errors:
            return redirect(f"{here}?tab={tab}")
    data = C._data(slug)
    cheats = C.cheats(slug)
    if submitted:  # show what was typed next to the errors
        for c in cheats:
            sub = submitted.get(c["id"], {})
            c.update(typed=sub.get("typed", c["typed"]), dial=sub.get("dial", c["dial"]), how=sub.get("how", c["how"]), on=not sub.get("off"))
    groups = []
    for r in C.rules(slug):
        if not groups or groups[-1]["name"] != r["group"]:
            groups.append({"name": r["group"], "rules": []})
        groups[-1]["rules"].append(r)
    own_c, own_h = data.get("cheat_access") in dict(C.CHEAT_ACCESS), data.get("hero_access") in dict(C.HERO_ACCESS)
    return render(request, "games/settings_game.html", {
        "game": game, "tab": tab, "tabs": TABS, "errors": errors, "cheats": cheats, "rule_groups": groups,
        "glob": C.global_settings(), "enabled": C.game_enabled(slug), "own_cheats_enabled": C._flag(slug, "cheats_enabled", True),
        "own_boards": data.get("cheats_on_boards"), "own_hero": data.get("hero_enabled"),
        "eff_boards": C.cheats_on_boards(slug), "eff_hero": C.hero_enabled(slug), "min_code": C.MIN_CODE,
        "cheat_access": C.CHEAT_ACCESS, "hero_access": C.HERO_ACCESS,
        "own_cheat_access": data.get("cheat_access") if own_c else "", "own_hero_access": data.get("hero_access") if own_h else "",
        "cheat_users": request.POST.get("cheat_users", "") if errors else C.users_text(data.get("cheat_users") if own_c else []),
        "hero_users": request.POST.get("hero_users", "") if errors else C.users_text(data.get("hero_users") if own_h else []),
        "guide": _guide(game)})


def _guide(game):
    """Everything the owner needs to use the secret character in one game, from the defaults and the current settings."""
    slug = game.slug
    h = C.defaults(slug)["hero"]
    data = C._data(slug)
    mode, ids = C.access(slug, "hero")
    return {"g": game, "name": h["name"], "full": h["full"], "combo": h["combo"], "swipe": h["swipe"], "on": C.hero_enabled(slug),
            "powers": h["powers"] or "The strongest version of every ability the game has; cannot be beaten.",
            "shortcuts": h["shortcuts"], "boards": C.cheats_on_boards(slug),
            "where": h["where"] or "After the reveal move the character appears. Choose him, confirm, and a code box opens: type the secret code and press Enter.",
            "own_code": bool(data.get("hero_hash")), "starter": C.starter_code(slug),
            "who": dict(C.HERO_ACCESS)[mode], "people": C.users_text(ids).split("\n") if mode == "named" and ids else []}


@manager_required
def all_codes(request):
    q = " ".join(request.GET.get("q", "").lower().split())
    sheet = []
    for g in _playable():
        rows = [c for c in C.cheats(g.slug) if not q or q in " ".join((g.title, c["label"], c["note"], c["typed"], c["dial"], c["how_text"])).lower()]
        if rows or not q:
            sheet.append({"g": g, "cheats": rows, "on": C.cheats_enabled(g.slug)})
    return render(request, "games/settings_codes.html", {"sheet": sheet, "q": request.GET.get("q", ""), "total": sum(len(s["cheats"]) for s in sheet)})


@manager_required
def guide(request):
    return render(request, "games/settings_guide.html", {"guides": [_guide(g) for g in _playable()], "glob": C.global_settings()})


@manager_required
def audit(request):
    from core.models import AuditLogEntry
    names = {g.slug: g.title for g in GAMES}
    ids = {str(pk): ("All games" if slug == C.GLOBAL else names.get(slug, slug))
           for pk, slug in C._row(C.GLOBAL, create=True).__class__.objects.values_list("pk", "slug")}
    rows = []
    for e in AuditLogEntry.objects.filter(model_label="games.GameSettings").select_related("actor")[:300]:
        if e.action == AuditLogEntry.CREATE:
            continue
        changes = e.changes if isinstance(e.changes, dict) else {}
        parts = [f"{k}: {v[0]} → {v[1]}" if isinstance(v, (list, tuple)) and len(v) == 2 else str(k) for k, v in changes.items() if k not in ("data", "updated")]
        rows.append({"when": e.timestamp, "who": e.actor_repr, "game": ids.get(e.object_pk, "(removed)"), "note": e.note, "what": "; ".join(parts)})
    return render(request, "games/settings_audit.html", {"rows": rows})


# ---------- export ----------
def _sheet(games):
    return [{"g": g, "cheats": C.cheats(g.slug), "on": C.cheats_enabled(g.slug), "boards": C.cheats_on_boards(g.slug), "guide": _guide(g)}
            for g in games]


def _guide_lines(gd):
    """The secret-character guide as (heading, text) pairs, shared by every export format."""
    if not gd["on"]:
        return [("Secret character", f"{gd['name']} is switched off for this game.")]
    out = [("Reveal on keyboard or controller", gd["combo"] or "Not defined yet."), ("Reveal on a phone", gd["swipe"] or "Not defined yet."),
           ("Entering the code", gd["where"]),
           ("Which code", ("Development stand-in code: " + gd["starter"] + " (local test copy only, never on the live site). " if gd["starter"] else "")
            + ("This game's own code." if gd["own_code"] else "The site-wide secret code.") + " Codes are stored scrambled and are not printed here."),
           ("Who may use him", gd["who"] + (": " + ", ".join(gd["people"]) if gd["people"] else "")), ("Powers", gd["powers"])]
    if gd["shortcuts"]:
        out.append(("Test-run shortcuts", gd["shortcuts"]))
    out.append(("If the code is refused", "After 8 wrong tries the game locks the code box for 10 minutes. Wait, or set a new code in Arcade Management."))
    return out


def _state(c, s):
    return "On" if c["on"] and s["on"] else "Off"


def _pdf(sheet, who, when):
    from xml.sax.saxutils import escape as esc

    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    def safe(text):  # the built-in PDF fonts cover Latin-1 only
        return esc(str(text).replace("₦", "N").replace("→", "->").encode("latin-1", "replace").decode("latin-1"))

    base = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=base["Title"], fontSize=20, spaceAfter=4, alignment=0)
    h2 = ParagraphStyle("h2", parent=base["Heading2"], fontSize=14, spaceBefore=14, spaceAfter=4)
    body = ParagraphStyle("b", parent=base["BodyText"], fontSize=9, leading=12)
    small = ParagraphStyle("s", parent=body, fontSize=8.5, textColor=colors.HexColor("#555555"))
    code = ParagraphStyle("c", parent=body, fontName="Courier-Bold", fontSize=9.5)
    stamp = safe(f"Confidential - EE Hub arcade cheat codes - exported {when:%d %b %Y %H:%M} by {who}")
    page = landscape(A4)

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#666666"))
        canvas.drawString(15 * mm, 9 * mm, stamp)
        canvas.drawRightString(page[0] - 15 * mm, 9 * mm, f"Page {doc.page}")
        canvas.restoreState()

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=page, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=14 * mm, bottomMargin=16 * mm,
                            title="Arcade cheat codes", author="EE Hub")
    flow = [Paragraph("Arcade cheat codes and secret character guide", h1),
            Paragraph(safe(f"Confidential. Exported {when:%A %d %B %Y, %H:%M} by {who}. Codes ignore capitals and spaces."), small)]
    grid = [("GRID", (0, 0), (-1, -1), .4, colors.HexColor("#c9ced6")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]
    for s in sheet:
        flow.append(Paragraph(safe(s["g"].title), h2))
        flow.append(Paragraph(safe(("Cheats are ON for this game. " if s["on"] else "Cheats are switched OFF for this game. ")
                                   + "Results made with cheats " + ("count on the leaderboards." if s["boards"] else "are saved but kept off the leaderboards.")), small))
        if s["cheats"]:
            rows = [["What it does", "Type", "Dial", "How to trigger", "State"]]
            for c in s["cheats"]:
                what = safe(c["label"]) + (f"<br/><font size=8 color='#666666'>{safe(c['note'])}</font>" if c["note"] else "")
                rows.append([Paragraph(what, body), Paragraph(safe(c["typed"] or "-"), code), Paragraph(safe(c["dial"] or "-"), code),
                             Paragraph(safe(c["how_text"]), body), Paragraph(_state(c, s), body)])
            t = Table(rows, colWidths=[78 * mm, 42 * mm, 36 * mm, 95 * mm, 16 * mm], repeatRows=1)
            t.setStyle(TableStyle(grid + [("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                                          ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, 0), 9),
                                          ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f4f6f8")])]))
            flow += [Spacer(1, 4), t]
        else:
            flow.append(Paragraph("No cheat codes are defined for this game yet.", body))
        flow += [Spacer(1, 6), Paragraph(safe(f"Secret character: {s['guide']['name']} ({s['guide']['full']})"), ParagraphStyle("h3", parent=body, fontName="Helvetica-Bold", fontSize=10.5))]
        g = Table([[Paragraph("<b>" + safe(k) + "</b>", body), Paragraph(safe(v), body)] for k, v in _guide_lines(s["guide"])], colWidths=[55 * mm, 212 * mm])
        g.setStyle(TableStyle(grid))
        flow += [Spacer(1, 3), g]
    doc.build(flow, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()


def _docx(sheet, who, when):
    from docx import Document
    from docx.enum.section import WD_ORIENT
    from docx.shared import Pt
    doc = Document()
    sec = doc.sections[0]
    sec.orientation = WD_ORIENT.LANDSCAPE
    sec.page_width, sec.page_height = sec.page_height, sec.page_width
    doc.core_properties.title = "Arcade cheat codes"
    doc.add_heading("Arcade cheat codes and secret character guide", 0)
    doc.add_paragraph(f"Confidential. Exported {when:%A %d %B %Y, %H:%M} by {who}. Codes ignore capitals and spaces.")
    for s in sheet:
        doc.add_heading(s["g"].title, 1)
        doc.add_paragraph(("Cheats are ON for this game. " if s["on"] else "Cheats are switched OFF for this game. ")
                          + "Results made with cheats " + ("count on the leaderboards." if s["boards"] else "are saved but kept off the leaderboards."))
        if s["cheats"]:
            t = doc.add_table(rows=1, cols=5)
            t.style = "Light Grid Accent 1"
            for cell, text in zip(t.rows[0].cells, ("What it does", "Type", "Dial", "How to trigger", "State")):
                cell.text = text
            for c in s["cheats"]:
                cells = t.add_row().cells
                cells[0].text = c["label"] + (" — " + c["note"] if c["note"] else "")
                cells[1].text, cells[2].text, cells[3].text, cells[4].text = c["typed"] or "-", c["dial"] or "-", c["how_text"], _state(c, s)
                for i in (1, 2):
                    for run in cells[i].paragraphs[0].runs:
                        run.font.name, run.font.bold, run.font.size = "Courier New", True, Pt(10)
        else:
            doc.add_paragraph("No cheat codes are defined for this game yet.")
        doc.add_heading(f"Secret character: {s['guide']['name']} ({s['guide']['full']})", 2)
        for k, v in _guide_lines(s["guide"]):
            p = doc.add_paragraph()
            p.add_run(k + ": ").bold = True
            p.add_run(v)
    doc.sections[0].footer.paragraphs[0].text = f"Confidential · EE Hub arcade cheat codes · {when:%d %b %Y %H:%M} · {who}"
    buf = BytesIO()
    doc.save(buf)
    return buf.getvalue()


def _table_rows(sheet):
    yield ["Game", "What it does", "Note", "Typed code", "Dial code", "How to trigger", "State"]
    for s in sheet:
        for c in s["cheats"]:
            yield [s["g"].title, c["label"], c["note"], c["typed"], c["dial"], c["how_text"], _state(c, s)]


def _xlsx(sheet, who, when):
    from openpyxl import Workbook
    from openpyxl.styles import Font
    wb = Workbook()
    ws = wb.active
    ws.title = "Cheat codes"
    for row in _table_rows(sheet):
        ws.append(["'" + v if isinstance(v, str) and v[:1] in "=+-@" else v for v in row])  # codes are text, never formulas
    for cell in ws[1]:
        cell.font = Font(bold=True)
    for col, width in zip("ABCDEFG", (24, 30, 44, 20, 16, 60, 8)):
        ws.column_dimensions[col].width = width
    ws.freeze_panes = "A2"
    g = wb.create_sheet("Secret character")
    g.append(["Game", "Topic", "Details"])
    for s in sheet:
        for k, v in _guide_lines(s["guide"]):
            g.append([s["g"].title, k, v])
    for cell in g[1]:
        cell.font = Font(bold=True)
    for col, width in zip("ABC", (24, 34, 110)):
        g.column_dimensions[col].width = width
    info = wb.create_sheet("About")
    info.append(["Confidential. EE Hub arcade cheat codes."])
    info.append([f"Exported {when:%d %b %Y %H:%M} by {who}"])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _csv(sheet):
    out = StringIO()
    w = csv.writer(out)
    for row in _table_rows(sheet):
        w.writerow(["'" + v if isinstance(v, str) and v[:1] in "=+-@" else v for v in row])
    return ("﻿" + out.getvalue()).encode("utf-8")


@manager_required
def export(request, slug=None):
    if slug is not None and (slug not in BY_SLUG or not BY_SLUG[slug].playable):
        raise Http404()
    fmt = request.GET.get("format", "pdf")
    if fmt not in FORMATS:
        raise Http404()
    sheet, when = _sheet([BY_SLUG[slug]] if slug else _playable()), timezone.localtime()
    who = getattr(request.user, "email", "") or str(request.user)
    name = f"arcade-cheat-codes-{slug or 'all'}-{when:%Y%m%d}"
    try:
        from core import audit as A
        from core.models import AuditLogEntry
        A.log(AuditLogEntry.OTHER, C._row(slug or C.GLOBAL, create=True), actor=request.user, note=f"Arcade cheat codes exported ({fmt})")
    except Exception:
        pass
    body = None
    try:
        if fmt == "pdf":
            body = _pdf(sheet, who, when)
        elif fmt == "docx":
            body = _docx(sheet, who, when)
        elif fmt == "xlsx":
            body = _xlsx(sheet, who, when)
        elif fmt == "csv":
            body = _csv(sheet)
    except ImportError:  # the library for that format is not installed: fall back to something that always works
        if fmt == "xlsx":
            fmt, body = "csv", _csv(sheet)
    if body is None:
        return render(request, "games/settings_print.html", {"sheet": sheet, "when": when, "who": who, "one": slug})
    resp = HttpResponse(body, content_type=FORMATS[fmt])
    resp["Content-Disposition"] = f'attachment; filename="{name}.{fmt}"'
    return resp
