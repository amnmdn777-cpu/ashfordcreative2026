/**
 * [CLEANUP D.2] Editorial schedule seeder.
 *
 * Inserts 14 placeholder rows into `article_schedule` for a Concierge lead,
 * spread across 12 months at roughly 26-day intervals. The editor sees the
 * pending rows in the admin Editorial Queue and writes one piece per slot.
 *
 * A calendar of human reminders. The editor fills in the topic on the row
 * and types the article by hand.
 */
import { db, articleSchedule } from "@workspace/db";
import { logger } from "../lib/logger";

const SLOT_COUNT = 14;
const DAYS_BETWEEN_SLOTS = 26; // 14 × 26 ≈ 364 days, one full year of slots

const formatYmd = (d: Date): string => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export async function seedEditorialSchedule(
  leadId: number,
  startDate: Date = new Date(),
): Promise<{ inserted: number }> {
  if (!Number.isInteger(leadId) || leadId <= 0) {
    logger.warn({ leadId }, "[editorial-schedule] invalid leadId — skipped");
    return { inserted: 0 };
  }
  const rows = [] as Array<{
    leadId: number;
    dueDate: string;
    topicHint: string;
  }>;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const due = new Date(startDate);
    due.setUTCDate(due.getUTCDate() + i * DAYS_BETWEEN_SLOTS);
    rows.push({
      leadId,
      dueDate: formatYmd(due),
      topicHint: "Topic to be assigned",
    });
  }
  try {
    const inserted = await db
      .insert(articleSchedule)
      .values(rows)
      .returning({ id: articleSchedule.id });
    logger.info(
      { leadId, count: inserted.length },
      "[editorial-schedule] seeded",
    );
    return { inserted: inserted.length };
  } catch (err) {
    logger.error({ err, leadId }, "[editorial-schedule] seed failed");
    return { inserted: 0 };
  }
}
