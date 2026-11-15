"""Sounds for everyone: a super admin replaces one arcade sound for every player of a game (docs/ARCADE_SETTINGS.md,
"Sounds"). Players' own replacements are kept on their own devices by static/js/games/arcade-sounds.js and never reach
the server. Order a game plays in: switched off > the player's own file > this file > the default recording > the synth.

Uploads are checked here, not trusted from the browser: one of the formats every phone can decode (WAV, MP3, M4A/AAC),
at most MAX_BYTES and MAX_SECONDS, read from the file's own headers. Only accounts.access.is_super_admin may upload or
revert; any player of the arcade may list and fetch the files (the game needs them)."""
import re
import struct
from io import BytesIO

from django.contrib import messages
from django.core.files.base import ContentFile
from django.db import transaction
from django.http import FileResponse, Http404, HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_http_methods, require_POST

from accounts.access import is_super_admin

from .access import current_guest
from .catalogue import BY_SLUG, GAMES
from .models import GlobalSound
from .settings_views import FORMATS, _playable, manager_required

MAX_BYTES = 2 * 1024 * 1024
MAX_SECONDS = 120.0
MIN_SECONDS = 0.05
NAME_RE = re.compile(r"^[a-z0-9_][a-z0-9_.:-]{0,79}$")
TYPES = {"wav": "audio/wav", "mp3": "audio/mpeg", "m4a": "audio/mp4"}
EXT = {"wav": ".wav", "mp3": ".mp3", "m4a": ".m4a"}


class Invalid(ValueError):
    pass


# ---------- reading the length of an audio file from its own headers ----------
def _wav(data):
    if data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        return None
    i, rate = 12, None
    while i + 8 <= len(data):
        cid, size = data[i:i + 4], struct.unpack("<I", data[i + 4:i + 8])[0]
        body = data[i + 8:i + 8 + size]
        if cid == b"fmt " and len(body) >= 16:
            fmt, ch, sr, rate = struct.unpack("<HHII", body[:12])
            if fmt not in (1, 3, 0xFFFE) or not ch or not sr or not rate:
                return None
        elif cid == b"data":
            return (min(size, len(data) - i - 8) / rate) if rate else None
        i += 8 + size + (size & 1)
    return None


_BR1 = (0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320)
_BR2 = (0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160)
_SR = {3: (44100, 48000, 32000), 2: (22050, 24000, 16000), 0: (11025, 12000, 8000)}


def _mp3_frame(data, i):
    if i + 4 > len(data) or data[i] != 0xFF or data[i + 1] & 0xE0 != 0xE0:
        return None
    ver, layer, bri, sri, pad = (data[i + 1] >> 3) & 3, (data[i + 1] >> 1) & 3, data[i + 2] >> 4, (data[i + 2] >> 2) & 3, (data[i + 2] >> 1) & 1
    if ver == 1 or layer != 1 or bri in (0, 15) or sri == 3:
        return None
    sr = _SR[ver][sri]
    br = (_BR1 if ver == 3 else _BR2)[bri] * 1000
    length = (144 if ver == 3 else 72) * br // sr + pad
    return length, (1152 if ver == 3 else 576) / sr


def _mp3(data):
    i = 0
    if data[:3] == b"ID3" and len(data) >= 10:
        i = 10 + ((data[6] & 0x7F) << 21 | (data[7] & 0x7F) << 14 | (data[8] & 0x7F) << 7 | (data[9] & 0x7F)) + (10 if data[5] & 0x10 else 0)
    start = i
    while i < min(len(data), start + 4096) and _mp3_frame(data, i) is None:
        i += 1
    frames, secs = 0, 0.0
    while True:
        f = _mp3_frame(data, i)
        if f is None or f[0] < 24:
            break
        frames, secs, i = frames + 1, secs + f[1], i + f[0]
    return secs if frames >= 2 else None


def _atoms(data, start, end):
    i = start
    while i + 8 <= end:
        size, typ, hdr = struct.unpack(">I", data[i:i + 4])[0], data[i + 4:i + 8], 8
        if size == 1 and i + 16 <= end:
            size, hdr = struct.unpack(">Q", data[i + 8:i + 16])[0], 16
        elif size == 0:
            size = end - i
        if size < hdr or i + size > end:
            break
        yield typ, i + hdr, i + size
        i += size


def _mp4(data):
    if data[4:8] != b"ftyp":
        return None
    for typ, a, b in _atoms(data, 0, len(data)):
        if typ != b"moov":
            continue
        if b"soun" not in data[a:b]:  # no audio track
            return None
        for t2, c, d in _atoms(data, a, b):
            if t2 == b"mvhd" and d - c >= 32:
                if data[c] == 1:
                    scale, dur = struct.unpack(">IQ", data[c + 20:c + 32])
                else:
                    scale, dur = struct.unpack(">II", data[c + 12:c + 20])
                return dur / scale if scale else None
    return None


def sniff(data):
    """(kind, seconds) for a WAV, MP3 or M4A file, else (None, None)."""
    for kind, fn in (("wav", _wav), ("m4a", _mp4), ("mp3", _mp3)):
        try:
            secs = fn(data)
        except (struct.error, IndexError, KeyError, ZeroDivisionError):
            secs = None
        if secs is not None:
            return kind, secs
    return None, None


def validate(upload):
    """Read and check an uploaded file: returns (bytes, kind, seconds) or raises Invalid with a message for people."""
    if upload is None:
        raise Invalid("Choose an audio file.")
    if upload.size > MAX_BYTES:
        raise Invalid(f"That file is {upload.size / 1048576:.1f} MB. The limit for everyone is {MAX_BYTES // 1048576} MB; trim it or use MP3.")
    data = upload.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise Invalid(f"The limit for everyone is {MAX_BYTES // 1048576} MB.")
    kind, secs = sniff(data)
    if kind is None:
        raise Invalid("That is not a WAV, MP3 or M4A sound. Use one of those so every phone can play it.")
    if secs < MIN_SECONDS:
        raise Invalid("That sound is empty or too short.")
    if secs > MAX_SECONDS:
        raise Invalid(f"That sound is {secs:.0f} seconds long. The limit is {MAX_SECONDS:.0f} seconds.")
    return data, kind, secs


def clean_name(name):
    name = (name or "").strip()
    if not NAME_RE.match(name):
        raise Invalid("Unknown sound name.")
    return name


# ---------- helpers ----------
def file_url(row):
    return reverse("games:sound_file", args=[row.slug, row.name]) + f"?v={row.version}"


def as_json(row):
    return {"name": row.name, "url": file_url(row), "v": row.version, "type": row.content_type, "size": row.size,
            "dur": round(row.duration, 2), "at": row.updated.isoformat(), "by": _who(row.uploaded_by)}


def _who(user):
    if user is None:
        return ""
    full = getattr(user, "get_full_name", lambda: "")() or ""
    return full or getattr(user, "email", "") or str(user)


def _audit(row, actor, note):
    try:
        from core import audit as A
        from core.models import AuditLogEntry
        A.log(AuditLogEntry.OTHER, row, actor=actor, note=note)
    except Exception:
        pass


def save(slug, name, upload, actor):
    """Validate and store one sound for everyone; replaces an earlier one for the same name."""
    if slug not in BY_SLUG:
        raise Invalid("Unknown game.")
    name = clean_name(name)
    data, kind, secs = validate(upload)
    with transaction.atomic():
        row = GlobalSound.objects.select_for_update().filter(slug=slug, name=name).first()
        old = row.file.name if row and row.file else None
        if row is None:
            row = GlobalSound(slug=slug, name=name, version=0)
        row.version += 1
        row.content_type, row.size, row.duration = TYPES[kind], len(data), secs
        row.original_name = (getattr(upload, "name", "") or "")[:120]
        row.uploaded_by = actor
        row.file.save("sound" + EXT[kind], ContentFile(data), save=False)
        row.save()
    if old:
        try:
            row.file.storage.delete(old)
        except Exception:
            pass
    _audit(row, actor, f"Arcade sound '{name}' replaced for everyone in {BY_SLUG[slug].title}")
    return row


def revert(slug, name, actor):
    row = GlobalSound.objects.filter(slug=slug, name=name).first()
    if row is None:
        return False
    _audit(row, actor, f"Arcade sound '{name}' back to the default in {BY_SLUG[slug].title if slug in BY_SLUG else slug}")
    path, storage = row.file.name, row.file.storage
    row.delete()
    try:
        storage.delete(path)
    except Exception:
        pass
    return True


def _player(request):
    return request.user.is_authenticated or current_guest(request) is not None


def _err(msg, status=400):
    return JsonResponse({"error": msg}, status=status)


# ---------- the game's API (/arcade/api/sounds/<slug>/) ----------
@require_http_methods(["GET", "POST"])
def api_sounds(request, slug):
    """GET: the sounds replaced for everyone in this game. POST (super admin): upload one (fields name, file)."""
    if slug not in BY_SLUG:
        return _err("Unknown game.", 404)
    if not _player(request):
        return _err("Sign in to play.", 403)
    sup = is_super_admin(request.user)
    if request.method == "POST":
        if not sup:
            return _err("Only a super admin can change a sound for everyone.", 403)
        try:
            row = save(slug, request.POST.get("name"), request.FILES.get("file"), request.user)
        except Invalid as e:
            return _err(str(e))
        return JsonResponse({"ok": True, "sound": as_json(row)})
    rows = GlobalSound.objects.filter(slug=slug).select_related("uploaded_by")
    resp = JsonResponse({"can_global": sup, "max_bytes": MAX_BYTES, "max_seconds": MAX_SECONDS, "sounds": [as_json(r) for r in rows]})
    resp["Cache-Control"] = "no-store"
    return resp


@require_POST
def api_sound_revert(request, slug):
    if slug not in BY_SLUG:
        return _err("Unknown game.", 404)
    if not is_super_admin(request.user):
        return _err("Only a super admin can change a sound for everyone.", 403)
    try:
        name = clean_name(request.POST.get("name"))
    except Invalid as e:
        return _err(str(e))
    return JsonResponse({"ok": revert(slug, name, request.user)})


def sound_file(request, slug, name):
    """The file itself, for players of the arcade and for Arcade Management (?download=1 saves it)."""
    from .cheats import can_manage
    if not (_player(request) or can_manage(request.user)):
        raise Http404()
    row = GlobalSound.objects.filter(slug=slug, name=name).first()
    if row is None or not row.file:
        raise Http404()
    try:
        fh = row.file.open("rb")
    except (OSError, ValueError):
        raise Http404()
    ext = {v: k for k, v in TYPES.items()}.get(row.content_type, "bin")
    resp = FileResponse(fh, content_type=row.content_type, as_attachment=request.GET.get("download") == "1",
                        filename=f"{slug}-{name.replace(':', '-')}.{ext}")
    resp["Cache-Control"] = "private, max-age=86400"
    resp["X-Content-Type-Options"] = "nosniff"
    return resp


# ---------- Arcade Management: /arcade/settings/sounds/ ----------
def _rows():
    names = {g.slug: g.title for g in GAMES}
    out = []
    for r in GlobalSound.objects.select_related("uploaded_by"):
        out.append({"row": r, "game": names.get(r.slug, r.slug), "url": file_url(r), "who": _who(r.uploaded_by),
                    "kb": max(1, round(r.size / 1024)), "dur": round(r.duration, 1), "fmt": r.content_type.split("/")[-1].upper()})
    return out


def _known_names():
    """Names from the sound manifest, for the upload form's suggestions."""
    import json
    from django.contrib.staticfiles import finders
    p = finders.find("audio/sfx/manifest.json")
    names = set()
    try:
        with open(p, encoding="utf-8") as fh:
            man = json.load(fh)
        names |= set(man.get("core") or {})
        for pack in (man.get("packs") or {}).values():
            names |= set(pack or {})
    except (TypeError, OSError, ValueError):
        pass
    names |= {"music", "fanfare_win", "fanfare_champion", "fanfare_draw", "fanfare_lose", "crowd_cheer", "crowd_groan"}
    return sorted(names)


@manager_required
def manage(request):
    """Every sound replaced for everyone, with play, download and revert; super admins can also upload here."""
    sup = is_super_admin(request.user)
    if request.method == "POST":
        if not sup:
            raise Http404()
        act, slug = request.POST.get("action"), request.POST.get("slug", "")
        try:
            if act == "upload":
                row = save(slug, request.POST.get("name"), request.FILES.get("file"), request.user)
                messages.success(request, f"'{row.name}' now plays for everyone in {BY_SLUG[slug].title}.")
            elif act == "revert":
                if revert(slug, request.POST.get("name", ""), request.user):
                    messages.success(request, "Back to the game's own sound for everyone.")
        except Invalid as e:
            messages.error(request, str(e))
        return redirect("games:settings_sounds")
    fmt = request.GET.get("format")
    if fmt:
        if fmt not in FORMATS or fmt == "csv":
            raise Http404()
        return _export(request, fmt, FORMATS)
    return render(request, "games/settings_sounds.html", {"rows": _rows(), "sup": sup, "games": _playable(), "names": _known_names(),
                                                          "max_mb": MAX_BYTES // 1048576, "max_s": int(MAX_SECONDS)})


def _table():
    yield ["Game", "Sound", "Format", "Size (KB)", "Seconds", "Replaced by", "When", "Original file name"]
    for r in _rows():
        yield [r["game"], r["row"].name, r["fmt"], r["kb"], r["dur"], r["who"], timezone.localtime(r["row"].updated).strftime("%d %b %Y %H:%M"), r["row"].original_name]


def _export(request, fmt, formats):
    rows, when = list(_table()), timezone.localtime()
    who = getattr(request.user, "email", "") or str(request.user)
    title = "Arcade sounds replaced for everyone"
    if fmt == "html":
        return render(request, "games/settings_sounds_print.html", {"rows": rows[1:], "head": rows[0], "when": when, "who": who, "title": title})
    buf = BytesIO()
    if fmt == "pdf":
        from xml.sax.saxutils import escape as esc

        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

        def safe(t):
            return esc(str(t).encode("latin-1", "replace").decode("latin-1"))
        ss = getSampleStyleSheet()
        doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=14 * mm, rightMargin=14 * mm, topMargin=14 * mm, bottomMargin=14 * mm, title=title)
        flow = [Paragraph(title, ss["Title"]), Paragraph(safe(f"Exported {when:%d %B %Y, %H:%M} by {who}. {len(rows) - 1} sound(s)."), ss["BodyText"]), Spacer(1, 6)]
        if len(rows) > 1:
            t = Table([[Paragraph(safe(c), ss["BodyText"]) for c in row] for row in rows], repeatRows=1,
                      colWidths=[38 * mm, 42 * mm, 18 * mm, 18 * mm, 18 * mm, 46 * mm, 32 * mm, 55 * mm])
            t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), .4, colors.HexColor("#c9ced6")), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e5e7eb")),
                                   ("VALIGN", (0, 0), (-1, -1), "TOP")]))
            flow.append(t)
        else:
            flow.append(Paragraph("No sound has been replaced for everyone. Every game plays its own sounds.", ss["BodyText"]))
        doc.build(flow)
    elif fmt == "docx":
        from docx import Document
        doc = Document()
        doc.add_heading(title, 0)
        doc.add_paragraph(f"Exported {when:%d %B %Y, %H:%M} by {who}. {len(rows) - 1} sound(s).")
        t = doc.add_table(rows=0, cols=len(rows[0]))
        t.style = "Light Grid Accent 1"
        for row in rows:
            for cell, v in zip(t.add_row().cells, row):
                cell.text = str(v)
        doc.save(buf)
    else:
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Sounds"
        for row in rows:
            ws.append(["'" + v if isinstance(v, str) and v[:1] in "=+-@" else v for v in row])
        wb.save(buf)
    resp = HttpResponse(buf.getvalue(), content_type=formats[fmt])
    resp["Content-Disposition"] = f'attachment; filename="arcade-sounds-{when:%Y%m%d}.{fmt}"'
    return resp
