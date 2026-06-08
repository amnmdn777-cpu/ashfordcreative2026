import type {
  DomainCheckResult,
  DomainSourceSurface,
  DomainSuggestResponse,
} from "@workspace/api-zod";

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ||
  "/api";

/** Same 15s timeout policy as the other API clients — see lib/api.ts. */
const DEFAULT_TIMEOUT_MS = 15_000;

const get = async <T>(path: string, qs: Record<string, string>): Promise<T> => {
  const params = new URLSearchParams(qs);
  const res = await fetch(`${API_BASE}${path}?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as {
        message?: string;
        error?: { message?: string };
      };
      msg = j?.error?.message || j?.message || msg;
    } catch {
      // keep default
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
};

export const domainsApi = {
  check: (domain: string, surface: DomainSourceSurface = "unknown") =>
    get<DomainCheckResult>("/public/domains/check", { q: domain, surface }),
  suggest: (seed: string, surface: DomainSourceSurface = "unknown") =>
    get<DomainSuggestResponse>("/public/domains/suggest", { q: seed, surface }),
};

/**
 * Re-export of the canonical dollar formatter from `lib/utils`.
 * Kept here so existing imports (`@site/lib/domains` → fmtUsd) keep
 * working — domain retail prices come back as whole dollars from
 * the registrar API, which is the dollars-in shape.
 */
export { fmtUsdFromDollars as fmtUsd } from "./utils";
