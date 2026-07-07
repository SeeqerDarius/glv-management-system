-- CreateTable
CREATE TABLE "StaffSalaryHistory" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "monthlySalary" DOUBLE PRECISION NOT NULL,
    "effectiveMonth" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffSalaryHistory_pkey" PRIMARY KEY ("id")
);

-- Preserve the salary each existing staff member already had as their baseline.
INSERT INTO "StaffSalaryHistory" (
    "id",
    "staffId",
    "monthlySalary",
    "effectiveMonth",
    "createdBy",
    "createdAt"
)
SELECT
    'salary_' || md5("id" || "createdAt"::text),
    "id",
    "monthlySalary",
    date_trunc('month', "createdAt")::timestamp,
    NULL,
    CURRENT_TIMESTAMP
FROM "Staff";

-- CreateIndex
CREATE UNIQUE INDEX "StaffSalaryHistory_staffId_effectiveMonth_key" ON "StaffSalaryHistory"("staffId", "effectiveMonth");

-- CreateIndex
CREATE INDEX "StaffSalaryHistory_staffId_effectiveMonth_idx" ON "StaffSalaryHistory"("staffId", "effectiveMonth");

-- AddForeignKey
ALTER TABLE "StaffSalaryHistory" ADD CONSTRAINT "StaffSalaryHistory_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
