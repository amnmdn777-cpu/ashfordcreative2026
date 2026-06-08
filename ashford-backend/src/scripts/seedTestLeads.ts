/**
 * Idempotent seed for the three pre-launch demo leads (Sarah Chen,
 * James Miller, Elena Rodriguez). Safe to re-run — keyed on email,
 * SELECT then UPDATE-or-INSERT. Status always reset to "available"
 * so the demo dashboard always shows them claimable.
 *
 * Phones use the +1-555-01XX NANP test block; emails use +demo@
 * aliases on ashfordcreative.org so any outbound is observable.
 *
 * Usage: pnpm --filter @workspace/api-server exec tsx \
 *   src/scripts/seedTestLeads.ts
 */
import { db, leads } from "@workspace/db";
import { eq } from "drizzle-orm";

type TestLeadSpec = {
  name: string;
  practice: string;
  specialty: string;
  city: string;
  phone: string;
  email: string;
  locale: "en" | "es";
  currentWebsite: string | null;
  profileBlurb: string;
};

const TEST_LEADS: TestLeadSpec[] = [
  {
    name: "Dr. Sarah Chen",
    practice: "Skyline Mental Health",
    specialty: "Anxiety & OCD Specialist",
    city: "Austin",
    phone: "+15125550143",
    email: "sarah.chen+demo@ashfordcreative.org",
    locale: "en",
    currentWebsite: "https://skylinementalhealth.squarespace.com",
    profileBlurb:
      "Dr. Sarah Chen runs Skyline Mental Health out of South Austin, where she focuses on " +
      "evidence-based treatment for anxiety, panic, and OCD using ERP and CBT. After nine " +
      "years on a Squarespace template, she wants a calm bilingual page that actually reads " +
      "like her practice — not a directory listing. Her ideal first-call client is a working " +
      "professional in their 30s who has been white-knuckling it for years and finally Googled " +
      "the right thing at 11pm. She is open to expanding to 2-3 clinicians in the next year.",
  },
  {
    name: "James Miller, LPC",
    practice: "Miller Family Counseling",
    specialty: "Marriage & Family Therapy",
    city: "Dallas",
    phone: "+12145550188",
    email: "james.miller+demo@ashfordcreative.org",
    locale: "en",
    currentWebsite: null,
    profileBlurb:
      "James Miller is a Licensed Professional Counselor in North Dallas who has built his " +
      "entire caseload from a Psychology Today profile alone. He has no website at all and " +
      "knows that's costing him the higher-fit couples work he wants more of. Specializes in " +
      "Gottman-method couples therapy and pre-marital counseling. Wants something boutique, " +
      "warm, no jargon — and he wants it shipped, not designed by committee.",
  },
  {
    name: "Elena Rodriguez",
    practice: "Rodriguez Wellness Group",
    specialty: "Bilingual Child Psychology",
    city: "Houston",
    phone: "+17135550212",
    email: "elena.rodriguez+demo@ashfordcreative.org",
    locale: "es",
    currentWebsite: "https://rodriguezwellnessgroup.com",
    profileBlurb:
      "Elena Rodriguez dirige Rodriguez Wellness Group en Houston, una práctica multidisciplinaria " +
      "de cinco clínicas especializadas en psicología infantil y de adolescentes bilingüe. " +
      "El 70% de sus pacientes hablan español en casa y rebotan de los sitios solo en inglés. " +
      "Considera la plantilla Atrium para reflejar el tamaño del grupo, pero quiere que la " +
      "voz se sienta personal — no corporativa. Necesita el sitio listo antes del semestre " +
      "escolar de otoño.",
  },
];

async function upsertLead(spec: TestLeadSpec): Promise<"inserted" | "updated"> {
  const existing = await db
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.email, spec.email))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(leads)
      .set({
        name: spec.name,
        practice: spec.practice,
        specialty: spec.specialty,
        city: spec.city,
        state: "TX",
        phone: spec.phone,
        locale: spec.locale,
        currentWebsite: spec.currentWebsite,
        profileBlurb: spec.profileBlurb,
        status: "available",
        claimedByRepId: null,
        claimedAt: null,
        claimExpiresAt: null,
        source: "apify_import",
        updatedAt: new Date(),
      })
      .where(eq(leads.id, existing[0].id));
    return "updated";
  }

  await db.insert(leads).values({
    name: spec.name,
    practice: spec.practice,
    specialty: spec.specialty,
    city: spec.city,
    state: "TX",
    phone: spec.phone,
    email: spec.email,
    locale: spec.locale,
    currentWebsite: spec.currentWebsite,
    profileBlurb: spec.profileBlurb,
    status: "available",
    source: "apify_import",
  });
  return "inserted";
}

async function main(): Promise<void> {
  console.log(`seedTestLeads: upserting ${TEST_LEADS.length} test leads…`);
  let inserted = 0;
  let updated = 0;
  for (const spec of TEST_LEADS) {
    const result = await upsertLead(spec);
    if (result === "inserted") inserted++;
    else updated++;
    console.log(`  ${result.padEnd(8)}  ${spec.name.padEnd(22)} ${spec.email}`);
  }
  console.log(`done — inserted ${inserted}, updated ${updated}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("seedTestLeads failed:", err);
  process.exit(1);
});
