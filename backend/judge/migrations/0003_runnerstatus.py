from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("judge", "0002_sampletest_is_sample"),
    ]

    operations = [
        migrations.CreateModel(
            name="RunnerStatus",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("runner_id", models.CharField(max_length=160, unique=True)),
                ("hostname", models.CharField(blank=True, max_length=255)),
                ("status", models.CharField(default="idle", max_length=32)),
                ("current_submission_id", models.PositiveIntegerField(blank=True, null=True)),
                ("jobs_processed", models.PositiveIntegerField(default=0)),
                ("last_verdict", models.CharField(blank=True, max_length=16)),
                ("supported_languages", models.JSONField(blank=True, default=list)),
                ("load", models.JSONField(blank=True, default=dict)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("last_seen", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["runner_id"]},
        ),
    ]
