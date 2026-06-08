import { logger } from "../../lib/logger";
import {
  collectImageCandidates,
  decodeEntities,
  dedupe,
  extractCsvBetween,
  fetchDirectoryHtml,
  lastNameToken,
  splitCsv,
  stripToBodyText,
} from "./_directoryFetch";
import type { EnrichmentSource, FetchResult, LeadInput } from "./types";
import { rejectMatch } from "./types";

/**
 * Alma directory enrichment (https://helloalma.com).
 *
 * Alma is the closest direct competitor to Headway — therapist
 * directory + insurance billing aggregator. URL pattern:
 * `helloalma.com/providers/<slug>` (some legacy `alma.org` links
 * redirect into this).
 *
 * Same scaffolding as the other directory scrapers: direct URL fast
 * path only (no search fallback yet — Alma's public search isn't
 * indexable). 2-tier fetch via `_directoryFetch`. Identity gate on
 * last-name overlap. DOM parser anchors on Alma's section headings.
 */

const ALMA_HOST_RE = /^(?:www\.)?(?:helloalma|alma)\.com$/i;
const ALMA_PATH_RE = /^\/providers?\/[a-z0-9-]+\/?$/i;

class AlmaSource implements EnrichmentSource {
  readonly key = "alma";
  readonly label = "Alma";

  isConfigured(): boolean {
    return true;
  }

  async fetch(lead: LeadInput): Promise<FetchResult> {
    const url = directProfileUrl(lead);
    if (!url) return null;
    const html = await fetchDirectoryHtml(url, "alma");
    if (!html) return null;
    const profile = parseAlmaProfile(html, url);
    if (!profile) return null;
    const verdict = verifyAlmaMatch(lead, profile.name);
    if (verdict.kind === "reject") {
      logger.warn(
        { leadId: lead.id, profileName: profile.name, reason: verdict.reason },
        "alma: rejecting match",
      );
      return rejectMatch(verdict.reason);
    }
    const summaryParts: string[] = [];
    if (profile.name) summaryParts.push(`Alma: ${profile.name}`);
    if (profile.specialties.length) {
      summaryParts.push(
        `specialties: ${profile.specialties.slice(0, 4).join(", ")}`,
      );
    }
    if (profile.acceptedInsurances.length) {
      summaryParts.push(
        `accepts: ${profile.acceptedInsurances.slice(0, 3).join(", ")}`,
      );
    }
    return {
      confidence: 90,
      summary: summaryParts.join(" · ") || "Alma profile matched.",
      payload: {
        profileUrl: url,
        profile: {
          name: profile.name,
          photo: profile.photoUrl,
          bio: profile.bio,
          credentials: profile.credentials,
          specialties: profile.specialties,
          modalities: profile.modalities,
          acceptedInsurances: profile.acceptedInsurances,
          languages: profile.languages,
        },
        teamStructured:
          profile.name && (profile.bio || profile.photoUrl)
            ? [
                {
                  name: profile.name,
                  credentials: profile.credentials,
                  bio: profile.bio,
                  photo: profile.photoUrl,
                },
              ]
            : [],
      },
    };
  }
}

export const almaSource = new AlmaSource();

const directProfileUrl = (lead: LeadInput): string | null => {
  const raw = lead.currentWebsite?.trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  if (!ALMA_HOST_RE.test(parsed.hostname)) return null;
  if (!ALMA_PATH_RE.test(parsed.pathname)) return null;
  return `https://helloalma.com${parsed.pathname.replace(/\/$/, "")}`;
};

interface AlmaProfile {
  name: string | null;
  photoUrl: string | null;
  bio: string | null;
  credentials: string | null;
  specialties: string[];
  modalities: string[];
  acceptedInsurances: string[];
  languages: string[];
}

export const parseAlmaProfile = (
  html: string,
  profileUrl: string,
): AlmaProfile | null => {
  const bodyText = stripToBodyText(html);
  let name: string | null = null;
  const h1 = html.match(/<h1[^>]*>([^<]{2,80})<\/h1>/i);
  if (h1?.[1]) name = decodeEntities(h1[1]).trim();
  if (!name) {
    const slug = profileUrl.match(/\/providers?\/([a-z0-9-]+)/i)?.[1];
    if (slug) {
      name = slug
        .split("-")
        .filter((t) => !/^\d+$/.test(t))
        .map((t) => t[0]?.toUpperCase() + t.slice(1))
        .join(" ");
    }
  }
  if (!name) return null;

  // Photo on Alma's CDN.
  const PHOTO_HOSTS = /(?:images\.helloalma|alma-images|cdn\.helloalma|s3\.amazonaws\.com\/[^/]*alma)/i;
  const PHOTO_BLOCK = /(?:icon|logo|sprite|favicon|og-image|placeholder|avatar)/i;
  let photoUrl: string | null = null;
  for (const c of collectImageCandidates(html)) {
    if (PHOTO_BLOCK.test(c)) continue;
    if (!/\.(jpe?g|png|webp|avif)/i.test(c)) continue;
    if (PHOTO_HOSTS.test(c)) {
      photoUrl = c;
      break;
    }
  }

  const bioParts: string[] = [];
  const aboutMatch = bodyText.match(
    /About\s+([\s\S]{40,1500}?)(?=Specialties|Approach|Insurance|Credentials|Languages|$)/i,
  );
  if (aboutMatch?.[1]) bioParts.push(aboutMatch[1].trim());
  const approachMatch = bodyText.match(
    /Approach\s+([\s\S]{40,1500}?)(?=Specialties|Insurance|Credentials|Languages|$)/i,
  );
  if (approachMatch?.[1]) bioParts.push(approachMatch[1].trim());
  const bio = bioParts.length > 0 ? bioParts.join("\n\n") : null;

  const specialties = extractCsvBetween(
    bodyText,
    /Specialties\s+/i,
    /(?:Approach|Insurance|Credentials|Languages|$)/i,
  );
  const modalities = extractCsvBetween(
    bodyText,
    /Approach(?:es)?\s+/i,
    /(?:Insurance|Credentials|Languages|$)/i,
  );
  const languages = extractCsvBetween(
    bodyText,
    /Languages\s+/i,
    /(?:Insurance|Credentials|$)/i,
  );
  let acceptedInsurances: string[] = [];
  const insMatch = bodyText.match(
    /Insurance(?:s|\s+accepted|\s+plans?)?\s+([A-Z][^.|]{20,1500}?)(?=Credentials|Sessions|Fees|$)/i,
  );
  if (insMatch?.[1]) acceptedInsurances = splitCsv(insMatch[1]);
  acceptedInsurances = acceptedInsurances.filter(
    (s) =>
      !/^(?:Credentials|Years?|License|Training|Specialties|Languages|Insurance)\b/i.test(
        s,
      ),
  );

  let credentials: string | null = null;
  const credMatch = html.match(
    /<h1[^>]*>[^<]+<\/h1>\s*(?:<[^>]+>\s*)*([^<\n]{2,80})/i,
  );
  if (credMatch?.[1]) {
    const c = credMatch[1].trim();
    if (/^[A-Z][\w.,\s]+$/.test(c)) credentials = c;
  }

  const hasSignal =
    !!bio || !!photoUrl || specialties.length >= 2 ||
    acceptedInsurances.length >= 2;
  if (!hasSignal) return null;

  return {
    name,
    photoUrl,
    bio,
    credentials,
    specialties: dedupe(specialties),
    modalities: dedupe(modalities),
    acceptedInsurances: dedupe(acceptedInsurances),
    languages: dedupe(languages),
  };
};

export function verifyAlmaMatch(
  lead: LeadInput,
  profileName: string | null,
):
  | { kind: "accept"; reason: string }
  | { kind: "reject"; reason: string } {
  if (!profileName) return { kind: "reject", reason: "no profile name" };
  const last = lastNameToken(lead.name);
  if (!last) {
    return {
      kind: "reject",
      reason: `lead name has no last-name token (${lead.name})`,
    };
  }
  return profileName.toLowerCase().includes(last)
    ? { kind: "accept", reason: `last-name match "${last}"` }
    : {
        kind: "reject",
        reason: `profile name "${profileName}" missing "${last}"`,
      };
}
