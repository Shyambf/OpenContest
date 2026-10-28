import json
import time
import pika
from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone
from judge.models import Submission
from judge.standings import recompute_contest_standings, FINAL_STATUSES

class Command(BaseCommand):
    help = "Consume judge results from RabbitMQ and update submissions."

    def handle(self, *args, **options):
        self.stdout.write("Starting result consumer...")

        # Нам нужно отслеживать, какие контесты требуют пересчета
        self.pending_standings_updates = set()
        self.last_standings_update = time.time()
        self.update_interval = 5  # Пересчитывать не чаще чем раз в 5 секунд

        results_queue = getattr(settings, "JUDGE_RESULTS_QUEUE", "judge.results")

        def callback(ch, method, properties, body):
            try:
                data = json.loads(body)
                submission_id = data["submission_id"]
                payload = data["payload"]

                self.process_submission_result(submission_id, payload)
                ch.basic_ack(delivery_tag=method.delivery_tag)

                # Проверяем, не пора ли пересчитать таблицу лидеров
                self.check_standings_updates()

            except Exception as e:
                self.stderr.write(f"Error processing result: {e}")
                # В случае ошибки не подтверждаем сообщение, чтобы оно вернулось в очередь
                # Но только если это не ошибка формата данных
                if not isinstance(e, json.JSONDecodeError):
                    time.sleep(1)  # Защита от бесконечного цикла ошибок

        while True:
            try:
                connection = pika.BlockingConnection(pika.URLParameters(settings.RABBITMQ_URL))
                channel = connection.channel()
                channel.queue_declare(queue=results_queue, durable=True)
                channel.basic_consume(queue=results_queue, on_message_callback=callback)
                self.stdout.write(f"Listening for judge results on {results_queue}...")
                channel.start_consuming()
            except pika.exceptions.AMQPConnectionError as e:
                self.stderr.write(f"RabbitMQ connection error: {e}. Retrying in 5s...")
                time.sleep(5)
            except KeyboardInterrupt:
                self.stdout.write("Stopping result consumer...")
                break
            except Exception as e:
                self.stderr.write(f"Unexpected error in result consumer: {e}. Retrying in 5s...")
                time.sleep(5)

    def process_submission_result(self, submission_id, payload):
        try:
            submission = Submission.objects.get(id=submission_id)
            update_fields = list(payload.keys())
            for key, value in payload.items():
                setattr(submission, key, value)

            if payload.get("status") == "Running" and not submission.running_started_at:
                submission.running_started_at = timezone.now()
                update_fields.append("running_started_at")

            submission.save(update_fields=update_fields)
            self.stdout.write(f"Updated submission {submission_id}: {submission.status}")
            
            if submission.status in FINAL_STATUSES:
                self.pending_standings_updates.add(submission.contest_id)
                
        except Submission.DoesNotExist:
            self.stderr.write(f"Submission {submission_id} not found")

    def check_standings_updates(self, force=False):
        now = time.time()
        if (force or (now - self.last_standings_update >= self.update_interval)) and self.pending_standings_updates:
            contests_to_update = list(self.pending_standings_updates)
            self.pending_standings_updates.clear()
            self.last_standings_update = now
            
            for contest_id in contests_to_update:
                from judge.models import Contest
                try:
                    contest = Contest.objects.get(id=contest_id)
                    self.stdout.write(f"Recomputing standings for contest {contest_id}...")
                    recompute_contest_standings(contest)
                except Contest.DoesNotExist:
                    pass
