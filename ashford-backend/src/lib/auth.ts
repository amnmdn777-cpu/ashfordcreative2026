import crypto from "node:crypto";
import { env } from "./env";

export const SESSION_COOKIE = "ash_sess";

type SessionPayload = {
  uid: number;
  iat: number;
  exp: number;
};

const sign = (data: string): string =>
  crypto
    .createHmac("sha256", env.sessionSecret)
    .update(data)
    .digest("base64url");

export const signSession = (uid: number, ttlSeconds = 60 * 60 * 24 * 14): string => {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { uid, iat: now, exp: now + ttlSeconds };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = sign(body);
  return `${body}.${sig}`;
};

export const verifySession = (raw: string | undefined): SessionPayload | null => {
  if (!raw) return null;
  const idx = raw.indexOf(".");
  if (idx < 0) return null;
  const body = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  const expected = sign(body);
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
};

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.nodeEnv === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 14 * 1000,
};
