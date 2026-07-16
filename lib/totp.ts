import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const stepSeconds = 30;
const digits = 6;

export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function getTotpUri({
  accountName,
  issuer = "GLV Management System",
  secret,
}: {
  accountName: string;
  issuer?: string;
  secret: string;
}) {
  const label = `${issuer}:${accountName}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(digits),
    period: String(stepSeconds),
  });

  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

export function verifyTotpCode(secret: string, code: string) {
  const normalizedCode = code.trim().replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalizedCode)) return false;

  const nowCounter = Math.floor(Date.now() / 1000 / stepSeconds);

  for (let offset = -1; offset <= 1; offset += 1) {
    const expected = generateTotpCode(secret, nowCounter + offset);
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(normalizedCode);

    if (
      expectedBuffer.length === providedBuffer.length &&
      timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      return true;
    }
  }

  return false;
}

function generateTotpCode(secret: string, counter: number) {
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 10 ** digits).padStart(digits, "0");
}

function base32Encode(buffer: Buffer) {
  let bits = "";
  let output = "";

  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, "0");
  }

  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, "0");
    output += alphabet[parseInt(chunk, 2)];
  }

  return output;
}

function base32Decode(secret: string) {
  const cleanSecret = secret.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = "";

  for (const char of cleanSecret) {
    const value = alphabet.indexOf(char);
    if (value === -1) {
      throw new Error("Invalid TOTP secret.");
    }
    bits += value.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(parseInt(bits.slice(index, index + 8), 2));
  }

  return Buffer.from(bytes);
}
