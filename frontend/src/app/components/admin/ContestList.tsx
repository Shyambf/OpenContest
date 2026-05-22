import { Link } from "react-router";
import { Edit2, Trash2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Contest } from "../../api";

export function ContestList() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.contests().then(setContests);
  }, []);

  const deleteContest = async (contest: Contest) => {
    if (!window.confirm(`Delete contest "${contest.title}"? Submissions and standings for it will also be removed.`)) {
      return;
    }
    setMessage("Deleting contest...");
    try {
      await api.deleteContest(contest.id);
      setContests((items) => items.filter((item) => item.id !== contest.id));
      setMessage("Contest deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "live":
        return "text-[#879f27] border-[#879f27]";
      case "upcoming":
        return "text-[#e2b714] border-[#e2b714]";
      case "finished":
        return "text-[#646669] border-[#646669]";
      default:
        return "text-[#646669] border-[#646669]";
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[#e2b714] mb-2">Contests Management</h1>
          <p className="text-[#646669]">Create and manage programming contests</p>
          {message && <p className="text-[#646669] text-sm mt-2">{message}</p>}
        </div>
        <Link
          to="/admin/contests/new"
          className="px-4 py-2 bg-[#e2b714] text-[#323437] rounded hover:bg-[#d1a613] transition-colors flex items-center gap-2"
        >
          <Plus size={16} />
          New Contest
        </Link>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block border border-[#646669] rounded overflow-hidden">
        <table className="w-full">
          <thead className="sticky top-0 bg-[#2c2e31]">
            <tr className="border-b border-[#646669]">
              <th className="px-6 py-3 text-left text-[#d1d0c5] text-sm">Contest Name</th>
              <th className="px-6 py-3 text-left text-[#d1d0c5] text-sm">Status</th>
              <th className="px-6 py-3 text-left text-[#d1d0c5] text-sm">Participants</th>
              <th className="px-6 py-3 text-right text-[#d1d0c5] text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {contests.map((contest) => (
              <tr key={contest.id} className="border-b border-[#646669] hover:bg-[#2c2e31]/50">
                <td className="px-6 py-4 text-[#d1d0c5]">{contest.title}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 text-xs border rounded ${getStatusColor(contest.status)}`}>
                    {contest.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-[#646669]">{contest.participants.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      to={`/admin/contests/${contest.id}/edit`}
                      className="p-1.5 text-[#646669] hover:text-[#e2b714] transition-colors"
                      title="Edit contest"
                    >
                      <Edit2 size={16} />
                    </Link>
                    <button
                      onClick={() => deleteContest(contest)}
                      className="p-1.5 text-[#646669] hover:text-[#ca4754] transition-colors"
                      title="Delete contest"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {contests.map((contest) => (
          <div key={contest.id} className="border border-[#646669] rounded p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="text-[#d1d0c5] mb-2">{contest.title}</div>
                <div className="text-xs text-[#646669]">{contest.participants.toLocaleString()} participants</div>
              </div>
              <span className={`px-2 py-0.5 text-xs border rounded ${getStatusColor(contest.status)}`}>
                {contest.status}
              </span>
            </div>
            <div className="flex gap-2">
              <Link
                to={`/admin/contests/${contest.id}/edit`}
                className="flex-1 px-3 py-2 text-sm border border-[#646669] rounded text-[#646669] hover:border-[#e2b714] hover:text-[#e2b714] transition-colors"
              >
                [EDIT]
              </Link>
              <button
                onClick={() => deleteContest(contest)}
                className="flex-1 px-3 py-2 text-sm border border-[#ca4754] rounded text-[#ca4754] hover:bg-[#ca4754] hover:text-[#323437] transition-colors"
              >
                [DELETE]
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
