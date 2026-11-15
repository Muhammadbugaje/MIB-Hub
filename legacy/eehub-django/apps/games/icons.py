"""Home-screen icons for each arcade game (and the arcade itself), drawn from the catalogue colour and the game's
initials. Written to static/img/games/<slug>-{192,512}.png and <slug>-maskable-{192,512}.png by

    python manage.py build_game_icons

so they are ordinary static files: cached, hashed in production and included in the offline package. A test fails
when a playable game has no icon, so a new game is never installable without one."""
from pathlib import Path

from django.conf import settings

# A short mark where the initials would not be the name players know (catalogue extra["glyph"] wins).
GLYPHS = {"samaru-days": "FSLG"}

SIZES = (192, 512)
OUT = Path(settings.BASE_DIR) / "static" / "img" / "games"
ARCADE = ("arcade", "Learning arcade", "#0f3d2e")


def rel(slug, size, maskable=False):
    return "img/games/%s%s-%d.png" % (slug, "-maskable" if maskable else "", size)


def initials(title):
    words = [w for w in title.replace(":", " ").replace("-", " ").split() if w[:1].isalnum()]
    if not words:
        return "?"
    if len(words) == 1:
        return words[0][:2].upper()
    return (words[0][0] + words[1][0]).upper()


def _rgb(hexs):
    h = hexs.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _ink(rgb):
    lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255
    return (16, 22, 34) if lum > 0.55 else (255, 255, 255)


def draw(title, colour, size, maskable=False, glyph=""):
    from PIL import Image, ImageDraw, ImageFont
    s = size * 4  # draw large, scale down: smooth edges
    base = _rgb(colour)
    dark = tuple(max(0, int(c * 0.55)) for c in base)
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    radius = 0 if maskable else int(s * 0.22)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill=dark)
    # a bright diagonal sweep, then the game's colour as a disc: reads at 48 px on a home screen
    d.polygon([(0, int(s * 0.62)), (int(s * 0.62), 0), (s, 0), (s, int(s * 0.18)), (int(s * 0.18), s), (0, s)], fill=base)
    if not maskable:
        mask = Image.new("L", (s, s), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill=255)
        img.putalpha(mask)
    safe = 0.8 if maskable else 0.92  # maskable icons keep their content inside the middle 80%
    r = int(s * 0.34 * safe / 0.92)
    cx = cy = s // 2
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, 235))
    text = glyph or initials(title)
    fs = int(r * {1: 1.15, 2: 0.9, 3: 0.66}.get(len(text), 0.5))
    sw = max(1, int(fs * (0.05 if len(text) <= 2 else 0.025)))  # a same-colour stroke reads as bold
    font = ImageFont.load_default(size=fs)
    box = d.textbbox((0, 0), text, font=font, stroke_width=sw)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text((cx - w / 2 - box[0], cy - h / 2 - box[1]), text, font=font, fill=dark + (255,), stroke_width=sw, stroke_fill=dark + (255,))
    return img.resize((size, size), Image.LANCZOS)


def build(games=None):
    from .catalogue import GAMES
    OUT.mkdir(parents=True, exist_ok=True)
    items = [(g.slug, g.title, g.accent, g.extra.get("glyph") or GLYPHS.get(g.slug, "")) for g in (games or GAMES)] + [ARCADE + ("",)]
    written = []
    for slug, title, colour, glyph in items:
        for size in SIZES:
            for mk in (False, True):
                p = Path(settings.BASE_DIR) / "static" / rel(slug, size, mk)
                draw(title, colour, size, mk, glyph).save(p, optimize=True)
                written.append(p)
    return written
