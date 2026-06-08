/**
 * Generate 3 pre-written blog post drafts the prospect sees in their
 * Insights Journal section on the preview.
 *
 * Two paths:
 *  - draftJournalEntries(): pure heuristic, no network — runs on
 *    every preview build, sub-millisecond.
 *  - draftJournalEntriesWithLlm(): tries Anthropic with a short
 *    timeout when ANTHROPIC_API_KEY is present and the practitioner
 *    has a real bio (>=120 chars). Falls back to the heuristic on
 *    timeout / error / missing-key.
 *
 * The wow moment is "they have a blog ready to go in my voice",
 * stronger when LLM hits because the copy actually mirrors the
 * practitioner's bio language.
 */
import { logger } from "../lib/logger";
import { env } from "../lib/env";

export interface DraftedJournalEntry {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  readingMinutes: number;
}

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const SPECIALTY_HOOKS: Record<string, { title: (n: string) => string; body: (n: string) => string }> = {
  trauma: {
    title: (n) => `What trauma really feels like — and what changes in ${n}'s room`,
    body: (n) =>
      `Most people come to ${n}'s practice expecting trauma work to look like crying, breakthroughs, big revelations. The truth is quieter. The first sign that the work is moving is usually that your body stops bracing the way it used to — at red lights, before phone calls, when someone close to you raises their voice. The breakthroughs come, but they're not the point.\n\nIf you've been carrying something for a long time and you're not sure if therapy can touch it, this is what to expect: a slower start than you think you want, a deeper map than you expect, and a kind of tiredness in week three that's not actually tiredness — it's release.`,
  },
  anxiety: {
    title: (n) => `The anxiety story you tell yourself, and how ${n} helps you rewrite it`,
    body: (n) =>
      `By the time most people walk into ${n}'s office, they've already tried "managing" their anxiety: apps, breathwork, books, the occasional weekend that helped for two days. What they haven't tried is changing the story underneath — the one their nervous system learned in childhood and has been faithfully running ever since.\n\nIn the work I do, the early sessions are about mapping that story without judgment. Not "why are you anxious," but "what was your body trying to keep you safe from when this pattern was useful?" Once we name the original protection, the symptom usually loosens on its own.`,
  },
  couples: {
    title: (n) => `Why couples therapy with ${n} doesn't look like the version you've seen on TV`,
    body: (n) =>
      `The image of couples therapy in pop culture is two people on a sofa being asked how the fight made them feel. Real couples work, in ${n}'s practice, looks different. We spend the first session mapping not who's wrong but what each partner's nervous system is doing in conflict — because most couple-fights aren't about the dishes, they're about an attachment cue one of you didn't know you were sending.\n\nIf you've tried couples work before and it didn't take, this is usually why: the room was processing content (the argument) instead of process (the dance). Once we change what we're tracking, what changes in the relationship usually surprises both of you.`,
  },
  relationships: {
    title: (n) => `Attachment isn't a personality type — it's a learnable language`,
    body: (n) =>
      `One of the things that comes up most often in ${n}'s practice is the relief people feel when they realize their "attachment style" isn't who they are — it's a language they learned. And like any language, it can be expanded.\n\nAvoidant people can learn to stay. Anxious people can learn to settle. The work isn't about fixing yourself; it's about adding fluency. The second half of an honest therapeutic relationship is often where this happens, because the room itself is where you practice — slowly, with low stakes, with someone who's tracking what your old language made hard to say.`,
  },
  perinatal: {
    title: (n) => `The matrescence shift no one warned you about, and how ${n}'s work meets it`,
    body: (n) =>
      `The American medical system gives women a 6-week postpartum check-up and considers the transition handled. The reality, as anyone who's been through it knows, is that becoming a mother (or father) reorganizes your nervous system for a year, sometimes longer. ${n}'s perinatal work meets you in that reorganization rather than treating it as a disorder to fix.\n\nWhat we work on isn't "getting back to who you were before." That person is gone — and that's not a tragedy, it's a transition. We work on integrating who you're becoming, with all the rage, awe, exhaustion, and fierce protectiveness that comes with it.`,
  },
  lgbtq: {
    title: (n) => `Why the therapy room has to be a sanctuary first — and what ${n} does to make it one`,
    body: (n) =>
      `For LGBTQ+ clients, the question that hangs over the first session is almost never "will this therapist help me?" — it's "will this therapist make me explain myself?" In ${n}'s practice, the answer to that second question is no.\n\nThe work assumes a baseline of competence around identity, family-of-origin grief, partner dynamics, healthcare avoidance — the things you've spent years explaining to other providers. We start where you'd start with a friend who already gets it, which is the next layer down: what's actually hurting, what's the pattern underneath, what would you like to be different.`,
  },
  default: {
    title: (n) => `What it's like to work with ${n}: rhythm, expectations, and the first ninety days`,
    body: (n) =>
      `Most of the questions clients ask in their first call to ${n}'s practice aren't about therapy itself — they're about the rhythm of the work. How often. For how long. What changes by the second month. Whether it's normal to feel worse before you feel better (sometimes, yes). Whether you have to know what's wrong before starting (no).\n\nThe honest answer to all of those is: the rhythm depends on what you're carrying, and the first month is for finding it — not racing to a fix. By around session six, most people start noticing changes outside the room before they notice them inside it. That's the rhythm settling. Everything after that is the work.`,
  },
};

export const draftJournalEntries = ({
  practitionerName,
  specialties,
}: {
  practitionerName: string | null;
  specialties: string[];
}): DraftedJournalEntry[] => {
  const name =
    (practitionerName ?? "")
      .replace(/^(?:dr|mr|mrs|ms|mx|prof)\.?\s+/i, "")
      .split(/\s+/)[0] ||
    "your therapist";
  const lowerSpecialties = specialties.map((s) => s.toLowerCase());
  const matchedKeys: string[] = [];
  for (const sp of lowerSpecialties) {
    if (matchedKeys.length >= 3) break;
    if (/trauma|ptsd/i.test(sp) && !matchedKeys.includes("trauma")) matchedKeys.push("trauma");
    else if (/anxiety|panic/i.test(sp) && !matchedKeys.includes("anxiety")) matchedKeys.push("anxiety");
    else if (/couple|marriage/i.test(sp) && !matchedKeys.includes("couples")) matchedKeys.push("couples");
    else if (/relationship|attachment/i.test(sp) && !matchedKeys.includes("relationships")) matchedKeys.push("relationships");
    else if (/perinatal|postpartum|matrescence|maternal/i.test(sp) && !matchedKeys.includes("perinatal")) matchedKeys.push("perinatal");
    else if (/lgbt|queer|gay|trans|gender/i.test(sp) && !matchedKeys.includes("lgbtq")) matchedKeys.push("lgbtq");
  }
  while (matchedKeys.length < 3) {
    matchedKeys.push("default");
  }
  return matchedKeys.slice(0, 3).map((key) => {
    const hook = SPECIALTY_HOOKS[key] ?? SPECIALTY_HOOKS["default"]!;
    const title = hook.title(name);
    const body = hook.body(name);
    const excerpt = body.split("\n")[0]?.slice(0, 220) ?? "";
    const readingMinutes = Math.max(1, Math.min(8, Math.round(body.split(/\s+/).length / 220)));
    return {
      title,
      slug: slugify(title),
      excerpt,
      body,
      readingMinutes,
    };
  });
};

const LLM_TIMEOUT_MS = 6_000;
const LLM_PROMPT = `You write short, plainspoken blog drafts for licensed therapists. Output STRICT JSON ONLY (no prose, no fences) matching this shape:
{ "entries": [ { "title": string, "body": string }, ... 3 items ] }
Constraints:
- Three entries, each grounded in a different facet of the therapist's actual bio + listed specialties — never fabricate credentials or modalities not present in the snapshot.
- Title: a real magazine-style hook (≤90 chars), not clinical jargon. No colons unless the second half is short.
- Body: 2 paragraphs, 90-180 words total, written in first person matching the bio's voice. No headings, no bullets, no AI tells ("In conclusion", "It's important to note", "Let's dive in"). No greetings.
- Speak as the therapist (the bio's voice) — if the bio uses "I", you use "I"; if "we", you use "we".
- DO NOT mention the therapist's name in the body — they don't refer to themselves by name in their own articles.
- DO NOT invent stats, study citations, or quotes.`;

const callAnthropicForJournal = async (
  ctx: { practitionerName: string | null; bio: string; specialties: string[] },
): Promise<DraftedJournalEntry[] | null> => {
  if (!env.anthropicApiKey) return null;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": env.anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        temperature: 0.6,
        system: LLM_PROMPT,
        messages: [{ role: "user", content: JSON.stringify(ctx) }],
      }),
    });
    if (!res.ok) {
      logger.warn(
        { status: res.status },
        "draftJournal LLM HTTP non-200, falling back to heuristic",
      );
      return null;
    }
    const json = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = json.content?.[0]?.text ?? "";
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as { entries?: Array<{ title: unknown; body: unknown }> };
    const out: DraftedJournalEntry[] = [];
    for (const entry of parsed.entries ?? []) {
      const title = typeof entry.title === "string" ? entry.title.trim() : "";
      const body = typeof entry.body === "string" ? entry.body.trim() : "";
      if (title.length < 8 || body.length < 80) continue;
      const excerpt = body.split("\n")[0]?.slice(0, 220) ?? "";
      const readingMinutes = Math.max(1, Math.min(8, Math.round(body.split(/\s+/).length / 220)));
      out.push({ title, slug: slugify(title), excerpt, body, readingMinutes });
    }
    if (out.length < 3) return null;
    return out.slice(0, 3);
  } catch (err) {
    logger.warn({ err }, "draftJournal LLM call failed");
    return null;
  } finally {
    clearTimeout(t);
  }
};

/**
 * LOT 2.5 — drop journal entries with duplicate slugs. The Claude prompt
 * occasionally produces two entries with near-identical titles (~20% of
 * runs at QA Round 6; confirmed on Gail = 1 dup, Stephanie Wright = 2
 * dups). Both heads end up byte-identical in `previewContent
 * .draftedJournalEntries`, which the prospect portal then renders as a
 * repeated card.
 *
 * Keep the first occurrence; drop the rest. `warn` on duplicates so we
 * can audit the prompt that produced them.
 */
export const dedupJournalEntriesBySlug = (
  entries: DraftedJournalEntry[],
  ctx: { practitionerName?: string | null } = {},
): DraftedJournalEntry[] => {
  const seen = new Set<string>();
  const out: DraftedJournalEntry[] = [];
  const dupSlugs: string[] = [];
  for (const entry of entries) {
    const key = entry.slug.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) {
      dupSlugs.push(key);
      continue;
    }
    seen.add(key);
    out.push(entry);
  }
  if (dupSlugs.length > 0) {
    logger.warn(
      {
        practitionerName: ctx.practitionerName ?? null,
        dupSlugs,
        kept: out.length,
      },
      "draftJournal: duplicate slugs dropped before persistence",
    );
  }
  return out;
};

/**
 * LLM-aware variant: tries Anthropic when ANTHROPIC_API_KEY is set
 * AND the practitioner has a real bio (≥120 chars). Falls back to
 * the heuristic in every other case (no key, short bio, network
 * error, parse error, sub-3 entries returned).
 */
export const draftJournalEntriesWithLlm = async ({
  practitionerName,
  bio,
  specialties,
}: {
  practitionerName: string | null;
  bio: string | null;
  specialties: string[];
}): Promise<DraftedJournalEntry[]> => {
  const trimmedBio = (bio ?? "").trim();
  if (env.anthropicApiKey && trimmedBio.length >= 120) {
    const llm = await callAnthropicForJournal({
      practitionerName,
      bio: trimmedBio,
      specialties,
    });
    if (llm && llm.length >= 3) {
      const deduped = dedupJournalEntriesBySlug(llm, { practitionerName });
      // Only ship the LLM output when dedup leaves us with the full set.
      // If the AI produced fewer than 3 distinct entries, fall through to
      // the heuristic so the prospect doesn't see a half-empty journal.
      if (deduped.length >= 3) return deduped;
    }
  }
  return draftJournalEntries({ practitionerName, specialties });
};
