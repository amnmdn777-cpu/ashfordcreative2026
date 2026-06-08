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
 * TherapyDen directory enrichment (https://therapyden.com).
 *
 * Smaller, identity-focused directory — TherapyDen lets therapists
 * mark themselves as LGBTQ+/BIPOC/multicultural, which is a critical
 * filter for many prospects but not exposed by the bigger
 * directories. URL pattern: `therapyden.com/therapists/<slug>` or
 * `/therapist/<slug>`.
 *
 * Same scaffolding — direct URL fast path, identity gate, DOM
 * parser. Specialty + identity tags are captured separately.
 */

const TD_HOST_RE = /^(?:www\.)?therapyden\.com$/i;
const TD_PATH_RE =
  /^\/(?:therapists?|therapist)\/[a-z0-9-]+(?:\/[a-z0-9-]+)?\/?$/i;

class TherapyDenSource implements EnrichmentSource {
  readonly key = "therapyden";
  readonly label = "TherapyDen";

  isConfigured(): boolean {
    return true;
  }

  async fetch(lead: LeadInput): Promise<FetchResult> {
    const url = directProfileUrl(lead);
    if (!url) return null;
    const html = await fetchDirectoryHtml(url, "therapyden");
    if (!html) return null;
    const profile = parseTherapyDenProfile(html, url);
    if (!profile) return null;
    const verdict = verifyTherapyDenMatch(lead, profile.name);
    if (verdict.kind === "reject") {
      logger.warn(
        { leadId: lead.id, profileName: profile.name, reason: verdict.reason },
        "therapyden: rejecting match",
      );
      return rejectMatch(verdict.reason);
    }
    const summaryParts: string[] = [];
    if (profile.name) summaryParts.push(`TherapyDen: ${profile.name}`);
    if (profile.specialties.length) {
      summaryParts.push(
        `specialties: ${profile.specialties.slice(0, 4).join(", ")}`,
      );
    }
    if (profile.identityTags.length) {
      summaryParts.push(
        `identity: ${profile.identityTags.slice(0, 3).join(", ")}`,
      );
    }
    return {
      confidence: 85,
      summary: summaryParts.join(" · ") || "TherapyDen profile matched.",
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
          identityTags: profile.identityTags,
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

export const therapyDenSource = new TherapyDenSource();

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
  if (!TD_HOST_RE.test(parsed.hostname)) return null;
  if (!TD_PATH_RE.test(parsed.pathname)) return null;
  return `https://therapyden.com${parsed.pathname.replace(/\/$/, "")}`;
};

interface TherapyDenProfile {
  name: string | null;
  photoUrl: string | null;
  bio: string | null;
  credentials: string | null;
  specialties: string[];
  modalities: string[];
  acceptedInsurances: string[];
  identityTags: string[];
  languages: string[];
}

export const parseTherapyDenProfile = (
  html: string,
  profileUrl: string,
): TherapyDenProfile | null => {
  const bodyText = stripToBodyText(html);
  let name: string | null = null;
  const h1 = html.match(/<h1[^>]*>([^<]{2,80})<\/h1>/i);
  if (h1?.[1]) name = decodeEntities(h1[1]).trim();
  if (!name) {
    const slug = profileUrl.match(/\/therapists?\/([a-z0-9-]+)/i)?.[1];
    if (slug) {
      name = slug
        .split("-")
        .filter((t) => !/^\d+$/.test(t))
        .map((t) => t[0]?.toUpperCase() + t.slice(1))
        .join(" ");
    }
  }
  if (!name) return null;

  const PHOTO_HOSTS = /(?:images\.therapyden|cdn\.therapyden|therapyden-uploads|s3\.amazonaws\.com\/[^/]*therapyden)/i;
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

  const bioMatch = bodyText.match(
    /(?:My Approach|About me|My therapeutic approach)\s+([\s\S]{40,1500}?)(?=Specialties|Insurance|Identities|Languages|Modalities|$)/i,
  );
  const bio = bioMatch?.[1]?.trim() ?? null;

  const specialties = extractCsvBetween(
    bodyText,
    /(?:Specialties|Issues)\s+/i,
    /(?:Modalities|Insurance|Identities|Languages|$)/i,
  );
  const modalities = extractCsvBetween(
    bodyText,
    /Modalities\s+/i,
    /(?:Insurance|Identities|Languages|$)/i,
  );
  const languages = extractCsvBetween(
    bodyText,
    /Languages\s+/i,
    /(?:Insurance|Identities|$)/i,
  );
  // TherapyDen's signature: identity tags ("LGBTQ+ Allied", "BIPOC",
  // "Multilingual", "Trauma-Informed", etc.).
  const identityTags = extractCsvBetween(
    bodyText,
    /(?:Identities|I identify with|Communities Served)\s+/i,
    /(?:Insurance|Languages|Specialties|$)/i,
  );
  let acceptedInsurances: string[] = [];
  const insMatch = bodyText.match(
    /Insurance(?:s|\s+accepted)?\s+([A-Z][^.|]{20,1500}?)(?=Sessions|Fees|Sliding|$)/i,
  );
  if (insMatch?.[1]) acceptedInsurances = splitCsv(insMatch[1]);

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
    identityTags.length >= 1;
  if (!hasSignal) return null;

  return {
    name,
    photoUrl,
    bio,
    credentials,
    specialties: dedupe(specialties),
    modalities: dedupe(modalities),
    acceptedInsurances: dedupe(acceptedInsurances),
    identityTags: dedupe(identityTags),
    languages: dedupe(languages),
  };
};

export function verifyTherapyDenMatch(
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
