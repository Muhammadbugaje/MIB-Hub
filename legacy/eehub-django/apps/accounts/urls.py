from django.contrib.auth import views as auth_views
from django.urls import path

from . import profile_nudges, views

app_name = "accounts"
urlpatterns = [
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("switch/", views.switch_profile_view, name="switch_profile"),
    path("profile/", views.profile_view, name="profile"),
    path("password/", views.password_change_view, name="password_change"),
    path("password/first/", views.first_password_view, name="first_password"),
    path("profile/nudge/continue/", profile_nudges.continue_view, name="profile_nudge_continue"),
    path("password/reset/", views.PasswordResetView.as_view(), name="password_reset"),
    path("password/reset/sent/", auth_views.PasswordResetDoneView.as_view(template_name="accounts/password_reset_done.html"), name="password_reset_done"),
    path("password/reset/<uidb64>/<token>/", views.PasswordResetConfirmView.as_view(), name="password_reset_confirm"),
    path("password/reset/complete/", auth_views.PasswordResetCompleteView.as_view(template_name="accounts/password_reset_complete.html"), name="password_reset_complete"),
]
