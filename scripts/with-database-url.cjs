/* eslint-disable @typescript-eslint/no-require-imports */

const { spawnSync } = require("node:child_process");

function clean(value) {
  return value?.replace(/^"|"$/g, "").trim();
}

const databaseUrl = clean(process.env.DATABASE_URL);
const unpooledUrl = clean(process.env.DATABASE_URL_UNPOOLED);

if (!databaseUrl && unpooledUrl) {
  process.env.DATABASE_URL = unpooledUrl;
}

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Usage: node scripts/with-database-url.cjs <command> [...args]");
  process.exit(1);
}

const result = spawnSync(command, args, {
  env: process.env,
  shell: true,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
