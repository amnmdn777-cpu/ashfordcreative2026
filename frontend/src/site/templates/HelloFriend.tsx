import React from "react";
import {
  About, BookingCta, CrisisBanner, Fees, Footer, Hero, Reviews,
} from "@site/components/sections";
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
  Cta, FooterSignature, GradientBlob, PillTags, ScriptAccent, TiltedPhoto, TopBar,
} from "./hello_friend/skin";

/**
 * Hello Friend — Phase 3 new template, port 8.
 *
 * Persona: Sam Castillo (they/them), LPC-A. Indigo / coral / butter
 * palette, Inter Bold display + body, Caveat script accent. Hero is
 * image-right with a coral-yellow gradient blob behind a tilted
 * photo (PolaroidFrame from src/components/photo/Polaroid). The CTA
 * routes to /intake/sam — the intake form, NOT a calendar — which is
 * the deliberate differentiator from every other template.
 */
function HelloFriend(props: TemplateProps) {
  const { locale, t } = useI18n();
  const r = resolvePersona("hello_friend", props);
  const fn = (s: string) => s.replace(/\{firstName\}/g, r.firstName || (locale === "es" ? "nuestra consulta" : "this practice"));
  const bio = locale === "es" ? r.bio_es : r.bio_en;
  const bioParas = bio.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const chips = [
    t("hf_chip_anxiety"),
    t("hf_chip_adhd"),
    t("hf_chip_queer"),
    t("hf_chip_burnout"),
    t("hf_chip_identity"),
    t("hf_chip_relationships"),
  ];

  return (
    <ThemeProvider templateKey="hello_friend">
      <TopBar
        name={r.name}
        bookingUrl={r.bookingUrl}
        bookingLabel={t("hf_top_cta")}
        avatarSrc={r.portraitSrc}
      />

      <Hero
        eyebrow={r.heroEyebrow?.[locale] ?? t("hf_hero_eyebrow")}
        headline={
          r.heroHeadline?.[locale] ?? (
            <>
              {fn(t("hf_hero_headline"))}
              <br />
              <ScriptAccent>{t("hf_hero_signature")}</ScriptAccent>
            </>
          )
        }
        subhead={
          r.heroSubhead?.[locale] ?? (
            <>
              <PillTags tags={chips} ariaLabel={t("hf_chip_anxiety")} />
              <span className="block mt-4">{t("hf_hero_subhead")}</span>
            </>
          )
        }
        primaryCta={<Cta href={r.bookingUrl} size="lg">{t("hf_hero_cta")} →</Cta>}
        layout="image-right"
        media={
          <div className="relative flex items-center justify-center min-h-[460px]">
            <GradientBlob className="-top-8 -right-8" />
            <div className="relative z-10">
              <TiltedPhoto src="/images/templates/hello_friend/hero" alt={fn(t("hf_hero_alt"))} />
            </div>
          </div>
        }
      />

      {/* BATCH 5: Hello Friend is the INTAKE-FORM-FIRST archetype.
          6 sections: Hero → "Who I see" chips (in hero) → About
          long IG-caption → Sliding-scale Fees box → IntakeForm CTA
          (NOT calendar) → Reviews. No Faq, no Services grid, no
          CommonExtras. The CTA is the first message, not the first
          booking. */}
      <About
        photo={r.portraitSrc}
        photoAlt={r.name}
        name={r.name}
        credentials={r.credentials}
        body={bioParas.length > 0 ? bioParas : [bio]}
        heading={fn(t("hf_about_heading"))}
        quote={{ text: t("hf_about_quote") }}
        imageSide="left"
      />

      <FeatureMark featureKey="insurance_sliding_scale">
      <Fees
        heading={t("hf_fees_heading")}
        items={r.fees}
        note={t("hf_fees_note")}
        aside={
          <div>
            <h3 className="text-xl mb-4" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
              {t("hf_insurance_heading")}
            </h3>
            <InsuranceBadges insurances={r.insuranceList} tone="dark" />
          </div>
        }
      />
      </FeatureMark>

      {/* Intake-form primary CTA — Hello Friend's defining differentiator.
          Sits where every other template places its calendar embed. */}
      <section
        aria-label="intake form"
        className="w-full px-6 md:px-12 py-16"
        style={{ background: "var(--color-surface-soft)" }}
      >
        <div
          className="max-w-2xl mx-auto rounded-3xl p-8 md:p-10 text-center"
          style={{
            background: "var(--color-surface)",
            border: "2px solid color-mix(in srgb, var(--color-primary) 18%, transparent)",
          }}
        >
          <h2
            className="text-2xl md:text-3xl mb-3"
            style={{ fontFamily: "var(--font-display)", color: "var(--color-text)", fontWeight: 700 }}
          >
            {locale === "es" ? "Empezamos con un mensaje, no un calendario." : "Start with a message, not a calendar."}
          </h2>
          <p
            className="text-base mb-6"
            style={{ fontFamily: "var(--font-body)", color: "var(--color-text-muted)" }}
          >
            {locale === "es"
              ? "Cuéntame brevemente qué te trae aquí. Te respondo en un día hábil."
              : "Tell me briefly what brings you here. I'll write back within a business day."}
          </p>
          <a
            href={r.bookingUrl}
            className="inline-block px-7 py-3 rounded-full text-base font-bold transition-opacity hover:opacity-90"
            style={{
              background: "var(--color-secondary)",
              color: "var(--color-primary)",
              fontFamily: "var(--font-body)",
            }}
          >
            {t("hf_hero_cta")} →
          </a>
        </div>
      </section>

      <Reviews reviews={r.reviews} />

      <TierGate min="pro" silent>{props.tail}</TierGate>{/* CRITICAL #4 */}

      <BookingCta
        mode="external"
        href={r.bookingUrl}
        label={t("hf_hero_cta")}
        heading={t("hf_booking_heading")}
        subhead={t("hf_booking_subhead")}
        // Secondary line is "Or just email hello@samcastillo.com" — a
        // persona-stub address. For a real prospect we show their real
        // email instead (or nothing, rather than the demo address).
        secondary={
          r.isLead || r.isPracticeOnly
            ? (r.email
                ? (locale === "es"
                    ? `O escribe a ${r.email}.`
                    : `Or just email ${r.email}.`)
                : null)
            : t("hf_booking_secondary")
        }
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
            {t("hf_footer_design_by")}
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

export default HelloFriend;
