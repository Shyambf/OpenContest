import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Trophy, Target, Award } from "lucide-react";
import { api, type ProfilePayload } from "../api";

export function Profile() {
  const { username } = useParams();
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (!username) return;
    api
      .profile(username)
      .then((payload) => {
        setProfile(payload);
        setEmail(payload.email ?? "");
        setFirstName(payload.firstName ?? "");
        setLastName(payload.lastName ?? "");
      })
      .catch((err) => setError(err.message));
  }, [username]);

  const saveProfile = async () => {
    if (!profile) return;
    setSaveMessage("Saving...");
    try {
      const updated = await api.updateProfile(profile.username, {
        email,
        first_name: firstName,
        last_name: lastName,
      });
      setProfile(updated);
      setEditing(false);
      setSaveMessage("Profile saved.");
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Save failed");
    }
  };

  const currentRating = profile?.currentRating ?? 0;
  const maxRating = profile?.maxRating ?? currentRating;

  const getRatingColor = (rating: number) => {
    if (rating >= 3000) return "#ca4754";
    if (rating >= 2400) return "#e2b714";
    if (rating >= 2100) return "#879f27";
    if (rating >= 1900) return "#d1d0c5";
    return "#646669";
  };

  const getRatingTitle = (rating: number) => {
    if (rating >= 3000) return "Legendary Grandmaster";
    if (rating >= 2400) return "International Grandmaster";
    if (rating >= 2100) return "Grandmaster";
    if (rating >= 1900) return "Master";
    if (rating >= 1600) return "Candidate Master";
    if (rating >= 1400) return "Expert";
    if (rating >= 1200) return "Specialist";
    return "Pupil";
  };

  const getActivityColor = (count: number) => {
    if (count === 0) return "#2c2e31";
    if (count <= 3) return "#e2b71433";
    if (count <= 6) return "#e2b71466";
    if (count <= 9) return "#e2b71499";
    return "#e2b714";
  };

  const ratingHistory = profile?.ratingHistory ?? [];
  const activityData = profile?.activity ?? [];
  const recentSubmissions = profile?.recentSubmissions ?? [];

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8 pb-24 md:pb-8">
      <Link to="/contests" className="text-[#646669] hover:text-[#e2b714] text-sm mb-6 inline-block">
        Back to Contests
      </Link>

      {error && <div className="border border-[#ca4754] rounded p-4 text-[#ca4754] mb-6">{error}</div>}
      {!profile && !error && <div className="text-[#646669]">Loading profile...</div>}

      {profile && (
        <>
          <div className="border border-[#646669] rounded p-6 md:p-8 mb-8">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <div className="w-24 h-24 bg-[#2c2e31] border border-[#646669] rounded flex items-center justify-center">
                <div className="grid grid-cols-4 grid-rows-4 gap-px w-16 h-16">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} className={[0, 3, 5, 6, 9, 10, 12, 15].includes(i) ? "bg-[#e2b714]" : "bg-[#646669]"} />
                  ))}
                </div>
              </div>

              <div className="flex-1">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-2">
                  <div>
                    <h1 className="text-[#d1d0c5]">{profile.username}</h1>
                    {(profile.firstName || profile.lastName) && (
                      <div className="text-[#646669] text-sm">{[profile.firstName, profile.lastName].filter(Boolean).join(" ")}</div>
                    )}
                  </div>
                  {profile.canEdit && (
                    <button
                      onClick={() => setEditing((value) => !value)}
                      className="w-fit px-4 py-2 border border-[#646669] rounded text-[#646669] hover:border-[#e2b714] hover:text-[#e2b714] transition-colors text-sm"
                    >
                      {editing ? "Cancel" : "Edit Profile"}
                    </button>
                  )}
                </div>
                <div
                  className="inline-block px-3 py-1 rounded text-sm mb-3"
                  style={{
                    backgroundColor: `${getRatingColor(currentRating)}33`,
                    color: getRatingColor(currentRating),
                    border: `1px solid ${getRatingColor(currentRating)}`,
                  }}
                >
                  {getRatingTitle(currentRating)}
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-[#646669]">
                  <div>
                    Rating: <span style={{ color: getRatingColor(currentRating) }}>{currentRating}</span>
                  </div>
                  <div>Max: {maxRating}</div>
                  <div>Contests: {profile.contestsAttended}</div>
                </div>
                {editing && (
                  <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <ProfileInput label="Email" value={email} onChange={setEmail} />
                    <ProfileInput label="First name" value={firstName} onChange={setFirstName} />
                    <ProfileInput label="Last name" value={lastName} onChange={setLastName} />
                    <div className="md:col-span-3 flex items-center gap-3">
                      <button
                        onClick={saveProfile}
                        className="px-5 py-2 bg-[#e2b714] text-[#323437] rounded hover:bg-[#d1a613] transition-colors text-sm"
                      >
                        Save
                      </button>
                      {saveMessage && <span className="text-[#646669] text-sm">{saveMessage}</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Stat icon={Target} title="Problems Solved" value={profile.problemsSolved} color="#e2b714" detail="Accepted submissions by distinct problem" />
            <Stat icon={Trophy} title="Best Rank" value={profile.globalRank ? `#${profile.globalRank}` : "-"} color="#879f27" detail="Best seeded standings rank" />
            <Stat icon={Award} title="Contests Attended" value={profile.contestsAttended} color="#d1d0c5" detail="Contests with at least one submission" />
          </div>

          <div className="border border-[#646669] rounded p-6 mb-8">
            <h2 className="text-[#e2b714] mb-6">Rating History</h2>
            <div className="h-64 md:h-80">
              {ratingHistory.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ratingHistory}>
                    <XAxis dataKey="contest" stroke="#646669" tick={{ fill: "#646669", fontSize: 12 }} axisLine={{ stroke: "#646669" }} />
                    <YAxis stroke="#646669" tick={{ fill: "#646669", fontSize: 12 }} axisLine={{ stroke: "#646669" }} domain={[0, "dataMax + 200"]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#323437", border: "1px solid #646669", borderRadius: "4px", color: "#d1d0c5" }}
                      labelStyle={{ color: "#646669" }}
                    />
                    <Line type="monotone" dataKey="rating" stroke="#e2b714" strokeWidth={2} dot={{ fill: "#e2b714", r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[#646669]">No standings rows yet.</div>
              )}
            </div>
          </div>

          <div className="border border-[#646669] rounded p-6 mb-8">
            <h2 className="text-[#e2b714] mb-6">Activity</h2>
            <div className="overflow-x-auto">
              <div className="inline-flex gap-1 min-w-max">
                {activityData.map((day, index) => (
                  <div key={day.date} className="flex flex-col items-center gap-1">
                    <div
                      className="w-4 h-4 md:w-3 md:h-3 rounded-sm border border-[#646669]"
                      style={{ backgroundColor: getActivityColor(day.count) }}
                      title={`${day.date}: ${day.count} submissions`}
                    />
                    {index % 4 === 0 && (
                      <span className="text-[8px] text-[#646669] mt-1">
                        {new Date(day.date).toLocaleDateString("en-US", { month: "short" })}
                      </span>
                    )}
                  </div>
                ))}
                {activityData.length === 0 && <div className="text-[#646669]">No submissions yet.</div>}
              </div>
            </div>
          </div>

          <div className="border border-[#646669] rounded p-6">
            <h2 className="text-[#e2b714] mb-6">Recent Submissions</h2>
            <div className="space-y-3">
              {recentSubmissions.map((sub) => (
                <div key={sub.id} className="border border-[#646669] rounded p-4 hover:border-[#e2b714] transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex-1">
                      <div className="text-[#d1d0c5] mb-1">{sub.problem}</div>
                      <div className="flex gap-4 text-xs text-[#646669]">
                        <span>{new Date(sub.submittedAt).toLocaleString()}</span>
                        <span>{sub.time}</span>
                        <span>{sub.memory}</span>
                      </div>
                    </div>
                    <div className={`text-sm ${sub.status === "AC" ? "text-[#879f27]" : sub.status === "WA" ? "text-[#ca4754]" : "text-[#646669]"}`}>
                      {sub.status}
                    </div>
                  </div>
                </div>
              ))}
              {recentSubmissions.length === 0 && <div className="text-[#646669]">No submissions yet.</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ProfileInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[#646669] text-xs mb-1">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-[#2c2e31] border border-[#646669] rounded px-3 py-2 text-[#d1d0c5] text-sm focus:outline-none focus:border-[#e2b714]"
      />
    </label>
  );
}

function Stat({ icon: Icon, title, value, color, detail }: { icon: typeof Target; title: string; value: number | string; color: string; detail: string }) {
  return (
    <div className="border border-[#646669] rounded p-6">
      <div className="flex items-center gap-3 mb-2">
        <Icon style={{ color }} size={20} />
        <h3 className="text-[#d1d0c5]">{title}</h3>
      </div>
      <div className="text-3xl" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-[#646669] mt-1">{detail}</div>
    </div>
  );
}
