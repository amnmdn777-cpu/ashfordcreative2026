import { db, leads, prospectPortals, portalEvents, portalCarts, salesReps } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { ensurePortalForLead, getLatestPortalActivity, getLatestCart, getAddonCatalog } from "./portals";
import {
  getLatestEnrichment,
  isAnyEnrichmentSourceConfigured,
  runEnrichmentForLead,
} from "../integrations/enrichment/orchestrator";
import { TEMPLATES } from "@workspace/api-zod";

export type BriefingResult = {
  summary: string;
  talkingPoints: string[];
  redFlags: string[];
  generatedAt: string;
  sourceLabel: "openai" | "anthropic" | "heuristic";
  // Surfaced separately from the LLM/heuristic body so the rep UI can render a
  // one-click "open Headway profile" link next to insurance-flavored talking
  // points without parsing free text. Null when no Headway enrichment exists.
  headwayProfileUrl: string | null;
};

/**
 * Builds a pre-call AI briefing for a prospect. Combines:
 *   - lead facts (name, practice, specialty, location)
 *   - enrichment payloads (Google Places etc.)
 *   - portal activity (which template viewed, addons toggled, cart, reserved)
 *
 * Calls OpenAI if configured, else Anthropic, else falls back to a deterministic
 * heuristic so the rep always gets something useful even with no API keys.
 */
export const generateBriefing = async (leadId: number): Promise<BriefingResult> => {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) throw new Error("lead not found");
  const portal = await ensurePortalForLead(leadId);
  // Auto-enrich on briefing generation: block briefly when any of the
  // CRITICAL preview sources is missing OR stale (>14d). Critical means
  // the source the prospect-facing portal needs to render real data
  // instead of SAMPLE Maya defaults: practice profile (google_places),
  // AI-synthesized mission/services/team (ai_synthesis), and crawled
  // pages (current_website_pages). Without this guard, a lead with
  // partial enrichment (e.g. google_places from initial scrape but no
  // ai_synthesis) would still generate non-personalized previews.
  // Soft-fails — the briefing still generates from whatever data we
  // have if enrichment errors out.
  const CRITICAL_SOURCES = [
    "google_places",
    "ai_synthesis",
    "current_website_pages",
  ];
  const STALE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
  // Hard cap on how long we'll wait for fresh enrichment before returning
  // the briefing. The Replit autoscale proxy terminates idle requests at
  // ~25s with HTTP 504; on a freshly-claimed lead the full 12-source
  // pipeline takes ~25-30s, which used to push the rep's briefing call
  // into proxy-timeout territory even though the server eventually
  // responded with a 200 (founder report 2026-05-08, lead Jamonte
  // Banks). With this race the briefing returns within ~15s worst-case,
  // any sources that haven't finished by then keep running in the
  // background, and the very next "Regenerate briefing" click picks up
  // whatever finished in the meantime.
  const PRE_ENRICH_BUDGET_MS = 15_000;
  try {
    const existing = await getLatestEnrichment(leadId);
    const presentSources = new Set(existing.map((e) => e.sourceKey));
    const now = Date.now();
    const anyMissing = CRITICAL_SOURCES.some((s) => !presentSources.has(s));
    const anyStale = existing.some((e) => {
      if (!CRITICAL_SOURCES.includes(e.sourceKey)) return false;
      const ts = e.fetchedAt ? new Date(e.fetchedAt).getTime() : 0;
      return now - ts > STALE_MS;
    });
    if ((anyMissing || anyStale) && isAnyEnrichmentSourceConfigured()) {
      const enrichPromise = runEnrichmentForLead(leadId, "auto");
      // Always attach a catch handler to the underlying promise so an
      // enrichment failure that resolves AFTER the race timeout doesn't
      // surface as an unhandledRejection on the process.
      enrichPromise.catch((err) => {
        logger.warn(
          { err, leadId },
          "briefing: background enrichment failed after race timeout",
        );
      });
      // Hold the timeout handle so we can clear it when enrichment wins
      // the race — otherwise the timer keeps the event loop alive for
      // the full budget AND falsely logs "budget exhausted" on every
      // briefing, polluting telemetry (architect review 2026-05-08).
      let timeoutHandle: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<"timeout">((resolve) => {
        timeoutHandle = setTimeout(() => resolve("timeout"), PRE_ENRICH_BUDGET_MS);
      });
      const winner = await Promise.race([
        enrichPromise.then(() => "enrichment" as const),
        timeoutPromise,
      ]);
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (winner === "timeout") {
        logger.info(
          { leadId, budgetMs: PRE_ENRICH_BUDGET_MS },
          "briefing: pre-enrichment budget exhausted, proceeding with cached data",
        );
      }
    }
  } catch (err) {
    logger.warn({ err, leadId }, "briefing: pre-enrichment failed, continuing");
  }
  const [events, cart, enrichment, addonCatalog, rep] = await Promise.all([
    getLatestPortalActivity(portal.id, 50),
    getLatestCart(portal.id),
    getLatestEnrichment(leadId),
    getAddonCatalog(),
    lead.claimedByRepId
      ? db.select().from(salesReps).where(eq(salesReps.id, lead.claimedByRepId)).limit(1).then((r) => r[0] ?? null)
      : Promise.resolve(null),
  ]);

  const context = buildContext({ lead, portal, events, cart, enrichment, addonCatalog, rep });
  const headwayProfileUrl = context.headway?.profileUrl ?? null;

  // Prefer OpenAI → Anthropic → heuristic.
  if (env.openaiApiKey) {
    try {
      const result = await callOpenAi(context);
      return { ...result, generatedAt: new Date().toISOString(), sourceLabel: "openai", headwayProfileUrl };
    } catch (err) {
      logger.warn({ err, leadId }, "briefing: openai failed, falling back");
    }
  }
  if (env.anthropicApiKey) {
    try {
      const result = await callAnthropic(context);
      return { ...result, generatedAt: new Date().toISOString(), sourceLabel: "anthropic", headwayProfileUrl };
    } catch (err) {
      logger.warn({ err, leadId }, "briefing: anthropic failed, falling back");
    }
  }
  return { ...heuristicBriefing(context), generatedAt: new Date().toISOString(), sourceLabel: "heuristic", headwayProfileUrl };
};

type BriefingContext = ReturnType<typeof buildContext>;

const buildContext = ({
  lead,
  portal,
  events,
  cart,
  enrichment,
  addonCatalog,
  rep,
}: {
  lead: typeof leads.$inferSelect;
  portal: typeof prospectPortals.$inferSelect;
  events: Array<typeof portalEvents.$inferSelect>;
  cart: typeof portalCarts.$inferSelect | null;
  enrichment: Array<{ sourceKey: string; summary: string | null; payload: unknown }>;
  addonCatalog: Awaited<ReturnType<typeof getAddonCatalog>>;
  rep: typeof salesReps.$inferSelect | null;
}) => {
  const addonNameBySlug = new Map(addonCatalog.map((a) => [a.slug, a.name]));
  // Roll up: number of opens, last 5 events, addons in cart, addons toggled.
  const openCount = portal.openCount ?? 0;
  const lastOpenedAt = portal.lastOpenedAt;
  const recentEvents = events.slice(0, 12).map((e) => ({
    type: e.eventType,
    template: e.templateKey,
    addon: e.addonSlug ? addonNameBySlug.get(e.addonSlug) ?? e.addonSlug : null,
    when: e.occurredAt,
  }));
  const cartAddons = (cart?.addonSlugs ?? []).map((s) => addonNameBySlug.get(s) ?? s);
  const addonToggleEvents = events.filter((e) => e.eventType === "addon_toggle" && e.addonSlug);
  const interestedAddons = Array.from(
    new Set(addonToggleEvents.map((e) => addonNameBySlug.get(e.addonSlug!) ?? e.addonSlug!)),
  ).slice(0, 5);
  // openCount counts every portal load including reps testing the
  // preview flow, so a fresh `Prepare preview` click inflates it to 1.
  // Treat the prospect as "actually engaged" only when there is at
  // least one user-driven event — passive `opened` rows are filtered
  // out because the rep's own preview load creates them. Gates the
  // engagement-derived bullets in heuristicBriefing so the rep doesn't
  // see "they have opened the portal" / "currently previewing X" /
  // "saved cart includes Y" when the only signal is rep-side traffic.
  const PROSPECT_DRIVEN_EVENTS = new Set([
    "addon_toggle",
    "cart_update",
    "preferred_template",
    "requested_changes",
    "requested_callback",
    "reserve_clicked",
    "reserve_succeeded",
  ]);
  const hasProspectEngagement = events.some((e) =>
    PROSPECT_DRIVEN_EVENTS.has(e.eventType),
  );
  const hasCartUpdate = events.some((e) => e.eventType === "cart_update");
  // Reps see these lines verbatim (talking-points + summary), so we strip the
  // internal `[sourceKey]` prefix that used to dump source identifiers like
  // `[clearbit_autocomplete]` / `[google_places]` into the briefing copy.
  // The source attribution lives in the raw enrichment table for ops review;
  // it doesn't belong in the human-facing call prep.
  const enrichmentLines = enrichment
    .filter((e) => e.summary)
    .map((e) => (e.summary as string).trim())
    .filter((s) => s.length > 0)
    .slice(0, 6);
  // Headway profile is the strongest insurance signal we have. Surface it
  // as a distinct context block so the LLM can wedge on "they already
  // accept BCBS via Headway → site captures cash-pay clients".
  const headwayRow = enrichment.find((e) => e.sourceKey === "headway");
  const headway = headwayRow && isRecord(headwayRow.payload)
    ? {
        profileUrl: str(headwayRow.payload.profileUrl) ?? null,
        bio: str(headwayRow.payload.bio) ?? null,
        acceptedInsurances: stringArr(headwayRow.payload.acceptedInsurances),
        specialties: stringArr(headwayRow.payload.specialties),
        modalities: stringArr(headwayRow.payload.modalities),
        languages: stringArr(headwayRow.payload.languages),
        inPerson: !!headwayRow.payload.inPerson,
        virtual: !!headwayRow.payload.virtual,
        acceptsSlidingScale: !!headwayRow.payload.acceptsSlidingScale,
      }
    : null;
  return {
    lead: {
      name: lead.name,
      practice: lead.practice,
      specialty: lead.specialty,
      city: lead.city,
      state: lead.state,
      currentWebsite: lead.currentWebsite,
      profileBlurb: lead.profileBlurb,
    },
    portal: {
      slug: portal.slug,
      template: hasProspectEngagement
        ? TEMPLATES[portal.selectedTemplate]?.label ?? portal.selectedTemplate
        : null,
      openCount,
      lastOpenedAt,
      reservedAt: portal.reservedAt,
      hasProspectEngagement,
    },
    cart:
      cart && hasCartUpdate
        ? {
            addons: cartAddons,
            monthlyTotalCents: cart.monthlyTotalCents,
          }
        : null,
    interestedAddons,
    recentEvents,
    enrichmentLines,
    headway,
    repName: rep?.displayName ?? "the Ashford team",
  };
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;
const stringArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

const PROMPT_INSTRUCTION = `You are a sales coach for a $199/mo bilingual website agency for Texas mental-health practitioners.
Given the prospect snapshot below, return STRICT JSON with these fields:
- "summary": a thorough situational read of 6 to 10 sentences. Cover who the prospect is, what their practice looks like, what we know from enrichment, and how engaged they are with the personal portal so far. Plain prose, no bullets inside.
- "talkingPoints": ALWAYS return an empty array []. The rep does not want canned bullets — they run the call themselves.
- "redFlags": 0 to 3 short cautions about the prospect (low engagement, missing data, off-market, etc). Empty array if none.
If a "headway" block is present in the snapshot, the prospect is already listed on Headway and accepting insurance. Mention this explicitly in "summary" (cite the actual insurance names, e.g. "they accept BCBS, Aetna via Headway"), and emphasise that an Ashford site captures cash-pay clients who don't want to use insurance.
Do NOT include an "opener" or any greeting line — the rep handles the opener themselves. Keep tone calm and respectful. Do NOT invent facts not in the snapshot.`;

const callOpenAi = async (ctx: BriefingContext): Promise<Omit<BriefingResult, "generatedAt" | "sourceLabel" | "headwayProfileUrl">> => {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.4,
      messages: [
        { role: "system", content: PROMPT_INSTRUCTION },
        { role: "user", content: JSON.stringify(ctx) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  return parseLlmJson(content);
};

const callAnthropic = async (ctx: BriefingContext): Promise<Omit<BriefingResult, "generatedAt" | "sourceLabel" | "headwayProfileUrl">> => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.anthropicApiKey ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 800,
      system: PROMPT_INSTRUCTION,
      messages: [{ role: "user", content: JSON.stringify(ctx) }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const json = (await res.json()) as { content?: Array<{ text?: string }> };
  const text = json.content?.[0]?.text ?? "{}";
  return parseLlmJson(text);
};

const parseLlmJson = (raw: string): Omit<BriefingResult, "generatedAt" | "sourceLabel" | "headwayProfileUrl"> => {
  // Strip ```json fences if present.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    // Talking points removed from the rep dashboard per founder feedback
    // 2026-05-08; force-empty regardless of what the LLM returned so we
    // don't ship stale bullets if the prompt is partially ignored.
    talkingPoints: [],
    redFlags: arr(parsed.redFlags),
  };
};

/**
 * No-API-key fallback. Builds a useful briefing purely from the structured data.
 * Better than nothing — and keeps the rep flow demo-able without secrets.
 */
const heuristicBriefing = (ctx: BriefingContext): Omit<BriefingResult, "generatedAt" | "sourceLabel" | "headwayProfileUrl"> => {
  const summaryParts: string[] = [];
  summaryParts.push(`${ctx.lead.name} runs ${ctx.lead.practice}, a ${ctx.lead.specialty} practice in ${ctx.lead.city}, ${ctx.lead.state}.`);
  if (ctx.lead.profileBlurb) {
    summaryParts.push(`Public profile reads: ${ctx.lead.profileBlurb}`);
  }
  if (ctx.lead.currentWebsite) {
    summaryParts.push(`They already have a web presence at ${ctx.lead.currentWebsite}, so frame the conversation as a refresh — not a first-ever site.`);
  } else {
    summaryParts.push(`They do not appear to have a dedicated practice website, so this would be their first owned site beyond directory profiles.`);
  }
  if (ctx.enrichmentLines.length === 0) {
    summaryParts.push(`Enrichment data is still thin, so confirm core practice facts during the call.`);
  }
  // Note: individual enrichment lines used to be dumped here as
  // `Enrichment turned up: [clearbit_autocomplete] ... [google_places] ...`
  // which read like raw debug output to reps. The most useful detail is
  // already surfaced as a talking point below; the rest stay in the
  // structured enrichment table on the lead page.
  if (ctx.headway && ctx.headway.acceptedInsurances.length > 0) {
    summaryParts.push(
      `They are already listed on Headway and accept ${ctx.headway.acceptedInsurances.slice(0, 4).join(", ")} — their site can complement that funnel by capturing cash-pay clients who do not want to use insurance.`,
    );
  } else if (ctx.headway) {
    summaryParts.push(
      `They have a Headway profile, so they are open to insurance-routed clients today.`,
    );
  }
  if (ctx.portal.hasProspectEngagement) {
    summaryParts.push(`They have actually interacted with the personal portal${ctx.portal.lastOpenedAt ? ` (most recently on ${new Date(ctx.portal.lastOpenedAt).toLocaleDateString()})` : ""}, so engagement is real and not cold.`);
  } else {
    summaryParts.push(`No prospect-side engagement on the portal yet — this call is more about earning the click than closing.`);
  }
  if (ctx.portal.template) {
    summaryParts.push(`They are currently previewing the "${ctx.portal.template}" template direction.`);
  }
  if (ctx.interestedAddons.length > 0) {
    summaryParts.push(`Toggled interest in these add-ons: ${ctx.interestedAddons.join(", ")}.`);
  }
  if (ctx.cart?.addons && ctx.cart.addons.length > 0) {
    summaryParts.push(`Their saved cart includes ${ctx.cart.addons.join(", ")}, which is a strong buying signal.`);
  }
  // The contract requires a 6-10 sentence summary. Pad with neutral
  // sales-coaching filler if enrichment was thin, so the heuristic
  // fallback never under-delivers when the LLM is unavailable.
  const FILLERS = [
    `Treat this call as a discovery first — confirm what they actually need before pitching specifics.`,
    `Ask open questions about their patient mix, intake bottlenecks, and what "good" would look like in 90 days.`,
    `Anchor any pricing discussion on the $199/mo, no-setup-fee Plan B and the 48-hour go-live timeline.`,
    `Listen for objections about contracts, ownership of the site, and switching cost — those are the most common blockers.`,
    `End with a concrete next step: a portal walkthrough, a paid pilot, or a follow-up time on the calendar.`,
  ];
  while (summaryParts.length < 6 && summaryParts.length < 10) {
    const filler = FILLERS[summaryParts.length - 1] ?? FILLERS[FILLERS.length - 1];
    if (!filler) break;
    summaryParts.push(filler);
  }
  // Trim to 6-10 sentences max.
  const summary = summaryParts.slice(0, 10).join(" ");

  // Talking points removed per founder feedback 2026-05-08 — see UI
  // comment in LeadDetail.tsx. Heuristic now returns an empty array so
  // the API contract still matches the zod schema.
  const cappedTalkingPoints: string[] = [];

  const redFlags: string[] = [];
  if (!ctx.portal.hasProspectEngagement) redFlags.push("No real prospect engagement yet — keep the call light, not closing.");
  if (ctx.enrichmentLines.length === 0) redFlags.push("No enrichment data yet — verify practice details on the call.");
  if (!ctx.lead.currentWebsite && !ctx.portal.hasProspectEngagement) {
    redFlags.push("Cold prospect with no public web presence — qualify before investing too much time.");
  }
  return {
    summary,
    talkingPoints: cappedTalkingPoints,
    redFlags: redFlags.slice(0, 3),
  };
};
