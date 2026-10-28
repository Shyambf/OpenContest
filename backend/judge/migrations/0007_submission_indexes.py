from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("judge", "0006_clarification"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="submission",
            options={"ordering": ["-submitted_at"]},
        ),
        migrations.AddIndex(
            model_name="submission",
            index=models.Index(fields=["contest", "user", "status"], name="judge_submi_contest_4177eb_idx"),
        ),
        migrations.AddIndex(
            model_name="submission",
            index=models.Index(fields=["status"], name="judge_submi_status_2e4ec3_idx"),
        ),
        migrations.AddIndex(
            model_name="submission",
            index=models.Index(fields=["submitted_at"], name="judge_submi_submitt_fb1092_idx"),
        ),
    ]
