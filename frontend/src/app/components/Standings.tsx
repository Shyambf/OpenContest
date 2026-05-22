import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../api";

interface Participant {
  rank: number;
  handle: string;
  rating: number;
  score: number;
  problems: {
    [key: string]: {
      solved: boolean;
      attempts: number;
      time?: number;
    };
  };
}

export function Standings() {
  const { contestId } = useParams();
  return <ContestStandings contestId={contestId} showHeader />;
}

export function ContestStandings({ contestId, showHeader = false }: { contestId?: string; showHeader?: boolean }) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [contestClock, setContestClock] = useState<{
    startTime: string;
    durationMinutes: number;
    elapsedMinutes: number;
    status: "live" | "upcoming" | "finished";
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!contestId) return;
    const loadStandings = () => {
      api
        .standings(contestId)
        .then((payload) => {
          setProblems(payload.problems);
          setParticipants(payload.participants);
          setContestClock({
            startTime: payload.startTime,
            durationMinutes: payload.durationMinutes,
            elapsedMinutes: payload.elapsedMinutes,
            status: payload.status,
          });
          setError("");
        })
        .catch((err) => setError(err.message));
    };
    loadStandings();
    const interval = window.setInterval(loadStandings, 5000);
    return () => window.clearInterval(interval);
  }, [contestId]);

  const getRatingColor = (rating: number) => {
    if (rating >= 3000) return "text-[#ca4754]";
    if (rating >= 2400) return "text-[#e2b714]";
    if (rating >= 2100) return "text-[#879f27]";
    if (rating >= 1900) return "text-[#d1d0c5]";
    return "text-[#646669]";
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8 pb-24 md:pb-8">
      {showHeader && (
        <div className="mb-8">
          <Link to="/contests" className="text-[#646669] hover:text-[#e2b714] text-sm mb-4 inline-block">
            Back to Contests
          </Link>
          <h1 className="text-[#e2b714] mb-2">Standings</h1>
          <p className="text-[#646669]">{contestId}</p>
        </div>
      )}

      {error && <div className="text-[#ca4754] mb-6">Backend unavailable: {error}</div>}

      {contestClock && (
        <div className="mb-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-4">
          <div className="border border-[#646669] rounded p-3">
            <div className="text-xs text-[#646669] mb-1">Status</div>
            <div className="text-[#d1d0c5]">{contestClock.status}</div>
          </div>
          <div className="border border-[#646669] rounded p-3">
            <div className="text-xs text-[#646669] mb-1">Elapsed from start</div>
            <div className="text-[#e2b714]">{formatMinutes(contestClock.elapsedMinutes)}</div>
          </div>
          <div className="border border-[#646669] rounded p-3">
            <div className="text-xs text-[#646669] mb-1">Duration</div>
            <div className="text-[#d1d0c5]">{formatMinutes(contestClock.durationMinutes)}</div>
          </div>
          <div className="border border-[#646669] rounded p-3">
            <div className="text-xs text-[#646669] mb-1">Started</div>
            <div className="text-[#d1d0c5]">{new Date(contestClock.startTime).toLocaleString()}</div>
          </div>
        </div>
      )}

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border border-[#646669]">
          <thead>
            <tr className="border-b border-[#646669] bg-[#2c2e31]">
              <th className="px-4 py-3 text-left text-[#d1d0c5] w-16">#</th>
              <th className="px-4 py-3 text-left text-[#d1d0c5]">Participant</th>
              <th className="px-4 py-3 text-left text-[#d1d0c5] w-24">Score</th>
              {problems.map((problem) => (
                <th key={problem} className="px-4 py-3 text-center text-[#d1d0c5] w-20 border-l border-[#646669]">
                  {problem}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {participants.map((participant) => (
              <tr key={participant.rank} className="border-b border-[#646669] hover:bg-[#2c2e31]/50 transition-colors">
                <td className="px-4 py-3 text-[#646669]">{participant.rank}</td>
                <td className="px-4 py-3">
                  <Link to={`/profile/${participant.handle}`} className={`hover:underline ${getRatingColor(participant.rating)}`}>
                    {participant.handle}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[#d1d0c5]">{participant.score}</td>
                {problems.map((problem) => {
                  const result = participant.problems[problem];
                  return (
                    <td key={problem} className="px-4 py-3 text-center border-l border-[#646669]">
                      {result.solved ? (
                        <div className="text-[#879f27] text-sm">
                          <div>+{result.attempts > 1 ? result.attempts - 1 : ""}</div>
                          <div className="text-xs text-[#646669]">{result.time}m</div>
                        </div>
                      ) : result.attempts > 0 ? (
                        <div className="text-[#ca4754] text-sm">-{result.attempts}</div>
                      ) : (
                        <div className="text-[#646669]">-</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {participants.map((participant) => (
          <div key={participant.rank} className="border border-[#646669] rounded overflow-hidden">
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#2c2e31]/50"
              onClick={() => setExpandedRow(expandedRow === participant.rank ? null : participant.rank)}
            >
              <div className="flex items-center gap-4 flex-1">
                <span className="text-[#646669] w-8">{participant.rank}</span>
                <div>
                  <Link to={`/profile/${participant.handle}`} className={`hover:underline ${getRatingColor(participant.rating)}`}>
                    {participant.handle}
                  </Link>
                  <div className="text-sm text-[#646669]">{participant.score} pts</div>
                </div>
              </div>
              {expandedRow === participant.rank ? (
                <ChevronUp size={20} className="text-[#646669]" />
              ) : (
                <ChevronDown size={20} className="text-[#646669]" />
              )}
            </div>
            {expandedRow === participant.rank && (
              <div className="border-t border-[#646669] bg-[#2c2e31] p-4">
                <div className="grid grid-cols-3 gap-3">
                  {problems.map((problem) => {
                    const result = participant.problems[problem];
                    return (
                      <div key={problem} className="border border-[#646669] rounded p-2 text-center">
                        <div className="text-xs text-[#646669] mb-1">{problem}</div>
                        {result.solved ? (
                          <div className="text-[#879f27] text-sm">
                            <div>AC {result.attempts > 1 ? `+${result.attempts - 1}` : ""}</div>
                            <div className="text-xs text-[#646669]">{result.time}m</div>
                          </div>
                        ) : result.attempts > 0 ? (
                          <div className="text-[#ca4754] text-sm">WA {result.attempts}</div>
                        ) : (
                          <div className="text-[#646669]">-</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 border border-[#646669] rounded">
        <h3 className="text-[#e2b714] mb-3 text-sm">Legend</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-[#646669]">
          <div>
            <span className="text-[#879f27]">Green</span> = Accepted
          </div>
          <div>
            <span className="text-[#ca4754]">Red</span> = Wrong Answer / Failed
          </div>
          <div>Number = Minutes from contest start</div>
        </div>
      </div>
    </div>
  );
}
