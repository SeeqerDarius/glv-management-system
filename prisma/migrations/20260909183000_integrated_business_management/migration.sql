CREATE TABLE "StaffLeaveRequest" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "leaveType" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffLeaveRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffPerformanceReview" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "reviewDate" TIMESTAMP(3) NOT NULL,
  "rating" INTEGER NOT NULL,
  "strengths" TEXT,
  "improvements" TEXT,
  "notes" TEXT,
  "reviewedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffPerformanceReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessExpense" (
  "id" TEXT NOT NULL,
  "expenseDate" TIMESTAMP(3) NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "method" TEXT,
  "reference" TEXT,
  "notes" TEXT,
  "recordedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessExpense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffLeaveRequest_staffId_startDate_idx" ON "StaffLeaveRequest"("staffId", "startDate");
CREATE INDEX "StaffLeaveRequest_status_startDate_idx" ON "StaffLeaveRequest"("status", "startDate");
CREATE INDEX "StaffPerformanceReview_staffId_reviewDate_idx" ON "StaffPerformanceReview"("staffId", "reviewDate");
CREATE INDEX "BusinessExpense_expenseDate_idx" ON "BusinessExpense"("expenseDate");
CREATE INDEX "BusinessExpense_category_expenseDate_idx" ON "BusinessExpense"("category", "expenseDate");

ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffPerformanceReview" ADD CONSTRAINT "StaffPerformanceReview_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
