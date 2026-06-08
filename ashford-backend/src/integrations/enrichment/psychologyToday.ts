import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import { extractVideoCandidates, type VideoCandidate } from "./_directoryFetch";
import { isPlatformBrandName } from "./brandBlocklist";
import { sanitizeScrapedBio } from "./bioSanitize";
import type { Candidate, EnrichmentSource, LeadInput } from "./types";

/**
 * Psychology Today directory enrichment.
 *
 * Two paths to the same provider profile, in order of trust:
 *
 *   1. **Direct fast-path** — if `lead.currentWebsite` is a PT
 *      provider URL (`psychologytoday.com/us/therapists/...`), fetch
 *      and parse it directly. Same anti-bot strategy as the Headway
 *      scraper: real-browser User-Agent first, ScraperAPI render=true
 *      fallback when Cloudflare blocks. The URL itself is identity
 *      proof — the rep saved it when creating the lead.
 *
 *   2. **Apify search** — fallback when no direct URL is available.
 *      Uses the public `epctex/psychology-today-scraper` actor (or any
 *      compatible actor pinned via APIFY_PSYCHOLOGY_TODAY_ACTOR_ID) in
 *      synchronous mode. Returns the top-1 match.
 *
 * The parser is the same three-tier strategy as Headway:
 * `__NEXT_DATA__` (legacy Pages Router) → `self.__next_f` flight
 * chunks (App Router) → rendered-DOM regex extraction (last-resort
 * fallback that works regardless of PT's hydration shape).
 */
const DEFAULT_ACTOR_ID = "epctex~psychology-today-scraper";

const PT_HOST_RE = /^(?:www\.)?psychologytoday\.com$/i;
const PT_PATH_RE =
  /^\/(?:us|ca|uk|au)\/(?:therapists|psychiatrists|treatment-centers|tests)\/[^?]*?\/[a-z0-9-]+\/?$/i;

class PsychologyTodaySource implements EnrichmentSource {
  readonly key = "psychology_today";
  readonly label = "Psychology Today";

  isConfigured(): boolean {
    // Direct path doesn't need a token; Apify path does. We treat the
    // source as configured when EITHER path can run, so a lead with a
    // PT URL gets enriched even on a deploy without the Apify token.
    return true;
  }

  async fetch(lead: LeadInput): Promise<Candidate | null> {
    // Fast path — direct profile URL.
    const direct = await fetchByCurrentWebsite(lead);
    if (direct) {
      logger.info(
        { leadId: lead.id, source: "psychology_today", via: "current_website" },
        "psychology_today: matched via current_website",
      );
      return direct;
    }
    // Fallback — Apify search.
    if (!env.apifyApiToken) {
      logger.warn(
        { leadId: lead.id },
        "psychology_today: no APIFY_API_TOKEN and currentWebsite is not a PT URL — skipping",
      );
      return null;
    }
    const viaApify = await fetchViaApify(lead);
    if (viaApify) {
      logger.info(
        { leadId: lead.id, source: "psychology_today", via: "apify_search" },
        "psychology_today: matched via apify search",
      );
    } else {
      logger.info(
        { leadId: lead.id },
        "psychology_today: no match via apify search",
      );
    }
    return viaApify;
  }
}

export const psychologyTodaySource = new PsychologyTodaySource();

// ===========================================================================
// Direct URL path — same anti-bot pipeline as headway.ts
// ===========================================================================

const fetchByCurrentWebsite = async (
  lead: LeadInput,
): Promise<Candidate | null> => {
  const raw = lead.currentWebsite?.trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  if (!PT_HOST_RE.test(parsed.hostname)) return null;
  if (!PT_PATH_RE.test(parsed.pathname)) return null;
  const cleanUrl = `https://www.psychologytoday.com${parsed.pathname.replace(/\/$/, "")}`;
  const html = await fetchHtml(cleanUrl);
  if (!html) return null;
  const profile = parsePtProfile(html, cleanUrl);
  if (!profile) return null;
  return summarize(profile, cleanUrl);
};

const REAL_BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const fetchHtml = async (url: string): Promise<string | null> => {
  // Tier 1 — direct fetch with a real-browser UA.
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": REAL_BROWSER_UA,
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) {
      const html = await res.text();
      if (html.length >= 10_000) {
        logger.info(
          { url, tier: "direct", bytes: html.length },
          "psychology_today:fetchHtml ok",
        );
        return html;
      }
      logger.warn(
        { url, tier: "direct", bytes: html.length },
        "psychology_today:fetchHtml direct returned thin HTML — falling back",
      );
    } else {
      logger.warn(
        { url, tier: "direct", status: res.status },
        "psychology_today:fetchHtml direct non-OK — falling back",
      );
    }
  } catch (err) {
    logger.warn(
      {
        url,
        tier: "direct",
        err: err instanceof Error ? err.message : String(err),
      },
      "psychology_today:fetchHtml direct threw — falling back",
    );
  }

  // Tier 2 — ScraperAPI render=true.
  if (env.scraperapiKey != null) {
    try {
      const target = `https://api.scraperapi.com/?api_key=${encodeURIComponent(
        env.scraperapiKey,
      )}&url=${encodeURIComponent(url)}&render=true&country_code=us`;
      const res = await fetch(target, {
        headers: { "user-agent": REAL_BROWSER_UA, accept: "text/html" },
        signal: AbortSignal.timeout(40_000),
      });
      if (!res.ok) {
        logger.warn(
          { url, tier: "scraperapi", status: res.status },
          "psychology_today:fetchHtml scraperapi non-OK",
        );
        return null;
      }
      const html = await res.text();
      logger.info(
        { url, tier: "scraperapi", bytes: html.length },
        "psychology_today:fetchHtml ok",
      );
      return html;
    } catch (err) {
      logger.warn(
        {
          url,
          tier: "scraperapi",
          err: err instanceof Error ? err.message : String(err),
        },
        "psychology_today:fetchHtml scraperapi threw",
      );
      return null;
    }
  }
  logger.warn(
    { url },
    "psychology_today:fetchHtml exhausted — no SCRAPERAPI_KEY configured",
  );
  return null;
};

interface PtProfile {
  name: string | null;
  photoUrl: string | null;
  bio: string | null;
  credentials: string | null;
  specialties: string[];
  insurances: string[];
  languages: string[];
  modalities: string[];
  city: string | null;
  state: string | null;
  feePerSession: number | null;
  acceptsSlidingScale: boolean;
  inPerson: boolean;
  virtual: boolean;
  /** PT added a provider intro video tile in 2024. Vimeo embed when
   * the practitioner uploaded one. Null when they didn't. */
  video: VideoCandidate | null;
  profileUrl: string;
}

const parsePtProfile = (html: string, profileUrl: string): PtProfile | null => {
  // Extract video candidates once at the boundary; merge into
  // whichever parser tier returns a profile. PT rolled out a provider
  // intro-video tile in 2024 — Vimeo embed when the practitioner
  // uploaded one, null when they didn't.
  const videoCandidates = extractVideoCandidates(html);
  const video = videoCandidates[0] ?? null;
  const withVideo = (p: PtProfile | null): PtProfile | null =>
    p ? { ...p, video } : null;
  const fromNext = parsePtFromNextData(html, profileUrl);
  if (fromNext) {
    logger.info(
      { profileUrl, source: "__NEXT_DATA__" },
      "psychology_today:parse hit",
    );
    return withVideo(fromNext);
  }
  const fromDom = parsePtFromRenderedDom(html, profileUrl);
  if (fromDom) {
    logger.info(
      { profileUrl, source: "dom" },
      "psychology_today:parse hit (rendered DOM)",
    );
    return withVideo(fromDom);
  }
  logger.warn(
    {
      profileUrl,
      htmlLen: html.length,
      hasNextData: html.includes("__NEXT_DATA__"),
    },
    "psychology_today:parse no data extracted",
  );
  return null;
};

const parsePtFromNextData = (
  html: string,
  profileUrl: string,
): PtProfile | null => {
  const m = html.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!m) return null;
  let json: unknown;
  try {
    json = JSON.parse(m[1]);
  } catch {
    return null;
  }
  // PT's __NEXT_DATA__ is deeply nested; walk for a node with a
  // therapist-shaped key set.
  const node = findPtNode(json);
  if (!node) return null;
  const get = (key: string): unknown => node[key];
  const arr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v
          .map((x) =>
            typeof x === "string"
              ? x
              : x && typeof x === "object" && "name" in (x as object)
                ? String((x as { name: unknown }).name)
                : null,
          )
          .filter((x): x is string => !!x)
      : [];
  return {
    name:
      str(get("fullName")) ?? str(get("name")) ?? str(get("displayName")) ?? null,
    photoUrl:
      str(get("photoUrl")) ??
      str(get("imageUrl")) ??
      str(get("photo")) ??
      str(get("image")) ??
      null,
    bio:
      str(get("personalStatement")) ??
      str(get("bio")) ??
      str(get("about")) ??
      str(get("summary")) ??
      null,
    credentials:
      str(get("credentials")) ??
      str(get("title")) ??
      (Array.isArray(get("credentialsList"))
        ? (get("credentialsList") as unknown[])
            .filter((s): s is string => typeof s === "string")
            .join(", ") || null
        : null),
    specialties: arr(get("specialties")).concat(arr(get("issues"))),
    insurances: arr(get("insurances")).concat(arr(get("acceptedInsurances"))),
    languages: arr(get("languages")),
    modalities: arr(get("treatmentApproaches")).concat(arr(get("modalities"))),
    city: str(get("city")),
    state: str(get("state")),
    feePerSession: typeof get("fee") === "number" ? (get("fee") as number) : null,
    acceptsSlidingScale: !!get("slidingScale"),
    inPerson: !!get("inPerson"),
    virtual: !!(get("virtual") ?? get("teletherapy") ?? get("telehealth")),
    video: null, // filled at the boundary by parsePtProfile
    profileUrl,
  };
};

const findPtNode = (
  json: unknown,
): Record<string, unknown> | null => {
  const seen = new Set<unknown>();
  const stack: unknown[] = [json];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const x of node) stack.push(x);
      continue;
    }
    const obj = node as Record<string, unknown>;
    const looksLikeProvider =
      (typeof obj.fullName === "string" || typeof obj.name === "string") &&
      (Array.isArray(obj.specialties) ||
        typeof obj.personalStatement === "string" ||
        typeof obj.bio === "string");
    if (looksLikeProvider) return obj;
    for (const key in obj) stack.push(obj[key]);
  }
  return null;
};

const parsePtFromRenderedDom = (
  html: string,
  profileUrl: string,
): PtProfile | null => {
  const bodyText = stripToBodyText(html);
  let name: string | null = null;
  const h1 = html.match(/<h1[^>]*>([^<]{2,80})<\/h1>/i);
  if (h1?.[1]) {
    const candidate = decodeEntities(h1[1]).trim();
    // Same defense as the Headway parser — directory brand H1s
    // ("Psychology Today") must never become the practitioner name.
    if (!isPlatformBrandName(candidate)) name = candidate;
  }
  if (!name) {
    const slug = profileUrl
      .match(/\/(?:therapists|psychiatrists|treatment-centers|tests)\/[^/]*?\/([^/?#]+)/i)?.[1];
    if (slug) {
      name = slug
        .split("-")
        .filter((t) => !/^\d+$/.test(t))
        .map((t) => t[0]?.toUpperCase() + t.slice(1))
        .join(" ");
    }
  }
  if (!name) return null;

  // Photo — PT serves portraits from `cdn.psychologytoday.com` and
  // `post.psychologytoday.com`. Skip generic placeholders.
  let photoUrl: string | null = null;
  const imgRe = /<img\b[^>]*?>/gi;
  for (const tag of html.match(imgRe) ?? []) {
    const src = attrFromTag(tag, "src") ?? attrFromTag(tag, "data-src");
    if (!src || !src.startsWith("http")) continue;
    if (/(?:icon|sprite|placeholder|favicon|logo|default[- ]?avatar)/i.test(src)) continue;
    if (
      /(?:cdn\.|post\.)psychologytoday\.com|psychologytoday-content/i.test(src) &&
      /\.(jpe?g|png|webp|avif)/i.test(src)
    ) {
      photoUrl = src;
      break;
    }
  }

  // PT-2026 (audit 2026-05-18): PT changed its data model. The page now
  // serves a single mixed `topSpecialties` JSON array containing issues +
  // modalities + populations + insurance + payment methods. We classify
  // each item via known name dictionaries; structured wins over regex.
  const PT_INSURANCE_NAMES = new Set<string>([
    "Aetna","Anthem","BCBS","Blue Cross","Blue Shield","BlueCross BlueShield",
    "Carelon","Carelon Behavioral Health","Cigna","Cigna and Evernorth",
    "UnitedHealthcare","United Healthcare","UHC","UMR","Optum","Beacon",
    "Beacon Health Options","Magellan","Tricare","TriWest","VA CCN","Humana",
    "Kaiser","Medicaid","Medicare","MultiPlan","Quest Behavioral Health",
    "Scott & White","Baylor Scott & White","Mercer","Oscar","Allegiance",
    "Compsych","EAP","Bright Health","MHN","Friday Health","Lyra",
    "Out of Pocket","Out-of-Pocket","Self-Pay","Self Pay","Spring Health",
    "Modern Health",
  ]);
  const PT_PAYMENT_NAMES = new Set<string>([
    "Visa","Mastercard","American Express","Discover","Check",
    "ACH Bank transfer","Paypal","Venmo","Zelle","Health Savings Account",
    "Cash","HSA","FSA",
  ]);
  const PT_DEMO_NAMES = new Set<string>([
    "Adults","Teen","Preteen","Children","Children (6 to 10)",
    "Adolescents (14 to 19)","Toddlers / Preschoolers (0 to 6)",
    "Elders (65+)","Individuals","Couples","Family","Group",
    "Female","Male","Non-binary",
  ]);
  const PT_MODALITY_HINTS = [
    "CBT","DBT","EMDR","ACT","EFT","Gottman","Compassion Focused",
    "Mindfulness","Psychodynamic","Internal Family Systems","IFS",
    "Person-Centered","Existential","Family Systems","Narrative",
    "Solution Focused","Trauma Focused","Brainspotting","Somatic",
    "Art Therapy","Play Therapy","Animal-Assisted","Behavioral",
    "Hypnotherapy","Christian Counseling","Coaching","Culturally Sensitive",
    "Strength-Based","Motivational Interviewing",
  ];
  let ptTopSpecialties: { id: number; name: string }[] = [];
  const tsMatch = html.match(
    /"topSpecialties":\s*(\[(?:\{"id":\d+,"name":"[^"]+"\},?)+\])/,
  );
  if (tsMatch?.[1]) {
    try { ptTopSpecialties = JSON.parse(tsMatch[1]); } catch { ptTopSpecialties = []; }
  }
  const structuredInsurance: string[] = [];
  const structuredSpecialties: string[] = [];
  const structuredModalities: string[] = [];
  for (const x of ptTopSpecialties) {
    const n = x.name;
    if (PT_INSURANCE_NAMES.has(n)) structuredInsurance.push(n);
    else if (PT_PAYMENT_NAMES.has(n)) continue;
    else if (PT_DEMO_NAMES.has(n)) continue;
    else if (
      PT_MODALITY_HINTS.some((h) => n.includes(h)) ||
      /\b(?:Therapy|Method|\(.+\))$/.test(n)
    )
      structuredModalities.push(n);
    else structuredSpecialties.push(n);
  }

  // Bio — anchor on "Personal Statement" / "My Approach".
  const bioParts: string[] = [];
  const stmtMatch = bodyText.match(
    /(?:Personal Statement|My Statement)\s+([\s\S]{40,1500}?)(?=My Approach|Specialties|Insurance|Fees|Issues|Treatment Approaches|Languages|$)/i,
  );
  if (stmtMatch?.[1]) bioParts.push(stmtMatch[1].trim());
  const approachMatch = bodyText.match(
    /My Approach\s+([\s\S]{40,1500}?)(?=Specialties|Insurance|Fees|Issues|Treatment Approaches|Languages|$)/i,
  );
  if (approachMatch?.[1]) bioParts.push(approachMatch[1].trim());
  const bio = sanitizeScrapedBio(
    bioParts.length > 0 ? bioParts.join("\n\n") : null,
  );

  // Lists.
  const specialties = extractCsvBetween(bodyText, /Specialties\s+/i, /(?:Issues|Insurance|Fees|Treatment Approaches|Languages|$)/i)
    .concat(extractCsvBetween(bodyText, /Issues\s+/i, /(?:Insurance|Fees|Treatment Approaches|Languages|$)/i));
  const modalities = extractCsvBetween(
    bodyText,
    /Treatment Approaches?\s+/i,
    /(?:Insurance|Fees|Languages|$)/i,
  );
  const languages = extractCsvBetween(
    bodyText,
    /Languages\s+/i,
    /(?:Insurance|Fees|$)/i,
  );

  // Insurance (PT structure: "Accepted Insurance Plans" then list).
  let insurances: string[] = [];
  const insMatch = bodyText.match(
    /(?:Accepted Insurance Plans|Insurance accepted|Insurances?)\s+([A-Z][^.|]{20,1500}?)(?=Out of Pocket|Fees|Sliding Scale|$)/i,
  );
  if (insMatch?.[1]) insurances = splitCsv(insMatch[1]);
  insurances = insurances.filter(
    (s) =>
      !/^(?:Years?|License|Training|Master|Bachelor|Doctor|Specialties|Languages|Insurance|Fees)\b/i.test(
        s,
      ),
  );

  // Mode flags.
  const inPerson = /\bIn[- ]Person\b/i.test(bodyText);
  const virtual = /\b(?:Online|Telehealth|Video|Phone)\b/i.test(bodyText);
  const acceptsSlidingScale = /sliding[- ]?scale/i.test(bodyText);

  // Fee — "Cost per Session: $X" pattern.
  let feePerSession: number | null = null;
  const feeMatch = bodyText.match(
    /(?:Cost per Session|Session Fee|Fee Range|Price)\s*[:$]?\s*\$?(\d{2,4})/i,
  );
  if (feeMatch?.[1]) feePerSession = Number(feeMatch[1]);

  // Location.
  const cityMatch = bodyText.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s*([A-Z]{2})\b/);
  const city = cityMatch ? cityMatch[1] : null;
  const state = cityMatch ? cityMatch[2] : null;

  // Credentials — string after the name in the heading area.
  let credentials: string | null = null;
  const credMatch = html.match(
    /<h1[^>]*>[^<]+<\/h1>\s*(?:<[^>]+>\s*)*([^<\n]{2,80})/i,
  );
  if (credMatch?.[1]) {
    const c = credMatch[1].trim();
    if (/^[A-Z][\w.,\s]+$/.test(c)) credentials = c;
  }

  // Refuse to ship a useless "match" — same gate as Headway.
  const hasSignal =
    !!bio || !!photoUrl || specialties.length >= 2 || insurances.length >= 2;
  if (!hasSignal) return null;

  // PT-2026: merge legacy regex + new structured extraction.
  const mergedSpecialties = dedupe([...structuredSpecialties, ...specialties]);
  const mergedInsurances = dedupe([...structuredInsurance, ...insurances]);
  const mergedModalities = dedupe([...structuredModalities, ...modalities]);

  return {
    name,
    photoUrl,
    bio,
    credentials,
    specialties: mergedSpecialties,
    insurances: mergedInsurances,
    languages: dedupe(languages),
    modalities: mergedModalities,
    city,
    state,
    feePerSession,
    acceptsSlidingScale,
    inPerson,
    virtual,
    video: null, // filled at the boundary by parsePtProfile
    profileUrl,
  };
};

const summarize = (p: PtProfile, profileUrl: string): Candidate => {
  const summaryParts: string[] = [];
  if (p.name) summaryParts.push(`PT: ${p.name}`);
  if (p.specialties.length) {
    summaryParts.push(`specialties: ${p.specialties.slice(0, 4).join(", ")}`);
  }
  if (p.insurances.length) {
    summaryParts.push(`accepts: ${p.insurances.slice(0, 3).join(", ")}`);
  }
  if (p.feePerSession) summaryParts.push(`fee: $${p.feePerSession}`);
  if (p.video) summaryParts.push(`video (${p.video.provider})`);
  // Mirror the legacy "profile" + "teamStructured" payload shape so
  // downstream readers (previewContent, portal merge) don't need a
  // branch for direct vs. apify-sourced PT data.
  const teamStructured =
    p.name && (p.bio || p.credentials || p.photoUrl)
      ? [
          {
            name: p.name,
            credentials: p.credentials,
            bio: p.bio,
            photo: p.photoUrl,
          },
        ]
      : [];
  return {
    confidence: 90,
    summary: summaryParts.join(" · ") || "Psychology Today profile matched.",
    payload: {
      via: "current_website",
      profileUrl,
      profile: {
        fullName: p.name,
        name: p.name,
        bio: p.bio,
        personalStatement: p.bio,
        credentials: p.credentials,
        photo: p.photoUrl,
        specialties: p.specialties,
        insurances: p.insurances,
        languages: p.languages,
        modalities: p.modalities,
        city: p.city,
        state: p.state,
        feePerSession: p.feePerSession,
        acceptsSlidingScale: p.acceptsSlidingScale,
        inPerson: p.inPerson,
        virtual: p.virtual,
        videoUrl: p.video?.embedUrl ?? null,
        videoProvider: p.video?.provider ?? null,
      },
      teamStructured,
    },
  };
};

// ===========================================================================
// Apify search-based path (legacy)
// ===========================================================================

const fetchViaApify = async (lead: LeadInput): Promise<Candidate | null> => {
  const actorId =
    process.env.APIFY_PSYCHOLOGY_TODAY_ACTOR_ID ?? DEFAULT_ACTOR_ID;
  try {
    const url = `https://api.apify.com/v2/acts/${encodeURIComponent(
      actorId,
    )}/run-sync-get-dataset-items?token=${encodeURIComponent(
      env.apifyApiToken!,
    )}&timeout=120`;
    const searchTerm = `${lead.name} ${lead.city} ${lead.state}`.trim();
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        search: searchTerm,
        searchTerms: [searchTerm],
        maxItems: 3,
        country: "US",
        state: lead.state,
        city: lead.city,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      logger.warn(
        { leadId: lead.id, status: res.status },
        "psychology_today:apify non-OK",
      );
      return null;
    }
    const items = (await res.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(items) || items.length === 0) return null;
    const top = items[0];
    const summaryParts: string[] = [];
    if (typeof top.fullName === "string") summaryParts.push(`PT: ${top.fullName}`);
    else if (typeof top.name === "string") summaryParts.push(`PT: ${top.name}`);
    if (Array.isArray(top.specialties) && top.specialties.length) {
      summaryParts.push(
        `specialties: ${top.specialties.slice(0, 4).join(", ")}`,
      );
    }
    if (Array.isArray(top.insurances) && top.insurances.length) {
      summaryParts.push(`accepts: ${top.insurances.slice(0, 3).join(", ")}`);
    }
    if (typeof top.feePerSession === "string" || typeof top.fee === "string") {
      summaryParts.push(`fee: ${top.feePerSession ?? top.fee}`);
    }
    const ptName =
      (typeof top.fullName === "string" && top.fullName) ||
      (typeof top.name === "string" && top.name) ||
      null;
    const ptBio = sanitizeScrapedBio(
      (typeof top.personalStatement === "string" && top.personalStatement) ||
        (typeof top.bio === "string" && top.bio) ||
        (typeof top.summary === "string" && top.summary) ||
        (typeof top.about === "string" && top.about) ||
        null,
    );
    const ptCreds =
      (typeof top.credentials === "string" && top.credentials) ||
      (typeof top.title === "string" && top.title) ||
      (Array.isArray(top.credentialsList) &&
        top.credentialsList.filter((s) => typeof s === "string").join(", ")) ||
      null;
    const ptPhoto =
      (typeof top.photo === "string" && top.photo) ||
      (typeof top.imageUrl === "string" && top.imageUrl) ||
      (typeof top.image === "string" && top.image) ||
      null;
    const teamStructured =
      ptName && (ptBio || ptCreds || ptPhoto)
        ? [
            {
              name: ptName,
              credentials: ptCreds || null,
              bio: ptBio || null,
              photo: ptPhoto || null,
            },
          ]
        : [];
    return {
      confidence: 75,
      summary: summaryParts.join(" · ") || "Psychology Today profile matched.",
      payload: {
        via: "apify_search",
        actorId,
        searchTerm,
        totalMatches: items.length,
        profile: top,
        teamStructured,
      },
    };
  } catch (err) {
    logger.warn(
      { err, leadId: lead.id },
      "psychology_today:apify threw",
    );
    return null;
  }
};

// ===========================================================================
// Tiny shared helpers
// ===========================================================================

const stripToBodyText = (html: string): string =>
  html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

const extractCsvBetween = (
  text: string,
  anchor: RegExp,
  stop: RegExp,
): string[] => {
  const m = text.match(anchor);
  if (!m || m.index == null) return [];
  const after = text.slice(m.index + m[0].length);
  const stopMatch = after.match(stop);
  const slice = stopMatch ? after.slice(0, stopMatch.index) : after.slice(0, 600);
  return splitCsv(slice);
};

const splitCsv = (raw: string): string[] =>
  raw
    .replace(/\s+and\s+/gi, ", ")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 80 && /[A-Za-z]/.test(s));

const decodeEntities = (s: string): string =>
  s
    .replace(/&amp;/gi, "&")
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");

const attrFromTag = (tag: string, name: string): string | null => {
  const re = new RegExp(`${name}\\s*=\\s*"([^"]*)"|${name}\\s*=\\s*'([^']*)'`, "i");
  const m = tag.match(re);
  if (!m) return null;
  return decodeEntities(m[1] ?? m[2] ?? "");
};

const dedupe = (xs: string[]): string[] =>
  Array.from(new Set(xs.map((x) => x.trim()).filter(Boolean)));

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;
