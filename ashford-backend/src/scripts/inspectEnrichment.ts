/**
 * Diagnostic: dump every `lead_enrichment` row for a single lead so we
 * can see which sources actually returned data versus which silently
 * failed. Used to debug "the prospect preview shows sample content" —
 * tells us at a glance whether Headway/PT scraped or returned null.
 *
 * Usage on Replit (or any env with DATABASE_URL):
 *   pnpm --filter @workspace/api-server exec tsx \
 *     src/scripts/inspectEnrichment.ts <leadId>
 *
 * Or by name search (case-insensitive):
 *   pnpm --filter @workspace/api-server exec tsx \
 *     src/scripts/inspectEnrichment.ts --name "Tara Langston"
 */
import { db, leadEnrichment, leads } from "@workspace/db";
import { eq, ilike, desc } from "drizzle-orm";

const arg = process.argv[2];
const nameArg = process.argv[2] === "--name" ? process.argv[3] : null;

const main = async () => {
  let lead: typeof leads.$inferSelect | null = null;

  if (nameArg) {
    const [row] = await db
      .select()
      .from(leads)
      .where(ilike(leads.name, `%${nameArg}%`))
      .limit(1);
    lead = row ?? null;
  } else if (arg && /^\d+$/.test(arg)) {
    const [row] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, Number(arg)))
      .limit(1);
    lead = row ?? null;
  } else {
    console.error(
      "Usage: inspectEnrichment.ts <leadId>\n   or  inspectEnrichment.ts --name '<name>'",
    );
    process.exit(1);
  }

  if (!lead) {
    console.error("Lead not found.");
    process.exit(1);
  }

  console.log("=== LEAD ===");
  console.log({
    id: lead.id,
    name: lead.name,
    practice: lead.practice,
    city: lead.city,
    state: lead.state,
    currentWebsite: lead.currentWebsite,
    specialty: lead.specialty,
    phone: lead.phone,
    email: lead.email,
  });
  console.log("");

  const rows = await db
    .select()
    .from(leadEnrichment)
    .where(eq(leadEnrichment.leadId, lead.id))
    .orderBy(desc(leadEnrichment.fetchedAt));

  console.log(`=== ENRICHMENT (${rows.length} rows) ===`);
  if (rows.length === 0) {
    console.log("No enrichment rows. Run the orchestrator for this lead.");
    process.exit(0);
  }

  for (const r of rows) {
    const payload = r.payload as Record<string, unknown> | null;
    const payloadKeys = payload ? Object.keys(payload).slice(0, 12) : [];
    const photoHint = payload
      ? extractPhotoHint(payload)
      : null;
    const nameHint = payload ? extractNameHint(payload) : null;
    console.log(`--- ${r.sourceKey} (confidence ${r.confidence}) ---`);
    console.log(`  fetchedAt:  ${r.fetchedAt.toISOString()}`);
    console.log(`  summary:    ${r.summary ?? "(none)"}`);
    console.log(`  payloadKeys: ${payloadKeys.join(", ")}`);
    if (nameHint) console.log(`  matched name: ${nameHint}`);
    if (photoHint) console.log(`  photo URL:   ${photoHint}`);
    console.log("");
  }

  // Quick health summary at the bottom — what the preview pipeline
  // can actually use for Tara-style "Pulled from your public profile".
  console.log("=== PREVIEW READINESS ===");
  const have = (key: string) => rows.some((r) => r.sourceKey === key);
  const has = {
    google_places: have("google_places"),
    headway: have("headway"),
    psychology_today: have("psychology_today"),
    npi_registry: have("npi_registry"),
    website_meta: have("website_meta"),
    website_content_apify: have("website_content_apify"),
    current_website_pages: have("current_website_pages"),
    ai_synthesis: have("ai_synthesis"),
  };
  for (const [k, v] of Object.entries(has)) {
    console.log(`  ${v ? "✓" : "✗"} ${k}`);
  }

  process.exit(0);
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const extractPhotoHint = (
  payload: Record<string, unknown>,
): string | null => {
  // Direct fields the merge layer reads.
  for (const k of ["photoUrl", "imageUrl", "image", "photo", "hero"]) {
    const v = payload[k];
    if (typeof v === "string" && v.startsWith("http")) return v;
  }
  // Headway/PT nest the photo under .profile or first-team.
  if (isRecord(payload.profile)) {
    for (const k of ["photoUrl", "imageUrl", "photo", "image"]) {
      const v = payload.profile[k];
      if (typeof v === "string" && v.startsWith("http")) return v;
    }
  }
  if (Array.isArray(payload.teamStructured)) {
    for (const t of payload.teamStructured) {
      if (isRecord(t) && typeof t.photo === "string" && t.photo.startsWith("http")) {
        return t.photo;
      }
    }
  }
  return null;
};

const extractNameHint = (
  payload: Record<string, unknown>,
): string | null => {
  if (typeof payload.name === "string") return payload.name;
  if (typeof payload.fullName === "string") return payload.fullName;
  if (isRecord(payload.profile)) {
    if (typeof payload.profile.name === "string") return payload.profile.name;
    if (typeof payload.profile.fullName === "string")
      return payload.profile.fullName;
  }
  return null;
};

main().catch((err) => {
  console.error("Diagnostic failed:", err);
  process.exit(1);
});
