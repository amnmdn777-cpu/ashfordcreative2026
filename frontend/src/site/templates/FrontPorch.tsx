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
import { ResponsivePicture } from "@site/components/photo/ResponsivePicture";
import {
  Cta, FooterSignature, SepiaPhoto, TopBar, WoodGrainEdge,
} from "./front_porch/skin";

/**
 * Front Porch — Phase 3 new template.
 *
 * Persona: Marcus Holloway, LMFT (San Antonio · Stone Oak).
 * Cedar / terracotta / butter palette, Fraunces display + Inter body.
 * Hero is image-right with a wood-grain edge motif and a sepia-toned
 * portrait. Composition only — chrome lives in `./front_porch/skin.tsx`.
 */
function FrontPorch(props: TemplateProps) {
  const { locale, t } = useI18n();
  const r = resolvePersona("front_porch", props);
  const fn = (s: string) => s.replace(/\{firstName\}/g, r.firstName || (locale === "es" ? "nuestra consulta" : "this practice"));
  const bio = locale === "es" ? r.bio_es : r.bio_en;
  const bioParas = bio.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <ThemeProvider templateKey="front_porch">
      <TopBar
        name={r.name}
        bookingUrl={r.bookingUrl}
        bookingLabel={t("fp_top_cta")}
      />

      <Hero
        eyebrow={r.heroEyebrow?.[locale] ?? t("fp_hero_eyebrow")}
        headline={r.heroHeadline?.[locale] ?? t("fp_hero_headline")}
        subhead={r.heroSubhead?.[locale] ?? t("fp_hero_subhead")}
        primaryCta={<Cta href={r.bookingUrl} size="lg">{t("fp_hero_cta")}</Cta>}
        layout="image-right"
        decoration={<WoodGrainEdge />}
        media={
          <div className="relative" style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>
            <ResponsivePicture
              src="/images/templates/front_porch/hero"
              alt={t("fp_hero_alt")}
              className="w-full h-auto"
              eager
            />
          </div>
        }
      />

      {/* BATCH 5: Front Porch is the PLAIN-SPOKEN middle-weight
          archetype. Specialties chips strip sits between Hero and
          Services so a couples/family visitor knows in one glance
          who Marcus actually sees. */}
      <section
        aria-label="specialties"
        className="w-full px-6 md:px-12 py-8"
      >
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-3">
          {(r.populations.length ? r.populations : ["Couples", "Families", "Blended families", "Parents"]).map((p) => (
            <span
              key={p}
              className="px-4 py-2 text-sm border rounded-full"
              style={{
                background: "var(--color-surface-soft)",
                borderColor: "color-mix(in srgb, var(--color-primary) 25%, transparent)",
                color: "var(--color-text)",
                fontFamily: "var(--font-body)",
              }}
            >
              {p}
            </span>
          ))}
        </div>
      </section>

      <Services
        heading={t("fp_services_heading")}
        subhead={t("fp_services_subhead")}
        items={r.focus_areas}
        columns={3}
      />

      <About
        photo={<SepiaPhoto src={r.portraitSrc} alt={r.name} />}
        photoAlt={r.name}
        name={r.name}
        credentials={r.credentials}
        body={bioParas.length > 0 ? bioParas : [bio]}
        heading={fn(t("fp_about_heading"))}
        quote={{ text: t("fp_about_quote") }}
        imageSide="left"
      />

      <FeatureMark featureKey="insurance_sliding_scale">
      <Fees
        heading={t("fp_fees_heading")}
        items={r.fees}
        note={t("fp_fees_note")}
        aside={
          <div>
            <h3 className="text-xl mb-4" style={{ fontFamily: "var(--font-display)" }}>
              {t("fp_insurance_heading")}
            </h3>
            <InsuranceBadges insurances={r.insuranceList} tone="dark" />
          </div>
        }
      />
      </FeatureMark>

      <Faq
        heading={t("fp_faq_heading")}
        items={[
          { q: t("fp_faq_q1"), a: t("fp_faq_a1") },
          { q: t("fp_faq_q2"), a: t("fp_faq_a2") },
          { q: t("fp_faq_q3"), a: t("fp_faq_a3") },
          { q: t("fp_faq_q4"), a: t("fp_faq_a4") },
        ]}
      />

      <CommonExtras r={r} />

      <TierGate min="pro" silent>{props.tail}</TierGate>{/* CRITICAL #4 */}

      <BookingCta
        mode="external"
        href={r.bookingUrl}
        label={t("fp_hero_cta")}
        heading={t("fp_booking_heading")}
        subhead={t("fp_booking_subhead")}
        secondary={t("fp_booking_secondary")}
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
            {t("fp_footer_design_by")}
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

export default FrontPorch;
