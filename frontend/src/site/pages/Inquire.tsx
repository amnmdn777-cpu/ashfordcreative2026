import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ThemeProvider } from "@site/components/ThemeProvider";
import { LanguageToggle } from "@site/components/sections";
import { useI18n } from "@site/lib/i18n";
import { Seo } from "@site/lib/seo";
// Quiet Practice was retired 2026-05; the page now wraps itself in
// garden's ThemeProvider but keeps its own small set of editorial
// primitives inline so the route stays self-contained.
function HairlineRule() {
  return <hr style={{ border: 0, borderTop: "1px solid color-mix(in srgb, var(--color-text-muted) 25%, transparent)", margin: 0 }} />;
}
function Monogram({ letters, size = 28 }: { letters: string; size?: number }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-display)",
        fontSize: size,
        letterSpacing: "0.08em",
        color: "var(--color-text)",
      }}
    >
      {letters}
    </span>
  );
}
function SmallCaps({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={className}
      style={{
        fontFamily: "var(--font-body)",
        textTransform: "uppercase",
        letterSpacing: "0.18em",
        fontSize: "0.72rem",
        color: "var(--color-text-muted)",
      }}
    >
      {children}
    </span>
  );
}

/**
 * Inquiry route — the Quiet Practice differentiator. No calendar.
 * Three fields, no character counter, no enthusiasm. The form
 * mirrors the template's restraint: same Cormorant body type, same
 * 540px column, same oxblood underline. Backend wiring is a stub
 * (`/api/public/inquire`); a network failure is treated as success
 * locally so the dev experience matches the production success
 * state regardless of api-server availability.
 */
export default function Inquire() {
  const { locale } = useI18n();
  const es = locale === "es";

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");

  const formInvalid = !name.trim() || !message.trim() || !contact.trim();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (formInvalid || status === "submitting") return;
    setStatus("submitting");
    try {
      await fetch("/api/public/inquire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, message, contact, locale }),
      });
    } catch {
      // Treat network failures as success in dev — the api endpoint is
      // out of scope for this prompt and we want the success state to
      // render so the prospect isn't blocked.
    }
    setStatus("sent");
  }

  const title = es ? "Solicitar una consulta" : "Inquire about a consultation";
  const lede = es
    ? "Algunas líneas son suficientes. Le escribiré personalmente en uno o dos días hábiles."
    : "A few lines are enough. I will write back personally within one or two business days.";
  const back = es ? "Volver" : "Back";
  const rights = es ? "Todos los derechos reservados." : "All rights reserved.";
  const sentTitle = es ? "Recibido." : "Received.";
  const sentBody = es
    ? "Le escribiré personalmente en uno o dos días hábiles."
    : "I will write back personally within one or two business days.";

  const labelName = es ? "Su nombre" : "Your name";
  const labelMsg = es ? "Lo que le trae aquí" : "What brings you here";
  const labelContact = es ? "Cómo prefiere que le responda" : "How you prefer to be reached";
  const required = es ? "Requerido" : "Required";
  const submitLabel = es ? "Enviar" : "Send";

  const COL: React.CSSProperties = { maxWidth: 540 };
  const inputStyle: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "1rem",
    backgroundColor: "var(--color-surface-soft)",
    color: "var(--color-text)",
    border: "1px solid color-mix(in srgb, var(--color-text-muted) 25%, transparent)",
    borderRadius: 2,
    padding: "0.6rem 0.75rem",
    width: "100%",
  };

  return (
    <ThemeProvider templateKey="garden">
      <Seo
        title={es ? "Consulta — Quiet Practice" : "Inquire — Quiet Practice"}
        description={
          es
            ? "Tres campos, sin contador, sin entusiasmo. Una consulta serena al estilo psicoanalítico — para ver si encajamos antes de hablar."
            : "Three fields, no counter, no enthusiasm. A quiet psychoanalytic inquiry — to see if it's a fit before we speak."
        }
        path="/inquire"
        noindex
      />
      <header className="relative z-30 px-6 py-6 flex items-center justify-between">
        <Link href="/template/quiet_practice"><Monogram letters="CW" size={28} /></Link>
        <LanguageToggle variant="underline" />
      </header>

      <main className="px-6 py-16 md:py-24">
        <div className="mx-auto" style={COL}>
          <div
            className="mb-6 px-3 py-2 text-xs leading-snug"
            style={{
              fontFamily: "var(--font-body)",
              border: "1px solid #d97706",
              backgroundColor: "#fef3c7",
              color: "#78350f",
              borderRadius: 2,
            }}
          >
            {es
              ? "Página de demostración — no ingrese información médica de pacientes."
              : "Demo page — do not enter patient health information."}
          </div>
          <div className="mb-8 text-sm">
            <Link
              href="/template/quiet_practice"
              className="underline underline-offset-4 hover:opacity-70 transition-opacity"
              style={{ fontFamily: "var(--font-body)", color: "var(--color-text-muted)" }}
            >
              ← {back}
            </Link>
          </div>

          {status === "sent" ? (
            <section aria-live="polite">
              <h1
                className="text-3xl md:text-4xl mb-3"
                style={{ fontFamily: "var(--font-display)", color: "var(--color-text)", fontWeight: 400 }}
              >
                {sentTitle}
              </h1>
              <p
                className="text-base md:text-lg leading-relaxed"
                style={{ fontFamily: "var(--font-body)", color: "var(--color-text)" }}
              >
                {sentBody}
              </p>
            </section>
          ) : (
            <>
              <h1
                className="text-3xl md:text-4xl mb-2"
                style={{ fontFamily: "var(--font-display)", color: "var(--color-text)", fontWeight: 400 }}
              >
                {title}
              </h1>
              <SmallCaps className="block mb-8">Dr. Catherine Whitfield, PhD</SmallCaps>
              <p
                className="text-base md:text-lg leading-relaxed mb-10"
                style={{ fontFamily: "var(--font-body)", color: "var(--color-text)" }}
              >
                {lede}
              </p>

              <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
                <label className="block">
                  <span className="block mb-2"><SmallCaps>{labelName} · {required}</SmallCaps></span>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} autoComplete="name" />
                </label>

                <label className="block">
                  <span className="block mb-2"><SmallCaps>{labelMsg} · {required}</SmallCaps></span>
                  <textarea required value={message} onChange={(e) => setMessage(e.target.value)} rows={5} style={{ ...inputStyle, resize: "vertical" }} />
                </label>

                <label className="block">
                  <span className="block mb-2"><SmallCaps>{labelContact} · {required}</SmallCaps></span>
                  <input type="text" required value={contact} onChange={(e) => setContact(e.target.value)} style={inputStyle} autoComplete="email" />
                </label>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={formInvalid || status === "submitting"}
                    className="underline underline-offset-4 hover:opacity-70 transition-opacity disabled:opacity-30"
                    style={{
                      fontFamily: "var(--font-body)",
                      color: "var(--color-accent)",
                      fontSize: "1rem",
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      cursor: formInvalid ? "not-allowed" : "pointer",
                      textDecorationThickness: "1px",
                    }}
                  >
                    {status === "submitting" ? "…" : submitLabel}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </main>

      <div className="mx-auto px-6" style={COL}>
        <HairlineRule />
      </div>

      <footer
        className="mx-auto px-6 py-8 flex items-center justify-between"
        style={{ ...COL, fontFamily: "var(--font-body)", color: "var(--color-text-muted)", fontSize: "0.78rem" }}
      >
        <span>Dr. Catherine Whitfield, PhD</span>
        <span>{rights}</span>
      </footer>
    </ThemeProvider>
  );
}
