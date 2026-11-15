"""Forms for the People-and-access screens."""
import re

from django import forms
from django.core.exceptions import ValidationError
from django.utils.text import slugify

from department.models import Level, Programme
from people.models import LecturerProfile, StaffProfile, StudentProfile

from . import regno
from .models import (OFFICE_PROFILE_KINDS, PROFILE_KINDS, Appointment, DelegationRule, Office, Person, ProfileRole,
                     RegNumberCategory, User)

PROFILE_CHOICES_WITH_NONE = [("", "No profile yet")] + PROFILE_KINDS


def _style(form):
    """Give every visible widget the NBTE input class."""
    for f in form.fields.values():
        w = f.widget
        if isinstance(w, (forms.CheckboxInput, forms.CheckboxSelectMultiple, forms.RadioSelect, forms.HiddenInput)):
            continue
        w.attrs.setdefault("class", "input")


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
class PersonFieldsMixin(forms.Form):
    title = forms.ChoiceField(choices=[(t, t or "-") for t in Person.TITLES], required=False)
    first_name = forms.CharField(max_length=80)
    middle_name = forms.CharField(max_length=80, required=False)
    last_name = forms.CharField(label="Surname", max_length=80)
    gender = forms.ChoiceField(choices=Person.GENDERS, required=False)
    phone = forms.CharField(max_length=30, required=False)


class UserCreateForm(PersonFieldsMixin):
    email = forms.EmailField(label="E-mail")
    login_id = forms.CharField(label="Sign-in number", max_length=40, required=False,
                               help_text="Optional. Leave blank to use the registration or staff number.")
    password = forms.CharField(max_length=128, required=False, widget=forms.TextInput(attrs={"autocomplete": "new-password"}),
                               help_text="Leave blank and EE Hub makes a temporary password for you.")
    is_staff = forms.BooleanField(label="Can open the Django admin", required=False)

    field_order = ["email", "title", "first_name", "middle_name", "last_name", "gender", "phone", "login_id", "password", "is_staff"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        _style(self)

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise ValidationError("A user with this e-mail already exists.")
        return email

    def clean_login_id(self):
        v = (self.cleaned_data.get("login_id") or "").strip().upper()
        if v and User.objects.filter(login_id=v).exists():
            raise ValidationError("Another user already signs in with this number.")
        return v

    def clean_password(self):
        pw = self.cleaned_data.get("password") or ""
        if pw and len(pw) < 8:
            raise ValidationError("Use at least 8 characters.")
        return pw


class UserEditForm(PersonFieldsMixin):
    email = forms.EmailField(label="E-mail")
    login_id = forms.CharField(label="Sign-in number", max_length=40, required=False)
    personal_email = forms.EmailField(required=False)
    is_staff = forms.BooleanField(label="Can open the Django admin", required=False)

    field_order = ["email", "login_id", "title", "first_name", "middle_name", "last_name", "gender", "phone", "personal_email", "is_staff"]

    def __init__(self, *args, user=None, **kwargs):
        self.user = user
        super().__init__(*args, **kwargs)
        _style(self)

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        if User.objects.filter(email__iexact=email).exclude(pk=self.user.pk).exists():
            raise ValidationError("A user with this e-mail already exists.")
        return email

    def clean_login_id(self):
        v = (self.cleaned_data.get("login_id") or "").strip().upper()
        if v and User.objects.filter(login_id=v).exclude(pk=self.user.pk).exists():
            raise ValidationError("Another user already signs in with this number.")
        return v


class ProfileForm(forms.Form):
    """Adds one profile to a person. Shared by 'Add a user' and 'Profiles'."""

    kind = forms.ChoiceField(label="Profile", choices=PROFILE_CHOICES_WITH_NONE, required=False)
    reg_number = forms.CharField(label="Registration number", max_length=40, required=False,
                                 widget=forms.TextInput(attrs={"autocapitalize": "characters", "spellcheck": "false"}))
    programme = forms.ModelChoiceField(queryset=Programme.objects.filter(is_active=True), required=False)
    level = forms.ModelChoiceField(queryset=Level.objects.select_related("programme"), required=False)
    entry_mode = forms.ChoiceField(choices=[("", "-"), ("UTME", "UTME"), ("Direct Entry", "Direct Entry"),
                                            ("Transfer", "Transfer"), ("Postgraduate", "Postgraduate")], required=False)
    staff_number = forms.CharField(max_length=40, required=False,
                                   widget=forms.TextInput(attrs={"autocapitalize": "characters", "spellcheck": "false"}))
    rank = forms.ChoiceField(choices=[(r, r) for r in LecturerProfile.RANKS], required=False, initial="Lecturer II")
    designation = forms.CharField(max_length=100, required=False, help_text="e.g. Chief Technologist")
    programme_name = forms.CharField(label="Programme studied", max_length=120, required=False)
    graduation_year = forms.IntegerField(min_value=1960, max_value=2100, required=False)

    def __init__(self, *args, person=None, require_kind=False, **kwargs):
        self.person = person
        super().__init__(*args, **kwargs)
        if require_kind:
            self.fields["kind"].required = True
            self.fields["kind"].choices = PROFILE_KINDS
        _style(self)
        self.reg_category = None

    def clean(self):
        cd = super().clean()
        kind = cd.get("kind")
        if not kind:
            return cd
        p = self.person
        if kind == "student":
            reg = (cd.get("reg_number") or "").strip().upper()
            cd["reg_number"] = reg
            if not reg:
                self.add_error("reg_number", "A student needs a registration number.")
            else:
                if StudentProfile.all_objects.filter(reg_number=reg).exists():
                    self.add_error("reg_number", "This registration number is already in use.")
                cats = RegNumberCategory.objects.filter(is_active=True, profile_kind="student")
                cat = regno.categorise(reg, "student")
                if cat is None and cats.exists():
                    names = ", ".join(c.name for c in cats[:4])
                    self.add_error("reg_number", f"{reg} does not match any registration-number format ({names}). "
                                                 "Check the number or add a format under Registration numbers.")
                self.reg_category = cat
                if cat and cat.programme_id:
                    if cd.get("programme") and cd["programme"].pk != cat.programme_id:
                        self.add_error("programme", f"{reg} is a {cat.name} number, which belongs to {cat.programme}.")
                    elif not cd.get("programme"):
                        cd["programme"] = cat.programme
            if not cd.get("programme"):
                self.add_error("programme", "Choose the programme.")
            lvl = cd.get("level")
            if lvl and cd.get("programme") and lvl.programme_id != cd["programme"].pk:
                self.add_error("level", "That level belongs to another programme.")
            if not lvl:
                self.add_error("level", "Choose the level.")
        elif kind in ("lecturer", "staff"):
            sn = (cd.get("staff_number") or "").strip().upper()
            cd["staff_number"] = sn
            if not sn:
                self.add_error("staff_number", "A staff number is required.")
            else:
                model = LecturerProfile if kind == "lecturer" else StaffProfile
                clash = model.all_objects.filter(staff_number=sn)
                if p is not None:
                    clash = clash.exclude(person=p)
                if clash.exists():
                    self.add_error("staff_number", "This staff number is already in use.")
                cat = regno.categorise(sn, kind)
                if cat is None and RegNumberCategory.objects.filter(is_active=True, profile_kind=kind).exists():
                    self.add_error("staff_number", f"{sn} does not match any {kind} number format.")
            if p is not None:
                rel = "lecturer_profile" if kind == "lecturer" else "staff_profile"
                existing = getattr(p, rel, None) if hasattr(p, rel) else None
                if existing is not None and not existing.is_deleted:
                    self.add_error("kind", f"This person already has a {kind} profile.")
        elif kind == "alumni" and p is not None:
            try:
                al = p.alumni_profile
            except Exception:
                al = None
            if al is not None and not al.is_deleted:
                self.add_error("kind", "This person already has an alumni profile.")
        return cd

    def login_number(self):
        cd = self.cleaned_data
        return cd.get("reg_number") if cd.get("kind") == "student" else cd.get("staff_number") or ""

    def save(self, person):
        """Create (or revive) the profile; returns it or None."""
        from people.models import AlumniProfile
        cd = self.cleaned_data
        kind = cd.get("kind")
        if kind == "student":
            return StudentProfile.objects.create(
                person=person, reg_number=cd["reg_number"], reg_category=self.reg_category,
                programme=cd["programme"], level=cd.get("level"), entry_mode=cd.get("entry_mode") or "")
        if kind in ("lecturer", "staff"):
            model = LecturerProfile if kind == "lecturer" else StaffProfile
            obj = model.all_objects.filter(person=person).first()
            data = {"staff_number": cd["staff_number"]}
            if kind == "lecturer":
                data["rank"] = cd.get("rank") or "Lecturer II"
            else:
                data["designation"] = cd.get("designation") or ""
            if obj is None:
                return model.objects.create(person=person, **data)
            for k, v in data.items():
                setattr(obj, k, v)
            obj.is_deleted, obj.deleted_at, obj.status = False, None, "active"
            obj.save()
            return obj
        if kind == "alumni":
            obj = AlumniProfile.all_objects.filter(person=person).first()
            data = {"programme_name": cd.get("programme_name") or "", "graduation_year": cd.get("graduation_year"),
                    "is_verified": True}
            if obj is None:
                return AlumniProfile.objects.create(person=person, **data)
            for k, v in data.items():
                setattr(obj, k, v)
            obj.is_deleted, obj.deleted_at = False, None
            obj.save()
            return obj
        return None


class OverrideForm(forms.Form):
    permission = forms.ChoiceField(label="Permission")
    effect = forms.ChoiceField(choices=[("grant", "Grant"), ("revoke", "Revoke")], widget=forms.RadioSelect, initial="grant")
    reason = forms.CharField(max_length=255, help_text="Recorded in the audit log.")
    expires_on = forms.DateField(label="Expires on", required=False, widget=forms.DateInput(attrs={"type": "date"}),
                                 help_text="Leave blank for no expiry.")

    def __init__(self, *args, catalogue=None, **kwargs):
        super().__init__(*args, **kwargs)
        choices = [("", "Choose a permission")]
        for g in catalogue or []:
            choices.append((g["label"], [(i["full"], i["label"]) for i in g["items"]]))
        self.fields["permission"].choices = choices
        _style(self)


# ---------------------------------------------------------------------------
# Offices
# ---------------------------------------------------------------------------
COLOURS = [("green", "Green"), ("gold", "Gold"), ("volt", "Volt"), ("plum", "Plum"), ("ember", "Ember"), ("slate", "Slate")]


class OfficeCreateForm(forms.Form):
    template = forms.ModelChoiceField(queryset=Office.objects.none(), required=False, empty_label="Start from scratch",
                                      help_text="Its permissions, dashboard, icon and colour are copied.")
    name = forms.CharField(max_length=100)
    short_name = forms.CharField(max_length=40, required=False)
    copy_from = forms.ModelChoiceField(label="Copy an existing office", queryset=Office.objects.none(), required=False,
                                       empty_label="-")
    code = forms.SlugField(max_length=60, required=False, help_text="Used in links. Leave blank to make one from the name.")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["template"].queryset = Office.objects.all()
        self.fields["copy_from"].queryset = Office.objects.order_by("category", "-rank", "name")
        _style(self)

    def clean(self):
        cd = super().clean()
        if cd.get("copy_from"):
            cd["template"] = cd["copy_from"]
        code = cd.get("code") or slugify(cd.get("name") or "")[:60]
        if not code:
            self.add_error("name", "Give the office a name.")
            return cd
        base, n = code, 2
        if cd.get("code") and Office.objects.filter(code=code).exists():
            self.add_error("code", "An office already uses this code.")
        while not cd.get("code") and Office.objects.filter(code=code).exists():
            code = f"{base[:55]}-{n}"
            n += 1
        cd["code"] = code
        return cd


class OfficeForm(forms.ModelForm):
    allowed_kinds = forms.MultipleChoiceField(
        label="Who may hold it", choices=PROFILE_KINDS, widget=forms.CheckboxSelectMultiple, required=False,
        help_text="Appointments, imports and the admin refuse anyone else. Students must be active students.")

    class Meta:
        model = Office
        fields = ["name", "short_name", "description", "category", "profile_kind", "scope_kind", "rank",
                  "max_holders", "icon", "color", "is_active", "is_template", "level_must_match"]
        widgets = {"description": forms.Textarea(attrs={"rows": 3}), "color": forms.Select(choices=COLOURS)}
        labels = {"color": "Colour", "profile_kind": "Sits inside", "scope_kind": "Scope",
                  "is_template": "Offer as a template for new offices", "is_active": "Active",
                  "level_must_match": "Student holders must belong to the level it serves"}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from .appointing import allowed_profile_kinds
        if self.instance and self.instance.pk:
            self.fields["allowed_kinds"].initial = allowed_profile_kinds(self.instance)
        _style(self)

    def clean(self):
        cd = super().clean()
        kinds = [k for k, _ in PROFILE_KINDS if k in (cd.get("allowed_kinds") or [])]
        pk = cd.get("profile_kind")
        if not kinds:
            kinds = [k for k, _ in PROFILE_KINDS] if pk == "any" else [pk] if pk else []
        if pk and pk != "any" and pk not in kinds:
            self.add_error("allowed_kinds", f"The office sits inside the {pk} profile, so {pk}s must be allowed to hold it.")
        if cd.get("level_must_match") and "student" not in kinds:
            self.add_error("level_must_match", "Only matters when students may hold the office.")
        cd["allowed_kinds"] = kinds
        return cd

    def save(self, commit=True):
        obj = super().save(commit=False)
        obj.allowed_profile_kinds = self.cleaned_data["allowed_kinds"]
        if commit:
            obj.save()
        return obj

    def clean_icon(self):
        name = (self.cleaned_data.get("icon") or "").strip()
        from core.templatetags.ee_tags import _icons
        if name and name not in _icons():
            raise ValidationError("Unknown icon name. Use a Lucide icon name, e.g. badge-check.")
        return name or "badge-check"


class ProfileRoleForm(forms.ModelForm):
    class Meta:
        model = ProfileRole
        fields = ["name", "description"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        _style(self)


class AppointForm(forms.Form):
    """Appoint one person. Only eligible profiles are offered (A1); the actor's delegation
    limits the levels (A4). Saving goes through accounts.appointing.appoint()."""

    person = forms.ModelChoiceField(queryset=Person.objects.all(), widget=forms.HiddenInput,
                                    error_messages={"required": "Search for and choose a person."})
    profile_kind = forms.ChoiceField(label="As their", choices=PROFILE_KINDS)
    scope_programme = forms.ModelChoiceField(label="Programme", queryset=Programme.objects.all(), required=False)
    scope_level = forms.ModelChoiceField(label="Level", queryset=Level.objects.select_related("programme"), required=False)
    scope_label = forms.CharField(label="Class or committee", max_length=120, required=False,
                                  help_text="e.g. B.Eng 300L 2024 entry")
    start_date = forms.DateField(widget=forms.DateInput(attrs={"type": "date"}))
    end_date = forms.DateField(required=False, widget=forms.DateInput(attrs={"type": "date"}), help_text="Leave blank if open-ended.")
    is_acting = forms.BooleanField(label="Acting appointment", required=False)
    note = forms.CharField(max_length=255, required=False)

    def __init__(self, *args, office=None, actor=None, **kwargs):
        from .appointing import allowed_profile_kinds, appointable_offices, eligible_people
        self.office = office
        self.actor = actor
        super().__init__(*args, **kwargs)
        kinds = allowed_profile_kinds(office) if office is not None else [k for k, _ in PROFILE_KINDS]
        self.allowed_kinds = kinds
        self.fields["profile_kind"].choices = [(k, l) for k, l in PROFILE_KINDS if k in kinds]
        self.fields["profile_kind"].initial = office.profile_kind if office is not None and office.profile_kind in kinds else kinds[0]
        if office is not None:
            self.fields["person"].queryset = eligible_people(office)
            self.level_ids = None
            if actor is not None:
                for o, levels in appointable_offices(actor):
                    if o.pk == office.pk:
                        self.level_ids = levels
                        break
            if self.level_ids is not None:
                self.fields["scope_level"].queryset = Level.objects.select_related("programme").filter(pk__in=self.level_ids)
                self.fields["scope_level"].required = True
                self.fields["scope_level"].help_text = "You can appoint for the level you serve only."
        _style(self)

    def clean(self):
        from .appointing import EligibilityError, can_appoint, check_eligible
        cd = super().clean()
        o = self.office
        person = cd.get("person")
        kind = cd.get("profile_kind")
        if cd.get("end_date") and cd.get("start_date") and cd["end_date"] < cd["start_date"]:
            self.add_error("end_date", "The end date is before the start date.")
        lvl, prog = cd.get("scope_level"), cd.get("scope_programme")
        if lvl and prog and lvl.programme_id != prog.pk:
            self.add_error("scope_level", "That level belongs to another programme.")
        if lvl and not prog:
            cd["scope_programme"] = prog = lvl.programme
        if (o.scope_kind == "level" or o.level_must_match) and not lvl:
            self.add_error("scope_level", "This office serves one level. Choose it.")
        if o.scope_kind == "programme" and not prog:
            self.add_error("scope_programme", "This office is scoped to one programme. Choose it.")
        if o.scope_kind in ("class", "committee") and not cd.get("scope_label") and not lvl:
            self.add_error("scope_label", "Say which class or committee.")
        if person and kind and not self.errors:
            try:
                check_eligible(person, o, kind, scope_level=lvl)
            except EligibilityError as exc:
                self.add_error("profile_kind", str(exc))
        if self.actor is not None and not self.errors and not can_appoint(self.actor, o, scope_level=lvl):
            raise ValidationError(f"You cannot appoint to {o.name}" + (f" for {lvl}" if lvl else "") + ".")
        if person and not self.errors:
            current = o.current_appointments().filter(is_deleted=False)
            if current.filter(person=person, scope_level=lvl, scope_programme=prog,
                              scope_label=cd.get("scope_label") or "").exists():
                raise ValidationError("This person already holds this office for that scope.")
            if o.max_holders:
                same_scope = current.filter(scope_level=lvl, scope_programme=prog, scope_label=cd.get("scope_label") or "")
                if same_scope.count() >= o.max_holders:
                    raise ValidationError(f"{o.name} allows {o.max_holders} holder{'s' if o.max_holders != 1 else ''} "
                                          "per scope and that is already reached. End a current appointment first.")
        return cd


# ---------------------------------------------------------------------------
# Round 7: grants and delegation rules
# ---------------------------------------------------------------------------
class GrantForm(forms.Form):
    user = forms.ModelChoiceField(queryset=User.objects.filter(is_active=True), widget=forms.HiddenInput,
                                  error_messages={"required": "Search for and choose a person."})
    what = forms.ChoiceField(label="Give", choices=[("perms", "Permissions"), ("office", "An office, for a while")],
                             widget=forms.RadioSelect, initial="perms")
    permissions = forms.MultipleChoiceField(required=False, widget=forms.CheckboxSelectMultiple)
    office = forms.ModelChoiceField(queryset=Office.objects.none(), required=False, empty_label="Choose an office")
    scope_level = forms.ModelChoiceField(label="Level", queryset=Level.objects.select_related("programme"), required=False)
    profile_kind = forms.ChoiceField(label="Only while acting as", choices=[("", "Any profile")] + PROFILE_KINDS, required=False)
    reason = forms.CharField(max_length=255, help_text="Recorded with the grant and shown to the person.")
    starts_on = forms.DateField(label="From", widget=forms.DateInput(attrs={"type": "date"}))
    ends_on = forms.DateField(label="Until", widget=forms.DateInput(attrs={"type": "date"}),
                              help_text="The access ends at the end of this day.")

    def __init__(self, *args, actor=None, perm_choices=(), offices=(), **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["permissions"].choices = list(perm_choices)
        self.fields["office"].queryset = Office.objects.filter(pk__in=[o.pk for o in offices])
        _style(self)

    def clean(self):
        cd = super().clean()
        if cd.get("starts_on") and cd.get("ends_on") and cd["ends_on"] < cd["starts_on"]:
            self.add_error("ends_on", "The end is before the start.")
        if cd.get("what") == "office":
            if not cd.get("office"):
                self.add_error("office", "Choose the office.")
            cd["permissions"] = []
        else:
            if not cd.get("permissions"):
                self.add_error("permissions", "Tick at least one permission.")
            cd["office"] = None
        return cd


class DelegationRuleForm(forms.ModelForm):
    office_categories = forms.MultipleChoiceField(label="Every office in these categories", choices=Office.CATEGORIES,
                                                  widget=forms.CheckboxSelectMultiple, required=False)

    class Meta:
        model = DelegationRule
        fields = ["grantor_office", "offices", "office_categories", "except_offices", "permissions",
                  "any_held_permission", "scope_rule", "max_days", "note", "is_active"]
        widgets = {"offices": forms.CheckboxSelectMultiple, "except_offices": forms.CheckboxSelectMultiple,
                   "permissions": forms.CheckboxSelectMultiple}
        labels = {"grantor_office": "Holder of", "offices": "May appoint to these offices",
                  "except_offices": "But never to", "permissions": "May grant these permissions (if they hold them)",
                  "any_held_permission": "May grant any permission they hold", "scope_rule": "Where",
                  "max_days": "Longest grant (days, 0 = site limit)", "is_active": "Active"}

    def __init__(self, *args, perm_qs=None, **kwargs):
        super().__init__(*args, **kwargs)
        offices = Office.objects.filter(is_template=False).order_by("category", "-rank", "name")
        self.fields["grantor_office"].queryset = offices
        self.fields["offices"].queryset = offices
        self.fields["except_offices"].queryset = offices
        if perm_qs is not None:
            self.fields["permissions"].queryset = perm_qs
        self.fields["permissions"].label_from_instance = lambda p: p.name[:1].upper() + p.name[1:]
        for f in ("grantor_office", "offices", "except_offices"):
            self.fields[f].label_from_instance = lambda o: o.name
        self.fields["offices"].required = False
        self.fields["except_offices"].required = False
        self.fields["permissions"].required = False
        _style(self)


class BroadcastForm(forms.Form):
    AUDIENCES = [("level", "A whole class (level)"), ("offering", "Students of one course")]
    audience = forms.ChoiceField(choices=AUDIENCES, widget=forms.RadioSelect, initial="level")
    level = forms.ModelChoiceField(queryset=Level.objects.select_related("programme"), required=False)
    offering = forms.ChoiceField(label="Course", required=False)
    title = forms.CharField(max_length=120)
    body = forms.CharField(widget=forms.Textarea(attrs={"rows": 4}), max_length=1500)
    kind = forms.ChoiceField(label="Type", choices=[("announcement", "Announcement"), ("reminder", "Reminder")],
                             initial="announcement")

    def __init__(self, *args, levels=None, offerings=(), **kwargs):
        super().__init__(*args, **kwargs)
        if levels is not None:
            self.fields["level"].queryset = levels
        self.fields["offering"].choices = [("", "Choose a course")] + list(offerings)
        _style(self)

    def clean(self):
        cd = super().clean()
        if cd.get("audience") == "level" and not cd.get("level"):
            self.add_error("level", "Choose the class.")
        if cd.get("audience") == "offering" and not cd.get("offering"):
            self.add_error("offering", "Choose the course.")
        return cd


# ---------------------------------------------------------------------------
# Registration numbers
# ---------------------------------------------------------------------------
class RegNumberCategoryForm(forms.ModelForm):
    class Meta:
        model = RegNumberCategory
        fields = ["name", "code", "profile_kind", "programme", "samples", "auto_pattern", "pattern", "priority", "is_active"]
        widgets = {"samples": forms.Textarea(attrs={"rows": 5, "spellcheck": "false", "placeholder": "U21EE1031\nU22EE1047"}),
                   "pattern": forms.TextInput(attrs={"spellcheck": "false", "class": "input ee-mono"})}
        labels = {"auto_pattern": "Write the pattern from the samples", "pattern": "Pattern (regular expression)",
                  "profile_kind": "Used for", "is_active": "Active"}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["pattern"].required = False
        self.fields["code"].required = False
        self.fields["code"].help_text = "Leave blank to make one from the name."
        _style(self)

    def clean_samples(self):
        lines = [s.strip().upper() for s in (self.cleaned_data.get("samples") or "").splitlines() if s.strip()]
        return "\n".join(lines)

    def clean(self):
        cd = super().clean()
        if not cd.get("code") and cd.get("name"):
            base = slugify(cd["name"])[:36] or "format"
            code, n = base, 2
            while RegNumberCategory.objects.filter(code=code).exclude(pk=self.instance.pk).exists():
                code = f"{base}-{n}"
                n += 1
            cd["code"] = code
        samples = [s for s in (cd.get("samples") or "").splitlines() if s]
        if cd.get("auto_pattern"):
            if not samples:
                self.add_error("samples", "Give at least one sample number, or switch off the automatic pattern.")
            else:
                cd["pattern"] = regno.pattern_from_samples(samples)
        else:
            pat = (cd.get("pattern") or "").strip()
            if not pat:
                self.add_error("pattern", "Type a pattern, or switch on the automatic pattern.")
            else:
                try:
                    re.compile(pat)
                except re.error as exc:
                    self.add_error("pattern", f"This is not a valid pattern: {exc}.")
                else:
                    cd["pattern"] = pat
                    bad = [s for s in samples if not re.fullmatch(pat.strip("^$"), s)]
                    if bad:
                        self.add_error("samples", f"These samples do not match the pattern: {', '.join(bad[:5])}.")
        return cd

    def save(self, commit=True):
        obj = super().save(commit=False)
        obj.code = self.cleaned_data["code"]
        obj.pattern = self.cleaned_data.get("pattern") or obj.pattern
        if commit:
            obj.save()
        return obj
