"""Accounts admin (round 2 theme: django-unfold via core.admin_site)."""
from django.contrib import admin, messages
from django.contrib.auth.admin import GroupAdmin as BaseGroupAdmin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import Group, Permission
from unfold.decorators import display
from unfold.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm

from core.admin_site import (
    BooleanRadioFilter,
    ChoicesDropdownFilter,
    ModelAdmin,
    RangeDateFilter,
    RangeDateTimeFilter,
    RelatedDropdownFilter,
    TabularInline,
)

from django import forms

from .models import (AccessGrant, AccessLogEntry, Appointment, DelegationRule, Office, PermissionOverride, Person,
                     ProfileRole, RegNumberCategory, User)


# ---------------------------------------------------------------------------
# Users: sign in with e-mail (or the optional registration / staff number)
# ---------------------------------------------------------------------------
class EEUserCreationForm(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("email", "login_id")

    def save(self, commit=True):
        # Accounts made here get the same first-sign-in rule as EE Hub's own
        # Add user page (setting "Force password change on first sign-in").
        from accounts.first_login import required_for_new_accounts
        user = super().save(commit=False)
        user.must_change_password = required_for_new_accounts()
        if commit:
            user.save()
        return user


class EEUserChangeForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User
        fields = "__all__"


class OverrideInline(TabularInline):
    model = PermissionOverride
    fk_name = "user"
    extra = 0
    autocomplete_fields = ("permission",)
    fields = ("permission", "effect", "reason", "expires_at", "granted_by")
    readonly_fields = ("granted_by",)


@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    form = EEUserChangeForm
    add_form = EEUserCreationForm
    change_password_form = AdminPasswordChangeForm
    ordering = ("email",)
    list_display = ("person_column", "login_id", "active_badge", "staff_badge", "must_change_password",
                    "last_login")
    list_filter = (("is_active", BooleanRadioFilter), ("is_staff", BooleanRadioFilter),
                   ("is_superuser", BooleanRadioFilter), ("must_change_password", BooleanRadioFilter),
                   ("last_login", RangeDateTimeFilter), ("date_joined", RangeDateTimeFilter))
    search_fields = ("email", "login_id", "person__first_name", "person__last_name")
    list_select_related = ("person",)
    filter_horizontal = ("groups", "user_permissions")
    readonly_fields = ("last_login", "date_joined", "last_seen")
    fieldsets = (
        (None, {"fields": ("email", "login_id", "password")}),
        ("Access", {"fields": ("is_active", "is_staff", "is_superuser", "must_change_password", "default_profile")}),
        ("Groups and permissions", {"classes": ("collapse",), "fields": ("groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "date_joined", "last_seen")}),
    )
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("email", "login_id", "password1", "password2")}),)
    inlines = [OverrideInline]
    actions = ["activate_users", "deactivate_users"]

    def get_inlines(self, request, obj=None):
        return [OverrideInline] if obj else []

    @display(description="User", header=True, ordering="email")
    def person_column(self, obj):
        person = getattr(obj, "person", None) if hasattr(obj, "person") else None
        name = person.full_name if person else ""
        initials = ((person.first_name[:1] + person.last_name[:1]) if person else obj.email[:2]).upper()
        return [name or obj.email, obj.email if name else "", initials]

    @display(description="Active", ordering="is_active", label={"Active": "success", "Off": "danger"})
    def active_badge(self, obj):
        return "Active" if obj.is_active else "Off"

    @display(description="Admin access", ordering="is_superuser",
             label={"Superuser": "danger", "Staff": "info", "-": "info"})
    def staff_badge(self, obj):
        return "Superuser" if obj.is_superuser else ("Staff" if obj.is_staff else None)

    def save_formset(self, request, form, formset, change):
        instances = formset.save(commit=False)
        for deleted in formset.deleted_objects:
            deleted.delete()
        for inst in instances:
            if isinstance(inst, PermissionOverride) and not inst.granted_by_id:
                inst.granted_by = request.user
            inst.save()
        formset.save_m2m()

    @admin.action(description="Activate selected users", permissions=["change"])
    def activate_users(self, request, queryset):
        n = 0
        for user in queryset.filter(is_active=False):
            user.is_active = True
            user.save(update_fields=["is_active"])
            n += 1
        self.message_user(request, f"Activated {n} user(s).", messages.SUCCESS)

    @admin.action(description="Deactivate selected users", permissions=["change"])
    def deactivate_users(self, request, queryset):
        n = 0
        for user in queryset.filter(is_active=True).exclude(pk=request.user.pk):
            user.is_active = False
            user.save(update_fields=["is_active"])
            n += 1
        msg = f"Deactivated {n} user(s)."
        if queryset.filter(pk=request.user.pk, is_active=True).exists():
            msg += " Your own account was left active."
        self.message_user(request, msg, messages.SUCCESS if n else messages.WARNING)


# ---------------------------------------------------------------------------
# Persons
# ---------------------------------------------------------------------------
@admin.register(Person)
class PersonAdmin(ModelAdmin):
    list_display = ("person_column", "user", "phone", "gender", "updated_at")
    list_filter = (("gender", ChoicesDropdownFilter), ("updated_at", RangeDateFilter))
    search_fields = ("first_name", "middle_name", "last_name", "user__email", "phone", "personal_email")
    list_select_related = ("user",)
    autocomplete_fields = ("user",)
    fieldsets = (
        (None, {"fields": ("user", ("title", "first_name"), ("middle_name", "last_name"), "photo")}),
        ("Personal", {"fields": (("gender", "date_of_birth"), ("phone", "personal_email"), "address",
                                 ("state_of_origin", "nationality"), "bio")}),
        ("Record", {"classes": ("collapse",), "fields": ("public_id", "created_at", "updated_at")}),
    )

    @display(description="Person", header=True, ordering="last_name")
    def person_column(self, obj):
        return [obj.full_name, obj.title, (obj.first_name[:1] + obj.last_name[:1]).upper()]


# ---------------------------------------------------------------------------
# Offices and access
# ---------------------------------------------------------------------------
@admin.register(ProfileRole)
class ProfileRoleAdmin(ModelAdmin):
    list_display = ("name", "kind", "description", "permission_count")
    search_fields = ("name", "description")
    filter_horizontal = ("permissions",)

    @display(description="Permissions")
    def permission_count(self, obj):
        return obj.permissions.count()


@admin.register(Office)
class OfficeAdmin(ModelAdmin):
    list_display = ("name", "short_name", "category", "profile_kind", "scope_kind", "rank", "holders",
                    "active_badge", "is_system")
    list_filter = (("category", ChoicesDropdownFilter), ("profile_kind", ChoicesDropdownFilter),
                   ("scope_kind", ChoicesDropdownFilter), ("is_active", BooleanRadioFilter),
                   ("is_template", BooleanRadioFilter), ("is_system", BooleanRadioFilter))
    search_fields = ("name", "short_name", "code", "description")
    prepopulated_fields = {"code": ("name",)}
    filter_horizontal = ("permissions",)
    fieldsets = (
        (None, {"fields": (("name", "short_name"), "code", "description")}),
        ("Where it sits", {"fields": (("category", "profile_kind", "scope_kind"), ("rank", "max_holders"))}),
        ("Who may hold it", {"fields": ("allowed_profile_kinds", "level_must_match")}),
        ("Look", {"fields": (("icon", "color"), "dashboard_widgets")}),
        ("Permissions", {"fields": ("permissions",)}),
        ("Status", {"fields": (("is_active", "is_template", "is_system"), "created_from",
                               ("created_at", "updated_at"))}),
    )

    @display(description="Holders")
    def holders(self, obj):
        return obj.current_appointments().count()

    @display(description="Active", ordering="is_active", label={"Active": "success", "Off": "danger"})
    def active_badge(self, obj):
        return "Active" if obj.is_active else "Off"

    def has_delete_permission(self, request, obj=None):
        return not (obj and obj.is_system) and super().has_delete_permission(request, obj)


class AppointmentAdminForm(forms.ModelForm):
    """Round 7 (A1): the admin refuses appointments the office's eligibility rules do not allow."""

    class Meta:
        model = Appointment
        fields = "__all__"

    def clean(self):
        from . import appointing
        cd = super().clean()
        person, office, kind = cd.get("person"), cd.get("office"), cd.get("profile_kind")
        from django.utils import timezone
        current = cd.get("end_date") is None or cd["end_date"] >= timezone.localdate()
        if person and office and kind and current:
            try:
                appointing.check_eligible(person, office, kind, scope_level=cd.get("scope_level"))
            except appointing.EligibilityError as exc:
                raise forms.ValidationError(str(exc))
        return cd


@admin.register(Appointment)
class AppointmentAdmin(ModelAdmin):
    form = AppointmentAdminForm
    list_display = ("person", "office", "profile_kind", "scope_column", "start_date", "end_date", "is_acting",
                    "current_badge")
    list_filter = (("office", RelatedDropdownFilter), ("profile_kind", ChoicesDropdownFilter),
                   ("is_acting", BooleanRadioFilter), ("start_date", RangeDateFilter))
    search_fields = ("person__first_name", "person__last_name", "office__name", "scope_label")
    list_select_related = ("person", "office", "scope_programme", "scope_level")
    autocomplete_fields = ("person", "office", "appointed_by")
    date_hierarchy = "start_date"

    @display(description="Scope")
    def scope_column(self, obj):
        return obj.scope_text

    @display(description="Now", label={"Current": "success", "Ended": "info"})
    def current_badge(self, obj):
        return "Current" if obj.is_current else "Ended"

    def save_model(self, request, obj, form, change):
        from . import appointing
        if change:
            super().save_model(request, obj, form, change)
            appointing._invalidate(obj.person.user, request.user)
            return
        try:
            appt = appointing.appoint(actor=request.user, person=obj.person, office=obj.office,
                                      profile_kind=obj.profile_kind, scope_level=obj.scope_level,
                                      scope_programme=obj.scope_programme, scope_label=obj.scope_label,
                                      start_date=obj.start_date, end_date=obj.end_date, is_acting=obj.is_acting,
                                      note=obj.note)
        except (appointing.EligibilityError, appointing.DelegationError) as exc:
            from django.core.exceptions import PermissionDenied
            raise PermissionDenied(str(exc))
        obj.pk = appt.pk
        obj.public_id = appt.public_id
        obj._state.adding = False


@admin.register(DelegationRule)
class DelegationRuleAdmin(ModelAdmin):
    list_display = ("grantor_office", "scope_rule", "any_held_permission", "max_days", "is_active")
    list_filter = (("scope_rule", ChoicesDropdownFilter), ("is_active", BooleanRadioFilter))
    filter_horizontal = ("offices", "except_offices", "permissions")
    search_fields = ("grantor_office__name", "note")


@admin.register(AccessGrant)
class AccessGrantAdmin(ModelAdmin):
    list_display = ("user", "what_column", "starts_at", "ends_at", "status_badge", "granted_by")
    list_filter = (("ends_at", RangeDateTimeFilter), ("office", RelatedDropdownFilter))
    search_fields = ("user__email", "reason", "source_label")
    list_select_related = ("user", "office", "granted_by")
    autocomplete_fields = ("user",)
    readonly_fields = ("granted_by", "revoked_by", "revoked_at", "appointment", "granted_via")
    filter_horizontal = ("permissions",)

    @display(description="What")
    def what_column(self, obj):
        return obj.what[:80]

    @display(description="Status", label={"active": "success", "upcoming": "info", "expired": "info", "revoked": "danger"})
    def status_badge(self, obj):
        return obj.status

    def has_add_permission(self, request):
        return False      # give grants on People and access -> Grants (delegation and limits apply)


@admin.register(AccessLogEntry)
class AccessLogEntryAdmin(ModelAdmin):
    list_display = ("at", "user_repr", "kind", "subject", "object_repr", "path")
    list_filter = (("kind", ChoicesDropdownFilter), ("at", RangeDateTimeFilter))
    search_fields = ("user_repr", "object_repr", "subject__first_name", "subject__last_name")
    list_select_related = ("subject",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PermissionOverride)
class PermissionOverrideAdmin(ModelAdmin):
    list_display = ("user", "permission", "effect_badge", "reason", "expires_at", "granted_by")
    list_filter = (("effect", ChoicesDropdownFilter), ("expires_at", RangeDateTimeFilter))
    search_fields = ("user__email", "permission__codename", "permission__name", "reason")
    list_select_related = ("user", "permission", "granted_by")
    autocomplete_fields = ("user", "permission")
    readonly_fields = ("granted_by",)

    @display(description="Effect", ordering="effect", label={"Grant": "success", "Revoke": "danger"})
    def effect_badge(self, obj):
        return obj.get_effect_display()

    def save_model(self, request, obj, form, change):
        if not obj.granted_by_id:
            obj.granted_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(RegNumberCategory)
class RegNumberCategoryAdmin(ModelAdmin):
    list_display = ("name", "code", "profile_kind", "programme", "pattern", "priority", "is_active")
    list_filter = (("profile_kind", ChoicesDropdownFilter), ("programme", RelatedDropdownFilter),
                   ("is_active", BooleanRadioFilter))
    search_fields = ("name", "code", "pattern", "samples")
    prepopulated_fields = {"code": ("name",)}


# ---------------------------------------------------------------------------
# Django's own auth models, re-registered with the theme
# ---------------------------------------------------------------------------
try:
    admin.site.unregister(Group)
except admin.sites.NotRegistered:
    pass


@admin.register(Group)
class GroupAdmin(BaseGroupAdmin, ModelAdmin):
    list_display = ("name", "member_count", "permission_count")

    @display(description="Members")
    def member_count(self, obj):
        return obj.user_set.count()

    @display(description="Permissions")
    def permission_count(self, obj):
        return obj.permissions.count()


@admin.register(Permission)
class PermissionAdmin(ModelAdmin):
    list_display = ("name", "codename", "content_type")
    list_filter = (("content_type", RelatedDropdownFilter),)
    search_fields = ("name", "codename", "content_type__app_label", "content_type__model")
    list_select_related = ("content_type",)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
