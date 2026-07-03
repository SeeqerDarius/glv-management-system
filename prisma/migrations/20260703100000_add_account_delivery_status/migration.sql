CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'DELIVERED');

ALTER TABLE "CustomerAccount"
ADD COLUMN "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "deliveredAt" TIMESTAMP(3),
ADD COLUMN "deliveredBy" TEXT;
