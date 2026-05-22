from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Contest",
            fields=[
                ("id", models.SlugField(primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=255)),
                ("start_time", models.DateTimeField()),
                ("duration_minutes", models.PositiveIntegerField(default=120)),
                ("participants", models.PositiveIntegerField(default=0)),
                ("status", models.CharField(choices=[("live", "Live"), ("upcoming", "Upcoming"), ("finished", "Finished")], default="upcoming", max_length=16)),
                ("is_gym", models.BooleanField(default=False)),
                ("author", models.CharField(blank=True, max_length=120)),
                ("difficulty", models.CharField(blank=True, max_length=16)),
                ("solved_by", models.PositiveIntegerField(default=0)),
            ],
        ),
        migrations.CreateModel(
            name="Problem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(unique=True)),
                ("name", models.CharField(max_length=255)),
                ("difficulty", models.CharField(choices=[("Easy", "Easy"), ("Medium", "Medium"), ("Hard", "Hard")], default="Medium", max_length=16)),
                ("tags", models.JSONField(blank=True, default=list)),
                ("statement", models.TextField()),
                ("input_format", models.TextField(default="")),
                ("output_format", models.TextField(default="")),
                ("note", models.TextField(blank=True, default="")),
                ("time_limit_ms", models.PositiveIntegerField(default=1000)),
                ("memory_limit_mb", models.PositiveIntegerField(default=256)),
            ],
        ),
        migrations.CreateModel(
            name="SampleTest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("input", models.TextField()),
                ("output", models.TextField()),
                ("problem", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="samples", to="judge.problem")),
            ],
        ),
        migrations.CreateModel(
            name="ContestProblem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("letter", models.CharField(max_length=8)),
                ("points", models.PositiveIntegerField(default=1000)),
                ("contest", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="judge.contest")),
                ("problem", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="judge.problem")),
            ],
            options={"ordering": ["letter"], "unique_together": {("contest", "letter")}},
        ),
        migrations.AddField(
            model_name="contest",
            name="problems",
            field=models.ManyToManyField(related_name="contests", through="judge.ContestProblem", to="judge.problem"),
        ),
        migrations.CreateModel(
            name="StandingsRow",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("rank", models.PositiveIntegerField()),
                ("handle", models.CharField(max_length=120)),
                ("rating", models.PositiveIntegerField(default=0)),
                ("score", models.PositiveIntegerField(default=0)),
                ("problems", models.JSONField(default=dict)),
                ("contest", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="standings", to="judge.contest")),
            ],
            options={"ordering": ["rank"]},
        ),
        migrations.CreateModel(
            name="Submission",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("user", models.CharField(max_length=120)),
                ("language", models.CharField(max_length=32)),
                ("source_code", models.TextField()),
                ("status", models.CharField(choices=[("Pending", "Pending"), ("Running", "Running"), ("AC", "Accepted"), ("WA", "Wrong Answer"), ("TLE", "Time Limit"), ("MLE", "Memory Limit"), ("RE", "Runtime Error"), ("CE", "Compilation Error")], default="Pending", max_length=16)),
                ("time_ms", models.PositiveIntegerField(blank=True, null=True)),
                ("memory_kb", models.PositiveIntegerField(blank=True, null=True)),
                ("judge_output", models.TextField(blank=True)),
                ("submitted_at", models.DateTimeField(auto_now_add=True)),
                ("contest", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="submissions", to="judge.contest")),
                ("problem", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="submissions", to="judge.problem")),
            ],
        ),
    ]
