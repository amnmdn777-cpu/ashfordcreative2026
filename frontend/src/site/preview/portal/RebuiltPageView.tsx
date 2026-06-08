import { useMemo, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useI18n } from "@site/lib/i18n";
import type { PortalPublicResponse, TemplateKey, PaletteDef } from "@workspace/api-zod";

const TEMPLATE_LABEL: Record<TemplateKey, string> = {
  garden: "Garden",
  sunrise: "Sunrise",
  constellation: "Constellation",
  polaroid: "Polaroid",
  playful_modern: "Playful Modern",
  front_porch: "Front Porch",
  hello_friend: "Hello Friend",
};

/**
 * Per-template "signature" — the lightweight visual cues that let a
 * rebuilt sub-page (About, Services, Privacy, etc.) feel like it
 * belongs to the chosen template without trying to clone the
 * heavily art-directed homepage hero. Each template gets:
 *  - rootClass: a body-level texture / background utility already
 *    defined in the template's CSS (paper grain, garden noise, etc.)
 *  - heroFrame: extra classes on the hero panel (border / shadow /
 *    rotation accent) that mirror the template's design language
 *  - eyebrowFont: which font family the small eyebrow label uses
 *  - headlineFont: serif vs display vs handwriting for the H1
 *  - accentBar: short className for the thin top accent line
 */
type Skin = {
  rootClass: string;
  heroFrame: string;
  eyebrowFont: string;
  headlineFont: string;
  accentBar: string;
  pullQuoteFont: string;
};

const TEMPLATE_SKINS: Record<TemplateKey, Skin> = {
  polaroid: {
    rootClass: "paper-texture",
    heroFrame: "bg-white/60 backdrop-blur-sm shadow-xl shadow-slate-900/5 border border-black/5 rounded-sm",
    eyebrowFont: "font-sans",
    headlineFont: "font-serif italic",
    accentBar: "bg-amber-700/60",
    pullQuoteFont: "font-handwriting",
  },
  garden: {
    rootClass: "pal-garden-noise",
    heroFrame: "border-t border-b py-8",
    eyebrowFont: "font-sans",
    headlineFont: "font-serif",
    accentBar: "bg-emerald-700/50",
    pullQuoteFont: "font-serif italic",
  },
  sunrise: {
    rootClass: "",
    heroFrame: "rounded-2xl shadow-md",
    eyebrowFont: "font-sans",
    headlineFont: "font-display",
    accentBar: "bg-gradient-to-r from-orange-400 to-rose-400",
    pullQuoteFont: "font-serif italic",
  },
  constellation: {
    rootClass: "",
    heroFrame: "border rounded-md",
    eyebrowFont: "font-mono",
    headlineFont: "font-display",
    accentBar: "bg-indigo-400/70",
    pullQuoteFont: "font-serif italic",
  },
  playful_modern: {
    rootClass: "",
    heroFrame: "rounded-3xl bg-white shadow-xl shadow-[#1a1a2e]/5 p-8",
    eyebrowFont: "font-sans uppercase tracking-widest text-[#1e40af]",
    headlineFont: "font-bold tracking-tight",
    accentBar: "bg-[#ee7c5c]/70",
    pullQuoteFont: "font-serif italic",
  },
  front_porch: {
    rootClass: "",
    heroFrame: "rounded-2xl shadow-md border-l-4 pl-6 border-[#C97B5A]",
    eyebrowFont: "font-sans uppercase tracking-widest",
    headlineFont: "font-serif",
    accentBar: "bg-[#C97B5A]/70",
    pullQuoteFont: "font-serif italic",
  },
  hello_friend: {
    rootClass: "",
    heroFrame: "rounded-3xl bg-white shadow-lg shadow-[#2D2A6E]/8 p-6",
    eyebrowFont: "font-sans uppercase tracking-widest",
    headlineFont: "font-bold tracking-tight",
    accentBar: "bg-[#FF8C7A]/80",
    pullQuoteFont: "font-serif italic",
  },
};

function pageHeadline(
  p: PortalPublicResponse["pages"][number],
  city?: string | null,
): string {
  let raw = (p.title ?? p.h1 ?? p.path).split(/[—|·]/)[0]?.trim() ?? "";
  // Some sites concatenate "<Page Title> <City>" in their page <title>
  // tag (Yoast / WP SEO default). Splitting on em-dash / pipe / middle-
  // dot leaves "Payment Info The Woodlands"; strip a trailing city
  // suffix when we know what city the prospect is in.
  if (city) {
    const trimmed = city.trim();
    if (trimmed.length > 0) {
      const trailing = new RegExp(
        `\\s+${trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
        "i",
      );
      raw = raw.replace(trailing, "").trim();
    }
  }
  return raw && raw.length > 0 ? raw : p.path;
}

/**
 * Per-page rebuild view rendered in the prospect portal whenever the
 * active page is anything other than the home page. We deliberately do
 * NOT clone each template's hero machinery (the polaroid stack, the
 * atrium ledger, etc.) — those are heavily art-directed for the
 * landing page and break visually on a "Privacy Policy" or "Contact"
 * sub-page. Instead, we apply each template's *signature* cues
 * (paper texture, accent bar color, headline font) plus universal
 * editorial polish — staggered entrance animations, a real hero panel
 * with a lead image, a drop cap, a pull-quote treatment for the
 * first short paragraph, and a varied imagery gallery (lead + thumbs)
 * — so each sub-page feels like a finished page from the same studio.
 *
 * The "view original" link at the bottom sends the prospect to the
 * actual page on their current website in a new tab — proof that we
 * really crawled their content rather than inventing it.
 */
export function RebuiltPageView({
  page,
  templateKey,
  palette: _palette,
  prospectCity,
}: {
  page: PortalPublicResponse["pages"][number];
  templateKey: TemplateKey;
  palette: PaletteDef;
  /** Prospect's city — used to strip a trailing location suffix from
   *  Yoast-concatenated `<title>` tags ("Payment Info The Woodlands"). */
  prospectCity?: string | null;
}) {
  const { t } = useI18n();
  const headline = pageHeadline(page, prospectCity);
  const templateLabel = TEMPLATE_LABEL[templateKey] ?? templateKey;
  const skin = TEMPLATE_SKINS[templateKey] ?? TEMPLATE_SKINS.garden;

  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -40]);

  // Split images into a lead (used in the hero panel) and a small
  // thumbnail strip below the body. If only one image exists it's
  // used as the lead and the strip is hidden — avoids the previous
  // "4 identical squares" feel.
  const { leadImage, thumbImages } = useMemo(() => {
    const imgs = page.images ?? [];
    if (imgs.length === 0) return { leadImage: null, thumbImages: [] as string[] };
    return { leadImage: imgs[0], thumbImages: imgs.slice(1, 5) };
  }, [page.images]);

  // Pull-quote candidate: the first short, sentence-y paragraph
  // (≤180 chars). Promotes a single line into editorial pull-quote
  // treatment — the kind of typographic moment every template's
  // homepage has but the old layout never gave sub-pages.
  const { pullQuote, bodyParagraphs } = useMemo(() => {
    const paras = page.paragraphs ?? [];
    const idx = paras.findIndex((p) => p.length > 40 && p.length <= 180);
    if (idx === -1) return { pullQuote: null, bodyParagraphs: paras.slice(0, 6) };
    const remaining = paras.filter((_, i) => i !== idx).slice(0, 6);
    return { pullQuote: paras[idx], bodyParagraphs: remaining };
  }, [page.paragraphs]);

  return (
    <article
      ref={containerRef}
      data-testid={`portal-rebuilt-page-${page.path}`}
      className={`relative min-h-screen overflow-hidden ${skin.rootClass}`}
      style={{
        backgroundColor: "var(--p-surface, #faf7f2)",
        color: "var(--p-ink, #1f2547)",
      }}
    >
      {/* Top accent bar — same hairline used across every template's
          first-fold ribbon, tinted with the chosen palette. */}
      <div
        className={`h-[3px] w-full ${skin.accentBar}`}
        style={{ backgroundColor: "var(--p-accent, currentColor)" }}
      />

      {/* HERO — title + intro on the left, lead image on the right.
          Subtle parallax on the headline column matches the gentle
          movement every template hero uses. */}
      <header className="border-b border-ink/10">
        <div className="max-w-6xl mx-auto px-6 sm:px-12 py-14 sm:py-20 grid md:grid-cols-12 gap-10 items-end">
          <motion.div
            style={{ y: heroY }}
            className="md:col-span-7 space-y-5"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className={`text-[10px] uppercase tracking-[0.28em] px-2 py-1 rounded-sm border ${skin.eyebrowFont}`}
                style={{
                  color: "var(--p-accent, #b08a3e)",
                  borderColor: "var(--p-accent, #b08a3e)",
                }}
              >
                {page.kind}
              </span>
              <span className={`text-[10px] uppercase tracking-[0.22em] text-ink/45 ${skin.eyebrowFont}`}>
                {t("portal_pages_rewritten_voice", { label: templateLabel })}
              </span>
            </div>
            <motion.h1
              className={`text-4xl sm:text-5xl md:text-6xl leading-[1.05] ${skin.headlineFont}`}
              style={{ color: "var(--p-ink, #1f2547)" }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            >
              {headline}
            </motion.h1>
            {page.rewrittenIntro ? (
              <motion.p
                className="text-lg sm:text-xl text-ink/75 max-w-2xl leading-relaxed font-serif"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.25 }}
              >
                {page.rewrittenIntro}
              </motion.p>
            ) : (
              <p className="text-sm italic text-ink/45 max-w-2xl">
                {t("portal_pages_draft_placeholder")}
              </p>
            )}
          </motion.div>

          {leadImage ? (
            <motion.div
              className={`md:col-span-5 overflow-hidden ${skin.heroFrame}`}
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.2, ease: "easeOut" }}
            >
              <img
                src={leadImage}
                alt=""
                className="w-full aspect-[4/3] object-cover"
                loading="lazy"
              />
            </motion.div>
          ) : (
            <div className="md:col-span-5" aria-hidden />
          )}
        </div>
      </header>

      {/* BODY — wider, single-column editorial flow with drop cap on
          the first paragraph, a pull-quote in the middle, and a
          thumbnail strip at the end. Replaces the previous narrow
          3-of-5 column + boxy aside that made every page look like
          a docs sidebar. */}
      <div className="max-w-3xl mx-auto px-6 sm:px-12 py-16 space-y-7">
        {bodyParagraphs.length > 0 && (
          <>
            <motion.div
              className={`text-[10px] uppercase tracking-[0.28em] text-ink/45 ${skin.eyebrowFont}`}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5 }}
            >
              {t("portal_rebuilt_body_eyebrow")}
            </motion.div>
            {bodyParagraphs.map((para, i) => (
              <motion.p
                key={i}
                className={[
                  "text-base sm:text-lg leading-[1.75] text-ink/85 font-serif",
                  i === 0
                    ? "first-letter:float-left first-letter:text-5xl first-letter:font-display first-letter:leading-[0.9] first-letter:mr-2 first-letter:mt-1"
                    : "",
                ].join(" ")}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.55, delay: Math.min(i * 0.06, 0.3) }}
              >
                {para}
              </motion.p>
            ))}
          </>
        )}

        {pullQuote && (
          <motion.blockquote
            className={`my-10 border-l-2 pl-6 text-2xl sm:text-3xl leading-snug text-ink/80 ${skin.pullQuoteFont}`}
            style={{ borderColor: "var(--p-accent, #b08a3e)" }}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
          >
            “{pullQuote}”
          </motion.blockquote>
        )}
      </div>

      {thumbImages.length > 0 && (
        <div className="max-w-5xl mx-auto px-6 sm:px-12 pb-16">
          <div className={`text-[10px] uppercase tracking-[0.28em] text-ink/45 mb-4 ${skin.eyebrowFont}`}>
            {t("portal_pages_imagery")}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {thumbImages.map((src, i) => (
              <motion.img
                key={src}
                src={src}
                alt=""
                className="w-full aspect-square object-cover rounded-sm border border-ink/5"
                loading="lazy"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
              />
            ))}
          </div>
        </div>
      )}

      {/* "View original" — proof we actually crawled the prospect's
          live site rather than inventing this page. Lives at the
          bottom so it never competes with the rebuilt content. */}
      {page.url && (
        <div className="max-w-3xl mx-auto px-6 sm:px-12 pb-20">
          <a
            href={page.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] border-b border-current pb-1 hover:opacity-70 transition-opacity ${skin.eyebrowFont}`}
            style={{ color: "var(--p-accent, #b08a3e)" }}
          >
            {t("portal_rebuilt_view_original")}
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
    </article>
  );
}
