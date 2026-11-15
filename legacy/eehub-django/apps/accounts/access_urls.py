"""People-and-access management screens. URL names are a contract used across EE Hub."""
from django.urls import path

from . import access_r7_views as r7
from . import access_views as v

app_name = "access"
urlpatterns = [
    path("", v.access_home, name="home"),
    # Users
    path("users/", v.users, name="users"),
    path("users/new/", v.user_create, name="user_create"),
    path("users/import/", v.user_import, name="user_import"),
    path("users/<int:pk>/", v.user_detail, name="user_detail"),
    path("users/<int:pk>/edit/", v.user_edit, name="user_edit"),
    path("users/<int:pk>/reset-password/", v.user_reset_password, name="user_reset_password"),
    path("users/<int:pk>/toggle-active/", v.user_toggle_active, name="user_toggle_active"),
    path("users/<int:pk>/profiles/", v.user_profiles, name="user_profiles"),
    path("users/<int:pk>/overrides/", v.user_overrides, name="user_overrides"),
    path("people/search/", v.person_search, name="person_search"),
    # Offices and appointments
    path("offices/", v.offices, name="offices"),
    path("offices/new/", v.office_create, name="office_create"),
    path("offices/<slug:code>/edit/", v.office_edit, name="office_edit"),
    path("offices/<slug:code>/appoint/", v.office_appoint, name="office_appoint"),
    path("appointments/<int:pk>/end/", v.appointment_end, name="appointment_end"),
    # Permission matrix
    path("matrix/", v.matrix, name="matrix"),
    path("matrix/toggle/", v.matrix_toggle, name="matrix_toggle"),
    path("matrix/holders/", v.matrix_holders, name="matrix_holders"),
    path("profile-roles/<slug:kind>/", v.profile_role_edit, name="profile_role_edit"),
    # Registration-number formats
    path("regno/", v.regno_list, name="regno_list"),
    path("regno/new/", v.regno_create, name="regno_create"),
    path("regno/<int:pk>/", v.regno_edit, name="regno_edit"),
    path("regno/preview/", v.regno_preview, name="regno_preview"),
    # Round 7 (R7A): eligibility review, grants, delegation, my access, access log, classes and broadcast
    path("how/", r7.how, name="how"),
    path("review/", r7.review_appointments, name="review_appointments"),
    path("review/end-all/", r7.review_end_all, name="review_end_all"),
    path("grants/", r7.grants, name="grants"),
    path("grants/new/", r7.grant_create, name="grant_create"),
    path("grants/<int:pk>/revoke/", r7.grant_revoke, name="grant_revoke"),
    path("me/", r7.my_access, name="my_access"),
    path("delegation/", r7.delegation, name="delegation"),
    path("delegation/new/", r7.delegation_edit, name="delegation_create"),
    path("delegation/<int:pk>/", r7.delegation_edit, name="delegation_edit"),
    path("access-log/", r7.access_log, name="access_log"),
    path("classes/", r7.classes, name="classes"),
    path("classes/<int:pk>/", r7.class_detail, name="class_detail"),
    path("classes/broadcast/", r7.broadcast, name="broadcast"),
]
