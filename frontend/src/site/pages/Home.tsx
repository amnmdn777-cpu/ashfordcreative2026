import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { ArrowRight, ArrowUpRight, Quote } from "lucide-react";
import { Link } from "wouter";
import { useI18n } from "@site/lib/i18n";
import { useChatbot } from "@site/components/ChatbotProvider";
import { Seo, orgJsonLd, serviceJsonLd } from "@site/lib/seo";
import { PageCTA } from "@site/components/PageCTA";
import { img } from "@site/lib/api";

// Home — graduated from the Atelier mockup (task #181). All copy
// goes through t() for ES; chrome lives in Layout.tsx; portrait
// uses /images/manifesto-therapist.png with an Unsplash fallback.

const ease = [0.16, 1, 0.3, 1] as const;

const OrnamentalRule = ({ className = "" }: { className?: string }) => (
  <div className={`flex items-center justify-center gap-4 opacity-40 ${className}`}>
    <div className="h-[1px] w-12 bg-ink"></div>
    <div className="w-2 h-2 rotate-45 border border-ink"></div>
    <div className="h-[1px] w-12 bg-ink"></div>
  </div>
);

/**
 * Template preview thumbnail.
 *
 * Sourced from the static covers under `/public/images/templates/<slug>.jpg`
 * so the home-page teaser paints instantly without a Puppeteer cold-start.
 * Same files the `/templates` index uses (see Templates.tsx → `COVER`).
 *
 * `failed` state hides the broken-image glyph if the asset 404s rather than
 * persisting the imperative `style.visibility = "hidden"` hack that used to
 * latch on across re-renders.
 */
function TemplatePreviewImg({ slug, name }: { slug: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={`/images/templates/${slug}.jpg`}
      alt={`${name} template preview`}
      loading="lazy"
      decoding="async"
      onLoad={() => {
        if (failed) setFailed(false);
      }}
      onError={() => setFailed(true)}
      className={`w-full h-full object-cover object-top flex-1 min-h-0 ${
        failed ? "invisible" : ""
      }`}
    />
  );
}

const Squiggle = ({ className = "" }: { className?: string }) => (
  <svg aria-hidden="true" focusable="false" width="40" height="12" viewBox="0 0 40 12" fill="none" xmlns="http://www.w3.org/2000/svg" className={`opacity-40 ${className}`}>
    <path d="M1 6C4.83333 6 5.5 -1.5 9.5 2C13.5 5.5 13.5 10 17.5 10C21.5 10 21.5 2 25.5 2C29.5 2 29.5 10 33.5 10C37.5 10 37.5 6 39 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Mark = ({ className = "" }: { className?: string }) => (
  <div aria-hidden="true" className={`text-gold opacity-60 font-display text-3xl ${className}`}>❋</div>
);

// Reusable noise overlay — Atelier's signature paper texture.
const PaperNoise = ({ opacity = 0.3 }: { opacity?: number }) => (
  <div
    className="pointer-events-none absolute inset-0 z-10 mix-blend-multiply"
    style={{
      opacity,
      backgroundImage:
        'url("data:image/svg+xml,%3Csvg viewBox=%220 0 400 400%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")',
    }}
  />
);

export default function Home() {
  const { t, locale } = useI18n();
  const { open: openChat } = useChatbot();

  // Wouter is hash-blind; scroll-to-anchor needs a tiny manual nudge so
  // that links like /#templates-teaser land on the right section on
  // first paint (used by share-links, internal CTAs, and screenshots).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.location.hash.slice(1);
    if (!id) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
    });
  }, []);

  const seoTitle = t("home_seo_title");
  const seoDesc = t("home_seo_desc");
  void locale;

  // Atelier scroll parallax — portrait card lifts gently as the
  // hero scrolls out of view. Springed for buttery motion.
  const heroRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const portraitYRaw = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const portraitY = useSpring(portraitYRaw, {
    stiffness: 60,
    damping: 18,
    mass: 0.6,
  });

  return (
    <>
      <Seo
        title={seoTitle}
        description={seoDesc}
        path="/"
        jsonLd={[orgJsonLd, serviceJsonLd]}
      />

      <div className="relative font-display text-ink selection:bg-gold/20 selection:text-ink overflow-x-hidden">
        {/* Top brand-rule — terracotta hairline that anchors the page
            to the brand without competing with the header above. */}
        <div className="h-1.5 w-full bg-gold" />

        {/* ───── HERO ───── */}
        <section
          ref={heroRef}
          className="relative pt-16 pb-24 lg:pt-24 lg:pb-32 px-6 md:px-12 lg:px-16 max-w-[1400px] mx-auto"
        >
          <PaperNoise opacity={0.18} />
          <div className="relative z-20 grid grid-cols-12 gap-8 items-start">
            <div className="col-span-12 lg:col-span-7 lg:pr-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, ease }}
              >
                <div className="mb-8 flex items-center gap-4">
                  <span className="w-8 h-[1px] bg-sage" />
                  <span className="font-sans font-semibold text-[10px] tracking-[0.25em] uppercase text-sage">
                    {t("hero_eyebrow")}
                  </span>
                </div>

                <h1 className="text-[56px] sm:text-7xl md:text-8xl lg:text-[6.5rem] leading-[0.95] tracking-tight mb-10 text-ink">
                  {t("hero_title_l1")} <br />
                  <span className="italic text-gold">{t("hero_title_l2")}</span>
                </h1>

                <div className="pl-8 border-l-[1.5px] border-gold/30 max-w-2xl mb-12 ml-2">
                  <p className="text-2xl md:text-3xl leading-[1.3] opacity-90">
                    {t("hero_subhead")}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-6 ml-2">
                  <button
                    onClick={openChat}
                    className="group flex items-center gap-4 font-sans font-bold text-[11px] tracking-[0.25em] uppercase bg-ink text-cream px-8 py-4 rounded-sm hover:bg-gold transition-colors duration-300"
                  >
                    {t("hero_cta")}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <Link
                    href="/templates"
                    className="font-sans font-bold text-[11px] tracking-[0.25em] uppercase border-b border-ink/30 pb-1 hover:border-gold hover:text-gold transition-colors"
                  >
                    {t("hero_cta_secondary")}
                  </Link>
                </div>
              </motion.div>
            </div>

            <div className="col-span-12 lg:col-span-5 relative mt-16 lg:mt-0">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.5, delay: 0.4 }}
                style={{ y: portraitY }}
                className="relative aspect-[3/4] bg-cream-warm p-4 shadow-2xl rotate-2 mx-auto max-w-md"
              >
                <div className="absolute -left-6 -top-6 w-12 h-12 border-t border-l border-ink/20" />
                <div className="absolute -right-6 -bottom-6 w-12 h-12 border-b border-r border-ink/20" />
                <img
                  src={img("images/manifesto-therapist.png")}
                  alt=""
                  className="w-full h-full object-cover opacity-[0.85] grayscale-[0.3] contrast-125 mix-blend-multiply"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=800";
                  }}
                />
                <div className="absolute -bottom-8 -left-8 bg-cream p-5 shadow-xl border border-paper -rotate-3 max-w-[260px]">
                  <Mark className="absolute -top-4 -right-4 rotate-12" />
                  <p className="italic text-xl leading-[1.2] text-sage">
                    "{t("home_t1_quote")}"
                  </p>
                  <div className="w-8 h-[1px] bg-sage/30 mt-3" />
                  {/* Attribution: a quote without a name reads as stock
                      to a first-time visitor. The strings already carry
                      home_t1_name + home_t1_city — render them so the
                      composite testimonial is honestly labeled as such
                      (we'll keep "Composite — …" until real opt-ins
                      land). (Founder note 2026-05-02 — first-time
                      visitor story 2.) */}
                  <div className="mt-2 font-mono text-[10px] tracking-widest uppercase text-ink/55 leading-tight">
                    {t("home_t1_name")}
                    <span className="text-ink/30"> · </span>
                    {t("home_t1_city")}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ───── SOFT-LANDING REFRAMING ───── */}
        <section className="py-32 lg:py-40 relative bg-cream">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
              {/* The problem — directory grid */}
              <div className="relative">
                <div className="absolute -left-6 -top-6 w-14 h-14 border-t border-l border-gold/20" />
                <div className="pl-6 border-l-[1.5px] border-gold/30">
                  <span className="font-sans font-semibold text-[10px] tracking-[0.25em] uppercase text-gold mb-6 flex items-center gap-3">
                    {t("voice_dir_label")}
                  </span>
                  <h2 className="text-4xl md:text-5xl leading-[1.1] mb-6 text-ink font-medium">
                    {t("voice_title")}
                  </h2>
                  <p className="text-2xl italic opacity-80 leading-relaxed mb-6">
                    {t("voice_dir_body")}
                  </p>
                  <Squiggle className="opacity-30 text-ink" />
                </div>
              </div>

              {/* The solution — Ashford page */}
              <div className="bg-paper p-10 md:p-12 relative border border-paper rotate-1 shadow-sm mt-8 lg:mt-0 lg:ml-8">
                <span className="font-sans font-semibold text-[10px] tracking-[0.25em] uppercase text-sage mb-6 flex items-center gap-3">
                  <span className="w-8 h-[1px] bg-sage" />
                  {t("voice_ash_label")}
                </span>
                <h2 className="text-4xl md:text-5xl leading-[1.1] mb-6 text-ink font-medium">
                  {t("landing_title")}
                </h2>
                <p className="text-2xl leading-relaxed opacity-90 italic">
                  {t("voice_ash_body")}
                </p>
                <Mark className="absolute bottom-4 right-4 opacity-30" />
              </div>
            </div>
          </div>
        </section>

        {/* ───── EVERYTHING HANDLED (dark rail) ───── */}
        <section className="py-32 lg:py-40 bg-ink text-cream relative">
          <PaperNoise opacity={0.05} />
          <div className="relative z-20 max-w-[1400px] mx-auto px-6 md:px-12 lg:px-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
              <div className="lg:col-span-5">
                <h2 className="text-5xl md:text-6xl italic text-cream-warm mb-8 font-medium leading-none">
                  {t("home_handled_title")}
                </h2>
                <p className="opacity-70 text-2xl leading-relaxed max-w-lg">
                  {t("home_handled_subtitle")}
                </p>
                <OrnamentalRule className="mt-12 ml-0 w-32 justify-start opacity-20" />
              </div>

              <div className="lg:col-span-6 lg:col-start-7">
                <div className="space-y-16">
                  <div className="flex gap-8 items-start group">
                    <div className="w-20 h-20 flex-shrink-0 rounded-full border-[1.5px] border-gold flex items-center justify-center text-3xl italic text-gold pt-1 font-medium group-hover:bg-gold group-hover:text-cream transition-colors duration-500">
                      48
                    </div>
                    <div>
                      <h3 className="text-3xl mb-3 font-medium text-cream-warm">
                        {t("home_handled_48h_title")}
                      </h3>
                      <p className="opacity-60 text-xl leading-relaxed italic">
                        {t("home_handled_48h_body")}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-8 items-start group">
                    <div className="w-20 h-20 flex-shrink-0 rounded-full border-[1.5px] border-sage flex items-center justify-center text-2xl italic text-sage pt-1 font-medium group-hover:bg-sage group-hover:text-cream transition-colors duration-500">
                      ES
                    </div>
                    <div>
                      <h3 className="text-3xl mb-3 font-medium text-cream-warm">
                        {t("home_handled_bilingual_title")}
                      </h3>
                      <p className="opacity-60 text-xl leading-relaxed italic">
                        {t("home_handled_bilingual_body")}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-8 items-start group">
                    <div className="w-20 h-20 flex-shrink-0 rounded-full border-[1.5px] border-cream-warm/30 flex items-center justify-center text-4xl italic text-cream-warm/80 font-medium pb-2 group-hover:bg-cream-warm/10 transition-colors duration-500">
                      ∞
                    </div>
                    <div>
                      <h3 className="text-3xl mb-3 font-medium text-cream-warm">
                        {t("home_handled_hosting_title")}
                      </h3>
                      <p className="opacity-60 text-xl leading-relaxed italic">
                        {t("home_handled_hosting_body")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ───── VOICE QUOTE ───── */}
        <section className="py-24 lg:py-28 bg-cream border-b border-paper">
          <div className="max-w-5xl mx-auto px-6 md:px-12 lg:px-16 text-center">
            <Mark className="mx-auto mb-8" />
            <h3 className="text-3xl md:text-4xl leading-[1.4] italic text-ink font-medium max-w-4xl mx-auto">
              <Quote
                className="inline-block w-6 h-6 -mt-4 mr-2 text-gold opacity-50"
                aria-hidden
              />
              {t("home_voice_quote")}
            </h3>
          </div>
        </section>

        {/* ───── TEMPLATES TEASER ───── */}
        <section id="templates-teaser" className="py-32 lg:py-40 relative bg-paper scroll-mt-20">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-16">
            <div className="text-center mb-24 relative">
              <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-paper -z-10" />
              <div className="inline-block bg-paper px-12 relative z-10">
                <h2 className="text-5xl md:text-6xl mb-4 font-medium text-ink">
                  {t("home_templates_title_l1")}{" "}
                  <span className="italic text-gold">
                    {t("home_templates_title_l2")}
                  </span>
                </h2>
                <p className="max-w-2xl mx-auto text-2xl opacity-80 italic">
                  {t("home_templates_subtitle")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
              {([
                {
                  slug: "constellation",
                  name: t("home_tpl_constellation_name"),
                  desc: t("home_tpl_constellation_desc"),
                  href: "/template/constellation",
                  swatch: "bg-cream-warm",
                },
                {
                  slug: "garden",
                  name: t("home_tpl_garden_name"),
                  desc: t("home_tpl_garden_desc"),
                  href: "/template/garden",
                  swatch: "bg-paper",
                },
                {
                  slug: "polaroid",
                  name: t("home_tpl_polaroid_name"),
                  desc: t("home_tpl_polaroid_desc"),
                  href: "/template/polaroid",
                  swatch: "bg-cream",
                },
              ] as const).map((tpl) => (
                <Link key={tpl.name} href={tpl.href} className="group cursor-pointer block">
                  <div
                    className={`aspect-[3/4] ${tpl.swatch} p-6 relative shadow-sm border border-paper transition-transform duration-700 group-hover:-translate-y-2`}
                  >
                    <div className="w-full h-full border border-black/10 bg-white shadow-inner overflow-hidden flex flex-col">
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-paper/70 border-b border-black/10 flex-shrink-0">
                        <span className="w-2 h-2 rounded-full bg-black/15" />
                        <span className="w-2 h-2 rounded-full bg-black/15" />
                        <span className="w-2 h-2 rounded-full bg-black/15" />
                      </div>
                      <TemplatePreviewImg slug={tpl.slug} name={tpl.name} />
                    </div>
                    <div className="absolute -bottom-5 -right-5 w-14 h-14 bg-cream border border-paper rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-xl">
                      <ArrowUpRight className="w-5 h-5 text-ink" />
                    </div>
                  </div>
                  <div className="mt-8 text-center md:text-left md:pl-5 border-l-2 border-paper ml-3">
                    <h3 className="text-3xl italic mb-2 font-medium text-ink">
                      {tpl.name}
                    </h3>
                    <p className="text-[12px] opacity-60 font-sans tracking-[0.2em] uppercase font-bold">
                      {tpl.desc}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            <div className="text-center mt-20">
              <Link
                href="/templates"
                className="inline-flex items-center gap-2 font-sans text-[11px] font-bold tracking-[0.25em] uppercase border-b border-ink/30 pb-1 hover:border-gold hover:text-gold transition-colors"
              >
                {t("home_templates_view_all")}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* ───── PRICING MOMENT ───── */}
        <section className="py-32 lg:py-40 border-t border-paper bg-cream">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
              <div className="bg-paper p-10 md:p-16 border border-paper shadow-sm relative">
                <div className="absolute top-0 right-0 w-20 h-20 border-t border-r border-gold/20 m-3" />
                <span className="font-sans font-semibold text-[11px] tracking-[0.3em] uppercase text-sage mb-8 flex items-center gap-3">
                  <span className="w-8 h-[1px] bg-sage" />
                  {t("pricing_eyebrow")}
                </span>
                <h2 className="text-7xl md:text-[7rem] lg:text-[8rem] leading-none mb-10 font-medium text-ink">
                  From $199
                  <span className="text-3xl md:text-4xl italic opacity-60 ml-3 font-normal tracking-tight">
                    {t("pricing_monthly")}
                  </span>
                </h2>

                <div className="font-mono text-[10px] text-ink/45 leading-snug -mt-6 mb-10">
                  {t("pricing_tax_note")}
                </div>

                <div className="space-y-10 border-l-[1.5px] border-gold/30 pl-8">
                  <div>
                    <h4 className="font-sans font-bold text-gold mb-2 text-[12px] tracking-[0.25em] uppercase">
                      {t("pricing_a_label")}
                    </h4>
                    <p className="text-2xl opacity-90 italic">{t("pricing_a_desc")}</p>
                  </div>
                  <div>
                    <h4 className="font-sans font-bold text-ink mb-2 text-[12px] tracking-[0.25em] uppercase">
                      {t("pricing_b_label")}
                    </h4>
                    <p className="text-2xl opacity-90 italic">{t("pricing_b_desc")}</p>
                  </div>
                </div>

                <div className="mt-16 flex flex-wrap gap-4">
                  <Link
                    href="/pricing"
                    className="inline-flex items-center gap-2 font-sans text-[11px] font-bold tracking-[0.25em] uppercase border-b border-ink/30 pb-1 hover:border-gold hover:text-gold transition-colors"
                  >
                    {t("pricing_see_full")}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              <div className="flex flex-col justify-center lg:pl-8">
                <div className="relative">
                  <Mark className="mb-8 text-5xl" />
                  <h3 className="text-4xl md:text-5xl leading-[1.3] italic text-ink font-medium">
                    {t("home_studio_l1")}
                    <span className="block mt-8 text-gold not-italic text-3xl md:text-4xl font-normal">
                      {t("home_studio_l2")}
                    </span>
                  </h3>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ───── PROCESS ───── */}
        <section className="py-28 lg:py-32 bg-cream-warm border-t border-paper">
          <div className="max-w-4xl mx-auto px-6 md:px-12">
            <h2 className="text-4xl md:text-5xl text-ink mb-16 text-center leading-tight font-medium">
              {t("process_title")}
            </h2>

            <ol className="space-y-10 relative border-l-2 border-gold/40 pl-8">
              {[
                [t("process_step_1_title"), t("process_step_1_desc")],
                [t("process_step_2_title"), t("process_step_2_desc")],
                [t("process_step_3_title"), t("process_step_3_desc")],
                [t("process_step_4_title"), t("process_step_4_desc")],
                [t("process_step_5_title"), t("process_step_5_desc")],
              ].map(([title, desc], i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="relative"
                >
                  <div className="absolute -left-[42px] top-1 w-6 h-6 rounded-full bg-gold border-4 border-cream-warm flex items-center justify-center text-[10px] font-mono text-cream font-bold">
                    {i + 1}
                  </div>
                  <h3 className="font-display italic text-2xl md:text-3xl text-ink mb-2">
                    {title}
                  </h3>
                  <p className="font-serif text-[17px] md:text-[18px] text-ink/75 leading-relaxed">
                    {desc}
                  </p>
                </motion.li>
              ))}
            </ol>
          </div>
        </section>

        {/* ───── LIVE FEATURES — four shipping features quietly working
             in the background. Surfaced here, not buried on Pricing, so
             a prospect scanning the home page sees the operational
             surface area before reaching the CTA. ───── */}
        <section className="py-28 lg:py-32 border-t border-paper bg-cream">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-16">
            <div className="max-w-3xl mb-16">
              <span className="font-sans font-semibold text-[11px] tracking-[0.3em] uppercase text-sage mb-6 flex items-center gap-3">
                <span className="w-8 h-[1px] bg-sage" />
                {t("live_features_eyebrow")}
              </span>
              <h2 className="text-4xl md:text-5xl text-ink mb-4 leading-tight font-medium">
                {t("live_features_title")}
              </h2>
              <p className="font-serif text-lg text-ink/70 italic">
                {t("live_features_sub")}
              </p>
            </div>
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

        {/* ───── PageCTA — canonical full-bleed CTA ───── */}
        <PageCTA />
      </div>
    </>
  );
}
