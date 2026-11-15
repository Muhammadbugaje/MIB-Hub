"""Import/export specs for users, plugged into the NBTE import/export wizard
(core.importexport). Registered when the accounts app is ready."""
import secrets

from django.core.exceptions import ValidationError

from core.importexport import Column, ExportSpec, ImportSpec, register

PROFILE_VALUES = ["student", "lecturer", "staff", "alumni"]


def _programme_codes():
    from department.models import Programme
    return list(Programme.objects.filter(is_active=True).values_list("code", flat=True))


def _text(v):
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip()


def _kind(v):
    v = _text(v).lower()
    if v not in PROFILE_VALUES:
        raise ValueError(f"use one of {', '.join(PROFILE_VALUES)}")
    return v


def _gender(v):
    v = _text(v).lower()
    if v in ("m", "male"):
        return "male"
    if v in ("f", "female"):
        return "female"
    raise ValueError("use Female or Male")


def _level(v):
    try:
        return int(float(_text(v).upper().rstrip("L")))
    except ValueError:
        raise ValueError("use a number such as 100 or 1")


def temp_password():
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
    return "".join(secrets.choice(alphabet) for _ in range(10))


@register
class UserImportSpec(ImportSpec):
    name = "users"
    label = "Users and profiles"
    description = ("One row per person. Creates the sign-in, the identity record and a first profile. "
                   "Registration numbers are checked against the registration-number formats.")
    key_fields = ("email",)
    columns = [
        Column("E-mail", "email", required=True, parse=lambda v: _text(v).lower(), example="a.bello@demo.eehub"),
        Column("Title", "title", parse=_text, example="Mr"),
        Column("First name", "first_name", required=True, parse=_text, example="Aisha"),
        Column("Middle name", "middle_name", parse=_text),
        Column("Surname", "last_name", required=True, parse=_text, example="Bello"),
        Column("Gender", "gender", parse=_gender, example="Female", lookup=lambda: ["Female", "Male"]),
        Column("Phone", "phone", parse=_text, example="0800 000 0000"),
        Column("Profile", "kind", parse=_kind, example="student", lookup=lambda: PROFILE_VALUES,
               help="student, lecturer, staff or alumni. Blank creates the user only."),
        Column("Registration number", "reg_number", parse=lambda v: _text(v).upper(), example="U26EE1201",
               help="Students only."),
        Column("Programme code", "programme", parse=_text, example="beng-ee", lookup=_programme_codes,
               help="Students only. Optional when the number's format already names the programme."),
        Column("Level", "level", parse=_level, example="100", help="Students only. 100-500, or 1, 2 for PG years."),
        Column("Staff number", "staff_number", parse=lambda v: _text(v).upper(), example="",
               help="Lecturers and staff."),
        Column("Rank or designation", "rank", parse=_text, example="",
               help="Lecturer rank (e.g. Lecturer II) or staff designation."),
    ]

    def validate_row(self, cleaned):
        from department.models import Level, Programme

        from .access_forms import ProfileForm
        from .models import User

        user = User.objects.filter(email__iexact=cleaned["email"]).first()
        person = getattr(user, "person_or_none", None) if user else None
        cleaned["_user"], cleaned["_person"] = user, person
        kind = cleaned.get("kind")
        cleaned["_profile_form"] = None
        if not kind:
            return
        prog = None
        if cleaned.get("programme"):
            prog = Programme.objects.filter(code=cleaned["programme"]).first()
            if prog is None:
                raise ValidationError(f"Programme code {cleaned['programme']} is not known.")
        if kind == "student" and person is not None and cleaned.get("reg_number") and \
                person.student_profiles.filter(reg_number=cleaned["reg_number"]).exists():
            return  # already there: update names only
        if kind in ("lecturer", "staff", "alumni") and person is not None:
            rel = {"lecturer": "lecturer_profile", "staff": "staff_profile", "alumni": "alumni_profile"}[kind]
            try:
                existing = getattr(person, rel)
            except Exception:
                existing = None
            if existing is not None and not existing.is_deleted:
                return
        data = {"kind": kind, "reg_number": cleaned.get("reg_number") or "",
                "staff_number": cleaned.get("staff_number") or ""}
        if kind == "lecturer":
            from people.models import LecturerProfile
            rank = cleaned.get("rank") or "Lecturer II"
            if rank not in LecturerProfile.RANKS:
                raise ValidationError(f"Rank must be one of: {', '.join(LecturerProfile.RANKS)}.")
            data["rank"] = rank
        elif kind == "staff":
            data["designation"] = cleaned.get("rank") or ""
        if kind == "student":
            from . import regno
            cat = regno.categorise(data["reg_number"], "student") if data["reg_number"] else None
            if prog is None and cat is not None and cat.programme_id:
                prog = cat.programme
            if prog is not None:
                data["programme"] = prog.pk
                if cleaned.get("level") is not None:
                    lvl = Level.objects.filter(programme=prog, number=cleaned["level"]).first()
                    if lvl is None:
                        raise ValidationError(f"{prog} has no level {cleaned['level']}.")
                    data["level"] = lvl.pk
        form = ProfileForm(data, person=person)
        if not form.is_valid():
            msgs = []
            for field, errs in form.errors.items():
                msgs.extend(errs)
            raise ValidationError(msgs)
        cleaned["_profile_form"] = form

    def save_row(self, cleaned):
        from .first_login import required_for_new_accounts
        from .models import Person, User

        user, person = cleaned.get("_user"), cleaned.get("_person")
        outcome = "updated"
        if user is None:
            form = cleaned.get("_profile_form")
            login = form.login_number() if form else ""
            if login and User.objects.filter(login_id=login.upper()).exists():
                login = ""
            user = User.objects.create_user(email=cleaned["email"], password=temp_password(),
                                            login_id=login or None,
                                            must_change_password=required_for_new_accounts())
            outcome = "created"
        if person is None:
            person = Person(user=user)
        for f in ("title", "first_name", "middle_name", "last_name", "gender", "phone"):
            if cleaned.get(f):
                setattr(person, f, cleaned[f])
        person.save()
        if cleaned.get("_profile_form") is not None:
            cleaned["_profile_form"].save(person)
        return outcome


@register
class UserExportSpec(ExportSpec):
    name = "users"
    label = "Users and profiles"
    description = "Every active user with their main profile."
    columns = [Column("E-mail", "email"), Column("Title", "title"), Column("First name", "first_name"),
               Column("Middle name", "middle_name"), Column("Surname", "last_name"), Column("Gender", "gender"),
               Column("Phone", "phone"), Column("Profile", "kind"), Column("Registration number", "reg_number"),
               Column("Programme code", "programme"), Column("Level", "level"), Column("Staff number", "staff_number"),
               Column("Rank or designation", "rank")]

    def get_queryset(self):
        from .models import User
        return User.objects.filter(is_active=True).select_related("person")

    def value(self, user, column):
        p = user.person_or_none
        f = column.field
        if f == "email":
            return user.email
        if p is None:
            return ""
        if f in ("title", "first_name", "middle_name", "last_name", "gender", "phone"):
            return getattr(p, f) or ""
        st = p.student_profiles.select_related("programme", "level").first()
        lp = getattr(p, "lecturer_profile", None) if _has(p, "lecturer_profile") else None
        sp = getattr(p, "staff_profile", None) if _has(p, "staff_profile") else None
        if f == "kind":
            return "lecturer" if lp else "staff" if sp else "student" if st else ""
        if f == "reg_number":
            return st.reg_number if st else ""
        if f == "programme":
            return st.programme.code if st else ""
        if f == "level":
            return st.level.number if st and st.level else ""
        if f == "staff_number":
            return (lp or sp).staff_number if (lp or sp) else ""
        if f == "rank":
            return lp.rank if lp else (sp.designation if sp else "")
        return ""


def _has(obj, rel):
    try:
        v = getattr(obj, rel)
        return v is not None and not v.is_deleted
    except Exception:
        return False
