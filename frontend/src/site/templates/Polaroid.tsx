import React from "react";
import {
  About, BookingCta, CrisisBanner, Faq, Fees, Footer, Hero, Services,
} from "@site/components/sections";
import { CommonExtras } from "./_commonExtras";
import { FeatureMark } from "@site/components/demo/FeatureBadge";
import { ThemeProvider } from "@site/components/ThemeProvider";
import { TierGate } from "@site/components/TierGate";
import { useI18n } from "@site/lib/i18n";
import { resolvePersona } from "@site/data/resolvePersona";
import type { TemplateProps } from "./types";
import { SocialRow } from "./SocialRow";
import { InsuranceBadges } from "./_wow";
import {
  Cta, FooterSignature, LinenBackground, PolaroidStack, ScriptAccent, TopBar,
  type PolaroidPhoto,
} from "./polaroid/skin";

/**
 * Polaroid — Phase 2 port. Tactile / personal voice template.
 *
 * Persona: Maya Alvarado, LCSW (East Austin) · EMDR + IFS + somatic.
 * Deep teal palette, Playfair Display display, Inter body, Caveat
 * script accent. Hero is image-right with a tilted polaroid stack
 * (3 photos, masking-tape SVG corners, Caveat captions).
 *
 * Composition only — chrome lives in `./polaroid/skin.tsx`. The hero
 * CTA carries `text-white` AND inline `color:#fff` so the gray-pill
 * regression from the Phase 0 hotfix can't recur.
 */
function Polaroid(props: TemplateProps) {
  const { locale, t } = useI18n();
  const r = resolvePersona("polaroid", props);
  const fn = (s: string) => s.replace(/\{firstName\}/g, r.firstName || (locale === "es" ? "nuestra consulta" : "this practice"));
  const bio = locale === "es" ? r.bio_es : r.bio_en;
  const bioParas = bio.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  // A1 (founder 2026-05-19): never let the stock chair / mug / plant
  // stack leak onto a real prospect preview. If we have a real
  // practitioner photo, allow the stack; otherwise we drop it.
  const hasRealPhoto = !!(r.portraitSrc && !r.portraitSrc.startsWith("/images/templates/"));
  const allowStockStack = !r.isReal || hasRealPhoto;
  const photos: PolaroidPhoto[] = !allowStockStack ? [] : [
    {
      // `src` is now the base path (no extension) — the ResponsivePicture
      // primitive consumed by PolaroidStack expands it into .webp@1x/2x +
      // .jpg per scripts/optimize-hero-photos.ts. The originals are real
      // photos (chair + teal throw + speckled mug) generated via Gemini
      // Nano Banana and de-watermarked in the optimize pipeline.
      src: "/images/templates/polaroid/photo-1",
      alt: t("polaroid_photo_1_alt"),
      caption: locale === "es" ? "la oficina" : "the office",
      rotate: -6,
      offset: { top: 0, left: 0 },
      tape: [{ position: "top-center", rotate: -3 }],
    },
    {
      src: "/images/templates/polaroid/photo-2",
      alt: t("polaroid_photo_2_alt"),
      caption: locale === "es" ? "luz de mañana" : "morning light",
      rotate: 5,
      offset: { top: 60, left: 130 },
      tape: [{ position: "top-left", rotate: -12 }, { position: "bottom-left", rotate: -6 }],
    },
    {
      src: "/images/templates/polaroid/photo-3",
      alt: t("polaroid_photo_3_alt"),
      caption: locale === "es" ? "pasa adelante" : "welcome in",
      rotate: -3,
      offset: { top: 160, left: 40 },
      tape: [{ position: "top-right", rotate: 10 }],
    },
  ];

  return (
    <ThemeProvider templateKey="polaroid">
      <LinenBackground />
      <TopBar
        name={r.name}
        bookingUrl={r.bookingUrl}
        bookingLabel={t("polaroid_top_cta")}
      />

      <Hero
        eyebrow={r.heroEyebrow?.[locale] ?? t("polaroid_hero_eyebrow")}
        headline={
          r.heroHeadline?.[locale] ?? (
            <>
              {t("polaroid_hero_headline")}
              <br />
              <ScriptAccent>{fn(t("polaroid_hero_signature"))}</ScriptAccent>
            </>
          )
        }
        subhead={r.heroSubhead?.[locale] ?? t("polaroid_hero_subhead")}
        primaryCta={<Cta href={r.bookingUrl} size="lg">{t("polaroid_hero_cta")}</Cta>}
        layout="image-right"
        media={<PolaroidStack photos={photos} />}
      />

      {/* BATCH 5: Polaroid sequences as "meet me / what I do / who I
          see / how to start". Bio FIRST (first-person letter), then
          services, then logistics. The polaroid-stack hero IS the
          first impression — the page reads like a Sunday note pinned
          to a corkboard. */}
      <About
        photo={r.portraitSrc}
        photoAlt={r.name}
        name={r.name}
        credentials={r.credentials}
        body={bioParas.length > 0 ? bioParas : [bio]}
        heading={fn(t("polaroid_about_heading"))}
        quote={{ text: t("polaroid_about_quote") }}
        imageSide="left"
      />

      <Services
        heading={t("polaroid_services_heading")}
        subhead={t("polaroid_services_subhead")}
        items={r.focus_areas}
        columns={3}
      />

      <FeatureMark featureKey="insurance_sliding_scale">
      <Fees
        heading={t("polaroid_fees_heading")}
        items={r.fees}
        note={t("polaroid_fees_note")}
        aside={
          <div>
            <h3 className="text-xl mb-4" style={{ fontFamily: "var(--font-display)" }}>
              {t("polaroid_insurance_heading")}
            </h3>
            <InsuranceBadges insurances={r.insuranceList} tone="dark" />
          </div>
        }
      />
      </FeatureMark>

      <Faq
        heading={t("polaroid_faq_heading")}
        items={[
          { q: t("polaroid_faq_q1"), a: t("polaroid_faq_a1") },
          { q: t("polaroid_faq_q2"), a: t("polaroid_faq_a2") },
          { q: t("polaroid_faq_q3"), a: t("polaroid_faq_a3") },
          { q: t("polaroid_faq_q4"), a: t("polaroid_faq_a4") },
        ]}
      />

      <CommonExtras r={r} />

      <TierGate min="pro" silent>{props.tail}</TierGate>{/* CRITICAL #4 */}

      <BookingCta
        mode="external"
        href={r.bookingUrl}
        label={t("polaroid_hero_cta")}
        heading={t("polaroid_booking_heading")}
        subhead={t("polaroid_booking_subhead")}
        secondary={t("polaroid_booking_secondary")}
      />

      <FeatureMark featureKey="social_row">
      <Footer
        name={r.name}
        credentials={[r.credentials, `${r.city}, ${r.state}`].filter(Boolean).join(" · ")}
        license={r.license_number}
        phone={r.phone}
        email={r.email}
        address={r.addressLine2 ? [r.addressLine1, r.addressLine2] : r.addressLine1}
        rightsReserved={locale === "es" ? "Todos los derechos reservados." : "All rights reserved."}
        social={
          <SocialRow
            contact={r.contact}
            tone="light"
            size="compact"
            label={locale === "es" ? "Síguenos" : "Follow us"}
          />
        }
        tail={
          <span style={{ fontFamily: "var(--font-body)" }}>
            {t("polaroid_footer_design_by")}
            <FooterSignature name="Ashford Creative" />
          </span>
        }
      />
      </FeatureMark>

      <CrisisBanner
        prefix={locale === "es" ? "¿En crisis?" : "In crisis?"}
        label={locale === "es" ? "Línea 988 de Crisis y Suicidio · 24/7" : "988 Suicide & Crisis Lifeline · 24/7"}
      />
    </ThemeProvider>
  );
}

export default Polaroid;
