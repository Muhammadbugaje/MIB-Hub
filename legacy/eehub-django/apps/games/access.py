"""Who is playing and which levels they may play. A student's level comes from their own StudentProfile
(people.StudentProfile.level), never from the URL, the browser or the reg. number. Guests (players from other
departments, games.GuestPlayer) may play 100-level games only."""
from django.utils import timezone

from accounts.access import is_super_admin

STAFF_KINDS = ("lecturer", "staff", "admin")
GUEST_SESSION = "arcade_guest"
GUEST_LEVEL = 100


def current_guest(request):
    gid = request.session.get(GUEST_SESSION) if hasattr(request, "session") else None
    if not gid:
        return None
    from .models import GuestPlayer
    g = GuestPlayer.objects.filter(pk=gid, expires_at__gt=timezone.now()).first()
    if g is None:
        request.session.pop(GUEST_SESSION, None)
    return g


def viewer(request):
    """Return (kind, max_level, note). max_level None means "no resolvable level"."""
    if not request.user.is_authenticated:
        g = getattr(request, "arcade_guest", None) or current_guest(request)
        if g:
            return "guest", GUEST_LEVEL, "Guest player: 100-level games are open to you."
        return "anon", None, "Sign in to play."
    ref = getattr(request, "active_profile", None)
    kind = getattr(ref, "kind", "") or ""
    if kind in STAFF_KINDS or is_super_admin(request.user):
        return "staff", 500, "Staff preview: every level is open to you."
    if kind == "student":
        prof = getattr(ref, "obj", None)
        level = getattr(prof, "level", None)
        number = getattr(level, "number", None)
        if not number:
            return "student", None, "Your student record has no current level yet."
        if number < 100:  # postgraduate years are stored as 1, 2 ...
            return "student", 500, "Postgraduate: every undergraduate level is open."
        return "student", int(number), f"Open up to {int(number)} level, your current level."
    return kind or "other", None, "The arcade is for students and staff."


def can_play(game, max_level):
    return bool(game.playable and max_level and game.level <= max_level)
