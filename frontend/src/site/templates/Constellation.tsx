import React from "react";
import {
  About, CrisisBanner, Footer, Hero,
} from "@site/components/sections";
import { FeatureMark } from "@site/components/demo/FeatureBadge";
import { ThemeProvider } from "@site/components/ThemeProvider";
import { TierGate } from "@site/components/TierGate";
import { useI18n } from "@site/lib/i18n";
import { resolvePersona } from "@site/data/resolvePersona";
import type { TemplateProps } from "./types";
import { SocialRow } from "./SocialRow";
import { ResponsivePicture } from "@site/components/photo/ResponsivePicture";
import {
  Cta, FooterSignature, GoldUnderline, HeroOverlay, StarField, TopBar,
} from "./constellation/skin";

/**
 * Constellation — Phase 2 port. Cinematic dark-mode executive template.
 *
 * Persona: Dr. Elena Park, PsyD (Houston). Deep navy + warm gold,
 * Inter Bold display + body. Hero is image-bg with a 60% navy
 * overlay and a CSS-only star field behind every section. Headline
 * emphasis word carries a gold underline at 60% opacity (replaces
 * the over-aggressive orange highlight in the legacy template).
 */
function Constellation(props: TemplateProps) {
  const { locale, t } = useI18n();
  const r = resolvePersona("constellation", props);
  const fn = (s: string) => s.replace(/\{firstName\}/g, r.firstName || (locale === "es" ? "nuestra consulta" : "this practice"));
  const bio = locale === "es" ? r.bio_es : r.bio_en;
  const bioParas = bio.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <ThemeProvider templateKey="constellation">
      <StarField />
      <TopBar
        name={r.name}
        bookingUrl={r.bookingUrl}
        bookingLabel={t("cn_top_cta")}
      />

      <Hero
        eyebrow={r.heroEyebrow?.[locale] ?? t("cn_hero_eyebrow")}
        headline={
          r.heroHeadline?.[locale] ?? (
            <>
              {t("cn_hero_headline_pre")}{" "}
              <GoldUnderline>{t("cn_hero_headline_emphasis")}</GoldUnderline>{" "}
              {t("cn_hero_headline_post")}
            </>
          )
        }
        subhead={r.heroSubhead?.[locale] ?? t("cn_hero_subhead")}
        primaryCta={<Cta href={r.bookingUrl} size="lg">{t("cn_hero_cta")}</Cta>}
        layout="image-bg"
        decoration={<HeroOverlay />}
        media={
          <ResponsivePicture
            src="/images/templates/constellation/hero"
            alt={t("cn_hero_alt")}
            className="w-full h-full object-cover"
            eager
          />
        }
      />

      {/* BATCH 5: Constellation is the ULTRA-MINIMAL archetype.
          Only Hero + Bio paragraph + a single inquiry footer-CTA.
          No Services / Reviews / Fees / FAQ / Map — the "designed
          feel" IS the restraint. The opposite of long. */}
      <About
        photo={r.portraitSrc}
        photoAlt={r.name}
        name={r.name}
        credentials={r.credentials}
        body={bioParas.length > 0 ? bioParas.slice(0, 1) : [bio]}
        heading={fn(t("cn_about_heading"))}
        quote={{ text: t("cn_about_quote") }}
        imageSide="right"
      />

      <TierGate min="pro" silent>{props.tail}</TierGate>{/* CRITICAL #4: tail carries Pro inline demos (booking widget, doxy bridge, onboarding hub, first-visit video) */}

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
            {t("cn_footer_design_by")}
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

export default Constellation;
