from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("judge", "0003_runnerstatus"),
    ]

    operations = [
        migrations.AddField(
            model_name="problem",
            name="checker_type",
            field=models.CharField(default="standard", max_length=32),
        ),
        migrations.AddField(
            model_name="problem",
            name="checker_code",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="problem",
            name="checker_language",
            field=models.CharField(default="python", max_length=32),
        ),
        migrations.AddField(
            model_name="contest",
            name="access_type",
            field=models.CharField(default="public", max_length=16),
        ),
        migrations.AddField(
            model_name="contest",
            name="allow_virtual",
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name="ContestRegistration",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("username", models.CharField(max_length=150)),
                ("registered_at", models.DateTimeField(auto_now_add=True)),
                ("contest", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="registrations", to="judge.contest")),
            ],
            options={"ordering": ["contest_id", "username"], "unique_together": {("contest", "username")}},
        ),
    ]
