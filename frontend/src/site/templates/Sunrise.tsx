import React from "react";
import {
  About, BookingCta, CrisisBanner, Faq, Fees, Footer, Hero, Reviews, Services,
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
  Cta, FooterSignature, GlassBioCard, SunRays, SunriseGradientOverlay, TopBar,
} from "./sunrise/skin";

/**
 * Sunrise — Phase 2 port. Perinatal mental health template.
 *
 * Persona: Dr. Riya Mehta, LPC (Dallas, telehealth across Texas).
 * Plum / peach / coral palette, Plus Jakarta Sans display + body.
 * Hero is image-bg with a peach-to-coral gradient overlay and a
 * glass-card bio block lower-right. Composition only — chrome lives
 * in `./sunrise/skin.tsx`.
 */
function Sunrise(props: TemplateProps) {
  const { locale, t } = useI18n();
  const r = resolvePersona("sunrise", props);
  const fn = (s: string) => s.replace(/\{firstName\}/g, r.firstName || (locale === "es" ? "nuestra consulta" : "this practice"));
  const bio = locale === "es" ? r.bio_es : r.bio_en;
  const bioParas = bio.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <ThemeProvider templateKey="sunrise">
      <TopBar
        name={r.name}
        bookingUrl={r.bookingUrl}
        bookingLabel={t("sunrise_top_cta")}
      />

      <Hero
        eyebrow={r.heroEyebrow?.[locale] ?? t("sunrise_hero_eyebrow")}
        headline={r.heroHeadline?.[locale] ?? t("sunrise_hero_headline")}
        subhead={r.heroSubhead?.[locale] ?? t("sunrise_hero_subhead")}
        primaryCta={<Cta href={r.bookingUrl} size="lg">{t("sunrise_hero_cta")}</Cta>}
        layout="image-bg"
        decoration={
          <>
            <SunriseGradientOverlay />
            <SunRays />
            {/* 2026-05-14: suppress the persona's "Perinatal mental
                health-certified" glass tagline for real prospects —
                it would leak the Sunrise persona's clinical
                positioning onto a lead who may not be perinatal. */}
            <GlassBioCard
              photo={r.portraitSrc}
              name={r.name}
              oneLiner={r.isLead || r.isPracticeOnly ? "" : t("sunrise_glass_one_liner")}
            />
          </>
        }
        media={
          <ResponsivePicture
            src="/images/templates/sunrise/hero"
            alt={t("sunrise_hero_alt")}
            className="w-full h-full object-cover"
            eager
          />
        }
      />

      {/* BATCH 5: Sunrise is the LONG-FORM healing-arc archetype.
          Sequence: Hero → Services-accordion → About-long → Reviews →
          Fees + Insurance → FAQ → CommonExtras → BookingCta. The page
          deliberately RISES: pain-point eyebrow at the top, soft
          confidence in the middle, a clear next step at the bottom. */}
      <Services
        heading={t("sunrise_services_heading")}
        subhead={t("sunrise_services_subhead")}
        items={r.focus_areas}
        columns={3}
      />

      <About
        photo={r.portraitSrc}
        photoAlt={r.name}
        name={r.name}
        credentials={r.credentials}
        body={bioParas.length > 0 ? bioParas : [bio]}
        heading={fn(t("sunrise_about_heading"))}
        quote={{ text: t("sunrise_about_quote") }}
        imageSide="right"
      />

      <Reviews reviews={r.reviews} />

      <FeatureMark featureKey="insurance_sliding_scale">
      <Fees
        heading={t("sunrise_fees_heading")}
        items={r.fees}
        note={t("sunrise_fees_note")}
        aside={
          <div>
            <h3
              className="text-xl mb-4"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              {t("sunrise_insurance_heading")}
            </h3>
            <InsuranceBadges insurances={r.insuranceList} tone="dark" />
          </div>
        }
      />
      </FeatureMark>

      <Faq
        heading={t("sunrise_faq_heading")}
        items={[
          { q: t("sunrise_faq_q1"), a: t("sunrise_faq_a1") },
          { q: t("sunrise_faq_q2"), a: t("sunrise_faq_a2") },
          { q: t("sunrise_faq_q3"), a: t("sunrise_faq_a3") },
          { q: t("sunrise_faq_q4"), a: t("sunrise_faq_a4") },
        ]}
      />

      <CommonExtras r={r} />

      <TierGate min="pro" silent>{props.tail}</TierGate>{/* CRITICAL #4 */}

      <BookingCta
        mode="external"
        href={r.bookingUrl}
        label={t("sunrise_hero_cta")}
        heading={t("sunrise_booking_heading")}
        subhead={t("sunrise_booking_subhead")}
        secondary={t("sunrise_booking_secondary")}
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
            {t("sunrise_footer_design_by")}
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

export default Sunrise;
