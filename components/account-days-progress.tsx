import { getAccountDaysProgress } from "@/lib/accounts";

type AccountDaysProgressProps = {
  totalPaid: number;
  dailyAmount: number;
  duration: number;
  showLabel?: boolean;
};

export function AccountDaysProgress({
  totalPaid,
  dailyAmount,
  duration,
  showLabel = false,
}: AccountDaysProgressProps) {
  const progress = getAccountDaysProgress({
    totalPaid,
    dailyAmount,
    duration,
  });
  const percentageLabel = `${progress.progressPercentage.toFixed(1)}%`;

  return (
    <div className="min-w-44 space-y-2">
      {showLabel ? (
        <p className="text-sm font-medium text-gray-600">Paid Progress</p>
      ) : null}

      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold text-gray-950">
          {progress.daysPaidFor} / {progress.duration} Days
        </span>
        <span className="text-xs font-medium text-gray-600">
          {percentageLabel}
        </span>
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
        aria-label="Days paid progress"
        aria-valuemin={0}
        aria-valuemax={progress.duration}
        aria-valuenow={progress.daysPaidFor}
      >
        <div
          className="glv-progress-fill h-full rounded-full bg-lime-500"
          style={{ width: percentageLabel }}
        />
      </div>

      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-gray-600">
        <span>Days Paid For: {progress.daysPaidFor}</span>
        <span>Days Remaining: {progress.daysRemaining}</span>
      </div>
    </div>
  );
}
