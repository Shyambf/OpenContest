import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { Search, Menu, X, Cpu } from "lucide-react";
import { api, type Contest, type ProblemSummary, type RunnerStats, type Submission } from "../api";

type SearchItem = {
  label: string;
  detail: string;
  path: string;
};

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [user, setUser] = useState(api.currentUser());
  const [runnerStats, setRunnerStats] = useState<RunnerStats | null>(null);
  const [contests, setContests] = useState<Contest[]>([]);
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const location = useLocation();

  useEffect(() => {
    const loadStats = () => {
      api.runnerStats()
        .then(setRunnerStats)
        .catch(() => {});
    };
    loadStats();
    const interval = setInterval(loadStats, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    api.contests().then(setContests).catch(() => undefined);
    api.problems().then(setProblems).catch(() => undefined);
    if (user) {
      api.submissions().then(setSubmissions).catch(() => undefined);
    }
  }, [user]);

  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  const standingsContest = contests.find((contest) => contest.status === "live") ?? contests[0];
  const profilePath = user ? `/profile/${user.username}` : "/login";

  const links = [
    { name: "Contests", path: "/contests" },
    { name: "Gym", path: "/gym" },
    { name: "Standings", path: standingsContest ? `/standings/${standingsContest.id}` : "/contests" },
    { name: "Profile", path: profilePath },
  ];

  const searchItems: SearchItem[] = [
    ...contests.map((contest) => ({
      label: contest.title,
      detail: `${contest.status} contest`,
      path: `/problem/${contest.id}/A`,
    })),
    ...problems.map((problem) => ({
      label: problem.name,
      detail: `problem - ${problem.difficulty}`,
      path: problem.usedIn.length ? `/problem/${contests.find((contest) => contest.title === problem.usedIn[0])?.id ?? ""}/A` : "/admin/problems",
    })),
    ...Array.from(new Set(submissions.map((submission) => submission.user))).map((username) => ({
      label: username,
      detail: "participant",
      path: `/profile/${username}`,
    })),
  ];

  const filteredSearchItems = searchItems
    .filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(query.toLowerCase()))
    .filter((item) => item.path !== "/problem//A")
    .slice(0, 8);

  const closeMenus = () => {
    setSearchOpen(false);
    setMobileMenuOpen(false);
    setQuery("");
  };

  return (
    <>
      {/* Desktop Navigation */}
      <header className="border-b border-[#646669] bg-[#323437] sticky top-0 z-50">
        <div className="max-w-[1440px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-[#e2b714] hover:underline">
              <span className="text-xl">OpenContest</span>
            </Link>

            {/* Desktop Links */}
            <nav className="hidden md:flex items-center gap-8">
              {links.map((link) => (
                <Link
                  key={`${link.name}-${link.path}`}
                  to={link.path}
                  className={`hover:text-[#e2b714] transition-colors ${
                    isActive(link.path) ? "text-[#e2b714]" : "text-[#d1d0c5]"
                  }`}
                >
                  {link.name}
                </Link>
              ))}

              {runnerStats && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#2c2e31] rounded-full border border-[#646669]" title="Runner Pods (Busy / Online)">
                  <Cpu size={14} className={runnerStats.summary.busy > 0 ? "text-[#e2b714] animate-pulse" : "text-[#879f27]"} />
                  <span className="text-xs font-mono text-[#d1d0c5]">
                    {runnerStats.summary.busy}<span className="text-[#646669]">/</span>{runnerStats.summary.online}
                  </span>
                </div>
              )}

              <Link
                to={user ? `/profile/${user.username}` : "/login"}
                className="px-3 py-1.5 text-sm border border-[#646669] rounded text-[#646669] hover:border-[#e2b714] hover:text-[#e2b714] transition-colors"
              >
                {user ? user.username : "Login"}
              </Link>
              {user?.role === "admin" && (
                <Link
                  to="/admin"
                  className="px-3 py-1.5 text-sm border border-[#e2b714] rounded text-[#e2b714] hover:bg-[#e2b714] hover:text-[#323437] transition-colors"
                >
                  Admin
                </Link>
              )}
              {user && (
                <button
                  onClick={() => {
                    api.logout();
                    setUser(null);
                  }}
                  className="text-[#646669] hover:text-[#e2b714] transition-colors text-sm"
                >
                  Logout
                </button>
              )}
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="text-[#d1d0c5] hover:text-[#e2b714] transition-colors"
                aria-label="Search"
              >
                <Search size={20} />
              </button>
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-[#d1d0c5] hover:text-[#e2b714]"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Command Palette / Search */}
        {searchOpen && (
          <div className="border-t border-[#646669] bg-[#2c2e31] px-6 py-3">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search problems, contests, users..."
              className="w-full bg-transparent border border-[#646669] rounded px-3 py-2 text-[#d1d0c5] placeholder-[#646669] focus:outline-none focus:border-[#e2b714]"
              autoFocus
            />
            {query && (
              <div className="max-w-[1440px] mx-auto mt-3 border border-[#646669] rounded overflow-hidden">
                {filteredSearchItems.map((item) => (
                  <Link
                    key={`${item.path}-${item.label}`}
                    to={item.path}
                    onClick={closeMenus}
                    className="block px-4 py-3 bg-[#323437] hover:bg-[#2c2e31] border-b border-[#646669] last:border-b-0"
                  >
                    <div className="text-[#d1d0c5]">{item.label}</div>
                    <div className="text-xs text-[#646669]">{item.detail}</div>
                  </Link>
                ))}
                {filteredSearchItems.length === 0 && (
                  <div className="px-4 py-3 bg-[#323437] text-[#646669]">Nothing found</div>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[60px] bg-[#323437] z-40 border-t border-[#646669]">
          <nav className="flex flex-col p-6 gap-4">
            {links.map((link) => (
              <Link
                key={`${link.name}-${link.path}`}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`py-3 border-b border-[#646669] hover:text-[#e2b714] transition-colors ${
                  isActive(link.path) ? "text-[#e2b714]" : "text-[#d1d0c5]"
                }`}
              >
                {link.name}
              </Link>
            ))}
            <button
              onClick={() => {
                setSearchOpen(!searchOpen);
                setMobileMenuOpen(false);
              }}
              className="py-3 text-left text-[#d1d0c5] hover:text-[#e2b714] border-b border-[#646669]"
            >
              Search
            </button>
          </nav>
        </div>
      )}

      {/* Mobile Bottom Bar Alternative */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#323437] border-t border-[#646669] z-50 px-4 py-3">
        <div className="flex justify-around items-center max-w-[390px] mx-auto">
          {links.map((link) => (
            <Link
              key={`${link.name}-${link.path}`}
              to={link.path}
              className={`flex flex-col items-center gap-1 text-xs ${
                isActive(link.path) ? "text-[#e2b714]" : "text-[#646669]"
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isActive(link.path) ? "bg-[#e2b714]" : "bg-transparent"}`} />
              <span>{link.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
