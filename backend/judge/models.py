from django.db import models


class Problem(models.Model):
    DIFFICULTY_CHOICES = [
        ("Easy", "Easy"),
        ("Medium", "Medium"),
        ("Hard", "Hard"),
    ]

    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=255)
    difficulty = models.CharField(max_length=16, choices=DIFFICULTY_CHOICES, default="Medium")
    tags = models.JSONField(default=list, blank=True)
    statement = models.TextField()
    input_format = models.TextField(default="")
    output_format = models.TextField(default="")
    note = models.TextField(default="", blank=True)
    checker_type = models.CharField(max_length=32, default="standard")
    checker_code = models.TextField(default="", blank=True)
    checker_language = models.CharField(max_length=32, default="python")
    time_limit_ms = models.PositiveIntegerField(default=1000)
    memory_limit_mb = models.PositiveIntegerField(default=256)

    def __str__(self):
        return self.name


class SampleTest(models.Model):
    problem = models.ForeignKey(Problem, related_name="samples", on_delete=models.CASCADE)
    input = models.TextField()
    output = models.TextField()
    is_sample = models.BooleanField(default=True)


class Contest(models.Model):
    STATUS_CHOICES = [
        ("live", "Live"),
        ("upcoming", "Upcoming"),
        ("finished", "Finished"),
    ]

    id = models.SlugField(primary_key=True)
    title = models.CharField(max_length=255)
    start_time = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField(default=120)
    participants = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="upcoming")
    access_type = models.CharField(max_length=16, default="public")
    allow_virtual = models.BooleanField(default=False)
    is_gym = models.BooleanField(default=False)
    author = models.CharField(max_length=120, blank=True)
    difficulty = models.CharField(max_length=16, blank=True)
    solved_by = models.PositiveIntegerField(default=0)
    problems = models.ManyToManyField(Problem, through="ContestProblem", related_name="contests")

    def __str__(self):
        return self.title


class ContestProblem(models.Model):
    contest = models.ForeignKey(Contest, on_delete=models.CASCADE)
    problem = models.ForeignKey(Problem, on_delete=models.CASCADE)
    letter = models.CharField(max_length=8)
    points = models.PositiveIntegerField(default=1000)

    class Meta:
        unique_together = ("contest", "letter")
        ordering = ["letter"]


class ContestRegistration(models.Model):
    contest = models.ForeignKey(Contest, related_name="registrations", on_delete=models.CASCADE)
    username = models.CharField(max_length=150)
    registered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("contest", "username")
        ordering = ["contest_id", "username"]


class Clarification(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("replied", "Replied"),
        ("broadcast", "Broadcast"),
    ]

    user = models.CharField(max_length=150)
    contest = models.ForeignKey(Contest, related_name="clarifications", on_delete=models.CASCADE)
    problem = models.ForeignKey(Problem, related_name="clarifications", null=True, blank=True, on_delete=models.SET_NULL)
    question = models.TextField()
    reply = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


class Submission(models.Model):
    STATUS_CHOICES = [
        ("Pending", "Pending"),
        ("Running", "Running"),
        ("AC", "Accepted"),
        ("WA", "Wrong Answer"),
        ("TLE", "Time Limit"),
        ("MLE", "Memory Limit"),
        ("RE", "Runtime Error"),
        ("CE", "Compilation Error"),
    ]

    user = models.CharField(max_length=120)
    contest = models.ForeignKey(Contest, related_name="submissions", on_delete=models.CASCADE)
    problem = models.ForeignKey(Problem, related_name="submissions", on_delete=models.CASCADE)
    language = models.CharField(max_length=32)
    source_code = models.TextField()
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="Pending")
    time_ms = models.PositiveIntegerField(null=True, blank=True)
    memory_kb = models.PositiveIntegerField(null=True, blank=True)
    judge_output = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    queue_attempted_at = models.DateTimeField(null=True, blank=True)
    queue_attempts = models.PositiveIntegerField(default=0)


class StandingsRow(models.Model):
    contest = models.ForeignKey(Contest, related_name="standings", on_delete=models.CASCADE)
    rank = models.PositiveIntegerField()
    handle = models.CharField(max_length=120)
    rating = models.PositiveIntegerField(default=0)
    score = models.PositiveIntegerField(default=0)
    problems = models.JSONField(default=dict)

    class Meta:
        ordering = ["rank"]


class RunnerStatus(models.Model):
    runner_id = models.CharField(max_length=160, unique=True)
    hostname = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=32, default="idle")
    current_submission_id = models.PositiveIntegerField(null=True, blank=True)
    jobs_processed = models.PositiveIntegerField(default=0)
    last_verdict = models.CharField(max_length=16, blank=True)
    supported_languages = models.JSONField(default=list, blank=True)
    load = models.JSONField(default=dict, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    last_seen = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["runner_id"]
