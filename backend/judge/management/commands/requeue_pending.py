from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

from judge.models import Submission
from judge.queue import publish_submission


class Command(BaseCommand):
    help = "Requeue submissions stuck in Pending or Running state."

    def add_arguments(self, parser):
        parser.add_argument(
            "--stale-minutes",
            type=int,
            default=2,
            help="Requeue Pending submissions only if they have never been published to RabbitMQ.",
        )
        parser.add_argument(
            "--running-stale-minutes",
            type=int,
            default=10,
            help="Requeue Running submissions older than this many minutes.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=500,
            help="Maximum number of submissions to requeue.",
        )
        parser.add_argument(
            "--loop",
            action="store_true",
            help="Run forever and periodically repair stuck submissions.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Requeue all Pending and Running submissions regardless of queue tracking.",
        )
        parser.add_argument(
            "--interval-seconds",
            type=int,
            default=30,
            help="Sleep interval when --loop is enabled.",
        )

    def handle(self, *args, **options):
        if options["loop"]:
            import time

            self.stdout.write("Starting stuck submission repair loop.")
            while True:
                self.requeue_once(options)
                time.sleep(options["interval_seconds"])
        else:
            self.requeue_once(options)

    def requeue_once(self, options):
        now = timezone.now()
        pending_cutoff = now - timedelta(minutes=options["stale_minutes"])
        running_cutoff = now - timedelta(minutes=options["running_stale_minutes"])

        qs = (
            Submission.objects.filter(status__in=["Pending", "Running"])
            .select_related("contest", "problem")
            .order_by("submitted_at")
        )

        stuck = []
        for submission in qs[: options["limit"]]:
            if options["force"]:
                stuck.append(submission)
                continue
            if submission.status == "Pending":
                if submission.queue_attempted_at is None or submission.queue_attempts == 0:
                    stuck.append(submission)
            elif submission.submitted_at <= running_cutoff:
                stuck.append(submission)

        if not stuck:
            self.stdout.write("No stuck submissions found.")
            return

        requeued = 0
        failed = 0
        for submission in stuck:
            submission.status = "Pending"
            submission.judge_output = "Requeued by maintenance command."
            submission.save(update_fields=["status", "judge_output"])
            try:
                publish_submission(submission)
            except Exception as exc:
                failed += 1
                self.stderr.write(f"Submission #{submission.id}: {exc}")
                continue
            requeued += 1

        self.stdout.write(self.style.SUCCESS(f"Requeued {requeued} submissions. Failed: {failed}."))
