import React from "react";
import {
  About, BookingWidget, CrisisBanner, DoxyBridge, Faq, Fees,
  Footer, GoogleBusinessMap, Hero, OfficeTourStrip, Reviews, Services,
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
  BotanicalCorners, Cta, FooterSignature, PageBackground, TopBar,
} from "./garden/skin";

/**
 * Garden — Phase 2 port. Family-and-trauma-informed therapy template.
 *
 * Persona: Joanna Reyes-Kim, LMFT (Plano, TX). Sage-greenhouse aesthetic,
 * Fraunces type both display + body, terracotta accent.
 *
 * SECTION ORDER (founder 2026-05-21 — canonical, all tiers):
 *   Hero → About → Services → Office tour → Fees → Booking (Pro+)
 *   → Telehealth (Pro+) → Reviews → Google map → FAQ → Crisis → Footer
 *
 * Boutique = 10 sections (Booking + Telehealth gated out via TierGate)
 * Pro      = 12 sections (DoxyBridge as bridge UI)
 * Concierge = 12 sections (DoxyBridge full UI — same component today)
 */
function Garden(props: TemplateProps) {
  const { locale, t } = useI18n();
  const r = resolvePersona("garden", props);
  const fn = (s: string) => s.replace(/\{firstName\}/g, r.firstName || (locale === "es" ? "nuestra consulta" : "this practice"));
  const bio = locale === "es" ? r.bio_es : r.bio_en;
  const bioParas = bio.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const es = locale === "es";
  const composedAddress =
    r.addressLine1 && r.addressLine2
      ? `${r.addressLine1}, ${r.addressLine2}`
      : r.addressLine1
        ? r.addressLine1
        : `${r.city}, ${r.state}`;

  return (
    <ThemeProvider templateKey="garden">
      <PageBackground />
      <BotanicalCorners />

      <TopBar
        name={r.name}
        bookingUrl={r.bookingUrl}
        bookingLabel={t("garden_top_cta")}
      />

      {/* 1 — Hero */}
      <Hero
        eyebrow={r.heroEyebrow?.[locale] ?? t("garden_hero_eyebrow")}
        headline={r.heroHeadline?.[locale] ?? t("garden_hero_headline")}
        subhead={r.heroSubhead?.[locale] ?? t("garden_hero_subhead")}
        primaryCta={<Cta href={r.bookingUrl} size="lg">{t("garden_hero_cta")}</Cta>}
        layout="image-right"
        media={
          <ResponsivePicture
            src="/images/templates/garden/hero"
            alt={t("garden_hero_alt")}
            className="w-full h-auto rounded-2xl shadow-md"
            eager
          />
        }
      />

      {/* 2 — About (initials avatar fallback for real leads w/o portrait).
          Founder 2026-05-21: for real leads (isReal), the ONLY acceptable
          photo is one that actually belongs to the practitioner — i.e.
          a teamMember.photo URL. resolvePersona falls back to the persona
          stub portrait (/images/garden-portrait.jpg) and to crawled
          heroImage (often a stock office shot), neither of which is the
          lead. Block both and render initials instead. */}
      {(() => {
        const STOCK_PORTRAIT_HINTS = [
          "/images/templates/",
          "/images/garden-portrait",
          "/images/sunrise-portrait",
          "/images/polaroid-portrait",
          "/images/constellation-portrait",
        ];
        const looksLikeStock =
          !r.portraitSrc ||
          STOCK_PORTRAIT_HINTS.some((h) => r.portraitSrc.includes(h));
        const photo: React.ReactNode | string =
          r.isReal && looksLikeStock ? (
            <div
              className="w-full h-full flex items-center justify-center select-none"
              style={{
                backgroundColor: "var(--color-accent, #6b8e6b)",
                color: "var(--color-surface, #f5f1e8)",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(4rem, 12vw, 8rem)",
                letterSpacing: "0.05em",
              }}
              aria-label={r.name}
            >
              {r.practitionerInitials}
            </div>
          ) : (r.portraitSrc || "/images/garden-portrait.jpg");
        return (
          <About
            photo={photo}
            photoAlt={r.name}
            name={r.name}
            credentials={r.credentials}
            body={bioParas.length > 0 ? bioParas : [bio]}
            heading={fn(t("garden_about_heading"))}
            quote={{ text: t("garden_about_quote") }}
            imageSide="left"
          />
        );
      })()}

      {/* 3 — Services */}
      <Services
        heading={t("garden_services_heading")}
        subhead={t("garden_services_subhead")}
        items={r.focus_areas}
        columns={3}
      />

      {/* 4 — Office tour (all tiers) */}
      <FeatureMark featureKey="office_tour">
        <OfficeTourStrip />
      </FeatureMark>

      {/* 5 — Fees */}
      {r.fees.length > 0 && (
        <FeatureMark featureKey="insurance_sliding_scale">
          <Fees
            heading={es ? "Tarifas" : "Fees"}
            items={r.fees}
            aside={
              r.insuranceList && r.insuranceList.length > 0 ? (
                <div>
                  <h3
                    className="text-xl mb-4"
                    style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                  >
                    {es ? "Seguros aceptados" : "Insurance accepted"}
                  </h3>
                  <InsuranceBadges insurances={r.insuranceList} tone="dark" />
                </div>
              ) : undefined
            }
          />
        </FeatureMark>
      )}

      {/* 6 — Booking widget (Pro+) — no FeatureMark: not in FEATURE_ORDER. */}
      <TierGate min="pro" silent>
        <BookingWidget
          practiceName={r.name}
          calendlyUrl={r.bookingUrl}
        />
      </TierGate>

      {/* 7 — Telehealth bridge (Pro+) — no FeatureMark: not in FEATURE_ORDER. */}
      <TierGate min="pro" silent>
        <div className="max-w-4xl mx-auto px-6 md:px-12 py-12">
          <DoxyBridge />
        </div>
      </TierGate>

      {/* 8 — Reviews (carrousel) */}
      {r.reviews.length > 0 && (
        <FeatureMark featureKey="google_business_presence">
          <Reviews reviews={r.reviews} />
        </FeatureMark>
      )}

      {/* 9 — Google Business map */}
      <FeatureMark featureKey="google_business_presence">
        <GoogleBusinessMap
          address={composedAddress}
          phone={r.phone || undefined}
        />
      </FeatureMark>

      {/* 10 — FAQ */}
      <Faq
        heading={es ? "Preguntas frecuentes" : "Frequently asked"}
        items={
          es
            ? [
              { q: "¿Cómo agendo mi primera cita?", a: "Reserva una llamada gratuita de 15 minutos arriba; respondemos a tus preguntas y agendamos juntos." },
              { q: "¿Aceptan seguros?", a: "Sí — la lista de aseguradoras está en la sección de tarifas." },
              { q: "¿Ofrecen sesiones en línea?", a: "Sí, sesiones seguras por video disponibles en todo Texas." },
              { q: "¿Qué pasa si necesito cancelar?", a: "Avísanos con 24 horas de anticipación, sin cargo." },
            ]
            : [
              { q: "How do I book my first session?", a: "Reserve a free 15-minute call above — we'll answer your questions and schedule together." },
              { q: "Do you take insurance?", a: "Yes — the carrier list is in the fees section above." },
              { q: "Do you offer online sessions?", a: "Yes, secure video sessions are available across Texas." },
              { q: "What if I need to cancel?", a: "Give us 24 hours' notice, no charge." },
            ]
        }
      />

      {/* (Pro+ tail extras still get a slot — keeps prior contract.) */}
      <TierGate min="pro" silent>{props.tail}</TierGate>

      {/* 11 — Crisis (always, baseline légale) */}
      <CrisisBanner
        prefix={es ? "¿En crisis?" : "In crisis?"}
        label={es ? "Línea 988 de Crisis y Suicidio · 24/7" : "988 Suicide & Crisis Lifeline · 24/7"}
      />

      {/* 12 — Footer (toujours dernier) */}
      <FeatureMark featureKey="social_row">
        <Footer
          name={r.name}
          credentials={[r.credentials, `${r.city}, ${r.state}`].filter(Boolean).join(" · ")}
          license={r.license_number}
          phone={r.phone}
          email={r.email}
          address={r.addressLine2 ? [r.addressLine1, r.addressLine2] : r.addressLine1}
          rightsReserved={es ? "Todos los derechos reservados." : "All rights reserved."}
          social={
            <SocialRow
              contact={r.contact}
              tone="light"
              size="compact"
              label={es ? "Síguenos" : "Follow us"}
            />
          }
          tail={
            <span style={{ fontFamily: "var(--font-body)" }}>
              {t("garden_footer_design_by")}
              <FooterSignature name="Ashford Creative" />
            </span>
          }
        />
      </FeatureMark>
    </ThemeProvider>
  );
}

export default Garden;
