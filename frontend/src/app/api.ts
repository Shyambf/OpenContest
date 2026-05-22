const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";
const TOKEN_KEY = "opencontest_token";
const USER_KEY = "opencontest_user";

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: "participant" | "admin";
  is_staff: boolean;
}

export interface Contest {
  id: string;
  title: string;
  startTime: string;
  duration: string;
  participants: number;
  status: "live" | "upcoming" | "finished";
  access_type?: "public" | "private";
  allow_virtual?: boolean;
  registered?: boolean;
  is_gym?: boolean;
  author?: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  problemCount?: number;
  solvedBy?: number;
}

export interface ContestPayload {
  title: string;
  start_time: string;
  duration_minutes: number;
  status: "live" | "upcoming" | "finished";
  access_type?: "public" | "private";
  allow_virtual?: boolean;
  is_gym?: boolean;
  author?: string;
  difficulty?: "" | "Easy" | "Medium" | "Hard";
  problem_ids: number[];
}

export interface ProblemSummary {
  id: number;
  slug: string;
  name: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string[];
  usedIn: string[];
}

export interface ProblemDetail extends ProblemSummary {
  statement: string;
  input_format: string;
  output_format: string;
  note: string;
  checker_type: "standard" | "custom";
  checker_code: string;
  checker_language: string;
  time_limit_ms: number;
  memory_limit_mb: number;
  samples: Array<{ input: string; output: string; isSample?: boolean }>;
}

export interface StandingsPayload {
  contestId: string;
  startTime: string;
  durationMinutes: number;
  elapsedMinutes: number;
  status: "live" | "upcoming" | "finished";
  problems: string[];
  participants: Array<{
    rank: number;
    handle: string;
    rating: number;
    score: number;
    problems: Record<string, { solved: boolean; attempts: number; time?: number }>;
  }>;
}

export interface Submission {
  id: number;
  user: string;
  contestId: string;
  problem: string;
  status: "AC" | "WA" | "TLE" | "MLE" | "RE" | "CE" | "Pending" | "Running";
  time: string;
  memory: string;
  language: string;
  source_code: string;
  judge_output: string;
  submittedAt: string;
}

export interface RunnerStats {
  summary: {
    total: number;
    online: number;
    busy: number;
    idle: number;
    offline: number;
    pendingOrRunningSubmissions: number;
    jobsProcessed: number;
  };
  runners: Array<{
    runner_id: string;
    hostname: string;
    status: "idle" | "busy" | "draining";
    current_submission_id: number | null;
    jobs_processed: number;
    last_verdict: string;
    supported_languages: string[];
    load: Record<string, number | string>;
    started_at: string | null;
    last_seen: string;
    isOnline: boolean;
    secondsSinceSeen: number;
  }>;
  updatedAt: string;
}

export interface AdminSummary {
  activeContests: number;
  totalProblems: number;
  registeredUsers: number;
  totalSubmissions: number;
  recentActivity: Array<{
    type: string;
    name: string;
    time: string;
  }>;
}

export interface LanguageOption {
  id: string;
  label: string;
}

export interface Clarification {
  id: number;
  user: string;
  contestId: string;
  contestTitle: string;
  problemId: number | null;
  problemLabel: string;
  question: string;
  reply: string;
  status: "pending" | "replied" | "broadcast";
  submittedAt: string;
  updatedAt: string;
}

export interface ProfilePayload {
  username: string;
  email?: string;
  firstName: string;
  lastName: string;
  canEdit: boolean;
  problemsSolved: number;
  contestsAttended: number;
  globalRank: number | null;
  currentRating: number;
  maxRating: number;
  ratingHistory: Array<{
    contest: number;
    contestId: string;
    title: string;
    rating: number;
    rank: number;
    score: number;
  }>;
  activity: Array<{ date: string; count: number }>;
  recentSubmissions: Submission[];
}

type ApiRequestOptions = RequestInit & { auth?: boolean };

async function request<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const { auth = true, headers, ...fetchOptions } = options ?? {};
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...(auth && token ? { Authorization: `Token ${token}` } : {}),
      ...headers,
    },
  });
  if (response.status === 401 && auth) {
    api.logout();
  }
  if (!response.ok) {
    throw new Error(`API ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

export const api = {
  currentUser: () => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  },
  setSession: (token: string, user: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  login: (payload: { username: string; password: string }) =>
    request<{ token: string; user: AuthUser }>("/auth/login/", {
      method: "POST",
      auth: false,
      body: JSON.stringify(payload),
    }),
  register: (payload: {
    username: string;
    email: string;
    password: string;
    role: "participant" | "admin";
  }) =>
    request<{ token: string; user: AuthUser }>("/auth/register/", {
      method: "POST",
      auth: false,
      body: JSON.stringify(payload),
    }),
  me: () => request<AuthUser>("/auth/me/"),
  adminSummary: () => request<AdminSummary>("/admin/summary/"),
  contests: () => request<Contest[]>("/contests/"),
  contestAdmin: (contestId: string) => request<Contest>(`/contests/${contestId}/`),
  deleteContest: (contestId: string) =>
    request<{ status: string; id: string }>(`/contests/${contestId}/`, {
      method: "DELETE",
    }),
  languages: () => request<LanguageOption[]>("/languages/"),
  registerForContest: (contestId: string) =>
    request<{ status: string; contestId: string; participants: number }>(`/contests/${contestId}/register/`, {
      method: "POST",
    }),
  gyms: () => request<Contest[]>("/gyms/"),
  problems: () => request<ProblemSummary[]>("/problems/"),
  adminProblem: (id: string) => request<ProblemDetail>(`/problems/${id}/`),
  deleteProblem: (id: number) =>
    request<{ status: string; id: number }>(`/problems/${id}/`, {
      method: "DELETE",
    }),
  generateTests: (code: string) =>
    request<{ tests: Array<{ input: string; output: string; isSample: boolean }> }>("/problems/generate-tests/", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  saveProblem: (
    payload: {
      slug: string;
      name: string;
      difficulty: "Easy" | "Medium" | "Hard";
      tags: string[];
      statement: string;
      input_format: string;
      output_format: string;
      note: string;
      checker_type: "standard" | "custom";
      checker_code: string;
      checker_language: string;
      time_limit_ms: number;
      memory_limit_mb: number;
      samples: Array<{ input: string; output: string; isSample: boolean }>;
    },
    id?: string,
  ) =>
    request<ProblemDetail>(id ? `/problems/${id}/` : "/problems/", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload),
    }),
  createContest: (payload: ContestPayload) =>
    request<Contest>("/contests/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateContest: (contestId: string, payload: ContestPayload) =>
    request<Contest>(`/contests/${contestId}/`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  importProblemArchive: (file: File) => {
    const formData = new FormData();
    formData.append("archive", file);
    const token = localStorage.getItem(TOKEN_KEY);
    return fetch(`${API_BASE_URL}/problems/import-archive/`, {
      method: "POST",
      headers: token ? { Authorization: `Token ${token}` } : {},
      body: formData,
    }).then(async (response) => {
      if (!response.ok) throw new Error(await response.text());
      return response.json() as Promise<{
        status: string;
        problem: ProblemDetail;
        files: string[];
        testsImported: number;
        message: string;
      }>;
    });
  },
  contestProblems: (contestId: string) =>
    request<Array<{ letter: string; points: number; problem: ProblemDetail }>>(
      `/contests/${contestId}/problems/`,
    ),
  problem: (contestId: string, letter: string) =>
    request<ProblemDetail>(`/contests/${contestId}/problems/${letter}/`),
  standings: (contestId: string) => request<StandingsPayload>(`/contests/${contestId}/standings/`),
  submissions: (limit?: number) => request<Submission[]>(limit ? `/submissions/?limit=${limit}` : "/submissions/"),
  submit: (payload: {
    contest_id: string;
    problem_letter: string;
    user?: string;
    language: string;
    source_code: string;
  }) =>
    request<Submission>("/submissions/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  rejudge: (id: number) =>
    request<Submission>(`/submissions/${id}/rejudge/`, {
      method: "POST",
    }),
  overrideSubmission: (id: number, payload: { status: Submission["status"]; judge_output?: string }) =>
    request<Submission>(`/submissions/${id}/override/`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  disqualifyUser: (username: string, payload?: { contest_id?: string }) =>
    request<{ username: string; contestId?: string; updated: number }>(
      `/users/${encodeURIComponent(username)}/disqualify/`,
      {
        method: "POST",
        body: JSON.stringify(payload ?? {}),
      },
    ),
  clarifications: () => request<Clarification[]>("/clarifications/"),
  replyClarification: (id: number, payload: { reply: string; status: "replied" | "broadcast" }) =>
    request<Clarification>(`/clarifications/${id}/`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  profile: (username: string) => request<ProfilePayload>(`/profiles/${encodeURIComponent(username)}/`),
  updateProfile: (username: string, payload: { email: string; first_name: string; last_name: string }) =>
    request<ProfilePayload>(`/profiles/${encodeURIComponent(username)}/`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  runnerStats: () => request<RunnerStats>("/runners/stats/"),
  runnerStatsStreamUrl: () => `${API_BASE_URL}/runners/stats/stream/?token=${localStorage.getItem(TOKEN_KEY) ?? ""}`,
  submissionsStreamUrl: () => `${API_BASE_URL}/submissions/stream/?token=${localStorage.getItem(TOKEN_KEY) ?? ""}`,
};
