import { useI18n } from "@site/lib/i18n";
import { TEMPLATE_COUNT, numberWord } from "@site/lib/templateCount";
import { Seo } from "@site/lib/seo";
import { PageCTA } from "@site/components/PageCTA";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

/**
 * /how-it-works — full editorial rebuild (2026-04-28).
 *
 * The previous version stacked six identical paper-card boxes with the
 * same icon style; the founder rejected it as "sucks" — visually flat
 * and indistinguishable from any SaaS feature list. This rebuild
 * reframes the same six steps as a real five-day timeline:
 *
 *   - dark hero with timeline tease + "at-a-glance" mono row
 *   - editorial day-by-day spread with a vertical sage rule, large
 *     italic numerals (01–06), uppercase mono day badges in the gutter,
 *     italic display titles, and serif body copy
 *   - hand-drawn asterisk separator between steps
 *   - CTA carried forward via the existing <PageCTA /> component
 *
 * Step copy still pulls from process_step_*_title / *_desc in strings.ts
 * so we don't fork the source of truth. Day badges and the closing
 * "ongoing" step (#6) carry their own EN/ES strings inline because they
 * are unique to this page and would only pollute the shared strings file.
 */
export default function HowItWorks() {
  const { t, locale } = useI18n();
  const isEs = locale === "es";

  // Day badge labels live here so we don't bloat strings.ts with copy
  // that exists nowhere else. Pattern matches the existing inline
  // "Paso N" / "Step N" treatment that was already in this file.
  const dayBadges: Array<{ day: string; meta: string }> = isEs
    ? [
        { day: "Día 0", meta: "Llamada de 30 min" },
        { day: "Día 0–1", meta: "Antes de 24 h" },
        { day: "Día 1", meta: "Cuando estés lista" },
        { day: "Día 1", meta: "5 preguntas, o ninguna" },
        { day: "Día 2", meta: "Antes de 48 h" },
        { day: "Día 3 +", meta: "Para siempre" },
      ]
    : [
        { day: "Day 0", meta: "30-minute call" },
        { day: "Day 0–1", meta: "Within 24 hours" },
        { day: "Day 1", meta: "Whenever you're ready" },
        { day: "Day 1", meta: "5 questions, or none" },
        { day: "Day 2", meta: "Within 48 hours" },
        { day: "Day 3 +", meta: "Forever" },
      ];

  const step6Title = isEs
    ? "Después: te dejamos en paz."
    : "Then we leave you alone";
  // #221 — extended the "no surprise invoices" sentence with the
  // tax-deductibility cue + W-9 promise. The surrounding paragraph
  // is already about billing reassurance, so this is the natural
  // home for it — a deductibility line on a process page (not a
  // pricing banner) reads as candid information, not as a pitch.
  const step6Desc = isEs
    ? "Cuidado en silencio, día y noche — cada detalle gestionado por nosotros, en segundo plano. Sin facturas sorpresa, sin llamadas de venta. Gasto comercial 100% deducible (IRS §162). Enviamos un W-9 y facturas detalladas a fin de año para su contador. Cancela cuando quieras en los primeros 90 días; después, con 30 días de aviso."
    : "Looked after, around the clock — every detail handled by us, quietly in the background. No surprise invoices, no upsell calls. 100% tax-deductible business expense (IRS §162). We send a W-9 and itemized invoices at year-end for your CPA. Cancel anytime in the first 90 days; after that, 30 days' notice.";

  const steps: Array<{ title: string; desc: string }> = [
    { title: t("process_step_1_title"), desc: t("process_step_1_desc") },
    { title: t("process_step_2_title"), desc: t("process_step_2_desc") },
    { title: t("process_step_3_title"), desc: t("process_step_3_desc") },
    { title: t("process_step_4_title"), desc: t("process_step_4_desc") },
    { title: t("process_step_5_title"), desc: t("process_step_5_desc") },
    { title: step6Title, desc: step6Desc },
  ];

  // At-a-glance pills (the dark-hero timeline row). We use the day
  // labels above so the hero, the gutter, and the long-form copy all
  // tell the same story.
  const glance = dayBadges;

  return (
    <>
      <Seo
        title={t("how_title")}
        description={t("how_sub")}
        path="/how-it-works"
      />

      {/* ───── HERO ───── */}
      <section className="bg-ink text-cream relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 py-24 lg:py-32 relative">
          <div className="text-[10px] font-mono tracking-[0.3em] uppercase text-gold mb-6 opacity-80">
            {isEs ? "Cómo funciona" : "How it works"}
          </div>
          <h1 className="font-display text-[42px] md:text-[64px] lg:text-[76px] leading-[1.05] mb-8 max-w-4xl">
            {isEs ? (
              <>
                De la primera llamada{" "}
                <span className="italic text-gold">a tu sitio en línea</span>
                {" "}— en 48 horas.
              </>
            ) : (
              <>
                From first phone call{" "}
                <span className="italic text-gold">to a live website</span>
                {" "}— in 48 hours.
              </>
            )}
          </h1>
          <p className="font-serif text-[19px] md:text-[22px] leading-[1.6] text-cream/75 max-w-2xl mb-14">
            {t("how_sub")}
          </p>

          {/* At-a-glance day timeline. Hidden on small screens so it
              doesn't crowd the hero on mobile — the long-form timeline
              below is the canonical mobile experience. */}
          <div className="hidden md:block">
            <div className="text-[10px] font-mono tracking-[0.3em] uppercase text-cream/40 mb-5">
              {isEs ? "Vista rápida" : "At a glance"}
            </div>
            <ol className="grid grid-cols-6 gap-3 relative">
              <div
                aria-hidden
                className="absolute top-3 left-0 right-0 h-px bg-cream/15"
              />
              {glance.map((g, i) => (
                <li key={i} className="relative pt-7">
                  <span
                    aria-hidden
                    className="absolute top-1.5 left-0 w-3 h-3 rounded-full bg-cream/15 border border-cream/30"
                  />
                  <div className="text-[11px] font-mono tracking-[0.18em] uppercase text-cream/85 font-medium">
                    {g.day}
                  </div>
                  <div className="text-[12px] font-serif italic text-cream/45 mt-1 leading-tight">
                    {g.meta}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ───── DAY-BY-DAY EDITORIAL TIMELINE ───── */}
      <section className="bg-cream py-24 lg:py-32 px-6 lg:px-12">
        <div className="max-w-5xl mx-auto">
          <div className="text-[10px] font-mono tracking-[0.3em] uppercase text-sage mb-3">
            {isEs ? "Día por día" : "Day by day"}
          </div>
          <h2 className="font-display text-[32px] md:text-[44px] leading-[1.1] text-ink mb-20 max-w-3xl">
            {isEs
              ? "Lo que pasa, y cuándo pasa."
              : "What happens, and when it happens."}
          </h2>

          <ol className="relative">
            {/* The vertical sage rule that ties the whole timeline
                together. Sits at the left gutter on desktop, hidden
                under the content on mobile (we add a left border on
                each <li> instead so the line still reads on phones). */}
            <div
              aria-hidden
              className="hidden md:block absolute left-[200px] top-0 bottom-0 w-px bg-sage/20"
            />
            {steps.map((s, i) => {
              const badge = dayBadges[i];
              const isLast = i === steps.length - 1;
              return (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.55, delay: 0.05 }}
                  className={`relative grid md:grid-cols-[200px_1fr] gap-x-12 gap-y-3 pl-6 md:pl-0 border-l md:border-l-0 border-sage/20 ${
                    isLast ? "pb-0" : "pb-20 md:pb-24"
                  }`}
                >
                  {/* Day metadata column */}
                  <div className="md:text-right md:pr-12 relative">
                    {/* The dot that sits on the vertical sage line */}
                    <span
                      aria-hidden
                      className="hidden md:block absolute top-2 -right-[7px] w-3.5 h-3.5 rounded-full bg-cream border-2 border-sage z-10"
                    />
                    <div className="text-[11px] font-mono tracking-[0.22em] uppercase text-sage font-semibold">
                      {badge.day}
                    </div>
                    <div className="text-[13px] font-serif italic text-ink/55 mt-1 leading-snug">
                      {badge.meta}
                    </div>
                  </div>

                  {/* Step content column */}
                  <div className="md:pl-2">
                    <div className="font-display italic text-[44px] md:text-[56px] leading-none text-gold-deep/80 mb-4 -ml-1">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <h3 className="font-display text-[26px] md:text-[32px] leading-[1.15] text-ink mb-4 max-w-2xl">
                      {s.title}
                    </h3>
                    <p className="font-serif text-[18px] md:text-[19px] leading-[1.65] text-ink/75 max-w-2xl">
                      {s.desc}
                    </p>

                    {/* Subtle decorative asterisk separator between
                        steps — skipped after the final step so the
                        section ends cleanly. */}
                    {!isLast && (
                      <div
                        aria-hidden
                        className="mt-12 text-gold/40 font-display text-2xl select-none"
                      >
                        ✻
                      </div>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </ol>

          {/* Inline secondary nav so the page doesn't dead-end the
              reader after step 6. The footer CTA still ships below. */}
          <div className="mt-24 pt-12 border-t border-ink/10 flex flex-col sm:flex-row gap-4 sm:gap-8 sm:items-center">
            <Link
              href="/templates"
              className="inline-flex items-center gap-2 font-sans text-[11px] font-bold tracking-[0.25em] uppercase text-ink hover:text-gold transition-colors"
            >
              {isEs ? `Ver las ${numberWord(TEMPLATE_COUNT, "es")} plantillas` : `See the ${numberWord(TEMPLATE_COUNT, "en")} templates`}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 font-sans text-[11px] font-bold tracking-[0.25em] uppercase text-ink/55 hover:text-gold transition-colors"
            >
              {isEs ? "Cómo funciona el precio" : "How pricing works"}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Live features callout — surface the four shipping Phase B
          features so a prospect scanning the build process sees the
          operational reach of the platform before the closing CTA. */}
      <section className="py-24 px-6 lg:px-12 bg-cream border-t border-paper">
        <div className="max-w-5xl mx-auto">
          <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-sage mb-4">
            {t("live_features_eyebrow")}
          </div>
          <h2 className="font-display text-3xl md:text-5xl text-ink mb-4 max-w-3xl leading-[1.1] text-balance">
            {t("live_features_title")}
          </h2>
          <p className="font-serif italic text-lg text-ink/70 mb-12 max-w-2xl">
            {t("live_features_sub")}
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              [t("live_feat_telehealth_title"), t("live_feat_telehealth_desc")],
              [t("live_feat_booking_title"), t("live_feat_booking_desc")],
              [t("live_feat_ghostwriter_title"), t("live_feat_ghostwriter_desc")],
              [t("live_feat_onboarding_title"), t("live_feat_onboarding_desc")],
            ].map(([title, desc]) => (
              <div key={title} className="bg-paper border border-ink/10 p-6 rounded-sm">
                <h3 className="font-display text-xl text-ink mb-2 leading-snug">{title}</h3>
                <p className="text-sm text-ink/75 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PageCTA />
    </>
  );
}
