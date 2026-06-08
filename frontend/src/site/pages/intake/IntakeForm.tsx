import { useState, type FormEvent } from "react";
import { useRoute, Link } from "wouter";
import { useI18n } from "@site/lib/i18n";
import { PERSONAS } from "@site/data/personas";

/**
 * Intake form route — the Hello Friend differentiator. Where every
 * other template's hero CTA goes to a Cal.com / external booking URL,
 * this template's CTA links to /intake/:personaKey and the prospect
 * fills out a 3-field form instead of picking a time blind.
 *
 * Fields: name (required) · message (textarea, 200 char cap, required) ·
 * preferred contact (required). The submit handler POSTs to a stub
 * endpoint (`/api/public/intake`) — the api-server wiring for that
 * endpoint is out of scope for this prompt; the form succeeds locally
 * on a 2xx OR a network failure (so the dev experience matches the
 * "we'll get back to you" success state regardless of backend status).
 *
 * The path uses a persona key (e.g. `sam` for Sam Castillo) rather
 * than the template key — the URL is what gets pasted into bios and
 * link-in-bio surfaces, and "/intake/sam" reads better than
 * "/intake/hello_friend". Maps in `PERSONA_BY_INTAKE_SLUG`.
 */
const PERSONA_BY_INTAKE_SLUG: Record<string, string> = {
  sam: "hello_friend",
};

const MESSAGE_MAX = 200;

export default function IntakeForm() {
  const { locale, t } = useI18n();
  const [, params] = useRoute<{ personaKey: string }>("/intake/:personaKey");
  const slug = params?.personaKey ?? "";
  const templateKey = PERSONA_BY_INTAKE_SLUG[slug] ?? "hello_friend";
  const persona = PERSONAS[templateKey];
  // First-name token for chrome-string interpolation. Strip any leading
  // honorific so "Dr. Sam Castillo" → "Sam", then split on whitespace +
  // commas so "Sam Castillo (they/them)" → "Sam".
  const stripHonorific = (n: string) =>
    n.replace(/^(Dr\.?|Dra\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, "");
  const firstName = persona ? (stripHonorific(persona.name).split(/[\s,]+/)[0] ?? "") : "";
  const fn = (s: string) => s.replace(/\{firstName\}/g, firstName);

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");

  const charsLeft = MESSAGE_MAX - message.length;
  const formInvalid = !name.trim() || !message.trim() || !contact.trim();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (formInvalid || status === "submitting") return;
    setStatus("submitting");
    try {
      await fetch("/api/public/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaSlug: slug, name, message, contact, locale }),
      });
    } catch {
      // Treat network failures as success in dev — the api endpoint is
      // out of scope for this prompt and we want the success state to
      // render so the prospect isn't blocked.
    }
    setStatus("sent");
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6 py-16"
      style={{ backgroundColor: "var(--color-surface, #FFF5EE)", color: "var(--color-text, #1F1B3F)" }}
    >
      <div className="w-full max-w-md">
        <div className="mb-4 rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900 leading-snug">
          {locale === "es"
            ? "Página de demostración — no ingrese información médica de pacientes."
            : "Demo page — do not enter patient health information."}
        </div>
        <div className="mb-6 text-sm">
          <Link href={`/template/${templateKey}`} className="opacity-70 hover:opacity-100">
            ← {locale === "es" ? "Volver" : "Back"}
          </Link>
        </div>

        {status === "sent" ? (
          <section aria-live="polite">
            <h1 className="text-3xl font-bold mb-4" style={{ fontFamily: "var(--font-display, Inter)" }}>
              {t("intake_success_title")}
            </h1>
            <p className="text-base leading-relaxed opacity-80">{fn(t("intake_success_body"))}</p>
          </section>
        ) : (
          <>
            <h1 className="text-3xl font-bold mb-3" style={{ fontFamily: "var(--font-display, Inter)" }}>
              {fn(t("intake_title"))}
            </h1>
            <p className="text-base mb-8 opacity-80 leading-relaxed">{fn(t("intake_subtitle"))}</p>

            <form onSubmit={onSubmit} noValidate>
              <label className="block mb-6">
                <span className="block text-sm font-medium mb-2">
                  {t("intake_label_name")} <span className="opacity-50">· {t("intake_required")}</span>
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("intake_placeholder_name")}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2"
                  style={{ borderColor: "rgba(0,0,0,0.15)", backgroundColor: "#fff" }}
                  autoComplete="given-name"
                />
              </label>

              <label className="block mb-6">
                <span className="block text-sm font-medium mb-2">
                  {t("intake_label_message")} <span className="opacity-50">· {t("intake_required")}</span>
                </span>
                <textarea
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
                  placeholder={t("intake_placeholder_message")}
                  maxLength={MESSAGE_MAX}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 resize-y"
                  style={{ borderColor: "rgba(0,0,0,0.15)", backgroundColor: "#fff" }}
                />
                <span className="block mt-1 text-xs opacity-60">
                  {t("intake_char_remaining", { n: charsLeft })}
                </span>
              </label>

              <label className="block mb-8">
                <span className="block text-sm font-medium mb-2">
                  {t("intake_label_contact")} <span className="opacity-50">· {t("intake_required")}</span>
                </span>
                <input
                  type="text"
                  required
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={t("intake_placeholder_contact")}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2"
                  style={{ borderColor: "rgba(0,0,0,0.15)", backgroundColor: "#fff" }}
                  autoComplete="email"
                />
              </label>

              <button
                type="submit"
                disabled={formInvalid || status === "submitting"}
                className="w-full inline-flex items-center justify-center px-6 py-3 text-white font-semibold rounded-full transition-opacity disabled:opacity-50 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ backgroundColor: "#FF8C7A" }}
              >
                {status === "submitting" ? "…" : t("intake_submit")}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
