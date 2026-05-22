import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Copy, RotateCcw, WrapText } from "lucide-react";
import { api, type Contest, type Submission } from "../../api";

type StatusFilter = Submission["status"] | "all";

const STATUSES: Array<Submission["status"]> = ["Pending", "Running", "AC", "WA", "TLE", "MLE", "RE", "CE"];

export function SubmissionControl() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [wrapText, setWrapText] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [contestFilter, setContestFilter] = useState("all");
  const [problemFilter, setProblemFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("");

  useEffect(() => {
    api.contests().then(setContests).catch(() => undefined);
    const loadSubmissions = () => {
      api.submissions(5000).then((items) => {
        setSubmissions(items);
        setSelectedSubmission((selected) =>
          selected ? items.find((item) => item.id === selected.id) ?? selected : selected,
        );
      });
    };
    loadSubmissions();
    const interval = window.setInterval(loadSubmissions, 3000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    setProblemFilter("all");
  }, [contestFilter]);

  const filteredSubmissions = useMemo(() => {
    const userNeedle = userFilter.trim().toLowerCase();
    return submissions.filter((sub) => {
      if (contestFilter !== "all" && sub.contestId !== contestFilter) return false;
      if (problemFilter !== "all" && sub.problem !== problemFilter) return false;
      if (statusFilter !== "all" && sub.status !== statusFilter) return false;
      if (languageFilter !== "all" && sub.language !== languageFilter) return false;
      if (userNeedle && !sub.user.toLowerCase().includes(userNeedle)) return false;
      return true;
    });
  }, [contestFilter, languageFilter, problemFilter, statusFilter, submissions, userFilter]);

  const contestOptions = useMemo(() => {
    const ids = new Set(submissions.map((sub) => sub.contestId));
    return [...ids].sort();
  }, [submissions]);

  const problemOptions = useMemo(() => {
    const items = submissions
      .filter((sub) => contestFilter === "all" || sub.contestId === contestFilter)
      .map((sub) => sub.problem);
    return [...new Set(items)].sort();
  }, [contestFilter, submissions]);

  const languageOptions = useMemo(() => {
    return [...new Set(submissions.map((sub) => sub.language))].sort();
  }, [submissions]);

  const statusCounts = useMemo(() => {
    return STATUSES.reduce<Record<string, number>>((acc, status) => {
      acc[status] = filteredSubmissions.filter((sub) => sub.status === status).length;
      return acc;
    }, {});
  }, [filteredSubmissions]);

  const problemBreakdown = useMemo(() => {
    const byProblem = new Map<string, Submission[]>();
    for (const sub of filteredSubmissions) {
      const key = `${sub.contestId} / ${sub.problem}`;
      byProblem.set(key, [...(byProblem.get(key) ?? []), sub]);
    }
    return [...byProblem.entries()]
      .map(([key, items]) => ({
        key,
        total: items.length,
        pending: items.filter((item) => item.status === "Pending").length,
        running: items.filter((item) => item.status === "Running").length,
        accepted: items.filter((item) => item.status === "AC").length,
        failed: items.filter((item) => ["WA", "TLE", "MLE", "RE", "CE"].includes(item.status)).length,
        last: items[0]?.submittedAt ?? "",
      }))
      .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
  }, [filteredSubmissions]);

  const contestTitle = (contestId: string) => contests.find((contest) => contest.id === contestId)?.title ?? contestId;

  const getStatusColor = (status: Submission["status"]) => {
    switch (status) {
      case "AC":
        return "text-[#879f27]";
      case "WA":
      case "TLE":
      case "MLE":
      case "RE":
      case "CE":
        return "text-[#ca4754]";
      case "Pending":
      case "Running":
        return "text-[#e2b714]";
    }
  };

  const replaceSubmission = (updated: Submission) => {
    setSubmissions((items) => items.map((item) => (item.id === updated.id ? updated : item)));
    setSelectedSubmission(updated);
  };

  const handleRejudge = (id: number) => {
    setActionMessage("Rejudge queued...");
    api
      .rejudge(id)
      .then((updated) => {
        replaceSubmission(updated);
        setActionMessage("Rejudge queued.");
      })
      .catch((error) => setActionMessage(error instanceof Error ? error.message : "Rejudge failed"));
  };

  const handleOverrideStatus = (id: number, newStatus: Submission["status"] | "") => {
    if (!newStatus) return;
    setActionMessage("Saving override...");
    api
      .overrideSubmission(id, {
        status: newStatus,
        judge_output: `Verdict overridden by admin to ${newStatus}.`,
      })
      .then((updated) => {
        replaceSubmission(updated);
        setActionMessage(`Verdict changed to ${newStatus}.`);
      })
      .catch((error) => setActionMessage(error instanceof Error ? error.message : "Override failed"));
  };

  const handleDisqualify = (submission: Submission) => {
    setActionMessage("Disqualifying user...");
    api
      .disqualifyUser(submission.user, { contest_id: submission.contestId })
      .then((result) => {
        setSubmissions((items) =>
          items.map((item) =>
            item.user === submission.user && item.contestId === submission.contestId
              ? { ...item, status: "RE", judge_output: "User disqualified by admin." }
              : item,
          ),
        );
        setSelectedSubmission((current) =>
          current && current.user === submission.user && current.contestId === submission.contestId
            ? { ...current, status: "RE", judge_output: "User disqualified by admin." }
            : current,
        );
        setActionMessage(`Disqualified ${result.updated} submissions.`);
      })
      .catch((error) => setActionMessage(error instanceof Error ? error.message : "Disqualification failed"));
  };

  const handleCopyCode = () => {
    if (!selectedSubmission) return;
    navigator.clipboard.writeText(selectedSubmission.source_code);
    setActionMessage("Source copied.");
  };

  const resetFilters = () => {
    setContestFilter("all");
    setProblemFilter("all");
    setStatusFilter("all");
    setLanguageFilter("all");
    setUserFilter("");
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[#e2b714] mb-2">Submission Control</h1>
        <p className="text-[#646669]">Monitor submissions by contest, problem, status and participant</p>
      </div>

      {!selectedSubmission ? (
        <>
          <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric label="Shown" value={filteredSubmissions.length} color="#d1d0c5" />
            <Metric label="Pending/Running" value={(statusCounts.Pending ?? 0) + (statusCounts.Running ?? 0)} color="#e2b714" />
            <Metric label="Accepted" value={statusCounts.AC ?? 0} color="#879f27" />
            <Metric
              label="Failed"
              value={["WA", "TLE", "MLE", "RE", "CE"].reduce((sum, status) => sum + (statusCounts[status] ?? 0), 0)}
              color="#ca4754"
            />
          </div>

          <div className="mb-6 border border-[#646669] rounded p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <FilterSelect label="Contest" value={contestFilter} onChange={setContestFilter}>
                <option value="all">All contests</option>
                {contestOptions.map((contestId) => (
                  <option key={contestId} value={contestId}>
                    {contestTitle(contestId)}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect label="Problem" value={problemFilter} onChange={setProblemFilter}>
                <option value="all">All problems</option>
                {problemOptions.map((problem) => (
                  <option key={problem} value={problem}>
                    {problem}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect label="Status" value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)}>
                <option value="all">All statuses</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect label="Language" value={languageFilter} onChange={setLanguageFilter}>
                <option value="all">All languages</option>
                {languageOptions.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </FilterSelect>
              <div>
                <label className="block text-xs text-[#646669] mb-1">User</label>
                <input
                  value={userFilter}
                  onChange={(event) => setUserFilter(event.target.value)}
                  placeholder="handle"
                  className="w-full bg-[#2c2e31] border border-[#646669] rounded px-3 py-2 text-[#d1d0c5] text-sm focus:outline-none focus:border-[#e2b714]"
                />
              </div>
            </div>
            <button onClick={resetFilters} className="mt-3 text-sm text-[#646669] hover:text-[#e2b714]">
              Reset filters
            </button>
          </div>

          <section className="mb-6 border border-[#646669] rounded overflow-hidden">
            <div className="px-4 py-3 bg-[#2c2e31] border-b border-[#646669]">
              <h2 className="text-[#d1d0c5] text-sm">Breakdown by Contest / Problem</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#646669] text-left">
                    <th className="px-4 py-3 text-[#d1d0c5] text-sm">Contest / Problem</th>
                    <th className="px-4 py-3 text-[#d1d0c5] text-sm">Total</th>
                    <th className="px-4 py-3 text-[#d1d0c5] text-sm">Queue</th>
                    <th className="px-4 py-3 text-[#d1d0c5] text-sm">AC</th>
                    <th className="px-4 py-3 text-[#d1d0c5] text-sm">Failed</th>
                    <th className="px-4 py-3 text-[#d1d0c5] text-sm">Last</th>
                  </tr>
                </thead>
                <tbody>
                  {problemBreakdown.map((row) => (
                    <tr key={row.key} className="border-b border-[#646669]">
                      <td className="px-4 py-3 text-[#d1d0c5] text-sm">{row.key}</td>
                      <td className="px-4 py-3 text-[#646669] text-sm">{row.total}</td>
                      <td className="px-4 py-3 text-[#e2b714] text-sm">{row.pending + row.running}</td>
                      <td className="px-4 py-3 text-[#879f27] text-sm">{row.accepted}</td>
                      <td className="px-4 py-3 text-[#ca4754] text-sm">{row.failed}</td>
                      <td className="px-4 py-3 text-[#646669] text-sm">{new Date(row.last).toLocaleString()}</td>
                    </tr>
                  ))}
                  {problemBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-[#646669] text-sm">
                        No submissions match current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <SubmissionList
            submissions={filteredSubmissions}
            getStatusColor={getStatusColor}
            onInspect={setSelectedSubmission}
          />
        </>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button onClick={() => setSelectedSubmission(null)} className="text-[#646669] hover:text-[#e2b714] text-sm transition-colors">
              Back to List
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[#646669] text-sm">Submission #{selectedSubmission.id}</span>
              <span className={`text-sm ${getStatusColor(selectedSubmission.status)}`}>{selectedSubmission.status}</span>
            </div>
          </div>

          <div className="border border-[#646669] rounded p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">
              <Info label="Contest" value={selectedSubmission.contestId} />
              <Info label="User" value={selectedSubmission.user} />
              <Info label="Problem" value={selectedSubmission.problem} />
              <Info label="Language" value={selectedSubmission.language} />
              <Info label="Submitted" value={new Date(selectedSubmission.submittedAt).toLocaleString()} />
            </div>
          </div>

          <div className="border border-[#646669] rounded overflow-hidden">
            <div className="px-6 py-3 border-b border-[#646669] bg-[#2c2e31] flex items-center justify-between">
              <span className="text-[#d1d0c5] text-sm">Source Code</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setWrapText(!wrapText)}
                  className={`p-1.5 rounded transition-colors ${wrapText ? "text-[#e2b714]" : "text-[#646669] hover:text-[#e2b714]"}`}
                  title="Toggle text wrap"
                >
                  <WrapText size={16} />
                </button>
                <button onClick={handleCopyCode} className="p-1.5 text-[#646669] hover:text-[#e2b714] transition-colors" title="Copy code">
                  <Copy size={16} />
                </button>
              </div>
            </div>
            <div className="bg-[#2c2e31] p-6 overflow-x-auto">
              <pre className={`text-[#d1d0c5] text-sm font-mono leading-relaxed ${wrapText ? "whitespace-pre-wrap" : ""}`}>
                {selectedSubmission.source_code || "Source code is empty."}
              </pre>
            </div>
          </div>

          <div className="border border-[#646669] rounded overflow-hidden">
            <div className="px-6 py-3 border-b border-[#646669] bg-[#2c2e31]">
              <span className="text-[#d1d0c5] text-sm">Judge Output</span>
            </div>
            <div className="bg-[#2c2e31] p-6">
              <pre className="text-[#879f27] text-sm font-mono leading-relaxed whitespace-pre-wrap">
                {selectedSubmission.judge_output || "No judge output yet."}
              </pre>
            </div>
          </div>

          <div className="border border-[#646669] rounded p-6">
            <h3 className="text-[#d1d0c5] mb-4">Admin Actions</h3>
            {actionMessage && <div className="text-[#646669] text-sm mb-4">{actionMessage}</div>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => handleRejudge(selectedSubmission.id)}
                className="px-4 py-2 border border-[#646669] rounded text-[#d1d0c5] hover:border-[#e2b714] hover:text-[#e2b714] transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} />
                [RE-JUDGE]
              </button>

              <select
                onChange={(e) => handleOverrideStatus(selectedSubmission.id, e.target.value as Submission["status"] | "")}
                className="px-4 py-2 bg-transparent border border-[#646669] rounded text-[#d1d0c5] hover:border-[#e2b714] focus:outline-none focus:border-[#e2b714] transition-colors"
              >
                <option value="" className="bg-[#323437]">[OVERRIDE STATUS]</option>
                {STATUSES.filter((status) => !["Pending", "Running"].includes(status)).map((status) => (
                  <option key={status} value={status} className="bg-[#323437]">
                    {status}
                  </option>
                ))}
              </select>

              <button
                onClick={() => handleDisqualify(selectedSubmission)}
                className="px-4 py-2 border border-[#ca4754] rounded text-[#ca4754] hover:bg-[#ca4754] hover:text-[#323437] transition-colors flex items-center justify-center gap-2"
              >
                <AlertTriangle size={16} />
                [DISQUALIFY USER]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="border border-[#646669] rounded p-4">
      <div className="text-xs text-[#646669] mb-1">{label}</div>
      <div className="text-2xl" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs text-[#646669] mb-1">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-[#2c2e31] border border-[#646669] rounded px-3 py-2 text-[#d1d0c5] text-sm focus:outline-none focus:border-[#e2b714]"
      >
        {children}
      </select>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[#646669] mb-1">{label}</div>
      <div className="text-[#d1d0c5] break-words">{value}</div>
    </div>
  );
}

function SubmissionList({
  submissions,
  getStatusColor,
  onInspect,
}: {
  submissions: Submission[];
  getStatusColor: (status: Submission["status"]) => string;
  onInspect: (submission: Submission) => void;
}) {
  return (
    <>
      <div className="hidden md:block border border-[#646669] rounded overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-[#2c2e31] z-10">
            <tr className="border-b border-[#646669]">
              <th className="px-4 py-3 text-left text-[#d1d0c5] text-sm">ID</th>
              <th className="px-4 py-3 text-left text-[#d1d0c5] text-sm">Contest</th>
              <th className="px-4 py-3 text-left text-[#d1d0c5] text-sm">User</th>
              <th className="px-4 py-3 text-left text-[#d1d0c5] text-sm">Problem</th>
              <th className="px-4 py-3 text-left text-[#d1d0c5] text-sm">Status</th>
              <th className="px-4 py-3 text-left text-[#d1d0c5] text-sm">Time</th>
              <th className="px-4 py-3 text-left text-[#d1d0c5] text-sm">Memory</th>
              <th className="px-4 py-3 text-left text-[#d1d0c5] text-sm">Language</th>
              <th className="px-4 py-3 text-left text-[#d1d0c5] text-sm">Submitted</th>
              <th className="px-4 py-3 text-left text-[#d1d0c5] text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((sub) => (
              <tr key={sub.id} className="border-b border-[#646669] hover:bg-[#2c2e31]/50 transition-colors">
                <td className="px-4 py-3 text-[#646669] text-sm">{sub.id}</td>
                <td className="px-4 py-3 text-[#646669] text-sm">{sub.contestId}</td>
                <td className="px-4 py-3 text-[#d1d0c5] text-sm">{sub.user}</td>
                <td className="px-4 py-3 text-[#d1d0c5] text-sm">{sub.problem}</td>
                <td className={`px-4 py-3 text-sm ${getStatusColor(sub.status)}`}>{sub.status}</td>
                <td className="px-4 py-3 text-[#646669] text-sm">{sub.time}</td>
                <td className="px-4 py-3 text-[#646669] text-sm">{sub.memory}</td>
                <td className="px-4 py-3 text-[#646669] text-sm">{sub.language}</td>
                <td className="px-4 py-3 text-[#646669] text-sm">{new Date(sub.submittedAt).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <button onClick={() => onInspect(sub)} className="text-[#e2b714] hover:underline text-sm">
                    [INSPECT]
                  </button>
                </td>
              </tr>
            ))}
            {submissions.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-[#646669] text-sm">
                  No submissions match current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {submissions.map((sub) => (
          <div key={sub.id} className="border border-[#646669] rounded p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-[#d1d0c5] mb-1">#{sub.id}</div>
                <div className="text-sm text-[#646669]">{sub.contestId} / {sub.user}</div>
              </div>
              <span className={`text-sm ${getStatusColor(sub.status)}`}>{sub.status}</span>
            </div>
            <div className="text-sm text-[#d1d0c5] mb-2">{sub.problem}</div>
            <div className="flex gap-4 text-xs text-[#646669] mb-3">
              <span>{sub.time}</span>
              <span>{sub.memory}</span>
              <span>{sub.language}</span>
            </div>
            <button
              onClick={() => onInspect(sub)}
              className="w-full px-4 py-2 text-sm border border-[#e2b714] rounded text-[#e2b714] hover:bg-[#e2b714] hover:text-[#323437] transition-colors"
            >
              [INSPECT]
            </button>
          </div>
        ))}
        {submissions.length === 0 && <div className="border border-[#646669] rounded p-6 text-[#646669]">No submissions match current filters.</div>}
      </div>
    </>
  );
}
