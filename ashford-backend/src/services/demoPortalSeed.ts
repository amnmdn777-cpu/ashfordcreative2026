import { db, leads, prospectPortals } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

/**
 * Slug + access token rendered by the public `/preview` page in
 * `artifacts/ashford-site/src/preview/PreviewIndex.tsx`. They are
 * intentionally public — the bookmarkable demo URL is the whole point.
 *
 * Keep these in sync with PreviewIndex.tsx.
 */
const DEMO_SLUG = "test-owner-smoke";
const DEMO_TOKEN = "127616648ee33fba24454e82ce24b26d";
const DEMO_PHONE = "+15125550199";

/**
 * Idempotent boot-time seeder for the public demo portal. Runs once per
 * process start; no-op if the demo portal already exists with the right
 * access token. Failures are logged but never crash the server — the
 * demo page is a nice-to-have, not a critical path.
 *
 * Why boot-time instead of a migration: the demo data is product content
 * (a fake therapist profile), not schema. Keeping it next to the slug
 * constant in PreviewIndex.tsx means a single edit ships the change to
 * every environment on the next deploy.
 */
export async function ensureDemoPortalSeeded(): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(prospectPortals)
      .where(eq(prospectPortals.slug, DEMO_SLUG))
      .limit(1);

    if (existing.length > 0) {
      const portal = existing[0]!;
      if (portal.accessToken !== DEMO_TOKEN) {
        await db
          .update(prospectPortals)
          .set({ accessToken: DEMO_TOKEN, updatedAt: new Date() })
          .where(eq(prospectPortals.id, portal.id));
        logger.info({ slug: DEMO_SLUG }, "demo-portal-seed: token refreshed");
      }
      return;
    }

    const existingLead = await db
      .select()
      .from(leads)
      .where(eq(leads.phone, DEMO_PHONE))
      .limit(1);

    let leadId: number;
    if (existingLead.length > 0) {
      leadId = existingLead[0]!.id;
    } else {
      const inserted = await db
        .insert(leads)
        .values({
          name: "Test Owner",
          practice: "Ashford Test Practice",
          specialty: "Therapist (LPC)",
          city: "Austin",
          state: "TX",
          phone: DEMO_PHONE,
          email: "demo@ashfordhealthcreative.com",
          locale: "en",
          currentWebsite: "https://example.com",
          profileBlurb:
            "Demo profile used for the public /preview page. Showcases the portal experience with default values.",
          status: "nurturing",
        })
        .returning({ id: leads.id });
      leadId = inserted[0]!.id;
    }

    await db.insert(prospectPortals).values({
      leadId,
      slug: DEMO_SLUG,
      accessToken: DEMO_TOKEN,
      selectedTemplate: "trauma_emdr",
      customizations: {
        headline: "Compassionate, evidence-based therapy in Austin",
        tagline: "EMDR · trauma · anxiety — bilingual EN/ES",
        about:
          "Test Owner is a licensed therapist in Austin, TX. This demo profile shows the boutique portal Ashford Creative builds for every Texas mental-health practitioner.",
      },
      enrichmentSnapshot: {
        source: "demo-portal-seed",
        seededAt: new Date().toISOString(),
      },
    });

    logger.info(
      { slug: DEMO_SLUG, leadId },
      "demo-portal-seed: created demo portal",
    );
  } catch (err) {
    logger.error({ err }, "demo-portal-seed: failed (non-fatal)");
  }
}
