export const DEFAULT_DELIVERY_AFTER_COMPLETION_DAYS = 2;
export const DEFAULT_REFUND_DEDUCTION_PERCENT = 32;

export function effectiveDeliveryAfterCompletionDays(value: unknown) {
  const days = Number(value);
  return Number.isInteger(days) && days > 0
    ? days
    : DEFAULT_DELIVERY_AFTER_COMPLETION_DAYS;
}

export function effectiveRefundDeductionRate(value: unknown) {
  const percent = Number(value);
  return Number.isFinite(percent) && percent > 0 && percent <= 100
    ? percent / 100
    : DEFAULT_REFUND_DEDUCTION_PERCENT / 100;
}

export function minimumInitialDepositError(
  minimumDeposit: unknown,
  firstPayment: unknown
) {
  const minimum = Number(minimumDeposit);
  const payment = Number(firstPayment);
  if (!Number.isFinite(minimum) || minimum <= 0) return null;
  if (!Number.isFinite(payment) || payment < minimum) return minimum;
  return null;
}
