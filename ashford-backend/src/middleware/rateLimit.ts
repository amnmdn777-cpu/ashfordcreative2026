import type { Request, Response, NextFunction } from "express";
import { tooMany } from "../lib/errors";
import { logger } from "../lib/logger";

// Simple in-memory token bucket per (key, route). Suitable for a single-instance
// dev/staging API; in production behind multiple instances this should move to
// Redis. The spec asks specifically for an in-memory token bucket on public
// POSTs.

type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) {
    if (now - b.updatedAt > 30 * 60 * 1000) buckets.delete(key);
  }
}, SWEEP_INTERVAL_MS).unref();

export interface RateLimitOptions {
  /** Bucket capacity (max burst). */
  capacity: number;
  /** Tokens refilled per second. */
  refillPerSecond: number;
  /** Stable name used in the cache key + log lines. */
  name: string;
  /** Override the per-request key (defaults to client IP). */
  keyFn?: (req: Request) => string;
  /**
   * Optional hook fired exactly when a request is rejected. Used by the
   * domain endpoints to emit a structured `domain_lookup_abuse` log line
   * for the funnel dashboard so abuse vs. legitimate traffic can be
   * charted by source surface.
   */
  onLimited?: (req: Request) => void;
}

export const rateLimit = (opts: RateLimitOptions) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const id = opts.keyFn ? opts.keyFn(req) : (req.ip ?? "0.0.0.0");
    const cacheKey = `${opts.name}:${id}`;
    const now = Date.now();
    const existing = buckets.get(cacheKey);
    let tokens = existing?.tokens ?? opts.capacity;
    if (existing) {
      const elapsed = (now - existing.updatedAt) / 1000;
      tokens = Math.min(opts.capacity, tokens + elapsed * opts.refillPerSecond);
    }
    if (tokens < 1) {
      logger.warn({ name: opts.name, id }, "rate limit exceeded");
      try {
        opts.onLimited?.(req);
      } catch (hookErr) {
        logger.warn({ err: hookErr, name: opts.name }, "rate limit onLimited hook threw");
      }
      return next(
        tooMany("Too many requests. Please slow down and try again shortly.", {
          reason: "rate_limited",
          name: opts.name,
        }),
      );
    }
    tokens -= 1;
    buckets.set(cacheKey, { tokens, updatedAt: now });
    next();
  };
};
