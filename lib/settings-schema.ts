const globalSettingsSchema = globalThis as unknown as {
  glvSettingsSchemaReady?: boolean;
};

export async function ensureSettingsSchema() {
  if (globalSettingsSchema.glvSettingsSchemaReady) {
    return;
  }

  globalSettingsSchema.glvSettingsSchemaReady = true;
}
