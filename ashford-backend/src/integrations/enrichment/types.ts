/**
 * Common contract for any enrichment source. Sources should be small, single-
 * responsibility adapters that hit one upstream API and return one strongly-
 * typed `Candidate`. The orchestrator handles persistence, retries, and
 * confidence-based candidate merging.
 *
 * Adapters MUST soft-fail (return `null`) when their API key is missing or
 * the upstream returns nothing — never throw, since the orchestrator runs
 * sources in parallel and a single thrown adapter must not abort the others.
 */
export interface Candidate {
  /** Source-assigned confidence in 0-100. */
  confidence: number;
  /** Free-form short text (1-3 lines) describing what this source contributed. */
  summary?: string;
  /** Raw JSON payload, persisted verbatim for downstream consumers. */
  payload: Record<string, unknown>;
}

/**
 * Explicit rejection signal: the source ran successfully but
 * produced a result that we know is WRONG (wrong-business match,
 * identity mismatch, off-topic). Distinct from `null` (no data) so
 * the orchestrator can wipe any stale row from a previous run that
 * was matched before identity guards were strengthened — e.g. the
 * Tara/Rehab-Accomplished case where Google Places had a stale
 * wrong-match row that survived after the new identity gate
 * started rejecting it.
 */
export interface RejectedCandidate {
  __rejected: true;
  /** Human-readable reason; goes to logs and the optional admin
   * "why we dropped this" panel. */
  reason: string;
}

export type FetchResult = Candidate | RejectedCandidate | null;

/** Type guard for the rejected sentinel. */
export const isRejected = (
  v: FetchResult,
): v is RejectedCandidate =>
  !!v && typeof v === "object" && (v as RejectedCandidate).__rejected === true;

/** Helper to construct a rejection. */
export const rejectMatch = (reason: string): RejectedCandidate => ({
  __rejected: true,
  reason,
});

export interface LeadInput {
  id: number;
  name: string;
  practice: string;
  specialty: string;
  city: string;
  state: string;
  phone: string;
  email: string | null;
  currentWebsite: string | null;
  placeId: string | null;
}

export interface EnrichmentSource {
  /** Stable key persisted on `lead_enrichment.source_key`. */
  key: string;
  /** Human label for logs / admin UI. */
  label: string;
  /** True if the source is configured (e.g. API key present). */
  isConfigured(): boolean;
  /**
   * Run the source against a lead.
   *  - `Candidate` — upsert into `lead_enrichment`.
   *  - `null` — no data; preserve any existing row (a previous run
   *     that succeeded should not be wiped out by a transient
   *     network blip).
   *  - `RejectedCandidate` — the source DID run, found a candidate,
   *     but actively rejected it as wrong (identity mismatch,
   *     off-topic, etc.). The orchestrator deletes the existing
   *     row so stale wrong-data from before the rejection rule
   *     existed (Tara/Rehab Accomplished) gets cleaned up.
   */
  fetch(lead: LeadInput): Promise<FetchResult>;
}
