from django.contrib import admin

from .models import Clarification, Contest, ContestProblem, Problem, SampleTest, StandingsRow, Submission


admin.site.register([Clarification, Contest, ContestProblem, Problem, SampleTest, StandingsRow, Submission])
