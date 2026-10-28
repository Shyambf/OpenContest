from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("judge", "0007_submission_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="running_started_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
