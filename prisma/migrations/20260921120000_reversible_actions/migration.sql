-- Consequential administrator actions become retractable for a short window.
-- The payload carries both the prior values needed to restore the record and
-- the values the action wrote, so a reversal can refuse when the record has
-- changed since rather than overwriting newer work.
CREATE TABLE "ReversibleAction" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "reversedBy" TEXT,

    CONSTRAINT "ReversibleAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReversibleAction_entity_entityId_performedAt_idx" ON "ReversibleAction"("entity", "entityId", "performedAt");
CREATE INDEX "ReversibleAction_reversedAt_expiresAt_idx" ON "ReversibleAction"("reversedAt", "expiresAt");
