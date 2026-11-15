"""Sign in with e-mail or registration/staff number; permissions from accounts.access."""
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q

from .access import effective_permissions


class EEHubBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        from .models import User
        ident = (username or kwargs.get("email") or "").strip()
        if not ident or not password:
            return None
        q = Q(email__iexact=ident)
        try:
            import config
            if config.get("security.allow_signin_with_reg_number", True):
                q |= Q(login_id=ident.upper())
        except Exception:
            q |= Q(login_id=ident.upper())
        user = User.objects.filter(q).first()
        if user is None:
            User().set_password(password)  # equalise timing
            return None
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None

    def get_all_permissions(self, user_obj, obj=None):
        if not user_obj.is_active or user_obj.is_anonymous or obj is not None:
            return set()
        return effective_permissions(user_obj)

    def has_perm(self, user_obj, perm, obj=None):
        return user_obj.is_active and perm in self.get_all_permissions(user_obj, obj)
