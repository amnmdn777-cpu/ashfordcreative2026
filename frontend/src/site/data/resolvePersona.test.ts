import { describe, expect, test } from "vitest";
import { resolvePersona } from "./resolvePersona";
import { PERSONAS } from "./personas";
import type { TemplateContent } from "@site/templates/types";
import { SAMPLES } from "@site/templates/sampleContent";

/**
 * Builds a barebones TemplateContent for tests that only care about
 * a few fields. The omitted fields are filled with empty defaults so
 * Zod-typed consumers don't crash on undefined access.
 */
// Default practiceName is empty so tests that don't override it
// represent a truly "absent" lead — the resolver treats any non-empty
// practiceName on non-sample content as a real practice-only prospect,
// which would mask persona-fallback behavior the early tests are
// trying to assert.
function buildContent(over: Partial<TemplateContent>): TemplateContent {
  return {
    practiceName: over.practiceName ?? "",
    tagline: over.tagline ?? "",
    mission: over.mission ?? "",
    heroImage: over.heroImage ?? "",
    services: over.services ?? [],
    team: over.team ?? [],
    reviews: over.reviews ?? [],
    locations: over.locations ?? [],
    contact: over.contact ?? { phone: "", email: "" },
    addons: over.addons ?? [],
    insurance: over.insurance,
  };
}

describe("resolvePersona", () => {
  test("empty non-sample content → persona wins for editorial fields, clinician identity suppressed", () => {
    const r = resolvePersona("garden", { content: buildContent({}) });
    // Empty buildContent() is "practice-only with no data": the resolver
    // refuses to print persona-specific clinician identity (name leaks,
    // credentials, portrait) but still uses the persona's editorial
    // copy (focus areas, fees, insurance) so the gallery surface
    // doesn't render blank tiles.
    expect(r.isLead).toBe(false);
    expect(r.name).toBe(PERSONAS.garden.name);
    expect(r.credentials).toBe("");
    expect(r.portraitSrc).toBe("");
    expect(r.focus_areas).toEqual(PERSONAS.garden.focus_areas);
    expect(r.fees).toEqual(PERSONAS.garden.fees);
    expect(r.insurance).toEqual(PERSONAS.garden.insurance);
  });

  test("lead === sampleContent → treated as no lead, persona wins", () => {
    const r = resolvePersona("garden", { content: SAMPLES.garden });
    expect(r.isLead).toBe(false);
    expect(r.name).toBe(PERSONAS.garden.name);
    expect(r.bio_en).toBe(PERSONAS.garden.bio_en);
    // sample's services exist but should be ignored for editorial copy
    expect(r.focus_areas).toEqual(PERSONAS.garden.focus_areas);
  });

  test("lead present → real prospect data wins, field by field", () => {
    const lead = buildContent({
      team: [{
        slug: "kim-park",
        name: "Dr. Kim Park",
        credentials: "PhD, LP",
        photo: "/images/leads/kim-park.jpg",
        bio: "I work with adults navigating burnout and identity transitions.",
        modalities: ["ACT", "CBT"],
      }],
      services: [
        { name: "Burnout recovery", description: "Slow work for fast people." },
        { name: "Identity transitions", description: "For the in-between seasons." },
      ],
      insurance: ["Aetna", "United"],
    });
    // Stamp pricingTiers onto the content like previewContent does.
    (lead as unknown as { pricingTiers: { amount: number | null; label: string }[] })
      .pricingTiers = [
        { amount: null, label: "Initial consult" },
        { amount: 220, label: "Individual session (50 min)" },
      ];

    const r = resolvePersona("garden", { content: lead });
    expect(r.isLead).toBe(true);
    expect(r.name).toBe("Dr. Kim Park");
    expect(r.credentials).toBe("PhD, LP");
    expect(r.portraitSrc).toBe("/images/leads/kim-park.jpg");
    expect(r.bio_en).toContain("burnout");
    expect(r.bio_es).toContain("burnout"); // lead bio reused for both locales
    expect(r.focus_areas).toHaveLength(2);
    expect(r.focus_areas[0]).toEqual({
      title: "Burnout recovery",
      body: "Slow work for fast people.",
    });
    expect(r.fees).toEqual([
      { label: "Initial consult", price: "Free" },
      { label: "Individual session (50 min)", price: "$220" },
    ]);
    expect(r.insurance).toEqual(["Aetna", "United"]);
  });

  test("partial lead (only name set) → name from lead, rest from persona", () => {
    const lead = buildContent({
      team: [{
        slug: "j-doe",
        name: "Dr. J. Doe",
        credentials: "",
        photo: "",
        bio: "",
        modalities: [],
      }],
    });
    const r = resolvePersona("garden", { content: lead });
    expect(r.isLead).toBe(true);
    expect(r.name).toBe("Dr. J. Doe");
    // Empty fields on the lead must fall through to the persona —
    // *except* bio, which the resolver now synthesizes from the lead's
    // own pieces (firstName + city + practice) rather than leaking the
    // persona stub onto a real prospect's preview (the "Maya leaked
    // into Zach's preview" regression).
    expect(r.credentials).toBe(PERSONAS.garden.credentials);
    expect(r.portraitSrc).toBe(PERSONAS.garden.photo_url);
    expect(r.bio_en).not.toBe(PERSONAS.garden.bio_en);
    expect(r.bio_en).toBeTruthy();
    expect(r.focus_areas).toEqual(PERSONAS.garden.focus_areas);
    expect(r.fees).toEqual(PERSONAS.garden.fees);
    expect(r.insurance).toEqual(PERSONAS.garden.insurance);
  });

  test("portal-derived contact fields always come from props.content", () => {
    const lead = buildContent({
      practiceName: "Bluebonnet Counseling",
      contact: { phone: "(555) 123-4567", email: "hi@example.com" },
      locations: [{
        name: "Office",
        address: "123 Main St, Suite 4, Austin, TX 78701",
        hours: [],
      }],
    });
    // Practice-only previews gate emails to domains the practice
    // plausibly owns (the rep's domainSuggestions list). Without a
    // matching suggestion, hi@example.com would be stripped as
    // probably-not-the-prospect.
    (lead as unknown as {
      domainSuggestions: { domain: string; available: boolean }[];
    }).domainSuggestions = [{ domain: "example.com", available: true }];
    const r = resolvePersona("garden", { content: lead });
    expect(r.phone).toBe("(555) 123-4567");
    expect(r.phoneHref).toBe("tel:5551234567");
    expect(r.email).toBe("hi@example.com");
    expect(r.addressLine1).toBe("123 Main St, Suite 4");
    expect(r.addressLine2).toBe("Austin, TX 78701");
  });

  test("unknown templateKey falls back to garden", () => {
    const r = resolvePersona("nonexistent_key", { content: buildContent({}) });
    expect(r.name).toBe(PERSONAS.garden.name);
  });

  test("locale-aware bios — bio_en / bio_es win over the deprecated alias", () => {
    const lead = buildContent({
      team: [{
        slug: "kim-park",
        name: "Dr. Kim Park",
        credentials: "PhD, LP",
        photo: "/images/leads/kim-park.jpg",
        bio: "FALLBACK_BIO",
        bio_en: "English bio for Kim.",
        bio_es: "Biografía en español para Kim.",
        modalities: ["ACT"],
      }],
    });
    const r = resolvePersona("garden", { content: lead });
    expect(r.bio_en).toBe("English bio for Kim.");
    expect(r.bio_es).toBe("Biografía en español para Kim.");
  });

  test("locale-aware bios — partial locale falls through to alias for the missing one", () => {
    const lead = buildContent({
      team: [{
        slug: "kim-park",
        name: "Dr. Kim Park",
        credentials: "PhD, LP",
        photo: "/images/leads/kim-park.jpg",
        // EN-only lead: provides bio_en + the legacy bio alias, no bio_es.
        bio: "FALLBACK_BIO",
        bio_en: "English bio for Kim.",
        modalities: ["ACT"],
      }],
    });
    const r = resolvePersona("garden", { content: lead });
    expect(r.bio_en).toBe("English bio for Kim.");
    // ES falls back to the legacy alias (better than persona Spanish stub).
    expect(r.bio_es).toBe("FALLBACK_BIO");
  });

  test("locale-aware bios — neither locale set, only deprecated alias → both locales use it", () => {
    const lead = buildContent({
      team: [{
        slug: "kim-park",
        name: "Dr. Kim Park",
        credentials: "PhD, LP",
        photo: "/images/leads/kim-park.jpg",
        bio: "Legacy locale-less bio.",
        modalities: ["ACT"],
      }],
    });
    const r = resolvePersona("garden", { content: lead });
    expect(r.bio_en).toBe("Legacy locale-less bio.");
    expect(r.bio_es).toBe("Legacy locale-less bio.");
  });

  // Regression: Headway / Psychology Today scrapers sometimes capture a
  // directory brand H1 ("Care", "Headway", "Psychology Today") as the
  // practitioner's name. The portal preview must never render
  // "Hi I'm Care" — resolvePersona() should treat those as junk and
  // either recover a real first name from the bio or fall through to
  // the persona / practice name.
  describe("brand-name contamination guard", () => {
    const BRANDS = [
      "Care",
      "Headway",
      "Psychology Today",
      "psychologytoday",
      "PSYCH TODAY",
      "Alma",
      "Talkspace",
      "BetterHelp",
      "Zocdoc",
      "Healthgrades",
    ];

    for (const junk of BRANDS) {
      test(`team H1 "${junk}" never reaches firstName`, () => {
        const lead = buildContent({
          practiceName: "Bluebonnet Counseling",
          team: [{
            slug: "x",
            name: junk,
            credentials: "",
            photo: "",
            bio: "",
            modalities: [],
          }],
        });
        const r = resolvePersona("garden", { content: lead });
        expect(r.firstName.toLowerCase()).not.toBe(junk.toLowerCase());
        expect(r.firstName).not.toMatch(/^(care|headway|psych)/i);
      });
    }

    test("recovers real first name from bio when team name is a brand", () => {
      const lead = buildContent({
        practiceName: "Bluebonnet Counseling",
        team: [{
          slug: "x",
          name: "Psychology Today",
          credentials: "LPC",
          photo: "",
          bio: "Hi, I'm Joanna and I work with adults navigating burnout.",
          modalities: [],
        }],
      });
      const r = resolvePersona("garden", { content: lead });
      expect(r.firstName).toBe("Joanna");
    });
  });
});
