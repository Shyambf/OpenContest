import { Link, useNavigate } from "react-router";
import { Edit2, Trash2, Plus, Search, Copy, Eye, ListChecks, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type ProblemDetail, type ProblemSummary } from "../../api";

export function EnhancedProblemBank() {
  const navigate = useNavigate();
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewProblem, setPreviewProblem] = useState<ProblemSummary | null>(null);
  const [previewDetail, setPreviewDetail] = useState<ProblemDetail | null>(null);
  const [usageProblem, setUsageProblem] = useState<ProblemSummary | null>(null);
  const [message, setMessage] = useState("");

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

  const handleClone = (problem: ProblemSummary) => {
    navigate(`/admin/problems/new?clone=${problem.id}`);
  };

  const handlePreview = async (problem: ProblemSummary) => {
    setPreviewProblem(problem);
    setPreviewDetail(null);
    try {
      setPreviewDetail(await api.adminProblem(String(problem.id)));
    } catch {
      setPreviewDetail(null);
    }
  };

  const handleDelete = async (problem: ProblemSummary) => {
    if (!window.confirm(`Delete problem "${problem.name}"?`)) return;
    setMessage("Deleting problem...");
    try {
      await api.deleteProblem(problem.id);
      setProblems((items) => items.filter((item) => item.id !== problem.id));
      setMessage("Problem deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed");
    }
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6 text-sm text-[#646669]">
        <span className="hover:text-[#e2b714] cursor-pointer" onClick={() => navigate("/admin")}>
          Admin
        </span>
        <span className="mx-2">/</span>
        <span className="text-[#d1d0c5]">Problem Bank</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[#e2b714] mb-2">Problem Bank</h1>
          <p className="text-[#646669]">Global repository of all problems</p>
          {message && <p className="text-[#646669] text-sm mt-2">{message}</p>}
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
            placeholder="Search by name or tags (e.g., #dp, #graphs)..."
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
              <th className="px-6 py-3 text-left text-[#d1d0c5] text-sm">Usage</th>
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
                      <span key={tag} className="text-xs text-[#646669]">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => setUsageProblem(problem)}
                    className="text-[#646669] hover:text-[#e2b714] text-sm hover:underline"
                  >
                    {problem.usedIn.length} contests
                  </button>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handlePreview(problem)}
                      className="p-1.5 text-[#646669] hover:text-[#e2b714] transition-colors"
                      title="Preview Statement"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleClone(problem)}
                      className="p-1.5 text-[#646669] hover:text-[#e2b714] transition-colors"
                      title="Clone Problem"
                    >
                      <Copy size={16} />
                    </button>
                    <Link
                      to={`/admin/problems/${problem.id}/edit`}
                      className="p-1.5 text-[#646669] hover:text-[#e2b714] transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </Link>
                    <button
                      onClick={() => handleDelete(problem)}
                      className="p-1.5 text-[#646669] hover:text-[#ca4754] transition-colors"
                      title="Delete"
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
                    <span key={tag} className="text-xs text-[#646669]">
                      #{tag}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => setUsageProblem(problem)}
                  className="text-xs text-[#646669] hover:text-[#e2b714]"
                >
                  Used in {problem.usedIn.length} contests
                </button>
              </div>
              <span className={`px-2 py-0.5 text-xs border rounded ${getDifficultyColor(problem.difficulty)}`}>
                {problem.difficulty}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handlePreview(problem)}
                className="px-3 py-2 text-sm border border-[#646669] rounded text-[#646669] hover:border-[#e2b714] hover:text-[#e2b714] transition-colors"
              >
                [PREVIEW]
              </button>
              <button
                onClick={() => handleClone(problem)}
                className="px-3 py-2 text-sm border border-[#646669] rounded text-[#646669] hover:border-[#e2b714] hover:text-[#e2b714] transition-colors"
              >
                [CLONE]
              </button>
              <Link
                to={`/admin/problems/${problem.id}/edit`}
                className="px-3 py-2 text-sm border border-[#646669] rounded text-[#646669] hover:border-[#e2b714] hover:text-[#e2b714] transition-colors text-center"
              >
                [EDIT]
              </Link>
              <button
                onClick={() => handleDelete(problem)}
                className="px-3 py-2 text-sm border border-[#ca4754] rounded text-[#ca4754] hover:bg-[#ca4754] hover:text-[#323437] transition-colors"
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

      {/* Preview Modal */}
      {previewProblem && (
        <div className="fixed inset-0 bg-[#323437]/95 z-50 flex items-center justify-center p-6">
          <div className="bg-[#323437] border border-[#646669] rounded max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[#646669] flex items-center justify-between">
              <h3 className="text-[#e2b714]">{previewProblem.name}</h3>
              <button onClick={() => setPreviewProblem(null)} className="text-[#646669] hover:text-[#e2b714]">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="prose prose-invert max-w-none">
                {previewDetail ? (
                  <>
                    <h2 className="text-[#d1d0c5] mb-4">Problem Statement</h2>
                    <p className="text-[#646669] leading-relaxed mb-4 whitespace-pre-wrap">{previewDetail.statement}</p>

                    <h3 className="text-[#d1d0c5] mb-3">Input Format</h3>
                    <p className="text-[#646669] mb-4 whitespace-pre-wrap">{previewDetail.input_format}</p>

                    <h3 className="text-[#d1d0c5] mb-3">Output Format</h3>
                    <p className="text-[#646669] mb-4 whitespace-pre-wrap">{previewDetail.output_format}</p>

                    {previewDetail.samples.map((sample, index) => (
                      <div key={index}>
                        <h3 className="text-[#d1d0c5] mb-3">Sample {index + 1} Input</h3>
                        <pre className="bg-[#2c2e31] p-4 rounded text-[#d1d0c5] font-mono text-sm whitespace-pre-wrap">{sample.input}</pre>

                        <h3 className="text-[#d1d0c5] mb-3">Sample {index + 1} Output</h3>
                        <pre className="bg-[#2c2e31] p-4 rounded text-[#879f27] font-mono text-sm whitespace-pre-wrap">{sample.output}</pre>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-[#646669]">Could not load problem details from the backend.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Usage Modal */}
      {usageProblem && (
        <div className="fixed inset-0 bg-[#323437]/95 z-50 flex items-center justify-center p-6">
          <div className="bg-[#323437] border border-[#646669] rounded max-w-md w-full">
            <div className="px-6 py-4 border-b border-[#646669] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks size={20} className="text-[#e2b714]" />
                <h3 className="text-[#d1d0c5]">Problem Usage</h3>
              </div>
              <button onClick={() => setUsageProblem(null)} className="text-[#646669] hover:text-[#e2b714]">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="text-sm text-[#646669] mb-4">
                "{usageProblem.name}" is used in:
              </div>
              <div className="space-y-2">
                {usageProblem.usedIn.map((contest: string, idx: number) => (
                  <div
                    key={idx}
                    className="px-4 py-3 border border-[#646669] rounded text-[#d1d0c5] hover:border-[#e2b714] transition-colors"
                  >
                    {contest}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
