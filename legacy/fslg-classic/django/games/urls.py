from django.urls import path
from django.views.generic import RedirectView

from . import fslg_admin as fa
from . import settings_views as sv
from . import sounds as snd
from . import views as v

app_name = "games"

urlpatterns = [
    path("", v.index, name="index"),
    path("leaderboard/", v.leaderboard, name="leaderboard"),
    path("play/<slug:slug>/", v.play, name="play"),
    path("guest/", v.guest, name="guest"),
    path("guest/sign-out/", v.guest_signout, name="guest_signout"),
    path("api/me/", v.api_me, name="api_me"),
    path("api/result/", v.api_result, name="api_result"),
    path("api/buy/", v.api_buy, name="api_buy"),
    path("api/equip/", v.api_equip, name="api_equip"),
    path("api/privacy/", v.api_privacy, name="api_privacy"),
    path("api/room/", v.api_room, name="api_room"),
    path("api/hero/", v.api_hero, name="api_hero"),
    path("api/package/<slug:slug>/", v.api_package, name="api_package"),
    path("api/packages/", v.api_packages, name="api_packages"),
    path("api/sync/", v.api_sync, name="api_sync"),
    path("lan/", v.lan_page, name="lan"),
    path("manifest.webmanifest", v.manifest_view, name="manifest_arcade"),
    path("play/<slug:slug>/manifest.webmanifest", v.manifest_view, name="game_manifest"),
    path("manage/", RedirectView.as_view(pattern_name="games:settings"), name="manage"),
    path("settings/", sv.settings_home, name="settings"),
    path("settings/export/", sv.export, name="settings_export_all"),
    path("settings/codes/", sv.all_codes, name="settings_codes"),
    path("settings/secret-character/", sv.guide, name="settings_guide"),
    path("settings/log/", sv.audit, name="settings_audit"),
    path("settings/sounds/", snd.manage, name="settings_sounds"),
    path("settings/fslg/characters/", fa.page_characters, name="fslg_characters"),
    path("settings/fslg/config/", fa.page_config, name="fslg_config"),
    path("settings/fslg/credits/", fa.page_credits, name="fslg_credits"),
    path("api/fslg/", fa.api_bundle, name="api_fslg"),
    path("api/fslg/save/", fa.api_save, name="api_fslg_save"),
    path("api/fslg/reset/", fa.api_reset, name="api_fslg_reset"),
    path("api/fslg/rollback/", fa.api_rollback, name="api_fslg_rollback"),
    path("api/fslg/history/", fa.api_history, name="api_fslg_history"),
    path("api/sounds/<slug:slug>/", snd.api_sounds, name="api_sounds"),
    path("api/sounds/<slug:slug>/revert/", snd.api_sound_revert, name="api_sound_revert"),
    path("api/sounds/<slug:slug>/file/<str:name>/", snd.sound_file, name="sound_file"),
    path("settings/<slug:slug>/", sv.settings_game, name="settings_game"),
    path("settings/<slug:slug>/export/", sv.export, name="settings_export"),
]
