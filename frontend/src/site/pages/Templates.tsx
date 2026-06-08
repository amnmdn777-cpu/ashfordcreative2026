import { Link } from "wouter";
import { motion } from "framer-motion";
import { TEMPLATES } from "@workspace/api-zod";
import { useI18n } from "@site/lib/i18n";
import { Seo } from "@site/lib/seo";
import { PageCTA } from "@site/components/PageCTA";
import { img } from "@site/lib/api";

const PERSONA: Record<string, { en: string; es: string }> = {
  garden: {
    en: "for warm, family-friendly trauma-informed practices",
    es: "para prácticas cálidas, familiares e informadas en trauma",
  },
  sunrise: {
    en: "for perinatal and trauma-recovery practices that lead with hope",
    es: "para prácticas perinatales y de recuperación del trauma que apuestan por la esperanza",
  },
  constellation: {
    en: "for premium practices serving high-performing adults and creatives",
    es: "para prácticas premium que atienden a adultos y creativos exigentes",
  },
  polaroid: {
    en: "for solo therapists who want a personal, handwritten feel",
    es: "para terapeutas solos que buscan una calidez personal y escrita a mano",
  },
  playful_modern: {
    en: "for therapists who specialize in younger adults, anxiety and ADHD",
    es: "para terapeutas especializados en adultos jóvenes, ansiedad y TDAH",
  },
  front_porch: {
    en: "for couples and family therapists who want an honest, Texas-rooted feel",
    es: "para terapeutas de parejas y familias que buscan un aire honesto y tejano",
  },
  hello_friend: {
    en: "for small queer- and neurodivergent-friendly practices led by a person",
    es: "para prácticas pequeñas afirmativas queer y neurodivergentes con voz propia",
  },
};

// 2026-05: all 9 templates ship with curated photo/illustration thumbnails
// under public/images/templates/<key>.jpg. COVER is intentionally empty so
// every template falls through to its photographic cover.
const COVER: Record<string, string | null> = {};

// Designed thumbnails for templates we haven't captured a real screenshot
// of yet. Each is a tiny on-brand composition (not a generic gradient) so
// the prospect still gets a clear visual cue of the design direction —
// palette, type, motif — without us shipping a stale or misleading shot.
function PlaceholderThumb({ tplKey, label }: { tplKey: string; label: string }) {
  if (tplKey === "playful_modern") {
    return (
      <div
        className="relative w-full h-full overflow-hidden group-hover:scale-[1.02] transition-transform duration-700"
        style={{
          background:
            "linear-gradient(135deg, #FDF7F4 0%, #FF6B5A 50%, #2C2654 100%)",
        }}
      >
        <svg viewBox="0 0 400 300" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
          <g fill="#C9B6FF" opacity="0.85">
            <path d="M60 70c0-8 12-12 16-4 4-8 16-4 16 4 0 10-16 22-16 22S60 80 60 70z" />
            <circle cx="320" cy="60" r="10" />
            <path d="M310 200l8-16 8 16-8 4z" />
          </g>
          <g fill="#FFD86B">
            <circle cx="340" cy="220" r="14" />
            <circle cx="335" cy="217" r="2" fill="#2C2654" />
            <circle cx="345" cy="217" r="2" fill="#2C2654" />
            <path d="M332 223q8 6 16 0" stroke="#2C2654" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </g>
          <path d="M40 180q40-10 80 0t80 0 80-10 80 10" stroke="#FFFFFF" strokeWidth="2" fill="none" opacity="0.5" />
        </svg>
        <div className="absolute bottom-6 left-7 right-7">
          <div className="font-sans font-black text-3xl lg:text-4xl tracking-tight text-white drop-shadow">
            {label}
          </div>
        </div>
      </div>
    );
  }

  if (tplKey === "front_porch") {
    return (
      <div
        className="relative w-full h-full overflow-hidden group-hover:scale-[1.02] transition-transform duration-700"
        style={{ background: "#F8F0E5" }}
      >
        <svg viewBox="0 0 400 300" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
          <rect x="0" y="200" width="400" height="100" fill="#F2D67E" opacity="0.55" />
          <path d="M0 200 L200 110 L400 200 Z" fill="#6B4423" />
          <rect x="170" y="170" width="60" height="60" fill="#2F1F14" />
          <rect x="186" y="186" width="28" height="44" fill="#C97B5A" />
          <circle cx="208" cy="208" r="1.5" fill="#F2D67E" />
          <path d="M0 200 L400 200" stroke="#2F1F14" strokeWidth="1" opacity="0.4" />
          <g stroke="#6B4423" strokeWidth="1.2" opacity="0.6">
            <line x1="40" y1="230" x2="40" y2="280" />
            <line x1="80" y1="230" x2="80" y2="280" />
            <line x1="320" y1="230" x2="320" y2="280" />
            <line x1="360" y1="230" x2="360" y2="280" />
          </g>
        </svg>
        <div className="absolute top-6 left-7 right-7">
          <div className="font-serif italic text-4xl tracking-tight" style={{ color: "#2F1F14", fontFamily: "Fraunces, Georgia, serif" }}>
            {label}
          </div>
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase mt-1" style={{ color: "#6B4423" }}>
            San Antonio · Texas
          </div>
        </div>
      </div>
    );
  }

  if (tplKey === "hello_friend") {
    return (
      <div
        className="relative w-full h-full overflow-hidden group-hover:scale-[1.02] transition-transform duration-700"
        style={{ background: "#2D2A6E" }}
      >
        <svg viewBox="0 0 400 300" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
          <path
            d="M40 60 Q40 40 60 40 L300 40 Q320 40 320 60 L320 130 Q320 150 300 150 L120 150 L90 180 L100 150 L60 150 Q40 150 40 130 Z"
            fill="#FFD86B"
          />
          <text x="70" y="105" fontFamily="Inter, system-ui, sans-serif" fontWeight="700" fontSize="28" fill="#2D2A6E">
            Hi, I&apos;m Sam.
          </text>
          <circle cx="350" cy="220" r="32" fill="#FF8C7A" />
          <circle cx="342" cy="215" r="2.5" fill="#2D2A6E" />
          <circle cx="358" cy="215" r="2.5" fill="#2D2A6E" />
          <path d="M338 225 q12 10 24 0" stroke="#2D2A6E" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
        <div className="absolute bottom-6 left-7 right-7">
          <div className="font-sans font-bold text-3xl tracking-tight" style={{ color: "#FFF5EE", fontFamily: "Inter, system-ui, sans-serif" }}>
            {label}
          </div>
        </div>
      </div>
    );
  }

  // Generic fallback — neutral paper card with a wordmark.
  return (
    <div
      className="w-full h-full flex items-end p-7 group-hover:scale-[1.02] transition-transform duration-700"
      style={{ background: "linear-gradient(135deg, #fbf8f3 0%, #d4d4d8 55%, #3f3f46 100%)" }}
    >
      <div className="font-display text-3xl lg:text-4xl tracking-tight" style={{ color: "#1f2937" }}>
        {label}
      </div>
    </div>
  );
}

// Display order on the public /templates gallery, ranked by visual
// impact rather than catalog order. Independent of the per-prospect
// preview, where Garden is the safer default landing template.
const TEMPLATE_DISPLAY_ORDER = [
  // Bold visual leads — cinematic + architectural.
  "constellation",
  // Warm mid-pack — perinatal, family-friendly, Texas-rooted.
  "sunrise",
  "garden",
  "front_porch",
  // Personal / tactile / minimal voices.
  "polaroid",
  "hello_friend",
  // Placeholder card (no hero screenshot yet) trails the page.
  "playful_modern",
];

export default function Templates() {
  const { t, locale } = useI18n();
  const tpls = TEMPLATE_DISPLAY_ORDER
    .map((k) => TEMPLATES[k])
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  return (
    <>
      <Seo
        title={t("tpl_seo_title")}
        description={t("tpl_seo_desc")}
        path="/templates"
      />

      <section className="bg-ink text-cream py-24 px-6 lg:px-12">
        <div className="max-w-5xl mx-auto">
          <h1 className="font-display text-[44px] md:text-[64px] leading-tight mb-6 text-balance">
            {t("tpl_title")}
          </h1>
          <p className="font-serif text-[20px] md:text-[24px] leading-[1.55] text-cream/80 max-w-3xl text-pretty">
            {t("tpl_subtitle")}
          </p>
        </div>
      </section>

      <section className="py-20 px-6 lg:px-12 bg-cream">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {tpls.map((tpl, i) => (
            <motion.div
              key={tpl.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
            >
              <Link
                href={`/template/${tpl.key}`}
                className="block group bg-paper border border-ink/10 hover:border-sage/40 hover:shadow-lg transition-all rounded-sm overflow-hidden cursor-pointer"
              >
                <div className="aspect-[4/3] bg-ink/5 overflow-hidden">
                  <img
                    src={COVER[tpl.key] ?? img(`images/templates/${tpl.key}.jpg`)}
                    alt={tpl.label}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
                  />
                </div>
                <div className="p-6">
                  <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-sage mb-2">
                    {t("tpl_card_eyebrow")} · {tpl.font}
                  </div>
                  <h3 className="font-display text-2xl text-ink mb-2">
                    {tpl.label}
                  </h3>
                  <p className="text-sm text-ink/70 mb-3 leading-relaxed">
                    {tpl.description}
                  </p>
                  <p className="text-xs text-ink/55 italic">
                    {PERSONA[tpl.key]?.[locale]}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <PageCTA />
    </>
  );
}
