interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  variant?: "default" | "success" | "error";
}

export function ProgressBar({ progress, label, variant = "default" }: ProgressBarProps) {
  const colors = {
    default: "#e2b714",
    success: "#879f27",
    error: "#ca4754",
  };

  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[#d1d0c5]">{label}</span>
          <span className="text-xs text-[#646669]">{Math.round(progress)}%</span>
        </div>
      )}
      <div className="w-full h-1 bg-[#2c2e31] rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{
            width: `${progress}%`,
            backgroundColor: colors[variant],
          }}
        />
      </div>
    </div>
  );
}
