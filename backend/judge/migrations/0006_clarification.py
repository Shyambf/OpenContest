from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("judge", "0005_submission_queue_tracking"),
    ]

    operations = [
        migrations.CreateModel(
            name="Clarification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("user", models.CharField(max_length=150)),
                ("question", models.TextField()),
                ("reply", models.TextField(blank=True)),
                (
                    "status",
                    models.CharField(
                        choices=[("pending", "Pending"), ("replied", "Replied"), ("broadcast", "Broadcast")],
                        default="pending",
                        max_length=16,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "contest",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="clarifications", to="judge.contest"),
                ),
                (
                    "problem",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="clarifications",
                        to="judge.problem",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
