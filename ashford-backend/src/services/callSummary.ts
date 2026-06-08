import {
  db,
  calls,
  callTranscripts,
  callSummaries,
  leads,
  callbackSchedules,
  twilioMessages,
  emailMessages,
} from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { env } from "../lib/env";
import { logger } from "../lib/logger";

// gpt-4o-mini summary in JSON-schema mode; falls back to a heuristic
// summary on persistent OpenAI failures so the dashboard never shows an
// empty card. Cost: $0.15/1M input + $0.60/1M output, rounded up to cents.

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const MAX_ATTEMPTS = 3;

const computeGptCostCents = (
  promptTokens: number,
  completionTokens: number,
): number => {
  const dollars =
    (promptTokens / 1_000_000) * 0.15 +
    (completionTokens / 1_000_000) * 0.6;
  if (!Number.isFinite(dollars) || dollars <= 0) return 0;
  return Math.max(1, Math.ceil(dollars * 100));
};

// Strict JSON schema. Field descriptions also document cardinalities;
// arrays are clamped in code so the UI stays predictable.
const summarySchema = {
  name: "call_summary",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: {
        type: "string",
        description:
          "3–5 sentence narrative of what happened on the call. Always written in English regardless of the source language.",
      },
      talkingPoints: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: { type: "string" },
        description:
          "3–5 bullet items: objections, concerns, decision-makers, pricing signals, or context the rep should remember.",
      },
      nextActions: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: { type: "string" },
        description:
          "1–3 concrete follow-up steps for the rep, ordered by priority.",
      },
    },
    required: ["summary", "talkingPoints", "nextActions"],
  },
} as const;

const SYSTEM_PROMPT = [
  "You are an assistant summarising a sales call between an Ashford Creative rep and a behavioral-health practice prospect (LCSW, LMFT, LPC, psychologist, psychiatrist).",
  "Write the summary, talkingPoints, and nextActions ALWAYS in English, even when the transcript is Spanish — the rep dashboard is English-only.",
  "Be concise. Capture objections, pricing concerns, decision-makers, scheduling commitments, bilingual cues, and anything the rep promised.",
  "Never invent facts not present in the transcript. If the call is silence, hold music, or unintelligible noise, say so plainly in the summary and emit a single talkingPoint and nextAction acknowledging the failed call.",
  "Use the lead briefing below ONLY to ground your summary in context (practice type, status, prior touches). Do not invent anything beyond what's in the transcript.",
].join(" ");

type SummaryShape = {
  summary: string;
  talkingPoints: string[];
  nextActions: string[];
};

// Lead briefing + last-5-touch timeline + transcript.
const buildUserPrompt = async (
  callId: number,
  transcriptText: string,
  transcriptLang: string | null,
  callRow: typeof calls.$inferSelect | undefined,
): Promise<string> => {
  let briefing = "Lead: unmatched (no lead linked to this call).";
  let timeline = "Timeline: (none on file)";

  const leadId = callRow?.leadId ?? null;
  if (leadId !== null && leadId !== undefined) {
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);
    if (lead) {
      briefing = [
        `Lead: ${lead.name} (${lead.practice ?? "no practice on file"})`,
        `Specialty: ${lead.specialty ?? "—"}`,
        `Location: ${[lead.city, lead.state].filter(Boolean).join(", ") || "—"}`,
        `Status: ${lead.status}`,
        `Locale: ${lead.locale ?? "en"}`,
        lead.email ? `Email: ${lead.email}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const [callbacks, sms, emails] = await Promise.all([
        db
          .select()
          .from(callbackSchedules)
          .where(eq(callbackSchedules.leadId, leadId))
          .orderBy(desc(callbackSchedules.scheduledFor))
          .limit(5),
        db
          .select()
          .from(twilioMessages)
          .where(eq(twilioMessages.leadId, leadId))
          .orderBy(desc(twilioMessages.occurredAt))
          .limit(5),
        db
          .select()
          .from(emailMessages)
          .where(eq(emailMessages.leadId, leadId))
          .orderBy(desc(emailMessages.occurredAt))
          .limit(5),
      ]);

      type TimelineEntry = { at: Date; line: string };
      const entries: TimelineEntry[] = [
        ...callbacks.map((c) => ({
          at: c.scheduledFor ?? c.createdAt,
          line: `[callback] ${c.scheduledFor?.toISOString() ?? "?"} — ${c.note ?? "(no notes)"}`,
        })),
        ...sms.map((m) => ({
          at: m.occurredAt,
          line: `[sms ${m.direction}] ${(m.body ?? "").slice(0, 140)}`,
        })),
        ...emails.map((e) => ({
          at: e.occurredAt,
          line: `[email ${e.direction}] ${(e.subject ?? "(no subject)").slice(0, 80)}`,
        })),
      ]
        .filter((e) => e.at instanceof Date && !Number.isNaN(e.at.getTime()))
        .sort((a, b) => b.at.getTime() - a.at.getTime())
        .slice(0, 5);
      if (entries.length > 0) {
        timeline =
          "Recent timeline (most recent first):\n" +
          entries.map((e) => `- ${e.line}`).join("\n");
      }
    }
  }

  return [
    `Call id: ${callId}`,
    `Direction: ${callRow?.direction ?? "unknown"}`,
    `Duration: ${callRow?.durationSec ?? "?"}s`,
    `Detected language: ${transcriptLang ?? "unknown"} (write the OUTPUT in English regardless)`,
    "",
    "Lead briefing:",
    briefing,
    "",
    timeline,
    "",
    "Transcript:",
    transcriptText,
  ].join("\n");
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Returns null on persistent failure; caller falls back to heuristic.
const callOpenAi = async (
  systemPrompt: string,
  userPrompt: string,
): Promise<{
  parsed: SummaryShape;
  promptTokens: number;
  completionTokens: number;
} | null> => {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(OPENAI_CHAT_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.openaiApiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_schema", json_schema: summarySchema },
          temperature: 0.2,
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const content = json.choices?.[0]?.message?.content ?? "";
        try {
          const parsed = JSON.parse(content) as SummaryShape;
          return {
            parsed,
            promptTokens: json.usage?.prompt_tokens ?? 0,
            completionTokens: json.usage?.completion_tokens ?? 0,
          };
        } catch {
          // Malformed JSON in strict mode is non-retryable — fall through.
          logger.warn(
            { content: content.slice(0, 200) },
            "summarizeCall: JSON parse failed (non-retryable)",
          );
          return null;
        }
      }

      const retryable = res.status === 429 || res.status >= 500;
      const text = await res.text().catch(() => "");
      logger.warn(
        {
          attempt,
          status: res.status,
          retryable,
          body: text.slice(0, 200),
        },
        "summarizeCall: openai non-200",
      );
      if (!retryable || attempt === MAX_ATTEMPTS) return null;
    } catch (err) {
      logger.warn({ err, attempt }, "summarizeCall: openai fetch threw");
      if (attempt === MAX_ATTEMPTS) return null;
    }
    await sleep(2 ** (attempt - 1) * 1000);
  }
  return null;
};

// Deterministic fallback when OpenAI is unavailable; cost recorded as 0.
const heuristicFallback = (
  transcriptText: string,
  callRow: typeof calls.$inferSelect | undefined,
): SummaryShape => {
  const direction = callRow?.direction ?? "unknown";
  const seconds = callRow?.durationSec ?? 0;
  const minutes = seconds > 0 ? Math.round((seconds / 60) * 10) / 10 : 0;
  const trimmed = (transcriptText ?? "").trim();
  const preview = trimmed.slice(0, 240).replace(/\s+/g, " ");
  return {
    summary:
      `Automatic summary unavailable (AI service temporarily unreachable). ` +
      `${direction === "inbound" ? "Inbound" : "Outbound"} call ran ${minutes}m. ` +
      (preview
        ? `Transcript preview: "${preview}${trimmed.length > 240 ? "…" : ""}". `
        : "No transcript text was captured. ") +
      `Listen to the recording and add notes manually.`,
    talkingPoints: [
      "AI summary failed — review the transcript and recording before next contact.",
      `Call direction: ${direction}.`,
      `Connected duration: ${minutes} minutes.`,
    ],
    nextActions: ["Listen to the recording and write a manual recap."],
  };
};

// Pad-or-truncate to [min,max] so the UI stays predictable.
const clampArray = (
  arr: string[] | undefined,
  min: number,
  max: number,
  filler: string,
): string[] => {
  const cleaned = (arr ?? [])
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .slice(0, max);
  while (cleaned.length < min) cleaned.push(filler);
  return cleaned;
};

export const summarizeCall = async (callId: number): Promise<void> => {
  const [transcript] = await db
    .select()
    .from(callTranscripts)
    .where(eq(callTranscripts.callId, callId))
    .limit(1);
  if (!transcript || !transcript.transcriptText) {
    logger.info({ callId }, "summarizeCall: no transcript yet — skipping");
    return;
  }

  const [callRow] = await db
    .select()
    .from(calls)
    .where(eq(calls.id, callId))
    .limit(1);

  const userPrompt = await buildUserPrompt(
    callId,
    transcript.transcriptText,
    transcript.transcriptLang,
    callRow,
  );

  let parsed: SummaryShape;
  let gptCostCents = 0;
  let usedFallback = false;

  if (env.openaiApiKey) {
    const result = await callOpenAi(SYSTEM_PROMPT, userPrompt);
    if (result) {
      parsed = result.parsed;
      gptCostCents = computeGptCostCents(
        result.promptTokens,
        result.completionTokens,
      );
    } else {
      usedFallback = true;
      parsed = heuristicFallback(transcript.transcriptText, callRow);
    }
  } else {
    logger.warn(
      { callId },
      "summarizeCall: OPENAI_API_KEY missing — using heuristic fallback",
    );
    usedFallback = true;
    parsed = heuristicFallback(transcript.transcriptText, callRow);
  }

  const summary = (parsed.summary ?? "").trim() || "(empty summary)";
  const talkingPoints = clampArray(
    parsed.talkingPoints,
    3,
    5,
    "No additional context captured.",
  );
  const nextActions = clampArray(
    parsed.nextActions,
    1,
    3,
    "Review the recording and decide next step.",
  );

  // Upsert on unique callId so re-runs / duplicate webhooks don't double-insert.
  await db
    .insert(callSummaries)
    .values({
      callId,
      summary,
      talkingPoints,
      nextActions,
      gptCostCents,
    })
    .onConflictDoUpdate({
      target: callSummaries.callId,
      set: {
        summary,
        talkingPoints,
        nextActions,
        // Only overwrite cost on a real model call so accounting stays honest.
        ...(usedFallback ? {} : { gptCostCents }),
        generatedAt: new Date(),
      },
    });

  logger.info(
    {
      callId,
      gptCostCents,
      usedFallback,
      leadId: callRow?.leadId ?? null,
    },
    "summarizeCall: succeeded",
  );

  // Bump lead's lastActivityAt so it surfaces on the dashboard.
  if (callRow?.leadId !== null && callRow?.leadId !== undefined) {
    await db
      .update(leads)
      .set({ lastActivityAt: sql`now()` })
      .where(eq(leads.id, callRow.leadId));
  }
};
