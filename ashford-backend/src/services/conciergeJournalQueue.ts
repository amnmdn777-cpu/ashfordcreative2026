import { logger } from "../lib/logger";

/**
 * LOT 3.1 — Concierge ghostwriter job queue SKELETON.
 *
 * No-op worker. Logs every enqueue + run and immediately marks the job
 * "complete" without producing any artifact. Replace the body of
 * `runJob` with the real pipeline once we sell our first Concierge
 * subscription.
 *
 * Real pipeline (TODO):
 *   1. Fetch the subscription's interview intake answers
 *   2. Call OpenAI/Anthropic with a tone-locked prompt
 *   3. Persist draft to `concierge_journal_jobs.draft_md`
 *   4. Email editor-in-chief for review
 *   5. On approval, auto-translate EN→ES, then publish to blog table
 *   6. Notify subscriber, schedule next month
 */

export type ConciergeJournalJob = {
  id: string;
  subscriptionId: number;
  postNumber: number; // 1..14
  kind: "launch_seed" | "monthly";
};

/**
 * In-memory stub queue. A real implementation would use a `concierge_journal_jobs`
 * DB table + a cron worker. For now we just log.
 */
const inMemoryQueue: ConciergeJournalJob[] = [];

export function enqueueConciergeJournalJob(job: ConciergeJournalJob): void {
  // TODO(concierge-ghostwriter): persist to DB instead of memory
  inMemoryQueue.push(job);
  logger.info(
    { job },
    "[concierge-journal] enqueued (no-op stub)",
  );
}

export async function runJob(job: ConciergeJournalJob): Promise<void> {
  // TODO(concierge-ghostwriter): real pipeline
  logger.info(
    { jobId: job.id, subscriptionId: job.subscriptionId },
    "[concierge-journal] run (no-op stub)",
  );
}

export function listPendingJobs(): ConciergeJournalJob[] {
  return [...inMemoryQueue];
}
