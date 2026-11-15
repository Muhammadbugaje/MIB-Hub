"""Profile completeness nudges (ported from NBTE Phase 8).

For a signed-in user whose profile (Person.completeness(), over
Person.PROFILE_FIELDS) is below ``profile.completion_threshold``:

  * a banner at the top of every portal page (not on the dashboard or the
    profile page) shows the % ring and what is missing; it can be hidden for
    the browser session (``profile.banner_enabled``, default on);
  * starting an important request (the URL prefixes in ``GATED_URL_NAMES``
    or any element marked ``[data-requires-profile]``) opens a dialog with
    "Complete my profile" or "Continue anyway" (``profile.interrupt_enabled``,
    default on). Continuing is written to the audit log. It is a nudge, not
    a block.

The banner partial is templates/partials/profile_nudge.html, the behaviour
static/js/profile-nudge.js, the template tag ``{% profile_nudge %}`` in
core/templatetags/ux_tags.py.
"""
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.urls import NoReverseMatch, reverse
from django.views.decorators.http import require_POST

FIELD_LABELS = {"phone": "Phone number", "date_of_birth": "Date of birth", "gender": "Gender",
                "photo": "Profile photo", "address": "Address", "state_of_origin": "State of origin",
                "bio": "A short bio"}
# Most valuable first: the banner lists what moves the needle.
FIELD_ORDER = ("photo", "phone", "date_of_birth", "gender", "address", "state_of_origin", "bio")

# Where an important request starts (URL names; missing names are skipped,
# so later phases only need to add their name here).
GATED_URL_NAMES = (
    "complaints:create",
    "complaints:new",
    "workflow:raise",
    "requests:create",
    "tasks:create",
    "messaging:compose",
    "messaging:memo_create",
)


def _int(key, default):
    try:
        import config

        return int(config.get(key, default))
    except (TypeError, ValueError):
        return default
    except Exception:
        return default


def threshold():
    return max(0, min(100, _int("profile.completion_threshold", 70)))


def banner_enabled():
    return _int("profile.banner_enabled", 1) == 1


def interrupt_enabled():
    return _int("profile.interrupt_enabled", 1) == 1


def applies_to(user):
    return bool(user is not None and user.is_authenticated and user.is_active
                and not getattr(user, "must_change_password", False))


def status(user):
    """{percent, threshold, complete, missing: [labels]} for ``user``."""
    from .models import Person

    person = getattr(user, "person_or_none", None)
    fields = getattr(Person, "PROFILE_FIELDS", tuple(FIELD_LABELS))
    if person is None:
        percent, missing_keys = 0, list(fields)
    else:
        percent = person.completeness()
        missing_keys = [f for f in fields if not getattr(person, f, None)]
    order = {k: i for i, k in enumerate(FIELD_ORDER)}
    missing_keys.sort(key=lambda k: order.get(k, 99))
    limit = threshold()
    return {"percent": percent, "threshold": limit, "complete": percent >= limit,
            "missing": [FIELD_LABELS.get(k, k.replace("_", " ").capitalize()) for k in missing_keys],
            "missing_keys": missing_keys}


def gated_paths():
    paths = []
    for name in GATED_URL_NAMES:
        try:
            paths.append(reverse(name))
        except NoReverseMatch:
            continue
    return sorted(set(paths))


@login_required
@require_POST
def continue_view(request):
    """The user chose "Continue anyway": write it to the audit log."""
    from core import audit

    target = (request.POST.get("target") or "")[:200]
    st = status(request.user)
    audit.log("other", request.user, actor=request.user,
              changes={"percent": st["percent"], "threshold": st["threshold"], "target": target},
              note="continued with an incomplete profile")
    return JsonResponse({"ok": True})
