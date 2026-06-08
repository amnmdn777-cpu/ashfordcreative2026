import type { PreviewContent, TemplateKey } from "@workspace/api-zod";
import { pickSample, slugifyName } from "@site/templates/sampleContent";
import type { TemplateContent } from "@site/templates/types";

/**
 * Merge real, per-prospect data from the API into the template's neutral
 * SAMPLES placeholder so empty fields fall back to plausible defaults
 * rather than blanks. Per-field — never wholesale — so we only show
 * "Dr. Maya Alvarado"-style placeholder copy where the prospect literally
 * has no signal of their own.
 */
export function mergePreviewContent(
  templateKey: TemplateKey,
  locale: "en" | "es",
  remote: PreviewContent | null | undefined,
): TemplateContent {
  const sample = pickSample(templateKey, locale);
  if (!remote) return sample;

  const practiceName = (remote.practiceName ?? "").trim() || sample.practiceName;
  const tagline = (remote.tagline ?? "").trim() || sample.tagline;
  const mission = (remote.mission ?? "").trim() || sample.mission;
  const heroImage = remote.heroImage || sample.heroImage;

  // Services come back as {name, description} from the API. Description
  // may be null when we have no signal; templates already treat it as
  // optional supporting copy.
  const services =
    remote.services.length > 0
      ? remote.services.map((s) => ({
          name: s.name,
          description: s.description ?? "",
        }))
      : sample.services;

  // Team: promote real team entries. We do NOT fall back to sample
  // text fields (bio, credentials) under a real person's name —
  // that's how prospects ended up reading "Bilingual LCSW with 10+
  // years of trauma-informed practice" under "Tara Langston" when
  // Tara was a real LPC with a different specialty. Render-skip
  // empty bio/credentials at the template layer instead so we never
  // ship fabricated copy under verified identity.
  // Photo and structural fields (modalities/identities/pronouns)
  // CAN come from the sample because they're visual scaffolding
  // (avatar placeholder, badge layout) rather than copy that
  // misrepresents the person.
  const team =
    remote.team.length > 0
      ? remote.team.map((m, i) => {
          const fallback = sample.team[i] ?? sample.team[0]!;
          return {
            slug: slugifyName(m.name),
            name: m.name,
            credentials: (m.credentials ?? "").trim(),
            photo: m.photo || fallback.photo,
            bio: (m.bio ?? "").trim(),
            modalities: fallback.modalities,
            identities: fallback.identities,
            pronouns: fallback.pronouns,
          };
        })
      : sample.team;

  const reviews =
    remote.reviews.length > 0
      ? remote.reviews.map((r) => ({
          author: r.author,
          body: r.body,
          rating: r.rating,
          source: r.source,
        }))
      : sample.reviews;

  const locations =
    remote.locations.length > 0
      ? remote.locations.map((l, i) => {
          const fallback = sample.locations[i] ?? sample.locations[0]!;
          return {
            name: l.name || fallback.name,
            address: l.address || fallback.address,
            hours: l.hours.length > 0 ? l.hours : fallback.hours,
          };
        })
      : sample.locations;

  const contact = {
    ...sample.contact,
    phone: remote.contact.phone || sample.contact.phone,
    // Email and website fallbacks: only fill from sample if we have nothing.
    email: remote.contact.email || sample.contact.email,
    // Promote remote-discovered social profile URLs into the per-template
    // contact object so opting templates can render the icon strip with
    // the prospect's real handles. Falls back to the sample's defaults
    // when nothing was discovered, so existing template renderings don't
    // change for prospects without enrichment.
    instagram: remote.socialLinks?.instagram ?? sample.contact.instagram,
    facebook: remote.socialLinks?.facebook ?? sample.contact.facebook,
    linkedin: remote.socialLinks?.linkedin ?? sample.contact.linkedin,
    tiktok: remote.socialLinks?.tiktok ?? sample.contact.tiktok,
    youtube: remote.socialLinks?.youtube ?? sample.contact.youtube,
    psychologyToday:
      remote.socialLinks?.psychologyToday ?? sample.contact.psychologyToday,
    headway: remote.socialLinks?.headway ?? sample.contact.headway,
  };

  // Pass through the new public-source-first fields (specialties,
  // languages, insurance, testimonials, brand) when the API returned
  // them. Empty arrays / null fields stay undefined so opting
  // templates render their default sample, not an empty section.
  const insurance =
    remote.acceptedInsurances && remote.acceptedInsurances.length > 0
      ? remote.acceptedInsurances
      : sample.insurance;
  const specialties =
    remote.specialties && remote.specialties.length > 0
      ? remote.specialties
      : sample.specialties;
  const languages =
    remote.languages && remote.languages.length > 0
      ? remote.languages
      : sample.languages;
  const modalities =
    remote.modalities && remote.modalities.length > 0
      ? remote.modalities
      : sample.modalities;
  const testimonials =
    remote.testimonials && remote.testimonials.length > 0
      ? remote.testimonials.map((t) => ({ author: t.author, body: t.body }))
      : sample.testimonials;
  const brandHasSignal = !!(
    remote.brand?.logoUrl ||
    remote.brand?.accentColor ||
    remote.brand?.fontFamily
  );
  const brand = brandHasSignal
    ? {
        logoUrl: remote.brand?.logoUrl ?? null,
        faviconUrl: remote.brand?.faviconUrl ?? null,
        accentColor: remote.brand?.accentColor ?? null,
        fontFamily: remote.brand?.fontFamily ?? null,
      }
    : sample.brand;

  return {
    ...sample,
    practiceName,
    tagline,
    mission,
    heroImage,
    services,
    team,
    reviews,
    locations,
    contact,
    insurance,
    specialties,
    languages,
    modalities,
    testimonials,
    brand,
  };
}
