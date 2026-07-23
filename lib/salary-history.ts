export type SalaryHistoryEntry = {
  effectiveMonth: Date;
  monthlySalary: number;
};

export type SalaryTrackedStaff = {
  monthlySalary: number;
  createdAt?: Date;
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
  const monthEnd = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );

  if (staff.createdAt && staff.createdAt > monthEnd) {
    return 0;
  }

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
