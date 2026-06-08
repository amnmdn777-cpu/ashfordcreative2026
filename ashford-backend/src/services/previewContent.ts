import { eq, desc } from "drizzle-orm";
import { db, leadEnrichment, leads } from "@workspace/db";
import type {
  PreviewContent,
  PreviewWebsitePage,
} from "@workspace/api-zod";
import {
  ensurePortalForLead,
  getPortalEnrichmentForLead,
} from "./portals";
import {
  validateAccentColor,
  validateLogoUrl,
} from "./previewContentHarmony";
import { isSeoFarmPath } from "../integrations/enrichment/currentWebsitePages";
import { detectBookingWidget } from "./bookingWidgetDetect";
import { suggestDomains } from "./domainSuggest";
import { draftJournalEntriesWithLlm } from "./draftJournal";
import { logger } from "../lib/logger";
import {
  resolvePracticeName,
  type GooglePlacesPayload,
  type LinkedInPayload,
  type WebsiteMetaPayload,
} from "./practiceNameResolver";

// Photo policy (locked by Ashford 2026-05): a portrait may ONLY come
// from Psychology Today, Headway, or the prospect's own first-party
// website host. Any other source (Google Places, Yelp, Healthgrades,
// AI, random WordPress media library — the Jamonte "Grinch" case) is
// dropped. Used for hero AND for per-team-member photos so the
// "Meet <name>" card can never show an off-policy image. Mirrors
// `heroImageBackfill.ts`.
const TRUSTED_PHOTO_HOSTS: readonly string[] = [
  "psychologytoday.com",
  "cdn.psychologytoday.com",
  "post.psychologytoday.com",
  "headway.co",
  "d3atagt0rnqk7k.cloudfront.net",
];

// Hosts whose pages are NEVER first-party prospect content even if the
// lead's `currentWebsite` happens to point at one. Mirrors the intake
// filter in `websiteContentApify.ts` — duplicated here as defense-in-
// depth for legacy enrichment rows captured before that filter existed.
const DIRECTORY_HOSTS: readonly string[] = [
  "psychologytoday.com",
  "headway.co",
  "helloalma.com",
  "growtherapy.com",
  "zencare.co",
  "zocdoc.com",
  "healthgrades.com",
  "vitals.com",
  "calendly.com",
];

function isDirectoryHost(url: string | null | undefined): boolean {
  const host = normHost(url);
  if (!host) return false;
  return DIRECTORY_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
}

function normHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Map a photo URL to the directory it came from, by host. Returns
 * `null` for non-directory hosts (first-party sites, unknown CDNs,
 * malformed input). Pure — exported for unit tests.
 *
 * Used by the hero-image gate to decide trust based on the photo's
 * actual origin rather than the team's name/bio source label. The
 * Headway scraper occasionally only patches a portrait into a team
 * member whose name came from website_meta; the gate must still
 * recognize the photo as Headway-sourced.
 */
export function detectPhotoDirectorySource(
  photoUrl: string | null | undefined,
): "headway" | "psychology_today" | null {
  const host = normHost(photoUrl);
  if (!host) return null;
  if (host === "headway.co" || host.endsWith(".headway.co")) return "headway";
  if (
    host === "psychologytoday.com" ||
    host.endsWith(".psychologytoday.com") ||
    host === "d3atagt0rnqk7k.cloudfront.net"
  ) {
    return "psychology_today";
  }
  return null;
}

function photoAllowed(
  photoUrl: string | null | undefined,
  firstPartyHost: string | null,
): boolean {
  if (!photoUrl) return false;
  const host = normHost(photoUrl);
  if (!host) return false;
  if (
    TRUSTED_PHOTO_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
  ) {
    return true;
  }
  if (firstPartyHost && (host === firstPartyHost || host.endsWith(`.${firstPartyHost}`))) {
    return true;
  }
  return false;
}

/**
 * Builds the personalized {@link PreviewContent} sent to the prospect-
 * facing preview page.
 *
 * # Architecture (Ashford-led 2026-05 rewrite)
 *
 * The whole point of the prospect preview is the "wow, they already
 * know me" moment when the prospect opens the link from the rep's
 * email. That moment depends on the prospect seeing **their own**
 * verbatim content — practice name, photo, services, bio, testimonials
 * — not paraphrased or AI-rewritten. So this builder is **public-
 * source-first, AI as fallback only**, the inverse of the previous
 * pipeline where AI synthesis would override every per-source
 * heuristic the moment Claude returned ≥50% match-confidence.
 *
 * Per-field priority cascade (first non-empty wins):
 *
 * | Field             | Order                                                              |
 * |-------------------|--------------------------------------------------------------------|
 * | practiceName      | Google Places · website JSON-LD · website title · CRM · AI         |
 * | tagline           | rep `profileBlurb`                                                 |
 * | mission           | website meta · website JSON-LD · PT bio · website Apify body · AI  |
 * | heroImage         | PT/Headway (gated+verified) · first-party site portrait            |
 * | services          | website list · JSON-LD knowsAbout · Apify · Headway/PT · AI        |
 * | team[]            | website crawl (Apify/legacy) · website regex · Headway · PT · AI   |
 * | specialties       | Headway · PT · website JSON-LD · website services list             |
 * | acceptedInsurances| Headway · PT                                                       |
 * | languages         | Headway · PT                                                       |
 * | modalities        | Headway                                                            |
 * | testimonials      | website homepage scrape (verbatim quotes)                          |
 * | socialLinks       | website outbound links · PT/Headway profile URLs                   |
 * | brand             | website meta scrape (logo/favicon/accent/font — first-party only)  |
 * | reviews           | Google Places (Yelp fallback)                                      |
 *
 * AI synthesis (`ai_synthesis`) keeps two valuable jobs:
 *   1. `discardedSources` — Claude is good at spotting cross-source
 *      mismatches (Rachele Mays case) — it remains a tracing aid.
 *   2. `pages[].rewrittenIntro` — adapting the prospect's own page
 *      copy into the chosen template's voice. This is the one place
 *      where an AI rewrite is actually a feature, not a fabrication.
 *
 * The previous "useAi when matchConfidence >= 50" override is removed
 * outright. AI text fields are now consulted **only when every other
 * source returned nothing** for that specific field.
 *
 * Soft-fails to a near-empty content with `fieldSources = {}` so the
 * preview renderer can fall back to its template-default samples on a
 * field-by-field basis.
 */
export const buildPreviewContent = async (
  leadId: number,
): Promise<{
  content: PreviewContent;
  pages: PreviewWebsitePage[];
}> => {
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!lead) {
    return { content: emptyContent(), pages: [] };
  }

  // Re-use the already-merged portal enrichment so we never drift from
  // the post-conversion portal view. ensurePortalForLead is idempotent.
  let enrichment = null;
  try {
    enrichment = await getPortalEnrichmentForLead(leadId);
  } catch (err) {
    logger.warn(
      { err, leadId },
      "buildPreviewContent: portal enrichment failed",
    );
  }

  const portal = await ensurePortalForLead(leadId).catch(() => null);

  // Load every raw payload up-front in parallel so the per-field
  // cascade below is just synchronous lookups.
  const [
    placesPayload,
    websiteMetaPayload,
    ptPayload,
    headwayPayload,
    npiPayload,
    apifyPagesPayload,
    legacyPagesPayload,
    aiPayload,
    linkedinPayload,
  ] = await Promise.all([
    getRawPayload(leadId, "google_places"),
    getRawPayload(leadId, "website_meta"),
    getRawPayload(leadId, "psychology_today"),
    getRawPayload(leadId, "headway"),
    getRawPayload(leadId, "npi_registry"),
    getRawPayload(leadId, "website_content_apify"),
    getRawPayload(leadId, "current_website_pages"),
    getRawPayload(leadId, "ai_synthesis"),
    getRawPayload(leadId, "linkedin_apify"),
  ]);

  const fieldSources: Record<string, string> = {};
  const setSource = (k: string, v: string | undefined) => {
    if (v) fieldSources[k] = v;
  };

  // ---- practiceName --------------------------------------------------
  // LOT 2.3 — fixed-priority waterfall, NOT confidence-ranked. See
  // services/practiceNameResolver.ts for the rationale. The previous
  // code preferred website_meta.title (confidence 70) over LinkedIn
  // (confidence 60), which surfaced builder defaults like "Hostinger
  // Horizons" as the prospect's practice name (lead 531, Gail). We
  // also try JSON-LD `name` first because that's self-attested
  // structured data and outranks raw <title> heuristics.
  let practiceName: string | null = null;
  const fromLd = readJsonLdString(websiteMetaPayload, "name");
  if (fromLd) {
    practiceName = fromLd;
    setSource("practiceName", "website_meta");
  } else {
    const resolved = resolvePracticeName({
      linkedin: linkedinPayload as LinkedInPayload,
      googlePlaces: placesPayload as GooglePlacesPayload,
      websiteMeta: websiteMetaPayload as WebsiteMetaPayload,
      leadPractice: lead.practice ?? null,
      aiPracticeName:
        typeof aiPayload?.practiceName === "string"
          ? (aiPayload.practiceName as string)
          : null,
    });
    if (resolved) {
      practiceName = resolved.value;
      setSource("practiceName", resolved.source);
    }
  }

  // ---- tagline -------------------------------------------------------
  // Rep-written profileBlurb. Always rep-controlled; AI never touches.
  let tagline: string | null = null;
  if (lead.profileBlurb && lead.profileBlurb.trim()) {
    tagline = lead.profileBlurb.trim();
    setSource("tagline", "lead_record");
  }

  // ---- mission -------------------------------------------------------
  // Rule: the prospect's own words come first. Their site's meta
  // description is what they (or their agency) wrote to introduce the
  // practice — that's the gold standard. Then JSON-LD description,
  // then their PT bio (also self-written), then a long-form Apify
  // paragraph from About, then AI fallback.
  // Prefer the longest, most specific bio. Squarespace/Wix sites often
  // ship a generic 1-line meta description ("Therapy in Houston, TX")
  // while PT/Headway profiles carry the practitioner's actual 2-3
  // paragraph bio. Picking on length+specificity rather than a fixed
  // priority keeps the rich self-written content even when meta is
  // present but generic. The Galatia Cepeda case (#231): meta said
  // "Therapy by Dr. Cepeda" → the prospect saw "The Architect" AI
  // copy because no path captured the rich PT bio that already existed.
  type MissionCandidate = { text: string; source: string; weight: number };
  const candidates: MissionCandidate[] = [];
  const websiteMetaDescription =
    (typeof websiteMetaPayload?.description === "string"
      ? websiteMetaPayload.description
      : null) ??
    (isRecord(websiteMetaPayload?.og)
      ? str(websiteMetaPayload!.og["description"])
      : null);
  if (websiteMetaDescription && websiteMetaDescription.trim().length > 0) {
    const t = websiteMetaDescription.trim();
    candidates.push({ text: t, source: "website_meta", weight: t.length });
  } else {
    const ldDesc = readJsonLdString(websiteMetaPayload, "description");
    if (ldDesc) candidates.push({ text: ldDesc, source: "website_meta", weight: ldDesc.length });
  }
  const ptBio = readPtBio(ptPayload);
  if (ptBio && ptBio.length > 40) {
    candidates.push({ text: ptBio, source: "psychology_today", weight: ptBio.length + 40 });
  }
  const headwayBio = headwayPayload && typeof headwayPayload.bio === "string"
    ? (headwayPayload.bio as string)
    : null;
  if (headwayBio && headwayBio.length > 40) {
    candidates.push({ text: headwayBio, source: "headway", weight: headwayBio.length + 40 });
  }
  candidates.sort((a, b) => b.weight - a.weight);
  let mission: string | null = null;
  if (candidates.length > 0) {
    const winner = candidates[0];
    if (winner) {
      mission = winner.text.length > 600 ? `${winner.text.slice(0, 599)}…` : winner.text;
      setSource("mission", winner.source);
    }
  }
  if (!mission) {
    const aboutPara = pickAboutParagraph(apifyPagesPayload ?? legacyPagesPayload);
    if (aboutPara) {
      mission = aboutPara;
      setSource("mission", "current_website_pages");
    }
  }
  if (!mission && typeof aiPayload?.mission === "string") {
    const m = (aiPayload.mission as string).trim();
    if (m) {
      mission = m;
      setSource("mission", "ai_synthesis");
    }
  }
  if (!mission && typeof aiPayload?.aboutBlurb === "string") {
    const m = (aiPayload.aboutBlurb as string).trim();
    if (m) {
      mission = m;
      setSource("mission", "ai_synthesis");
    }
  }

  // ---- heroImage -----------------------------------------------------
  // Photo policy stays unchanged (locked 2026-05): hero/portraits
  // ONLY from Psychology Today, Headway, or the prospect's own
  // personal site (portrait heuristic on crawled images). NEVER from
  // AI synthesis, Google Places photos, or Yelp.
  //
  // Identity gate (#225, Rachele Mays case): even on a trusted host,
  // the matched profile must verify against the lead's known identity
  // (last-name + city) before we use the headshot.
  let heroImage: string | null = null;
  // The team's name/bio source and the team photo's source can diverge:
  // when website_meta supplied the team via its regex pass (no photo),
  // portals.ts later patches in Headway's headshot without overwriting
  // the team source label (the names/bios genuinely still belong to
  // website_meta). Gating "trusted" on the *label* in that case drops
  // a valid Headway portrait. Gate on the photo URL's host instead.
  const teamPhotoUrl = enrichment?.team?.[0]?.photo ?? null;
  const photoDirectorySource = detectPhotoDirectorySource(teamPhotoUrl);
  const teamSource = photoDirectorySource ?? enrichment?.fieldSources.team ?? "";
  const teamPhotoIsTrusted =
    teamSource === "psychology_today" || teamSource === "headway";
  const ptIdentityOk = teamPhotoIsTrusted
    ? await verifyEnrichedIdentity(
        leadId,
        lead.name,
        lead.city,
        teamSource,
        lead.currentWebsite,
      )
    : false;
  if (
    teamPhotoIsTrusted &&
    ptIdentityOk &&
    enrichment?.team?.[0]?.photo &&
    enrichment.team[0].photo.startsWith("http")
  ) {
    heroImage = enrichment.team[0].photo;
    setSource("heroImage", teamSource);
  } else {
    if (teamPhotoIsTrusted && !ptIdentityOk) {
      logger.warn(
        { leadId, leadName: lead.name, leadCity: lead.city, teamSource },
        "previewContent: dropping enriched photo — identity verification failed (name/city mismatch)",
      );
    }
    const heroPagesPayload = apifyPagesPayload ?? legacyPagesPayload;
    // Portrait heuristic with FIRST-PARTY ENFORCEMENT (#224 architect
    // review 2026-05). Heroes/portraits must come ONLY from PT,
    // Headway, or the prospect's OWN personal site. The PT/Headway
    // branch above handles the first two; this branch enforces the
    // "own personal site" half.
    const PORTRAIT_HINTS =
      /headshot|portrait|team|about|staff|bio|founder|therapist|provider|clinician|profile/i;
    const trustedHost = (() => {
      if (!lead.currentWebsite) return null;
      try {
        const u = new URL(
          lead.currentWebsite.startsWith("http")
            ? lead.currentWebsite
            : `https://${lead.currentWebsite}`,
        );
        return u.hostname.toLowerCase().replace(/^www\./, "");
      } catch {
        return null;
      }
    })();
    const isFirstPartyHost = (rawUrl: string): boolean => {
      if (!trustedHost) return false;
      try {
        const u = new URL(rawUrl);
        const host = u.hostname.toLowerCase().replace(/^www\./, "");
        return host === trustedHost || host.endsWith(`.${trustedHost}`);
      } catch {
        return false;
      }
    };
    if (
      trustedHost &&
      heroPagesPayload &&
      Array.isArray(heroPagesPayload.pages)
    ) {
      // Require the IMAGE filename itself to look like a portrait —
      // not just the containing page. A page named /about will
      // commonly carry a hero landscape (sky, building, plants)
      // alongside a real headshot; if we trust "page is About →
      // first image wins" we end up with non-people imagery on the
      // prospect's preview (Jamonte Banks case 2026-05: a stock
      // sky cloud lifted from his Squarespace About hero). The
      // page-level signal is now a soft tiebreaker rather than a
      // pass-through gate.
      const NEGATIVE_HINTS =
        /\b(hero|banner|background|bg|cover|landscape|sky|cloud|building|exterior|interior|office|room|floor|ceiling|doormat|entrance|wallpaper|texture|gradient|abstract)\b/i;
      outer: for (const p of heroPagesPayload.pages) {
        if (!isRecord(p)) continue;
        const pathHint =
          (typeof p.path === "string" ? p.path : "") +
          " " +
          (typeof p.title === "string" ? p.title : "");
        const pageLooksPersonal = PORTRAIT_HINTS.test(pathHint);
        if (!Array.isArray(p.images)) continue;
        for (const img of p.images) {
          if (typeof img !== "string" || !img.startsWith("http")) continue;
          if (!isFirstPartyHost(img)) continue;
          if (NEGATIVE_HINTS.test(img)) continue;
          if (!PORTRAIT_HINTS.test(img)) continue;
          // Image filename hints AND the surrounding page also looks
          // personal — strongest signal we can synthesize without
          // image-content analysis. Without the page check we'd accept
          // a stray "/headshot-of-staff-jane.jpg" on an unrelated
          // service page; with it, we anchor to the about/team page
          // where the practitioner's own portrait is most likely.
          if (pageLooksPersonal) {
            heroImage = img;
            setSource("heroImage", "current_website_pages");
            break outer;
          }
        }
      }
    }
  }

  // ---- services ------------------------------------------------------
  // The prospect's own website wins. JSON-LD `knowsAbout` /
  // `hasOfferCatalog`, then the heading-extracted `services` array
  // from the homepage scrape, then Headway specialties, then PT
  // specialties, then AI as a last resort. Output is normalized to
  // {name, description: nullable}.
  let services: PreviewContent["services"] = [];
  const ldKnowsAbout = readJsonLdStringArray(websiteMetaPayload, "knowsAbout");
  if (ldKnowsAbout.length > 0) {
    services = ldKnowsAbout.map((name) => ({ name, description: null }));
    setSource("services", "website_meta");
  } else if (
    websiteMetaPayload &&
    Array.isArray(websiteMetaPayload.services) &&
    (websiteMetaPayload.services as unknown[]).length > 0
  ) {
    services = (websiteMetaPayload.services as unknown[])
      .filter((s): s is string => typeof s === "string")
      .map((name) => ({ name, description: null }));
    setSource("services", "website_meta");
  }
  if (services.length === 0) {
    // The merged enrichment surface already aggregates Apify/PT — keep
    // it as a secondary lane, but only when the website didn't speak.
    const merged = enrichment?.services ?? [];
    if (merged.length > 0) {
      services = merged.map((name) => ({ name, description: null }));
      setSource("services", enrichment!.fieldSources.services ?? "psychology_today");
    }
  }
  if (services.length === 0 && Array.isArray(aiPayload?.services)) {
    const aiServices = (aiPayload.services as unknown[])
      .filter(isRecord)
      .filter((s) => typeof s.name === "string")
      .map((s) => ({
        name: s.name as string,
        description: typeof s.description === "string" ? s.description : null,
      }));
    if (aiServices.length > 0) {
      services = aiServices;
      setSource("services", "ai_synthesis");
    }
  }

  // ---- specialties ---------------------------------------------------
  let specialties: string[] = [];
  if (
    headwayPayload &&
    Array.isArray(headwayPayload.specialties) &&
    (headwayPayload.specialties as unknown[]).length > 0
  ) {
    specialties = (headwayPayload.specialties as unknown[]).filter(
      (s): s is string => typeof s === "string",
    );
    setSource("specialties", "headway");
  } else {
    const ptProfile = readPtProfile(ptPayload);
    if (
      ptProfile &&
      Array.isArray(ptProfile.specialties) &&
      (ptProfile.specialties as unknown[]).length > 0
    ) {
      specialties = (ptProfile.specialties as unknown[]).filter(
        (s): s is string => typeof s === "string",
      );
      setSource("specialties", "psychology_today");
    } else if (Array.isArray(aiPayload?.specialties)) {
      const aiSpec = (aiPayload.specialties as unknown[]).filter(
        (s): s is string => typeof s === "string",
      );
      if (aiSpec.length > 0) {
        specialties = aiSpec;
        setSource("specialties", "ai_synthesis");
      }
    }
  }

  // ---- acceptedInsurances --------------------------------------------
  let acceptedInsurances: string[] = [];
  if (
    headwayPayload &&
    Array.isArray(headwayPayload.acceptedInsurances) &&
    (headwayPayload.acceptedInsurances as unknown[]).length > 0
  ) {
    acceptedInsurances = (headwayPayload.acceptedInsurances as unknown[])
      .filter((s): s is string => typeof s === "string");
    setSource("acceptedInsurances", "headway");
  } else {
    const ptProfile = readPtProfile(ptPayload);
    if (
      ptProfile &&
      Array.isArray(ptProfile.insurances) &&
      (ptProfile.insurances as unknown[]).length > 0
    ) {
      acceptedInsurances = (ptProfile.insurances as unknown[]).filter(
        (s): s is string => typeof s === "string",
      );
      setSource("acceptedInsurances", "psychology_today");
    }
  }

  // ---- languages -----------------------------------------------------
  let languages: string[] = [];
  if (
    headwayPayload &&
    Array.isArray(headwayPayload.languages) &&
    (headwayPayload.languages as unknown[]).length > 0
  ) {
    languages = (headwayPayload.languages as unknown[]).filter(
      (s): s is string => typeof s === "string",
    );
    setSource("languages", "headway");
  } else {
    const ptProfile = readPtProfile(ptPayload);
    if (
      ptProfile &&
      Array.isArray(ptProfile.languages) &&
      (ptProfile.languages as unknown[]).length > 0
    ) {
      languages = (ptProfile.languages as unknown[]).filter(
        (s): s is string => typeof s === "string",
      );
      setSource("languages", "psychology_today");
    }
  }

  // ---- modalities ----------------------------------------------------
  let modalities: string[] = [];
  if (
    headwayPayload &&
    Array.isArray(headwayPayload.modalities) &&
    (headwayPayload.modalities as unknown[]).length > 0
  ) {
    modalities = (headwayPayload.modalities as unknown[]).filter(
      (s): s is string => typeof s === "string",
    );
    setSource("modalities", "headway");
  }

  // ---- mode flags + price (Headway only — most authoritative) --------
  const offersInPerson =
    headwayPayload && typeof headwayPayload.inPerson === "boolean"
      ? (headwayPayload.inPerson as boolean)
      : null;
  const offersTelehealth =
    headwayPayload && typeof headwayPayload.virtual === "boolean"
      ? (headwayPayload.virtual as boolean)
      : null;
  const acceptsSlidingScale =
    headwayPayload && typeof headwayPayload.acceptsSlidingScale === "boolean"
      ? (headwayPayload.acceptsSlidingScale as boolean)
      : null;
  let pricePerSession: { min: number | null; max: number | null } | null = null;
  if (headwayPayload && isRecord(headwayPayload.pricePerSession)) {
    const rec = headwayPayload.pricePerSession;
    const min = typeof rec.min === "number" ? rec.min : null;
    const max = typeof rec.max === "number" ? rec.max : null;
    if (min !== null || max !== null) {
      pricePerSession = { min, max };
    }
  }
  if (offersInPerson !== null) setSource("offersInPerson", "headway");
  if (offersTelehealth !== null) setSource("offersTelehealth", "headway");
  if (acceptsSlidingScale !== null) setSource("acceptsSlidingScale", "headway");
  if (pricePerSession) setSource("pricePerSession", "headway");

  // ---- team ----------------------------------------------------------
  // Photo-first public cascade. Order matters:
  //   1. Crawled team from the prospect's own site (authoritative AND
  //      comes with first-party photos when present).
  //   2. Already-merged enrichment (Headway/PT/etc.) — these carry
  //      gated, identity-verified portrait URLs from trusted hosts.
  //      Run BEFORE the regex pass because the regex extractor cannot
  //      capture <img> URLs (Apify deep-crawl finds them; ad-hoc
  //      `<h><p>` regex sees text only). Letting the regex win first
  //      means an `enrichment.team[0].photo` from Headway gets
  //      blanked to null in the preview, and the prospect sees a
  //      placeholder instead of their own portrait.
  //   3. Heading-extracted team from `website_meta` regex pass —
  //      best-effort name+bio with NO photo. Useful only when there
  //      is no Headway/PT match at all (e.g. a small clinic site
  //      whose team page doesn't trip our directory scrapers).
  //   4. AI fallback — only when every public source is empty.
  const firstPartyPhotoHost = normHost(
    lead.currentWebsite ?? enrichment?.website ?? null,
  );
  const gatePhoto = (p: string | null | undefined): string | null =>
    photoAllowed(p, firstPartyPhotoHost) ? (p as string) : null;
  const dropPtTeamPhotos = teamPhotoIsTrusted && !ptIdentityOk;
  const safePtPhoto = (p: string | null | undefined): string | null =>
    dropPtTeamPhotos ? null : gatePhoto(p);

  // 1. Crawled team from the prospect's own site (authoritative).
  const crawledSource = apifyPagesPayload ?? legacyPagesPayload;
  let team: PreviewContent["team"] = [];
  if (crawledSource && Array.isArray(crawledSource.team)) {
    const crawled = crawledSource.team
      .filter(isRecord)
      .filter((t) => typeof t.name === "string");
    if (crawled.length > 0) {
      team = crawled.map((t) => ({
        name: t.name as string,
        credentials: typeof t.credentials === "string" ? t.credentials : null,
        bio: typeof t.bio === "string" ? t.bio : null,
        photo:
          typeof t.photo === "string"
            ? gatePhoto(t.photo)
            : null,
      }));
      setSource("team", "current_website_pages");
    }
  }

  // 2. Already-merged enrichment (Headway/PT/etc — photos gated). MUST
  //    run before the regex pass below, otherwise step 3 returns a
  //    photo-less team and clobbers the trusted directory portrait.
  if (team.length === 0 && enrichment?.team && enrichment.team.length > 0) {
    team = enrichment.team
      .filter((t) => t.name)
      .map((t) => ({
        name: t.name,
        credentials: t.credentials ?? null,
        bio: t.bio ?? null,
        photo: safePtPhoto(t.photo),
      }));
    setSource("team", enrichment.fieldSources.team ?? "psychology_today");
  }

  // 3. Heading-extracted team from website meta scrape (regex
  //    `teamStructured`). Only consulted when no directory match
  //    surfaced — regex cannot capture <img> URLs reliably so the
  //    portrait would be null on the way out.
  if (
    team.length === 0 &&
    websiteMetaPayload &&
    Array.isArray(websiteMetaPayload.teamStructured) &&
    (websiteMetaPayload.teamStructured as unknown[]).length > 0
  ) {
    team = (websiteMetaPayload.teamStructured as unknown[])
      .filter(isRecord)
      .filter((t) => typeof t.name === "string")
      .map((t) => ({
        name: t.name as string,
        credentials: typeof t.credentials === "string" ? t.credentials : null,
        bio: typeof t.bio === "string" ? t.bio : null,
        photo: null, // regex extractor doesn't capture photos.
      }));
    setSource("team", "website_meta");
  }

  // 4. AI fallback ONLY if nothing public surfaced. Even then, never
  //    rewrite a bio — accept only NEW members AI proposed that no
  //    public source mentioned, with an AI-attributed bio.
  if (team.length === 0 && Array.isArray(aiPayload?.team)) {
    const aiTeam = (aiPayload.team as unknown[])
      .filter(isRecord)
      .filter((t) => typeof t.name === "string")
      .map((t) => ({
        name: t.name as string,
        credentials: typeof t.credentials === "string" ? t.credentials : null,
        bio: typeof t.bio === "string" ? t.bio : null,
        photo: null,
      }));
    if (aiTeam.length > 0) {
      team = aiTeam;
      setSource("team", "ai_synthesis");
    }
  }

  // 5. A1 (founder 2026-05-19) — practitioner_photos cascade backfill.
  //    When the existing passes produced a team but team[0].photo is
  //    empty, consult the practitioner_photos enrichment for a real
  //    portrait scraped off the cabinet site or Psychology Today.
  if (team.length > 0 && (!team[0]!.photo || team[0]!.photo === "")) {
    try {
      const photosRaw = await getRawPayload(leadId, "practitioner_photos");
      const url =
        (photosRaw && typeof photosRaw.practitioner_url === "string")
          ? photosRaw.practitioner_url
          : null;
      const source =
        (photosRaw && typeof photosRaw.source === "string")
          ? photosRaw.source
          : null;
      if (url && url.startsWith("http") && source !== "fallback_initials") {
        team = [{ ...team[0]!, photo: url }, ...team.slice(1)];
        setSource("team", source ?? "practitioner_photos");
      }
    } catch (err) {
      logger.warn(
        { err: String(err), leadId },
        "previewContent: practitioner_photos backfill failed",
      );
    }
  }

  // ---- reviews -------------------------------------------------------
  const reviews = (enrichment?.reviews ?? []).map((r) => ({
    author: r.author,
    body: r.text,
    rating: r.rating,
    source: r.source ?? "Google",
  }));
  if (reviews.length > 0) {
    setSource("reviews", enrichment?.fieldSources.reviews ?? "google_places");
  }

  // ---- testimonials --------------------------------------------------
  // Hand-curated quotes from the prospect's own homepage. Different
  // from Google reviews — a strong, often-overlooked trust signal.
  let testimonials: PreviewContent["testimonials"] = [];
  if (websiteMetaPayload && Array.isArray(websiteMetaPayload.testimonials)) {
    testimonials = (websiteMetaPayload.testimonials as unknown[])
      .filter(isRecord)
      .filter((t) => typeof t.body === "string")
      .map((t) => ({
        author: typeof t.author === "string" ? t.author : null,
        body: t.body as string,
        source: lead.currentWebsite ?? null,
      }));
    if (testimonials.length > 0) {
      setSource("testimonials", "website_meta");
    }
  }

  // ---- locations / hours --------------------------------------------
  const locations: PreviewContent["locations"] = [];
  if (enrichment?.formattedAddress || enrichment?.hours?.length) {
    const cityLabel = lead.city ? `${lead.city} office` : "Office";
    locations.push({
      name: practiceName ?? cityLabel,
      address: enrichment.formattedAddress ?? "",
      hours: enrichment.hours ?? [],
    });
    if (enrichment.formattedAddress) {
      setSource(
        "address",
        enrichment.fieldSources.formattedAddress ?? "google_places",
      );
    }
    if (enrichment.hours?.length) {
      setSource("hours", enrichment.fieldSources.hours ?? "google_places");
    }
  }

  // ---- contact -------------------------------------------------------
  const contact = {
    phone: enrichment?.formattedPhone ?? lead.phone ?? null,
    email: lead.email ?? null,
    website: enrichment?.website ?? lead.currentWebsite ?? null,
  };
  if (contact.phone) {
    setSource(
      "phone",
      enrichment?.fieldSources.formattedPhone ?? "lead_record",
    );
  }
  if (contact.website) {
    setSource("website", enrichment?.fieldSources.website ?? "lead_record");
  }

  // ---- socialLinks ---------------------------------------------------
  // Site-discovered hrefs first; then PT/Headway profile URLs the
  // matched directories give us back.
  const socialFromSite =
    websiteMetaPayload && isRecord(websiteMetaPayload.socialLinks)
      ? (websiteMetaPayload.socialLinks as Record<string, unknown>)
      : null;
  const socialLinks = {
    instagram: str(socialFromSite?.instagram) ?? null,
    facebook: str(socialFromSite?.facebook) ?? null,
    linkedin: str(socialFromSite?.linkedin) ?? null,
    tiktok: str(socialFromSite?.tiktok) ?? null,
    youtube: str(socialFromSite?.youtube) ?? null,
    psychologyToday:
      str(socialFromSite?.psychologyToday) ??
      readPtProfileUrl(ptPayload) ??
      null,
    headway:
      str(socialFromSite?.headway) ??
      (typeof headwayPayload?.profileUrl === "string"
        ? (headwayPayload.profileUrl as string)
        : null),
  };
  if (Object.values(socialLinks).some((v) => !!v)) {
    setSource("socialLinks", "website_meta");
  }

  // ---- brand ---------------------------------------------------------
  // Pulled from the website_meta payload. Logos and favicons coming
  // from a third-party domain are left null (first-party only).
  const brandRaw =
    websiteMetaPayload && isRecord(websiteMetaPayload.brand)
      ? (websiteMetaPayload.brand as Record<string, unknown>)
      : null;
  const sameOrigin = (u: string | null): string | null => {
    if (!u || !firstPartyPhotoHost) return null;
    try {
      const host = new URL(u).hostname.toLowerCase().replace(/^www\./, "");
      if (host === firstPartyPhotoHost || host.endsWith(`.${firstPartyPhotoHost}`)) {
        return u;
      }
    } catch {
      /* fall through */
    }
    return null;
  };
  // Harmony gates (see `previewContentHarmony.ts`):
  //  - accentColor: dropped if it fails a contrast/luminance check
  //    against the cream recap band, so we never ship an unreadable
  //    accent that paints invisible pill borders.
  //  - logoUrl: shape-validated (no favicons / sprites / tracking
  //    pixels) before being labelled as a brand mark.
  // Both validators soft-fail to null so a half-broken brand signal
  // collapses gracefully back to the template's own sample, rather
  // than a visibly degraded preview.
  const brand = {
    logoUrl: validateLogoUrl(sameOrigin(str(brandRaw?.logoUrl))),
    faviconUrl: sameOrigin(str(brandRaw?.faviconUrl)),
    accentColor: validateAccentColor(str(brandRaw?.accentColor)),
    fontFamily: str(brandRaw?.fontFamily),
  };
  if (brand.logoUrl || brand.accentColor || brand.fontFamily) {
    setSource("brand", "website_meta");
  }

  // ---- pages crawled -------------------------------------------------
  // Prefer the Apify deep-crawl payload (richer: images, paragraphs,
  // real page titles) over the legacy in-process current_website_pages
  // source. AI per-page rewrites are still attached because that's the
  // good use of Claude — adapting voice to the chosen template.
  const pagesPayload = apifyPagesPayload ?? legacyPagesPayload;
  const aiPageRewrites = new Map<string, string>();
  if (Array.isArray(aiPayload?.pages)) {
    for (const p of aiPayload.pages as unknown[]) {
      if (!isRecord(p)) continue;
      if (typeof p.path === "string" && typeof p.rewrittenIntro === "string") {
        aiPageRewrites.set(p.path, p.rewrittenIntro);
      }
    }
  }
  const pages: PreviewWebsitePage[] = [];
  // Hard gate: if the prospect doesn't have their own first-party website
  // (no `currentWebsite` on the lead, or `currentWebsite` is a competitor
  // directory profile like Headway/PT/Alma), don't synthesize a pages list
  // at all. Without this, leads whose only "site" is a directory listing
  // would surface that directory's nav ("Find a therapist", "Mental health
  // resources & guides") as if it were their own — turning the portal
  // into an ad for the competitor we're displacing. Per-page filters
  // below still run as defense-in-depth for mixed crawls, but skipping
  // up front means we also don't emit a near-empty bar with just a
  // single home pill.
  const prospectHasOwnSite =
    !!lead.currentWebsite && !isDirectoryHost(lead.currentWebsite);
  if (prospectHasOwnSite && pagesPayload && Array.isArray(pagesPayload.pages)) {
    for (const p of pagesPayload.pages) {
      if (!isRecord(p)) continue;
      if (typeof p.url !== "string" || typeof p.path !== "string") continue;
      // Defense-in-depth: even if an old crawl cached SEO landing pages
      // ("/psychiatrists/illinois/chicago", "find-psychiatrists-in-..."),
      // never carry them into the prospect's preview. The crawler-side
      // filter exists in currentWebsitePages.ts → isSeoFarmPath, but
      // existing enrichment rows pre-date that filter.
      if (isSeoFarmPath(p.path)) continue;
      // Never surface a competitor-directory page as the prospect's own
      // content. When `lead.currentWebsite` was a Headway / PT / Alma
      // profile, legacy crawls captured the directory's marketing copy
      // ("Find a therapist", "How Headway works") and the AI rewrite
      // step then served it back as the prospect's rewritten page —
      // turning their preview into an ad for a competitor we're trying
      // to displace. Drop directory-host pages outright; templates fall
      // back to first-party copy or sample content.
      if (isDirectoryHost(p.url)) continue;
      // Apify's `website_content_apify` source returns `text`/`markdown`
      // but leaves `title`/`h1`/`paragraphs` empty. Derive them from the
      // markdown so the pages bar can show readable labels and the
      // rebuilt-page view has real body copy.
      const markdown = typeof p.markdown === "string" ? p.markdown : "";
      const text = typeof p.text === "string" ? p.text : "";
      const h1FromMarkdown = markdown.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim() ?? null;
      const titleFromText = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? null;
      const derivedTitle =
        (typeof p.title === "string" && p.title.trim()) ||
        h1FromMarkdown ||
        titleFromText ||
        null;
      const derivedH1 = (typeof p.h1 === "string" && p.h1.trim()) || h1FromMarkdown || null;
      const explicitParas = Array.isArray(p.paragraphs)
        ? p.paragraphs.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        : [];
      const derivedParas =
        explicitParas.length > 0
          ? explicitParas
          : (markdown || text)
              .split(/\n{2,}/)
              .map((s) => s.replace(/^#{1,6}\s+/, "").replace(/^\s*[-*]\s+/gm, "").trim())
              .filter((s) => s.length >= 60 && s.length <= 800)
              .slice(0, 6);
      pages.push({
        url: p.url,
        path: p.path,
        title: derivedTitle,
        h1: derivedH1,
        summary: typeof p.summary === "string"
          ? p.summary
          : typeof p.description === "string"
            ? p.description
            : derivedParas[0] ?? null,
        paragraphs: derivedParas,
        images: Array.isArray(p.images)
          ? p.images.filter((s): s is string => typeof s === "string")
          : [],
        kind: typeof p.kind === "string" ? p.kind : "other",
        rewrittenIntro: aiPageRewrites.get(p.path as string) ?? null,
      });
    }
  }

  // Touch portal so the photo proxy URLs (already prefixed with the
  // portal slug by buildPortalEnrichment) resolve. We don't need slug
  // here since enrichment.hero already encodes it; this is just a
  // structural sanity check that swallows errors.
  void portal;
  void npiPayload; // reserved — used by orphan-case branch (Phase 3 plan).

  // Booking widget: detect from website_meta html so every template
  // renders a "Book a 15-min consult" CTA that just works. Returns
  // null when the prospect has no detectable widget — templates fall
  // back to a tel: link in that case.
  let bookingWidget: { provider: string; url: string } | null = null;
  const websiteMetaHtml =
    websiteMetaPayload && typeof websiteMetaPayload.html === "string"
      ? (websiteMetaPayload.html as string)
      : null;
  if (websiteMetaHtml) {
    const detected = detectBookingWidget(websiteMetaHtml);
    if (detected) bookingWidget = { provider: detected.provider, url: detected.url };
  }
  // Fallback: if the lead's PT or Headway profile has a booking link
  // baked in, surface that instead — both directories often carry the
  // calendly URL in the body.
  if (!bookingWidget) {
    const ptProfile = readPtProfile(ptPayload);
    const ptBooking =
      (ptProfile && typeof ptProfile.bookingUrl === "string" ? ptProfile.bookingUrl : null) ??
      (headwayPayload && typeof headwayPayload.bookingUrl === "string"
        ? (headwayPayload.bookingUrl as string)
        : null);
    if (ptBooking && /^https?:\/\//.test(ptBooking)) {
      bookingWidget = { provider: "other", url: ptBooking };
    }
  }

  // Domain suggestions: 3 candidates DNS-checked. Cheapest possible
  // wow surface — "drmayaalvarado.com is available, we'll grab it".
  let domainSuggestions: Array<{ domain: string; available: boolean }> = [];
  try {
    domainSuggestions = await suggestDomains({
      fullName:
        (team[0]?.name ?? null) ??
        practiceName ??
        lead.name,
      practiceName,
      city: lead.city,
    });
  } catch (err) {
    logger.warn({ err, leadId }, "domain suggestions failed");
  }

  // Drafted pages: roll up the crawled pages we already filter into
  // page-shaped drafts the prospect can see in a tab nav. Each kind
  // appears at most once (already deduped by rankPages upstream).
  // The prospect sees "We've already drafted About / Services / Fees
  // / FAQ for you" — a tangible value-add over a blank-template.
  const draftedPages = pages
    .filter((p) => p.paragraphs.length > 0 || (p.summary ?? "").length > 0)
    .slice(0, 8)
    .map((p) => ({
      kind: p.kind,
      slug: p.path.replace(/^\//, "").replace(/\//g, "-").slice(0, 40) || "page",
      title: p.title ?? p.h1 ?? humanizeKind(p.kind),
      h1: p.h1,
      body:
        p.paragraphs.length > 0
          ? p.paragraphs
          : p.summary
            ? [p.summary]
            : [],
      sourceUrl: p.url,
    }));

  return {
    content: {
      practiceName,
      tagline,
      mission,
      heroImage,
      services,
      team,
      reviews,
      testimonials,
      locations,
      contact,
      socialLinks,
      brand,
      specialties,
      acceptedInsurances,
      languages,
      modalities,
      offersInPerson,
      offersTelehealth,
      acceptsSlidingScale,
      pricePerSession,
      rating: enrichment?.rating ?? null,
      totalReviews: enrichment?.totalReviews ?? null,
      // The 6 fields below were added to PreviewContent in 2026-05
      // for the Playful Modern + (now-retired) Framework / Navy
      // Editorial templates. The build pipeline doesn't yet derive
      // them all from enrichment — leads carry empty defaults until
      // Phase 7.2 (press mentions) lands. Templates handle
      // null/empty gracefully.
      methodology: null,
      clinicalStats: null,
      // Pricing tiers derived from real PT / Headway fee data — kept
      // populated for any future template that surfaces pricing copy.
      // PT exposes a single `feePerSession` number;
      // Headway exposes a `{min, max}` range. Combine into 2-3 tiers
      // that match how a private-pay therapist actually presents
      // (consultation, standard session, brief check-in). When the
      // lead has neither, the array stays empty and templates fall
      // back to their own curated tier copy.
      pricingTiers: derivePricingTiers({
        ptFee: readPtFee(ptPayload),
        headwayPrice: pricePerSession,
        slidingScale: acceptsSlidingScale,
      }),
      testimonialsLong: [],
      featuredIn: [],
      conditionsCarousel: [],
      introVideoUrl: null,
      bookingWidget,
      domainSuggestions,
      draftedJournalEntries: await draftJournalEntriesWithLlm({
        practitionerName: team[0]?.name ?? lead.name,
        bio: mission,
        specialties,
      }),
      draftedPages,
      fieldSources,
    },
    pages,
  };
};

const humanizeKind = (kind: string): string => {
  switch (kind) {
    case "about":
      return "About";
    case "services":
      return "Services";
    case "team":
      return "Team";
    case "contact":
      return "Contact";
    case "fees":
      return "Fees & Insurance";
    case "faq":
      return "FAQ";
    case "blog":
      return "Insights";
    default:
      return "More";
  }
};

const emptyContent = (): PreviewContent => ({
  practiceName: null,
  tagline: null,
  mission: null,
  heroImage: null,
  services: [],
  team: [],
  reviews: [],
  testimonials: [],
  locations: [],
  contact: { phone: null, email: null, website: null },
  socialLinks: {
    instagram: null,
    facebook: null,
    linkedin: null,
    tiktok: null,
    youtube: null,
    psychologyToday: null,
    headway: null,
  },
  brand: {
    logoUrl: null,
    faviconUrl: null,
    accentColor: null,
    fontFamily: null,
  },
  specialties: [],
  acceptedInsurances: [],
  languages: [],
  modalities: [],
  offersInPerson: null,
  offersTelehealth: null,
  acceptsSlidingScale: null,
  pricePerSession: null,
  rating: null,
  totalReviews: null,
  methodology: null,
  clinicalStats: null,
  pricingTiers: [],
  testimonialsLong: [],
  featuredIn: [],
  conditionsCarousel: [],
  introVideoUrl: null,
  bookingWidget: null,
  domainSuggestions: [],
  draftedJournalEntries: [],
  draftedPages: [],
  fieldSources: {},
});

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

/**
 * Read a string property from the JSON-LD blob inside a website_meta
 * payload. JSON-LD `name` / `description` / `image` etc. — null when
 * the payload doesn't carry a parseable schema.org block.
 */
const readJsonLdString = (
  websiteMetaPayload: Record<string, unknown> | null,
  key: string,
): string | null => {
  const ld = websiteMetaPayload?.jsonLd;
  if (!isRecord(ld)) return null;
  return str(ld[key]);
};

const readJsonLdStringArray = (
  websiteMetaPayload: Record<string, unknown> | null,
  key: string,
): string[] => {
  const ld = websiteMetaPayload?.jsonLd;
  if (!isRecord(ld)) return [];
  const v = ld[key];
  if (Array.isArray(v)) return v.filter((s): s is string => typeof s === "string");
  if (typeof v === "string") return [v];
  return [];
};

/**
 * PT actor responses nest the matched profile under `.profile`. Some
 * payload shapes return the profile fields at the top level. Either
 * shape works — we just look for the long-form bio.
 */
const readPtBio = (
  ptPayload: Record<string, unknown> | null,
): string | null => {
  const profile = readPtProfile(ptPayload);
  if (!profile) return null;
  return (
    str(profile.personalStatement) ??
    str(profile.bio) ??
    str(profile.summary) ??
    str(profile.about) ??
    null
  );
};

const readPtProfile = (
  ptPayload: Record<string, unknown> | null,
): Record<string, unknown> | null => {
  if (!ptPayload) return null;
  if (isRecord(ptPayload.profile)) return ptPayload.profile;
  return ptPayload;
};

const readPtFee = (
  ptPayload: Record<string, unknown> | null,
): number | null => {
  const profile = readPtProfile(ptPayload);
  if (!profile) return null;
  const v = profile.feePerSession ?? profile.fee;
  if (typeof v === "number" && v >= 30 && v <= 1000) return v;
  if (typeof v === "string") {
    const m = v.match(/(\d{2,4})/);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (n >= 30 && n <= 1000) return n;
    }
  }
  return null;
};

/**
 * Build 2-3 Navy-Editorial pricing tiers from whatever fee data the
 * scrapers captured. PT gives us a single number; Headway gives us a
 * min/max range. We always render a free 30-min consult on top because
 * private-pay therapists almost universally offer one (and the rep can
 * edit it out if a specific lead doesn't). Standard session uses the
 * highest credible signal (PT fee or Headway max). Sliding-scale tier
 * appears only when explicitly advertised. Empty array when we have
 * nothing — templates have their own tasteful fallback tiers.
 */
const derivePricingTiers = ({
  ptFee,
  headwayPrice,
  slidingScale,
}: {
  ptFee: number | null;
  headwayPrice: { min: number | null; max: number | null } | null;
  slidingScale: boolean | null;
}): { amount: number | null; label: string; rationale: string | null }[] => {
  const headwayMax = headwayPrice?.max ?? null;
  const headwayMin = headwayPrice?.min ?? null;
  const standard = ptFee ?? headwayMax ?? headwayMin ?? null;
  if (standard === null) return [];
  const tiers: { amount: number | null; label: string; rationale: string | null }[] = [];
  tiers.push({
    amount: null,
    label: "Consultation · 30 min",
    rationale:
      "The first call is on me. It exists so we can both feel whether we fit before either of us commits to the work.",
  });
  tiers.push({
    amount: standard,
    label: "Standard session · 50 min",
    rationale:
      "The core of the work — enough room to arrive, go deeper than the surface, and land before re-entering the day.",
  });
  if (slidingScale && headwayMin && headwayMin < standard) {
    tiers.push({
      amount: headwayMin,
      label: "Sliding scale · 50 min",
      rationale:
        "Reduced fee for clients whose income makes the standard rate hard to sustain. Available on request after the consultation.",
    });
  }
  return tiers;
};

const readPtProfileUrl = (
  ptPayload: Record<string, unknown> | null,
): string | null => {
  const profile = readPtProfile(ptPayload);
  if (!profile) return null;
  return str(profile.profileUrl) ?? str(profile.url) ?? null;
};

/**
 * Pick the longest reasonable paragraph from the prospect's About-
 * looking page (or the homepage). Acts as the about-blurb fallback
 * when neither meta description nor a directory bio surfaced.
 */
const pickAboutParagraph = (
  pagesPayload: Record<string, unknown> | null,
): string | null => {
  if (!pagesPayload || !Array.isArray(pagesPayload.pages)) return null;
  const pages = pagesPayload.pages.filter(isRecord);
  const aboutPage =
    pages.find(
      (p) =>
        typeof p.kind === "string" && p.kind.toLowerCase().includes("about"),
    ) ??
    pages.find(
      (p) =>
        typeof p.path === "string" && /about|story|mission/i.test(p.path),
    ) ??
    pages[0];
  if (!aboutPage) return null;
  const candidates: string[] = [];
  if (Array.isArray(aboutPage.paragraphs)) {
    for (const p of aboutPage.paragraphs as unknown[]) {
      if (typeof p === "string" && p.length >= 60 && p.length <= 800) {
        candidates.push(p);
      }
    }
  }
  if (candidates.length === 0) {
    const text =
      (typeof aboutPage.text === "string" ? aboutPage.text : "") ||
      (typeof aboutPage.markdown === "string" ? aboutPage.markdown : "");
    for (const p of text.split(/\n{2,}/)) {
      const cleaned = p
        .replace(/^#{1,6}\s+/, "")
        .replace(/^\s*[-*]\s+/gm, "")
        .trim();
      if (cleaned.length >= 60 && cleaned.length <= 800) {
        candidates.push(cleaned);
      }
    }
  }
  if (candidates.length === 0) return null;
  // Longest paragraph that's still in range — usually the most signal-rich.
  return candidates.sort((a, b) => b.length - a.length)[0]!;
};

// Identity verification for enriched headshots (#225). The PT and
// Headway scrapers are search-driven and occasionally return a
// same-name therapist from the wrong city — Rachele Mays in Houston
// matched against the Austin lead, shipping a stranger's portrait.
//
// Strongest verification: `lead.currentWebsite` is the matched
// directory profile URL itself (e.g. `care.headway.co/providers/
// tara-langston-2`) AND the slug contains the lead's last-name token.
// In that case the rep saved the URL when creating the lead, and the
// directory scraper landed on the same page — there is no plausible
// way for this to refer to a different person. Bypass city.
//
// Otherwise we require BOTH name overlap (last-name token of the
// lead appears in the matched profile name) AND city overlap (the
// lead's city appears in the profile's address/locations string).
//
// `lead.currentWebsite` is passed through so the bypass can run
// without a second DB read; `null` falls through to the legacy path.
const verifyEnrichedIdentity = async (
  leadId: number,
  leadName: string,
  leadCity: string | null,
  source: string,
  currentWebsite: string | null,
): Promise<boolean> => {
  const sourceKey =
    source === "headway" ? "headway" : "psychology_today";
  const raw = await getRawPayload(leadId, sourceKey);
  if (!raw) return false;
  const profile =
    (isRecord(raw.profile) ? (raw.profile as Record<string, unknown>) : null) ??
    raw;
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const profileName =
    (typeof profile.fullName === "string" && profile.fullName) ||
    (typeof profile.name === "string" && profile.name) ||
    "";
  const leadTokens = norm(leadName).split(" ").filter((t) => t.length >= 2);
  const profileNameNorm = norm(profileName);
  // Require at least the last name token to appear in the matched profile.
  const lastToken = leadTokens[leadTokens.length - 1];
  const nameOk = !!lastToken && profileNameNorm.includes(lastToken);
  if (!nameOk) return false;
  // Fast accept: the lead's currentWebsite IS the directory profile
  // URL we matched (Headway: `headway.co/providers/<slug>`; PT:
  // `psychologytoday.com/us/therapists/...`) AND the slug contains the
  // last-name token. The rep saved this URL when creating the lead;
  // the directory scraper landed on the same page; we already
  // confirmed the matched profile name shares the last-name token.
  // City — which Headway typically does not expose on a virtual-only
  // provider profile (the Tara Langston case) — is not load-bearing
  // here, because the URL itself anchors identity to the same
  // person.
  if (currentWebsite && lastToken) {
    const directoryHostMatch =
      source === "headway"
        ? /^https?:\/\/(?:[a-z0-9-]+\.)?headway\.co\/providers\/([a-z0-9-]+)/i
        : /^https?:\/\/(?:www\.)?psychologytoday\.com\/[a-z]{2}\/(?:therapists|psychiatrists|treatment-centers|tests)\/[^?]*?\/([a-z0-9-]+)/i;
    const m = currentWebsite.match(directoryHostMatch);
    const slug = m?.[1] ?? "";
    if (slug && norm(slug.replace(/-/g, " ")).includes(lastToken)) {
      return true;
    }
  }
  if (!leadCity) return false;
  // City verification: scan address + locations + city/state fields.
  // Headway stores city under `profile.location.city` (object), PT
  // exposes `profile.address` (string) and sometimes `locations[]`
  // (string[] of "City, ST" lines), so we walk both shapes.
  const collectCityStrings = (val: unknown): string[] => {
    if (!val) return [];
    if (typeof val === "string") return [val];
    if (Array.isArray(val)) return val.flatMap(collectCityStrings);
    if (typeof val === "object") {
      const rec = val as Record<string, unknown>;
      const out: string[] = [];
      if (typeof rec.city === "string") out.push(rec.city);
      if (typeof rec.address === "string") out.push(rec.address);
      return out;
    }
    return [];
  };
  const blob = [
    typeof profile.address === "string" ? profile.address : "",
    typeof profile.city === "string" ? profile.city : "",
    ...collectCityStrings(profile.location),
    ...collectCityStrings(profile.locations),
    ...collectCityStrings(profile.primaryAddress),
  ]
    .map(norm)
    .join(" ");
  const cityNorm = norm(leadCity);
  if (blob.length > 0 && blob.includes(cityNorm)) return true;
  // Fallback first-party signal (#225 review 2): if the lead's
  // first-party site enrichment lists the same therapist name, treat
  // that as cross-verification — same person, same practice site.
  const firstParty =
    (await getRawPayload(leadId, "current_website_pages")) ??
    (await getRawPayload(leadId, "website_content_apify"));
  if (firstParty && Array.isArray(firstParty.pages)) {
    const haystack = firstParty.pages
      .map((p) =>
        isRecord(p)
          ? `${typeof p.title === "string" ? p.title : ""} ${
              typeof p.text === "string" ? p.text : ""
            }`
          : "",
      )
      .join(" ");
    const haystackNorm = norm(haystack);
    if (lastToken && haystackNorm.includes(lastToken)) return true;
  }
  return false;
};

const getRawPayload = async (
  leadId: number,
  sourceKey: string,
): Promise<Record<string, unknown> | null> => {
  const all = await db
    .select()
    .from(leadEnrichment)
    .where(eq(leadEnrichment.leadId, leadId))
    .orderBy(desc(leadEnrichment.fetchedAt));
  const match = all.find((r) => r.sourceKey === sourceKey);
  if (!match) return null;
  return isRecord(match.payload) ? match.payload : null;
};
