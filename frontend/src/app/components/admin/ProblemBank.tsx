import { Link } from "react-router";
import { Edit2, Trash2, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type ProblemSummary } from "../../api";

export function ProblemBank() {
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    api.problems().then(setProblems);
  }, []);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy":
        return "text-[#879f27] border-[#879f27]";
      case "Medium":
        return "text-[#e2b714] border-[#e2b714]";
      case "Hard":
        return "text-[#ca4754] border-[#ca4754]";
      default:
        return "text-[#646669] border-[#646669]";
    }
  };

  const filteredProblems = problems.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[#e2b714] mb-2">Problem Bank</h1>
          <p className="text-[#646669]">Manage your problem repository</p>
        </div>
        <Link
          to="/admin/problems/new"
          className="px-4 py-2 bg-[#e2b714] text-[#323437] rounded hover:bg-[#d1a613] transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          New Problem
        </Link>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#646669]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search problems by name or tags..."
            className="w-full bg-transparent border border-[#646669] rounded pl-10 pr-4 py-2 text-[#d1d0c5] placeholder-[#646669] focus:outline-none focus:border-[#e2b714]"
          />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block border border-[#646669] rounded overflow-hidden">
        <table className="w-full">
          <thead className="sticky top-0 bg-[#2c2e31]">
            <tr className="border-b border-[#646669]">
              <th className="px-6 py-3 text-left text-[#d1d0c5] text-sm">Problem Name</th>
              <th className="px-6 py-3 text-left text-[#d1d0c5] text-sm">Difficulty</th>
              <th className="px-6 py-3 text-left text-[#d1d0c5] text-sm">Tags</th>
              <th className="px-6 py-3 text-left text-[#d1d0c5] text-sm">Used In</th>
              <th className="px-6 py-3 text-right text-[#d1d0c5] text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProblems.map((problem) => (
              <tr key={problem.id} className="border-b border-[#646669] hover:bg-[#2c2e31]/50">
                <td className="px-6 py-4 text-[#d1d0c5]">{problem.name}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 text-xs border rounded ${getDifficultyColor(problem.difficulty)}`}>
                    {problem.difficulty}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {problem.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 text-xs bg-[#2c2e31] border border-[#646669] rounded text-[#646669]">
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 text-[#646669]">{problem.usedIn.length} contests</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <Link to={`/admin/problems/${problem.id}/edit`} className="p-1.5 text-[#646669] hover:text-[#e2b714] transition-colors">
                      <Edit2 size={16} />
                    </Link>
                    <button
                      onClick={async () => {
                        await api.deleteProblem(problem.id);
                        setProblems((items) => items.filter((item) => item.id !== problem.id));
                      }}
                      className="p-1.5 text-[#646669] hover:text-[#ca4754] transition-colors"
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
        {filteredProblems.map((problem) => (
          <div key={problem.id} className="border border-[#646669] rounded p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="text-[#d1d0c5] mb-2">{problem.name}</div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {problem.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 text-xs bg-[#2c2e31] border border-[#646669] rounded text-[#646669]">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-[#646669]">Used in {problem.usedIn.length} contests</div>
              </div>
              <span className={`px-2 py-0.5 text-xs border rounded ${getDifficultyColor(problem.difficulty)}`}>
                {problem.difficulty}
              </span>
            </div>
            <div className="flex gap-2">
              <Link to={`/admin/problems/${problem.id}/edit`} className="flex-1 px-3 py-2 text-sm border border-[#646669] rounded text-[#646669] hover:border-[#e2b714] hover:text-[#e2b714] transition-colors text-center">
                [EDIT]
              </Link>
              <button
                onClick={async () => {
                  await api.deleteProblem(problem.id);
                  setProblems((items) => items.filter((item) => item.id !== problem.id));
                }}
                className="flex-1 px-3 py-2 text-sm border border-[#ca4754] rounded text-[#ca4754] hover:bg-[#ca4754] hover:text-[#323437] transition-colors"
              >
                [DELETE]
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredProblems.length === 0 && (
        <div className="text-center py-12 text-[#646669] border border-[#646669] rounded">
          No problems found matching your search
        </div>
      )}
    </div>
  );
}
