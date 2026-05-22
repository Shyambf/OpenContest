from datetime import timedelta

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.utils import timezone

from judge.models import Clarification, Contest, ContestProblem, ContestRegistration, Problem, SampleTest, Submission
from judge.standings import recompute_contest_standings


SEEDED_USERS = {
    "admin": {"password": "admin123", "email": "admin@opencontest.local", "is_staff": True, "is_superuser": True},
    "coder": {"password": "coder123", "email": "coder@opencontest.local"},
    "tourist": {"password": "coder123", "email": "tourist@opencontest.local"},
    "jiangly": {"password": "coder123", "email": "jiangly@opencontest.local"},
    "Benq": {"password": "coder123", "email": "benq@opencontest.local"},
    "Um_nik": {"password": "coder123", "email": "umnik@opencontest.local"},
    "ecnerwala": {"password": "coder123", "email": "ecnerwala@opencontest.local"},
    "algo_master": {"password": "coder123", "email": "algo@opencontest.local"},
    "newbie_2024": {"password": "coder123", "email": "newbie@opencontest.local"},
}

SEEDED_RATINGS = {
    "tourist": 3821,
    "jiangly": 3765,
    "Benq": 3543,
    "Um_nik": 3456,
    "ecnerwala": 3398,
    "coder": 1420,
    "algo_master": 1760,
    "newbie_2024": 980,
}


class Command(BaseCommand):
    help = "Seed realistic development data: users, contests, problems, tests, submissions, standings and clarifications."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing contest data before seeding.",
        )

    def handle(self, *args, **options):
        if options["reset"]:
            Clarification.objects.all().delete()
            Submission.objects.all().delete()
            Contest.objects.all().delete()
            Problem.objects.all().delete()

        self._ensure_users()
        problems = self._ensure_problems()
        contests = self._ensure_contests(problems)
        self._ensure_registrations(contests)
        self._ensure_submissions(contests)
        self._ensure_clarifications(contests, problems)

        self.stdout.write(self.style.SUCCESS("Seed data is ready."))

    def _ensure_users(self):
        for username, data in SEEDED_USERS.items():
            user, _ = User.objects.get_or_create(username=username, defaults={"email": data["email"]})
            user.email = data["email"]
            user.is_staff = data.get("is_staff", False)
            user.is_superuser = data.get("is_superuser", False)
            user.set_password(data["password"])
            user.save()

    def _ensure_problems(self):
        definitions = [
            {
                "slug": "maximum-subarray-sum",
                "name": "Maximum Subarray Sum",
                "difficulty": "Easy",
                "tags": ["dp", "arrays"],
                "statement": (
                    "Given an array of n integers, find the maximum sum of a contiguous subarray. "
                    "If all numbers are negative, the answer is the largest single element."
                ),
                "input_format": "The first line contains n. The second line contains n integers.",
                "output_format": "Print one integer: the maximum subarray sum.",
                "note": "Kadane's algorithm solves the task in linear time.",
                "samples": [
                    ("8\n-1 3 -2 5 3 -5 2 2\n", "9\n", True),
                    ("4\n-1 -2 -3 -4\n", "-1\n", True),
                    ("5\n1 2 3 4 5\n", "15\n", False),
                    ("3\n-5 -2 -7\n", "-2\n", False),
                ],
            },
            {
                "slug": "two-integers",
                "name": "Two Integers",
                "difficulty": "Easy",
                "tags": ["implementation"],
                "statement": "Read two integers a and b and print their sum.",
                "input_format": "A single line contains integers a and b.",
                "output_format": "Print a + b.",
                "samples": [
                    ("1 2\n", "3\n", True),
                    ("-10 25\n", "15\n", True),
                    ("1000000000 1000000000\n", "2000000000\n", False),
                ],
            },
            {
                "slug": "balanced-brackets",
                "name": "Balanced Brackets",
                "difficulty": "Medium",
                "tags": ["stack", "strings"],
                "statement": "Given a bracket string containing (), [] and {}, decide whether it is balanced.",
                "input_format": "The first line contains a string s.",
                "output_format": "Print YES if s is balanced, otherwise print NO.",
                "samples": [
                    ("([]{})\n", "YES\n", True),
                    ("([)]\n", "NO\n", True),
                    ("{[()()]}\n", "YES\n", False),
                    ("((())\n", "NO\n", False),
                ],
            },
            {
                "slug": "shortest-path",
                "name": "Shortest Path",
                "difficulty": "Medium",
                "tags": ["graphs", "bfs"],
                "statement": "Find the length of the shortest path between two vertices in an undirected unweighted graph.",
                "input_format": "n m, then m edges u v, then s t. Vertices are numbered from 1 to n.",
                "output_format": "Print the shortest distance, or -1 if t is unreachable from s.",
                "samples": [
                    ("4 4\n1 2\n2 3\n3 4\n1 4\n1 3\n", "2\n", True),
                    ("5 2\n1 2\n4 5\n1 5\n", "-1\n", True),
                    ("6 5\n1 2\n2 3\n3 6\n1 4\n4 5\n1 6\n", "3\n", False),
                ],
            },
            {
                "slug": "modulo-fibonacci",
                "name": "Modulo Fibonacci",
                "difficulty": "Hard",
                "tags": ["math", "dp"],
                "statement": "Given n, print the nth Fibonacci number modulo 1,000,000,007. F0 = 0, F1 = 1.",
                "input_format": "The first line contains n.",
                "output_format": "Print Fn modulo 1,000,000,007.",
                "samples": [
                    ("0\n", "0\n", True),
                    ("10\n", "55\n", True),
                    ("50\n", "586268941\n", False),
                ],
            },
            {
                "slug": "grid-paths",
                "name": "Grid Paths",
                "difficulty": "Hard",
                "tags": ["dp", "grids"],
                "statement": (
                    "Count paths from the top-left cell to the bottom-right cell in a grid. "
                    "You may move only right or down. Cells marked # are blocked."
                ),
                "input_format": "h w, followed by h lines of the grid.",
                "output_format": "Print the number of paths modulo 1,000,000,007.",
                "samples": [
                    ("3 3\n...\n.#.\n...\n", "2\n", True),
                    ("2 2\n.#\n..\n", "1\n", True),
                    ("4 4\n....\n.##.\n....\n...#\n", "0\n", False),
                ],
            },
            {
                "slug": "average-value",
                "name": "Average Value",
                "difficulty": "Easy",
                "tags": ["floating-point", "checker"],
                "statement": "Read n numbers and print their arithmetic mean. Answers within 1e-6 are accepted.",
                "input_format": "n, then n real numbers.",
                "output_format": "Print the average value.",
                "checker_type": "custom",
                "checker_code": (
                    "def check(input_data, output_data, answer_data):\n"
                    "    try:\n"
                    "        return abs(float(output_data.strip()) - float(answer_data.strip())) <= 1e-6\n"
                    "    except ValueError:\n"
                    "        return False\n"
                ),
                "samples": [
                    ("3\n1 2 2\n", "1.6666666667\n", True),
                    ("4\n0 0 10 10\n", "5\n", False),
                ],
            },
        ]

        result = {}
        for item in definitions:
            samples = item.pop("samples")
            defaults = {
                "name": item["name"],
                "difficulty": item["difficulty"],
                "tags": item["tags"],
                "statement": item["statement"],
                "input_format": item["input_format"],
                "output_format": item["output_format"],
                "note": item.get("note", ""),
                "checker_type": item.get("checker_type", "standard"),
                "checker_code": item.get("checker_code", ""),
                "checker_language": item.get("checker_language", "python"),
                "time_limit_ms": item.get("time_limit_ms", 1000),
                "memory_limit_mb": item.get("memory_limit_mb", 256),
            }
            problem, _ = Problem.objects.update_or_create(slug=item["slug"], defaults=defaults)
            problem.samples.all().delete()
            SampleTest.objects.bulk_create(
                [
                    SampleTest(problem=problem, input=test_input, output=test_output, is_sample=is_sample)
                    for test_input, test_output, is_sample in samples
                ]
            )
            result[item["slug"]] = problem
        return result

    def _ensure_contests(self, problems):
        now = timezone.now()
        specs = [
            {
                "id": "round-892",
                "title": "OpenContest Round #892 (Div. 2)",
                "start_time": now - timedelta(minutes=40),
                "duration_minutes": 120,
                "status": "live",
                "problem_slugs": ["maximum-subarray-sum", "two-integers", "balanced-brackets", "shortest-path"],
            },
            {
                "id": "edu-round-162",
                "title": "Educational OpenContest Round 162",
                "start_time": now + timedelta(days=1),
                "duration_minutes": 135,
                "status": "upcoming",
                "allow_virtual": True,
                "problem_slugs": ["two-integers", "balanced-brackets", "shortest-path", "modulo-fibonacci"],
            },
            {
                "id": "global-round-25",
                "title": "OpenContest Global Round 25",
                "start_time": now + timedelta(days=2),
                "duration_minutes": 150,
                "status": "upcoming",
                "problem_slugs": ["maximum-subarray-sum", "shortest-path", "modulo-fibonacci", "grid-paths"],
            },
            {
                "id": "round-891",
                "title": "OpenContest Round #891 (Div. 3)",
                "start_time": now - timedelta(days=1),
                "duration_minutes": 135,
                "status": "finished",
                "problem_slugs": [
                    "two-integers",
                    "maximum-subarray-sum",
                    "balanced-brackets",
                    "shortest-path",
                    "modulo-fibonacci",
                    "grid-paths",
                ],
            },
            {
                "id": "gym-101",
                "title": "Introduction to Dynamic Programming",
                "start_time": now,
                "duration_minutes": 0,
                "status": "finished",
                "is_gym": True,
                "author": "OpenContest Academy",
                "difficulty": "Easy",
                "problem_slugs": ["maximum-subarray-sum", "modulo-fibonacci", "grid-paths"],
            },
            {
                "id": "gym-102",
                "title": "Graph Theory Essentials",
                "start_time": now,
                "duration_minutes": 0,
                "status": "finished",
                "is_gym": True,
                "author": "OpenContest Academy",
                "difficulty": "Medium",
                "problem_slugs": ["shortest-path", "balanced-brackets"],
            },
            {
                "id": "gym-103",
                "title": "Custom Checker Practice",
                "start_time": now,
                "duration_minutes": 0,
                "status": "finished",
                "is_gym": True,
                "author": "OpenContest Academy",
                "difficulty": "Easy",
                "problem_slugs": ["average-value"],
            },
        ]

        contests = {}
        for spec in specs:
            problem_slugs = spec.pop("problem_slugs")
            contest, _ = Contest.objects.update_or_create(
                id=spec["id"],
                defaults={
                    "title": spec["title"],
                    "start_time": spec["start_time"],
                    "duration_minutes": spec["duration_minutes"],
                    "status": spec["status"],
                    "access_type": spec.get("access_type", "public"),
                    "allow_virtual": spec.get("allow_virtual", False),
                    "is_gym": spec.get("is_gym", False),
                    "author": spec.get("author", ""),
                    "difficulty": spec.get("difficulty", ""),
                    "solved_by": 0,
                },
            )
            ContestProblem.objects.filter(contest=contest).delete()
            for index, slug in enumerate(problem_slugs):
                ContestProblem.objects.create(
                    contest=contest,
                    problem=problems[slug],
                    letter=chr(65 + index),
                    points=1000,
                )
            contests[contest.id] = contest
        return contests

    def _ensure_registrations(self, contests):
        participants = {
            "round-892": ["coder", "tourist", "jiangly", "algo_master", "newbie_2024"],
            "edu-round-162": ["coder", "algo_master", "newbie_2024"],
            "global-round-25": ["tourist", "jiangly", "Benq", "Um_nik", "ecnerwala"],
            "round-891": ["coder", "tourist", "jiangly", "Benq", "Um_nik", "ecnerwala"],
        }
        for contest_id, handles in participants.items():
            contest = contests[contest_id]
            ContestRegistration.objects.filter(contest=contest).delete()
            ContestRegistration.objects.bulk_create(
                [ContestRegistration(contest=contest, username=handle) for handle in handles]
            )
            contest.participants = len(handles)
            contest.save(update_fields=["participants"])

    def _ensure_submissions(self, contests):
        seeded_handles = list(SEEDED_USERS.keys())
        Submission.objects.filter(user__in=seeded_handles, contest_id__in=contests.keys()).delete()

        finished = contests["round-891"]
        live = contests["round-892"]
        gym = contests["gym-103"]

        finished_runs = [
            ("tourist", "A", "AC", 4),
            ("tourist", "B", "AC", 9),
            ("tourist", "C", "WA", 16),
            ("tourist", "C", "AC", 21),
            ("tourist", "D", "AC", 39),
            ("tourist", "E", "AC", 68),
            ("tourist", "F", "AC", 112),
            ("jiangly", "A", "AC", 5),
            ("jiangly", "B", "AC", 12),
            ("jiangly", "C", "AC", 25),
            ("jiangly", "D", "AC", 47),
            ("jiangly", "E", "AC", 91),
            ("jiangly", "F", "WA", 130),
            ("Benq", "A", "AC", 7),
            ("Benq", "B", "WA", 15),
            ("Benq", "B", "AC", 27),
            ("Benq", "C", "AC", 46),
            ("Benq", "D", "AC", 83),
            ("Um_nik", "A", "AC", 9),
            ("Um_nik", "B", "AC", 32),
            ("Um_nik", "C", "WA", 60),
            ("Um_nik", "D", "AC", 118),
            ("ecnerwala", "A", "AC", 11),
            ("ecnerwala", "B", "AC", 54),
            ("ecnerwala", "C", "WA", 100),
            ("coder", "A", "WA", 18),
            ("coder", "A", "AC", 31),
            ("coder", "B", "AC", 73),
        ]
        for handle, letter, verdict, minute in finished_runs:
            self._create_submission(finished, handle, letter, verdict, minute)

        live_runs = [
            ("coder", "A", "AC", 12),
            ("algo_master", "A", "WA", 14),
            ("algo_master", "A", "AC", 18),
            ("tourist", "A", "AC", 6),
            ("tourist", "B", "AC", 11),
            ("jiangly", "A", "AC", 8),
            ("newbie_2024", "A", "WA", 30),
        ]
        for handle, letter, verdict, minute in live_runs:
            self._create_submission(live, handle, letter, verdict, minute)

        self._create_submission(
            gym,
            "coder",
            "A",
            "AC",
            2,
            source_code="n = int(input())\nprint(sum(map(float, input().split())) / n)\n",
        )

        for contest in [finished, live, gym]:
            recompute_contest_standings(contest)
            for handle, rating in SEEDED_RATINGS.items():
                contest.standings.filter(handle=handle).update(rating=rating)

        gym.solved_by = Submission.objects.filter(contest=gym, status="AC").values("user").distinct().count()
        gym.save(update_fields=["solved_by"])

    def _create_submission(self, contest, handle, letter, verdict, minute, source_code=None):
        contest_problem = ContestProblem.objects.select_related("problem").get(contest=contest, letter=letter)
        submission = Submission.objects.create(
            user=handle,
            contest=contest,
            problem=contest_problem.problem,
            language="python",
            source_code=source_code or self._source_for(contest_problem.problem.slug, verdict),
            status=verdict,
            time_ms=42 + minute,
            memory_kb=2048 + minute,
            judge_output=f"Seeded {verdict}: judged against stored tests.",
        )
        Submission.objects.filter(pk=submission.pk).update(submitted_at=contest.start_time + timedelta(minutes=minute))

    def _source_for(self, slug, verdict):
        if verdict != "AC":
            return "print('wrong answer')\n"
        return {
            "two-integers": "a, b = map(int, input().split())\nprint(a + b)\n",
            "maximum-subarray-sum": (
                "n = int(input())\narr = list(map(int, input().split()))\n"
                "best = cur = arr[0]\n"
                "for x in arr[1:]:\n    cur = max(x, cur + x)\n    best = max(best, cur)\n"
                "print(best)\n"
            ),
            "balanced-brackets": (
                "s = input().strip()\nst = []\npairs = {')':'(', ']':'[', '}':'{'}\n"
                "ok = True\nfor ch in s:\n"
                "    if ch in '([{': st.append(ch)\n"
                "    elif not st or st.pop() != pairs[ch]: ok = False; break\n"
                "print('YES' if ok and not st else 'NO')\n"
            ),
            "shortest-path": (
                "from collections import deque\n"
                "n, m = map(int, input().split())\n"
                "g = [[] for _ in range(n + 1)]\n"
                "for _ in range(m):\n"
                "    u, v = map(int, input().split())\n"
                "    g[u].append(v); g[v].append(u)\n"
                "s, t = map(int, input().split())\n"
                "dist = [-1] * (n + 1)\n"
                "dist[s] = 0\n"
                "q = deque([s])\n"
                "while q:\n"
                "    v = q.popleft()\n"
                "    for to in g[v]:\n"
                "        if dist[to] == -1:\n"
                "            dist[to] = dist[v] + 1\n"
                "            q.append(to)\n"
                "print(dist[t])\n"
            ),
            "modulo-fibonacci": (
                "MOD = 1000000007\n"
                "n = int(input())\n"
                "a, b = 0, 1\n"
                "for _ in range(n):\n"
                "    a, b = b, (a + b) % MOD\n"
                "print(a)\n"
            ),
            "grid-paths": (
                "MOD = 1000000007\n"
                "h, w = map(int, input().split())\n"
                "grid = [input().strip() for _ in range(h)]\n"
                "dp = [[0] * w for _ in range(h)]\n"
                "if grid[0][0] == '.': dp[0][0] = 1\n"
                "for i in range(h):\n"
                "    for j in range(w):\n"
                "        if grid[i][j] == '#':\n"
                "            dp[i][j] = 0\n"
                "            continue\n"
                "        if i: dp[i][j] = (dp[i][j] + dp[i-1][j]) % MOD\n"
                "        if j: dp[i][j] = (dp[i][j] + dp[i][j-1]) % MOD\n"
                "print(dp[-1][-1])\n"
            ),
            "average-value": "n = int(input())\nprint(sum(map(float, input().split())) / n)\n",
        }.get(slug, "print('ok')\n")

    def _ensure_clarifications(self, contests, problems):
        Clarification.objects.filter(user__in=SEEDED_USERS.keys(), contest_id__in=contests.keys()).delete()
        Clarification.objects.bulk_create(
            [
                Clarification(
                    user="coder",
                    contest=contests["round-892"],
                    problem=problems["maximum-subarray-sum"],
                    question="Are empty subarrays allowed?",
                    status="pending",
                ),
                Clarification(
                    user="algo_master",
                    contest=contests["round-892"],
                    problem=problems["shortest-path"],
                    question="Can there be multiple edges between the same vertices?",
                    reply="Yes. Multiple edges can appear; they do not change the shortest path definition.",
                    status="replied",
                ),
                Clarification(
                    user="newbie_2024",
                    contest=contests["round-892"],
                    problem=problems["balanced-brackets"],
                    question="Should whitespace inside the bracket string be ignored?",
                    reply="Announcement: bracket strings contain only bracket characters, no whitespace.",
                    status="broadcast",
                ),
            ]
        )
