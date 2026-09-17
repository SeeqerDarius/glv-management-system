-- Trusted customers can receive a product before the plan is fully paid. The
-- balance owed at handover is recorded so the debt stays visible and reportable.
ALTER TABLE "CustomerAccount" ADD COLUMN "deliveredWithBalance" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CustomerAccount" ADD COLUMN "balanceAtDelivery" DOUBLE PRECISION;
ALTER TABLE "CustomerAccount" ADD COLUMN "deliveryNote" TEXT;
