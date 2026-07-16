import { prisma } from "@/lib/prisma";

const globalSettingsSchema = globalThis as unknown as {
  glvSettingsSchemaReady?: boolean;
};

export async function ensureSettingsSchema() {
  if (globalSettingsSchema.glvSettingsSchemaReady) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Setting"
    ADD COLUMN IF NOT EXISTS "defaultStaffInventoryQuantity" INTEGER NOT NULL DEFAULT 10
  `);

  globalSettingsSchema.glvSettingsSchemaReady = true;
}
