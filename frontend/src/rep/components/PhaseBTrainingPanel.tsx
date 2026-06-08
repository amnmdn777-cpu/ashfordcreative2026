import { useState } from "react";
import { Link } from "wouter";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";

/**
 * Phase B training panel — Batch 4.a of the Phase 6 sales-rep dashboard
 * refresh.
 *
 * Surfaces the four new LIVE features the rest of the codebase has been
 * integrating, so reps can pitch them without misquoting the tier or
 * over-promising the scope. Bilingual EN/ES inline (matches the rep app's
 * existing pattern — see Onboarding.tsx — no shared strings.ts here).
 *
 * Tier assignments mirror lib/api-zod/src/pricing.ts CAPABILITIES + TIERS:
 *   - telehealth_bridge  → boutique_pro+
 *   - online_booking     → boutique_pro+
 *   - patient_onboarding_hub → boutique_pro+ (also free as a bundled add-on
 *     per CLAUDE.md — listed below the four cards)
 *   - blog_publishing (ghostwriter) → boutique_concierge only
 */

type FeatureEntry = {
  key: string;
  titleEn: string;
  titleEs: string;
  tier: string;
  whatEn: string;
  whatEs: string;
  pitchEn: string;
  pitchEs: string;
};

const PHASE_B_FEATURES: FeatureEntry[] = [
  {
    key: "telehealth_bridge",
    titleEn: "Telehealth /visit room",
    titleEs: "Sala de telesalud /visit",
    tier: "Boutique Pro · Concierge",
    whatEn:
      "HIPAA-aware video session room rendered at /visit/:sessionId on the practitioner's own domain.",
    whatEs:
      "Sala de sesión de video con cumplimiento HIPAA en /visit/:sessionId, en el dominio del clínico.",
    pitchEn:
      "“You can see clients on video right from your own site — no third-party Zoom link to share.”",
    pitchEs:
      "“Puedes atender pacientes en video desde tu propio sitio — sin compartir un enlace externo de Zoom.”",
  },
  {
    key: "online_booking",
    titleEn: "Online booking widget",
    titleEs: "Reservación en línea",
    tier: "Boutique Pro · Concierge",
    whatEn:
      "Embedded scheduler. Clients pick a slot from real availability, the practitioner one-taps to approve.",
    whatEs:
      "Calendario incrustado. El paciente elige un horario disponible y el clínico aprueba con un toque.",
    pitchEn:
      "“Clients pick a time on your site without phoning. You approve from your inbox in one tap.”",
    pitchEs:
      "“Los pacientes eligen un horario en tu sitio sin llamar. Tú apruebas desde el correo con un toque.”",
  },
  {
    key: "blog_publishing",
    titleEn: "Concierge ghostwriter",
    titleEs: "Redactor fantasma conserje",
    tier: "Concierge only",
    whatEn:
      "We ghostwrite blog posts and journal entries on the practitioner's behalf. 20-minute interview, one-click approve.",
    whatEs:
      "Escribimos artículos y entradas del diario por el clínico. Entrevista de 20 minutos y aprobación con un clic.",
    pitchEn:
      "“We write the words for you so your site stays fresh without homework.”",
    pitchEs:
      "“Nosotros escribimos por ti para que tu sitio se mantenga al día sin tarea extra.”",
  },
  // 2026-05-21 — `patient_onboarding_hub` training entry dropped (Sprint 2 streamline).
];

export function PhaseBTrainingPanel() {
  const [open, setOpen] = useState(false);

  return (
    <section
      className="mb-8 rounded-xl border border-card-border bg-card shadow-sm"
      data-testid="section-phase-b-training"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-accent" />
          <h2 className="font-serif text-lg">
            New live features — what to pitch
            <span className="text-muted-foreground font-sans text-xs ml-2">
              · Funciones nuevas — qué ofrecer
            </span>
          </h2>
        </div>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1">
          <p className="text-xs text-muted-foreground mb-4">
            Four features the codebase is shipping in production. Use the
            EN/ES one-liners verbatim — they match the marketing site copy.{" "}
            <Link
              href="/phase-b"
              className="text-accent hover:underline whitespace-nowrap"
            >
              Live-vs-skeleton status →
            </Link>
            <br />
            <span className="italic">
              Cuatro funciones en producción. Usa las frases EN/ES tal cual —
              coinciden con la copia del sitio. Estado en vivo vs esqueleto en{" "}
              <Link href="/phase-b" className="text-accent hover:underline not-italic">
                /phase-b
              </Link>
              .
            </span>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PHASE_B_FEATURES.map((f) => (
              <div
                key={f.key}
                className="rounded-md border border-card-border bg-background p-3"
                data-testid={`phase-b-feature-${f.key}`}
              >
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <div className="font-medium text-sm">
                    {f.titleEn}
                    <span className="text-muted-foreground font-normal italic ml-1">
                      · {f.titleEs}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-accent shrink-0">
                    {f.tier}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  <span className="font-medium text-foreground">
                    What it does:{" "}
                  </span>
                  {f.whatEn}
                  <br />
                  <span className="italic">
                    <span className="font-medium not-italic text-foreground">
                      Qué hace:{" "}
                    </span>
                    {f.whatEs}
                  </span>
                </div>
                <div className="text-xs">
                  <span className="font-medium">Pitch: </span>
                  {f.pitchEn}
                  <br />
                  <span className="italic text-muted-foreground">
                    <span className="not-italic font-medium text-foreground">
                      Frase:{" "}
                    </span>
                    {f.pitchEs}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
