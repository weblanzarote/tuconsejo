/**
 * Cifrado AES-256-GCM para credenciales sensibles (contraseñas IMAP).
 * La clave deriva del JWT_SECRET (suficiente para app local; en producción
 * hostada se recomienda TOKEN_ENCRYPTION_KEY dedicado).
 */
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret =
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    "consejo-sinergico-local-secret-change-me";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encrypt(plaintext: string): string {
  if (!plaintext) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Formato: iv(12) + authTag(16) + data, todo en base64
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decrypt(encoded: string): string {
  if (!encoded) return "";
  try {
    const buf = Buffer.from(encoded, "base64");
    const iv = buf.subarray(0, 12);
    const authTag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf-8");
  } catch (err) {
    console.error("[crypto-utils] decrypt failed:", err);
    return "";
  }
}
