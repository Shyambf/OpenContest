from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.authtoken.models import Token
from io import BytesIO
import json
import zipfile

from .models import Clarification, Contest, ContestProblem, Problem, SampleTest, Submission


class AdminApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("admin", password="admin123", is_staff=True)
        self.coder = User.objects.create_user("coder", password="coder123")
        self.admin_token = Token.objects.create(user=self.admin)
        self.problem = Problem.objects.create(
            slug="sum",
            name="Sum",
            difficulty="Easy",
            statement="Read two integers and print their sum.",
            input_format="a b",
            output_format="a+b",
        )
        SampleTest.objects.create(problem=self.problem, input="1 2", output="3", is_sample=True)
        self.contest = Contest.objects.create(
            id="round-test",
            title="Round Test",
            start_time=timezone.now(),
            duration_minutes=120,
            status="live",
        )
        ContestProblem.objects.create(contest=self.contest, problem=self.problem, letter="A")
        self.submission = Submission.objects.create(
            user="coder",
            contest=self.contest,
            problem=self.problem,
            language="python",
            source_code="print(3)",
            status="Pending",
        )

    def auth(self):
        return {"HTTP_AUTHORIZATION": f"Token {self.admin_token.key}"}

    def test_public_second_admin_registration_is_rejected(self):
        response = self.client.post(
            "/api/auth/register/",
            data={
                "username": "another-admin",
                "email": "admin@example.test",
                "password": "admin123",
                "role": "admin",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(username="another-admin").exists())

    def test_admin_summary_returns_real_counts(self):
        response = self.client.get("/api/admin/summary/", **self.auth())

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["activeContests"], 1)
        self.assertEqual(payload["totalProblems"], 1)
        self.assertEqual(payload["registeredUsers"], 2)
        self.assertEqual(payload["totalSubmissions"], 1)
        self.assertEqual(len(payload["recentActivity"]), 1)

    def test_admin_can_override_submission_verdict(self):
        response = self.client.post(
            f"/api/submissions/{self.submission.id}/override/",
            data={"status": "AC", "time_ms": 12, "judge_output": "Manual AC"},
            content_type="application/json",
            **self.auth(),
        )

        self.assertEqual(response.status_code, 200)
        self.submission.refresh_from_db()
        self.assertEqual(self.submission.status, "AC")
        self.assertEqual(self.submission.time_ms, 12)
        self.assertEqual(self.contest.standings.count(), 1)

    def test_admin_can_update_contest_problems(self):
        second_problem = Problem.objects.create(
            slug="brackets",
            name="Brackets",
            difficulty="Medium",
            statement="Check brackets.",
            input_format="s",
            output_format="YES/NO",
        )

        response = self.client.put(
            f"/api/contests/{self.contest.id}/",
            data={
                "title": "Updated Round",
                "start_time": timezone.now().isoformat(),
                "duration_minutes": 90,
                "status": "upcoming",
                "access_type": "private",
                "allow_virtual": True,
                "problem_ids": [second_problem.id],
            },
            content_type="application/json",
            **self.auth(),
        )

        self.assertEqual(response.status_code, 200)
        self.contest.refresh_from_db()
        self.assertEqual(self.contest.title, "Updated Round")
        self.assertEqual(self.contest.access_type, "private")
        self.assertTrue(self.contest.allow_virtual)
        letters = list(ContestProblem.objects.filter(contest=self.contest).values_list("letter", "problem_id"))
        self.assertEqual(letters, [("A", second_problem.id)])

    def test_problem_archive_import_creates_problem_and_tests(self):
        archive_buffer = BytesIO()
        with zipfile.ZipFile(archive_buffer, "w") as archive:
            archive.writestr(
                "problem.json",
                json.dumps(
                    {
                        "name": "Imported Sum",
                        "slug": "imported-sum",
                        "difficulty": "Easy",
                        "tags": ["math"],
                        "statement": "Read two integers and print the sum.",
                    }
                ),
            )
            archive.writestr("data/sample/1.in", "2 5\n")
            archive.writestr("data/sample/1.ans", "7\n")
            archive.writestr("data/secret/2.in", "-1 10\n")
            archive.writestr("data/secret/2.out", "9\n")

        upload = SimpleUploadedFile("sum.zip", archive_buffer.getvalue(), content_type="application/zip")
        response = self.client.post("/api/problems/import-archive/", data={"archive": upload}, **self.auth())

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["testsImported"], 2)
        problem = Problem.objects.get(slug="imported-sum")
        self.assertEqual(problem.samples.count(), 2)
        self.assertEqual(problem.samples.filter(is_sample=True).count(), 1)

    def test_admin_can_generate_tests_from_python_script(self):
        response = self.client.post(
            "/api/problems/generate-tests/",
            data={
                "code": (
                    "for i in range(3):\n"
                    "    print(f'{i} {i + 1}')\n"
                    "    print('---')\n"
                    "    print(i + i + 1)\n"
                    "    if i != 2:\n"
                    "        print('===')\n"
                )
            },
            content_type="application/json",
            **self.auth(),
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload["tests"]), 3)
        self.assertEqual(payload["tests"][0], {"input": "0 1", "output": "1", "isSample": True})
        self.assertEqual(payload["tests"][2], {"input": "2 3", "output": "5", "isSample": False})

    def test_generator_requires_admin(self):
        response = self.client.post(
            "/api/problems/generate-tests/",
            data={"code": "print('1 2')\nprint('---')\nprint('3')"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 401)

    def test_admin_can_reply_to_clarification(self):
        clarification = Clarification.objects.create(
            user="coder",
            contest=self.contest,
            problem=self.problem,
            question="Can n be zero?",
        )

        response = self.client.put(
            f"/api/clarifications/{clarification.id}/",
            data={"reply": "No, n is at least one.", "status": "replied"},
            content_type="application/json",
            **self.auth(),
        )

        self.assertEqual(response.status_code, 200)
        clarification.refresh_from_db()
        self.assertEqual(clarification.status, "replied")
        self.assertEqual(clarification.reply, "No, n is at least one.")

    def test_profile_uses_real_submissions(self):
        response = self.client.get("/api/profiles/coder/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["username"], "coder")
        self.assertEqual(payload["problemsSolved"], 0)
        self.assertEqual(payload["contestsAttended"], 1)
        self.assertEqual(len(payload["recentSubmissions"]), 1)
