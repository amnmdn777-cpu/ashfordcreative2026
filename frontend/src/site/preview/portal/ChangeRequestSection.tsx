import { useState } from "react";
import { portalApi } from "./api";

type Props = {
  slug: string;
  locale?: "en" | "es";
};

const COPY = {
  en: {
    eyebrow: "Need a change?",
    title: "Request a change",
    intro:
      "Tell us what you'd like to update — typos, photos, new services, a different tone. Your rep will handle it from here.",
    placeholder:
      "What would you like changed?\n\nExample: 'Please swap the hero photo for the one I emailed last week, and add a new service called Couples Counseling.'",
    submit: "Send to my rep",
    sending: "Sending…",
    success: "Got it. Your rep will pick this up shortly.",
    again: "Send another",
    errorEmpty: "Please describe what you'd like changed.",
  },
  es: {
    eyebrow: "¿Necesitas un cambio?",
    title: "Solicita un cambio",
    intro:
      "Dinos qué te gustaría actualizar — erratas, fotos, servicios nuevos, otro tono. Tu rep se encarga del resto.",
    placeholder:
      "¿Qué te gustaría cambiar?\n\nEjemplo: «Por favor cambia la foto del héroe por la que envié la semana pasada y agrega un nuevo servicio llamado Terapia de Pareja».",
    submit: "Enviar a mi rep",
    sending: "Enviando…",
    success: "Recibido. Tu rep se ocupará pronto.",
    again: "Enviar otro",
    errorEmpty: "Por favor describe qué te gustaría cambiar.",
  },
} as const;

export function ChangeRequestSection({ slug, locale = "en" }: Props) {
  const t = COPY[locale === "es" ? "es" : "en"];
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = body.trim();
    if (!trimmed) {
      setError(t.errorEmpty);
      return;
    }
    setSubmitting(true);
    try {
      await portalApi.changeRequest(slug, trimmed);
      setSent(true);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      data-testid="change-request-section"
      className="my-12 rounded-xl border border-card-border bg-card/60 p-6 shadow-sm"
    >
      <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
        {t.eyebrow}
      </div>
      <h2 className="font-serif text-2xl text-foreground mb-2">{t.title}</h2>
      <p className="text-sm text-foreground/75 mb-4">{t.intro}</p>

      {sent ? (
        <div
          className="rounded-md border border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100 flex items-center justify-between gap-3"
          role="status"
        >
          <span>{t.success}</span>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="text-xs underline decoration-dotted underline-offset-2 hover:text-emerald-700"
          >
            {t.again}
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            maxLength={4000}
            placeholder={t.placeholder}
            data-testid="change-request-body"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
          />
          {error && (
            <div className="text-xs text-destructive" role="alert">
              {error}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground">
              {body.length} / 4000
            </span>
            <button
              type="submit"
              disabled={submitting || body.trim().length === 0}
              data-testid="change-request-submit"
              className="rounded-md bg-primary text-primary-foreground text-sm font-medium px-4 py-2 disabled:opacity-50"
            >
              {submitting ? t.sending : t.submit}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
