"""Sidebar entry for the learning arcade (hidden while features.games is off)."""
from core import nav
from core.nav import Item

nav.group("games", "Learning arcade", order=24, icon="gamepad-2", tone="volt")
nav.add("games", Item("Arcade", "games:index", icon="gamepad-2", match=("games:index", "games:play"),
                      profiles=("student", "lecturer", "staff", "admin")))


def _manager(user, kind):
    from .cheats import can_manage
    return can_manage(user)


# Arcade Management: the super admin and anyone given games.manage_game_settings. Listed twice on purpose, so it is
# found both next to the arcade and among the system tools.
nav.add("games", Item("Arcade Management", "games:settings", icon="sliders-horizontal", check=_manager,
                      match=("games:settings*", "games:manage")))
nav.add("system", Item("Arcade Management", "games:settings", icon="gamepad-2", check=_manager))
