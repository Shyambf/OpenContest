import { useState } from "react";
import { Outlet, Link, Navigate, useLocation, useNavigate } from "react-router";
import { Menu, X } from "lucide-react";
import { api } from "../../api";

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const user = api.currentUser();

  const isActive = (path: string) => location.pathname.startsWith(path);

  const navItems = [
    { name: "Overview", path: "/admin" },
    { name: "Contests Management", path: "/admin/contests" },
    { name: "Problem Bank", path: "/admin/problems" },
    { name: "All Submissions", path: "/admin/submissions" },
    { name: "Clarifications", path: "/admin/clarifications" },
  ];

  const handleLogout = () => {
    api.logout();
    navigate("/login");
  };

  if (user?.role !== "admin") {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-[#323437]">
      {/* Top Header */}
      <header className="border-b border-[#646669] bg-[#323437] sticky top-0 z-50">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden text-[#d1d0c5] hover:text-[#e2b714]"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <Link to="/admin" className="text-[#e2b714] hover:underline">
              <span className="text-xl">OpenContest</span>
            </Link>
            <span className="px-2 py-0.5 text-xs border border-[#ca4754] text-[#ca4754] rounded">
              ADMIN
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/contests"
              className="text-[#646669] hover:text-[#e2b714] text-sm transition-colors hidden md:block"
            >
              View as Participant
            </Link>
            <button
              onClick={handleLogout}
              className="text-[#646669] hover:text-[#e2b714] text-sm transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:block w-64 border-r border-[#646669] min-h-[calc(100vh-61px)] sticky top-[61px]">
          <nav className="p-4">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-4 py-3 mb-1 rounded transition-colors ${
                  isActive(item.path) && (item.path === "/admin" ? location.pathname === "/admin" : true)
                    ? "bg-[#e2b714] text-[#323437]"
                    : "text-[#646669] hover:text-[#e2b714] hover:bg-[#2c2e31]"
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <aside className="md:hidden fixed inset-0 top-[61px] bg-[#323437] z-40 border-r border-[#646669]">
            <nav className="p-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`block px-4 py-3 mb-1 rounded transition-colors ${
                    isActive(item.path) && (item.path === "/admin" ? location.pathname === "/admin" : true)
                      ? "bg-[#e2b714] text-[#323437]"
                      : "text-[#646669] hover:text-[#e2b714]"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              <Link
                to="/contests"
                onClick={() => setSidebarOpen(false)}
                className="block px-4 py-3 mb-1 text-[#646669] hover:text-[#e2b714] border-t border-[#646669] mt-4 pt-4"
              >
                ← View as Participant
              </Link>
            </nav>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
