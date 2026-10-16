import { getAccountDaysProgress } from "@/lib/accounts";

type AccountDaysProgressProps = {
  totalPaid: number;
  targetAmount: number;
  dailyAmount: number;
  duration: number;
  showLabel?: boolean;
};

export function AccountDaysProgress({
  totalPaid,
  targetAmount,
  dailyAmount,
  duration,
  showLabel = false,
}: AccountDaysProgressProps) {
  const progress = getAccountDaysProgress({
    totalPaid,
    dailyAmount,
    duration,
  });
  const amountProgress =
    targetAmount > 0
      ? Math.min(Math.max((Math.max(totalPaid, 0) / targetAmount) * 100, 0), 100)
      : 0;
  const percentageLabel = `${amountProgress.toFixed(1)}%`;

  return (
    <div className="min-w-44 space-y-2">
      {showLabel ? (
        <p className="text-sm font-medium text-gray-600">Amount paid toward target</p>
      ) : null}

      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold text-gray-950">
          {percentageLabel} of target
        </span>
        <span className="text-xs font-medium text-gray-600">
          {progress.daysPaidFor} / {progress.duration} days
        </span>
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
        aria-label="Amount paid toward account target"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={amountProgress}
      >
        <div
          className="glv-progress-fill h-full rounded-full bg-lime-500"
          style={{ width: percentageLabel }}
        />
      </div>

      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-gray-600">
        <span>Days covered: {progress.daysPaidFor}</span>
        <span>Days remaining: {progress.daysRemaining}</span>
      </div>
    </div>
  );
}
