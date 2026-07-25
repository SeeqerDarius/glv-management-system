/* eslint-disable @typescript-eslint/no-require-imports */

require("dotenv/config");

const { spawnSync } = require("node:child_process");

function clean(value) {
  return value?.replace(/^"|"$/g, "").trim();
}

function requireVerifiedSsl(value) {
  if (!value) return value;

  try {
    const url = new URL(value);
    url.searchParams.set("sslmode", "require");
    url.searchParams.set("sslcert", "prod-ca-2021.crt");
    return url.toString();
  } catch {
    return value;
  }
}

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Usage: node scripts/with-database-url.cjs <command> [...args]");
  process.exit(1);
}

const databaseUrl = requireVerifiedSsl(clean(process.env.DATABASE_URL));
const directUrl = requireVerifiedSsl(clean(
  process.env.DATABASE_URL_UNPOOLED ||
    process.env.DIRECT_URL ||
    process.env.POSTGRES_URL_NON_POOLING
));
const isPrismaMigrate =
  command === "prisma" && args[0] === "migrate";
const isMigrateDeploy =
  isPrismaMigrate && args[1] === "deploy";
const env = { ...process.env };

if (isPrismaMigrate && directUrl) {
  env.DATABASE_URL = directUrl;
} else {
  env.DATABASE_URL = databaseUrl || directUrl;
}

function run() {
  return spawnSync(command, args, {
    env,
    shell: true,
    stdio: "inherit",
  });
}

const maxAttempts = isMigrateDeploy ? 4 : 1;
let result = null;

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  result = run();

  if ((result.status ?? 1) === 0 || attempt === maxAttempts) {
    break;
  }

  const delayMs = attempt * 15000;
  console.warn(
    `Prisma migrate deploy failed on attempt ${attempt}. Retrying in ${Math.round(
      delayMs / 1000
    )}s...`
  );
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
}

process.exit(result.status ?? 1);
