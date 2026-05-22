import json

import pika
from django.conf import settings
from django.utils import timezone


def publish_submission(submission):
    tests = [
        {
            "id": test.id,
            "input": test.input,
            "output": test.output,
            "is_sample": test.is_sample,
        }
        for test in submission.problem.samples.order_by("id")
    ]
    payload = {
        "submission_id": submission.id,
        "contest_id": submission.contest_id,
        "problem_id": submission.problem_id,
        "language": submission.language,
        "source_code": submission.source_code,
        "time_limit_ms": submission.problem.time_limit_ms,
        "memory_limit_mb": submission.problem.memory_limit_mb,
        "checker_type": submission.problem.checker_type,
        "checker_code": submission.problem.checker_code,
        "checker_language": submission.problem.checker_language,
        "tests": tests,
    }
    connection = pika.BlockingConnection(pika.URLParameters(settings.RABBITMQ_URL))
    channel = connection.channel()
    channel.queue_declare(queue=settings.JUDGE_QUEUE, durable=True)
    channel.basic_publish(
        exchange="",
        routing_key=settings.JUDGE_QUEUE,
        body=json.dumps(payload).encode("utf-8"),
        properties=pika.BasicProperties(delivery_mode=2, content_type="application/json"),
    )
    connection.close()
    submission.queue_attempted_at = timezone.now()
    submission.queue_attempts += 1
    submission.save(update_fields=["queue_attempted_at", "queue_attempts"])
