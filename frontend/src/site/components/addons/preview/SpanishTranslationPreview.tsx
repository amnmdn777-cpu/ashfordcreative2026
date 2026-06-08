import { Languages, Check, RefreshCcw } from "lucide-react";

/**
 * Click-preview drawer body for the `spanish_translation` default
 * feature. Renders the same hero copy in EN and ES side-by-side, with
 * a small toggle pill above so the prospect feels the bilingual UX.
 * The "translation memory" footer hammers home that copy edits stay
 * in lockstep — no separate Spanish site to maintain.
 */
export const SpanishTranslationPreview = () => {
  const blocks = [
    {
      en: {
        eyebrow: "Welcome",
        title: "A grounded, evidence-based home for the work ahead.",
        body: "Dr. Maya Alvarado, LCSW. Anxiety, trauma, and life transitions for adults — in person in Austin, telehealth across Texas.",
      },
      es: {
        eyebrow: "Bienvenido",
        title: "Un espacio sereno y basado en evidencia para el trabajo que viene.",
        body: "Dra. Maya Alvarado, LCSW. Ansiedad, trauma y transiciones de vida para adultos — en persona en Austin, telesalud en todo Texas.",
      },
    },
  ];

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-ink/10 overflow-hidden">
        <div className="border-b border-ink/5 px-4 py-2.5 bg-cream/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Languages className="w-3.5 h-3.5 text-ink/55" />
            <span className="text-[11px] uppercase tracking-widest text-ink/55 font-mono">
              Hero block · live preview
            </span>
          </div>
          <div className="inline-flex rounded-full border border-ink/15 overflow-hidden text-[10px] font-mono uppercase tracking-widest">
            <span className="px-2.5 py-1 bg-ink text-cream">EN</span>
            <span className="px-2.5 py-1 text-ink/55">ES</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-ink/10">
          {blocks.map((b) => (
            <div key="row" className="contents">
              <div className="p-5">
                <div className="text-[10px] uppercase tracking-widest text-sage font-mono mb-1.5">
                  {b.en.eyebrow}
                </div>
                <h4 className="font-display text-lg text-ink leading-tight mb-2">
                  {b.en.title}
                </h4>
                <p className="text-[13px] text-ink/70 leading-relaxed">
                  {b.en.body}
                </p>
              </div>
              <div className="p-5 bg-cream-warm/40">
                <div className="text-[10px] uppercase tracking-widest text-sage font-mono mb-1.5">
                  {b.es.eyebrow}
                </div>
                <h4 className="font-display text-lg text-ink leading-tight mb-2">
                  {b.es.title}
                </h4>
                <p className="text-[13px] text-ink/70 leading-relaxed">
                  {b.es.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-cream-warm rounded-xl border border-ink/10 p-4">
        <div className="flex items-center gap-2 mb-2">
          <RefreshCcw className="w-3.5 h-3.5 text-sage" />
          <span className="text-[11px] uppercase tracking-widest text-ink/55 font-mono">
            Translation memory · last sync 14 min ago
          </span>
        </div>
        <ul className="space-y-1.5 text-[13px] text-ink/80">
          <li className="flex items-start gap-2">
            <Check className="w-3.5 h-3.5 text-sage shrink-0 mt-0.5" />
            <span>
              Edit copy in English once — the Spanish version updates the
              same minute, no separate site to maintain.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-3.5 h-3.5 text-sage shrink-0 mt-0.5" />
            <span>
              Clinical terms reviewed by a licensed bilingual editor — never
              raw machine output.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-3.5 h-3.5 text-sage shrink-0 mt-0.5" />
            <span>
              Visitor language detected automatically; manual EN/ES toggle
              always available in the header.
            </span>
          </li>
        </ul>
      </div>

      <div className="text-[11px] text-ink/55 italic leading-relaxed">
        Practices serving bilingual communities see 22-35% higher contact-form
        completion when the site speaks the patient's first language.
      </div>
    </div>
  );
};
