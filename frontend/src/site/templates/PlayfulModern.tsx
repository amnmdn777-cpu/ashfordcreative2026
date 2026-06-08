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
  ConditionCarousel, Cta, DecoAsterisk, DecoBolt, DecoDots, DecoHeart,
  DecoSmiley, DecoSquiggle, FooterSignature, TopBar,
} from "./playful_modern/skin";

/**
 * Playful Modern — Phase 2 port. D2C-brand wellness template.
 *
 * Persona: Dr. Naomi Bellamy, PsyD (online-only, Texas-wide).
 * Indigo / coral / lavender palette, Inter Bold tight tracking.
 * Hero is image-right with a bright editorial portrait + 6 sparse
 * SVG decorative overlays. A scrolling condition carousel sits
 * between the hero and the Services section.
 */
function PlayfulModern(props: TemplateProps) {
  const { locale, t } = useI18n();
  const r = resolvePersona("playful_modern", props);
  const fn = (s: string) => s.replace(/\{firstName\}/g, r.firstName || (locale === "es" ? "nuestra consulta" : "this practice"));
  const bio = locale === "es" ? r.bio_es : r.bio_en;
  const bioParas = bio.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const chips = [
    t("playful_chip_anxiety"),
    t("playful_chip_adhd"),
    t("playful_chip_perfectionism"),
    t("playful_chip_burnout_early"),
    t("playful_chip_imposter"),
    t("playful_chip_relationships"),
    t("playful_chip_identity"),
    t("playful_chip_burnout_recovery"),
  ];

  return (
    <ThemeProvider templateKey="playful_modern">
      <TopBar
        name={r.name}
        bookingUrl={r.bookingUrl}
        bookingLabel={t("playful_top_cta")}
      />

      <Hero
        eyebrow={r.heroEyebrow?.[locale] ?? t("playful_hero_eyebrow")}
        headline={r.heroHeadline?.[locale] ?? t("playful_hero_headline")}
        subhead={r.heroSubhead?.[locale] ?? t("playful_hero_subhead")}
        primaryCta={<Cta href={r.bookingUrl} size="lg">{t("playful_hero_cta")}</Cta>}
        layout="image-right"
        decoration={
          <>
            <DecoHeart className="absolute hidden md:block" style={{ top: "12%", left: "44%", transform: "rotate(-12deg)" }} />
            <DecoBolt className="absolute hidden md:block" style={{ top: "22%", right: "8%" }} />
            <DecoSmiley className="absolute hidden md:block" style={{ bottom: "18%", left: "8%" }} />
            <DecoAsterisk className="absolute hidden md:block" style={{ top: "8%", right: "44%" }} />
            <DecoSquiggle className="absolute hidden md:block" style={{ bottom: "12%", right: "28%" }} />
            <DecoDots className="absolute hidden md:block" style={{ top: "60%", right: "40%", opacity: 0.7 }} />
          </>
        }
        media={
          <div className="relative" style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>
            <ResponsivePicture
              src="/images/templates/playful_modern/hero"
              alt={t("playful_hero_alt")}
              className="w-full h-auto"
              eager
            />
          </div>
        }
      />

      <ConditionCarousel chips={chips} ariaLabel={t("playful_carousel_label")} />

      {/* BATCH 5: Playful Modern is the HIGHEST-DENSITY archetype in
          the 7-template lineup. 9 sections, including a stats strip
          and a Reviews block between Services and About so the page
          maintains energy from top to bottom. */}
      <section
        aria-label="practice stats"
        className="w-full px-6 md:px-12 py-10"
        style={{ background: "var(--color-surface-soft)" }}
      >
        <div className="max-w-5xl mx-auto grid grid-cols-3 gap-6 text-center">
          {[
            { n: "200+", l: locale === "es" ? "pacientes atendidas" : "clients seen" },
            { n: "98%", l: locale === "es" ? "tasa de match" : "match rate" },
            { n: "<24h", l: locale === "es" ? "tiempo de respuesta" : "response time" },
          ].map((s) => (
            <div key={s.n}>
              <div
                className="text-3xl md:text-4xl"
                style={{ fontFamily: "var(--font-display)", color: "var(--color-primary)", fontWeight: 700, letterSpacing: "-0.02em" }}
              >
                {s.n}
              </div>
              <div
                className="mt-1 text-sm"
                style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-body)" }}
              >
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Services
        heading={t("playful_services_heading")}
        subhead={t("playful_services_subhead")}
        items={r.focus_areas}
        columns={3}
      />

      <Reviews reviews={r.reviews} />

      <About
        photo={r.portraitSrc}
        photoAlt={r.name}
        name={r.name}
        credentials={r.credentials}
        body={bioParas.length > 0 ? bioParas : [bio]}
        heading={fn(t("playful_about_heading"))}
        quote={{ text: t("playful_about_quote") }}
        imageSide="right"
      />

      <FeatureMark featureKey="insurance_sliding_scale">
      <Fees
        heading={t("playful_fees_heading")}
        items={r.fees}
        note={t("playful_fees_note")}
        aside={
          <div>
            <h3 className="text-xl mb-4" style={{ fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "-0.01em" }}>
              {t("playful_insurance_heading")}
            </h3>
            <InsuranceBadges insurances={r.insuranceList} tone="dark" />
          </div>
        }
      />
      </FeatureMark>

      <Faq
        heading={t("playful_faq_heading")}
        items={[
          { q: t("playful_faq_q1"), a: t("playful_faq_a1") },
          { q: t("playful_faq_q2"), a: t("playful_faq_a2") },
          { q: t("playful_faq_q3"), a: t("playful_faq_a3") },
          { q: t("playful_faq_q4"), a: t("playful_faq_a4") },
        ]}
      />

      <CommonExtras r={r} />

      <TierGate min="pro" silent>{props.tail}</TierGate>{/* CRITICAL #4 */}

      <BookingCta
        mode="external"
        href={r.bookingUrl}
        label={t("playful_hero_cta")}
        heading={t("playful_booking_heading")}
        subhead={t("playful_booking_subhead")}
        secondary={t("playful_booking_secondary")}
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
            {t("playful_footer_design_by")}
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

export default PlayfulModern;
