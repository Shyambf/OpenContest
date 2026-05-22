import { Link } from "react-router";
import { Calendar, Clock, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Contest } from "../api";

export function Dashboard() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .contests()
      .then(setContests)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const liveContests = contests.filter((c) => c.status === "live");
  const upcomingContests = contests.filter((c) => c.status === "upcoming");
  const pastContests = contests.filter((c) => c.status === "finished");

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-[#e2b714] mb-2">Contests</h1>
        <p className="text-[#646669]">Compete, solve problems, and climb the ranks</p>
      </div>

      {loading && <div className="text-[#646669]">Loading contests...</div>}
      {error && <div className="text-[#ca4754]">Backend unavailable: {error}</div>}

      {/* Live Contests */}
      {liveContests.length > 0 && (
        <section className="mb-12">
          <h2 className="text-[#879f27] mb-6">● Live Now</h2>
          <div className="space-y-3">
            {liveContests.map((contest) => (
              <ContestRow key={contest.id} contest={contest} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Contests */}
      {upcomingContests.length > 0 && (
        <section className="mb-12">
          <h2 className="text-[#e2b714] mb-6">Upcoming</h2>
          <div className="space-y-3">
            {upcomingContests.map((contest) => (
              <ContestRow key={contest.id} contest={contest} />
            ))}
          </div>
        </section>
      )}

      {/* Past Contests */}
      {pastContests.length > 0 && (
        <section>
          <h2 className="text-[#646669] mb-6">Past Contests</h2>
          <div className="space-y-3">
            {pastContests.map((contest) => (
              <ContestRow key={contest.id} contest={contest} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ContestRow({ contest }: { contest: Contest }) {
  const [registered, setRegistered] = useState(Boolean(contest.registered));
  const [participants, setParticipants] = useState(contest.participants);
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState("");

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleRegister = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (contest.status !== "upcoming") return;
    event.preventDefault();
    if (registered || registering) return;
    setRegistering(true);
    setMessage("");
    try {
      const result = await api.registerForContest(contest.id);
      setRegistered(true);
      setParticipants(result.participants);
      setMessage("Registered");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Registration failed");
    } finally {
      setRegistering(false);
    }
  };

  const getStatusColor = (status: Contest["status"]) => {
    switch (status) {
      case "live":
        return "text-[#879f27] border-[#879f27] bg-[#879f27]/10";
      case "upcoming":
        return "text-[#e2b714] border-[#e2b714] bg-[#e2b714]/10";
      case "finished":
        return "text-[#646669] border-[#646669]";
    }
  };

  return (
    <>
      {/* Desktop Row */}
      <div className="hidden md:block border border-[#646669] rounded hover:border-[#e2b714] transition-colors group">
        <div className="px-6 py-4 grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-6 items-center">
          <div>
            <Link
              to={`/problem/${contest.id}/A`}
              className="text-[#d1d0c5] group-hover:text-[#e2b714] transition-colors"
            >
              {contest.title}
            </Link>
          </div>
          <div className="flex items-center gap-2 text-[#646669] text-sm">
            <Calendar size={14} />
            <span>{formatDate(contest.startTime)}</span>
          </div>
          <div className="flex items-center gap-2 text-[#646669] text-sm">
            <Clock size={14} />
            <span>{contest.duration}</span>
          </div>
          <div className="flex items-center gap-2 text-[#646669] text-sm">
            <Users size={14} />
            <span>{participants.toLocaleString()}</span>
          </div>
          <div>
            {contest.status === "finished" ? (
              <Link
                to={`/standings/${contest.id}`}
                className="px-4 py-1.5 text-sm border border-[#646669] rounded text-[#646669] hover:border-[#e2b714] hover:text-[#e2b714] transition-colors inline-block"
              >
                Results
              </Link>
            ) : (
              <Link
                to={`/problem/${contest.id}/A`}
                onClick={handleRegister}
                className={`px-4 py-1.5 text-sm bg-[#e2b714] text-[#323437] rounded hover:bg-[#d1a613] transition-colors inline-block ${
                  registering || registered ? "opacity-80" : ""
                }`}
              >
                {contest.status === "live" ? "Enter" : registering ? "Registering..." : registered ? "Registered" : "Register"}
              </Link>
            )}
          </div>
        </div>
        {message && <div className="px-6 pb-3 text-xs text-[#646669]">{message}</div>}
      </div>

      {/* Mobile Card */}
      <div className="md:hidden border border-[#646669] rounded">
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <Link
              to={`/problem/${contest.id}/A`}
              className="text-[#d1d0c5] hover:text-[#e2b714] flex-1"
            >
              {contest.title}
            </Link>
            <span
              className={`ml-3 px-2 py-0.5 text-xs border rounded ${getStatusColor(
                contest.status
              )}`}
            >
              {contest.status}
            </span>
          </div>
          <div className="space-y-2 text-sm text-[#646669] mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={14} />
              <span>{formatDate(contest.startTime)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={14} />
              <span>{contest.duration}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users size={14} />
              <span>{participants.toLocaleString()} participants</span>
            </div>
          </div>
          {contest.status === "finished" ? (
            <Link
              to={`/standings/${contest.id}`}
              className="block text-center px-4 py-2 text-sm border border-[#646669] rounded text-[#646669] hover:border-[#e2b714] hover:text-[#e2b714] transition-colors"
            >
              View Results
            </Link>
          ) : (
            <Link
              to={`/problem/${contest.id}/A`}
              onClick={handleRegister}
              className="block text-center px-4 py-2 text-sm bg-[#e2b714] text-[#323437] rounded hover:bg-[#d1a613] transition-colors"
            >
              {contest.status === "live" ? "Enter Contest" : registering ? "Registering..." : registered ? "Registered" : "Register"}
            </Link>
          )}
          {message && <div className="mt-3 text-center text-xs text-[#646669]">{message}</div>}
        </div>
      </div>
    </>
  );
}
