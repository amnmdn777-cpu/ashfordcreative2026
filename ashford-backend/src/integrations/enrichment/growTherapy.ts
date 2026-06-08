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
import { sanitizeScrapedBio } from "./bioSanitize";

/**
 * Grow Therapy directory enrichment (https://growtherapy.com).
 *
 * Direct competitor to Headway/Alma — therapist directory + insurance
 * billing aggregator focused on therapy access. URL pattern:
 * `growtherapy.com/providers/<slug>` or `/find-therapist/<slug>`.
 *
 * Same scaffolding as the other directory scrapers — direct URL fast
 * path, 2-tier fetch, identity gate. DOM parser anchors on Grow's
 * own section headings ("About me", "Insurance", "Specialties").
 */

const GROW_HOST_RE = /^(?:www\.)?growtherapy\.com$/i;
const GROW_PATH_RE =
  /^\/(?:providers?|find-therapist|provider)\/[a-z0-9-]+\/?$/i;

class GrowTherapySource implements EnrichmentSource {
  readonly key = "grow_therapy";
  readonly label = "Grow Therapy";

  isConfigured(): boolean {
    return true;
  }

  async fetch(lead: LeadInput): Promise<FetchResult> {
    const url = directProfileUrl(lead);
    if (!url) return null;
    const html = await fetchDirectoryHtml(url, "grow_therapy");
    if (!html) return null;
    const profile = parseGrowProfile(html, url);
    if (!profile) return null;
    const verdict = verifyGrowMatch(lead, profile.name);
    if (verdict.kind === "reject") {
      logger.warn(
        { leadId: lead.id, profileName: profile.name, reason: verdict.reason },
        "grow_therapy: rejecting match",
      );
      return rejectMatch(verdict.reason);
    }
    const summaryParts: string[] = [];
    if (profile.name) summaryParts.push(`Grow: ${profile.name}`);
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
      summary: summaryParts.join(" · ") || "Grow Therapy profile matched.",
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

export const growTherapySource = new GrowTherapySource();

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
  if (!GROW_HOST_RE.test(parsed.hostname)) return null;
  if (!GROW_PATH_RE.test(parsed.pathname)) return null;
  return `https://growtherapy.com${parsed.pathname.replace(/\/$/, "")}`;
};

interface GrowProfile {
  name: string | null;
  photoUrl: string | null;
  bio: string | null;
  credentials: string | null;
  specialties: string[];
  modalities: string[];
  acceptedInsurances: string[];
  languages: string[];
}

export const parseGrowProfile = (
  html: string,
  profileUrl: string,
): GrowProfile | null => {
  const bodyText = stripToBodyText(html);
  let name: string | null = null;
  const h1 = html.match(/<h1[^>]*>([^<]{2,80})<\/h1>/i);
  if (h1?.[1]) name = decodeEntities(h1[1]).trim();
  if (!name) {
    const slug = profileUrl.match(/\/(?:providers?|provider|find-therapist)\/([a-z0-9-]+)/i)?.[1];
    if (slug) {
      name = slug
        .split("-")
        .filter((t) => !/^\d+$/.test(t))
        .map((t) => t[0]?.toUpperCase() + t.slice(1))
        .join(" ");
    }
  }
  if (!name) return null;

  const PHOTO_HOSTS = /(?:images\.growtherapy|cdn\.growtherapy|grow-therapy-uploads|s3\.amazonaws\.com\/[^/]*grow)/i;
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
    /About(?:\s+me)?\s+([\s\S]{40,1500}?)(?=Specialties|Insurance|Languages|Education|Approach|$)/i,
  );
  const bio = sanitizeScrapedBio(bioMatch?.[1]?.trim() ?? null);

  const specialties = extractCsvBetween(
    bodyText,
    /Specialties\s+/i,
    /(?:Approach|Insurance|Languages|$)/i,
  );
  const modalities = extractCsvBetween(
    bodyText,
    /Approach(?:es)?\s+/i,
    /(?:Insurance|Languages|$)/i,
  );
  const languages = extractCsvBetween(
    bodyText,
    /Languages\s+/i,
    /(?:Insurance|$)/i,
  );
  let acceptedInsurances: string[] = [];
  const insMatch = bodyText.match(
    /Insurance(?:s|\s+accepted)?\s+([A-Z][^.|]{20,1500}?)(?=Sessions|Fees|$)/i,
  );
  if (insMatch?.[1]) acceptedInsurances = splitCsv(insMatch[1]);
  acceptedInsurances = acceptedInsurances.filter(
    (s) =>
      !/^(?:Years?|License|Training|Specialties|Languages|Insurance)\b/i.test(
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

export function verifyGrowMatch(
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
