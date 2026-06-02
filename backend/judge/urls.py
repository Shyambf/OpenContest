from django.urls import path

from . import views


urlpatterns = [
    path("health/", views.health),
    path("auth/register/", views.register),
    path("auth/login/", views.login),
    path("auth/me/", views.me),
    path("profiles/<str:username>/", views.profile),
    path("admin/summary/", views.admin_summary),
    path("languages/", views.languages),
    path("metrics/", views.metrics),
    path("contests/", views.contests),
    path("contests/<slug:contest_id>/", views.contest_admin_detail),
    path("contests/<slug:contest_id>/register/", views.register_for_contest),
    path("clarifications/", views.clarifications),
    path("clarifications/<int:clarification_id>/", views.clarification_detail),
    path("gyms/", views.gyms),
    path("contests/<slug:contest_id>/problems/", views.contest_problems),
    path("contests/<slug:contest_id>/problems/<str:letter>/", views.problem_detail),
    path("contests/<slug:contest_id>/standings/", views.standings),
    path("problems/", views.problems),
    path("problems/generate-tests/", views.generate_tests),
    path("problems/<int:problem_id>/", views.problem_admin_detail),
    path("submissions/", views.submissions),
    path("submissions/<int:submission_id>/rejudge/", views.rejudge),
    path("submissions/<int:submission_id>/override/", views.override_submission),
    path("users/<str:username>/disqualify/", views.disqualify_user),
    path("runners/heartbeat/", views.runner_heartbeat),
    path("runners/stats/", views.runner_stats),
    path("runners/stats/stream/", views.runner_stats_stream),
    path("submissions/stream/", views.submissions_stream),
    path("problems/import-archive/", views.import_problem_archive),
]
