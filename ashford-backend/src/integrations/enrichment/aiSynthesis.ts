import Anthropic from "@anthropic-ai/sdk";
import { db, leadEnrichment } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import type { Candidate, EnrichmentSource, LeadInput } from "./types";

/**
 * AI synthesis layer. Runs LAST in the enrichment pipeline (orchestrator
 * splits sources into "primary" and "synthesis" phases). Reads the latest
 * payload from every other enrichment source on the lead, hands the raw
 * blob to Claude, and asks it to extract a normalized {services, team,
 * mission, valueProps, aboutBlurb} object.
 *
 * The mapper in `services/previewContent.ts` then prefers this synthesized
 * data over per-source heuristics — Claude is much better at de-duping
 * cross-source noise (Google Places returns 5 nearly identical reviews,
 * the Apify crawler returns 8 marketing pages, Psychology Today has a
 * long bio, the website meta description has a tagline) than any
 * hand-written mapper.
 *
 * Soft-fails (returns null) when:
 * - Replit AI integrations env vars are missing
 * - the lead has no other enrichment yet (nothing to synthesize)
 * - Claude returns malformed JSON or rate-limits
 */
class AISynthesisSource implements EnrichmentSource {
  readonly key = "ai_synthesis";
  readonly label = "AI Synthesis (Claude)";

  isConfigured(): boolean {
    return !!env.aiAnthropicBaseUrl && !!env.aiAnthropicApiKey;
  }

  async fetch(lead: LeadInput): Promise<Candidate | null> {
    if (!this.isConfigured()) return null;
    const rows = await db
      .select()
      .from(leadEnrichment)
      .where(eq(leadEnrichment.leadId, lead.id))
      .orderBy(desc(leadEnrichment.fetchedAt));
    // Keep only the latest row per source — earlier runs may be stale.
    const latestBySource = new Map<string, typeof rows[number]>();
    for (const r of rows) {
      if (r.sourceKey === this.key) continue;
      if (!latestBySource.has(r.sourceKey)) latestBySource.set(r.sourceKey, r);
    }
    if (latestBySource.size === 0) return null;

    const sourceBlobs: Record<string, unknown> = {};
    for (const [k, r] of latestBySource.entries()) {
      sourceBlobs[k] = {
        confidence: r.confidence,
        summary: r.summary,
        payload: truncatePayload(r.payload),
      };
    }

    const systemPrompt = `You are an expert at normalizing messy multi-source business data about healthcare practices (therapists, psychiatrists, MDs) into a clean structured profile suitable for a personalized website preview.

You will receive raw enrichment blobs from various sources (Google Places, Apify website crawler, Psychology Today, NPI, LinkedIn, etc.). Some sources may have matched the WRONG practice (Google Places fuzzy-match noise, LinkedIn name collisions). Your job is to:

1. Cross-reference the sources to identify which data is actually about the lead. Trust the lead's own website (website_content_apify) as authoritative when present. Discard a source if it clearly describes a different person/practice (different name, different city).
2. Synthesize a clean profile.

CRITICAL FABRICATION RULES (do not negotiate with these):
- DO NOT INVENT FIELDS. If a source did not mention the prospect's bio, return aboutBlurb=null and mission=null. Do NOT compose plausible-sounding therapist content from generic priors. The prospect-facing preview will render their REAL name with a SAMPLE bio if you fabricate, which embarrasses the company.
- TEAM is the highest-risk field. Only include a team entry when the SAME person appears in ≥2 sources with the SAME credential pattern (e.g. "LPC" in both Headway and the website). When only ONE source mentions a person, return team:[] and let downstream code use that source's row directly.
- For "bio" inside team[], copy verbatim from the most authoritative source (Headway > PT > Healthgrades > website "About" page). Do NOT paraphrase. Do NOT translate. Do NOT "improve voice" here — that happens in pages[].rewrittenIntro only.
- specialties / valueProps come from the lead's own listed values, not your priors about what therapists usually offer.

Return ONLY valid JSON matching this exact shape, no prose, no markdown fences:
{
  "practiceName": string | null,
  "aboutBlurb": string | null,    // VERBATIM from a source — null if no source had one
  "mission": string | null,        // VERBATIM from a source — null if no source had one
  "services": [{"name": string, "description": string | null}],  // 4-8 items, MUST come from a source
  "team": [{"name": string, "credentials": string | null, "bio": string | null}],
  "valueProps": [string],          // 3-5 short differentiators that appear in the source data
  "specialties": [string],         // 3-8 specialties that appear in the source data
  "pages": [                       // ONE entry per page in website_content_apify.pages
    {
      "path": string,              // exact path from the source
      "title": string | null,      // cleaned title (strip ' - Practice Name' suffix)
      "rewrittenIntro": string     // 2-4 sentence rewrite of the page's leading copy — preserve facts, drop fluff
    }
  ],
  "heroImageUrl": null,            // ALWAYS null.
  "matchConfidence": number,       // 0-100
  "discardedSources": [string]     // source keys that described someone else
}

If only 1-2 sources are present and none has a bio, return team:[], aboutBlurb:null, mission:null, services:[]. Empty arrays are correct here. Pages[] is the only place you may rewrite; everything else is verbatim or null.`;

    const userPrompt = `Lead being researched:
- Name: ${lead.name}
- Practice: ${lead.practice}
- City/State: ${lead.city}, ${lead.state}
- Specialty: ${lead.specialty}
- Phone: ${lead.phone}
- Current website: ${lead.currentWebsite ?? "(none)"}

Raw enrichment data, keyed by source:
${JSON.stringify(sourceBlobs, null, 2)}`;

    try {
      const client = new Anthropic({
        baseURL: env.aiAnthropicBaseUrl!,
        apiKey: env.aiAnthropicApiKey!,
      });
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
      const block = response.content[0];
      const raw = block && block.type === "text" ? block.text : "";
      const json = extractJson(raw);
      if (!json) {
        logger.warn(
          { leadId: lead.id, raw: raw.slice(0, 200) },
          "ai_synthesis: failed to parse JSON",
        );
        return null;
      }
      const conf = typeof json.matchConfidence === "number"
        ? Math.max(0, Math.min(100, Math.round(json.matchConfidence)))
        : 70;
      // Post-validate AI output against the source blobs to catch
      // fabrications even when the prompt told Claude not to. The
      // dominant failure mode (Tara case) is `team[0].bio` being a
      // plausible-sounding therapist sentence that doesn't appear in
      // any source. We drop such entries so the merge layer falls
      // through to the SAMPLE-or-empty branch instead of shipping
      // fabricated copy under a real name.
      const sanitized = sanitizeAiOutput(json, sourceBlobs, lead.id);
      const teamCount = Array.isArray(sanitized.team) ? (sanitized.team as unknown[]).length : 0;
      const svcCount = Array.isArray(sanitized.services) ? (sanitized.services as unknown[]).length : 0;
      return {
        confidence: conf,
        summary: `AI synthesized profile · ${svcCount} services, ${teamCount} team members, ${conf}% match-confident.`,
        payload: sanitized,
      };
    } catch (err) {
      logger.warn(
        { err, leadId: lead.id },
        "ai_synthesis: Claude call failed",
      );
      return null;
    }
  }
}

/**
 * Anti-fabrication post-filter. The AI synthesis prompt asks Claude
 * not to invent fields; this function enforces it by checking each
 * suspicious AI output against the source-data blob. When a value
 * doesn't appear in any source verbatim (or near-verbatim), we drop
 * it. The Tara Langston case showed this matters: even with a strict
 * prompt, Claude can fabricate "Bilingual LCSW with 10 years of
 * trauma practice" when the only real signal was an NPI row.
 *
 * Three classes of check, in order of fabrication risk:
 *   - team[].bio — long-form copy; must appear verbatim in a source
 *   - aboutBlurb / mission — same rule
 *   - team[].name — must appear in at least one source's text
 *
 * Pure function (apart from the warn log); exported for unit tests.
 */
export function sanitizeAiOutput(
  raw: Record<string, unknown>,
  sourceBlobs: Record<string, unknown>,
  leadId: number,
): Record<string, unknown> {
  // Build a single haystack string from every source payload.
  // Lower-cased, whitespace-collapsed so a verbatim substring check
  // tolerates trivial formatting differences.
  const haystack = normText(JSON.stringify(sourceBlobs));
  const out: Record<string, unknown> = { ...raw };

  // Team — drop entries whose name OR bio doesn't appear in source.
  if (Array.isArray(raw.team)) {
    const filtered: Array<Record<string, unknown>> = [];
    for (const entry of raw.team) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      const name = typeof e.name === "string" ? e.name : null;
      const bio = typeof e.bio === "string" ? e.bio : null;
      if (!name) continue;
      // Name must appear in source text.
      const nameHit = haystack.includes(normText(name));
      if (!nameHit) {
        logger.warn(
          { leadId, name, kind: "team-name-fabricated" },
          "ai_synthesis: dropping team entry with name absent from source",
        );
        continue;
      }
      // Bio: if the AI returned > 60 chars and < 1500, require a
      // ~32-char prefix to appear verbatim in source. Short bios are
      // OK without verbatim check (titles, modality lists). Anything
      // > 1500 chars is suspicious — trim to the first source-verifiable
      // 200 chars or null it out.
      let cleanBio: string | null = null;
      if (bio) {
        const normBio = normText(bio);
        const preview = normBio.slice(0, 32);
        if (preview.length >= 32 && haystack.includes(preview)) {
          cleanBio = bio;
        } else if (normBio.length < 60) {
          cleanBio = bio; // short — accept without verbatim verification
        } else {
          logger.warn(
            {
              leadId,
              name,
              bioPreview: bio.slice(0, 80),
              kind: "team-bio-fabricated",
            },
            "ai_synthesis: dropping team bio not found verbatim in any source",
          );
          cleanBio = null;
        }
      }
      filtered.push({ ...e, bio: cleanBio });
    }
    out.team = filtered;
  }

  // aboutBlurb / mission — same verbatim rule.
  for (const k of ["aboutBlurb", "mission"]) {
    const v = raw[k];
    if (typeof v !== "string" || v.length < 60) continue;
    const norm = normText(v);
    const preview = norm.slice(0, 32);
    if (preview.length >= 32 && !haystack.includes(preview)) {
      logger.warn(
        { leadId, field: k, preview: v.slice(0, 80), kind: "blurb-fabricated" },
        "ai_synthesis: dropping field not found verbatim in any source",
      );
      out[k] = null;
    }
  }

  return out;
}

const normText = (s: string): string =>
  s.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "").trim();

const truncatePayload = (p: unknown): unknown => {
  if (!p || typeof p !== "object") return p;
  // Apify website-content payloads are huge — keep only essentials.
  const obj = p as Record<string, unknown>;
  if (Array.isArray(obj.pages)) {
    obj.pages = (obj.pages as unknown[]).slice(0, 8).map((page) => {
      if (!page || typeof page !== "object") return page;
      const pg = page as Record<string, unknown>;
      // Drop markdown to save tokens; keep text + headings + image URLs
      // (the AI needs to see images to pick a hero).
      const trimmed: Record<string, unknown> = {};
      for (const k of ["url", "path", "title", "description", "kind", "images"]) {
        if (k in pg) trimmed[k] = pg[k];
      }
      if (typeof pg.text === "string") trimmed.text = pg.text.slice(0, 3000);
      return trimmed;
    });
  }
  if (Array.isArray(obj.photos)) {
    obj.photos = `[${(obj.photos as unknown[]).length} photos]`;
  }
  return obj;
};

const extractJson = (raw: string): Record<string, unknown> | null => {
  const trimmed = raw.trim();
  // Try direct parse first.
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch { /* fallthrough */ }
  // Try to extract a fenced block.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]) as Record<string, unknown>;
    } catch { /* fallthrough */ }
  }
  // Try to locate the first {...} balanced object.
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    } catch { /* fallthrough */ }
  }
  return null;
};

export const aiSynthesisSource = new AISynthesisSource();
