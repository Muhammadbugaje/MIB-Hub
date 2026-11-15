"""Forced password change at first sign-in (NBTE Phase 8 standard).

* ``required_for_new_accounts()`` — the value every *new* account gets for
  ``must_change_password`` (setting ``security.first_login_reset``, on by
  default). Accounts created by an administrator (Access → Add user) and by
  the users import use it. A password reset by an administrator always
  forces a change, whatever the setting.
* ``FirstPasswordForm`` — the new-password form: minimum length from
  ``security.password_min_length``, must differ from the temporary password,
  must not contain the user's e-mail or registration / staff number, plus
  Django's password validators.
* ``ForcePasswordChangeMiddleware`` (accounts/middleware.py) keeps a flagged
  user on the first-password page until the form is saved.
"""
import re

from django import forms
from django.contrib.auth import password_validation

DEFAULT_MIN_LENGTH = 10


def _as_bool(value, default=True):
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip().lower() in ("1", "true", "yes", "on")
    return bool(value)


def required_for_new_accounts():
    """True when newly created accounts must choose their own password."""
    try:
        import config

        return _as_bool(config.get("security.first_login_reset", True))
    except Exception:  # settings table not ready (migrations, early start-up)
        return True


def min_length():
    try:
        import config

        value = int(config.get("security.password_min_length", DEFAULT_MIN_LENGTH))
    except Exception:
        value = DEFAULT_MIN_LENGTH
    return max(6, min(value, 128))


def identifiers(user):
    """Strings a new password must not contain: the e-mail (and its name
    part), the sign-in number and every registration / staff number."""
    found = set()
    email = (user.email or "").strip().lower()
    if email:
        found.add(email)
        local = email.split("@", 1)[0]
        if len(local) >= 4:
            found.add(local)
    if getattr(user, "login_id", None):
        found.add(user.login_id.lower())
    person = getattr(user, "person_or_none", None)
    if person is not None:
        try:
            for value in person.student_profiles.values_list("reg_number", flat=True):
                if value:
                    found.add(str(value).lower())
        except Exception:
            pass
        for rel in ("lecturer_profile", "staff_profile"):
            try:
                value = getattr(getattr(person, rel), "staff_number", "")
            except Exception:
                value = ""
            if value:
                found.add(str(value).lower())
    return sorted(v for v in found if len(v) >= 4)


def _squash(value):
    return re.sub(r"[^a-z0-9]", "", value.lower())


class FirstPasswordForm(forms.Form):
    new_password1 = forms.CharField(
        label="New password", strip=False,
        widget=forms.PasswordInput(attrs={"autocomplete": "new-password", "autofocus": True,
                                          "data-pw-new": "", "spellcheck": "false"}))
    new_password2 = forms.CharField(
        label="Type it again", strip=False,
        widget=forms.PasswordInput(attrs={"autocomplete": "new-password", "data-pw-confirm": "",
                                          "spellcheck": "false"}))

    def __init__(self, user, *args, **kwargs):
        self.user = user
        self.min_length = min_length()
        super().__init__(*args, **kwargs)
        self.fields["new_password1"].widget.attrs["minlength"] = self.min_length

    def clean_new_password1(self):
        pw = self.cleaned_data.get("new_password1") or ""
        problems = []
        if len(pw) < self.min_length:
            problems.append(f"Use at least {self.min_length} characters.")
        if pw and self.user.check_password(pw):
            problems.append("Choose a password that is different from your temporary one.")
        low, squashed = pw.lower(), _squash(pw)
        for ident in identifiers(self.user):
            if ident in low or (len(_squash(ident)) >= 4 and _squash(ident) in squashed):
                problems.append("Don't use your e-mail address or registration / staff number in your password.")
                break
        if not problems:
            try:
                password_validation.validate_password(pw, self.user)
            except forms.ValidationError as exc:
                problems.extend(exc.messages)
        if problems:
            raise forms.ValidationError(problems)
        return pw

    def clean(self):
        data = super().clean()
        a, b = data.get("new_password1"), data.get("new_password2")
        if a and b and a != b:
            self.add_error("new_password2", "The two passwords don't match.")
        return data

    def save(self):
        self.user.set_password(self.cleaned_data["new_password1"])
        self.user.must_change_password = False
        self.user.save(update_fields=["password", "must_change_password"])
        return self.user
