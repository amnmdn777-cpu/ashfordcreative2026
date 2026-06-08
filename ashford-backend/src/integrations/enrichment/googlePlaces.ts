import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import type {
  EnrichmentSource,
  FetchResult,
  LeadInput,
} from "./types";
import { rejectMatch } from "./types";

/**
 * Google Places (Text Search + Details). Cheap, broadly useful first source —
 * gives us the practice's address, phone, hours, rating, photo references,
 * and the canonical Google place_id which other sources can use as a key.
 */
class GooglePlacesSource implements EnrichmentSource {
  readonly key = "google_places";
  readonly label = "Google Places";

  isConfigured(): boolean {
    return !!env.googlePlacesApiKey;
  }

  async fetch(lead: LeadInput): Promise<FetchResult> {
    if (!this.isConfigured()) return null;
    const apiKey = env.googlePlacesApiKey!;
    try {
      // Step 1: find a place. Prefer existing place_id, but only if it
      // actually looks like a Google Places ID. Real Google IDs start
      // with `ChIJ`, `Eh`, `Ei`, `EJ`, or `GhIJ`. Some legacy lead
      // imports stored internal pseudo-IDs like `pt_412225` in this
      // column — passing those to the Details API silently returns
      // wrong/empty data. When the stored ID is bogus, fall through to
      // a fresh text search instead.
      let placeId = isLikelyGooglePlaceId(lead.placeId) ? lead.placeId : null;
      if (!placeId) {
        // Better text query: include current website hostname when
        // available so we anchor on the prospect's domain rather than a
        // namesake practice in the same city.
        const hostHint = (() => {
          if (!lead.currentWebsite) return "";
          try {
            const u = new URL(
              lead.currentWebsite.startsWith("http")
                ? lead.currentWebsite
                : `https://${lead.currentWebsite}`,
            );
            return ` ${u.hostname.replace(/^www\./, "")}`;
          } catch {
            return "";
          }
        })();
        const query = encodeURIComponent(
          `${lead.practice}${hostHint} ${lead.city} ${lead.state}`,
        );
        const searchRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}`,
        );
        if (!searchRes.ok) return null;
        const searchJson = (await searchRes.json()) as {
          results?: Array<{ place_id?: string; name?: string }>;
        };
        placeId = searchJson.results?.[0]?.place_id ?? null;
        if (!placeId) {
          logger.info(
            { leadId: lead.id, query: decodeURIComponent(query) },
            "google_places: text search returned no results",
          );
          return null;
        }
      }
      // Step 2: place details.
      const detailsRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
          placeId,
        )}&fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,opening_hours,photos,types,business_status,reviews&key=${apiKey}`,
      );
      if (!detailsRes.ok) return null;
      const detailsJson = (await detailsRes.json()) as {
        result?: Record<string, unknown>;
      };
      const result = detailsJson.result;
      if (!result) return null;
      const reviews = Array.isArray(result.reviews)
        ? (result.reviews as Array<{ text?: string; rating?: number }>)
        : [];
      // Identity verification — the Tara Langston / "Rehab Accomplished
      // Inc." case (2026-05): Google Places text search returned a
      // completely unrelated business at a nearby address because the
      // lead's `practice` is a generic word ("Care") and the lead's
      // currentWebsite is a Headway URL (no domain to anchor on).
      // Photos / reviews from a wrong-match would leak into the
      // prospect preview as the Grinch-photo case did. Refuse the
      // match unless at least ONE strong identity signal lines up:
      //   (a) phone number digits match, OR
      //   (b) website host matches lead's currentWebsite host, OR
      //   (c) result name contains the lead's surname AND the result
      //       isn't an obviously-different business type.
      const verdict = verifyPlacesMatch(lead, result);
      if (verdict.kind === "reject") {
        logger.warn(
          {
            leadId: lead.id,
            placeId,
            placeName: typeof result.name === "string" ? result.name : null,
            placePhone:
              typeof result.formatted_phone_number === "string"
                ? result.formatted_phone_number
                : null,
            reason: verdict.reason,
          },
          "google_places: rejecting match (identity mismatch)",
        );
        // Use the rejected sentinel (not bare null) so the
        // orchestrator deletes the existing row. Without this, a
        // stale "Rehab Accomplished" row from a previous run that
        // landed before our identity gate fired would survive.
        return rejectMatch(verdict.reason);
      }
      const summary = [
        typeof result.rating === "number"
          ? `${result.rating}★ on ${result.user_ratings_total ?? "?"} Google reviews`
          : null,
        typeof result.formatted_phone_number === "string"
          ? `Phone: ${result.formatted_phone_number}`
          : null,
        reviews[0]?.text ? `"${reviews[0].text.slice(0, 140)}"` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return {
        confidence: verdict.confidence,
        summary: summary || "Google Places match found.",
        payload: { placeId, ...result, identityVerification: verdict },
      };
    } catch (err) {
      logger.warn({ err, leadId: lead.id }, "google places enrichment failed");
      return null;
    }
  }
}

/**
 * Real Google Places IDs are opaque strings of length 27+ that begin
 * with one of a small set of prefixes. Anything else (especially short
 * `pt_xxxxx` / numeric strings from legacy CSV imports) is junk and
 * must be ignored before we hit the Details API.
 */
const isLikelyGooglePlaceId = (raw: string | null): raw is string => {
  if (!raw || typeof raw !== "string") return false;
  if (raw.length < 20) return false;
  return /^(ChIJ|GhIJ|Ei|Eh|EI|EJ)/.test(raw);
};

/**
 * Decide whether a Google Places `result` actually refers to the lead.
 * Three independent signals; ONE strong match is enough to accept.
 *
 * - **Phone match** — strongest. We compare the trailing 10 digits
 *   (US-only, ignores +1 prefixes / formatting). When it matches we
 *   bump the source confidence to 95.
 * - **Website host match** — also strong. Whitelist the prospect's
 *   first-party domain only (skip Headway/PT directory URLs which
 *   map to thousands of unrelated providers).
 * - **Surname-only match** — weak; accepts only when no other
 *   business-type contradicts (i.e. result.types doesn't say
 *   "lawyer", "restaurant", etc., and the practice word "Care" /
 *   "Therapy" / "Counseling" doesn't fail the result name).
 *
 * Anything else → reject. The prospect-preview pipeline downgrades
 * non-identity-verified matches to fallback-only roles anyway, but
 * rejecting up front keeps the Grinch photos out of `lead_enrichment`.
 */
const DIRECTORY_HOSTS = [
  "headway.co",
  "psychologytoday.com",
  "healthgrades.com",
  "zocdoc.com",
  "alma.com",
  "grow.therapy",
  "zencare.co",
  "therapyden.com",
];

type Verdict =
  | { kind: "accept"; confidence: number; reason: string }
  | { kind: "reject"; reason: string };

const verifyPlacesMatch = (
  lead: LeadInput,
  result: Record<string, unknown>,
): Verdict => {
  // Phone signal.
  const leadDigits = lastTenDigits(lead.phone ?? "");
  const placeDigits = lastTenDigits(
    typeof result.formatted_phone_number === "string"
      ? result.formatted_phone_number
      : "",
  );
  if (leadDigits && placeDigits && leadDigits === placeDigits) {
    return { kind: "accept", confidence: 95, reason: "phone match" };
  }
  // Website host signal — only when the lead's currentWebsite is
  // first-party (not a directory).
  const leadHost = hostOf(lead.currentWebsite);
  const placeHost = hostOf(
    typeof result.website === "string" ? result.website : "",
  );
  if (leadHost && placeHost) {
    const isDirectoryHost = DIRECTORY_HOSTS.some(
      (h) => leadHost === h || leadHost.endsWith(`.${h}`),
    );
    if (
      !isDirectoryHost &&
      (leadHost === placeHost || placeHost.endsWith(`.${leadHost}`))
    ) {
      return { kind: "accept", confidence: 90, reason: "website match" };
    }
  }
  // Surname signal — last resort.
  const leadSurname = lastNameToken(lead.name);
  const placeName =
    typeof result.name === "string" ? result.name.toLowerCase() : "";
  if (leadSurname && placeName.includes(leadSurname)) {
    // Reject when the result is a clearly-different business type.
    const types = Array.isArray(result.types)
      ? (result.types as unknown[]).filter(
          (t): t is string => typeof t === "string",
        )
      : [];
    const offTopic = types.some((t) =>
      /(?:restaurant|food|car|auto|repair|store|shop|gym|hotel|lodging|bar)/i.test(
        t,
      ),
    );
    if (offTopic) {
      return {
        kind: "reject",
        reason: `surname matches but result types are off-topic (${types.join(",")})`,
      };
    }
    return { kind: "accept", confidence: 65, reason: "surname match" };
  }
  return {
    kind: "reject",
    reason: leadDigits
      ? `phone mismatch (lead=${leadDigits} place=${placeDigits || "(none)"})`
      : "no phone, no website, no surname overlap",
  };
};

const lastTenDigits = (raw: string): string => {
  const d = raw.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : "";
};

const hostOf = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
};

const lastNameToken = (name: string): string => {
  const parts = name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((s) => s.length >= 2 && !/^(?:dr|mr|mrs|ms|miss|prof)$/.test(s));
  return parts[parts.length - 1] ?? "";
};

export const googlePlacesSource = new GooglePlacesSource();
