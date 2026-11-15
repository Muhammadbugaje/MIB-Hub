from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"
    verbose_name = "Identity and access"

    def ready(self):
        from . import signals  # noqa: F401
        from . import importspecs  # noqa: F401  (registers the users import/export spec)
        from . import appointment_importspecs  # noqa: F401  (round 7: appointments import through appointing)
        from . import nav  # noqa: F401  (round 7: access sidebar entries)
        from . import widgets  # noqa: F401  (round 7: class lists widget)
