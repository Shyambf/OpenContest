from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("judge", "0004_contest_access_checker_registration"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="queue_attempted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="queue_attempts",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
