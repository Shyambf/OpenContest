import concurrent.futures
from datetime import datetime, timezone
import itertools
import os
import random
import sys

import requests


BASE_URL = os.getenv("OPENCONTEST_API_URL", "http://localhost:8000/api")
USERNAME = os.getenv("OPENCONTEST_LOAD_USER", "coder")
PASSWORD = os.getenv("OPENCONTEST_LOAD_PASSWORD", "coder123")
ADMIN_USERNAME = os.getenv("OPENCONTEST_LOAD_ADMIN_USER", "admin")
ADMIN_PASSWORD = os.getenv("OPENCONTEST_LOAD_ADMIN_PASSWORD", "admin123")
CONTEST_ID = os.getenv("OPENCONTEST_LOAD_CONTEST", "runner-load")
PROBLEM_LETTER = os.getenv("OPENCONTEST_LOAD_PROBLEM", "A")
NUM_SUBMISSIONS = int(os.getenv("OPENCONTEST_LOAD_COUNT", "1000"))
MAX_WORKERS = int(os.getenv("OPENCONTEST_LOAD_WORKERS", "25"))
WRONG_RATE = float(os.getenv("OPENCONTEST_LOAD_WRONG_RATE", "0.0"))
LANGUAGE = os.getenv("OPENCONTEST_LOAD_LANGUAGE", "python")
BURN_SECONDS = float(os.getenv("OPENCONTEST_LOAD_BURN_SECONDS", "5"))
PREPARE_LOAD_CONTEST = os.getenv("OPENCONTEST_LOAD_PREPARE", "1") == "1"
LOAD_PROBLEM_SLUG = "runner-load-sum"


BURN_SOURCE = (
    "import time\n"
    f"deadline = time.monotonic() + {BURN_SECONDS!r}\n"
    "x = 0\n"
    "while time.monotonic() < deadline:\n"
    "    x = (x * 1664525 + 1013904223) & 0xffffffff\n"
    "a, b = map(int, input().split())\n"
    "print(a + b)\n"
)


BURN_WRONG_SOURCE = (
    "import time\n"
    f"time.sleep({BURN_SECONDS!r})\n"
    "a, b = map(int, input().split())\n"
    "print(a - b)\n"
)


SOLUTIONS = {
    "A": {
        "name": "Maximum Subarray Sum",
        "ac": {
            "python": (
                "n = int(input())\n"
                "arr = list(map(int, input().split()))\n"
                "best = cur = arr[0]\n"
                "for x in arr[1:]:\n"
                "    cur = max(x, cur + x)\n"
                "    best = max(best, cur)\n"
                "print(best)\n"
            ),
            "cpp": (
                "#include <bits/stdc++.h>\n"
                "using namespace std;\n"
                "int main(){\n"
                "    ios::sync_with_stdio(false); cin.tie(nullptr);\n"
                "    int n; cin >> n;\n"
                "    long long best, cur, x;\n"
                "    cin >> x; best = cur = x;\n"
                "    for(int i = 1; i < n; ++i){\n"
                "        cin >> x;\n"
                "        cur = max(x, cur + x);\n"
                "        best = max(best, cur);\n"
                "    }\n"
                "    cout << best << '\\n';\n"
                "}\n"
            ),
        },
        "wa": "print(0)\n",
    },
    "B": {
        "name": "Two Integers",
        "ac": {
            "python": "a, b = map(int, input().split())\nprint(a + b)\n",
            "cpp": (
                "#include <bits/stdc++.h>\n"
                "using namespace std;\n"
                "int main(){ long long a,b; cin >> a >> b; cout << a + b << '\\n'; }\n"
            ),
        },
        "wa": "a, b = map(int, input().split())\nprint(a - b)\n",
    },
    "C": {
        "name": "Balanced Brackets",
        "ac": {
            "python": (
                "s = input().strip()\n"
                "stack = []\n"
                "pairs = {')': '(', ']': '[', '}': '{'}\n"
                "ok = True\n"
                "for ch in s:\n"
                "    if ch in '([{':\n"
                "        stack.append(ch)\n"
                "    elif not stack or stack.pop() != pairs[ch]:\n"
                "        ok = False\n"
                "        break\n"
                "print('YES' if ok and not stack else 'NO')\n"
            ),
        },
        "wa": "print('YES')\n",
    },
    "D": {
        "name": "Shortest Path",
        "ac": {
            "python": (
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
        },
        "wa": "print(-1)\n",
    },
}


def login(username, password):
    response = requests.post(
        f"{BASE_URL}/auth/login/",
        json={"username": username, "password": password},
        timeout=15,
    )
    if response.status_code != 200:
        raise RuntimeError(f"Login failed for {username}: {response.status_code} {response.text}")
    return response.json()["token"]


def api_request(method, path, token, **kwargs):
    headers = kwargs.pop("headers", {})
    headers["Authorization"] = f"Token {token}"
    response = requests.request(method, f"{BASE_URL}{path}", headers=headers, timeout=20, **kwargs)
    if response.status_code >= 400:
        raise RuntimeError(f"{method} {path} failed: {response.status_code} {response.text}")
    return response.json()


def ensure_load_target():
    if not PREPARE_LOAD_CONTEST or CONTEST_ID != "runner-load":
        return

    print("Preparing runner-load contest with a 7s time limit problem...")
    admin_token = login(ADMIN_USERNAME, ADMIN_PASSWORD)

    problems = api_request("GET", "/problems/", admin_token)
    problem = next((item for item in problems if item["slug"] == LOAD_PROBLEM_SLUG), None)
    if problem is None:
        problem = api_request(
            "POST",
            "/problems/",
            admin_token,
            json={
                "slug": LOAD_PROBLEM_SLUG,
                "name": "Runner Load Sum",
                "difficulty": "Easy",
                "tags": ["load-test", "implementation"],
                "statement": "Read two integers and print their sum. Load-test solutions intentionally burn CPU first.",
                "input_format": "A single line contains integers a and b.",
                "output_format": "Print a + b.",
                "note": "This problem is generated by scripts/load_test.py for runner load testing.",
                "checker_type": "standard",
                "checker_code": "",
                "checker_language": "python",
                "time_limit_ms": 7000,
                "memory_limit_mb": 256,
                "samples": [{"input": "1 2\n", "output": "3\n", "isSample": True}],
            },
        )
        print(f"Created problem #{problem['id']} {LOAD_PROBLEM_SLUG}.")

    contests = api_request("GET", "/contests/", admin_token)
    if any(item["id"] == CONTEST_ID for item in contests):
        return

    api_request(
        "POST",
        "/contests/",
        admin_token,
        json={
            "id": CONTEST_ID,
            "title": "runner-load",
            "start_time": datetime.now(timezone.utc).isoformat(),
            "duration_minutes": 180,
            "status": "live",
            "access_type": "public",
            "allow_virtual": False,
            "is_gym": False,
            "author": "OpenContest Load Test",
            "difficulty": "Easy",
            "problem_ids": [problem["id"]],
        },
    )
    print("Created runner-load contest.")


def source_for(index):
    if CONTEST_ID == "runner-load":
        if LANGUAGE != "python":
            raise ValueError("runner-load burn source currently supports python only.")
        use_wrong = random.random() < WRONG_RATE
        source = BURN_WRONG_SOURCE if use_wrong else BURN_SOURCE
        return f"# Runner burn load-test submission {index}\n{source}", "WA" if use_wrong else "AC"

    problem = SOLUTIONS.get(PROBLEM_LETTER.upper())
    if not problem:
        raise ValueError(f"No built-in source for problem letter {PROBLEM_LETTER!r}.")

    use_wrong = random.random() < WRONG_RATE
    if use_wrong:
        return problem["wa"], "WA"

    language_sources = problem["ac"]
    if LANGUAGE not in language_sources:
        available = ", ".join(sorted(language_sources))
        raise ValueError(f"Problem {PROBLEM_LETTER} has no {LANGUAGE} solution. Available: {available}.")

    source = language_sources[LANGUAGE]
    return f"# Load-test submission {index}\n{source}" if LANGUAGE == "python" else source, "AC"


def submit_solution(token, index):
    try:
        source_code, expected = source_for(index)
    except ValueError as exc:
        print(f"[{index}] config error: {exc}")
        return False

    payload = {
        "contest_id": CONTEST_ID,
        "problem_letter": PROBLEM_LETTER,
        "language": LANGUAGE,
        "source_code": source_code,
    }
    headers = {"Authorization": f"Token {token}"}

    try:
        response = requests.post(f"{BASE_URL}/submissions/", json=payload, headers=headers, timeout=15)
        if response.status_code == 201:
            submission_id = response.json()["id"]
            print(f"[{index}] sent: submission #{submission_id}, expected={expected}")
            return True
        print(f"[{index}] failed: {response.status_code} {response.text}")
    except Exception as exc:
        print(f"[{index}] error: {exc}")
    return False


def main():
    if CONTEST_ID == "runner-load" and BURN_SECONDS >= 6.5:
        print("OPENCONTEST_LOAD_BURN_SECONDS must stay below the generated 7s time limit.")
        return 1

    try:
        ensure_load_target()
    except Exception as exc:
        print(f"Could not prepare load contest: {exc}")
        return 1

    print(f"Logging in as {USERNAME} at {BASE_URL}...")
    try:
        token = login(USERNAME, PASSWORD)
    except Exception as exc:
        print(f"Could not connect to backend: {exc}")
        print("Make sure OpenContest is running and backend is available.")
        return 1

    problem = "Runner Load Sum" if CONTEST_ID == "runner-load" else SOLUTIONS.get(PROBLEM_LETTER.upper(), {}).get("name", "custom problem")
    print(
        "Creating realistic runner load: "
        f"{NUM_SUBMISSIONS} submissions, contest={CONTEST_ID}, problem={PROBLEM_LETTER} ({problem}), "
        f"language={LANGUAGE}, burn={BURN_SECONDS}s, wrong_rate={WRONG_RATE:.0%}, workers={MAX_WORKERS}"
    )

    sent = 0
    indexes = itertools.count()
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(submit_solution, token, next(indexes)) for _ in range(NUM_SUBMISSIONS)]
        for future in concurrent.futures.as_completed(futures):
            sent += 1 if future.result() else 0

    print(f"\nLoad created: {sent}/{NUM_SUBMISSIONS} submissions accepted.")
    print("Open Admin Dashboard and watch runner pods/queue in real time.")
    return 0 if sent == NUM_SUBMISSIONS else 1


if __name__ == "__main__":
    sys.exit(main())
