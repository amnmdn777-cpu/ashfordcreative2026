/**
 * PHASE A.4 — DoxyBridge.
 *
 * If `doxyUrl` is provided (typed by the rep/admin into LeadDetail and
 * threaded through resolvePersona/content), we render a bilingual
 * "Join your secure video room" button that opens the therapist's
 * existing Doxy room in a new tab, plus a small "powered by Doxy" note.
 *
 * Otherwise, we render a bilingual explainer reassuring the prospect
 * that they keep their own Doxy account — we just bridge it onto their
 * site at sign-up.
 *
 * Section primitive: tokens only — no inline hex or font-family literals.
 */
export function DoxyBridge({ doxyUrl }: { doxyUrl?: string }) {
  if (doxyUrl) {
    return (
      <section
        className="rounded-xl border p-6 sm:p-8 space-y-4"
        style={{
          borderColor: "var(--color-text-muted)",
          background: "var(--color-surface-soft)",
        }}
      >
        <div className="space-y-1">
          <h3
            className="text-xl"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--color-text)",
            }}
          >
            Join your secure video room
          </h3>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Entra a tu sala segura de video
          </p>
        </div>
        <a
          href={doxyUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center px-5 py-3 rounded-lg text-sm font-medium"
          style={{
            background: "var(--color-primary)",
            color: "var(--color-surface)",
          }}
        >
          Enter waiting room · Entrar a la sala
        </a>
        <p
          className="text-xs italic"
          style={{ color: "var(--color-text-muted)" }}
        >
          powered by Doxy
        </p>
      </section>
    );
  }
  return (
    <section
      className="rounded-xl border p-6 sm:p-8 space-y-2"
      style={{
        borderColor: "var(--color-text-muted)",
        background: "var(--color-surface-soft)",
      }}
    >
      <h3
        className="text-xl"
        style={{
          fontFamily: "var(--font-display)",
          color: "var(--color-text)",
        }}
      >
        Telehealth, simply
      </h3>
      <p className="text-sm" style={{ color: "var(--color-text)" }}>
        You create your Doxy account, we bridge it to your site.
      </p>
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        Tú creas tu cuenta de Doxy, nosotros la conectamos a tu sitio.
      </p>
    </section>
  );
}

// Re-export under the legacy name some skins may import, so the wire-in
// in any template's telehealth slot just keeps working.
export { DoxyBridge as TelehealthBridge };
