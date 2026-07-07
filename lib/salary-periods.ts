export function salaryMonthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function salaryMonthEnd(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function previousSalaryMonthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

export function salaryMonthInputValue(date = previousSalaryMonthStart()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function parseSalaryMonth(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) {
    return null;
  }

  return new Date(year, month - 1, 1);
}

export function isFutureSalaryMonth(month: Date, now = new Date()) {
  return salaryMonthStart(month) > salaryMonthStart(now);
}
