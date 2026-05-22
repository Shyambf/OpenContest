import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Play } from "lucide-react";
import { api, type LanguageOption, type ProblemDetail, type Submission } from "../api";
import { ContestStandings } from "./Standings";

export function ProblemView() {
  const { contestId, problemId } = useParams();
  const [activeTab, setActiveTab] = useState<"statement" | "editor" | "submissions" | "standings">("statement");
  const [selectedLanguage, setSelectedLanguage] = useState("cpp");
  const [languages, setLanguages] = useState<LanguageOption[]>([{ id: "cpp", label: "C++ 17" }]);
  const [problemLetters, setProblemLetters] = useState<string[]>(["A"]);
  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submitMessage, setSubmitMessage] = useState("");
  const [runMessage, setRunMessage] = useState("");
  const [code, setCode] = useState(`#include <iostream>
using namespace std;

int main() {
    int n;
    cin >> n;

    // Your code here

    return 0;
}`);

  useEffect(() => {
    if (!contestId) return;
    api.contestProblems(contestId).then((items) => setProblemLetters(items.map((item) => item.letter)));

    const loadLanguages = () => {
      api.languages().then((items) => {
        setLanguages(items);
        setSelectedLanguage((current) => (items.some((item) => item.id === current) ? current : items[0]?.id ?? ""));
      });
    };
    loadLanguages();
    const interval = window.setInterval(loadLanguages, 5000);
    return () => window.clearInterval(interval);
  }, [contestId]);

  useEffect(() => {
    if (!contestId || !problemId) return;
    setProblem(null);
    api.problem(contestId, problemId).then(setProblem);
    const loadSubmissions = () => {
      api
        .submissions()
        .then((items) =>
          setSubmissions(items.filter((item) => item.contestId === contestId && item.problem.startsWith(`${problemId}.`))),
        )
        .catch(() => undefined);
    };
    loadSubmissions();
    const interval = window.setInterval(loadSubmissions, 3000);
    return () => window.clearInterval(interval);
  }, [contestId, problemId]);

  const submitSolution = async () => {
    if (!contestId || !problemId) return;
    if (!selectedLanguage) {
      setSubmitMessage("No online runner languages available.");
      return;
    }
    setSubmitMessage("Submitting...");
    try {
      const submission = await api.submit({
        contest_id: contestId,
        problem_letter: problemId,
        language: selectedLanguage,
        source_code: code,
      });
      setSubmissions((current) => [submission, ...current]);
      setSubmitMessage(`Submission #${submission.id} queued`);
      setActiveTab("submissions");
    } catch (error) {
      setSubmitMessage(error instanceof Error ? error.message : "Submit failed");
    }
  };

  const runSample = () => {
    if (!problem) {
      setRunMessage("Problem is still loading.");
      return;
    }
    if (!problem.samples.length) {
      setRunMessage("No sample tests are available for this problem.");
      return;
    }
    setRunMessage("Sample run requires a connected runner. Submit to queue this code for judging.");
  };

  const problems = problemLetters.length ? problemLetters : ["A"];

  return (
    <div className="max-w-[1440px] mx-auto">
      <div className="border-b border-[#646669] px-6 py-3 flex items-center justify-between sticky top-[60px] bg-[#323437] z-40">
        <div className="flex items-center gap-4">
          <Link to="/contests" className="text-[#646669] hover:text-[#e2b714] transition-colors">
            Back to Contests
          </Link>
          <div className="h-4 w-px bg-[#646669]" />
          <span className="text-[#646669]">{contestId}</span>
        </div>
        <div className="flex items-center gap-2">
          {problems.map((letter) => (
            <Link
              key={letter}
              to={`/problem/${contestId}/${letter}`}
              className={`w-8 h-8 flex items-center justify-center border rounded transition-colors ${
                letter === problemId
                  ? "bg-[#e2b714] text-[#323437] border-[#e2b714]"
                  : "border-[#646669] text-[#646669] hover:border-[#e2b714] hover:text-[#e2b714]"
              }`}
            >
              {letter}
            </Link>
          ))}
        </div>
      </div>

      <div className="border-b border-[#646669] flex sticky top-[109px] bg-[#323437] z-30 overflow-x-auto">
        {(["statement", "editor", "submissions", "standings"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`min-w-fit flex-1 px-4 py-3 text-sm ${
              activeTab === tab ? "text-[#e2b714] border-b-2 border-[#e2b714]" : "text-[#646669]"
            }`}
          >
            {tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === "statement" && <ProblemStatement problemId={problemId || "A"} problem={problem} />}
      {activeTab === "editor" && (
        <div className="min-h-[calc(100vh-160px)] bg-[#2c2e31]">
          <CodeEditor
            code={code}
            setCode={setCode}
            selectedLanguage={selectedLanguage}
            setSelectedLanguage={setSelectedLanguage}
            languages={languages}
            onSubmit={submitSolution}
            submitMessage={submitMessage}
            onRun={runSample}
            runMessage={runMessage}
          />
        </div>
      )}
      {activeTab === "submissions" && <SubmissionsList submissions={submissions} />}
      {activeTab === "standings" && (
        <ContestStandings contestId={contestId} />
      )}
    </div>
  );
}

function ProblemStatement({ problemId, problem }: { problemId: string; problem: ProblemDetail | null }) {
  if (!problem) {
    return <div className="border-r border-[#646669] p-6 md:p-8 text-[#646669]">Loading problem...</div>;
  }

  return (
    <div className="p-6 md:p-8 overflow-y-auto">
      <div className="max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[#e2b714] text-2xl">{problemId}.</span>
            <h1 className="text-[#d1d0c5]">{problem.name}</h1>
          </div>
          <div className="flex gap-4 text-sm text-[#646669]">
            <span>Time limit: {problem.time_limit_ms}ms</span>
            <span>Memory limit: {problem.memory_limit_mb} MB</span>
          </div>
        </div>

        <section className="mb-8">
          <p className="text-[#d1d0c5] leading-relaxed whitespace-pre-wrap">{problem.statement}</p>
        </section>

        <section className="mb-8">
          <h3 className="text-[#e2b714] mb-3">Input</h3>
          <div className="bg-[#2c2e31] border border-[#646669] rounded p-4">
            <p className="text-[#d1d0c5] text-sm leading-relaxed">{problem.input_format}</p>
          </div>
        </section>

        <section className="mb-8">
          <h3 className="text-[#e2b714] mb-3">Output</h3>
          <div className="bg-[#2c2e31] border border-[#646669] rounded p-4">
            <p className="text-[#d1d0c5] text-sm leading-relaxed">{problem.output_format}</p>
          </div>
        </section>

        <section className="mb-8">
          <h3 className="text-[#e2b714] mb-3">Examples</h3>
          <div className="space-y-4">
            {problem.samples.map((sample, index) => (
              <div key={index} className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="text-[#646669] text-xs mb-2">Input</div>
                  <div className="bg-[#2c2e31] border border-[#646669] rounded p-3">
                    <pre className="text-[#d1d0c5] text-sm whitespace-pre-wrap">{sample.input}</pre>
                  </div>
                </div>
                <div>
                  <div className="text-[#646669] text-xs mb-2">Output</div>
                  <div className="bg-[#2c2e31] border border-[#646669] rounded p-3">
                    <pre className="text-[#d1d0c5] text-sm whitespace-pre-wrap">{sample.output}</pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {problem.note && (
          <section>
            <h3 className="text-[#e2b714] mb-3">Note</h3>
            <p className="text-[#646669] text-sm leading-relaxed">{problem.note}</p>
          </section>
        )}
      </div>
    </div>
  );
}

function CodeEditor({
  code,
  setCode,
  selectedLanguage,
  setSelectedLanguage,
  languages,
  onSubmit,
  submitMessage,
  onRun,
  runMessage,
}: {
  code: string;
  setCode: (code: string) => void;
  selectedLanguage: string;
  setSelectedLanguage: (lang: string) => void;
  languages: LanguageOption[];
  onSubmit: () => void;
  submitMessage: string;
  onRun: () => void;
  runMessage: string;
}) {
  const hasLanguages = languages.length > 0;

  return (
    <div className="flex flex-col bg-[#2c2e31]">
      <div className="border-b border-[#646669] px-6 py-3 flex items-center justify-between">
        <select
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
          disabled={!hasLanguages}
          className="bg-[#323437] border border-[#646669] rounded px-3 py-1.5 text-[#d1d0c5] text-sm focus:outline-none focus:border-[#e2b714]"
        >
          {hasLanguages ? (
            languages.map((language) => (
              <option key={language.id} value={language.id}>
                {language.label}
              </option>
            ))
          ) : (
            <option value="">No online runner</option>
          )}
        </select>
        <div className="flex items-center gap-2 text-[#646669] text-xs">
          <span>Tab: 4 spaces</span>
        </div>
      </div>

      <div className="flex-1 relative min-h-[400px]">
        <HighlightedCodeArea code={code} language={selectedLanguage} onChange={setCode} />
      </div>

      <div className="border-t border-[#646669] px-6 py-4 flex items-center justify-between bg-[#323437]">
        <div className="flex items-center gap-4">
          <button
            onClick={onRun}
            className="px-4 py-1.5 text-sm border border-[#646669] rounded text-[#646669] hover:border-[#e2b714] hover:text-[#e2b714] transition-colors flex items-center gap-2"
          >
            <Play size={14} />
            Run
          </button>
          <span className="text-[#646669] text-xs">{runMessage || "Ctrl + Enter"}</span>
        </div>
        <div className="flex items-center gap-3">
          {submitMessage && <span className="text-[#646669] text-xs">{submitMessage}</span>}
          <button
            onClick={onSubmit}
            disabled={!hasLanguages}
            className="px-6 py-1.5 text-sm bg-[#e2b714] text-[#323437] rounded hover:bg-[#d1a613] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

function HighlightedCodeArea({
  code,
  language,
  onChange,
}: {
  code: string;
  language: string;
  onChange: (code: string) => void;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const keywords =
    language === "python"
      ? /\b(import|from|def|class|return|if|elif|else|for|while|in|not|and|or|try|except|with|as|True|False|None|print|input|range|int|float|str|list|dict|set|len|map|sum|max|min)\b/
      : /\b(#include|using|namespace|int|long long|long|double|float|char|bool|string|vector|map|set|queue|stack|return|if|else|for|while|cin|cout|std|true|false|void|auto|const)\b/;

  const renderLine = (line: string, index: number) => {
    const commentStart = language === "python" ? line.indexOf("#") : line.indexOf("//");
    const codePart = commentStart >= 0 ? line.slice(0, commentStart) : line;
    const commentPart = commentStart >= 0 ? line.slice(commentStart) : "";
    const tokens = codePart.split(/("[^"]*"|'[^']*'|\b\d+(?:\.\d+)?\b)/g);
    return (
      <span key={index}>
        {tokens.map((token, tokenIndex) => {
          if (!token) return null;
          if (/^["']/.test(token)) return <span key={tokenIndex} className="text-[#879f27]">{token}</span>;
          if (/^\d/.test(token)) return <span key={tokenIndex} className="text-[#e2b714]">{token}</span>;
          const parts = token.split(keywords);
          return parts.map((part, partIndex) =>
            keywords.test(part) ? (
              <span key={`${tokenIndex}-${partIndex}`} className="text-[#d19a66]">{part}</span>
            ) : (
              <span key={`${tokenIndex}-${partIndex}`}>{part}</span>
            ),
          );
        })}
        {commentPart && <span className="text-[#646669]">{commentPart}</span>}
        {"\n"}
      </span>
    );
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#2c2e31]">
      <pre
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 min-h-full whitespace-pre-wrap break-words p-6 font-mono text-sm leading-relaxed text-[#d1d0c5]"
        style={{ transform: `translateY(-${scrollTop}px)`, tabSize: 4 }}
      >
        {code.split("\n").map(renderLine)}
      </pre>
      <textarea
        value={code}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          e.preventDefault();
          const target = e.currentTarget;
          const next = `${code.slice(0, target.selectionStart)}    ${code.slice(target.selectionEnd)}`;
          const cursor = target.selectionStart + 4;
          onChange(next);
          window.requestAnimationFrame(() => {
            target.selectionStart = cursor;
            target.selectionEnd = cursor;
          });
        }}
        className="absolute inset-0 w-full h-full resize-none bg-transparent p-6 font-mono text-sm leading-relaxed text-transparent caret-[#d1d0c5] selection:bg-[#e2b71455] focus:outline-none"
        spellCheck={false}
        style={{ tabSize: 4 }}
      />
    </div>
  );
}

function SubmissionsList({ submissions, compact = false }: { submissions: Submission[]; compact?: boolean }) {
  const statusColor = (status: Submission["status"]) => {
    if (status === "AC") return "text-[#879f27]";
    if (["WA", "TLE", "MLE", "RE", "CE"].includes(status)) return "text-[#ca4754]";
    return "text-[#e2b714]";
  };

  return (
    <div className={compact ? "p-4" : "p-6"}>
      <h3 className="text-[#e2b714] mb-4">Your Submissions</h3>
      <div className="space-y-3">
        {submissions.map((sub) => (
          <div key={sub.id} className="border border-[#646669] rounded p-4">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm ${statusColor(sub.status)}`}>
                {sub.status}
              </span>
              <span className="text-xs text-[#646669]">{new Date(sub.submittedAt).toLocaleString()}</span>
            </div>
            <div className="mb-2 text-sm text-[#d1d0c5]">
              {sub.contestId} / {sub.problem}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#646669]">
              <span>{sub.language}</span>
              <span>{sub.time}</span>
              <span>{sub.memory}</span>
            </div>
            <div className="mt-3 border-t border-[#3c3f43] pt-3">
              <div className="mb-1 text-[11px] uppercase tracking-wide text-[#646669]">System result</div>
              <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-words rounded bg-[#2c2e31] p-3 text-xs leading-relaxed text-[#d1d0c5]">
                {sub.judge_output || (sub.status === "Pending" || sub.status === "Running" ? "Waiting for runner..." : "No judge output yet.")}
              </pre>
            </div>
          </div>
        ))}
        {submissions.length === 0 && <div className="text-[#646669]">No submissions yet.</div>}
      </div>
    </div>
  );
}
