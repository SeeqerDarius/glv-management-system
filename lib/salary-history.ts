export type SalaryHistoryEntry = {
  effectiveMonth: Date;
  monthlySalary: number;
};

export type SalaryTrackedStaff = {
  monthlySalary: number;
  salaryHistory?: SalaryHistoryEntry[];
};

export function getMonthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getEffectiveMonthlySalary(
  staff: SalaryTrackedStaff,
  monthDate = new Date()
) {
  const monthStart = getMonthStart(monthDate);
  const history = [...(staff.salaryHistory ?? [])].sort(
    (a, b) => a.effectiveMonth.getTime() - b.effectiveMonth.getTime()
  );
  let effectiveSalary = staff.monthlySalary;
  for (const entry of history) {
    if (entry.effectiveMonth <= monthStart) {
      effectiveSalary = entry.monthlySalary;
    }
  }

  return effectiveSalary;
}
