"""Who looked at restricted personal data (round 7, A14).

Other apps call one helper wherever they SHOW restricted personal data
(staff phone or alternate e-mail, a student's record or contacts, results, course forms,
welfare cases):

    from accounts import accesslog
    accesslog.record(request, "staff_contact", lecturer_profile, subject=lecturer_profile.person)
    accesslog.record(request, "results", statement, subject=student.person, note="Result statement")

Kinds: staff_contact, student_record, student_contact, results, course_form, welfare,
account, other. Viewing your OWN data is never logged. Repeat views of the same
thing by the same person within `access.log_dedupe_minutes` (Settings) count once.
Never raises into the caller. The HOD and super admin read the log under
People and access -> Access log (`access:access_log`, permission accounts.access_log_view).
"""
import logging

from django.core.cache import cache

logger = logging.getLogger(__name__)
KINDS = ("staff_contact", "student_record", "student_contact", "results", "course_form", "welfare", "account", "other")


def _subject_of(obj):
    from .models import Person, User

    if obj is None:
        return None
    if isinstance(obj, Person):
        return obj
    if isinstance(obj, User):
        return obj.person_or_none
    for attr in ("person", "student", "owner"):
        val = getattr(obj, attr, None)
        if isinstance(val, Person):
            return val
        if val is not None and isinstance(getattr(val, "person", None), Person):
            return val.person
    return None


def _ip(request):
    fwd = (request.META.get("HTTP_X_FORWARDED_FOR") or "").split(",")[0].strip()
    return fwd or request.META.get("REMOTE_ADDR") or None


def record(request, kind, obj=None, *, subject=None, note="", always=False):
    """Log one view. Returns the AccessLogEntry, or None when skipped/failed."""
    try:
        import config
        if not config.get("access.log_enabled", True):
            return None
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return None
        if kind not in KINDS:
            kind = "other"
        subject = subject or _subject_of(obj)
        me = getattr(user, "person_or_none", None)
        if subject is not None and me is not None and subject.pk == me.pk and not getattr(request, "is_impersonating", False):
            return None
        label = f"{obj._meta.app_label}.{obj._meta.object_name}" if obj is not None and hasattr(obj, "_meta") else ""
        pk = str(getattr(obj, "pk", "") or "")
        minutes = 0 if always else int(config.get("access.log_dedupe_minutes", 10) or 0)
        if minutes > 0:
            key = f"ee:alog:{user.pk}:{kind}:{label}:{pk}:{getattr(subject, 'pk', '')}"
            if not cache.add(key, 1, minutes * 60):
                return None
        from .models import AccessLogEntry
        ref = getattr(request, "active_profile", None)
        imp = getattr(request, "impersonator", None)
        return AccessLogEntry.objects.create(
            user=user, user_repr=user.get_full_name()[:160], impersonator=imp if getattr(imp, "pk", None) else None,
            profile_kind=getattr(ref, "kind", "") or "", kind=kind, model_label=label, object_pk=pk,
            object_repr=str(obj)[:200] if obj is not None else "", subject=subject,
            path=(request.get_full_path() or "")[:300], ip=_ip(request), note=(note or "")[:200])
    except Exception:
        logger.exception("access log failed")
        return None
