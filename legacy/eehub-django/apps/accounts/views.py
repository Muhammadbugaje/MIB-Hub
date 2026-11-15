from django import forms
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth import views as auth_views
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import PasswordChangeForm, SetPasswordForm
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse, reverse_lazy
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_POST

from core import ratelimit

from .access import SESSION_KEY, available_profiles, switch_profile
from .models import Person


def _safe_next(request, fallback="dashboards:home"):
    nxt = request.POST.get("next") or request.GET.get("next") or ""
    if nxt and url_has_allowed_host_and_scheme(nxt, allowed_hosts={request.get_host()}, require_https=request.is_secure()):
        return nxt
    return reverse(fallback)


class SignInForm(forms.Form):
    identifier = forms.CharField(label="E-mail or registration / staff number", max_length=150,
                                 widget=forms.TextInput(attrs={"autocomplete": "username", "autofocus": True,
                                                               "autocapitalize": "none", "spellcheck": "false"}))
    password = forms.CharField(widget=forms.PasswordInput(attrs={"autocomplete": "current-password"}))
    remember = forms.BooleanField(required=False, initial=True, label="Keep me signed in on this device")


def login_view(request):
    """Full sign-in page; also answers the quick sign-in modal (fetch, JSON)."""
    wants_json = request.headers.get("Accept", "").startswith("application/json") or request.headers.get("X-Requested-With") == "fetch"
    import config
    from .access import is_super_admin

    maintenance_mode = config.get("site.maintenance_mode", False)
    if (request.user.is_authenticated and request.method == "GET"
            and not (maintenance_mode and not is_super_admin(request.user))):
        return redirect(_safe_next(request))
    form = SignInForm(request.POST or None)
    error = ""
    if request.method == "POST":
        ip = ratelimit.client_ip(request)
        limit, window = getattr(ratelimit, "LOGIN_FAILURES", (5, 900))
        if ratelimit.is_limited("login", ip, limit):
            error = "Too many failed attempts. Please wait 15 minutes and try again."
        elif form.is_valid():
            user = authenticate(request, username=form.cleaned_data["identifier"], password=form.cleaned_data["password"])
            if user is not None:
                login(request, user)
                if not form.cleaned_data.get("remember"):
                    request.session.set_expiry(0)
                target = _safe_next(request)
                if user.must_change_password:
                    # First sign-in (or an administrator's reset): choose a password before anything else.
                    from urllib.parse import urlencode
                    first = reverse("accounts:first_password")
                    dash = reverse("dashboards:home")
                    target = first + (("?" + urlencode({"next": target})) if target not in (dash, "/") else "")
                if wants_json:
                    return JsonResponse({"ok": True, "redirect": target})
                return redirect(target)
            ratelimit.hit("login", ip, window)
            error = "Those details did not match an active account."
        else:
            error = "Enter your e-mail (or registration number) and password."
        if wants_json:
            return JsonResponse({"ok": False, "error": error}, status=400)
    return render(request, "accounts/login.html", {
        "form": form, "error": error, "next": request.GET.get("next", ""),
        "maintenance_mode": maintenance_mode,
        "maintenance_message": config.get("site.maintenance_message", ""),
    })


@require_POST
def logout_view(request):
    logout(request)
    messages.info(request, "You have signed out.")
    return redirect("content:home")


@login_required
@require_POST
def switch_profile_view(request):
    ref = switch_profile(request, request.POST.get("key", ""))
    if ref is None:
        messages.error(request, "That profile is not available to you.")
    else:
        messages.success(request, f"You are now acting as {ref.label}.")
        if request.POST.get("make_default"):
            request.user.default_profile = ref.key
            request.user.save(update_fields=["default_profile"])
    target = reverse("dashboards:home")
    nxt = request.POST.get("next") or ""
    if (ref is not None and nxt.startswith("/") and not nxt.startswith("//")
            and url_has_allowed_host_and_scheme(nxt, allowed_hosts={request.get_host()}, require_https=request.is_secure())):
        # Stay on the same page when the new profile may see it; otherwise the dashboard.
        from core import nav

        from .access import invalidate
        invalidate(request.user)
        request.active_profile = ref
        request.user._ee_active_kind = ref.kind
        if nav.can_view_path(request, nxt):
            target = nxt
    if request.headers.get("HX-Request"):
        from django.http import HttpResponse
        resp = HttpResponse(status=204)
        resp["HX-Redirect"] = target
        return resp
    return redirect(target)


class ProfileForm(forms.ModelForm):
    class Meta:
        model = Person
        fields = ["title", "first_name", "middle_name", "last_name", "gender", "date_of_birth", "phone",
                  "personal_email", "address", "state_of_origin", "nationality", "photo", "bio"]
        widgets = {"date_of_birth": forms.DateInput(attrs={"type": "date"}),
                   "bio": forms.Textarea(attrs={"rows": 4}),
                   "title": forms.Select(choices=[(t, t or "-") for t in Person.TITLES])}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        hints = {"first_name": "given-name", "middle_name": "additional-name", "last_name": "family-name",
                 "phone": "tel", "personal_email": "email", "address": "street-address", "date_of_birth": "bday"}
        for name, field in self.fields.items():
            if name == "photo":
                continue
            field.widget.attrs.setdefault("class", "input")
            if name in hints:
                field.widget.attrs.setdefault("autocomplete", hints[name])


PROFILE_FIELD_LABELS = {"phone": "Phone number", "date_of_birth": "Date of birth", "gender": "Gender",
                        "photo": "Profile photo", "address": "Address", "state_of_origin": "State of origin",
                        "bio": "A short bio"}
THEMES = [("system", "Follow my device"), ("light", "Light"), ("dark", "Dark")]


@login_required
def profile_view(request):
    import config
    user = request.user
    person = user.person_or_none
    if person is None:
        person = Person(user=user, first_name=user.email.split("@")[0].title(), last_name="")
    prefs = dict(user.preferences or {})
    section = request.POST.get("section", "details") if request.method == "POST" else ""

    if section == "prefs":
        theme = request.POST.get("theme", "system")
        prefs["theme"] = theme if theme in dict(THEMES) else "system"
        prefs["reduce_motion"] = request.POST.get("reduce_motion") == "on"
        prefs["email_digest"] = request.POST.get("email_digest") == "on"
        user.preferences = prefs
        user.save(update_fields=["preferences"])
        messages.success(request, "Your preferences have been saved.")
        return redirect(reverse("accounts:profile") + "#preferences")
    if section.startswith("sig_"):
        return _signature_post(request, person, section)
    if section == "remove_photo" and person.pk and person.photo:
        person.photo.delete(save=False)
        person.photo = ""
        person.save()
        messages.success(request, "Your photo has been removed.")
        return redirect("accounts:profile")

    form = ProfileForm(request.POST or None, request.FILES or None, instance=person)
    if section == "details" and form.is_valid():
        p = form.save(commit=False)
        p.user = user
        p.save()
        messages.success(request, "Your profile has been saved.")
        return redirect("accounts:profile")

    percent = person.completeness()
    threshold = int(config.get("profile.completion_threshold", 70) or 70)
    missing = [{"key": f, "label": PROFILE_FIELD_LABELS.get(f, f)} for f in Person.PROFILE_FIELDS if not getattr(person, f)]
    appointments = []
    if person.pk:
        from django.utils import timezone
        today = timezone.localdate()
        for a in person.appointments.filter(is_deleted=False).select_related("office").order_by("-start_date"):
            a.current = a.start_date <= today and (a.end_date is None or a.end_date >= today)
            appointments.append(a)
    active = getattr(request, "active_profile", None)
    return render(request, "accounts/profile.html", {
        "form": form, "person": person, "profiles": available_profiles(user),
        "active_key": active.key if active else "",
        "appointments": appointments,
        "completeness": percent, "threshold": threshold, "missing": missing,
        "is_complete": not missing, "below_threshold": percent < threshold,
        "prefs": {"theme": prefs.get("theme", "system"), "reduce_motion": bool(prefs.get("reduce_motion")),
                  "email_digest": prefs.get("email_digest", True)},
        "themes": THEMES,
        "sig": _signature_ctx(person),
    })


# ---------------------------------------------------------------------------
# My signature (Round 6): one signature per person, used on every printed
# document they approve — course forms, exam cards, result sheets, letters.
# Stored as results.OfficerSignature rows (restricted storage, no public URL).
# ---------------------------------------------------------------------------
def _signature_ctx(person):
    from results import signature as SIG
    if person is None or not person.pk:
        return {"enabled": False}
    active, pending = SIG.active_for(person), SIG.pending_for(person)
    return {"enabled": True, "active": active, "pending": pending, "inks": list(SIG.INKS),
            "drawn": bool(active and active.source_name == SIG.DRAWN),
            "demo": bool(active and (active.source_name or "").startswith("demo"))}


def _signature_post(request, person, section):
    from results import signature as SIG
    from core import audit
    target = reverse("accounts:profile") + "#signature"
    if person is None or not person.pk:
        messages.error(request, "Save your profile details first, then add your signature.")
        return redirect(target)
    try:
        sens = max(0, min(100, int(request.POST.get("sensitivity") or 50)))
    except ValueError:
        sens = 50
    ink = request.POST.get("ink") if request.POST.get("ink") in SIG.INKS else "navy"
    pending = SIG.pending_for(person)
    try:
        if section == "sig_upload":
            SIG.start_from_photo(person, request.FILES.get("sig_photo"), request.user, sens, ink)
            messages.info(request, "Check the cleaned-up signature below. Adjust it if needed, then use it.")
        elif section == "sig_adjust" and pending:
            SIG.adjust_pending(pending, sens, ink)
        elif section == "sig_accept" and pending:
            SIG.accept_pending(pending, request.user)
            messages.success(request, "Signature saved. It now appears on documents you sign or approve.")
        elif section == "sig_discard" and pending:
            SIG.discard_pending(pending)
            messages.info(request, "Discarded.")
        elif section == "sig_draw":
            sig = SIG.save_drawn(person, request.POST.get("sig_data") or "", request.user, ink)
            audit.log("accounts.signature_drawn", sig, actor=request.user)
            messages.success(request, "Signature saved. It now appears on documents you sign or approve.")
        elif section == "sig_remove":
            if SIG.retire(person, request.user):
                audit.log("accounts.signature_removed", person, actor=request.user)
                messages.info(request, "Your signature is no longer used. Documents you already signed keep it.")
        else:
            messages.error(request, "That signature action is not available.")
    except SIG.SignatureError as e:
        messages.error(request, str(e))
    return redirect(target)


@login_required
def first_password_view(request):
    """First sign-in: the user replaces the temporary password before going
    anywhere else (accounts/first_login.py, ForcePasswordChangeMiddleware)."""
    from core import audit

    from .first_login import FirstPasswordForm, identifiers

    user = request.user
    nxt = _safe_next(request)
    if nxt.startswith(reverse("accounts:first_password")):
        nxt = reverse("dashboards:home")
    if not user.must_change_password:
        return redirect(nxt)
    form = FirstPasswordForm(user, request.POST or None)
    if request.method == "POST" and form.is_valid():
        user = form.save()
        update_session_auth_hash(request, user)
        audit.log("state_change", user, actor=user, changes={"must_change_password": [True, False]},
                  note="password chosen at first sign-in")
        messages.success(request, "Your password is set. Welcome to EE Hub.")
        return redirect(nxt)
    person = user.person_or_none
    return render(request, "accounts/first_password.html", {
        "form": form, "next": request.POST.get("next") or request.GET.get("next", ""),
        "min_length": form.min_length, "first_name": person.first_name if person else "",
        "avoid": identifiers(user),
    })


@login_required
def password_change_view(request):
    form = PasswordChangeForm(request.user, request.POST or None)
    if request.method == "POST" and form.is_valid():
        user = form.save()
        update_session_auth_hash(request, user)
        messages.success(request, "Your password has been changed.")
        return redirect("accounts:profile")
    return render(request, "accounts/password_change.html", {"form": form})


class PasswordResetView(auth_views.PasswordResetView):
    template_name = "accounts/password_reset_form.html"
    email_template_name = "emails/password_reset.txt"
    html_email_template_name = "emails/password_reset.html"
    subject_template_name = "emails/password_reset_subject.txt"
    success_url = reverse_lazy("accounts:password_reset_done")

    def post(self, request, *args, **kwargs):
        # Round 7 (R7K, G3): at most PASSWORD_RESETS e-mails per IP and per address. Over the limit the
        # visitor sees the usual "sent" page (no hint whether the address exists), and nothing is sent.
        limit, window = ratelimit.PASSWORD_RESETS
        ip = ratelimit.client_ip(request)
        email = (request.POST.get("email") or "").strip().lower()[:200]
        if ratelimit.hit("reset", ip, window) > limit or (email and ratelimit.hit("reset_email", email, window) > limit):
            return redirect(self.success_url)
        return super().post(request, *args, **kwargs)


class PasswordResetConfirmView(auth_views.PasswordResetConfirmView):
    template_name = "accounts/password_reset_confirm.html"
    success_url = reverse_lazy("accounts:password_reset_complete")
