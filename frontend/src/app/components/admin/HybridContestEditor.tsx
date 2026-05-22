import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Check, Info, Upload, Plus, Search, GripVertical, Trash2, X } from "lucide-react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { ProgressBar } from "../ProgressBar";
import { Tooltip } from "../Tooltip";
import { api, type ProblemSummary } from "../../api";

type RuleType = "ICPC" | "Codeforces" | "IOI";

interface Problem {
  id: string;
  letter: string;
  name: string;
  source: "bank" | "quick" | "archive";
}

type Step = "general" | "problems" | "participants" | "advanced";

const steps: { id: Step; label: string }[] = [
  { id: "general", label: "General Info" },
  { id: "problems", label: "Problems" },
  { id: "participants", label: "Participants" },
  { id: "advanced", label: "Advanced" },
];

function parseDurationMinutes(value: string) {
  const hours = Number(value.match(/(\d+)h/)?.[1] ?? 0);
  const minutes = Number(value.match(/(\d+)m/)?.[1] ?? 0);
  return hours * 60 + minutes;
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function DraggableProblem({ problem, index, moveProblem, removeProblem }: any) {
  const [{ isDragging }, drag, preview] = useDrag({
    type: "problem",
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: "problem",
    hover: (draggedItem: { index: number }) => {
      if (draggedItem.index !== index) {
        moveProblem(draggedItem.index, index);
        draggedItem.index = index;
      }
    },
  });

  return (
    <div
      ref={(node) => drag(drop(node))}
      className={`border border-[#646669] rounded p-4 transition-opacity ${
        isDragging ? "opacity-50" : "opacity-100"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="cursor-move text-[#646669] hover:text-[#e2b714]">
          <GripVertical size={20} />
        </div>
        <div className="w-8 h-8 flex items-center justify-center border border-[#e2b714] rounded text-[#e2b714]">
          {problem.letter}
        </div>
        <div className="flex-1">
          <div className="text-[#d1d0c5]">{problem.name}</div>
          <div className="text-xs text-[#646669]">Source: {problem.source}</div>
        </div>
        <button
          onClick={() => removeProblem(problem.id)}
          className="text-[#ca4754] hover:text-[#d1d0c5] transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export function HybridContestEditor() {
  const navigate = useNavigate();
  const params = useParams();
  const contestId = params.id;
  const isEditing = Boolean(contestId);
  const [currentStep, setCurrentStep] = useState<Step>("general");
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set());
  const [problemBank, setProblemBank] = useState<ProblemSummary[]>([]);
  const [saveStatus, setSaveStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // General Info
  const [contestName, setContestName] = useState("");
  const [duration, setDuration] = useState("120");
  const [startTime, setStartTime] = useState("");
  const [contestStatus, setContestStatus] = useState<"live" | "upcoming" | "finished">("upcoming");
  const [ruleType, setRuleType] = useState<RuleType>("Codeforces");

  // Problems
  const [problems, setProblems] = useState<Problem[]>([]);
  const [showAddModal, setShowAddModal] = useState<"bank" | "quick" | "archive" | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [quickProblemName, setQuickProblemName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [quickStatement, setQuickStatement] = useState("");
  const [quickSampleInput, setQuickSampleInput] = useState("");
  const [quickSampleOutput, setQuickSampleOutput] = useState("");

  // Participants
  const [accessType, setAccessType] = useState<"public" | "private">("public");
  const [inviteList, setInviteList] = useState("");

  // Advanced
  const [enableHacking, setEnableHacking] = useState(false);
  const [virtualMode, setVirtualMode] = useState(false);

  useEffect(() => {
    api.problems().then(setProblemBank);
  }, []);

  useEffect(() => {
    if (!contestId) return;
    Promise.all([api.contestAdmin(contestId), api.contestProblems(contestId)])
      .then(([contest, contestProblems]) => {
        setContestName(contest.title);
        setDuration(String(parseDurationMinutes(contest.duration) || 120));
        setStartTime(toDateTimeLocal(contest.startTime));
        setContestStatus(contest.status);
        setAccessType(contest.access_type ?? "public");
        setVirtualMode(Boolean(contest.allow_virtual));
        setProblems(
          contestProblems.map((item) => ({
            id: String(item.problem.id),
            letter: item.letter,
            name: item.problem.name,
            source: "bank",
          })),
        );
      })
      .catch((error) => setSaveStatus(error instanceof Error ? error.message : "Failed to load contest"));
  }, [contestId]);

  const appendProblem = (problem: ProblemSummary, source: Problem["source"] = "bank") => {
    setProblems((current) => [
      ...current,
      {
        id: String(problem.id),
        letter: String.fromCharCode(65 + current.length),
        name: problem.name,
        source,
      },
    ]);
  };

  const moveProblem = (fromIndex: number, toIndex: number) => {
    const updated = [...problems];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    // Re-assign letters
    const withLetters = updated.map((p, idx) => ({
      ...p,
      letter: String.fromCharCode(65 + idx),
    }));
    setProblems(withLetters);
  };

  const removeProblem = (id: string) => {
    const updated = problems.filter((p) => p.id !== id);
    const withLetters = updated.map((p, idx) => ({
      ...p,
      letter: String.fromCharCode(65 + idx),
    }));
    setProblems(withLetters);
  };

  const addProblemFromBank = (bankProblem: ProblemSummary) => {
    appendProblem(bankProblem);
    setShowAddModal(null);
  };

  const addQuickProblem = async () => {
    if (!quickProblemName.trim() || !quickStatement.trim() || !quickSampleInput.trim() || !quickSampleOutput.trim()) {
      setSaveStatus("Fill name, statement, sample input and sample output.");
      return;
    }
    const name = quickProblemName.trim();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `problem-${Date.now()}`;
    setSaveStatus("Creating problem...");
    try {
      const created = await api.saveProblem({
        slug,
        name,
        difficulty: "Medium",
        tags: ["contest"],
        statement: quickStatement,
        input_format: "See statement.",
        output_format: "See statement.",
        note: "",
        checker_type: "standard",
        checker_code: "",
        checker_language: "python",
        time_limit_ms: 1000,
        memory_limit_mb: 256,
        samples: [{ input: quickSampleInput, output: quickSampleOutput, isSample: true }],
      });
      const summary: ProblemSummary = {
        id: created.id,
        slug: created.slug,
        name: created.name,
        difficulty: created.difficulty,
        tags: created.tags,
        usedIn: [],
      };
      setProblemBank((items) => [summary, ...items]);
      appendProblem(summary);
      setQuickProblemName("");
      setQuickStatement("");
      setQuickSampleInput("");
      setQuickSampleOutput("");
      setShowAddModal(null);
      setSaveStatus("Problem created and added.");
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "Problem creation failed");
    }
  };

  const handleArchiveFiles = async (files: File[]) => {
    if (!files.length) return;
    setIsUploading(true);
    setUploadProgress(0);
    setSaveStatus("Importing archive...");
    try {
      for (let index = 0; index < files.length; index += 1) {
        const imported = await api.importProblemArchive(files[index]);
        const problem = imported.problem;
        const summary: ProblemSummary = {
          id: problem.id,
          slug: problem.slug,
          name: problem.name,
          difficulty: problem.difficulty,
          tags: problem.tags,
          usedIn: [],
        };
        setProblemBank((items) => [summary, ...items]);
        appendProblem(summary, "archive");
        setUploadProgress(Math.round(((index + 1) / files.length) * 100));
        setSaveStatus(imported.message);
      }
      setShowAddModal(null);
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "Archive import failed");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleArchiveDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    handleArchiveFiles(Array.from(e.dataTransfer.files));
  };

  const handleSubmit = async () => {
    setSaveStatus("Saving...");
    try {
      const payload = {
        title: contestName.trim() || "Untitled Contest",
        start_time: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
        duration_minutes: Number(duration) || 120,
        status: contestStatus,
        access_type: accessType,
        allow_virtual: virtualMode,
        problem_ids: problems
          .filter((problem) => problem.source === "bank" || problem.source === "archive")
          .map((problem) => Number(problem.id))
          .filter(Boolean),
      };
      if (contestId) {
        await api.updateContest(contestId, payload);
      } else {
        await api.createContest(payload);
      }
      navigate("/admin/contests");
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "Save failed");
    }
  };

  const getCurrentStepIndex = () => steps.findIndex((s) => s.id === currentStep);

  const filteredBankProblems = problemBank.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="max-w-6xl">
        {/* Breadcrumb */}
        <div className="mb-6 text-sm text-[#646669]">
          <span className="hover:text-[#e2b714] cursor-pointer" onClick={() => navigate("/admin")}>
            Admin
          </span>
          <span className="mx-2">/</span>
          <span className="hover:text-[#e2b714] cursor-pointer" onClick={() => navigate("/admin/contests")}>
            Contests
          </span>
          <span className="mx-2">/</span>
          <span className="text-[#d1d0c5]">{isEditing ? "Edit Contest" : "New Contest"}</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[#e2b714] mb-2">{isEditing ? "Edit Contest" : "Create Contest"}</h1>
          <p className="text-[#646669]">Configure your programming competition</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-8">
          {/* Vertical Stepper */}
          <div className="hidden lg:block">
            <div className="space-y-2 sticky top-24">
              {steps.map((step, idx) => {
                const isActive = step.id === currentStep;
                const isCompleted = completedSteps.has(step.id);
                return (
                  <button
                    key={step.id}
                    onClick={() => setCurrentStep(step.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded transition-colors text-left ${
                      isActive
                        ? "bg-[#e2b714] text-[#323437]"
                        : "text-[#646669] hover:text-[#e2b714] hover:bg-[#2c2e31]"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs ${
                        isActive
                          ? "border-[#323437]"
                          : isCompleted
                          ? "border-[#879f27] bg-[#879f27] text-[#323437]"
                          : "border-[#646669]"
                      }`}
                    >
                      {isCompleted ? <Check size={14} /> : idx + 1}
                    </div>
                    <span className="text-sm">{step.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile Stepper */}
          <div className="lg:hidden flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              {steps.map((step, idx) => (
                <div
                  key={step.id}
                  className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs ${
                    step.id === currentStep
                      ? "border-[#e2b714] bg-[#e2b714] text-[#323437]"
                      : completedSteps.has(step.id)
                      ? "border-[#879f27] bg-[#879f27] text-[#323437]"
                      : "border-[#646669] text-[#646669]"
                  }`}
                >
                  {completedSteps.has(step.id) ? <Check size={14} /> : idx + 1}
                </div>
              ))}
            </div>
            <div className="text-sm text-[#646669]">
              {steps.find((s) => s.id === currentStep)?.label}
            </div>
          </div>

          {/* Content Area */}
          <div className="space-y-6">
            {/* General Info */}
            {currentStep === "general" && (
              <div className="space-y-6">
                <section className="border border-[#646669] rounded p-6">
                  <h2 className="text-[#d1d0c5] mb-6">Basic Information</h2>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[#646669] text-sm mb-2">
                        <span className="text-[#e2b714]">{">"}</span> contest_name
                      </label>
                      <input
                        type="text"
                        value={contestName}
                        onChange={(e) => setContestName(e.target.value)}
                        placeholder="Codeforces Round #893 (Div. 2)"
                        className="w-full bg-transparent border-b border-[#646669] px-1 py-2 text-[#d1d0c5] placeholder-[#646669] focus:outline-none focus:border-[#e2b714]"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[#646669] text-sm mb-2">
                          <span className="text-[#e2b714]">{">"}</span> duration (minutes)
                        </label>
                        <input
                          type="number"
                          value={duration}
                          onChange={(e) => setDuration(e.target.value)}
                          className="w-full bg-transparent border-b border-[#646669] px-1 py-2 text-[#d1d0c5] focus:outline-none focus:border-[#e2b714]"
                        />
                      </div>
                      <div>
                        <label className="block text-[#646669] text-sm mb-2">
                          <span className="text-[#e2b714]">{">"}</span> start_time
                        </label>
                        <input
                          type="datetime-local"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full bg-transparent border-b border-[#646669] px-1 py-2 text-[#d1d0c5] focus:outline-none focus:border-[#e2b714]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[#646669] text-sm mb-2">
                        <span className="text-[#e2b714]">{">"}</span> status
                      </label>
                      <select
                        value={contestStatus}
                        onChange={(e) => setContestStatus(e.target.value as "live" | "upcoming" | "finished")}
                        className="w-full bg-transparent border-b border-[#646669] px-1 py-2 text-[#d1d0c5] focus:outline-none focus:border-[#e2b714]"
                      >
                        <option value="upcoming" className="bg-[#323437]">upcoming</option>
                        <option value="live" className="bg-[#323437]">live</option>
                        <option value="finished" className="bg-[#323437]">finished</option>
                      </select>
                    </div>
                  </div>
                </section>

                <section className="border border-[#646669] rounded p-6">
                  <h2 className="text-[#d1d0c5] mb-6">Scoring Rules</h2>
                  <div className="flex gap-3">
                    {(["ICPC", "Codeforces", "IOI"] as RuleType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => setRuleType(type)}
                        className={`px-4 py-2 border rounded transition-colors ${
                          ruleType === type
                            ? "bg-[#e2b714] text-[#323437] border-[#e2b714]"
                            : "border-[#646669] text-[#646669] hover:border-[#e2b714] hover:text-[#e2b714]"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 text-xs text-[#646669]">
                    {ruleType === "ICPC" && "Binary scoring: Solved or Unsolved. Penalty for wrong submissions."}
                    {ruleType === "Codeforces" && "Points decrease over time. Hacking phase enabled."}
                    {ruleType === "IOI" && "Partial scoring based on test cases passed."}
                  </div>
                </section>
              </div>
            )}

            {/* Problems */}
            {currentStep === "problems" && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-3">
                  <button
                    onClick={() => setShowAddModal("bank")}
                    className="flex-1 px-4 py-3 border border-[#646669] rounded text-[#d1d0c5] hover:border-[#e2b714] hover:text-[#e2b714] transition-colors"
                  >
                    [ADD FROM BANK]
                  </button>
                  <button
                    onClick={() => setShowAddModal("quick")}
                    className="flex-1 px-4 py-3 border border-[#646669] rounded text-[#d1d0c5] hover:border-[#e2b714] hover:text-[#e2b714] transition-colors"
                  >
                    [QUICK CREATE]
                  </button>
                  <button
                    onClick={() => setShowAddModal("archive")}
                    className="flex-1 px-4 py-3 border border-[#646669] rounded text-[#d1d0c5] hover:border-[#e2b714] hover:text-[#e2b714] transition-colors"
                  >
                    [IMPORT ARCHIVE]
                  </button>
                </div>

                {problems.length === 0 ? (
                  <div className="border border-[#646669] rounded p-12 text-center text-[#646669]">
                    No problems added yet. Choose an option above to get started.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {problems.map((problem, idx) => (
                      <DraggableProblem
                        key={problem.id}
                        problem={problem}
                        index={idx}
                        moveProblem={moveProblem}
                        removeProblem={removeProblem}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Participants */}
            {currentStep === "participants" && (
              <div className="space-y-6">
                <section className="border border-[#646669] rounded p-6">
                  <h2 className="text-[#d1d0c5] mb-6">Access Control</h2>
                  <div className="flex gap-3 mb-6">
                    <button
                      onClick={() => setAccessType("public")}
                      className={`flex-1 px-4 py-2 border rounded transition-colors ${
                        accessType === "public"
                          ? "bg-[#e2b714] text-[#323437] border-[#e2b714]"
                          : "border-[#646669] text-[#646669] hover:border-[#e2b714] hover:text-[#e2b714]"
                      }`}
                    >
                      Public
                    </button>
                    <button
                      onClick={() => setAccessType("private")}
                      className={`flex-1 px-4 py-2 border rounded transition-colors ${
                        accessType === "private"
                          ? "bg-[#e2b714] text-[#323437] border-[#e2b714]"
                          : "border-[#646669] text-[#646669] hover:border-[#e2b714] hover:text-[#e2b714]"
                      }`}
                    >
                      Private (Invite Only)
                    </button>
                  </div>

                  {accessType === "private" && (
                    <div>
                      <label className="block text-[#646669] text-sm mb-2">
                        <span className="text-[#e2b714]">{">"}</span> invite_list (one username per line)
                      </label>
                      <textarea
                        value={inviteList}
                        onChange={(e) => setInviteList(e.target.value)}
                        placeholder="user1&#10;user2&#10;user3"
                        className="w-full h-32 bg-[#2c2e31] border border-[#646669] rounded p-3 text-[#d1d0c5] placeholder-[#646669] focus:outline-none focus:border-[#e2b714] resize-none font-mono text-sm"
                      />
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* Advanced */}
            {currentStep === "advanced" && (
              <div className="space-y-6">
                <section className="border border-[#646669] rounded p-6">
                  <h2 className="text-[#d1d0c5] mb-6">Advanced Options</h2>
                  <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableHacking}
                        onChange={(e) => setEnableHacking(e.target.checked)}
                        className="w-4 h-4 bg-transparent border border-[#646669] rounded checked:bg-[#e2b714] checked:border-[#e2b714] focus:outline-none"
                      />
                      <div>
                        <div className="text-[#d1d0c5]">Enable Hacking Phase</div>
                        <div className="text-xs text-[#646669]">
                          Allow participants to challenge others' solutions (Codeforces style)
                        </div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={virtualMode}
                        onChange={(e) => setVirtualMode(e.target.checked)}
                        className="w-4 h-4 bg-transparent border border-[#646669] rounded checked:bg-[#e2b714] checked:border-[#e2b714] focus:outline-none"
                      />
                      <div>
                        <div className="text-[#d1d0c5]">Allow Virtual Participation</div>
                        <div className="text-xs text-[#646669]">
                          Users can participate after the contest ends
                        </div>
                      </div>
                    </label>
                  </div>
                </section>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-[#646669]">
              <button
                onClick={() => {
                  const currentIdx = getCurrentStepIndex();
                  if (currentIdx > 0) {
                    setCurrentStep(steps[currentIdx - 1].id);
                  } else {
                    navigate("/admin/contests");
                  }
                }}
                className="px-4 py-2 text-[#646669] hover:text-[#e2b714] transition-colors"
              >
                {getCurrentStepIndex() === 0 ? "Cancel" : "Back"}
              </button>
              <button
                onClick={() => {
                  const currentIdx = getCurrentStepIndex();
                  setCompletedSteps(new Set([...completedSteps, currentStep]));
                  if (currentIdx < steps.length - 1) {
                    setCurrentStep(steps[currentIdx + 1].id);
                  } else {
                    handleSubmit();
                  }
                }}
                className="px-6 py-2 bg-[#e2b714] text-[#323437] rounded hover:bg-[#d1a613] transition-colors"
              >
                {getCurrentStepIndex() === steps.length - 1 ? (isEditing ? "Save Contest" : "Create Contest") : "Continue"}
              </button>
              {saveStatus && <span className="text-xs text-[#646669]">{saveStatus}</span>}
            </div>
          </div>
        </div>

        {/* Modals */}
        {/* Add from Bank Modal */}
        {showAddModal === "bank" && (
          <div className="fixed inset-0 bg-[#323437]/95 z-50 flex items-center justify-center p-6">
            <div className="bg-[#323437] border border-[#646669] rounded max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-[#646669] flex items-center justify-between">
                <h3 className="text-[#d1d0c5]">Add from Problem Bank</h3>
                <button onClick={() => setShowAddModal(null)} className="text-[#646669] hover:text-[#e2b714]">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 border-b border-[#646669]">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#646669]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search problems..."
                    className="w-full bg-transparent border border-[#646669] rounded pl-10 pr-4 py-2 text-[#d1d0c5] placeholder-[#646669] focus:outline-none focus:border-[#e2b714]"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-2">
                {filteredBankProblems.map((problem) => (
                  <button
                    key={problem.id}
                    onClick={() => addProblemFromBank(problem)}
                    className="w-full border border-[#646669] rounded p-4 hover:border-[#e2b714] transition-colors text-left"
                  >
                    <div className="text-[#d1d0c5] mb-1">{problem.name}</div>
                    <div className="flex gap-2">
                      {problem.tags.map((tag) => (
                        <span key={tag} className="text-xs text-[#646669]">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Quick Create Modal */}
        {showAddModal === "quick" && (
          <div className="fixed inset-0 bg-[#323437]/95 z-50 flex items-center justify-center p-6">
            <div className="bg-[#323437] border border-[#646669] rounded max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[#d1d0c5]">Quick Create Problem</h3>
                <button onClick={() => setShowAddModal(null)} className="text-[#646669] hover:text-[#e2b714]">
                  <X size={20} />
                </button>
              </div>

              <div className="mb-6">
                <label className="block text-[#646669] text-sm mb-2">
                  <span className="text-[#e2b714]">{">"}</span> problem_name
                </label>
                <input
                  type="text"
                  value={quickProblemName}
                  onChange={(e) => setQuickProblemName(e.target.value)}
                  placeholder="Enter problem name..."
                  className="w-full bg-transparent border-b border-[#646669] px-1 py-2 text-[#d1d0c5] placeholder-[#646669] focus:outline-none focus:border-[#e2b714]"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && addQuickProblem()}
                />
              </div>
              <div className="mb-6">
                <label className="block text-[#646669] text-sm mb-2">
                  <span className="text-[#e2b714]">{">"}</span> statement
                </label>
                <textarea
                  value={quickStatement}
                  onChange={(e) => setQuickStatement(e.target.value)}
                  className="w-full h-28 bg-[#2c2e31] border border-[#646669] rounded p-3 text-[#d1d0c5] text-sm focus:outline-none focus:border-[#e2b714] resize-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                <div>
                  <label className="block text-[#646669] text-sm mb-2">
                    <span className="text-[#e2b714]">{">"}</span> sample_input
                  </label>
                  <textarea
                    value={quickSampleInput}
                    onChange={(e) => setQuickSampleInput(e.target.value)}
                    className="w-full h-24 bg-[#2c2e31] border border-[#646669] rounded p-3 text-[#d1d0c5] text-sm font-mono focus:outline-none focus:border-[#e2b714] resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[#646669] text-sm mb-2">
                    <span className="text-[#e2b714]">{">"}</span> sample_output
                  </label>
                  <textarea
                    value={quickSampleOutput}
                    onChange={(e) => setQuickSampleOutput(e.target.value)}
                    className="w-full h-24 bg-[#2c2e31] border border-[#646669] rounded p-3 text-[#d1d0c5] text-sm font-mono focus:outline-none focus:border-[#e2b714] resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddModal(null)}
                  className="flex-1 px-4 py-2 border border-[#646669] rounded text-[#646669] hover:border-[#e2b714] hover:text-[#e2b714] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addQuickProblem}
                  disabled={!quickProblemName.trim() || !quickStatement.trim() || !quickSampleInput.trim() || !quickSampleOutput.trim()}
                  className="flex-1 px-4 py-2 bg-[#e2b714] text-[#323437] rounded hover:bg-[#d1a613] transition-colors disabled:opacity-50"
                >
                  Create Problem
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Archive Modal */}
        {showAddModal === "archive" && (
          <div className="fixed inset-0 bg-[#323437]/95 z-50 flex items-center justify-center p-6">
            <div className="bg-[#323437] border border-[#646669] rounded max-w-2xl w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <h3 className="text-[#d1d0c5]">Import Problem Archive</h3>
                  <button
                    onClick={() => setShowInfoModal(true)}
                    className="text-[#646669] hover:text-[#e2b714] transition-colors"
                    title="About problem package standards"
                  >
                    <Info size={16} />
                  </button>
                </div>
                <button onClick={() => setShowAddModal(null)} className="text-[#646669] hover:text-[#e2b714]">
                  <X size={20} />
                </button>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={handleArchiveDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded p-12 transition-all relative ${
                  isDraggingFile
                    ? "border-[#e2b714] bg-[#e2b714]/10"
                    : "border-[#646669] bg-[#2c2e31]"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  multiple
                  className="hidden"
                  onChange={(event) => handleArchiveFiles(Array.from(event.target.files ?? []))}
                />
                <Upload size={48} className="mx-auto mb-4 text-[#646669]" />
                <div className="text-center">
                  <div className="text-[#d1d0c5] mb-2">Drop ZIP archives here</div>
                  <div className="text-sm text-[#646669] mb-4">
                    Supports zip packages with problem.json/problem.yaml and .in/.ans tests
                  </div>
                  <div className="text-xs text-[#646669]">
                    click to browse files
                  </div>
                </div>
                {isUploading && (
                  <div className="mt-6">
                    <ProgressBar progress={uploadProgress} label="Parsing archive..." />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Info Modal */}
        {showInfoModal && (
          <div className="fixed inset-0 bg-[#323437]/95 z-50 flex items-center justify-center p-6">
            <div className="bg-[#323437] border border-[#646669] rounded max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[#e2b714]">Problem Package Standard</h3>
                <button onClick={() => setShowInfoModal(false)} className="text-[#646669] hover:text-[#e2b714]">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 text-sm text-[#d1d0c5]">
                  <div>
                    <div className="text-[#e2b714] mb-1">Supported Formats:</div>
                    <ul className="list-disc list-inside text-[#646669] space-y-1">
                    <li>OpenContest JSON manifest (.zip)</li>
                    <li>Kattis/DOMjudge-style test folders (.zip)</li>
                    <li>problem.yaml with sample/secret tests (.zip)</li>
                    </ul>
                  </div>

                <div>
                  <div className="text-[#e2b714] mb-1">Package Structure:</div>
                  <div className="bg-[#2c2e31] p-3 rounded font-mono text-xs text-[#646669]">
                    problem.pdf<br />
                    problem.yaml<br />
                    data/<br />
                    ├── sample/<br />
                    └── secret/
                  </div>
                </div>

                <div className="text-xs text-[#646669]">
                  Archives will be automatically parsed and imported with test cases.
                </div>
              </div>

              <button
                onClick={() => setShowInfoModal(false)}
                className="w-full mt-6 px-4 py-2 bg-[#e2b714] text-[#323437] rounded hover:bg-[#d1a613] transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </div>
    </DndProvider>
  );
}
