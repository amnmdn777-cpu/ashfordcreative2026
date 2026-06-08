import { Router, type IRouter } from "express";
import {
  DomainSourceSurface,
  type DomainCheckResult,
  type DomainOffer,
  type DomainSuggestResponse,
} from "@workspace/api-zod";
import {
  checkDomainStatus,
  DomainLookupUnavailableError,
  generateDomainCandidates,
  searchDomains,
  toPublicOffer,
} from "../../integrations/domainr";
import { asyncHandler } from "../../middleware/asyncHandler";
import { rateLimit } from "../../middleware/rateLimit";
import { badRequest, serviceUnavailable } from "../../lib/errors";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

// Shared 60 req/min/IP bucket across check + suggest. Raised from 10/min
// → 60/min on 2026-04-27 because the launch-day picker may legitimately
// fire 5 checks per page render across hero / portal / chatbot surfaces,
// and a curious prospect typing four practice-name variants in a row was
// hitting the old ceiling and seeing empty grids. The onLimited hook
// still emits a structured warn line for the abuse dashboard.
const domainRateLimit = rateLimit({
  name: "public_domain_lookup",
  capacity: 60,
  refillPerSecond: 60 / 60,
  onLimited: (req) => {
    logger.warn(
      {
        event: "domain_lookup_abuse",
        ip: clientIp(req),
        path: req.path,
        sourceSurface: parseSurface(req.query.surface),
      },
      "domain lookup rate-limited",
    );
  },
});

function normalizeDomain(input: string): string | null {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
  if (!cleaned) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(cleaned)) return null;
  if (cleaned.length > 253) return null;
  return cleaned;
}

function parseSurface(
  raw: unknown,
): import("@workspace/api-zod").DomainSourceSurface {
  if (typeof raw !== "string") return "unknown";
  const parsed = DomainSourceSurface.safeParse(raw);
  return parsed.success ? parsed.data : "unknown";
}

function clientIp(req: import("express").Request): string {
  return (req.ip ?? req.socket.remoteAddress ?? "unknown").toString();
}

router.get(
  "/public/domains/check",
  domainRateLimit,
  asyncHandler(async (req, res) => {
    const start = Date.now();
    const surface = parseSurface(req.query.surface);
    const ip = clientIp(req);
    const q = typeof req.query.q === "string" ? req.query.q : "";
    if (!q.trim()) {
      logger.info(
        {
          event: "domain_check",
          ip,
          domain: null,
          status: "validation_error",
          retailPrice: null,
          sourceSurface: surface,
          durationMs: Date.now() - start,
        },
        "domain check missing q",
      );
      throw badRequest("Pass a domain to check via ?q=…");
    }
    const normalized = normalizeDomain(q);
    if (!normalized) {
      logger.info(
        {
          event: "domain_check",
          ip,
          domain: q,
          status: "invalid",
          retailPrice: null,
          sourceSurface: surface,
          durationMs: Date.now() - start,
        },
        "domain check rejected — invalid format",
      );
      throw badRequest("That doesn't look like a valid domain.");
    }
    let raw;
    try {
      const map = await checkDomainStatus([normalized]);
      raw = map.get(normalized);
    } catch (err) {
      if (err instanceof DomainLookupUnavailableError) {
        logger.warn(
          {
            event: "domain_check",
            ip,
            domain: normalized,
            status: "upstream_unavailable",
            sourceSurface: surface,
            durationMs: Date.now() - start,
          },
          "domain check upstream unavailable",
        );
        throw serviceUnavailable(
          "Live domain availability is temporarily unavailable. Please try again in a moment.",
        );
      }
      throw err;
    }
    if (!raw) {
      logger.warn(
        {
          event: "domain_check",
          ip,
          domain: normalized,
          status: "no_data",
          retailPrice: null,
          sourceSurface: surface,
          durationMs: Date.now() - start,
        },
        "domain check returned no data",
      );
      throw badRequest("Could not check that domain right now.");
    }
    const offer: DomainCheckResult = toPublicOffer(raw);
    logger.info(
      {
        event: "domain_check",
        ip,
        domain: offer.domain,
        status: offer.status,
        retailPrice: offer.retailPrice.amount,
        sourceSurface: surface,
        durationMs: Date.now() - start,
      },
      "domain check complete",
    );
    res.json(offer);
  }),
);

router.get(
  "/public/domains/suggest",
  domainRateLimit,
  asyncHandler(async (req, res) => {
    const start = Date.now();
    const surface = parseSurface(req.query.surface);
    const ip = clientIp(req);
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) {
      logger.info(
        {
          event: "domain_suggest",
          ip,
          seed: null,
          status: "validation_error",
          sourceSurface: surface,
          durationMs: Date.now() - start,
        },
        "domain suggest missing q",
      );
      throw badRequest("Pass a seed name via ?q=…");
    }

    const local = generateDomainCandidates(q);
    const upstream = await searchDomains(q);

    const merged: string[] = [];
    const seen = new Set<string>();
    for (const d of [...local, ...upstream]) {
      const lower = d.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      merged.push(lower);
      if (merged.length >= 12) break;
    }

    let statuses;
    try {
      statuses = await checkDomainStatus(merged);
    } catch (err) {
      if (err instanceof DomainLookupUnavailableError) {
        logger.warn(
          {
            event: "domain_suggest",
            ip,
            seed: q,
            status: "upstream_unavailable",
            sourceSurface: surface,
            durationMs: Date.now() - start,
          },
          "domain suggest upstream unavailable",
        );
        throw serviceUnavailable(
          "Live domain availability is temporarily unavailable. Please try again in a moment.",
        );
      }
      throw err;
    }
    const rawOffers: DomainOffer[] = merged
      .map((d) => statuses!.get(d))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s) => toPublicOffer(s))
      .sort((a, b) => statusRank(a.status) - statusRank(b.status));

    const offers = curateSuggestPicks(rawOffers);

    // Diagnostic: a sub-5 picker grid is the visual artefact users
    // complained about pre-launch. Emit a structured warn whenever we
    // can't fill the row so we can spot which seeds / TLDs are
    // starving the pool (typically the rare case of a seed with very
    // few free TLDs available AND no premium hits).
    if (offers.length < 5) {
      const freeCount = rawOffers.filter((o) => o.status === "available").length;
      const premiumCount = rawOffers.filter((o) => o.status === "premium").length;
      const takenCount = rawOffers.filter((o) => o.status === "taken").length;
      logger.warn(
        {
          event: "domain_suggest_short_grid",
          seed: q,
          ip,
          sourceSurface: surface,
          returnedCount: offers.length,
          freeCount,
          premiumCount,
          takenCount,
          candidateCount: merged.length,
        },
        "domain suggest returned fewer than 5 picks",
      );
    }

    const result: DomainSuggestResponse = { seed: q, offers };

    for (const o of offers) {
      logger.info(
        {
          event: "domain_check",
          ip,
          domain: o.domain,
          status: o.status,
          retailPrice: o.retailPrice.amount,
          sourceSurface: surface,
          durationMs: Date.now() - start,
          via: "suggest",
        },
        "domain suggestion offer",
      );
    }
    logger.info(
      {
        event: "domain_suggest",
        ip,
        seed: q,
        status: "ok",
        offerCount: offers.length,
        sourceSurface: surface,
        durationMs: Date.now() - start,
      },
      "domain suggest complete",
    );

    res.json(result);
  }),
);

function statusRank(s: DomainOffer["status"]): number {
  switch (s) {
    case "available":
      return 0;
    case "premium":
      return 1;
    case "taken":
      return 2;
    case "invalid":
      return 3;
  }
}

/**
 * Deterministic curation for the /public/domains/suggest picker row.
 *
 * Always lead with up to 3 free .com / .org / .net suggestions, then up
 * to 2 premium picks. If either bucket is short, top up from the other
 * so the picker grid still renders a full row of 5 cards (the UI is a
 * single 5-column row — partial rows look broken). Caps at 5 total to
 * keep the small-screen grid breathable.
 *
 * Drops "invalid" (registrar rejected the label) and "taken" (no upside
 * surfacing a domain the prospect can't have on a screen that's selling
 * the *included* free domain).
 *
 * Was a non-deterministic `.slice(0, 5)` before 2026-04-27, which could
 * surface 5 free or 5 premium at random. See task #176 / #178.
 *
 * Exported so the regression suite (`__tests__/domains.test.ts`) can
 * pin the bucket counts without spinning up the full Express handler.
 */
export function curateSuggestPicks(rawOffers: DomainOffer[]): DomainOffer[] {
  const FREE_TARGET = 3;
  const PREMIUM_TARGET = 2;
  const TOTAL_TARGET = FREE_TARGET + PREMIUM_TARGET;
  const freePool = rawOffers.filter((o) => o.status === "available");
  const premiumPool = rawOffers.filter((o) => o.status === "premium");
  const freePicks = freePool.slice(0, FREE_TARGET);
  const premiumPicks = premiumPool.slice(0, PREMIUM_TARGET);
  const freeShort = FREE_TARGET - freePicks.length;
  const premiumShort = PREMIUM_TARGET - premiumPicks.length;
  if (premiumShort > 0) {
    freePicks.push(
      ...freePool.slice(FREE_TARGET, FREE_TARGET + premiumShort),
    );
  }
  if (freeShort > 0) {
    premiumPicks.push(
      ...premiumPool.slice(PREMIUM_TARGET, PREMIUM_TARGET + freeShort),
    );
  }
  return [...freePicks, ...premiumPicks].slice(0, TOTAL_TARGET);
}

export default router;
