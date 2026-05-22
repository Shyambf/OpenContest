import { useState } from "react";
import { useNavigate } from "react-router";
import { ChevronRight } from "lucide-react";
import { api } from "../api";

type UserRole = "participant" | "admin";

export function Auth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState<UserRole>("participant");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    try {
      const session =
        mode === "login"
          ? await api.login({ username, password })
          : await api.register({ username, email, password, role });
      api.setSession(session.token, session.user);
      navigate(session.user.role === "admin" ? "/admin" : "/contests");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    }
  };

  return (
    <div className="min-h-screen bg-[#323437] flex items-center justify-center px-6 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-[#e2b714] mb-2">OpenContest</h1>
          <p className="text-[#646669]">
            {mode === "login" ? "Sign in to continue" : "Create your account"}
          </p>
        </div>

        {/* Role Toggle */}
        <div className="flex gap-2 mb-8">
          <button
            type="button"
            onClick={() => setRole("participant")}
            className={`flex-1 px-4 py-2 border rounded transition-colors ${
              role === "participant"
                ? "bg-[#e2b714] text-[#323437] border-[#e2b714]"
                : "border-[#646669] text-[#646669] hover:border-[#e2b714] hover:text-[#e2b714]"
            }`}
          >
            Participant
          </button>
          <button
            type="button"
            onClick={() => setRole("admin")}
            className={`flex-1 px-4 py-2 border rounded transition-colors ${
              role === "admin"
                ? "bg-[#e2b714] text-[#323437] border-[#e2b714]"
                : "border-[#646669] text-[#646669] hover:border-[#e2b714] hover:text-[#e2b714]"
            }`}
          >
            Administrator
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username Field */}
          <div>
            <label className="block text-[#646669] text-sm mb-2">
              <span className="text-[#e2b714]">{">"}</span> username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="_"
              className="w-full bg-transparent border-b border-[#646669] px-1 py-2 text-[#d1d0c5] placeholder-[#646669] focus:outline-none focus:border-[#e2b714] transition-colors"
              required
            />
          </div>

          {/* Email Field (Register only) */}
          {mode === "register" && (
            <div>
              <label className="block text-[#646669] text-sm mb-2">
                <span className="text-[#e2b714]">{">"}</span> email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="_"
                className="w-full bg-transparent border-b border-[#646669] px-1 py-2 text-[#d1d0c5] placeholder-[#646669] focus:outline-none focus:border-[#e2b714] transition-colors"
                required
              />
            </div>
          )}

          {/* Password Field */}
          <div>
            <label className="block text-[#646669] text-sm mb-2">
              <span className="text-[#e2b714]">{">"}</span> password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="_"
              className="w-full bg-transparent border-b border-[#646669] px-1 py-2 text-[#d1d0c5] placeholder-[#646669] focus:outline-none focus:border-[#e2b714] transition-colors"
              required
            />
          </div>

          {/* Confirm Password (Register only) */}
          {mode === "register" && (
            <div>
              <label className="block text-[#646669] text-sm mb-2">
                <span className="text-[#e2b714]">{">"}</span> confirm_password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="_"
                className="w-full bg-transparent border-b border-[#646669] px-1 py-2 text-[#d1d0c5] placeholder-[#646669] focus:outline-none focus:border-[#e2b714] transition-colors"
                required
              />
            </div>
          )}

          {/* Role Badge */}
          <div className="flex items-center gap-2 text-xs text-[#646669]">
            <span>Signing in as:</span>
            <span className="px-2 py-0.5 border border-[#e2b714] text-[#e2b714] rounded">
              {role}
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full px-6 py-3 bg-[#e2b714] text-[#323437] rounded hover:bg-[#d1a613] transition-colors flex items-center justify-center gap-2"
          >
            <span>{mode === "login" ? "Sign In" : "Create Account"}</span>
            <ChevronRight size={16} />
          </button>
          {error && <div className="text-[#ca4754] text-sm">{error}</div>}
        </form>

        {/* Mode Toggle */}
        <div className="mt-8 text-center text-sm">
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="text-[#646669] hover:text-[#e2b714] transition-colors"
          >
            {mode === "login" ? (
              <>
                Don't have an account? <span className="underline">Register</span>
              </>
            ) : (
              <>
                Already have an account? <span className="underline">Sign In</span>
              </>
            )}
          </button>
        </div>

        {/* Terminal Aesthetic Footer */}
        <div className="mt-12 text-center text-xs text-[#646669]">
          <div className="mb-2">OpenContest v1.0.0</div>
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#879f27] animate-pulse" />
            <span>System Online</span>
          </div>
        </div>
      </div>
    </div>
  );
}
