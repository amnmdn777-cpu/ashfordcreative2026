import { promises as dns } from "node:dns";
import { logger } from "../lib/logger";

/**
 * Generate 3 candidate domain names from the practitioner's name +
 * practice slug + city, then DNS-check each one. A domain that does
 * NOT resolve any A/AAAA/MX/NS records is *probably* unregistered —
 * the prospect-preview surface uses this signal to advertise "we'll
 * grab this for free when you reserve" without requiring a real
 * registrar API. False positives (domains that exist but have no
 * DNS records) are rare and resolve themselves at registration time
 * — the rep flow already has a registrar-API check before charge.
 *
 * Pure-DNS approach is intentional: registrar APIs (Namecheap,
 * GoDaddy) cost money + rate-limit + need credentials. DNS is free,
 * unlimited, and good enough for the wow-factor surface.
 */
export interface DomainSuggestion {
  domain: string;
  available: boolean;
}

const slug = (raw: string): string =>
  raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^(?:dr|mr|mrs|ms|mx|prof)\.?\s+/i, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 30);

const isLikelyAvailable = async (domain: string): Promise<boolean> => {
  // A domain is "likely available" when it resolves NO A/AAAA, no NS,
  // no MX, no SOA. We try the cheapest checks first.
  try {
    const a = await dns.resolve4(domain).catch(() => [] as string[]);
    if (a.length > 0) return false;
  } catch {
    /* swallow */
  }
  try {
    const aaaa = await dns.resolve6(domain).catch(() => [] as string[]);
    if (aaaa.length > 0) return false;
  } catch {
    /* swallow */
  }
  try {
    const ns = await dns.resolveNs(domain).catch(() => [] as string[]);
    if (ns.length > 0) return false;
  } catch {
    /* swallow */
  }
  try {
    const mx = await dns
      .resolveMx(domain)
      .catch(() => [] as Array<{ exchange: string; priority: number }>);
    if (mx.length > 0) return false;
  } catch {
    /* swallow */
  }
  return true;
};

export const suggestDomains = async ({
  fullName,
  practiceName,
  city,
}: {
  fullName: string | null;
  practiceName: string | null;
  city: string | null;
}): Promise<DomainSuggestion[]> => {
  const candidates = new Set<string>();
  if (fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    const last = parts[parts.length - 1];
    const first = parts[0];
    const baseFromName = slug(fullName);
    if (baseFromName.length >= 4) {
      candidates.add(`${baseFromName}.com`);
    }
    if (first && last && first !== last) {
      const lastFirst = `${slug(last)}${slug(first)}`;
      if (lastFirst.length >= 4) candidates.add(`${lastFirst}.com`);
      const lastTherapy = `${slug(last)}therapy`;
      if (lastTherapy.length >= 5 && lastTherapy.length <= 30) {
        candidates.add(`${lastTherapy}.com`);
      }
    }
  }
  if (practiceName && practiceName !== fullName) {
    const p = slug(practiceName);
    if (p.length >= 4) {
      candidates.add(`${p}.com`);
    }
  }
  if (city && fullName) {
    const lastSlug = slug(fullName.split(/\s+/).pop() ?? "");
    const citySlug = slug(city);
    if (lastSlug && citySlug) {
      const combined = `${lastSlug}${citySlug}`;
      if (combined.length >= 6 && combined.length <= 30) {
        candidates.add(`${combined}.com`);
      }
    }
  }

  const list = Array.from(candidates).slice(0, 6);
  const results = await Promise.all(
    list.map(async (domain) => {
      try {
        const available = await isLikelyAvailable(domain);
        return { domain, available };
      } catch (err) {
        logger.warn({ err, domain }, "domain availability check failed");
        return { domain, available: false };
      }
    }),
  );
  // Surface 3: prefer available ones first, then fill with taken ones
  // so the UI always has something to show even if every candidate is
  // taken (rare for less-common practitioner names).
  const sorted = results.sort((a, b) => Number(b.available) - Number(a.available));
  return sorted.slice(0, 3);
};
