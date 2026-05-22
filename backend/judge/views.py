from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from django.conf import settings
from django.utils import timezone
from django.http import HttpResponse, StreamingHttpResponse
from django.db import transaction
from django.db.models import Count
from django.db.models.functions import TruncDate
import json
import re
import subprocess
import sys
import tempfile
import time
import zipfile
from io import BytesIO
from pathlib import PurePosixPath
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, authentication_classes, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from .models import Clarification, Contest, ContestProblem, ContestRegistration, Problem, RunnerStatus, SampleTest, Submission
from .queue import publish_submission
from .standings import FINAL_STATUSES, recompute_contest_standings
from .serializers import (
    ContestProblemSerializer,
    ContestSerializer,
    ContestWriteSerializer,
    ClarificationCreateSerializer,
    ClarificationReplySerializer,
    ClarificationSerializer,
    LoginSerializer,
    ProblemDetailSerializer,
    ProblemListSerializer,
    ProblemWriteSerializer,
    RegisterSerializer,
    RunnerHeartbeatSerializer,
    RunnerStatusSerializer,
    StandingsRowSerializer,
    SubmissionCreateSerializer,
    SubmissionResultSerializer,
    SubmissionSerializer,
    UserSerializer,
)

RUNNER_ONLINE_SECONDS = 15
RUNNER_VISIBLE_SECONDS = 30
DEFAULT_LANGUAGES = [
    {"id": "cpp", "label": "C++ 17"},
    {"id": "python", "label": "Python 3"},
    {"id": "java", "label": "Java 17"},
    {"id": "rust", "label": "Rust"},
]
GENERATED_TESTS_LIMIT = 100
GENERATOR_TIMEOUT_SECONDS = 5
GENERATOR_OUTPUT_LIMIT = 262_144


@api_view(["GET"])
@permission_classes([AllowAny])
def health(_request):
    return Response({"status": "ok"})


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "user": UserSerializer(user).data}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def login(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data["user"]
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "user": UserSerializer(user).data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(UserSerializer(request.user).data)


@api_view(["GET", "PUT"])
@permission_classes([AllowAny])
def profile(request, username):
    user_obj = get_object_or_404(User, username=username)
    can_edit = request.user.is_authenticated and (request.user.username == username or request.user.is_staff)
    if request.method == "PUT":
        if not can_edit:
            return Response({"detail": "You can edit only your own profile."}, status=status.HTTP_403_FORBIDDEN)
        user_obj.email = str(request.data.get("email", user_obj.email) or "")
        user_obj.first_name = str(request.data.get("first_name", user_obj.first_name) or "")[:150]
        user_obj.last_name = str(request.data.get("last_name", user_obj.last_name) or "")[:150]
        user_obj.save(update_fields=["email", "first_name", "last_name"])

    submissions_qs = (
        Submission.objects.filter(user=username)
        .select_related("contest", "problem")
        .order_by("-submitted_at")
    )
    problems_solved = Submission.objects.filter(user=username, status="AC").values("problem_id").distinct().count()
    contests_attended = Submission.objects.filter(user=username).values("contest_id").distinct().count()
    standings_rows = (
        Contest.objects.filter(standings__handle=username)
        .values(
            "id",
            "title",
            "start_time",
            "standings__rank",
            "standings__rating",
            "standings__score",
        )
        .order_by("start_time")
    )
    rating_history = [
        {
            "contest": index + 1,
            "contestId": row["id"],
            "title": row["title"],
            "rating": row["standings__rating"],
            "rank": row["standings__rank"],
            "score": row["standings__score"],
        }
        for index, row in enumerate(standings_rows)
    ]
    activity = (
        submissions_qs.annotate(day=TruncDate("submitted_at"))
        .values("day")
        .annotate(count=Count("id"))
        .order_by("day")
    )
    payload = {
        "username": username,
        "firstName": user_obj.first_name,
        "lastName": user_obj.last_name,
        "canEdit": can_edit,
        "problemsSolved": problems_solved,
        "contestsAttended": contests_attended,
        "globalRank": min((row["rank"] for row in rating_history), default=None),
        "currentRating": rating_history[-1]["rating"] if rating_history else 0,
        "maxRating": max((row["rating"] for row in rating_history), default=0),
        "ratingHistory": rating_history,
        "activity": [
            {"date": item["day"].isoformat(), "count": item["count"]}
            for item in activity
        ],
        "recentSubmissions": SubmissionSerializer(submissions_qs[:10], many=True).data,
    }
    if can_edit:
        payload["email"] = user_obj.email
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_summary(_request):
    recent_submissions = (
        Submission.objects.select_related("contest", "problem")
        .order_by("-submitted_at")[:8]
    )
    return Response(
        {
            "activeContests": Contest.objects.filter(status="live", is_gym=False).count(),
            "totalProblems": Problem.objects.count(),
            "registeredUsers": User.objects.count(),
            "totalSubmissions": Submission.objects.count(),
            "recentActivity": [
                {
                    "type": f"Submission {submission.status}",
                    "name": f"{submission.contest_id} - {submission.problem.name} by {submission.user}",
                    "time": submission.submitted_at.isoformat(),
                }
                for submission in recent_submissions
            ],
        }
    )


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def contests(request):
    if request.method == "GET":
        qs = Contest.objects.filter(is_gym=False).order_by("start_time")
        return Response(ContestSerializer(qs, many=True, context={"request": request}).data)

    if not request.user.is_authenticated or not request.user.is_staff:
        return Response({"detail": "Admin access required."}, status=status.HTTP_403_FORBIDDEN)

    serializer = ContestWriteSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    contest = serializer.save()
    return Response(ContestSerializer(contest, context={"request": request}).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAdminUser])
def contest_admin_detail(request, contest_id):
    contest = get_object_or_404(Contest, id=contest_id)
    if request.method == "GET":
        return Response(ContestSerializer(contest, context={"request": request}).data)
    if request.method == "PUT":
        serializer = ContestWriteSerializer(contest, data=request.data)
        serializer.is_valid(raise_exception=True)
        contest = serializer.save()
        return Response(ContestSerializer(contest, context={"request": request}).data)
    contest.delete()
    return Response({"status": "deleted", "id": contest_id})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def register_for_contest(request, contest_id):
    contest = get_object_or_404(Contest, id=contest_id)
    ContestRegistration.objects.get_or_create(contest=contest, username=request.user.username)
    contest.participants = contest.registrations.count()
    contest.save(update_fields=["participants"])
    return Response({"status": "registered", "contestId": contest.id, "participants": contest.participants})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def clarifications(request):
    if request.method == "GET":
        queryset = Clarification.objects.select_related("contest", "problem")
        if not request.user.is_staff:
            queryset = queryset.filter(user=request.user.username) | queryset.filter(status="broadcast")
        return Response(ClarificationSerializer(queryset.distinct(), many=True).data)

    serializer = ClarificationCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    contest = get_object_or_404(Contest, id=data["contest_id"])
    problem = None
    if data.get("problem_id"):
        problem = get_object_or_404(Problem, id=data["problem_id"])
    elif data.get("problem_letter"):
        contest_problem = get_object_or_404(
            ContestProblem.objects.select_related("problem"),
            contest=contest,
            letter=data["problem_letter"],
        )
        problem = contest_problem.problem
    clarification = Clarification.objects.create(
        user=request.user.username,
        contest=contest,
        problem=problem,
        question=data["question"],
    )
    return Response(ClarificationSerializer(clarification).data, status=status.HTTP_201_CREATED)


@api_view(["PUT"])
@permission_classes([IsAdminUser])
def clarification_detail(request, clarification_id):
    clarification = get_object_or_404(
        Clarification.objects.select_related("contest", "problem"),
        id=clarification_id,
    )
    serializer = ClarificationReplySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    clarification.reply = serializer.validated_data["reply"]
    clarification.status = serializer.validated_data["status"]
    clarification.save(update_fields=["reply", "status", "updated_at"])
    return Response(ClarificationSerializer(clarification).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def gyms(_request):
    qs = Contest.objects.filter(is_gym=True).order_by("title")
    return Response(ContestSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def contest_problems(_request, contest_id):
    qs = ContestProblem.objects.filter(contest_id=contest_id).select_related("problem").order_by("letter")
    return Response(ContestProblemSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def problem_detail(_request, contest_id, letter):
    contest_problem = (
        ContestProblem.objects.filter(contest_id=contest_id, letter=letter)
        .select_related("problem")
        .prefetch_related("problem__samples")
        .first()
    )
    if not contest_problem:
        return Response({"detail": "Problem not found."}, status=status.HTTP_404_NOT_FOUND)
    return Response(ProblemDetailSerializer(contest_problem.problem).data)


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def problems(request):
    if request.method == "GET":
        qs = Problem.objects.prefetch_related("contests").order_by("name")
        return Response(ProblemListSerializer(qs, many=True).data)

    if not request.user.is_authenticated or not request.user.is_staff:
        return Response({"detail": "Admin access required."}, status=status.HTTP_403_FORBIDDEN)

    data = request.data.copy()
    data.setdefault("slug", slugify(data.get("name", "")))
    serializer = ProblemWriteSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    problem = serializer.save()
    return Response(ProblemDetailSerializer(problem).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAdminUser])
def problem_admin_detail(request, problem_id):
    problem = get_object_or_404(Problem.objects.prefetch_related("samples"), id=problem_id)
    if request.method == "GET":
        return Response(ProblemDetailSerializer(problem, context={"include_hidden_tests": True}).data)
    if request.method == "DELETE":
        problem.delete()
        return Response({"status": "deleted", "id": problem_id})

    data = request.data.copy()
    data.setdefault("slug", problem.slug)
    serializer = ProblemWriteSerializer(problem, data=data)
    serializer.is_valid(raise_exception=True)
    problem = serializer.save()
    return Response(ProblemDetailSerializer(problem, context={"include_hidden_tests": True}).data)


@api_view(["POST"])
@permission_classes([IsAdminUser])
def generate_tests(request):
    code = request.data.get("code", "")
    if not isinstance(code, str) or not code.strip():
        return Response({"detail": "Generator code is required."}, status=status.HTTP_400_BAD_REQUEST)
    if len(code) > 20_000:
        return Response({"detail": "Generator code is too large."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            script_path = f"{tmpdir}/generator.py"
            with open(script_path, "w", encoding="utf-8") as script_file:
                script_file.write(code)
            completed = subprocess.run(
                [sys.executable, "-I", script_path],
                cwd=tmpdir,
                capture_output=True,
                text=True,
                timeout=GENERATOR_TIMEOUT_SECONDS,
            )
    except subprocess.TimeoutExpired:
        return Response(
            {"detail": f"Generator timed out after {GENERATOR_TIMEOUT_SECONDS} seconds."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if completed.returncode != 0:
        return Response(
            {"detail": "Generator failed.", "stderr": completed.stderr[-4000:]},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if len(completed.stdout) > GENERATOR_OUTPUT_LIMIT:
        return Response({"detail": "Generator output is too large."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        tests = _parse_generated_tests(completed.stdout)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({"tests": tests})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def submissions(request):
    if request.method == "GET":
        qs = Submission.objects.select_related("contest", "problem").order_by("-submitted_at")
        if not request.user.is_staff:
            qs = qs.filter(user=request.user.username)
        default_limit = 1000 if request.user.is_staff else 100
        try:
            requested_limit = int(request.query_params.get("limit", default_limit))
        except (TypeError, ValueError):
            requested_limit = default_limit
        limit = min(max(requested_limit, 1), 5000)
        qs = qs[:limit]
        return Response(SubmissionSerializer(qs, many=True).data)

    serializer = SubmissionCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    contest_problem = get_object_or_404(
        ContestProblem.objects.select_related("contest", "problem"),
        contest_id=data["contest_id"],
        letter=data["problem_letter"],
    )
    if not contest_problem.contest.is_gym:
        ContestRegistration.objects.get_or_create(contest=contest_problem.contest, username=request.user.username)
        contest_problem.contest.participants = contest_problem.contest.registrations.count()
        contest_problem.contest.save(update_fields=["participants"])
    submission = Submission.objects.create(
        user=request.user.username,
        contest=contest_problem.contest,
        problem=contest_problem.problem,
        language=data["language"],
        source_code=data["source_code"],
    )
    try:
        publish_submission(submission)
    except Exception as exc:
        submission.judge_output = f"Stored in database, RabbitMQ unavailable: {exc}"
        submission.save(update_fields=["judge_output"])
    return Response(SubmissionSerializer(submission).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAdminUser])
def rejudge(_request, submission_id):
    submission = get_object_or_404(Submission.objects.select_related("contest", "problem"), id=submission_id)
    submission.status = "Pending"
    submission.judge_output = "Queued for rejudge by admin."
    submission.save(update_fields=["status", "judge_output"])
    recompute_contest_standings(submission.contest)
    try:
        publish_submission(submission)
    except Exception as exc:
        submission.judge_output = f"Rejudge requested, RabbitMQ unavailable: {exc}"
        submission.save(update_fields=["judge_output"])
    return Response(SubmissionSerializer(submission).data)


@api_view(["POST"])
@permission_classes([IsAdminUser])
def override_submission(request, submission_id):
    submission = get_object_or_404(Submission.objects.select_related("contest", "problem"), id=submission_id)
    serializer = SubmissionResultSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    for key, value in serializer.validated_data.items():
        setattr(submission, key, value)
    if "judge_output" not in serializer.validated_data:
        submission.judge_output = f"Verdict overridden by admin to {submission.status}."
        update_fields = [*serializer.validated_data.keys(), "judge_output"]
    else:
        update_fields = list(serializer.validated_data.keys())
    submission.save(update_fields=update_fields)
    if submission.status in FINAL_STATUSES:
        recompute_contest_standings(submission.contest)
    return Response(SubmissionSerializer(submission).data)


@api_view(["POST"])
@permission_classes([IsAdminUser])
def disqualify_user(request, username):
    contest_id = request.data.get("contest_id")
    qs = Submission.objects.select_related("contest", "problem").filter(user=username)
    if contest_id:
        qs = qs.filter(contest_id=contest_id)
    submissions = list(qs)
    contest_ids = {submission.contest_id for submission in submissions}
    updated = qs.update(status="RE", judge_output="User disqualified by admin.")
    for contest in Contest.objects.filter(id__in=contest_ids):
        recompute_contest_standings(contest)
    return Response({"username": username, "contestId": contest_id, "updated": updated})


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def submission_result(request, submission_id):
    if request.headers.get("X-Runner-Token") != settings.RUNNER_CALLBACK_TOKEN:
        return Response({"detail": "Invalid runner token."}, status=status.HTTP_403_FORBIDDEN)
    submission = get_object_or_404(Submission.objects.select_related("contest", "problem"), id=submission_id)
    serializer = SubmissionResultSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    for key, value in serializer.validated_data.items():
        setattr(submission, key, value)
    submission.save(update_fields=list(serializer.validated_data.keys()))
    if submission.status in FINAL_STATUSES:
        recompute_contest_standings(submission.contest)
    return Response(SubmissionSerializer(submission).data)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def runner_heartbeat(request):
    if request.headers.get("X-Runner-Token") != settings.RUNNER_CALLBACK_TOKEN:
        return Response({"detail": "Invalid runner token."}, status=status.HTTP_403_FORBIDDEN)
    serializer = RunnerHeartbeatSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    runner_id = data.pop("runner_id")
    runner, _ = RunnerStatus.objects.update_or_create(
        runner_id=runner_id,
        defaults=data,
    )
    return Response({"status": "ok", "runner": runner.runner_id})


@api_view(["GET"])
@permission_classes([IsAdminUser])
def runner_stats(_request):
    now = timezone.now()
    runners = list(RunnerStatus.objects.all())
    serialized = []
    online = 0
    busy = 0
    idle = 0
    total_jobs = 0
    queue_running = Submission.objects.filter(status__in=["Pending", "Running"]).count()

    for runner in runners:
        seconds_since_seen = int((now - runner.last_seen).total_seconds())
        is_online = seconds_since_seen <= RUNNER_ONLINE_SECONDS
        if seconds_since_seen > RUNNER_VISIBLE_SECONDS:
            continue
        if is_online:
            online += 1
            if runner.status == "busy":
                busy += 1
            else:
                idle += 1
        total_jobs += runner.jobs_processed
        runner.isOnline = is_online
        runner.secondsSinceSeen = seconds_since_seen
        serialized.append(runner)
    serialized.sort(key=lambda runner: (not runner.isOnline, runner.runner_id))

    return Response(
        {
            "summary": {
                "total": len(serialized),
                "online": online,
                "busy": busy,
                "idle": idle,
                "offline": max(0, len(serialized) - online),
                "pendingOrRunningSubmissions": queue_running,
                "jobsProcessed": total_jobs,
            },
            "runners": RunnerStatusSerializer(serialized, many=True).data,
            "updatedAt": now.isoformat(),
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def languages(_request):
    now = timezone.now()
    language_ids = set()
    for runner in RunnerStatus.objects.all():
        if int((now - runner.last_seen).total_seconds()) <= RUNNER_ONLINE_SECONDS:
            language_ids.update(runner.supported_languages)
    if not language_ids and not RunnerStatus.objects.exists():
        language_ids = {language["id"] for language in DEFAULT_LANGUAGES}
    labels = {language["id"]: language["label"] for language in DEFAULT_LANGUAGES}
    return Response(
        [
            {"id": language_id, "label": labels.get(language_id, language_id)}
            for language_id in sorted(language_ids)
        ]
    )


def _runner_stats_payload():
    now = timezone.now()
    runners = []
    for runner in RunnerStatus.objects.all():
        seconds_since_seen = int((now - runner.last_seen).total_seconds())
        if seconds_since_seen > RUNNER_VISIBLE_SECONDS:
            continue
        runner.isOnline = seconds_since_seen <= RUNNER_ONLINE_SECONDS
        runner.secondsSinceSeen = seconds_since_seen
        runners.append(runner)
    runners.sort(key=lambda runner: (not runner.isOnline, runner.runner_id))
    return {
        "runners": RunnerStatusSerializer(runners, many=True).data,
        "updatedAt": now.isoformat(),
    }


@api_view(["GET"])
@permission_classes([AllowAny])
def runner_stats_stream(request):
    user = _stream_user(request)
    if not user or not user.is_staff:
        return Response({"detail": "Admin access required."}, status=status.HTTP_403_FORBIDDEN)

    def events():
        for _ in range(300):
            yield f"data: {json.dumps(_runner_stats_payload())}\n\n"
            time.sleep(2)

    return StreamingHttpResponse(events(), content_type="text/event-stream")


@api_view(["GET"])
@permission_classes([AllowAny])
def submissions_stream(request):
    user = _stream_user(request)
    if not user:
        return Response({"detail": "Authentication required."}, status=status.HTTP_403_FORBIDDEN)

    def events():
        for _ in range(300):
            qs = Submission.objects.select_related("contest", "problem").order_by("-submitted_at")
            if not user.is_staff:
                qs = qs.filter(user=user.username)
            payload = SubmissionSerializer(qs[:100], many=True).data
            yield f"data: {json.dumps(payload)}\n\n"
            time.sleep(2)

    return StreamingHttpResponse(events(), content_type="text/event-stream")


def _stream_user(request):
    if request.user.is_authenticated:
        return request.user
    key = request.GET.get("token")
    if not key:
        return None
    token = Token.objects.select_related("user").filter(key=key).first()
    return token.user if token else None


@api_view(["GET"])
@permission_classes([AllowAny])
def metrics(_request):
    pending = Submission.objects.filter(status="Pending").count()
    running = Submission.objects.filter(status="Running").count()
    accepted = Submission.objects.filter(status="AC").count()
    runners_online = 0
    now = timezone.now()
    for runner in RunnerStatus.objects.all():
        if int((now - runner.last_seen).total_seconds()) <= RUNNER_ONLINE_SECONDS:
            runners_online += 1
    body = "\n".join(
        [
            "# HELP opencontest_submissions_pending Pending submissions.",
            "# TYPE opencontest_submissions_pending gauge",
            f"opencontest_submissions_pending {pending}",
            "# HELP opencontest_submissions_running Running submissions.",
            "# TYPE opencontest_submissions_running gauge",
            f"opencontest_submissions_running {running}",
            "# HELP opencontest_submissions_accepted Accepted submissions.",
            "# TYPE opencontest_submissions_accepted counter",
            f"opencontest_submissions_accepted {accepted}",
            "# HELP opencontest_runners_online Online runners.",
            "# TYPE opencontest_runners_online gauge",
            f"opencontest_runners_online {runners_online}",
        ]
    )
    return HttpResponse(body + "\n", content_type="text/plain; version=0.0.4")


@api_view(["POST"])
@parser_classes([MultiPartParser])
@permission_classes([IsAdminUser])
def import_problem_archive(request):
    archive = request.FILES.get("archive")
    if not archive:
        return Response({"detail": "archive file is required."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        with zipfile.ZipFile(BytesIO(archive.read())) as zip_file:
            package = _parse_problem_archive(zip_file, archive.name)
    except zipfile.BadZipFile:
        return Response({"detail": "Only zip archives are supported."}, status=status.HTTP_400_BAD_REQUEST)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        problem = Problem.objects.create(
            slug=_unique_problem_slug(package["slug"]),
            name=package["name"],
            difficulty=package["difficulty"],
            tags=package["tags"],
            statement=package["statement"],
            input_format=package["input_format"],
            output_format=package["output_format"],
            note=package["note"],
            checker_type=package["checker_type"],
            checker_code=package["checker_code"],
            checker_language=package["checker_language"],
            time_limit_ms=package["time_limit_ms"],
            memory_limit_mb=package["memory_limit_mb"],
        )
        SampleTest.objects.bulk_create(
            [
                SampleTest(
                    problem=problem,
                    input=test["input"],
                    output=test["output"],
                    is_sample=test["is_sample"],
                )
                for test in package["tests"]
            ]
        )

    return Response(
        {
            "status": "imported",
            "problem": ProblemDetailSerializer(problem, context={"include_hidden_tests": True}).data,
            "files": package["files"][:50],
            "testsImported": len(package["tests"]),
            "message": f"Imported {problem.name} with {len(package['tests'])} tests.",
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def standings(_request, contest_id):
    contest = get_object_or_404(Contest, id=contest_id)
    recompute_contest_standings(contest)
    now = timezone.now()
    elapsed_minutes = max(0, int((now - contest.start_time).total_seconds() // 60))
    if contest.status == "finished" and contest.duration_minutes:
        elapsed_minutes = min(elapsed_minutes, contest.duration_minutes)
    problem_letters = list(contest.contestproblem_set.order_by("letter").values_list("letter", flat=True))
    rows = contest.standings.all()
    return Response(
        {
            "contestId": contest.id,
            "startTime": contest.start_time.isoformat(),
            "durationMinutes": contest.duration_minutes,
            "elapsedMinutes": elapsed_minutes,
            "status": contest.status,
            "problems": problem_letters,
            "participants": StandingsRowSerializer(rows, many=True).data,
        }
    )


def _parse_problem_archive(zip_file, filename):
    names = [name for name in zip_file.namelist() if not name.endswith("/")]
    if not names:
        raise ValueError("Archive is empty.")

    metadata = _read_metadata(zip_file, names)
    tests = _read_archive_tests(zip_file, names)
    if metadata.get("tests"):
        tests.extend(metadata["tests"])
    if not tests:
        raise ValueError("No tests found. Add .in files with matching .ans/.out files or a problem.json tests array.")

    title = metadata.get("name") or metadata.get("title") or PurePosixPath(filename).stem
    slug = metadata.get("slug") or slugify(title)
    return {
        "slug": slug or "imported-problem",
        "name": title,
        "difficulty": _normalize_difficulty(metadata.get("difficulty", "Medium")),
        "tags": _coerce_tags(metadata.get("tags", ["imported"])),
        "statement": metadata.get("statement") or _read_first_text(zip_file, names, ["statement.md", "problem.md", "README.md", "statement.txt"]) or f"Imported from {filename}.",
        "input_format": metadata.get("input_format") or metadata.get("input") or "See statement.",
        "output_format": metadata.get("output_format") or metadata.get("output") or "See statement.",
        "note": metadata.get("note", ""),
        "checker_type": metadata.get("checker_type", "standard"),
        "checker_code": metadata.get("checker_code", ""),
        "checker_language": metadata.get("checker_language", "python"),
        "time_limit_ms": int(float(metadata.get("time_limit_ms", metadata.get("timelimit", 1))) * (1000 if "time_limit_ms" not in metadata else 1)),
        "memory_limit_mb": int(metadata.get("memory_limit_mb", metadata.get("memorylimit", 256))),
        "tests": tests,
        "files": names,
    }


def _read_metadata(zip_file, names):
    for name in names:
        basename = PurePosixPath(name).name.lower()
        if basename in {"problem.json", "manifest.json"}:
            data = json.loads(_read_text(zip_file, name))
            data["tests"] = [
                {
                    "input": str(item.get("input", "")),
                    "output": str(item.get("output", "")),
                    "is_sample": bool(item.get("is_sample", item.get("sample", False))),
                }
                for item in data.get("tests", [])
                if "input" in item and "output" in item
            ]
            return data
        if basename in {"problem.yaml", "problem.yml"}:
            return _parse_simple_yaml(_read_text(zip_file, name))
    return {}


def _parse_simple_yaml(text):
    data = {}
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#") or ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip().replace("-", "_")
        value = value.strip().strip("'\"")
        if key in {"tags", "keywords"}:
            value = [item.strip() for item in re.split(r"[, ]+", value.strip("[]")) if item.strip()]
            key = "tags"
        data[key] = value
    if "name" not in data and "title" in data:
        data["name"] = data["title"]
    return data


def _read_archive_tests(zip_file, names):
    by_lower = {name.lower(): name for name in names}
    tests = []
    seen = set()
    for name in names:
        lower = name.lower()
        if not lower.endswith((".in", ".input")):
            continue
        base = re.sub(r"\.(in|input)$", "", lower)
        answer_name = None
        for suffix in [".ans", ".out", ".output"]:
            candidate = by_lower.get(base + suffix)
            if candidate:
                answer_name = candidate
                break
        if not answer_name or lower in seen:
            continue
        parts = {part.lower() for part in PurePosixPath(name).parts}
        tests.append(
            {
                "input": _read_text(zip_file, name),
                "output": _read_text(zip_file, answer_name),
                "is_sample": bool(parts & {"sample", "samples"}),
            }
        )
        seen.add(lower)
    tests.sort(key=lambda item: (not item["is_sample"], item["input"]))
    return tests


def _parse_generated_tests(stdout):
    blocks = [block.strip("\r\n") for block in re.split(r"(?m)^\s*===\s*$", stdout) if block.strip()]
    if not blocks:
        raise ValueError("Generator produced no tests.")
    if len(blocks) > GENERATED_TESTS_LIMIT:
        raise ValueError(f"Generator produced too many tests. Limit is {GENERATED_TESTS_LIMIT}.")

    tests = []
    for index, block in enumerate(blocks, start=1):
        parts = re.split(r"(?m)^\s*---\s*$", block, maxsplit=1)
        if len(parts) != 2:
            raise ValueError(f"Test #{index} must contain a line with --- between input and output.")
        test_input = parts[0].strip("\r\n")
        test_output = parts[1].strip("\r\n")
        if not test_input:
            raise ValueError(f"Test #{index} has empty input.")
        if not test_output:
            raise ValueError(f"Test #{index} has empty output.")
        tests.append({"input": test_input, "output": test_output, "isSample": index == 1})
    return tests


def _read_first_text(zip_file, names, basenames):
    candidates = set(basenames)
    for name in names:
        if PurePosixPath(name).name in candidates:
            return _read_text(zip_file, name)
    return ""


def _read_text(zip_file, name):
    return zip_file.read(name).decode("utf-8", errors="replace").replace("\r\n", "\n")


def _coerce_tags(value):
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [item.strip() for item in str(value).split(",") if item.strip()]


def _normalize_difficulty(value):
    normalized = str(value or "Medium").strip().lower()
    return {"easy": "Easy", "medium": "Medium", "hard": "Hard"}.get(normalized, "Medium")


def _unique_problem_slug(base_slug):
    base = slugify(base_slug)[:50] or "imported-problem"
    candidate = base
    counter = 2
    while Problem.objects.filter(slug=candidate).exists():
        suffix = f"-{counter}"
        candidate = f"{base[: 50 - len(suffix)]}{suffix}"
        counter += 1
    return candidate
