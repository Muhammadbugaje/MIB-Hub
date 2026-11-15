from django.contrib import admin

from .models import ArcadeProfile, ArcadeScore, GuestPlayer


@admin.register(ArcadeProfile)
class ArcadeProfileAdmin(admin.ModelAdmin):
    list_display = ("__str__", "xp", "coins", "on_leaderboard", "updated")
    search_fields = ("user__email", "guest__name")


@admin.register(ArcadeScore)
class ArcadeScoreAdmin(admin.ModelAdmin):
    list_display = ("profile", "game", "score", "created")
    list_filter = ("game",)


@admin.register(GuestPlayer)
class GuestPlayerAdmin(admin.ModelAdmin):
    list_display = ("name", "reg_number", "created", "expires_at")
    search_fields = ("name", "reg_number")
    exclude = ("pin_hash",)


from .models import GameSettings  # noqa: E402


@admin.register(GameSettings)
class GameSettingsAdmin(admin.ModelAdmin):
    """Read-only here: edit at /arcade/settings/, which validates codes and writes the audit trail."""
    list_display = ("__str__", "updated")
    exclude = ("data",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
