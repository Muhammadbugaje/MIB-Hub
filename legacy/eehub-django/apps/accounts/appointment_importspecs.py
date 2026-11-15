"""Appointments import (round 7, A1): every row goes through accounts.appointing.appoint(),
so the office eligibility rules and the importer's own delegation apply to imports too."""
import datetime

from django.core.exceptions import ValidationError

from core.importexport import Column, ExportSpec, ImportSpec, register

from .importspecs import PROFILE_VALUES, _level, _text


def _date(v):
    if isinstance(v, datetime.datetime):
        return v.date()
    if isinstance(v, datetime.date):
        return v
    try:
        return datetime.date.fromisoformat(_text(v))
    except ValueError:
        raise ValueError("use a date such as 2026-10-01")


def _office_codes():
    from .models import Office
    return list(Office.objects.filter(is_active=True, is_template=False).values_list("code", flat=True))


@register
class AppointmentImportSpec(ImportSpec):
    name = "appointments"
    label = "Office appointments"
    description = ("One row per appointment. Each person must have a profile that may hold the office "
                   "(for example a lecturer for Exam Officer, an active student of that level for Class Rep); "
                   "rows that break the rules, or that you may not appoint, are rejected.")
    key_fields = ("email", "office")
    columns = [
        Column("E-mail", "email", required=True, parse=lambda v: _text(v).lower(), example="a.bello@demo.eehub"),
        Column("Office code", "office", required=True, parse=_text, example="class-rep", lookup=_office_codes),
        Column("Profile", "kind", parse=lambda v: _text(v).lower(), example="student", lookup=lambda: PROFILE_VALUES,
               help="Blank = the first eligible profile of the person."),
        Column("Programme code", "programme", parse=_text, example="beng-ee", help="With Level, for level offices."),
        Column("Level", "level", parse=_level, example="300"),
        Column("Class or committee", "scope_label", parse=_text, example=""),
        Column("Start date", "start", parse=_date, example="2026-10-01"),
        Column("End date", "end", parse=_date, example=""),
        Column("Note", "note", parse=_text, example=""),
    ]

    def validate_row(self, cleaned):
        from department.models import Level

        from .models import Office, User

        user = User.objects.filter(email__iexact=cleaned["email"]).first()
        person = getattr(user, "person_or_none", None) if user else None
        if person is None:
            raise ValidationError(f"No person with the e-mail {cleaned['email']}.")
        office = Office.objects.filter(code=cleaned["office"], is_active=True, is_template=False).first()
        if office is None:
            raise ValidationError(f"Unknown office code {cleaned['office']}.")
        level = None
        if cleaned.get("level"):
            qs = Level.objects.filter(number=cleaned["level"])
            if cleaned.get("programme"):
                qs = qs.filter(programme__code=cleaned["programme"])
            level = qs.first()
            if level is None:
                raise ValidationError(f"Unknown level {cleaned['level']}.")
        if cleaned.get("kind") and cleaned["kind"] not in PROFILE_VALUES:
            raise ValidationError(f"Profile must be one of {', '.join(PROFILE_VALUES)}.")
        cleaned.update(_person=person, _office=office, _level=level)

    def save_row(self, cleaned):
        from core.audit import get_current_actor

        from . import appointing

        actor = get_current_actor()
        try:
            appointing.appoint(actor=actor, person=cleaned["_person"], office=cleaned["_office"],
                               profile_kind=cleaned.get("kind") or None, scope_level=cleaned["_level"],
                               scope_label=cleaned.get("scope_label") or "", start_date=cleaned.get("start"),
                               end_date=cleaned.get("end"), note=cleaned.get("note") or "Imported",
                               check_actor=actor is not None)
        except (appointing.EligibilityError, appointing.DelegationError) as exc:
            raise ValidationError(str(exc))
        return "created"


@register
class AppointmentExportSpec(ExportSpec):
    name = "appointments"
    label = "Office appointments"
    description = "Every current appointment, in the same columns as the import."
    columns = [Column("E-mail", "email"), Column("Office code", "office"), Column("Profile", "kind"),
               Column("Programme code", "programme"), Column("Level", "level"),
               Column("Class or committee", "scope_label"), Column("Start date", "start"), Column("End date", "end"),
               Column("Note", "note")]

    def get_queryset(self):
        from django.db.models import Q
        from django.utils import timezone

        from .models import Appointment
        today = timezone.localdate()
        return (Appointment.objects.filter(is_deleted=False, start_date__lte=today)
                .filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
                .select_related("person__user", "office", "scope_level__programme").order_by("office__code"))

    def value(self, a, column):
        f = column.field
        if f == "email":
            return a.person.user.email if a.person.user_id else ""
        if f == "office":
            return a.office.code
        if f == "kind":
            return a.profile_kind
        if f == "programme":
            return a.scope_level.programme.code if a.scope_level_id else ""
        if f == "level":
            return a.scope_level.number if a.scope_level_id else ""
        if f == "start":
            return a.start_date.isoformat()
        if f == "end":
            return a.end_date.isoformat() if a.end_date else ""
        return getattr(a, f, "") or ""
