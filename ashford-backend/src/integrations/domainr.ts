import type { DomainOffer, DomainStatus, Money } from "@workspace/api-zod";
import { env, isProd } from "../lib/env";
import { logger } from "../lib/logger";

export class DomainLookupUnavailableError extends Error {
  constructor(message = "Live domain availability is temporarily unavailable") {
    super(message);
    this.name = "DomainLookupUnavailableError";
  }
}

// Domainr (RapidAPI) v2 integration with a 60s LRU and a soft-fail mock
// when DOMAINR_API_KEY is unset. See https://domainr.com/docs/api/v2.

const DOMAINR_HOST = "domainr.p.rapidapi.com";
const STATUS_URL = `https://${DOMAINR_HOST}/v2/status`;
const SEARCH_URL = `https://${DOMAINR_HOST}/v2/search`;
const FETCH_TIMEOUT_MS = 6_000;
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 200;

// Premium-vs-regular threshold. Lowered from 3000 (=$30/yr) to 2000
// (=$20/yr) on 2026-04-27 ahead of launch so anything > $20/yr surfaces
// as premium with the surcharge plainly stated. Keeps the "$0 included"
// promise honest for the free bucket — only sub-$20 names ride free.
const REGULAR_MAX_RETAIL_CENTS = 2000;
const DEFAULT_REGULAR_RETAIL_CENTS = 1498;
const PREMIUM_ABSORB_CENTS = 1498;
const CURRENCY = "USD";

type CacheEntry<T> = { value: T; expiresAt: number };
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 500;
const statusCache = new Map<string, CacheEntry<RawStatus>>();
const searchCache = new Map<string, CacheEntry<RawSearchResult>>();

const cacheGet = <T>(map: Map<string, CacheEntry<T>>, key: string): T | null => {
  const hit = map.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    map.delete(key);
    return null;
  }
  map.delete(key);
  map.set(key, hit);
  return hit.value;
};

const cachePut = <T>(map: Map<string, CacheEntry<T>>, key: string, value: T) => {
  map.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  while (map.size > CACHE_MAX_ENTRIES) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
};

type RawStatus = {
  domain: string;
  /** Space-separated tokens; first one is the headline. */
  status: string;
};

type RawSearchResult = {
  results: Array<{
    domain: string;
    host: string;
    subdomain: string;
    path: string;
    registerURL: string;
  }>;
};

export async function checkDomainStatus(
  domains: string[],
): Promise<Map<string, RawStatus>> {
  const out = new Map<string, RawStatus>();
  const need: string[] = [];
  for (const d of domains) {
    const cached = cacheGet(statusCache, d);
    if (cached) out.set(d, cached);
    else need.push(d);
  }
  if (need.length === 0) return out;

  const apiKey = env.domainrApiKey;
  if (!apiKey) {
    if (isProd) {
      throw new DomainLookupUnavailableError(
        "DOMAINR_API_KEY not configured",
      );
    }
    // Dev/test only: deterministic mock so local flows and E2E continue
    // to work without an upstream key.
    for (const d of need) {
      const synthetic: RawStatus = { domain: d, status: devMockStatus(d) };
      cachePut(statusCache, d, synthetic);
      out.set(d, synthetic);
    }
    return out;
  }

  const url = `${STATUS_URL}?domain=${encodeURIComponent(need.join(","))}`;
  try {
    const json = await fetchJson<{ status: RawStatus[] }>(url, apiKey);
    const got = new Map(json.status.map((s) => [s.domain, s]));
    for (const d of need) {
      const row = got.get(d);
      if (row) {
        cachePut(statusCache, d, row);
        out.set(d, row);
      } else {
        const synthetic: RawStatus = { domain: d, status: "unknown" };
        cachePut(statusCache, d, synthetic);
        out.set(d, synthetic);
      }
    }
  } catch (err) {
    logger.warn(
      { err, count: need.length },
      "domainr status call failed",
    );
    throw new DomainLookupUnavailableError();
  }
  return out;
}

// Dev-only mock: deterministic status per name so devs see a realistic
// mix without contacting the upstream API.
function devMockStatus(domain: string): string {
  const lower = domain.toLowerCase();
  if (lower === "drsmith.com") return "undelegated inactive";
  if (lower.includes("premium")) return "premium";
  let hash = 0;
  for (let i = 0; i < lower.length; i++) hash = (hash * 31 + lower.charCodeAt(i)) | 0;
  const bucket = Math.abs(hash) % 10;
  if (bucket < 6) return "undelegated inactive";
  if (bucket < 8) return "active";
  return "premium";
}

export async function searchDomains(seed: string): Promise<string[]> {
  const key = seed.toLowerCase();
  const cached = cacheGet(searchCache, key);
  if (cached) return cached.results.map((r) => r.domain);

  const apiKey = env.domainrApiKey;
  if (!apiKey) return [];

  try {
    const url = `${SEARCH_URL}?query=${encodeURIComponent(seed)}`;
    const json = await fetchJson<RawSearchResult>(url, apiKey);
    cachePut(searchCache, key, json);
    return json.results.map((r) => r.domain);
  } catch (err) {
    logger.warn({ err, seed }, "domainr search call failed");
    return [];
  }
}

const money = (cents: number): Money => ({
  amount: round2(cents / 100),
  currency: CURRENCY,
});

/**
 * Translate a Domainr status row into the public DomainOffer.
 *
 * Pricing rules:
 *  - Regular available: ourPrice = 0, includedInPlan = "A". Plan A absorbs
 *    the standard $14.98/yr renewal forever.
 *  - Premium: ourPrice = 0 for year 1 (Plan A still covers the standard
 *    portion). `premiumSurcharge` is the *annual* registrar premium delta
 *    that becomes the prospect's responsibility from year 2 onward.
 *  - Taken / invalid: includedInPlan omitted; not for sale.
 */
export function toPublicOffer(raw: RawStatus, retailCents?: number): DomainOffer {
  let status = parseDomainrStatus(raw.status);
  const retail = retailCents ?? defaultRetailFor(raw.domain, status);

  // Threshold-based reclassification: even when Domainr returns plain
  // "available" / "undelegated inactive", a retail price above the
  // standard ceiling (REGULAR_MAX_RETAIL_CENTS) means the registrar is
  // selling this name as a premium SKU. We must surface that as premium
  // so the offer copy ("+$X/yr after the first year") and downstream
  // pricing are honest — otherwise an expensive .health/.care row would
  // render as a normal $0 FREE pick and understate the real cost.
  if (status === "available" && retail > REGULAR_MAX_RETAIL_CENTS) {
    status = "premium";
  }
  const isSellable = status === "available" || status === "premium";

  // For non-sellable rows (taken/invalid) we still report ourPrice as 0
  // — Ashford never charges for a domain we can't sell, and downstream
  // consumers expect a uniform "$0 narrative" for any row we surface.
  const offer: DomainOffer = {
    domain: raw.domain,
    status,
    retailPrice: money(retail),
    ourPrice: money(0),
  };
  if (isSellable) offer.includedInPlan = "A";
  if (status === "premium" && retail > PREMIUM_ABSORB_CENTS) {
    offer.premiumSurcharge = money(retail - PREMIUM_ABSORB_CENTS);
  }
  return offer;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Domainr's `status` is a space-separated list. We collapse it into the
 * four buckets the UI consumes. Reference:
 * https://domainr.com/docs/api/v2/status
 */
export function parseDomainrStatus(raw: string): DomainStatus {
  const tokens = raw.split(/\s+/).filter(Boolean);

  const invalidSet = new Set([
    "unknown",
    "tld",
    "disallowed",
    "reserved",
    "invalid",
    "zone",
  ]);
  if (tokens.some((t) => invalidSet.has(t))) return "invalid";

  if (tokens.includes("premium")) return "premium";

  const takenSet = new Set([
    "active",
    "marketed",
    "expiring",
    "deleting",
    "parked",
    "suffix",
    "transferable",
  ]);
  if (tokens.some((t) => takenSet.has(t))) return "taken";

  if (tokens.includes("inactive") || tokens.includes("undelegated")) {
    return "available";
  }

  return "invalid";
}

function defaultRetailFor(domain: string, status: DomainStatus): number {
  const tld = domain.split(".").pop()?.toLowerCase() ?? "";
  if (status === "premium") return 9900;
  switch (tld) {
    case "com":
      return 1498;
    case "org":
      return 1298;
    case "net":
      return 1498;
    case "care":
      return 4998;
    case "health":
      return 8998;
    default:
      return DEFAULT_REGULAR_RETAIL_CENTS;
  }
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "a",
  "an",
  "of",
  "for",
  "to",
  "in",
  "on",
  "at",
  "by",
  "llc",
  "inc",
  "pllc",
  "pc",
  "pa",
  "lcsw",
  "lpc",
  "phd",
  "psyd",
  "md",
  "dr",
  "drs",
  "doctor",
  "doctors",
]);

const SUFFIXES = ["therapy", "counseling", "psych", "wellness", "care", "clinic", "practice"];
const TLDS = ["com", "org", "care", "health", "net"];

export function generateDomainCandidates(seed: string): string[] {
  const cleaned = seed
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];

  const words = cleaned
    .split(/\s+/)
    .filter((w) => !STOP_WORDS.has(w) && w.length > 0);
  if (words.length === 0) return [];

  const baseStems = new Set<string>();
  baseStems.add(words.join(""));
  if (words.length > 1) baseStems.add(words.slice(0, -1).join(""));
  baseStems.add(words[0]);

  const stems: string[] = [];
  for (const stem of baseStems) {
    if (!stem) continue;
    stems.push(stem);
    for (const suffix of SUFFIXES) {
      if (stem.endsWith(suffix)) continue;
      stems.push(`${stem}${suffix}`);
    }
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const stem of stems) {
    for (const tld of TLDS) {
      const fqdn = `${stem}.${tld}`;
      if (fqdn.length > 63 + 1 + tld.length) continue;
      if (stem.length === 0 || stem.length > 63) continue;
      if (seen.has(fqdn)) continue;
      seen.add(fqdn);
      out.push(fqdn);
      if (out.length >= 24) return out;
    }
  }
  return out;
}

class RetryableHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch with timeout + exponential-backoff retry on 429 and transient
 * network/timeout failures (3 attempts, 200/400/800ms).
 */
async function fetchJson<T>(url: string, apiKey: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": DOMAINR_HOST,
          Accept: "application/json",
        },
        signal: ac.signal,
      });
      if (res.status === 429 || res.status >= 500) {
        throw new RetryableHttpError(`domainr ${res.status}`, res.status);
      }
      if (!res.ok) {
        throw new Error(`domainr ${res.status} ${res.statusText}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      const retryable =
        err instanceof RetryableHttpError ||
        (err instanceof Error &&
          (err.name === "AbortError" || err.name === "TypeError"));
      if (!retryable || attempt === MAX_RETRIES - 1) break;
      await sleep(BACKOFF_BASE_MS * Math.pow(2, attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("domainr request failed");
}

/** Test-only — clears the LRU. */
export function _resetDomainrCacheForTests() {
  statusCache.clear();
  searchCache.clear();
}
