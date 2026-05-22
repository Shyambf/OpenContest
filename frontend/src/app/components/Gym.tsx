import { Link } from "react-router";
import { Dumbbell, Users, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Contest } from "../api";

export function Gym() {
  const [gyms, setGyms] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .gyms()
      .then(setGyms)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const getDifficultyColor = (difficulty?: Contest["difficulty"]) => {
    switch (difficulty) {
      case "Easy":
        return "text-[#879f27] border-[#879f27]";
      case "Medium":
        return "text-[#e2b714] border-[#e2b714]";
      case "Hard":
        return "text-[#ca4754] border-[#ca4754]";
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-[#e2b714] mb-2">Gym</h1>
        <p className="text-[#646669]">Practice problem sets and training contests</p>
      </div>

      {loading && <div className="text-[#646669]">Loading gym...</div>}
      {error && <div className="text-[#ca4754]">Backend unavailable: {error}</div>}

      {/* Gym List */}
      <div className="space-y-4">
        {gyms.map((gym) => (
          <GymCard key={gym.id} gym={gym} getDifficultyColor={getDifficultyColor} />
        ))}
      </div>
    </div>
  );
}

function GymCard({
  gym,
  getDifficultyColor,
}: {
  gym: Contest;
  getDifficultyColor: (difficulty?: Contest["difficulty"]) => string;
}) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block border border-[#646669] rounded hover:border-[#e2b714] transition-colors group">
        <div className="px-6 py-4 grid grid-cols-[2fr_1fr_auto_auto_auto] gap-6 items-center">
          <div>
            <Link
              to={`/problem/${gym.id}/A`}
              className="text-[#d1d0c5] group-hover:text-[#e2b714] transition-colors mb-1 block"
            >
              {gym.title}
            </Link>
            <div className="text-sm text-[#646669]">by {gym.author}</div>
          </div>
          <div>
            <span className={`px-3 py-1 text-xs border rounded ${getDifficultyColor(gym.difficulty)}`}>
              {gym.difficulty ?? "Medium"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[#646669] text-sm">
            <Dumbbell size={14} />
            <span>{gym.problemCount ?? 0} problems</span>
          </div>
          <div className="flex items-center gap-2 text-[#646669] text-sm">
            <Users size={14} />
            <span>{(gym.solvedBy ?? 0).toLocaleString()}</span>
          </div>
          <div>
            <Link
              to={`/problem/${gym.id}/A`}
              className="px-4 py-1.5 text-sm border border-[#646669] rounded text-[#646669] hover:border-[#e2b714] hover:text-[#e2b714] transition-colors inline-block"
            >
              Start
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden border border-[#646669] rounded">
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <Link
              to={`/problem/${gym.id}/A`}
              className="text-[#d1d0c5] hover:text-[#e2b714] flex-1"
            >
              {gym.title}
            </Link>
            <span
              className={`ml-3 px-2 py-0.5 text-xs border rounded ${getDifficultyColor(
                gym.difficulty
              )}`}
            >
            {gym.difficulty ?? "Medium"}
          </span>
          </div>
          <div className="text-sm text-[#646669] mb-4">by {gym.author ?? "OpenContest"}</div>
          <div className="flex gap-4 text-sm text-[#646669] mb-4">
            <div className="flex items-center gap-2">
              <Dumbbell size={14} />
              <span>{gym.problemCount ?? 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users size={14} />
              <span>{(gym.solvedBy ?? 0).toLocaleString()}</span>
            </div>
          </div>
          <Link
            to={`/problem/${gym.id}/A`}
            className="block text-center px-4 py-2 text-sm border border-[#646669] rounded text-[#646669] hover:border-[#e2b714] hover:text-[#e2b714] transition-colors"
          >
            Start Practice
          </Link>
        </div>
      </div>
    </>
  );
}
