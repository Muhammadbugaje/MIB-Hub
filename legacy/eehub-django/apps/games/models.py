from django.conf import settings
from django.db import models

from core.storage import restricted_storage, uuid_upload_to


class GuestPlayer(models.Model):
    """A player from outside the department. Stores only a display name, the reg. number they type (used with the PIN
    to find them again) and a hashed PIN. Removed after `expires_at` by `manage.py purge_arcade_guests`."""
    name = models.CharField(max_length=40)
    reg_number = models.CharField(max_length=30)
    name_key = models.CharField(max_length=40, editable=False)
    reg_key = models.CharField(max_length=30, editable=False)
    pin_hash = models.CharField(max_length=128)
    created = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=["name_key", "reg_key"], name="uniq_arcade_guest")]

    def save(self, *a, **k):
        self.name_key = " ".join(self.name.lower().split())
        self.reg_key = "".join(self.reg_number.upper().split())
        super().save(*a, **k)

    def __str__(self):
        return f"Guest {self.name}"


class ArcadeProfile(models.Model):
    """One row per player (a signed-in user or a guest). Coins and XP are only changed by games.progress."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="arcade")
    guest = models.OneToOneField(GuestPlayer, null=True, blank=True, on_delete=models.CASCADE, related_name="profile")
    xp = models.PositiveIntegerField(default=0)
    coins = models.PositiveIntegerField(default=0)
    owned = models.JSONField(default=list, blank=True)
    equipped = models.JSONField(default=dict, blank=True)
    badges = models.JSONField(default=list, blank=True)
    stats = models.JSONField(default=dict, blank=True)
    on_leaderboard = models.BooleanField(default=True, help_text="Show first name and initial on arcade leaderboards.")
    updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Arcade profile of {self.user or self.guest}"


class ArcadeScore(models.Model):
    profile = models.ForeignKey(ArcadeProfile, on_delete=models.CASCADE, related_name="scores", null=True)
    game = models.SlugField(max_length=40, db_index=True)
    score = models.PositiveIntegerField()
    created = models.DateTimeField(auto_now_add=True, db_index=True)
    cheated = models.BooleanField(default=False, db_index=True,
                                  help_text="Reported with a cheat code or the secret character in use.")

    class Meta:
        indexes = [models.Index(fields=["game", "-score"])]


class GameSettings(models.Model):
    """The owner's overrides for one game (cheat codes, rules, switches), or site-wide values in the row with slug "*".
    Read and written only through games.cheats; defaults come from games/cheat_defaults/<slug>.json."""
    slug = models.CharField(max_length=40, unique=True)
    data = models.JSONField(default=dict, blank=True)
    updated = models.DateTimeField(auto_now=True)

    AUDIT_EXCLUDE_FIELDS = ("data",)  # holds codes and a password hash; games.cheats writes its own redacted entry

    class Meta:
        verbose_name = "game settings"
        verbose_name_plural = "game settings"
        permissions = [("manage_game_settings", "Can open Game Settings: edit arcade games, rules, cheat codes and the secret character")]

    def __str__(self):
        return "Arcade settings: " + ("all games" if self.slug == "*" else self.slug)


class OfflineSubmission(models.Model):
    """A result that was played offline and synced later (games.views.api_sync). The client gives each one an id when
    it is made, so a result that is sent twice (a retry after a dropped connection) is counted once."""
    cid = models.CharField(max_length=40, unique=True)
    profile = models.ForeignKey(ArcadeProfile, on_delete=models.CASCADE, related_name="offline_submissions")
    game = models.SlugField(max_length=40, blank=True)
    played_at = models.DateTimeField(null=True, blank=True)
    created = models.DateTimeField(auto_now_add=True)
    ok = models.BooleanField(default=True)
    note = models.CharField(max_length=200, blank=True)

    def __str__(self):
        return f"Offline result {self.cid} ({self.game})"


class GlobalSound(models.Model):
    """A replacement for one arcade sound, for every player of one game, set by a super admin (games.sounds). The game's
    own file in static/audio/sfx/ is never touched: removing this row brings it back. Players' own replacements stay on
    their devices and win over this one."""
    MEDIA_SUBDIR = "games/sounds"
    slug = models.SlugField(max_length=40)
    name = models.CharField(max_length=80)
    file = models.FileField(upload_to=uuid_upload_to, storage=restricted_storage, max_length=200)  # served by games.sounds.sound_file
    content_type = models.CharField(max_length=40)
    size = models.PositiveIntegerField(default=0)
    duration = models.FloatField(default=0)
    original_name = models.CharField(max_length=120, blank=True)
    version = models.PositiveIntegerField(default=1)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    updated = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["slug", "name"], name="uniq_arcade_global_sound")]
        ordering = ["slug", "name"]

    def __str__(self):
        return f"Sound {self.name} for {self.slug}"


class FSLGContent(models.Model):
    """What the super admin changed in Freshers School Life for everyone (games.fslg_admin): the game config (kind
    "config"), the credits ("credits") and one row per edited character ("character", key = the npc id). Only the
    changes are stored; the game's own data is the default, so deleting a row restores it. Every save also writes an
    FSLGContentVersion (history and rollback) and an audit entry."""
    KINDS = (("config", "Game config"), ("credits", "Credits"), ("character", "Character"))
    kind = models.CharField(max_length=20, choices=KINDS)
    key = models.CharField(max_length=40, blank=True, default="")
    data = models.JSONField(default=dict, blank=True)
    version = models.PositiveIntegerField(default=1)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    updated = models.DateTimeField(auto_now=True)

    AUDIT_EXCLUDE_FIELDS = ("data",)  # games.fslg_admin writes its own entry with the old and new values

    class Meta:
        constraints = [models.UniqueConstraint(fields=["kind", "key"], name="uniq_fslg_content")]
        ordering = ["kind", "key"]

    def __str__(self):
        return f"FSLG {self.kind}" + (f" {self.key}" if self.key else "")


class FSLGContentVersion(models.Model):
    """One saved state of an FSLGContent row (data = the whole override after the change; {} = back to defaults)."""
    kind = models.CharField(max_length=20)
    key = models.CharField(max_length=40, blank=True, default="")
    version = models.PositiveIntegerField()
    data = models.JSONField(default=dict, blank=True)
    note = models.CharField(max_length=200, blank=True)
    by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]
        indexes = [models.Index(fields=["kind", "key"])]

    def __str__(self):
        return f"FSLG {self.kind} {self.key} v{self.version}"
