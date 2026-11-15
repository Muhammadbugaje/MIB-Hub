from .access import available_profiles


def access(request):
    user = getattr(request, "user", None)
    if user is None or not user.is_authenticated:
        return {}
    active = getattr(request, "active_profile", None)
    return {
        "active_profile": active,
        "profiles": available_profiles(user),
        "active_offices": active.offices if active else [],
    }
