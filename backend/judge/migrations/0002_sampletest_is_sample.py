from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("judge", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="sampletest",
            name="is_sample",
            field=models.BooleanField(default=True),
        ),
    ]
