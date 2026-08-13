interface ProgressBarProps {
  /** 0–100 percentage */
  percent: number;
  /** Whether delivered value exceeds the agreed amount */
  isOverBudget?: boolean;
  className?: string;
}

export function ProgressBar({ percent, isOverBudget = false, className = "" }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Delivered value progress"
        className="h-2 w-full overflow-hidden rounded-full bg-cream-50/20"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isOverBudget
              ? "bg-gradient-to-r from-cream-50 to-taupe-200"
              : "bg-gradient-to-r from-cream-50/60 to-cream-50"
          }`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
