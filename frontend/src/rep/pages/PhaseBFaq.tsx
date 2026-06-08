import { Link } from "wouter";
import { ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@rep/components/RepLayout";

/**
 * Batch 4.d — Phase B FAQ page.
 *
 * Honest live-vs-skeleton status for the four new features so reps don't
 * over-promise on calls. Status assessments are based on a quick scan of
 * the api-server services as of this commit:
 *   - bookingRequestsQueue.ts is annotated "LOT 3.2 — online_booking SKELETON"
 *   - tierProvisioning.ts has TODOs for telehealth_bridge admin field
 *     and patient_onboarding_hub workspace init
 *   - no /visit/:sessionId route exists in artifacts/ashford-site yet
 *   - blog_publishing flows through editorial process (manual ghostwriting)
 *
 * Bilingual EN/ES inline (matches the rep app convention — there is no
 * shared strings.ts in this workspace).
 */

type Status = "live" | "skeleton" | "partial";

type Entry = {
  key: string;
  titleEn: string;
  titleEs: string;
  status: Status;
  whatLiveEn: string;
  whatLiveEs: string;
  whatPendingEn: string;
  whatPendingEs: string;
  safePitchEn: string;
  safePitchEs: string;
};

const ENTRIES: Entry[] = [
  {
    key: "telehealth_visit",
    titleEn: "Telehealth /visit room",
    titleEs: "Sala de telesalud /visit",
    status: "skeleton",
    whatLiveEn:
      "Tier capability flag wired into pricing, billing, and email proposals. Admin can stamp a telehealth room URL on each subscription.",
    whatLiveEs:
      "El indicador de capacidad del nivel está conectado a precios, facturación y propuestas por correo. El admin puede registrar una URL de telesalud por suscripción.",
    whatPendingEn:
      "No /visit/:sessionId route exists yet on the public site. The branded landing page that opens the practitioner's Doxy/Zoom room is still on the roadmap.",
    whatPendingEs:
      "Aún no existe la ruta /visit/:sessionId en el sitio público. La página con marca que abre la sala Doxy/Zoom del clínico sigue en la hoja de ruta.",
    safePitchEn:
      "“Telehealth is on the plan and your /visit page goes live during onboarding.” Avoid demoing a live URL — there isn't one yet.",
    safePitchEs:
      "“La telesalud está en el plan y tu página /visit se activa durante la incorporación.” Evita demostrar una URL en vivo — todavía no existe.",
  },
  {
    key: "online_booking",
    titleEn: "Online booking",
    titleEs: "Reservación en línea",
    status: "skeleton",
    whatLiveEn:
      "Booking request queue model + admin review surface exist on the API. Stripe SKU is provisioned. Tier-level inclusion is wired.",
    whatLiveEs:
      "El modelo de cola de solicitudes y la pantalla de revisión existen en la API. El SKU de Stripe está aprovisionado. La inclusión por nivel está conectada.",
    whatPendingEn:
      "The bookingRequestsQueue service is explicitly labelled SKELETON in the code. The one-tap email/SMS approval flow isn't fully wired end-to-end yet.",
    whatPendingEs:
      "El servicio bookingRequestsQueue está explícitamente marcado como SKELETON en el código. El flujo de aprobación con un toque por correo/SMS aún no está completamente conectado.",
    safePitchEn:
      "“Booking ships with onboarding — we'll wire your Google/Outlook calendar during week one.” Don't promise a same-day live demo.",
    safePitchEs:
      "“La reservación llega con la incorporación — conectamos tu calendario Google/Outlook en la primera semana.” No prometas demostración el mismo día.",
  },
  // 2026-05-21 — `patient_onboarding_hub` entry dropped (Sprint 2 streamline).
  {
    key: "concierge_ghostwriter",
    titleEn: "Concierge ghostwriter",
    titleEs: "Redactor fantasma conserje",
    status: "live",
    whatLiveEn:
      "Ghostwriting is delivered by the Ashford editorial team via the existing journal/blog publishing pipeline. Concierge tier explicitly includes it.",
    whatLiveEs:
      "El servicio de redacción lo entrega el equipo editorial de Ashford mediante el flujo existente de publicación del diario/blog. El nivel Concierge lo incluye explícitamente.",
    whatPendingEn:
      "No skeleton flags here — the workflow is human-driven, not awaiting code. Production rate is roughly one post per month per Concierge client.",
    whatPendingEs:
      "Sin etiquetas de skeleton — el flujo es humano, no espera código. Producción aproximada: una publicación al mes por cliente Concierge.",
    safePitchEn:
      "“We ghostwrite one piece a month off a 20-minute interview, you approve in one click.” Safe to promise on Concierge.",
    safePitchEs:
      "“Escribimos una pieza al mes desde una entrevista de 20 minutos, tú apruebas con un clic.” Seguro de prometer en Concierge.",
  },
];

function StatusBadge({ status }: { status: Status }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
        <CheckCircle2 size={11} /> Live · En vivo
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
        <AlertTriangle size={11} /> Partial · Parcial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-rose-100 text-rose-900 border border-rose-300">
      <AlertTriangle size={11} /> Skeleton · Esqueleto
    </span>
  );
}

export default function PhaseBFaqPage() {
  return (
    <div className="px-4 md:px-8 py-8 md:py-10 max-w-4xl">
      <PageHeader
        title="Phase B feature status — live vs skeleton"
        description="Honest assessment so reps don't over-promise. Estado honesto de las funciones nuevas."
        actions={
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
          >
            <ArrowLeft size={14} /> Back to dashboard
          </Link>
        }
      />

      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 mb-6 text-sm">
        <div className="font-medium mb-1">
          Read before pitching
          <span className="text-muted-foreground italic ml-2 font-normal">
            · Léelo antes de ofrecer
          </span>
        </div>
        <p className="text-muted-foreground">
          The pricing/proposal copy already markets these four features.
          That's fine — Concierge ghostwriting is live and onboarding hub
          forms are real. Avoid demoing the /visit URL or a same-day
          booking confirmation; both are skeletons today.
          <br />
          <span className="italic">
            La copia de precios/propuestas ya promociona estas cuatro
            funciones. Está bien — la redacción Concierge está activa y los
            formularios de incorporación son reales. Evita demostrar la URL
            /visit o una confirmación de reserva el mismo día; hoy son
            esqueletos.
          </span>
        </p>
      </div>

      <div className="space-y-4">
        {ENTRIES.map((e) => (
          <div
            key={e.key}
            className="rounded-md border border-card-border bg-card p-4"
            data-testid={`phase-b-faq-${e.key}`}
          >
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <h3 className="font-serif text-lg">
                {e.titleEn}
                <span className="text-muted-foreground font-sans text-xs italic ml-2">
                  · {e.titleEs}
                </span>
              </h3>
              <StatusBadge status={e.status} />
            </div>
            <dl className="text-sm space-y-2">
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  What's live · Qué está en vivo
                </dt>
                <dd className="text-foreground">
                  {e.whatLiveEn}
                  <br />
                  <span className="italic text-muted-foreground">
                    {e.whatLiveEs}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  What's pending · Qué está pendiente
                </dt>
                <dd className="text-foreground">
                  {e.whatPendingEn}
                  <br />
                  <span className="italic text-muted-foreground">
                    {e.whatPendingEs}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Safe pitch · Frase segura
                </dt>
                <dd className="text-foreground">
                  {e.safePitchEn}
                  <br />
                  <span className="italic text-muted-foreground">
                    {e.safePitchEs}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
