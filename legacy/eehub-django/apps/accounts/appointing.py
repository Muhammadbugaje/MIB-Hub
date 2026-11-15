"""One door for putting a person into an office and taking them out (round 7, items A1/A4/F6).

Every code path that creates or ends an Appointment goes through here: the access screens,
the class rep's tutor approvals (messaging/classroom), the EESA President's executive
management (association/elections), the Django admin, imports and seeds. That keeps office
eligibility and delegation rules in one place.

Contract (other round-7 builders code against these names; the access builder owns the
implementation and may extend it, but must keep these signatures):

    EligibilityError(ValueError)        raised with a plain-English message
    DelegationError(PermissionError)    the actor may not appoint to this office/scope
    allowed_profile_kinds(office)       -> list[str] of profile kinds that may hold it
    eligible_profile_kinds(person, office) -> list[str] the person can hold it as (may be empty)
    check_eligible(person, office, profile_kind, *, scope_level=None) -> None (raises EligibilityError)
    can_appoint(actor, office, *, scope_level=None, scope_label="") -> bool
    appoint(*, actor, person, office, profile_kind=None, scope_level=None, scope_programme=None,
            scope_label="", start_date=None, end_date=None, is_acting=False, note="",
            check_actor=True) -> Appointment
    end_appointment(*, actor, appointment, reason="", when=None, check_actor=True) -> Appointment

Rules
-----
* Eligibility (A1): an office lists the profile kinds that may hold it (`Office.allowed_profile_kinds`,
  defaults in `accounts.catalogue.ELIGIBILITY`). A *student* holder needs an ACTIVE student profile
  (not deferred, suspended, withdrawn or graduated); when the office has `level_must_match` (class rep,
  assistant class rep) that active student profile must be of the level the appointment serves.
  Lecturer, staff and alumni holders need that profile open (not closed); a lecturer or staff profile
  that has left/retired does not count.
* Delegation (A4): the super admin may appoint anyone anywhere. Everybody else needs a current
  appointment to an office that has an active `DelegationRule` covering the target office, in the
  profile they are acting as; a `same_level` rule also needs the target level to be the level of
  the grantor's own appointment (a class rep makes tutors for their own class only).
* Extra (exported, not in the frozen contract): `delegation_rules_for(actor)`, `appointable_offices(actor)`,
  `ineligibility(appointment)`, `wrong_appointments()`, `eligible_people(office, ...)`.
"""
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

ALL_KINDS = ["student", "lecturer", "staff", "alumni"]
KIND_LABELS = {"student": "student", "lecturer": "lecturer", "staff": "staff", "alumni": "alumni"}
KIND_PLURAL = {"student": "students", "lecturer": "lecturers", "staff": "staff", "alumni": "alumni"}
KIND_AS = {"student": "a student", "lecturer": "a lecturer", "staff": "a staff member", "alumni": "an alumnus"}


def kinds_text(kinds):
    names = [KIND_PLURAL.get(k, k) for k in kinds]
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " or " + names[-1]
INACTIVE_STAFF_STATUSES = ("left", "retired", "deceased", "inactive")


class EligibilityError(ValueError):
    pass


class DelegationError(PermissionError):
    pass


# ---------------------------------------------------------------------------
# Eligibility
# ---------------------------------------------------------------------------
def allowed_profile_kinds(office):
    kinds = [k for k in (getattr(office, "allowed_profile_kinds", None) or []) if k in ALL_KINDS]
    if kinds:
        return kinds
    if office.profile_kind == "any":
        return list(ALL_KINDS)
    return [office.profile_kind]


def _one_to_one(person, attr):
    from django.core.exceptions import ObjectDoesNotExist
    try:
        prof = getattr(person, attr)
    except ObjectDoesNotExist:
        return None
    if prof is None or getattr(prof, "is_deleted", False):
        return None
    if getattr(prof, "status", "active") in INACTIVE_STAFF_STATUSES:
        return None
    return prof


def _active_students(person):
    cached = getattr(person, "_ee_active_students", None)
    if cached is None:
        cached = list(person.student_profiles.filter(is_deleted=False, status="active").select_related("level"))
        person._ee_active_students = cached
    return cached


def _person_kinds(person):
    kinds = []
    for kind, attr in (("lecturer", "lecturer_profile"), ("staff", "staff_profile"), ("alumni", "alumni_profile")):
        if _one_to_one(person, attr) is not None:
            kinds.append(kind)
    if _active_students(person):
        kinds.append("student")
    return kinds


def eligible_profile_kinds(person, office):
    have = _person_kinds(person)
    return [k for k in allowed_profile_kinds(office) if k in have]


def _level_label(level):
    return str(level) if level is not None else "that level"


def check_eligible(person, office, profile_kind, *, scope_level=None):
    allowed = allowed_profile_kinds(office)
    name = getattr(person, "plain_name", None) or str(person)
    if profile_kind not in allowed:
        raise EligibilityError(f"Only {kinds_text(allowed)} can hold {office.name}. {name} cannot hold it as "
                               f"{KIND_AS.get(profile_kind, profile_kind)}.")
    if profile_kind == "student":
        students = _active_students(person)
        if not students:
            raise EligibilityError(f"{name} has no active student profile, so cannot hold {office.name}.")
        if office.level_must_match:
            if scope_level is None:
                raise EligibilityError(f"{office.name} serves one level. Choose the level.")
            if not any(s.level_id == scope_level.pk for s in students):
                raise EligibilityError(f"{name} is not a student of {_level_label(scope_level)}, "
                                       f"so cannot be its {office.label.lower()}.")
        return
    if profile_kind not in _person_kinds(person):
        raise EligibilityError(f"{name} has no open {profile_kind} profile. Add one on their profiles page first.")


def ineligibility(appointment):
    """Why a CURRENT appointment breaks the rules today ('' when it is fine)."""
    try:
        check_eligible(appointment.person, appointment.office, appointment.profile_kind,
                       scope_level=appointment.scope_level)
    except EligibilityError as exc:
        return str(exc)
    return ""


def wrong_appointments(queryset=None):
    """Current appointments that their office's eligibility rules no longer allow (A1, F6),
    as [(appointment, reason)], for the HOD to end."""
    from .models import Appointment

    today = timezone.localdate()
    qs = queryset if queryset is not None else Appointment.objects.all()
    qs = (qs.filter(is_deleted=False, start_date__lte=today).filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
          .select_related("office", "scope_level", "scope_programme", "person__user", "person__lecturer_profile",
                          "person__staff_profile", "person__alumni_profile")
          .order_by("-office__rank", "office__name", "person__last_name"))
    out = []
    for a in qs:
        why = ineligibility(a)
        if why:
            out.append((a, why))
    return out


def eligible_people(office, queryset=None, *, scope_level=None):
    """People (Person queryset) who could hold `office` in at least one allowed profile.
    Level matching for class reps is applied when `scope_level` is given."""
    from .models import Person

    qs = queryset if queryset is not None else Person.objects.all()
    q = Q()
    for kind in allowed_profile_kinds(office):
        if kind == "student":
            sq = Q(student_profiles__is_deleted=False, student_profiles__status="active")
            if office.level_must_match and scope_level is not None:
                sq &= Q(student_profiles__level=scope_level)
            q |= sq
        else:
            rel = f"{kind}_profile"
            kq = Q(**{f"{rel}__isnull": False, f"{rel}__is_deleted": False})
            if kind in ("lecturer", "staff"):
                kq &= ~Q(**{f"{rel}__status__in": INACTIVE_STAFF_STATUSES})
            q |= kq
    return qs.filter(q).distinct() if q else qs.none()


# ---------------------------------------------------------------------------
# Delegation
# ---------------------------------------------------------------------------
def _actor_kind(actor):
    return getattr(actor, "_ee_active_kind", None)


def _actor_appointments(actor):
    """Current appointments of `actor` that count in the profile they are acting as."""
    from .access import _current_appointments

    person = getattr(actor, "person_or_none", None)
    if person is None:
        return []
    kind = _actor_kind(actor)
    return [a for a in _current_appointments(person)
            if not kind or kind == "admin" or a.profile_kind == kind or a.office.profile_kind == "any"]


def delegation_rules_for(actor):
    """[(rule, grantor appointment)] the actor can use right now."""
    from .models import DelegationRule

    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        return []
    cached = getattr(actor, "_ee_delegations", None)
    if cached is not None:
        return cached
    appts = _actor_appointments(actor)
    out = []
    if appts:
        by_office = {}
        for a in appts:
            by_office.setdefault(a.office_id, []).append(a)
        rules = (DelegationRule.objects.filter(is_active=True, grantor_office_id__in=list(by_office))
                 .select_related("grantor_office").prefetch_related("offices", "except_offices", "permissions"))
        for r in rules:
            for a in by_office.get(r.grantor_office_id, []):
                out.append((r, a))
    actor._ee_delegations = out
    return out


def has_delegation_rules(actor):
    """Whether delegation_rules_for(actor) would return anything: one EXISTS query
    (no prefetching), for the sidebar check of the Grants screen."""
    from .models import DelegationRule

    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        return False
    cached = getattr(actor, "_ee_delegations", None)
    if cached is not None:
        return bool(cached)
    office_ids = {a.office_id for a in _actor_appointments(actor)}
    return bool(office_ids) and DelegationRule.objects.filter(is_active=True, grantor_office_id__in=office_ids).exists()


def _scope_ok(rule, grantor_appt, scope_level):
    if rule.scope_rule == rule.SCOPE_SAME_LEVEL:
        return scope_level is not None and grantor_appt.scope_level_id == getattr(scope_level, "pk", scope_level)
    return True


def rule_for(actor, office, *, scope_level=None):
    """The delegation rule that lets `actor` appoint to `office` at `scope_level` (or None)."""
    for rule, appt in delegation_rules_for(actor):
        if rule.covers_office(office) and _scope_ok(rule, appt, scope_level):
            return rule
    return None


def can_appoint(actor, office, *, scope_level=None, scope_label=""):
    if actor is None or not getattr(actor, "is_authenticated", False) or not getattr(actor, "is_active", False):
        return False
    from .access import is_super_admin
    if is_super_admin(actor):
        return True
    if office is None or not office.is_active or office.is_template:
        return False
    return rule_for(actor, office, scope_level=scope_level) is not None


def appointable_offices(actor):
    """[(office, [levels or None])] the actor may appoint to: None = any scope, else only these level ids."""
    from .access import is_super_admin
    from .models import Office

    if actor is None or not getattr(actor, "is_authenticated", False):
        return []
    if is_super_admin(actor):
        return [(o, None) for o in Office.objects.filter(is_active=True, is_template=False)]
    found = {}
    for rule, appt in delegation_rules_for(actor):
        for o in rule.office_queryset():
            levels = found.setdefault(o.pk, [o, set()])[1]
            if levels is None:
                continue
            if rule.scope_rule == rule.SCOPE_ANY:
                found[o.pk][1] = None
            elif appt.scope_level_id:
                levels.add(appt.scope_level_id)
    out = [(o, lv) for o, lv in found.values() if lv is None or lv]
    out.sort(key=lambda t: (-t[0].rank, t[0].name))
    return out


def _invalidate(*users):
    from .access import invalidate
    for u in users:
        if u is not None and getattr(u, "pk", None):
            invalidate(u)


# ---------------------------------------------------------------------------
# The two doors
# ---------------------------------------------------------------------------
@transaction.atomic
def appoint(*, actor, person, office, profile_kind=None, scope_level=None, scope_programme=None,
            scope_label="", start_date=None, end_date=None, is_acting=False, note="", check_actor=True):
    from core import audit

    from .models import Appointment

    if check_actor and not can_appoint(actor, office, scope_level=scope_level, scope_label=scope_label):
        where = f" for {scope_level}" if scope_level is not None else ""
        raise DelegationError(f"You cannot appoint people to {office.name}{where}.")
    if not office.is_active:
        raise EligibilityError(f"{office.name} is switched off.")
    if profile_kind is None:
        kinds = eligible_profile_kinds(person, office)
        if not kinds:
            raise EligibilityError(f"{person.plain_name} has no profile that may hold {office.name} "
                                   f"(only {kinds_text(allowed_profile_kinds(office))} can).")
        profile_kind = kinds[0]
    if scope_level is not None and scope_programme is None:
        scope_programme = scope_level.programme
    check_eligible(person, office, profile_kind, scope_level=scope_level)
    start = start_date or timezone.localdate()
    if end_date is not None and end_date < start:
        raise EligibilityError("The end date is before the start date.")
    appt = Appointment.objects.create(
        person=person, office=office, profile_kind=profile_kind, scope_level=scope_level,
        scope_programme=scope_programme, scope_label=scope_label or "",
        start_date=start, end_date=end_date, is_acting=is_acting,
        appointed_by=actor if getattr(actor, "pk", None) else None, note=(note or "")[:255])
    audit.log("create", appt, actor=actor if getattr(actor, "pk", None) else None,
              note=f"appointed {person.plain_name} as {office.name} ({profile_kind})"[:255])
    _invalidate(person.user, actor)
    return appt


@transaction.atomic
def end_appointment(*, actor, appointment, reason="", when=None, check_actor=True):
    from core import audit

    if check_actor and not can_appoint(actor, appointment.office, scope_level=appointment.scope_level,
                                       scope_label=appointment.scope_label):
        raise DelegationError(f"You cannot end appointments to {appointment.office.name}.")
    # `when` is the LAST DAY the office is held (as before). Without `when` the office stops
    # NOW: the last day held is yesterday, so the permissions go at once (an end date of
    # today would still count as current today); one that starts today or later is cancelled.
    from datetime import timedelta
    if when is None:
        today = timezone.localdate()
        cancel, last_day = appointment.start_date >= today, today - timedelta(days=1)
    else:
        cancel, last_day = appointment.start_date > when, when
    if cancel:
        if reason:
            appointment.note = ((appointment.note + " · " if appointment.note else "") + f"Cancelled: {reason}")[:255]
            appointment.save(update_fields=["note", "updated_at"])
        appointment.delete()          # soft delete: it never really ran
        action = "cancelled"
    else:
        appointment.end_date = last_day
        if reason:
            appointment.note = ((appointment.note + " · " if appointment.note else "") + f"Ended: {reason}")[:255]
        appointment.save(update_fields=["end_date", "note", "updated_at"])
        action = "ended"
    audit.log("update", appointment, actor=actor if getattr(actor, "pk", None) else None,
              note=f"appointment {action}" + (f": {reason}" if reason else "")[:200])
    _invalidate(appointment.person.user, actor)
    return appointment
