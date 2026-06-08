import { Check, Minus, X } from "lucide-react";
import { useI18n } from "@site/lib/i18n";

/**
 * BATCH 3.2 — Phase 5 competitor comparison table.
 *
 * Renders an at-a-glance comparison of Ashford against the three website
 * vendors most Texas mental-health practices weigh: Brighter Vision,
 * TherapySites, and SimplePractice. Used on /pricing, between the foundation
 * section and the self-serve checkout block.
 *
 * Editorial honesty rules baked into this component (per CLAUDE.md):
 *
 *   - We don't claim a competitor's exact monthly price unless it's a public,
 *     verifiable list price. Where we'd be guessing, we render "Verify"
 *     (rendered as a muted "—" badge), keyed via translations and described
 *     in the bilingual disclosure footer.
 *   - We don't claim a competitor doesn't have a feature unless we're
 *     confident. "Often add-on" / "Limited" labels are used for the
 *     conservative middle ground.
 *
 * Visual / DS notes: this is a /pricing-page section, not a template
 * primitive — it uses the page-level Ashford palette tokens (cream / ink /
 * sage / gold) directly, matching the surrounding Pricing.tsx sections
 * rather than the ThemeProvider CSS variables.
 */

type Cell =
  | { kind: "yes"; en: string; es: string }
  | { kind: "no"; en: string; es: string }
  | { kind: "partial"; en: string; es: string }
  | { kind: "verify" }
  | { kind: "text"; en: string; es: string };

type Row = {
  en: string;
  es: string;
  ashford: Cell;
  brighter: Cell;
  therapy: Cell;
  simple: Cell;
};

const yes = (en: string, es: string): Cell => ({ kind: "yes", en, es });
const no = (en: string, es: string): Cell => ({ kind: "no", en, es });
const partial = (en: string, es: string): Cell => ({
  kind: "partial",
  en,
  es,
});
const verify: Cell = { kind: "verify" };
const text = (en: string, es: string): Cell => ({ kind: "text", en, es });

const ROWS: Row[] = [
  {
    en: "Starting monthly price",
    es: "Precio mensual inicial",
    ashford: text("$199 (Boutique)", "$199 (Boutique)"),
    brighter: verify,
    therapy: verify,
    simple: text(
      "Bundled with EHR",
      "Incluido en el EHR",
    ),
  },
  {
    en: "Setup fee",
    es: "Cargo de configuración",
    ashford: yes("$0", "$0"),
    brighter: verify,
    therapy: verify,
    simple: verify,
  },
  {
    en: "Bilingual EN/ES (human-written, not machine-translated)",
    es: "Bilingüe EN/ES (escrito por humanos, no traducción automática)",
    ashford: yes("Default on every page", "Predeterminado en todas las páginas"),
    brighter: partial("Often add-on", "Generalmente complemento"),
    therapy: partial("Often add-on", "Generalmente complemento"),
    simple: partial("Limited", "Limitado"),
  },
  {
    en: "Setup time to a live site",
    es: "Tiempo hasta sitio en vivo",
    ashford: text("~10 business days", "~10 días hábiles"),
    brighter: verify,
    therapy: verify,
    simple: verify,
  },
  {
    en: "Online booking built in",
    es: "Reservas en línea integradas",
    ashford: yes("Pro & Concierge", "Pro y Concierge"),
    brighter: partial("Via integration", "Por integración"),
    therapy: partial("Via integration", "Por integración"),
    simple: yes("Native", "Nativo"),
  },
  {
    en: "Telehealth bridge to your existing room",
    es: "Puente de telesalud a tu sala existente",
    ashford: yes("Pro; white-glove on Concierge", "Pro; llave en mano en Concierge"),
    brighter: partial("Via integration", "Por integración"),
    therapy: partial("Via integration", "Por integración"),
    simple: yes("Native EHR", "EHR nativo"),
  },
  {
    en: "Ghostwritten clinical blog (Insights Journal)",
    es: "Diario clínico escrito por nosotros",
    ashford: yes("Concierge — 14+ pieces/yr", "Concierge — 14+ piezas/año"),
    brighter: no("Not included", "No incluido"),
    therapy: no("Not included", "No incluido"),
    simple: no("Not included", "No incluido"),
  },
  {
    en: "We don't collect patient health data — your EHR does",
    es: "No recopilamos datos médicos de pacientes — su EHR lo hace",
    ashford: yes("Yes", "Sí"),
    brighter: yes("Yes", "Sí"),
    therapy: yes("Yes", "Sí"),
    simple: yes("Yes (EHR holds patient data)", "Sí (EHR guarda los datos de pacientes)"),
  },
  {
    en: "Support response time",
    es: "Tiempo de respuesta de soporte",
    ashford: yes("Same business day, Texas team", "Mismo día hábil, equipo en Texas"),
    brighter: verify,
    therapy: verify,
    simple: verify,
  },
  {
    en: "Contract length / cancel anytime",
    es: "Duración del contrato / cancelar cuando quieras",
    ashford: yes(
      "Month-to-month; 30-day notice after 90d",
      "Mes a mes; aviso de 30 días tras 90d",
    ),
    brighter: verify,
    therapy: verify,
    simple: partial(
      "Tied to EHR subscription",
      "Atado a suscripción del EHR",
    ),
  },
  {
    en: "Tax-deductible (US small-business expense)",
    es: "Deducible de impuestos (gasto de pequeña empresa)",
    ashford: yes(
      "Yes — receipts include EIN",
      "Sí — recibos incluyen EIN",
    ),
    brighter: yes("Yes", "Sí"),
    therapy: yes("Yes", "Sí"),
    simple: yes("Yes", "Sí"),
  },
];

function CellRender({ cell, isAshford }: { cell: Cell; isAshford: boolean }) {
  const { locale } = useI18n();
  const es = locale === "es";
  if (cell.kind === "yes") {
    return (
      <div className="flex items-start gap-2">
        <Check
          className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isAshford ? "text-gold" : "text-sage"}`}
          aria-hidden
        />
        <span className="text-[13px] leading-snug text-ink/85">
          {es ? cell.es : cell.en}
        </span>
      </div>
    );
  }
  if (cell.kind === "no") {
    return (
      <div className="flex items-start gap-2">
        <X
          className="w-4 h-4 mt-0.5 flex-shrink-0 text-ink/40"
          aria-hidden
        />
        <span className="text-[13px] leading-snug text-ink/55">
          {es ? cell.es : cell.en}
        </span>
      </div>
    );
  }
  if (cell.kind === "partial") {
    return (
      <div className="flex items-start gap-2">
        <Minus
          className="w-4 h-4 mt-0.5 flex-shrink-0 text-ink/45"
          aria-hidden
        />
        <span className="text-[13px] leading-snug text-ink/70">
          {es ? cell.es : cell.en}
        </span>
      </div>
    );
  }
  if (cell.kind === "verify") {
    return (
      <span
        className="inline-block text-[11px] font-mono uppercase tracking-widest text-ink/45"
        title={
          es
            ? "No verificado por nosotros — pregunta al proveedor"
            : "Not verified by us — ask the vendor"
        }
      >
        {es ? "—  pregunta" : "—  ask"}
      </span>
    );
  }
  return (
    <span className="text-[13px] leading-snug text-ink/85">
      {es ? cell.es : cell.en}
    </span>
  );
}

export function CompetitorTable() {
  const { locale } = useI18n();
  const es = locale === "es";

  const headers = [
    {
      label: "Ashford",
      sub: es ? "Estudio en Texas" : "Texas studio",
      isAshford: true,
    },
    {
      label: "Brighter Vision",
      sub: es ? "Vendedor solo-salud-mental" : "Mental-health-only vendor",
      isAshford: false,
    },
    {
      label: "TherapySites",
      sub: es ? "Vendedor solo-salud-mental" : "Mental-health-only vendor",
      isAshford: false,
    },
    {
      label: "SimplePractice",
      sub: es ? "EHR con sitio incluido" : "EHR with bundled site",
      isAshford: false,
    },
  ];

  return (
    <section className="py-20 px-6 lg:px-12 bg-cream">
      <div className="max-w-6xl mx-auto">
        <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-sage mb-3">
          {es ? "Comparación honesta" : "Honest comparison"}
        </div>
        <h2 className="font-display text-3xl md:text-4xl text-ink mb-3 text-balance">
          {es
            ? "Cómo nos comparamos con las otras tres opciones."
            : "How we stack up against the other three options."}
        </h2>
        <p className="font-serif text-[18px] text-ink/75 leading-[1.55] max-w-3xl mb-10 text-pretty">
          {es
            ? "Una mirada lado a lado con Brighter Vision, TherapySites y SimplePractice. Donde no estábamos seguros del dato actual del competidor, lo marcamos como “—  pregunta” en vez de inventar. Si eres un proveedor citado aquí y algo está mal, escríbenos."
            : "A side-by-side with Brighter Vision, TherapySites, and SimplePractice. Where we weren't certain of a competitor's current published number, we mark it “—  ask” rather than guess. If you're a vendor named here and something is wrong, email us."}
        </p>

        {/* Desktop: a real grid table. Mobile: card stack. */}
        <div className="hidden md:block border border-ink/15 rounded-sm overflow-hidden">
          <div
            className="grid bg-ink text-cream"
            style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr" }}
          >
            <div className="px-4 py-4 font-mono text-[10px] uppercase tracking-widest text-cream/70">
              {es ? "Dimensión" : "Dimension"}
            </div>
            {headers.map((h) => (
              <div
                key={h.label}
                className={`px-4 py-4 ${h.isAshford ? "bg-gold/10" : ""}`}
              >
                <div className="font-display text-[17px] leading-tight">
                  {h.label}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-cream/65 mt-1">
                  {h.sub}
                </div>
              </div>
            ))}
          </div>
          {ROWS.map((row, idx) => (
            <div
              key={row.en}
              className={`grid ${idx % 2 === 0 ? "bg-cream" : "bg-cream-warm"} border-t border-ink/10`}
              style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr" }}
            >
              <div className="px-4 py-4 text-[13px] font-medium text-ink leading-snug">
                {es ? row.es : row.en}
              </div>
              <div className="px-4 py-4 bg-gold/5">
                <CellRender cell={row.ashford} isAshford />
              </div>
              <div className="px-4 py-4">
                <CellRender cell={row.brighter} isAshford={false} />
              </div>
              <div className="px-4 py-4">
                <CellRender cell={row.therapy} isAshford={false} />
              </div>
              <div className="px-4 py-4">
                <CellRender cell={row.simple} isAshford={false} />
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: per-row cards. */}
        <div className="md:hidden space-y-6">
          {ROWS.map((row) => (
            <div
              key={row.en}
              className="border border-ink/15 rounded-sm bg-cream p-4"
            >
              <div className="font-display text-[16px] text-ink mb-3 leading-snug">
                {es ? row.es : row.en}
              </div>
              <div className="space-y-2.5">
                {headers.map((h, i) => {
                  const cell = [row.ashford, row.brighter, row.therapy, row.simple][i];
                  return (
                    <div
                      key={h.label}
                      className={`flex items-start gap-3 ${h.isAshford ? "bg-gold/5 -mx-1 px-1 py-1 rounded-sm" : ""}`}
                    >
                      <div className="font-mono text-[10px] uppercase tracking-widest text-ink/60 w-24 flex-shrink-0 pt-1">
                        {h.label}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CellRender cell={cell} isAshford={h.isAshford} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <p className="font-mono text-[11px] text-ink/55 mt-6 leading-snug max-w-3xl">
          {es
            ? "Marcas registradas son propiedad de sus respectivos dueños. Esta tabla refleja nuestra mejor lectura del mercado en mayo de 2026 y es nuestra opinión, no asesoría legal o financiera."
            : "Trademarks belong to their respective owners. This table reflects our best read of the market as of May 2026 and is our opinion, not legal or financial advice."}
        </p>
      </div>
    </section>
  );
}

export default CompetitorTable;
