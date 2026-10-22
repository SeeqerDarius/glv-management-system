CREATE TABLE "LifecycleSweepState" (
    "id" TEXT NOT NULL DEFAULT 'account-lifecycle',
    "lastCompletedAt" TIMESTAMP(3),
    "lockExpiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LifecycleSweepState_pkey" PRIMARY KEY ("id")
);

-- This coordination record is only accessed by the server-side database role.
ALTER TABLE "LifecycleSweepState" ENABLE ROW LEVEL SECURITY;
