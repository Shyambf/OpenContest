from .models import ContestProblem, StandingsRow, Submission


FINAL_STATUSES = {"AC", "WA", "TLE", "MLE", "RE", "CE"}


def recompute_contest_standings(contest):
    contest_problems = list(ContestProblem.objects.filter(contest=contest).select_related("problem").order_by("letter"))
    letters_by_problem_id = {item.problem_id: item.letter for item in contest_problems}
    points_by_letter = {item.letter: item.points for item in contest_problems}
    existing_ratings = {
        row.handle: row.rating
        for row in StandingsRow.objects.filter(contest=contest)
    }
    users = (
        Submission.objects.filter(contest=contest)
        .values_list("user", flat=True)
        .distinct()
    )

    rows = []
    for username in users:
        submissions = (
            Submission.objects.filter(contest=contest, user=username, status__in=FINAL_STATUSES)
            .order_by("submitted_at", "id")
        )
        problems = {
            item.letter: {"solved": False, "attempts": 0}
            for item in contest_problems
        }
        score = 0
        for submission in submissions:
            letter = letters_by_problem_id.get(submission.problem_id)
            if not letter:
                continue
            cell = problems[letter]
            if cell.get("solved"):
                continue
            cell["attempts"] = int(cell.get("attempts", 0)) + 1
            if submission.status == "AC":
                cell["solved"] = True
                cell["time"] = max(0, int((submission.submitted_at - contest.start_time).total_seconds() // 60))
                score += points_by_letter.get(letter, 1000)

        rows.append(
            {
                "handle": username,
                "rating": existing_ratings.get(username, 0),
                "score": score,
                "problems": problems,
                "solved_count": sum(1 for item in problems.values() if item.get("solved")),
                "penalty": sum(
                    int(item.get("time", 0)) + max(0, int(item.get("attempts", 1)) - 1) * 20
                    for item in problems.values()
                    if item.get("solved")
                ),
            }
        )

    rows.sort(key=lambda item: (-item["score"], -item["solved_count"], item["penalty"], item["handle"].lower()))
    StandingsRow.objects.filter(contest=contest).delete()
    StandingsRow.objects.bulk_create(
        [
            StandingsRow(
                contest=contest,
                rank=index + 1,
                handle=row["handle"],
                rating=row["rating"],
                score=row["score"],
                problems=row["problems"],
            )
            for index, row in enumerate(rows)
        ]
    )
