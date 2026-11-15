from django.shortcuts import redirect
from django.urls import reverse
from django.utils import timezone

from .access import resolve_active


class ActiveProfileMiddleware:
    """Sets request.active_profile (a ProfileRef) and tells the permission
    resolver which profile the user is acting as for this request."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.active_profile = None
        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated:
            ref = resolve_active(request)
            request.active_profile = ref
            user._ee_active_kind = ref.kind if ref else None
            last = user.last_seen
            now = timezone.now()
            if last is None or (now - last).total_seconds() > 300:
                from .models import User
                User.objects.filter(pk=user.pk).update(last_seen=now)
                user.last_seen = now
        return self.get_response(request)

    def process_view(self, request, view_func, view_args, view_kwargs):
        """Round 7 (G4): pages of a switched-off module show a friendly page instead of working."""
        match = getattr(request, "resolver_match", None)
        if match is None or not match.namespace:
            return None
        from core import features
        area = features.area_for_namespace(match.namespace)
        if area is None or features.enabled(area):
            return None
        return feature_off_response(request, area)


def feature_off_response(request, area):
    from django.http import HttpResponse, JsonResponse
    from django.shortcuts import render

    from core import features
    f = features.FEATURES.get(area)
    label = f.label if f else area
    if request.headers.get("HX-Request") == "true":
        resp = HttpResponse(status=204)
        resp["HX-Trigger"] = '{"eeToast": {"type": "info", "title": "%s is switched off"}}' % label.replace('"', "")
        return resp
    accept = (request.headers.get("Accept") or "").lower()
    if "application/json" in accept and "text/html" not in accept:
        return JsonResponse({"ok": False, "error": f"{label} is switched off.", "feature": area}, status=404)
    can_switch = request.user.is_authenticated and (request.user.has_perm("accounts.settings_edit")
                                                    or request.user.has_perm("config.change_configentry"))
    resp = render(request, "access/feature_off.html", {"feature": f, "label": label, "can_switch": can_switch},
                  status=200)
    resp["X-EE-Feature-Off"] = area
    return resp


class ForcePasswordChangeMiddleware:
    """A user flagged `must_change_password` reaches nothing but the
    first-password page until they have chosen their own password.

    Still allowed: sign out, the password-reset pages, static/media files,
    the favicon / web manifest, the health check and "stop impersonating".
    Page requests are redirected (HTMX: HX-Redirect; fetch/JSON: 403 with the
    URL to go to). Impersonation sessions are never blocked: the superuser is
    not the one who must change the password.
    """

    ALLOWED_PREFIXES = ("/static/", "/media/", "/favicon.ico", "/robots.txt", "/sw.js")
    ALLOWED_URL_NAMES = (
        "accounts:first_password", "accounts:logout", "accounts:login",
        "accounts:password_reset", "accounts:password_reset_done", "accounts:password_reset_complete",
        "core:health", "core:impersonate_stop", "config:favicon", "content:manifest",
    )

    def __init__(self, get_response):
        self.get_response = get_response
        self._allowed = None

    def allowed_paths(self):
        if self._allowed is None:
            from django.urls import NoReverseMatch

            paths = []
            for name in self.ALLOWED_URL_NAMES:
                try:
                    paths.append(reverse(name))
                except NoReverseMatch:
                    continue
            self._allowed = tuple(paths)
        return self._allowed

    def is_allowed(self, path):
        if path.startswith(self.ALLOWED_PREFIXES):
            return True
        if path.startswith("/accounts/password/reset/"):  # reset links carry a token
            return True
        return path in self.allowed_paths()

    def __call__(self, request):
        user = getattr(request, "user", None)
        if (user is not None and user.is_authenticated and getattr(user, "must_change_password", False)
                and not getattr(request, "is_impersonating", False)
                and not self.is_allowed(request.path)):
            return self.send_to_first_password(request)
        return self.get_response(request)

    @staticmethod
    def send_to_first_password(request):
        from urllib.parse import urlencode

        from django.http import HttpResponse, JsonResponse

        target = reverse("accounts:first_password")
        nxt = request.get_full_path() if request.method == "GET" else ""
        if nxt and nxt != "/" and not nxt.startswith(target):
            target += "?" + urlencode({"next": nxt})
        if request.headers.get("HX-Request") == "true":
            response = HttpResponse(status=204)
            response["HX-Redirect"] = target
            return response
        accept = (request.headers.get("Accept") or "").lower()
        if "application/json" in accept or request.headers.get("X-Requested-With") in ("fetch", "XMLHttpRequest"):
            return JsonResponse({"ok": False, "error": "Choose a new password first.", "redirect": target},
                                status=403)
        return redirect(target)
