import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  About,
  BookingCta,
  CrisisBanner,
  Faq,
  Fees,
  Reviews,
} from "@site/components/sections";
import {
  ClarityServices,
  ClarityVideo,
  ClarityLocation,
  ClarityAnnouncementBar,
  ClarityTrustBand,
  ClaritySpecialties,
  ClarityApproach,
  ClarityTestimonialSpotlight,
  ClarityNewsletter,
  ClarityFooter,
} from "./clarity/sections";
import { FeatureMark } from "@site/components/demo/FeatureBadge";
import { ThemeProvider } from "@site/components/ThemeProvider";
import { TierGate } from "@site/components/TierGate";
import { useI18n } from "@site/lib/i18n";
import { resolvePersona } from "@site/data/resolvePersona";
import type { TemplateProps } from "./types";
import { InsuranceBadges } from "./_wow";
import { WordReveal } from "./motion";
import { useClarityNav } from "./clarity/navContext";

import { Cta, ImageCard, TopBar, WarmBackdrop } from "./clarity/skin";

/**
 * Clarity — clean / modern / premium template.
 *
 * The feel: an editorial, high-end wellness-brand landing page —
 * oversized Space Grotesk headline, a soft warmly-lit backdrop, and
 * a two-card hero (portrait + a free-call CTA tile). Generous
 * whitespace, calm coral accent, near-black ink on warm linen.
 *
 * Sparse-data resilient by design: the hero's premium atmosphere is
 * the template-owned WarmBackdrop + type scale, NOT the prospect's
 * photo — so a lead with weak or missing imagery still reads as
 * high-end. Sections below render through the shared section
 * components, themed by the `clarity_warm` palette. Composition only;
 * chrome lives in `./clarity/skin.tsx`.
 */
function Clarity(props: TemplateProps) {
  const { locale } = useI18n();
  const r = resolvePersona("clarity", props);
  const tt = (en: string, es: string) => (locale === "es" ? es : en);

  // One nav, two modes: inside the multi-page wrapper the header links
  // switch PAGES (so we never stack a second PAGES bar on top); standalone
  // it falls back to in-page section anchors.
  const nav = useClarityNav();
  const navItems = nav
    ? [
        { label: tt("Home", "Inicio"), href: "/" },
        { label: tt("About", "Acerca"), href: "/about" },
        { label: tt("Services", "Servicios"), href: "/services" },
        { label: tt("Blog", "Blog"), href: "/blog" },
      ]
    : [
        { label: tt("Services", "Servicios"), href: "#services" },
        { label: tt("About", "Acerca"), href: "#about" },
        { label: tt("Fees", "Tarifas"), href: "#fees" },
        { label: tt("FAQ", "Preguntas"), href: "#faq" },
      ];

  // Motion is opt-out under prefers-reduced-motion: when reduced, every
  // animated element starts in its final state (initial=false) and hover
  // lifts are dropped, so the page is fully static and accessible.
  const reduced = useReducedMotion();
  const fadeUp = (delay = 0) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-60px" },
          transition: {
            duration: 0.6,
            ease: [0.16, 1, 0.3, 1] as const,
            delay,
          },
        };
  const hoverLift = reduced
    ? {}
    : { whileHover: { y: -6 }, transition: { duration: 0.25 } };

  const bio = locale === "es" ? r.bio_es : r.bio_en;
  const bioParas = bio
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const location = [r.city, r.state].filter(Boolean).join(", ");
  const eyebrow =
    location ||
    tt("Individual & couples therapy", "Terapia individual y de pareja");

  const headline =
    r.heroHeadline?.[locale] ??
    tt(
      "Clarity in care. Considered, modern, and entirely yours.",
      "Claridad en el cuidado. Considerada, moderna y totalmente tuya.",
    );

  const subhead =
    r.heroSubhead?.[locale] ??
    tt(
      "Evidence-based therapy for adults navigating anxiety, burnout, and life's bigger transitions — at a pace that's yours.",
      "Terapia basada en evidencia para adultos que enfrentan ansiedad, agotamiento y las grandes transiciones de la vida — a tu propio ritmo.",
    );

  const bookCta = tt(
    "Book a free 15-min call",
    "Reserva una llamada gratis de 15 min",
  );

  // QA (2026-06-22): the stats band (years / clients / etc.) was removed —
  // the numbers were marketing defaults, not real per-practice data, so
  // they read as fabricated on a prospect's preview.

  const loc = props.content.locations?.[0];

  // "What we treat" — prospect's real specialties when present, else a
  // sensible default set so the section never renders empty.
  const specialties =
    props.content.specialties && props.content.specialties.length > 0
      ? props.content.specialties
      : [
          tt("Anxiety", "Ansiedad"),
          tt("Depression", "Depresión"),
          tt("Trauma & PTSD", "Trauma y TEPT"),
          tt("Grief & loss", "Duelo y pérdida"),
          tt("Burnout", "Agotamiento"),
          tt("Relationships", "Relaciones"),
          tt("Life transitions", "Transiciones de vida"),
          tt("Self-esteem", "Autoestima"),
        ];

  const approach = [
    {
      name: "EMDR",
      body: tt(
        "A structured, evidence-based way to reprocess traumatic memories so they lose their charge.",
        "Una forma estructurada y basada en evidencia de reprocesar recuerdos traumáticos para que pierdan su carga.",
      ),
    },
    {
      name: tt("CBT", "TCC"),
      body: tt(
        "Practical tools to notice and shift the thought patterns that keep anxiety and low mood going.",
        "Herramientas prácticas para notar y cambiar los patrones de pensamiento que alimentan la ansiedad.",
      ),
    },
    {
      name: tt("Parts work (IFS)", "Trabajo de partes (IFS)"),
      body: tt(
        "Get to know the different parts of yourself with curiosity instead of criticism.",
        "Conoce las distintas partes de ti con curiosidad en lugar de crítica.",
      ),
    },
    {
      name: tt("Couples (Gottman)", "Parejas (Gottman)"),
      body: tt(
        "Research-backed methods to rebuild communication, trust, and connection.",
        "Métodos respaldados por investigación para reconstruir la comunicación y la confianza.",
      ),
    },
  ];

  const featured = props.content.testimonials?.[0] ?? null;
  const featuredQuote = featured?.body ?? r.reviews?.[0]?.body ?? "";
  const featuredAuthor = featured?.author ?? r.reviews?.[0]?.author ?? r.name;
  const featuredSource = featured ? undefined : r.reviews?.[0]?.source;

  return (
    <ThemeProvider templateKey="clarity">
      <div
        className="scroll-smooth"
        style={{
          backgroundColor: "var(--color-surface)",
          color: "var(--color-text)",
        }}
      >
        <ClarityAnnouncementBar
          text={tt(
            "Now accepting new clients — in person & virtual.",
            "Aceptando nuevos pacientes — en persona y virtual.",
          )}
          ctaLabel={tt("Book a call", "Reserva una llamada")}
          ctaHref={r.bookingUrl}
        />
        <TopBar
          name={r.name}
          logoUrl={r.isReal ? (props.content.brand?.logoUrl ?? null) : null}
          navItems={navItems}
          onNavigate={nav?.navigate}
          activePath={nav?.activePath}
          contactHref={r.bookingUrl}
          contactLabel={tt("Contact", "Contacto")}
        />

        {/* ── Hero ──────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <WarmBackdrop />
          <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-12 md:pt-24 md:pb-16">
            <motion.p
              {...fadeUp(0)}
              className="text-[13px] uppercase tracking-[0.18em] mb-6"
              style={{
                color: "var(--color-text-muted)",
                fontFamily: "var(--font-body)",
              }}
            >
              {eyebrow}
            </motion.p>

            <div className="grid md:grid-cols-[1.55fr_1fr] gap-6 md:gap-10 items-end">
              <WordReveal
                text={headline}
                className="text-[2.6rem] leading-[1.04] sm:text-6xl md:text-7xl font-bold tracking-[-0.02em]"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--color-text)",
                }}
              />
              <motion.p
                {...fadeUp(0.15)}
                className="text-[15px] leading-relaxed md:pb-3 md:text-right"
                style={{
                  color: "var(--color-text-muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {subhead}
              </motion.p>
            </div>

            {/* Two-card row — portrait tile + free-call CTA tile */}
            <motion.div
              {...fadeUp(0.25)}
              className="mt-10 grid sm:grid-cols-2 gap-5"
            >
              <motion.div {...hoverLift} className="rounded-3xl">
                <ImageCard
                  src={r.portraitSrc}
                  alt={r.name}
                  caption={r.name}
                  className="aspect-[16/10] sm:aspect-[4/5] md:aspect-[16/11]"
                />
              </motion.div>
              <motion.div
                {...hoverLift}
                className="relative rounded-3xl overflow-hidden flex items-center justify-center aspect-[16/10] sm:aspect-[4/5] md:aspect-[16/11]"
                style={{
                  background:
                    "linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 24%, var(--color-surface-soft)), color-mix(in srgb, var(--color-secondary) 65%, var(--color-surface-soft)))",
                }}
              >
                <div className="text-center px-6">
                  <p
                    className="text-lg md:text-xl font-semibold mb-5 max-w-xs mx-auto leading-snug"
                    style={{
                      fontFamily: "var(--font-display)",
                      color: "var(--color-text)",
                    }}
                  >
                    {tt(
                      "Not sure where to start? Let's talk it through.",
                      "¿No sabes por dónde empezar? Hablémoslo.",
                    )}
                  </p>
                  <Cta href={r.bookingUrl} size="lg" variant="light">
                    {bookCta}
                  </Cta>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── Trust / insurance band ───────────────────────────── */}
        <ClarityTrustBand
          label={tt("In-network with", "En red con")}
          items={
            r.insuranceList.length
              ? r.insuranceList
              : [tt("Most major insurance", "La mayoría de seguros")]
          }
        />

        {/* ── Services ─────────────────────────────────────────── */}
        <ClarityServices
          id="services"
          heading={tt("What we work on", "En qué trabajamos")}
          subhead={tt(
            "Focused, evidence-based support — matched to where you are.",
            "Apoyo enfocado y basado en evidencia — a la medida de dónde estás.",
          )}
          items={r.focus_areas}
        />

        {/* ── What we treat ────────────────────────────────────── */}
        <ClaritySpecialties
          heading={tt("What we treat", "Qué tratamos")}
          subhead={tt(
            "Common reasons people reach out — though you don't need a label to begin.",
            "Razones comunes por las que la gente nos busca — aunque no necesitas una etiqueta para empezar.",
          )}
          items={specialties}
        />

        {/* ── About ────────────────────────────────────────────── */}
        <motion.div {...fadeUp()} id="about" className="scroll-mt-24">
          <About
            photo={r.portraitSrc}
            photoAlt={r.name}
            name={r.name}
            credentials={r.credentials}
            body={bioParas.length > 0 ? bioParas : [bio]}
            heading={
              r.firstName
                ? tt(`About ${r.firstName}`, `Acerca de ${r.firstName}`)
                : tt("About", "Acerca")
            }
            imageSide="left"
          />
        </motion.div>

        {/* ── Our approach ─────────────────────────────────────── */}
        <ClarityApproach
          heading={tt("Our approach", "Nuestro enfoque")}
          subhead={tt(
            "Methods we lean on — explained in plain language.",
            "Métodos en los que nos apoyamos — explicados con claridad.",
          )}
          items={approach}
        />

        {/* ── Video intro ──────────────────────────────────────── */}
        <ClarityVideo
          heading={tt(
            "See the space before you come in",
            "Conoce el espacio antes de venir",
          )}
          subhead={tt(
            "A short walkthrough of the practice and what a first session feels like.",
            "Un breve recorrido por la práctica y cómo se siente una primera sesión.",
          )}
          caption={tt(
            "Watch a 60-second intro",
            "Mira una intro de 60 segundos",
          )}
        />

        {/* ── Featured testimonial ─────────────────────────────── */}
        <ClarityTestimonialSpotlight
          quote={featuredQuote}
          author={featuredAuthor}
          source={featuredSource}
        />

        <motion.div {...fadeUp()}>
          <Reviews reviews={r.reviews} />
        </motion.div>

        {/* ── Fees + insurance ─────────────────────────────────── */}
        <motion.div {...fadeUp()} id="fees" className="scroll-mt-24">
          <FeatureMark featureKey="insurance_sliding_scale">
            <Fees
              heading={tt("Fees & insurance", "Tarifas y seguros")}
              items={r.fees}
              note={tt(
                "Superbills provided for out-of-network reimbursement.",
                "Se proporcionan recibos para reembolso fuera de la red.",
              )}
              aside={
                r.insuranceList.length > 0 ? (
                  <div>
                    <h3
                      className="text-xl mb-4"
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 600,
                      }}
                    >
                      {tt("Accepted insurance", "Seguros aceptados")}
                    </h3>
                    <InsuranceBadges
                      insurances={r.insuranceList}
                      tone="light"
                    />
                  </div>
                ) : undefined
              }
            />
          </FeatureMark>
        </motion.div>

        {/* ── FAQ ──────────────────────────────────────────────── */}
        <motion.div {...fadeUp()} id="faq" className="scroll-mt-24">
          <Faq
            heading={tt("Common questions", "Preguntas frecuentes")}
            items={[
              {
                q: tt("Do you take insurance?", "¿Aceptan seguro?"),
                a: tt(
                  "We're in-network with several major plans, and provide superbills for out-of-network reimbursement. The fastest way to confirm your coverage is a quick call.",
                  "Estamos en red con varios planes principales y entregamos recibos para reembolso fuera de la red. La forma más rápida de confirmar tu cobertura es una breve llamada.",
                ),
              },
              {
                q: tt(
                  "How soon can I be seen?",
                  "¿Qué tan pronto pueden atenderme?",
                ),
                a: tt(
                  "New clients are usually scheduled within two weeks. Reach out and we'll find a time that works.",
                  "Solemos atender nuevos pacientes en menos de dos semanas. Escríbenos y encontraremos un horario que funcione.",
                ),
              },
              {
                q: tt(
                  "Do you offer virtual sessions?",
                  "¿Ofrecen sesiones virtuales?",
                ),
                a: tt(
                  "Yes — sessions are available both in person and over secure video, whichever suits you.",
                  "Sí — las sesiones están disponibles en persona y por video seguro, lo que prefieras.",
                ),
              },
            ]}
          />
        </motion.div>

        {/* ── Location / map ───────────────────────────────────── */}
        {loc ? (
          <ClarityLocation
            heading={tt("Find us", "Encuéntranos")}
            address={loc.address}
            hours={loc.hours}
            phone={r.phone}
            labels={{
              eyebrow: tt("Visit", "Visítanos"),
              hours: tt("Hours", "Horario"),
              call: tt("Call", "Llamar"),
              directions: tt("Get directions", "Cómo llegar"),
            }}
          />
        ) : null}

        {/* ── Newsletter ───────────────────────────────────────── */}
        <ClarityNewsletter
          heading={tt(
            "Helpful notes, now and then",
            "Notas útiles, de vez en cuando",
          )}
          subhead={tt(
            "Occasional, practical writing from our clinicians. No spam, unsubscribe anytime.",
            "Escritos prácticos y ocasionales de nuestros clínicos. Sin spam, cancela cuando quieras.",
          )}
          placeholder={tt("Your email", "Tu correo")}
          button={tt("Subscribe", "Suscribirme")}
        />

        <TierGate min="pro" silent>
          {props.tail}
        </TierGate>

        {/* ── Closing CTA ──────────────────────────────────────── */}
        <BookingCta
          mode="external"
          href={r.bookingUrl}
          label={bookCta}
          heading={tt("Ready when you are.", "Cuando tú estés listo.")}
          subhead={tt(
            "A free 15-minute call to see if we're the right fit — no pressure, no commitment.",
            "Una llamada gratuita de 15 minutos para ver si encajamos — sin presión ni compromiso.",
          )}
          secondary={tt(
            "Most clients hear back the same day.",
            "La mayoría recibe respuesta el mismo día.",
          )}
        />

        <ClarityFooter
          name={r.name}
          tagline={tt(
            "Modern, evidence-based therapy — at a pace that's yours.",
            "Terapia moderna y basada en evidencia — a tu propio ritmo.",
          )}
          navItems={navItems}
          onNavigate={nav?.navigate}
          contact={{
            phone: r.phone,
            email: r.email,
            address: [r.addressLine1, r.addressLine2, location]
              .filter(Boolean)
              .join(", "),
          }}
          hours={loc?.hours}
          columns={{
            links: tt("Explore", "Explora"),
            contact: tt("Contact", "Contacto"),
            hours: tt("Hours", "Horario"),
          }}
          signature={tt(
            `© ${new Date().getFullYear()} ${r.name}. Design by Ashford Creative.`,
            `© ${new Date().getFullYear()} ${r.name}. Diseño de Ashford Creative.`,
          )}
        />

        <CrisisBanner
          prefix={tt("In crisis?", "¿En crisis?")}
          label={tt(
            "988 Suicide & Crisis Lifeline · 24/7",
            "Línea 988 de Crisis y Suicidio · 24/7",
          )}
        />


      </div>
    </ThemeProvider>
  );
}

export default Clarity;
