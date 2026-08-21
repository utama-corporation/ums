import crypto from "node:crypto";
import { env } from "./env.js";

const ALGORITHM = "aes-256-gcm";

// Arbitrary-length env secret -> fixed 32-byte key, so SETTINGS_ENCRYPTION_KEY doesn't
// have to be hex/base64-exact-length, just "long enough" (enforced by the min(16) in env.ts).
function getKey(): Buffer {
  return crypto.createHash("sha256").update(env.SETTINGS_ENCRYPTION_KEY).digest();
}

// Encrypts a secret (e.g. an S3 access key) for storage in the SystemSetting table.
// Stored as "iv:authTag:ciphertext" (hex) so decryptSecret is a pure inverse with no
// side-channel lookups needed.
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptSecret(stored: string): string {
  const [ivHex, authTagHex, dataHex] = stored.split(":");
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error("Malformed encrypted secret");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
}
