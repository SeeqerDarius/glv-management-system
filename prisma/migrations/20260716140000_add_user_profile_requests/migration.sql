ALTER TABLE "User" ADD COLUMN "profileImageUrl" TEXT;

CREATE TYPE "ProfileChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "ProfileChangeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestedEmail" TEXT,
    "requestedProfileImageUrl" TEXT,
    "status" "ProfileChangeStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProfileChangeRequest_status_createdAt_idx" ON "ProfileChangeRequest"("status", "createdAt");
CREATE INDEX "ProfileChangeRequest_userId_status_idx" ON "ProfileChangeRequest"("userId", "status");

ALTER TABLE "ProfileChangeRequest"
ADD CONSTRAINT "ProfileChangeRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
