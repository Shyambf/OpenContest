import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Activity, Cpu, Server, Trophy, Code, Users } from "lucide-react";
import { api, type AdminSummary, type RunnerStats } from "../../api";

export function AdminOverview() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [runnerStats, setRunnerStats] = useState<RunnerStats | null>(null);
  const [runnerError, setRunnerError] = useState("");
  const [summaryError, setSummaryError] = useState("");

  useEffect(() => {
    const loadSummary = () => {
      api
        .adminSummary()
        .then((data) => {
          setSummary(data);
          setSummaryError("");
        })
        .catch((error) => setSummaryError(error instanceof Error ? error.message : "Failed to load admin summary"));
    };
    const loadRunnerStats = () => {
      api
        .runnerStats()
        .then((stats) => {
          setRunnerStats(stats);
          setRunnerError("");
        })
        .catch((error) => setRunnerError(error instanceof Error ? error.message : "Failed to load runner stats"));
    };
    loadSummary();
    loadRunnerStats();
    const runnerInterval = window.setInterval(loadRunnerStats, 2000);
    const summaryInterval = window.setInterval(loadSummary, 10000);
    return () => {
      window.clearInterval(runnerInterval);
      window.clearInterval(summaryInterval);
    };
  }, []);

  const stats = [
    { label: "Active Contests", value: summary?.activeContests ?? 0, icon: Trophy, color: "#e2b714" },
    { label: "Total Problems", value: summary?.totalProblems ?? 0, icon: Code, color: "#879f27" },
    { label: "Registered Users", value: summary?.registeredUsers ?? 0, icon: Users, color: "#d1d0c5" },
    {
      label: "Runner Load",
      value: runnerStats ? `${runnerStats.summary.busy}/${runnerStats.summary.online}` : "0/0",
      icon: Cpu,
      color: runnerStats?.summary.busy ? "#e2b714" : "#879f27",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[#e2b714] mb-2">Admin Dashboard</h1>
        <p className="text-[#646669]">System overview and quick actions</p>
      </div>

      {summaryError && (
        <div className="border border-[#ca4754] rounded p-4 text-[#ca4754] mb-4">
          {summaryError}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="border border-[#646669] rounded p-6">
              <div className="flex items-center gap-3 mb-3">
                <Icon size={20} style={{ color: stat.color }} />
                <h3 className="text-[#646669] text-sm">{stat.label}</h3>
              </div>
              <div className="text-3xl" style={{ color: stat.color }}>
                {stat.value.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Runner Load */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[#d1d0c5]">Runner Load</h2>
          <div className="text-xs text-[#646669]">
            {runnerStats ? `Updated ${new Date(runnerStats.updatedAt).toLocaleTimeString()}` : "Waiting for data"}
          </div>
        </div>

        {runnerError && (
          <div className="border border-[#ca4754] rounded p-4 text-[#ca4754] mb-4">
            {runnerError}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Metric label="Online" value={runnerStats?.summary.online ?? 0} color="#879f27" />
          <Metric label="Busy" value={runnerStats?.summary.busy ?? 0} color="#e2b714" />
          <Metric label="Offline" value={runnerStats?.summary.offline ?? 0} color="#ca4754" />
          <Metric label="Queue" value={runnerStats?.summary.pendingOrRunningSubmissions ?? 0} color="#d1d0c5" />
        </div>

        <div className="border border-[#646669] rounded overflow-hidden">
          {runnerStats && runnerStats.runners.length > 0 ? (
            runnerStats.runners.map((runner) => (
              <div
                key={runner.runner_id}
                className="px-5 py-4 border-b border-[#646669] last:border-b-0 hover:bg-[#2c2e31] transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Server
                      size={18}
                      className={runner.isOnline ? "text-[#879f27]" : "text-[#ca4754]"}
                    />
                    <div>
                      <div className="text-[#d1d0c5]">{runner.runner_id}</div>
                      <div className="text-xs text-[#646669]">{runner.hostname || "unknown host"}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <RunnerField label="state" value={runner.isOnline ? runner.status : "offline"} />
                    <RunnerField label="current" value={runner.current_submission_id ? `#${runner.current_submission_id}` : "-"} />
                    <RunnerField label="jobs" value={String(runner.jobs_processed)} />
                    <RunnerField label="last" value={runner.last_verdict || "-"} />
                    <RunnerField label="seen" value={`${runner.secondsSinceSeen}s ago`} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {runner.supported_languages.map((language) => (
                    <span key={language} className="px-2 py-0.5 text-xs border border-[#646669] rounded text-[#646669]">
                      {language}
                    </span>
                  ))}
                  <span className="px-2 py-0.5 text-xs border border-[#646669] rounded text-[#646669]">
                    goroutines: {runner.load.goroutines ?? "-"}
                  </span>
                  <span className="px-2 py-0.5 text-xs border border-[#646669] rounded text-[#646669]">
                    uptime: {runner.load.uptime_sec ?? 0}s
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-[#646669]">
              No runner heartbeats yet. Start the runner container to see live load.
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-[#d1d0c5] mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link
            to="/admin/contests/new"
            className="border border-[#646669] rounded p-4 hover:border-[#e2b714] transition-colors group"
          >
            <div className="text-[#d1d0c5] group-hover:text-[#e2b714] mb-1">
              [CREATE CONTEST]
            </div>
            <div className="text-xs text-[#646669]">Set up a new competition</div>
          </Link>
          <Link
            to="/admin/problems/new"
            className="border border-[#646669] rounded p-4 hover:border-[#e2b714] transition-colors group"
          >
            <div className="text-[#d1d0c5] group-hover:text-[#e2b714] mb-1">
              [ADD PROBLEM]
            </div>
            <div className="text-xs text-[#646669]">Create a new problem</div>
          </Link>
          <Link
            to="/admin/submissions"
            className="border border-[#646669] rounded p-4 hover:border-[#e2b714] transition-colors group"
          >
            <div className="text-[#d1d0c5] group-hover:text-[#e2b714] mb-1">
              [VIEW SUBMISSIONS]
            </div>
            <div className="text-xs text-[#646669]">Monitor all submissions</div>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-[#d1d0c5] mb-4">Recent Activity</h2>
        <div className="border border-[#646669] rounded overflow-hidden">
          {(summary?.recentActivity ?? []).map((activity, idx) => (
            <div
              key={idx}
              className="px-6 py-4 border-b border-[#646669] last:border-b-0 hover:bg-[#2c2e31] transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="text-[#d1d0c5] mb-1">{activity.name}</div>
                  <div className="text-xs text-[#646669]">{activity.type}</div>
                </div>
                <div className="text-xs text-[#646669] whitespace-nowrap">
                  {new Date(activity.time).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
          {summary && summary.recentActivity.length === 0 && (
            <div className="px-6 py-4 text-[#646669]">No activity yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="border border-[#646669] rounded p-4">
      <div className="flex items-center gap-2 text-[#646669] text-xs mb-2">
        <Activity size={14} />
        {label}
      </div>
      <div className="text-2xl" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function RunnerField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[#646669]">{label}</div>
      <div className="text-[#d1d0c5]">{value}</div>
    </div>
  );
}
