import crypto from "node:crypto";
import { env } from "./env";

/**
 * AES-256-GCM helpers for Dialpad OAuth tokens.
 *
 * On-disk format is `iv.ciphertext.tag` — three url-unsafe base64 chunks
 * joined with `.`. Each call generates a fresh 12-byte IV (the GCM
 * recommended size). The 16-byte auth tag is verified on decrypt; a
 * tampered ciphertext throws and the caller treats the row as
 * disconnected (forces re-auth, never serves a forged token).
 *
 * The key comes from env (`DIALPAD_TOKEN_ENC_KEY`). We accept either
 * a 64-char hex string OR a 44-char base64 string OR any 32-byte UTF-8
 * passphrase — the latter goes through SHA-256 to expand to the
 * required 32 bytes. This forgiving format means operators don't have
 * to know about KDFs to set up the env var; "any random ≥32-char
 * string" works.
 */

const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12;
const TAG_BYTES = 16;

let cachedKey: Buffer | null = null;

const deriveKey = (raw: string): Buffer => {
  // Hex (64 chars) — exact bytes.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  // Standard base64 producing 32 bytes.
  if (/^[A-Za-z0-9+/]{43}=?$/.test(raw)) {
    const buf = Buffer.from(raw, "base64");
    if (buf.length === KEY_BYTES) return buf;
  }
  // Fallback: SHA-256 of the passphrase. Stable per-input, 32 bytes.
  return crypto.createHash("sha256").update(raw, "utf8").digest();
};

const getKey = (): Buffer => {
  if (cachedKey) return cachedKey;
  const raw = env.dialpadTokenEncKey;
  if (!raw) {
    throw new Error(
      "DIALPAD_TOKEN_ENC_KEY is required to read or write Dialpad OAuth tokens.",
    );
  }
  cachedKey = deriveKey(raw);
  return cachedKey;
};

export const encryptDialpadToken = (plaintext: string): string => {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    ct.toString("base64"),
    tag.toString("base64"),
  ].join(".");
};

export const decryptDialpadToken = (blob: string): string => {
  const parts = blob.split(".");
  if (parts.length !== 3) throw new Error("dialpad token blob malformed");
  const iv = Buffer.from(parts[0], "base64");
  const ct = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("dialpad token blob has wrong iv/tag size");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
};

export const isDialpadTokenCryptoConfigured = (): boolean =>
  !!env.dialpadTokenEncKey;
