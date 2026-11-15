"""Identity and access.

One login (User) per human, one identity (Person), several *profiles*
(Student / Lecturer / Staff / Alumni, in the `people` app) the person switches
between, and any number of *offices* (HOD, Exam Officer, Class Rep ...) that
stack inside a profile through Appointments. Offices are data: admins create
them on the fly, from a template or from scratch, choose their permissions and
build each office's own dashboard.
"""
from django.conf import settings
from django.contrib.auth.models import AbstractUser, BaseUserManager, Permission
from django.db import models
from django.utils import timezone

from core.imaging import CompressedImageField
from core.models import PublicIdMixin, SoftDeleteModel, TimeStampedModel
from core.storage import uuid_upload_to

PROFILE_KINDS = [
    ("student", "Student"),
    ("lecturer", "Lecturer"),
    ("staff", "Staff"),
    ("alumni", "Alumni"),
]
OFFICE_PROFILE_KINDS = PROFILE_KINDS + [("any", "Any profile")]


# ---------------------------------------------------------------------------
# User + Person
# ---------------------------------------------------------------------------
class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("An e-mail address is required.")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("must_change_password", False)
        return self._create_user(email, password, **extra)


class User(AbstractUser):
    """Login credentials only. Names and contact details live on Person."""

    AUDITED = True
    AUDIT_EXCLUDE_FIELDS = ("password",)

    username = None
    email = models.EmailField("e-mail", unique=True)
    login_id = models.CharField(
        "registration / staff number", max_length=40, unique=True, null=True, blank=True,
        help_text="Users may sign in with this instead of their e-mail (stored in capitals).")
    must_change_password = models.BooleanField(default=False)
    default_profile = models.CharField(max_length=40, blank=True,
                                       help_text="Profile key opened after sign-in, e.g. 'lecturer:4'.")
    last_seen = models.DateTimeField(null=True, blank=True)
    preferences = models.JSONField(default=dict, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    objects = UserManager()

    class Meta:
        ordering = ["email"]

    def save(self, *args, **kwargs):
        self.email = (self.email or "").strip().lower()
        if self.login_id:
            self.login_id = self.login_id.strip().upper()
        else:
            self.login_id = None
        super().save(*args, **kwargs)

    # Names come from the Person record.
    @property
    def person_or_none(self):
        try:
            return self.person
        except Exception:
            return None

    def get_full_name(self):
        p = self.person_or_none
        return p.full_name if p else (super().get_full_name() or self.email)

    def get_short_name(self):
        p = self.person_or_none
        return p.first_name if p and p.first_name else self.email.split("@")[0]

    @property
    def display_name(self):
        return self.get_full_name()

    @property
    def config_scope(self):
        return "global"

    def __str__(self):
        return f"{self.get_full_name()} <{self.email}>"


class Person(PublicIdMixin, SoftDeleteModel):
    """THE identity record. Every profile attaches here; nothing else stores names."""

    MEDIA_SUBDIR = "people/photos"
    TITLES = ["", "Mr", "Mrs", "Ms", "Miss", "Dr", "Engr", "Prof", "Engr Dr", "Arc"]
    GENDERS = [("", "-"), ("female", "Female"), ("male", "Male")]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, null=True, blank=True,
                                on_delete=models.SET_NULL, related_name="person")
    title = models.CharField(max_length=20, blank=True)
    first_name = models.CharField(max_length=80)
    middle_name = models.CharField(max_length=80, blank=True)
    last_name = models.CharField(max_length=80)
    gender = models.CharField(max_length=10, choices=GENDERS, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    personal_email = models.EmailField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    state_of_origin = models.CharField(max_length=40, blank=True)
    nationality = models.CharField(max_length=40, blank=True, default="Nigerian")
    photo = CompressedImageField(upload_to=uuid_upload_to, blank=True, square=True)
    bio = models.TextField(blank=True)

    class Meta:
        ordering = ["last_name", "first_name"]
        indexes = [models.Index(fields=["last_name", "first_name"])]

    @property
    def full_name(self):
        parts = [self.title, self.first_name, self.middle_name, self.last_name]
        return " ".join(p for p in parts if p).strip()

    @property
    def plain_name(self):
        return " ".join(p for p in (self.first_name, self.last_name) if p)

    @property
    def surname_first(self):
        rest = " ".join(p for p in (self.first_name, self.middle_name) if p)
        return f"{self.last_name.upper()}, {rest}".strip(", ")

    def __str__(self):
        return self.full_name

    PROFILE_FIELDS = ("phone", "date_of_birth", "gender", "photo", "address", "state_of_origin", "bio")

    def completeness(self):
        filled = sum(1 for f in self.PROFILE_FIELDS if getattr(self, f))
        return round(100 * filled / len(self.PROFILE_FIELDS))


# ---------------------------------------------------------------------------
# Permission catalogue
# ---------------------------------------------------------------------------
# Every power in EE Hub is a permission here, grouped for the matrix. Powers
# for later phases exist from day one so offices can be designed now; the
# phase badge in the matrix says when each one starts to do something.
CAPABILITY_GROUPS = [
    ("users", "People and access", 0, [
        ("users_manage", "Create, edit and lock user accounts"),
        ("users_import", "Import users from Excel"),
        ("users_reset_password", "Reset other users' passwords"),
        ("offices_manage", "Create and edit offices and office templates"),
        ("offices_appoint", "Appoint and end appointments"),
        ("matrix_edit", "Change the permission matrix"),
        ("regno_manage", "Manage registration-number categories"),
        ("directory_view", "See the full people directory"),
        ("grants_manage", "Give and revoke time-boxed access grants"),
        ("access_log_view", "See who viewed restricted personal data (access log)"),
        ("classes_view", "See class lists, class reps and tutors"),
        ("class_broadcast", "Send an announcement to a whole class or a course's students"),
        ("student_contacts_view", "See students' phone numbers and personal e-mails"),
        ("staff_records_manage", "Keep staff records (records officer)"),
        ("staff_records_approve", "Approve changes to staff rank, qualification and laboratory"),
        ("staff_contacts_view", "See staff phone numbers and alternate e-mails"),
    ]),
    ("settings", "Settings and system", 0, [
        ("settings_edit", "Change settings"),
        ("branding_manage", "Choose and upload logos"),
        ("dashboards_design", "Design office dashboards"),
    ]),
    ("content", "Public website", 1, [
        ("content_pages", "Create and publish pages"),
        ("content_home", "Arrange the homepage"),
        ("content_news", "Publish news and announcements"),
        ("content_events", "Manage events"),
        ("content_gallery", "Manage gallery albums"),
        ("content_history", "Edit history: HODs, milestones, statistics"),
        ("content_people", "Edit the public staff directory"),
        ("content_awards", "Manage hall of fame and awards"),
    ]),
    ("academics", "Academics", 2, [
        ("academics_calendar", "Manage sessions and semesters"),
        ("academics_courses", "Manage the course catalogue"),
        ("academics_allocate", "Allocate courses to lecturers"),
        ("academics_sign_forms", "Sign course forms"),
        ("academics_timetable", "Manage timetables"),
        ("academics_materials", "Upload course materials"),
        ("academics_approve_tutor_uploads", "Approve tutor uploads"),
    ]),
    ("results", "Results", 3, [
        ("results_upload", "Upload attendance, CA and exam scores"),
        ("results_review", "Review result sheets"),
        ("results_approve", "Approve result sheets (HOD)"),
        ("results_seal", "Seal results and set the approval date"),
        ("results_release", "Release results to the paid list"),
        ("results_view_all", "View every student's results"),
        ("results_correct", "Approve result corrections"),
        ("results_paid_list", "Upload the Bursary paid list for results"),
    ]),
    ("cbt", "CBT", 4, [
        ("cbt_bank", "Manage question banks"),
        ("cbt_run", "Set up and monitor tests"),
        ("cbt_publish", "Publish CBT results"),
    ]),
    ("workflow", "Memos and requests", 5, [
        ("memo_send", "Send memos"),
        ("memo_circular", "Send circulars to groups"),
        ("requests_verify", "Verify class requests (class rep)"),
        ("requests_class", "Raise requests on behalf of a class"),
        ("requests_approve", "Approve student requests"),
        ("complaints_handle", "Handle complaints"),
    ]),
    ("welfare", "Welfare and feedback", 6, [
        ("welfare_cases", "Manage welfare cases and call-ups"),
        ("welfare_fines", "Raise and clear fines"),
        ("welfare_waive", "Waive fines"),
        ("welfare_confidential", "Read confidential counselling notes"),
        ("feedback_run", "Run feedback campaigns"),
        ("feedback_reports", "See feedback reports"),
    ]),
    ("lifecycle", "Promotion and graduation", 6, [
        ("students_promote", "Promote students"),
        ("students_graduate", "Graduate students"),
        ("alumni_approve", "Approve alumni log-ins"),
        ("staff_promotion", "Manage staff promotion cases"),
    ]),
    ("community", "Community and research", 7, [
        ("elections_manage", "Run elections"),
        ("association_manage", "Manage EESA pages and awards"),
        ("research_moderate", "Moderate the research hub"),
    ]),
    ("programmes", "SIWES, FYP, careers", 8, [
        ("siwes_manage", "Coordinate SIWES"),
        ("siwes_bank_view", "See SIWES students' bank details"),
        ("siwes_sensitive_export", "Export SIWES bank details"),
        ("fyp_manage", "Coordinate final-year projects"),
        ("elibrary_publish", "Publish to the E-Library"),
        ("careers_manage", "Manage jobs and mentorship"),
        ("admissions_manage", "Manage admissions"),
    ]),
    ("labs", "Laboratories", 6, [  # R7I (L1-L6, L9)
        ("labs_manage", "Manage laboratories, equipment, practicals and office rooms"),
        ("labs_repair", "Record repairs and maintenance; close fault reports"),
        ("labs_book", "Book practical sessions in a laboratory"),
        ("labs_report_fault", "Report equipment faults (when reporting is not open to everyone)"),
    ]),
]


class Capability(models.Model):
    """Holds EE Hub's custom permissions (no rows are ever stored)."""

    class Meta:
        managed = False
        default_permissions = ()
        permissions = [(code, label) for _g, _l, _p, items in CAPABILITY_GROUPS for code, label in items]


# ---------------------------------------------------------------------------
# Profile roles: the base permissions every profile of a kind gets
# ---------------------------------------------------------------------------
class ProfileRole(TimeStampedModel):
    AUDITED = True
    kind = models.CharField(max_length=20, choices=PROFILE_KINDS, unique=True)
    name = models.CharField(max_length=60)
    description = models.CharField(max_length=255, blank=True)
    permissions = models.ManyToManyField(Permission, blank=True, related_name="ee_profile_roles")
    dashboard_widgets = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["kind"]

    def __str__(self):
        return self.name


# ---------------------------------------------------------------------------
# Offices
# ---------------------------------------------------------------------------
class Office(TimeStampedModel):
    """An appointment-based role: HOD, Exam Officer, SIWES Coordinator, Class Rep...

    Admins create offices on the fly - from scratch or by copying a template -
    and decide its permissions, scope and dashboard."""

    AUDITED = True
    CATEGORIES = [
        ("leadership", "Department leadership"),
        ("academic", "Academic administration"),
        ("coordination", "Coordinators"),
        ("committee", "Committees"),
        ("support", "Support and services"),
        ("student", "Student officers"),
        ("association", "Association and clubs"),
        ("custom", "Custom"),
    ]
    SCOPES = [
        ("department", "Whole department"),
        ("programme", "One programme"),
        ("level", "One level"),
        ("class", "One class"),
        ("committee", "Its committee only"),
        ("self", "Own records only"),
    ]

    code = models.SlugField(max_length=60, unique=True)
    name = models.CharField(max_length=100)
    short_name = models.CharField(max_length=40, blank=True)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=CATEGORIES, default="custom")
    profile_kind = models.CharField(max_length=20, choices=OFFICE_PROFILE_KINDS, default="lecturer",
                                    help_text="Which profile the office sits inside.")
    # Round 7 (A1/F6): who may hold the office. Empty = the 'Sits inside' profile (all four for 'any').
    allowed_profile_kinds = models.JSONField(
        default=list, blank=True,
        help_text="Profile kinds that may hold this office, e.g. [\"lecturer\"]. Empty = the profile it sits inside.")
    level_must_match = models.BooleanField(
        default=False, help_text="A student holder must be an active student of the level the office serves (class reps).")
    scope_kind = models.CharField(max_length=20, choices=SCOPES, default="department")
    permissions = models.ManyToManyField(Permission, blank=True, related_name="ee_offices")
    rank = models.PositiveIntegerField(default=10, help_text="Seniority. Higher outranks lower.")
    max_holders = models.PositiveSmallIntegerField(default=0, help_text="0 = no limit (per scope).")
    dashboard_widgets = models.JSONField(default=list, blank=True,
                                         help_text="Ordered widget codes for this office's dashboard.")
    icon = models.CharField(max_length=40, default="badge-check")
    color = models.CharField(max_length=20, default="green",
                             help_text="green, gold, volt, plum, ember or slate")
    is_template = models.BooleanField(default=False, help_text="Offered as a starting point for new offices.")
    is_system = models.BooleanField(default=False, help_text="Shipped with EE Hub; cannot be deleted.")
    is_active = models.BooleanField(default=True)
    created_from = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL,
                                     related_name="copies")

    class Meta:
        ordering = ["-rank", "name"]

    def __str__(self):
        return self.name

    @property
    def label(self):
        return self.short_name or self.name

    def current_appointments(self):
        today = timezone.localdate()
        return self.appointments.filter(start_date__lte=today).filter(
            models.Q(end_date__isnull=True) | models.Q(end_date__gte=today))


class Appointment(PublicIdMixin, SoftDeleteModel):
    """A person holding an office, inside one of their profiles, for a scope and dates."""

    person = models.ForeignKey(Person, on_delete=models.CASCADE, related_name="appointments")
    office = models.ForeignKey(Office, on_delete=models.PROTECT, related_name="appointments")
    profile_kind = models.CharField(max_length=20, choices=PROFILE_KINDS,
                                    help_text="The profile this office stacks into.")
    scope_programme = models.ForeignKey("department.Programme", null=True, blank=True,
                                        on_delete=models.SET_NULL, related_name="+")
    scope_level = models.ForeignKey("department.Level", null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="+")
    scope_label = models.CharField(max_length=120, blank=True,
                                   help_text="Free text for class / committee scopes, e.g. 'B.Eng 300L 2024 entry'.")
    start_date = models.DateField(default=timezone.localdate)
    end_date = models.DateField(null=True, blank=True)
    is_acting = models.BooleanField(default=False)
    appointed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                     on_delete=models.SET_NULL, related_name="+")
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-start_date"]
        indexes = [models.Index(fields=["person", "end_date"])]

    def __str__(self):
        return f"{self.person} · {self.office}"

    @property
    def is_current(self):
        today = timezone.localdate()
        return self.start_date <= today and (self.end_date is None or self.end_date >= today) and not self.is_deleted

    @property
    def scope_text(self):
        if self.scope_label:
            return self.scope_label
        if self.scope_level_id:
            return str(self.scope_level)
        if self.scope_programme_id:
            return str(self.scope_programme)
        return "Department"


class PermissionOverride(TimeStampedModel):
    """A personal grant or revoke on top of profiles and offices."""

    AUDITED = True
    GRANT, REVOKE = "grant", "revoke"
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="permission_overrides")
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name="+")
    effect = models.CharField(max_length=6, choices=[(GRANT, "Grant"), (REVOKE, "Revoke")])
    reason = models.CharField(max_length=255)
    expires_at = models.DateTimeField(null=True, blank=True)
    granted_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        unique_together = ("user", "permission")

    @property
    def is_active(self):
        return self.expires_at is None or self.expires_at > timezone.now()


# ---------------------------------------------------------------------------
# Round 7: delegation, time-boxed grants and the access log (A3, A4, A14)
# ---------------------------------------------------------------------------
class DelegationRule(TimeStampedModel):
    """What the holder of one office may hand on, and where (A4).

    The HOD appoints inside the department, the EESA President inside EESA, a
    class rep makes tutors for their own level. `accounts.appointing.can_appoint`
    and the grants screen read these rows; nothing about delegation is written
    as an `if` in a view. Permissions can only be granted if the grantor holds
    them too (checked at grant time)."""

    AUDITED = True
    SCOPE_ANY, SCOPE_SAME_LEVEL = "any", "same_level"
    SCOPE_RULES = [(SCOPE_ANY, "Anywhere in the department"),
                   (SCOPE_SAME_LEVEL, "Only the level the grantor serves")]

    grantor_office = models.ForeignKey(Office, on_delete=models.CASCADE, related_name="delegations",
                                       help_text="Whoever currently holds this office may use the rule.")
    offices = models.ManyToManyField(Office, blank=True, related_name="+",
                                     help_text="Offices the holder may appoint to (and grant for a while).")
    office_categories = models.JSONField(default=list, blank=True,
                                         help_text="Also every office in these categories, e.g. [\"association\"].")
    except_offices = models.ManyToManyField(Office, blank=True, related_name="+",
                                            help_text="Never these offices, even if a category includes them.")
    permissions = models.ManyToManyField(Permission, blank=True, related_name="+",
                                         help_text="Permissions the holder may grant for a while (only if they hold them).")
    any_held_permission = models.BooleanField(default=False,
                                              help_text="May grant any permission they hold themselves.")
    scope_rule = models.CharField(max_length=20, choices=SCOPE_RULES, default=SCOPE_ANY)
    max_days = models.PositiveSmallIntegerField(default=0, help_text="Longest grant in days (0 = the site limit).")
    note = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-grantor_office__rank", "pk"]

    def __str__(self):
        return f"{self.grantor_office.name} delegation"

    def covers_office(self, office):
        if not self.is_active or office is None:
            return False
        if any(o.pk == office.pk for o in self.except_offices.all()):
            return False
        if office.category in (self.office_categories or []):
            return True
        return any(o.pk == office.pk for o in self.offices.all())

    def office_queryset(self):
        qs = Office.objects.filter(models.Q(pk__in=self.offices.values("pk"))
                                   | models.Q(category__in=list(self.office_categories or [])))
        return qs.exclude(pk__in=self.except_offices.values("pk")).filter(is_active=True, is_template=False)


class AccessGrant(TimeStampedModel):
    """Time-boxed extra access for a piece of work (A3): who, what, where, why, from, until.

    Either a set of permissions (added by the resolver while the grant runs) or an
    office (an acting appointment that ends with the grant). Revoked by hand, on
    expiry, or when the work it was given for closes (`grants.close_for_source`)."""

    AUDITED = True
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="access_grants")
    profile_kind = models.CharField(max_length=20, choices=PROFILE_KINDS, blank=True,
                                    help_text="Only while acting as this profile (blank = any profile).")
    permissions = models.ManyToManyField(Permission, blank=True, related_name="+")
    office = models.ForeignKey(Office, null=True, blank=True, on_delete=models.PROTECT, related_name="grants",
                               help_text="Grant an office for a while (an acting appointment).")
    appointment = models.ForeignKey(Appointment, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    scope_level = models.ForeignKey("department.Level", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    scope_label = models.CharField(max_length=120, blank=True)
    reason = models.CharField(max_length=255)
    starts_at = models.DateTimeField(default=timezone.now)
    ends_at = models.DateTimeField()
    granted_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                   related_name="+")
    granted_via = models.ForeignKey(DelegationRule, null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
                                    help_text="The delegation rule that allowed it (blank = super admin or matrix editor).")
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                   related_name="+")
    revoke_reason = models.CharField(max_length=255, blank=True)
    source_type = models.ForeignKey("contenttypes.ContentType", null=True, blank=True, on_delete=models.SET_NULL,
                                    related_name="+")
    source_id = models.CharField(max_length=64, blank=True)
    source_label = models.CharField(max_length=160, blank=True, help_text="The work this grant is for.")

    class Meta:
        ordering = ["-starts_at", "-pk"]
        indexes = [models.Index(fields=["user", "ends_at"]), models.Index(fields=["source_type", "source_id"])]

    def __str__(self):
        return f"Grant to {self.user} until {self.ends_at:%d %b %Y}"

    @property
    def status(self):
        now = timezone.now()
        if self.revoked_at:
            return "revoked"
        if self.ends_at <= now:
            return "expired"
        if self.starts_at > now:
            return "upcoming"
        return "active"

    @property
    def is_active(self):
        return self.status == "active"

    @property
    def what(self):
        if self.office_id:
            return f"Acting {self.office.name}"
        names = [p.name for p in self.permissions.all()]
        return ", ".join(n[:1].upper() + n[1:] for n in names) or "Nothing"


class AccessLogEntry(models.Model):
    """Someone looked at restricted personal data (A14). Append-only; see accounts.accesslog."""

    KINDS = [
        ("staff_contact", "Staff contact details"),
        ("student_record", "Student record"),
        ("student_contact", "Student contact details"),
        ("results", "Results"),
        ("course_form", "Course form"),
        ("welfare", "Welfare case"),
        ("account", "User account"),
        ("other", "Other personal data"),
    ]
    at = models.DateTimeField(default=timezone.now, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    user_repr = models.CharField(max_length=160, blank=True)
    impersonator = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                     related_name="+")
    profile_kind = models.CharField(max_length=20, blank=True)
    kind = models.CharField(max_length=20, choices=KINDS, db_index=True)
    model_label = models.CharField(max_length=100, blank=True)
    object_pk = models.CharField(max_length=64, blank=True)
    object_repr = models.CharField(max_length=200, blank=True)
    subject = models.ForeignKey(Person, null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
                                help_text="Whose data was viewed.")
    path = models.CharField(max_length=300, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-at", "-pk"]
        indexes = [models.Index(fields=["subject", "at"]), models.Index(fields=["user", "at"])]
        verbose_name = "access log entry"
        verbose_name_plural = "access log"

    def __str__(self):
        return f"{self.at:%Y-%m-%d %H:%M} {self.user_repr} viewed {self.get_kind_display()}"

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise PermissionError("The access log is append-only.")
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# Registration / staff number formats
# ---------------------------------------------------------------------------
class RegNumberCategory(TimeStampedModel):
    """A family of registration or staff numbers, e.g. 'B.Eng undergraduate'.

    Give one or more sample numbers and EE Hub writes the regular expression
    for you (U21EE1031 -> ^U\\d{2}EE\\d{4}$), or type your own pattern."""

    AUDITED = True
    name = models.CharField(max_length=80)
    code = models.SlugField(max_length=40, unique=True)
    profile_kind = models.CharField(max_length=20, choices=PROFILE_KINDS, default="student")
    programme = models.ForeignKey("department.Programme", null=True, blank=True, on_delete=models.SET_NULL,
                                  related_name="reg_categories")
    samples = models.TextField(blank=True, help_text="One sample number per line.")
    pattern = models.CharField(max_length=255, help_text="Regular expression the number must match.")
    auto_pattern = models.BooleanField(default=True, help_text="Rebuild the pattern from the samples on save.")
    priority = models.PositiveSmallIntegerField(default=10, help_text="Lower is checked first.")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["priority", "name"]
        verbose_name = "registration-number category"
        verbose_name_plural = "registration-number categories"

    def __str__(self):
        return self.name

    @property
    def sample_list(self):
        return [s.strip() for s in (self.samples or "").splitlines() if s.strip()]

    def save(self, *args, **kwargs):
        from .regno import pattern_from_samples
        if self.auto_pattern and self.sample_list:
            self.pattern = pattern_from_samples(self.sample_list)
        super().save(*args, **kwargs)

    def matches(self, value):
        import re
        try:
            return bool(re.fullmatch(self.pattern.strip("^$"), (value or "").strip().upper()))
        except re.error:
            return False
