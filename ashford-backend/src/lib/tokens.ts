import crypto from "node:crypto";

export const randomToken = (bytes = 18): string =>
  crypto.randomBytes(bytes).toString("base64url");

export const sha256Hex = (input: string): string =>
  crypto.createHash("sha256").update(input).digest("hex");

export const hashIp = (ip: string | undefined): string | undefined => {
  if (!ip) return undefined;
  return sha256Hex(ip + (process.env.SESSION_SECRET ?? "")).slice(0, 32);
};
