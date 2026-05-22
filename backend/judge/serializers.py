from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.utils.text import slugify
from rest_framework import serializers

from .models import (
    Clarification,
    Contest,
    ContestProblem,
    ContestRegistration,
    Problem,
    RunnerStatus,
    SampleTest,
    StandingsRow,
    Submission,
)


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "role", "is_staff"]

    def get_role(self, obj):
        return "admin" if obj.is_staff else "participant"


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=6)
    role = serializers.ChoiceField(choices=["participant", "admin"], default="participant")

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already exists.")
        return value

    def validate(self, attrs):
        if attrs.get("role") == "admin" and User.objects.filter(is_staff=True).exists():
            raise serializers.ValidationError("Public admin registration is disabled.")
        return attrs

    def create(self, validated_data):
        role = validated_data.pop("role", "participant")
        user = User.objects.create_user(**validated_data)
        if role == "admin":
            user.is_staff = True
            user.save(update_fields=["is_staff"])
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(username=attrs["username"], password=attrs["password"])
        if user is None:
            raise serializers.ValidationError("Invalid username or password.")
        attrs["user"] = user
        return attrs


class SampleTestSerializer(serializers.ModelSerializer):
    isSample = serializers.BooleanField(source="is_sample", required=False)

    class Meta:
        model = SampleTest
        fields = ["input", "output", "isSample"]


class ProblemListSerializer(serializers.ModelSerializer):
    usedIn = serializers.SerializerMethodField()

    class Meta:
        model = Problem
        fields = ["id", "slug", "name", "difficulty", "tags", "usedIn"]

    def get_usedIn(self, obj):
        return [contest.title for contest in obj.contests.all()]


class ProblemDetailSerializer(serializers.ModelSerializer):
    samples = serializers.SerializerMethodField()
    usedIn = serializers.SerializerMethodField()

    class Meta:
        model = Problem
        fields = [
            "id",
            "slug",
            "name",
            "difficulty",
            "tags",
            "statement",
            "input_format",
            "output_format",
            "note",
            "checker_type",
            "checker_code",
            "checker_language",
            "time_limit_ms",
            "memory_limit_mb",
            "samples",
            "usedIn",
        ]

    def get_samples(self, obj):
        queryset = obj.samples.all()
        if not self.context.get("include_hidden_tests"):
            queryset = queryset.filter(is_sample=True)
        return SampleTestSerializer(queryset, many=True).data

    def get_usedIn(self, obj):
        return [contest.title for contest in obj.contests.all()]


class ProblemWriteSerializer(serializers.ModelSerializer):
    samples = SampleTestSerializer(many=True, required=False)

    class Meta:
        model = Problem
        fields = [
            "slug",
            "name",
            "difficulty",
            "tags",
            "statement",
            "input_format",
            "output_format",
            "note",
            "checker_type",
            "checker_code",
            "checker_language",
            "time_limit_ms",
            "memory_limit_mb",
            "samples",
        ]

    def create(self, validated_data):
        samples = validated_data.pop("samples", [])
        problem = Problem.objects.create(**validated_data)
        SampleTest.objects.bulk_create([SampleTest(problem=problem, **sample) for sample in samples])
        return problem

    def update(self, instance, validated_data):
        samples = validated_data.pop("samples", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if samples is not None:
            instance.samples.all().delete()
            SampleTest.objects.bulk_create([SampleTest(problem=instance, **sample) for sample in samples])
        return instance


class ContestSerializer(serializers.ModelSerializer):
    startTime = serializers.DateTimeField(source="start_time")
    duration = serializers.SerializerMethodField()
    problemCount = serializers.SerializerMethodField()
    solvedBy = serializers.IntegerField(source="solved_by")
    registered = serializers.SerializerMethodField()

    class Meta:
        model = Contest
        fields = [
            "id",
            "title",
            "startTime",
            "duration",
            "participants",
            "status",
            "access_type",
            "allow_virtual",
            "is_gym",
            "author",
            "difficulty",
            "problemCount",
            "solvedBy",
            "registered",
        ]

    def get_duration(self, obj):
        hours, minutes = divmod(obj.duration_minutes, 60)
        parts = []
        if hours:
            parts.append(f"{hours}h")
        if minutes:
            parts.append(f"{minutes}m")
        return " ".join(parts) or "0m"

    def get_problemCount(self, obj):
        return obj.problems.count()

    def get_registered(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return ContestRegistration.objects.filter(contest=obj, username=request.user.username).exists()


class ContestProblemSerializer(serializers.ModelSerializer):
    problem = ProblemDetailSerializer()

    class Meta:
        model = ContestProblem
        fields = ["letter", "points", "problem"]


class ContestWriteSerializer(serializers.Serializer):
    id = serializers.SlugField(required=False)
    title = serializers.CharField()
    start_time = serializers.DateTimeField()
    duration_minutes = serializers.IntegerField(min_value=1)
    status = serializers.ChoiceField(choices=["live", "upcoming", "finished"], default="upcoming")
    access_type = serializers.ChoiceField(choices=["public", "private"], default="public")
    allow_virtual = serializers.BooleanField(default=False)
    is_gym = serializers.BooleanField(default=False)
    author = serializers.CharField(required=False, allow_blank=True, max_length=120)
    difficulty = serializers.ChoiceField(choices=["", "Easy", "Medium", "Hard"], required=False, allow_blank=True)
    solved_by = serializers.IntegerField(required=False, min_value=0)
    problem_ids = serializers.ListField(child=serializers.IntegerField(), required=False)

    def _next_contest_id(self, base_id):
        base = (base_id or "contest")[:50] or "contest"
        candidate = base
        counter = 2
        while Contest.objects.filter(id=candidate).exists():
            suffix = f"-{counter}"
            candidate = f"{base[: 50 - len(suffix)]}{suffix}" or f"contest-{counter}"
            counter += 1
        return candidate

    def _replace_problems(self, contest, problem_ids):
        ContestProblem.objects.filter(contest=contest).delete()
        for index, problem_id in enumerate(problem_ids):
            ContestProblem.objects.create(
                contest=contest,
                problem_id=problem_id,
                letter=chr(65 + index),
            )

    def create(self, validated_data):
        problem_ids = validated_data.pop("problem_ids", [])
        raw_id = validated_data.pop("id", None) or slugify(validated_data["title"])
        contest_id = self._next_contest_id(raw_id)
        contest = Contest.objects.create(id=contest_id, **validated_data)
        self._replace_problems(contest, problem_ids)
        contest.participants = contest.registrations.count()
        contest.save(update_fields=["participants"])
        return contest

    def update(self, instance, validated_data):
        problem_ids = validated_data.pop("problem_ids", None)
        validated_data.pop("id", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if problem_ids is not None:
            self._replace_problems(instance, problem_ids)
        return instance


class SubmissionSerializer(serializers.ModelSerializer):
    problem = serializers.SerializerMethodField()
    contestId = serializers.CharField(source="contest_id", read_only=True)
    time = serializers.SerializerMethodField()
    memory = serializers.SerializerMethodField()
    submittedAt = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = [
            "id",
            "user",
            "contestId",
            "problem",
            "status",
            "time",
            "memory",
            "language",
            "source_code",
            "judge_output",
            "submittedAt",
        ]

    def get_problem(self, obj):
        cp = ContestProblem.objects.filter(contest=obj.contest, problem=obj.problem).first()
        prefix = f"{cp.letter}. " if cp else ""
        return f"{prefix}{obj.problem.name}"

    def get_time(self, obj):
        return "pending" if obj.time_ms is None else f"{obj.time_ms}ms"

    def get_memory(self, obj):
        return "pending" if obj.memory_kb is None else f"{obj.memory_kb / 1024:.1f}MB"

    def get_submittedAt(self, obj):
        return obj.submitted_at.isoformat()


class SubmissionCreateSerializer(serializers.Serializer):
    contest_id = serializers.CharField()
    problem_letter = serializers.CharField()
    user = serializers.CharField(default="coder_123", required=False)
    language = serializers.CharField()
    source_code = serializers.CharField()


class SubmissionResultSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["AC", "WA", "TLE", "MLE", "RE", "CE", "Running", "Pending"])
    time_ms = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    memory_kb = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    judge_output = serializers.CharField(required=False, allow_blank=True)


class StandingsRowSerializer(serializers.ModelSerializer):
    class Meta:
        model = StandingsRow
        fields = ["rank", "handle", "rating", "score", "problems"]


class RunnerHeartbeatSerializer(serializers.Serializer):
    runner_id = serializers.CharField(max_length=160)
    hostname = serializers.CharField(max_length=255, allow_blank=True, required=False)
    status = serializers.ChoiceField(choices=["idle", "busy", "draining"], default="idle")
    current_submission_id = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    jobs_processed = serializers.IntegerField(required=False, min_value=0)
    last_verdict = serializers.CharField(required=False, allow_blank=True, max_length=16)
    supported_languages = serializers.ListField(child=serializers.CharField(), required=False)
    load = serializers.DictField(required=False)
    started_at = serializers.DateTimeField(required=False, allow_null=True)


class RunnerStatusSerializer(serializers.ModelSerializer):
    isOnline = serializers.BooleanField(read_only=True)
    secondsSinceSeen = serializers.IntegerField(read_only=True)

    class Meta:
        model = RunnerStatus
        fields = [
            "runner_id",
            "hostname",
            "status",
            "current_submission_id",
            "jobs_processed",
            "last_verdict",
            "supported_languages",
            "load",
            "started_at",
            "last_seen",
            "isOnline",
            "secondsSinceSeen",
        ]


class ClarificationSerializer(serializers.ModelSerializer):
    contestId = serializers.CharField(source="contest_id")
    contestTitle = serializers.CharField(source="contest.title", read_only=True)
    problemId = serializers.IntegerField(source="problem_id", allow_null=True, read_only=True)
    problemLabel = serializers.SerializerMethodField()
    submittedAt = serializers.DateTimeField(source="created_at")
    updatedAt = serializers.DateTimeField(source="updated_at")

    class Meta:
        model = Clarification
        fields = [
            "id",
            "user",
            "contestId",
            "contestTitle",
            "problemId",
            "problemLabel",
            "question",
            "reply",
            "status",
            "submittedAt",
            "updatedAt",
        ]

    def get_problemLabel(self, obj):
        if not obj.problem_id:
            return ""
        contest_problem = ContestProblem.objects.filter(contest=obj.contest, problem=obj.problem).first()
        prefix = f"{contest_problem.letter}. " if contest_problem else ""
        return f"{prefix}{obj.problem.name}"


class ClarificationCreateSerializer(serializers.Serializer):
    contest_id = serializers.CharField()
    problem_id = serializers.IntegerField(required=False, allow_null=True)
    problem_letter = serializers.CharField(required=False, allow_blank=True)
    question = serializers.CharField()


class ClarificationReplySerializer(serializers.Serializer):
    reply = serializers.CharField(allow_blank=False)
    status = serializers.ChoiceField(choices=["replied", "broadcast"])
