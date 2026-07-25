import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { del, get, list, put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import {
  buildDatabaseBackup,
  type DatabaseBackup,
} from "@/lib/database-backup";

const backupPrefix = "glv-database-backups/";
const retainedBackupCount = 2;

type EncryptedBackup = {
  kind: "GLV_ENCRYPTED_DATABASE_BACKUP";
  version: 1;
  algorithm: "aes-256-gcm";
  iv: string;
  authTag: string;
  ciphertext: string;
};

function getEncryptionKey() {
  const configuredKey = process.env.BACKUP_ENCRYPTION_KEY?.trim();

  if (!configuredKey) {
    throw new Error("BACKUP_ENCRYPTION_KEY is not configured.");
  }

  const key = Buffer.from(configuredKey, "base64url");

  if (key.length !== 32) {
    throw new Error("BACKUP_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }

  return key;
}

function encryptBackup(backup: DatabaseBackup) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(backup), "utf8");
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);

  const encryptedBackup: EncryptedBackup = {
    kind: "GLV_ENCRYPTED_DATABASE_BACKUP",
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64"),
  };

  return JSON.stringify(encryptedBackup);
}

function decryptBackup(encryptedValue: string): DatabaseBackup {
  const encryptedBackup = JSON.parse(encryptedValue) as EncryptedBackup;

  if (
    encryptedBackup.kind !== "GLV_ENCRYPTED_DATABASE_BACKUP" ||
    encryptedBackup.version !== 1 ||
    encryptedBackup.algorithm !== "aes-256-gcm"
  ) {
    throw new Error("Invalid automated database backup.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(encryptedBackup.iv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(encryptedBackup.authTag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encryptedBackup.ciphertext, "base64")),
    decipher.final(),
  ]);
  const backup = JSON.parse(plaintext.toString("utf8")) as DatabaseBackup;

  if (backup.kind !== "GLV_DATABASE_BACKUP" || backup.version !== 1) {
    throw new Error("Invalid decrypted database backup.");
  }

  return backup;
}

async function listAutomatedBackups() {
  const blobs = [];
  let cursor: string | undefined;

  do {
    const page = await list({
      prefix: backupPrefix,
      cursor,
      limit: 1000,
    });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return blobs.sort(
    (left, right) => right.uploadedAt.getTime() - left.uploadedAt.getTime()
  );
}

export async function createAutomatedDatabaseBackup() {
  const backup = await buildDatabaseBackup();
  const date = backup.generatedAt.slice(0, 10);
  const pathname = `${backupPrefix}glv-database-backup-${date}.json.enc`;

  await put(pathname, encryptBackup(backup), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/octet-stream",
    cacheControlMaxAge: 60,
  });

  const storedBackups = await listAutomatedBackups();
  const expiredBackups = storedBackups.slice(retainedBackupCount);

  if (expiredBackups.length) {
    await del(expiredBackups.map((blob) => blob.url));
  }

  await prisma.setting.updateMany({
    data: {
      backupDatabaseEnabled: true,
      lastBackupAt: new Date(backup.generatedAt),
      restoreBackupStatus: "Automatic daily backup completed",
    },
  });

  return {
    generatedAt: backup.generatedAt,
    retained: Math.min(storedBackups.length, retainedBackupCount),
    deleted: expiredBackups.length,
  };
}

export async function getLatestAutomatedDatabaseBackup() {
  const [latestBackup] = await listAutomatedBackups();

  if (!latestBackup) {
    return null;
  }

  const result = await get(latestBackup.url, {
    access: "public",
    useCache: false,
  });

  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error("Unable to read the latest automated backup.");
  }

  const encryptedValue = await new Response(result.stream).text();

  return {
    backup: decryptBackup(encryptedValue),
    uploadedAt: latestBackup.uploadedAt,
  };
}
