import { Link } from "wouter";
import { useI18n } from "@site/lib/i18n";
import { TEMPLATE_COUNT, numberWord } from "@site/lib/templateCount";
import { Seo } from "@site/lib/seo";
import { PageCTA } from "@site/components/PageCTA";

type Step = { n: string; titleEn: string; titleEs: string; bodyEn: string; bodyEs: string };

const HOW_STEPS: Step[] = [
  {
    n: "01",
    titleEn: "We answer the phone — a Texas-based rep, not a chatbot",
    titleEs: "Contestamos el teléfono — un representante en Texas, no un bot",
    bodyEn:
      "First call is 12–15 minutes. You talk, we take notes. We listen for what your practice actually does and what kind of patient you wish was finding you. No script, no upsell sheet.",
    bodyEs:
      "La primera llamada dura 12–15 minutos. Tú hablas, nosotros tomamos notas. Escuchamos qué hace realmente tu práctica y qué tipo de paciente te gustaría que te encontrara. Sin guion ni hoja de venta cruzada.",
  },
  {
    n: "02",
    titleEn: `We build ${numberWord(TEMPLATE_COUNT, "en")} previews on your real practice info`,
    titleEs: `Construimos ${numberWord(TEMPLATE_COUNT, "es")} vistas previas con la información real de tu práctica`,
    bodyEn:
      `Within 48 hours we send ${numberWord(TEMPLATE_COUNT, "en")} complete template directions filled in with your name, your modalities, your city — by SMS and email. Click around, share with your spouse, sleep on it. We do all the work.`,
    bodyEs:
      `En 48 horas te enviamos ${numberWord(TEMPLATE_COUNT, "es")} direcciones de plantilla completas rellenadas con tu nombre, tus modalidades, tu ciudad — por SMS y correo. Mira, comparte con tu pareja, consúltalo con la almohada. Nosotros hacemos todo el trabajo.`,
  },
  {
    n: "03",
    titleEn: "You pick one, pay securely, and we keep going",
    titleEs: "Eliges una, pagas con seguridad y seguimos adelante",
    bodyEn:
      "Three plans, no surprise setup fees: Boutique $199/mo, Boutique Pro $299/mo, Concierge $649/mo — billed securely at checkout. 100% tax-deductible business expense (IRS §162); we send a W-9 and itemized invoices at year-end for your CPA. Cancel anytime in the first 90 days; after that, 30 days notice.",
    bodyEs:
      "Tres planes, sin tarifas de setup sorpresa: Boutique $199/mes, Boutique Pro $299/mes, Concierge $649/mes — pago seguro al reservar. Gasto comercial 100% deducible (IRS §162); enviamos un W-9 y facturas detalladas a fin de año para su contador. Cancela cuando quieras en los primeros 90 días; después, 30 días de aviso.",
  },
  {
    n: "04",
    titleEn: "Your site launches and we keep maintaining it — forever",
    titleEs: "Tu sitio se lanza y lo mantenemos — siempre",
    bodyEn:
      "Quietly looked after — site, Spanish version, crisis button, every detail. There's nothing for you to learn or maintain, and no 'web specialist' to hire later.",
    bodyEs:
      "Cuidado en silencio — el sitio, la versión en español, el botón de crisis, cada detalle. Nada que tú tengas que aprender ni mantener, y sin «especialista web» que contratar después.",
  },
];

export default function About() {
  const { t, locale } = useI18n();
  const es = locale === "es";

  return (
    <>
      <Seo
        title={es ? "Sobre Ashford Creative" : "About Ashford Creative"}
        description={t("about_sub")}
        path="/about"
      />

      {/* HERO — specific claim, not a vague "about us" */}
      <section className="bg-ink text-cream py-24 px-6 lg:px-12">
        <div className="max-w-5xl mx-auto">
          <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-gold mb-6">
            {es ? "Ashford Creative · Austin, TX" : "Ashford Creative · Austin, TX"}
          </div>
          <h1 className="font-display text-[40px] md:text-[64px] leading-[1.05] mb-8 text-balance">
            {es
              ? "Un pequeño estudio en Austin que construye y mantiene sitios para terapeutas de salud mental en Texas — para que tú no tengas que hacerlo."
              : "A small Austin studio that builds and maintains websites for Texas mental-health practitioners — so you don't have to."}
          </h1>
          <p className="font-serif text-[20px] md:text-[24px] leading-[1.55] text-cream/85 max-w-3xl text-pretty">
            {es
              ? "No hacemos sitios para restaurantes. No hacemos sitios para abogados. Pasamos los últimos años entrevistando a terapeutas de Texas sobre dos cosas — la tarea de tener un sitio web, y al paciente que sigue desplazándose en una cuadrícula de directorio. Tres planes desde $199 al mes, todo incluido. Nada que tú tengas que aprender ni mantener."
              : "We don't build for restaurants. We don't build for law firms. We spent the last few years interviewing Texas therapists about two things — the chore of owning a website, and the patient who keeps scrolling past them on a directory grid. Three plans from $199 a month, all-in. Nothing for you to learn or maintain."}
          </p>
        </div>
      </section>

      {/* WHY WE EXIST — three short cards */}
      <section className="py-24 px-6 lg:px-12 bg-cream">
        <div className="max-w-5xl mx-auto mb-20">
          <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-sage mb-4">
            {es ? "En qué creemos" : "What we believe"}
          </div>
          <h2 className="font-display text-3xl md:text-5xl text-ink mb-6 max-w-3xl leading-[1.1] text-balance">
            {es
              ? "Tres convicciones que dan forma al producto."
              : "Three convictions that shape the product."}
          </h2>
          <p className="font-mono text-[11px] text-ink/55 leading-snug max-w-2xl mb-10">
            {t("pricing_tax_note")}
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              [t("about_v1_title"), t("about_v1_body")],
              [t("about_v2_title"), t("about_v2_body")],
              [t("about_v3_title"), t("about_v3_body")],
            ].map(([title, body], i) => (
              <div
                key={i}
                className="bg-paper border border-ink/10 p-6 rounded-sm"
              >
                <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-sage mb-3">
                  0{i + 1}
                </div>
                <h3 className="font-display text-xl text-ink mb-3 leading-snug">{title}</h3>
                <p className="text-sm text-ink/75 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* HOW WE WORK — 4-step stepper */}
        <div className="max-w-5xl mx-auto mb-24">
          <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-sage mb-4">
            {es ? "Cómo trabajamos" : "How we work"}
          </div>
          <h2 className="font-display text-3xl md:text-5xl text-ink mb-12 max-w-3xl leading-[1.1]">
            {es
              ? "De una llamada a un sitio en vivo, en cuatro pasos."
              : "From one phone call to a live site, in four steps."}
          </h2>
          <div className="space-y-8">
            {HOW_STEPS.map((s) => (
              <div
                key={s.n}
                className="grid md:grid-cols-[80px_1fr] gap-4 md:gap-8 pb-8 border-b border-ink/10 last:border-b-0"
              >
                <div className="font-display text-4xl text-sage tabular-nums">{s.n}</div>
                <div>
                  <h3 className="font-display text-xl md:text-2xl text-ink mb-2 leading-snug">
                    {es ? s.titleEs : s.titleEn}
                  </h3>
                  <p className="text-base text-ink/75 leading-relaxed max-w-2xl">
                    {es ? s.bodyEs : s.bodyEn}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TRUST STRIP */}
        <div className="max-w-5xl mx-auto mb-24">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              [es ? "Solo Texas" : "Texas only", es ? "No atendemos fuera del estado" : "No out-of-state work"],
              [es ? "200 prácticas / pod" : "200 practices / pod", es ? "Modelo en pods" : "Pod model"],
              [es ? "Español incluido" : "Spanish included", es ? "EN + ES, incluido" : "EN + ES, included"],
              [es ? "Sin contrato anual" : "No annual contract", es ? "90 días para cancelar" : "90 days to cancel"],
            ].map(([h, sub], i) => (
              <div key={i} className="border-t border-ink/15 pt-4">
                <div className="font-display text-2xl md:text-3xl text-ink leading-tight mb-2">
                  {h}
                </div>
                <div className="text-xs text-ink/55 font-mono uppercase tracking-widest">
                  {sub}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WHO YOU'LL TALK TO — the real seven-person team behind every
            site. Each card carries a photo (mid-chest crop) plus the
            person's role and the one sentence describing what they
            actually do for you. The 8th "We're hiring" card stays
            initials-only — it's a placeholder, not a person yet.
            Names are intentional — Candice and Veronica are the two
            sales reps you might actually speak to on the first call. */}
        <div className="max-w-5xl mx-auto bg-ink text-cream rounded-sm p-10 md:p-14">
          <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-gold mb-4">
            {es ? "A quién le vas a hablar" : "Who you'll talk to"}
          </div>
          {/* Austin pod framing (Investor roleplay 2026-05-02 — story I1.)
              The previous copy ("seven people, capped at 200 sites") read
              as a lifestyle-business ceiling to a venture investor doing
              diligence — and it boxed us in even with our own clinicians,
              who would naturally ask "wait, am I site #199?". We now name
              the unit explicitly: a "pod" is the seven-person team that
              ships and supports up to 200 sites, and the company adds new
              regional pods as a market warrants one. The therapist still
              gets the small-team promise (the pod that picks up your call
              today is the pod that picks it up next year); the investor
              sees a unit-economic story they can multiply. The Pod #1
              location MUST match the eyebrow above ("Austin, TX") and the
              footer's "Austin, Texas" — Houston / Dallas / San Antonio
              are named only as future expansion markets so the geography
              stays consistent across the site. */}
          <h2 className="font-display text-3xl md:text-4xl mb-4 leading-tight">
            {es
              ? "Siete personas por pod. Cada pod cubre 200 prácticas."
              : "Seven people per pod. Each pod serves up to 200 practices."}
          </h2>
          <p className="font-serif text-base text-cream/80 leading-relaxed mb-10 max-w-3xl">
            {es
              ? "Austin Pod #1 está activo. Lo limitamos a 200 prácticas a propósito — para que el humano que toma tu llamada, el que diseña tu sitio y el que contesta cuando algo se rompe sean siempre las mismas siete personas. Cuando #1 esté lleno, abrimos un pod regional nuevo (Houston, Dallas, San Antonio) — nunca pedimos a un pod existente que crezca a costa del servicio."
              : "Austin Pod #1 is active. We cap each pod at 200 practices on purpose — so the human who picks up your call, the one who designs your site, and the one who answers when something breaks are always the same seven people. When Pod #1 is full, we open a new regional pod (Houston, Dallas, San Antonio) — we never ask an existing pod to grow at the cost of the service it owes the practices already inside it."}
          </p>

          {/* Bios were intentionally dropped on 2026-04-28 — the founder
              read the per-card paragraphs as job descriptions. The card
              now carries just the portrait, the name, and the role; the
              "real human picks up the phone" line below the grid does
              the rest of the work. */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { initial: "A", name: "Ashford",  role: es ? "Fundador"                  : "Founder"                  },
              { initial: "C", name: "Camille",  role: es ? "Operaciones & Finanzas"    : "Operations & Finance"     },
              { initial: "T", name: "Theo",     role: es ? "Diseño"                    : "Design"                   },
              { initial: "C", name: "Candice",  role: es ? "Ventas — Texas"            : "Sales — Texas"            },
              { initial: "V", name: "Veronica", role: es ? "Ventas — Español"          : "Sales — Spanish-language" },
              { initial: "M", name: "Marcus",   role: es ? "Ingeniería — Plataforma"   : "Engineering — Platform"   },
              { initial: "J", name: "Jonas",    role: es ? "Ingeniería — Producto"     : "Engineering — Product"    },
              { initial: "+", name: es ? "Tú, quizás" : "You, maybe", role: es ? "Estamos contratando" : "We're hiring" },
            ].map((m) => (
              <div
                key={m.name}
                className="bg-cream/[0.04] border border-cream/15 rounded-sm p-5 hover:border-gold/40 transition-colors flex items-center gap-3"
              >
                <div
                  className="w-12 h-12 flex items-center justify-center bg-gold text-ink font-display text-lg rounded-sm shrink-0"
                  aria-hidden
                >
                  {m.initial}
                </div>
                <div className="min-w-0">
                  <div className="font-display text-lg leading-tight">{m.name}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-cream/60 mt-0.5">
                    {m.role}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-cream/55 font-mono uppercase tracking-widest mt-10">
            {es
              ? "La persona real responde el teléfono."
              : "The real human picks up the phone."}
          </p>
          <div className="mt-6">
            <Link
              href="/how-it-works"
              className="inline-block bg-gold text-ink font-mono text-xs uppercase tracking-[0.2em] px-6 py-3 hover:bg-cream transition-colors"
            >
              {es ? "Ver cómo funciona" : "See how it works"}
            </Link>
          </div>
        </div>
      </section>

      {/* Live features callout — four LIVE Phase B features so a
          prospect reading "what we believe" sees what the platform
          actually ships with, not just the philosophy. */}
      <section className="py-24 px-6 lg:px-12 bg-paper border-t border-ink/10">
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
              <div key={title} className="bg-cream border border-ink/10 p-6 rounded-sm">
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
