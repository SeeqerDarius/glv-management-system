-- Reactivating a dormant or closed account is an activity event. Without a
-- stamp for it the lifecycle clock kept reading the pre-closure payment date,
-- so a reactivated account was re-closed by the very next lifecycle sweep and
-- charged the closure deduction a second time.
ALTER TABLE "CustomerAccount" ADD COLUMN "reactivatedAt" TIMESTAMP(3);
