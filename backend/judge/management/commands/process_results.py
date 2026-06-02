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

        connection = pika.BlockingConnection(pika.URLParameters(settings.RABBITMQ_URL))
        channel = connection.channel()
        
        results_queue = getattr(settings, "JUDGE_RESULTS_QUEUE", "judge.results")
        channel.queue_declare(queue=results_queue, durable=True)
        
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

        channel.basic_consume(queue=results_queue, on_message_callback=callback)
        
        try:
            channel.start_consuming()
        except KeyboardInterrupt:
            channel.stop_consuming()
        connection.close()

    def process_submission_result(self, submission_id, payload):
        try:
            submission = Submission.objects.get(id=submission_id)
            for key, value in payload.items():
                setattr(submission, key, value)
            
            submission.save(update_fields=list(payload.keys()))
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
