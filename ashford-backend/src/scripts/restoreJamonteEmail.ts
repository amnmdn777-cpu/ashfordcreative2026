/**
 * One-shot repair: restore Jamonte Banks' email address (and any other
 * lead whose email was wiped by the override-persistence bug fixed in
 * #225). The previous /generate-link route accepted an empty
 * `emailOverride` from the modal and persisted it onto the lead row,
 * blanking out the original PT email.
 *
 * Strategy: for any lead whose `email` column is NULL but whose latest
 * `psychology_today` enrichment payload contains a `top.emails`
 * comma-separated list, re-derive the canonical email using the same
 * `pickEmail` rule the importer uses (skip headway/partnerships
 * addresses, prefer the personal one) and write it back.
 *
 * Idempotent — re-running on a healed lead is a no-op.
 *
 * Run:   pnpm --filter @workspace/api-server tsx \
 *          src/scripts/restoreJamonteEmail.ts            # dry run
 *        pnpm --filter @workspace/api-server tsx \
 *          src/scripts/restoreJamonteEmail.ts --apply    # writes
 */
import { and, desc, eq, ilike } from "drizzle-orm";
import { db, leads, leadEnrichment, pool } from "@workspace/db";

// Internal Ashford addresses that the override-persistence bug could
// have written onto leads. Used as the SAFETY GUARD per task #225 —
// we only touch leads whose saved email is clearly an internal one.
const INTERNAL_EMAIL = /@ashford(creative)?\.(co|studio|com)$|@candice\./i;

// Importer-equivalent rules (mirror of importLeads.ts pickEmail) so a
// restored value matches what the original PT import would have chosen.
const GENERIC_EMAIL_DOMAINS = new Set([
  "headway.co",
  "lifestance.com",
  "growtherapy.com",
  "alma.com",
  "helloalma.com",
  "rula.com",
  "talkiatry.com",
  "betterhelp.com",
  "talkspace.com",
]);
const GENERIC_EMAIL_PREFIXES = new Set([
  "support",
  "info",
  "partnerships",
  "billing",
  "concerns",
  "insurance",
  "magellan",
  "magellan.support",
  "noreply",
  "no-reply",
  "donotreply",
]);
const JUNK_EMAIL_SUFFIXES = [".webp", ".png", ".jpg", ".jpeg", ".svg", ".gif"];

const pickEmail = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  for (const candidate of raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    const lower = candidate.toLowerCase();
    if (!lower.includes("@")) continue;
    if (JUNK_EMAIL_SUFFIXES.some((s) => lower.endsWith(s))) continue;
    const [prefix, domain] = lower.split("@");
    if (!domain || !domain.includes(".")) continue;
    if (GENERIC_EMAIL_DOMAINS.has(domain)) continue;
    if (GENERIC_EMAIL_PREFIXES.has(prefix)) continue;
    return candidate;
  }
  return null;
};

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  // SAFETY GUARD per task #225: only target leads whose saved email is
  // an internal Ashford address AND whose source is `psychology_today`.
  // This is the unambiguous fingerprint of the override-persistence
  // bug — a real prospect should never have an @ashford.* email saved.
  // Any lead with a non-internal email is left alone (idempotent).
  const candidates = await db
    .select({
      id: leads.id,
      name: leads.name,
      email: leads.email,
      source: leads.source,
    })
    .from(leads)
    .where(
      and(
        eq(leads.source, "psychology_today"),
        ilike(leads.email, "%@ashford%"),
      ),
    );
  const empties = candidates.filter(
    (l) => l.email && INTERNAL_EMAIL.test(l.email),
  );
  // eslint-disable-next-line no-console
  console.log(
    `[restore-email] ${empties.length} PT-source leads with internal Ashford email`,
  );

  const updates: Array<{ id: number; name: string; email: string }> = [];
  for (const lead of empties) {
    const rows = await db
      .select()
      .from(leadEnrichment)
      .where(eq(leadEnrichment.leadId, lead.id))
      .orderBy(desc(leadEnrichment.fetchedAt));
    const pt = rows.find((r) => r.sourceKey === "psychology_today");
    if (!pt || typeof pt.payload !== "object" || pt.payload === null) continue;
    const profile = (pt.payload as Record<string, unknown>).profile as
      | Record<string, unknown>
      | undefined;
    const rawEmails =
      (profile && typeof profile.emails === "string" ? profile.emails : null) ??
      (profile && typeof profile.email === "string" ? profile.email : null);
    const email = pickEmail(rawEmails);
    if (!email) continue;
    updates.push({ id: lead.id, name: lead.name, email });
  }

  for (const u of updates) {
    // eslint-disable-next-line no-console
    console.log(`  lead #${u.id} (${u.name}) ← ${u.email}`);
  }
  if (!apply) {
    // eslint-disable-next-line no-console
    console.log("[restore-email] dry run — pass --apply to write");
    await pool.end();
    return;
  }
  for (const u of updates) {
    await db
      .update(leads)
      .set({ email: u.email, updatedAt: new Date() })
      .where(eq(leads.id, u.id));
  }
  // eslint-disable-next-line no-console
  console.log(`[restore-email] restored email on ${updates.length} leads`);
  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[restore-email] failed:", err);
  process.exit(1);
});
