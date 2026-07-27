CREATE TABLE "StaffDeposit" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "depositDate" TIMESTAMP(3) NOT NULL,
    "channel" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffDeposit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffDeposit_staffId_depositDate_idx"
ON "StaffDeposit"("staffId", "depositDate");

CREATE INDEX "StaffDeposit_depositDate_idx"
ON "StaffDeposit"("depositDate");

ALTER TABLE "StaffDeposit"
ADD CONSTRAINT "StaffDeposit_staffId_fkey"
FOREIGN KEY ("staffId") REFERENCES "Staff"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
