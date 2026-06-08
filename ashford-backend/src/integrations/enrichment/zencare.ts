import { logger } from "../../lib/logger";
import {
  attrFromTag,
  collectImageCandidates,
  decodeEntities,
  dedupe,
  extractCsvBetween,
  extractVideoCandidates,
  fetchDirectoryHtml,
  lastNameToken,
  splitCsv,
  stripToBodyText,
  type VideoCandidate,
} from "./_directoryFetch";
import type { EnrichmentSource, FetchResult, LeadInput } from "./types";
import { rejectMatch } from "./types";

/**
 * Zencare directory enrichment (https://zencare.co).
 *
 * Zencare is the most Wow-friendly therapy directory we hit:
 *   - **Mandatory provider intro video** (Vimeo) on every profile —
 *     therapists pay Zencare to film a 1-2 minute intro at their
 *     office. We surface this in the prospect preview as a video
 *     hero, which is materially different from photo-only competitors.
 *   - **Hand-curated bio + approach** sections — Zencare editorializes
 *     more than Headway/PT, so the copy is preview-ready.
 *   - **Insurance + sliding-scale + accepting-new-clients flags**.
 *
 * URL pattern: `zencare.co/profile/<slug>` or `zencare.co/<state>/<city>/<slug>`.
 *
 * Same two-tier fetch as Headway/PT/Healthgrades — direct first
 * (Zencare is mostly server-rendered), ScraperAPI render=true
 * fallback for the rare Cloudflare challenge. Identity gate on
 * last-name overlap.
 */

const ZENCARE_HOST_RE = /^(?:www\.)?zencare\.co$/i;
const ZENCARE_PATH_RE =
  /^\/(?:profile|[a-z]{2}\/[a-z-]+|therapist|therapists)\/[a-z0-9-]+\/?$/i;

class ZencareSource implements EnrichmentSource {
  readonly key = "zencare";
  readonly label = "Zencare";

  isConfigured(): boolean {
    return true;
  }

  async fetch(lead: LeadInput): Promise<FetchResult> {
    const url = directProfileUrl(lead);
    if (!url) return null;
    const html = await fetchDirectoryHtml(url, "zencare");
    if (!html) return null;
    const profile = parseZencareProfile(html, url);
    if (!profile) return null;
    const verdict = verifyZencareMatch(lead, profile.name);
    if (verdict.kind === "reject") {
      logger.warn(
        { leadId: lead.id, profileName: profile.name, reason: verdict.reason },
        "zencare: rejecting match",
      );
      return rejectMatch(verdict.reason);
    }
    const summaryParts: string[] = [];
    if (profile.name) summaryParts.push(`Zencare: ${profile.name}`);
    if (profile.video) summaryParts.push(`video (${profile.video.provider})`);
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
      summary: summaryParts.join(" · ") || "Zencare profile matched.",
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
          videoUrl: profile.video?.embedUrl ?? null,
          videoProvider: profile.video?.provider ?? null,
          city: profile.city,
          state: profile.state,
          acceptsSlidingScale: profile.acceptsSlidingScale,
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

export const zencareSource = new ZencareSource();

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
  if (!ZENCARE_HOST_RE.test(parsed.hostname)) return null;
  if (!ZENCARE_PATH_RE.test(parsed.pathname)) return null;
  return `https://www.zencare.co${parsed.pathname.replace(/\/$/, "")}`;
};

interface ZencareProfile {
  name: string | null;
  photoUrl: string | null;
  bio: string | null;
  credentials: string | null;
  specialties: string[];
  modalities: string[];
  acceptedInsurances: string[];
  languages: string[];
  video: VideoCandidate | null;
  city: string | null;
  state: string | null;
  acceptsSlidingScale: boolean;
}

export const parseZencareProfile = (
  html: string,
  profileUrl: string,
): ZencareProfile | null => {
  const bodyText = stripToBodyText(html);
  let name: string | null = null;
  const h1 = html.match(/<h1[^>]*>([^<]{2,80})<\/h1>/i);
  if (h1?.[1]) name = decodeEntities(h1[1]).trim();
  if (!name) {
    const slug = profileUrl.match(/\/(?:profile|therapist|therapists)\/([a-z0-9-]+)/i)?.[1] ??
      profileUrl.match(/\/([a-z0-9-]+)\/?$/i)?.[1];
    if (slug) {
      name = slug
        .split("-")
        .filter((t) => !/^\d+$/.test(t))
        .map((t) => t[0]?.toUpperCase() + t.slice(1))
        .join(" ");
    }
  }
  if (!name) return null;

  // Photo — Zencare uploads sit on `images.zencare.co/...` or S3.
  let photoUrl: string | null = null;
  const PHOTO_HOSTS =
    /(?:images?\.zencare|zencare-uploads|s3\.amazonaws\.com\/[^/]*zencare|cdn\.zencare)/i;
  const PHOTO_BLOCK = /(?:icon|logo|sprite|favicon|og-image|placeholder|default-avatar)/i;
  for (const c of collectImageCandidates(html)) {
    if (PHOTO_BLOCK.test(c)) continue;
    if (!/\.(jpe?g|png|webp|avif)/i.test(c)) continue;
    if (PHOTO_HOSTS.test(c)) {
      photoUrl = c;
      break;
    }
  }

  // Video — Zencare's signature feature.
  const videos = extractVideoCandidates(html);
  const video = videos[0] ?? null;

  // Bio — anchor on "About me", "My approach", or "Personal Statement".
  const bioParts: string[] = [];
  const aboutMatch = bodyText.match(
    /(?:About me|About)\s+([\s\S]{40,1500}?)(?=My approach|Specialties|Insurance|Sessions|Languages|Education|$)/i,
  );
  if (aboutMatch?.[1]) bioParts.push(aboutMatch[1].trim());
  const approachMatch = bodyText.match(
    /My approach\s+([\s\S]{40,1500}?)(?=Specialties|Insurance|Sessions|Languages|Education|$)/i,
  );
  if (approachMatch?.[1]) bioParts.push(approachMatch[1].trim());
  const bio = bioParts.length > 0 ? bioParts.join("\n\n") : null;

  // Specialty / modality / insurance lists.
  const specialties = extractCsvBetween(
    bodyText,
    /Specialties\s+/i,
    /(?:Modalities|Insurance|Languages|Sessions|$)/i,
  );
  const modalities = extractCsvBetween(
    bodyText,
    /Modalities\s+/i,
    /(?:Insurance|Languages|Sessions|$)/i,
  );
  const languages = extractCsvBetween(
    bodyText,
    /Languages\s+/i,
    /(?:Insurance|Sessions|$)/i,
  );
  let acceptedInsurances: string[] = [];
  const insMatch = bodyText.match(
    /Insurance(?:\s+accepted|\s+plans?)?\s+([A-Z][^.|]{20,1500}?)(?=Sessions|Fees|Sliding|$)/i,
  );
  if (insMatch?.[1]) acceptedInsurances = splitCsv(insMatch[1]);
  acceptedInsurances = acceptedInsurances.filter(
    (s) =>
      !/^(?:Years?|License|Training|Master|Bachelor|Doctor|Specialties|Languages|Insurance)\b/i.test(
        s,
      ),
  );

  // Credentials — text immediately after the H1 (e.g. "LCSW, BCD").
  let credentials: string | null = null;
  const credMatch = html.match(
    /<h1[^>]*>[^<]+<\/h1>\s*(?:<[^>]+>\s*)*([^<\n]{2,80})/i,
  );
  if (credMatch?.[1]) {
    const c = credMatch[1].trim();
    if (/^[A-Z][\w.,\s]+$/.test(c)) credentials = c;
  }

  // Location.
  const cityMatch = bodyText.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s*([A-Z]{2})\b/);
  const city = cityMatch ? cityMatch[1] : null;
  const state = cityMatch ? cityMatch[2] : null;

  const acceptsSlidingScale = /sliding[- ]?scale/i.test(bodyText);

  // Refuse useless matches.
  const hasSignal =
    !!bio || !!photoUrl || !!video || specialties.length >= 2 ||
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
    video,
    city,
    state,
    acceptsSlidingScale,
  };
};

/**
 * Identity gate: the parsed profile name must contain the lead's
 * last-name token. Pure function exported for unit tests.
 */
export function verifyZencareMatch(
  lead: LeadInput,
  profileName: string | null,
):
  | { kind: "accept"; reason: string }
  | { kind: "reject"; reason: string } {
  if (!profileName) {
    return { kind: "reject", reason: "no profile name extracted" };
  }
  const last = lastNameToken(lead.name);
  if (!last) {
    return {
      kind: "reject",
      reason: `lead name has no usable last-name token (${lead.name})`,
    };
  }
  if (profileName.toLowerCase().includes(last)) {
    return {
      kind: "accept",
      reason: `last-name token "${last}" found in profile name`,
    };
  }
  return {
    kind: "reject",
    reason: `profile name "${profileName}" missing last-name token "${last}"`,
  };
}

void attrFromTag; // re-export companion only used by other scrapers
