import { db, pool, leads, prospectPortals } from "@workspace/db";
import { eq } from "drizzle-orm";

const DEMO_SLUG = "test-owner-smoke";
const DEMO_TOKEN = "127616648ee33fba24454e82ce24b26d";
const DEMO_PHONE = "+15125550199";

async function main() {
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
      console.log(`updated demo portal ${DEMO_SLUG} access token`);
    } else {
      console.log(`demo portal ${DEMO_SLUG} already exists, nothing to do`);
    }
    await pool.end();
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
    console.log(`reusing existing demo lead id=${leadId}`);
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
    console.log(`created demo lead id=${leadId}`);
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
      source: "demo-seed",
      seededAt: new Date().toISOString(),
    },
  });
  console.log(`created demo portal ${DEMO_SLUG} for lead ${leadId}`);

  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
