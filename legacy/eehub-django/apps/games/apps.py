from django.apps import AppConfig


class GamesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "games"
    verbose_name = "Learning arcade"

    def ready(self):
        from . import nav  # noqa: F401
        try:
            from content.context_processors import register_top_link
            register_top_link("Learning arcade", "games:guest", icon="gamepad-2", prefix="/arcade/", order=90,
                              menu="students", feature="games")
        except Exception:  # content app missing in a stripped install
            pass
