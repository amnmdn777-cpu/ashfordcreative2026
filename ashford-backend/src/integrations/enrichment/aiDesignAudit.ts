import { db, leadEnrichment, leads } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getAnthropicClient, isAnthropicConfigured } from "../../lib/aiClient";
import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import type { Candidate, EnrichmentSource, LeadInput } from "./types";

/**
 * AI design audit. Runs in the SYNTHESIS phase AFTER aiSynthesis has
 * normalized the multi-source data, and reads the assembled portal
 * inputs (template choice, palette, hero image hint, addon selection,
 * synthesized profile) to grade the visual coherence of the portal a
 * prospect will see.
 *
 * Persona: senior brand designer. Output is strictly ADVISORY — we do
 * NOT mutate any portal config from the audit verdict. The whole point
 * of #221 piste A is to surface harmony risks early so the rep can fix
 * them with one click before sending, while never silently re-styling a
 * portal in a way that could break something the rep deliberately set.
 *
 * Anti-over-correction guardrails baked into the prompt:
 *   - the LLM is told to flag *only* genuine harmony risks (≥5/10
 *     severity) and to leave harmonious choices untouched.
 *   - response is hard-capped to 4 advisories (anything beyond that is
 *     the LLM nitpicking).
 *   - allowlisted advisory `area` values map to surfaces the rep can
 *     actually change (palette, hero, copy_tone, addon_mix). Anything
 *     outside the allowlist is dropped client-side, so a rogue
 *     suggestion can't sneak into the dashboard UI.
 *   - score ≥ 85 short-circuits the advisory render — "the design is
 *     already beautiful, don't go fishing for problems".
 *
 * Soft-fails (returns null) when:
 *   - the AI integration env vars are missing
 *   - aiSynthesis hasn't produced a profile yet (nothing to grade)
 *   - Claude returns malformed JSON or rate-limits
 */

const ALLOWED_AREAS = new Set([
  "palette",
  "hero",
  "copy_tone",
  "addon_mix",
  "typography",
  "overall",
] as const);

type Severity = "low" | "medium" | "high";
const ALLOWED_SEVERITIES = new Set<Severity>(["low", "medium", "high"]);

class AIDesignAuditSource implements EnrichmentSource {
  readonly key = "design_audit";
  readonly label = "AI Design Audit (Claude)";

  isConfigured(): boolean {
    return isAnthropicConfigured();
  }

  async fetch(lead: LeadInput): Promise<Candidate | null> {
    if (!this.isConfigured()) return null;

    // Pull the latest enrichment + the lead row for selfServeMeta
    // (which carries the prospect's chosen template + palette + addons
    // when they self-served, and the rep's overrides otherwise).
    const [leadRow] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, lead.id))
      .limit(1);
    if (!leadRow) return null;

    const rows = await db
      .select()
      .from(leadEnrichment)
      .where(eq(leadEnrichment.leadId, lead.id))
      .orderBy(desc(leadEnrichment.fetchedAt));
    const latestBySource = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      // Skip our own previous audit so we don't grade our prior verdict.
      if (r.sourceKey === this.key) continue;
      if (!latestBySource.has(r.sourceKey)) latestBySource.set(r.sourceKey, r);
    }

    const synthesis = latestBySource.get("ai_synthesis");
    if (!synthesis) {
      // Nothing to grade yet — wait for the next enrichment cycle. We
      // intentionally do NOT call Claude with thin data because that's
      // exactly when the model over-corrects.
      return null;
    }

    const meta = (leadRow.selfServeMeta ?? {}) as Record<string, unknown>;
    const portalInputs = {
      template: meta.template ?? null,
      palette: meta.palette ?? null,
      addons: Array.isArray(meta.addons) ? meta.addons : [],
      practice: lead.practice,
      city: lead.city,
      state: lead.state,
      specialty: lead.specialty,
      // Pull the synthesized profile so the LLM can reason about
      // tone/voice match between the copy and the visual choices.
      synthesizedProfile: synthesis.payload,
    };

    const systemPrompt = `You are a senior brand designer reviewing a personalized website preview about to be shown to a healthcare practitioner prospect.

Your job is to grade the VISUAL HARMONY between:
- the template + palette + typography choices,
- the hero image hint and addon mix,
- the synthesized profile (practice voice, specialty, target population).

You are NOT a copywriter and NOT a developer. Do not rewrite copy, do not propose new features, do not suggest API integrations. Only flag visual / brand harmony risks.

CRITICAL RULES (anti-over-correction):
1. If the design is already cohesive (≥ 8/10 in your eye), return harmonyScore ≥ 85 and an EMPTY advisories array. Do NOT manufacture problems for a portal that looks good.
2. Flag at most 4 advisories. Each must describe a genuine harmony risk a typical client would notice within 3 seconds of landing on the page.
3. Severity ladder:
   - "low"    → mildly suboptimal; the design still ships well.
   - "medium" → a real but recoverable issue (e.g. palette feels clinical for a child-therapy practice).
   - "high"   → would actively hurt conversion (e.g. corporate slate-grey palette on a play-therapy hero, or a luxury serif on a budget sliding-scale clinic).
4. Each advisory.area MUST be one of: "palette", "hero", "copy_tone", "addon_mix", "typography", "overall". Anything else will be dropped.
5. Recommendations must be ONE specific, actionable sentence. No essays. No "consider exploring…".

Return ONLY valid JSON, no prose, no markdown fences:
{
  "harmonyScore": number,        // 0-100, where 100 = magazine-cover beautiful
  "headline": string,            // ≤ 70 chars one-line verdict for the rep dashboard
  "advisories": [
    {
      "area": "palette" | "hero" | "copy_tone" | "addon_mix" | "typography" | "overall",
      "severity": "low" | "medium" | "high",
      "observation": string,     // ≤ 140 chars, what is wrong
      "recommendation": string   // ≤ 140 chars, the fix in one sentence
    }
  ]
}`;

    const userPrompt = `Practice context:
- Practitioner: ${lead.name} — ${lead.practice}
- Specialty: ${lead.specialty}
- Location: ${lead.city}, ${lead.state}

Portal configuration assembled for this prospect:
${JSON.stringify(portalInputs, null, 2)}`;

    try {
      const client = getAnthropicClient();
      if (!client) return null;
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
          "design_audit: failed to parse JSON",
        );
        return null;
      }

      // Defensive normalization. The persona prompt is strict but we
      // still validate every field the dashboard will read so a rogue
      // model response cannot poison the rep UI.
      const harmonyScore = clamp(
        typeof json.harmonyScore === "number" ? Math.round(json.harmonyScore) : 70,
        0,
        100,
      );
      const headline =
        typeof json.headline === "string" && json.headline.trim().length > 0
          ? json.headline.trim().slice(0, 70)
          : harmonyScore >= 85
            ? "Design looks great — ship it."
            : "Design has room to tighten up.";

      const rawAdvisories = Array.isArray(json.advisories) ? json.advisories : [];
      const advisories = rawAdvisories
        .map((a) => normalizeAdvisory(a))
        .filter((a): a is NormalizedAdvisory => a !== null)
        .slice(0, 4);

      // High-score short-circuit: even if the model returned advisories,
      // when the design scores ≥ 85 we drop them. Prevents the dashboard
      // from showing "looks great · 3 issues" which is the contradictory
      // UX the rep complained about.
      const finalAdvisories = harmonyScore >= 85 ? [] : advisories;

      const hasHigh = finalAdvisories.some((a) => a.severity === "high");
      const summary = `Design audit · ${harmonyScore}/100 · ${
        finalAdvisories.length === 0 ? "no advisories" : `${finalAdvisories.length} advisor${finalAdvisories.length === 1 ? "y" : "ies"}`
      }${hasHigh ? " (1+ high)" : ""}`;

      return {
        confidence: harmonyScore,
        summary,
        payload: {
          harmonyScore,
          headline,
          hasCriticalIssues: hasHigh,
          advisories: finalAdvisories,
          // Stash a small audit envelope so the dashboard can show
          // "audited X minutes ago" without an extra DB column.
          auditedAt: new Date().toISOString(),
          model: "claude-sonnet-4-6",
        },
      };
    } catch (err) {
      logger.warn({ err, leadId: lead.id }, "design_audit: Claude call failed");
      return null;
    }
  }
}

type NormalizedAdvisory = {
  area: string;
  severity: Severity;
  observation: string;
  recommendation: string;
};

const normalizeAdvisory = (raw: unknown): NormalizedAdvisory | null => {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const area = typeof a.area === "string" ? a.area.trim().toLowerCase() : "";
  const severity = typeof a.severity === "string" ? a.severity.trim().toLowerCase() : "";
  const observation = typeof a.observation === "string" ? a.observation.trim() : "";
  const recommendation = typeof a.recommendation === "string" ? a.recommendation.trim() : "";
  if (!ALLOWED_AREAS.has(area as never)) return null;
  if (!ALLOWED_SEVERITIES.has(severity as Severity)) return null;
  if (observation.length === 0 || recommendation.length === 0) return null;
  return {
    area,
    severity: severity as Severity,
    observation: observation.slice(0, 140),
    recommendation: recommendation.slice(0, 140),
  };
};

const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));

const extractJson = (raw: string): Record<string, unknown> | null => {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    /* fallthrough */
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]) as Record<string, unknown>;
    } catch {
      /* fallthrough */
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      /* fallthrough */
    }
  }
  return null;
};

export const aiDesignAuditSource = new AIDesignAuditSource();
