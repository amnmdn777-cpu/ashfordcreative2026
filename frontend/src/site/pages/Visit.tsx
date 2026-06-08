import { useEffect, useState } from "react";

/**
 * LOT 3.3 — telehealth_bridge /visit route.
 *
 * Renders a branded prep page that opens the practitioner's existing
 * Doxy.me / Zoom for Healthcare / SimplePractice room. The room URL is
 * sourced from a per-subscription admin field (telehealthRoomUrl) — when
 * missing, we render a polite placeholder card instead of a broken link.
 *
 * For prospect-preview contexts the room URL can be passed via the
 * window.__VISIT_ROOM_URL global injected by the portal renderer; in
 * production the URL is baked into the page during site build.
 *
 * TODO(telehealth-bridge):
 *   - Read telehealthRoomUrl from subscription record at build/render
 *   - i18n the prep card via useI18n() (currently bilingual via inline copy)
 *   - SimplePractice deep-link support
 */
export default function VisitPage() {
  const [roomUrl, setRoomUrl] = useState<string | null>(null);

  useEffect(() => {
    // Injected by template-build pipeline or portal renderer.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const url = (window as any).__VISIT_ROOM_URL as string | undefined;
    if (typeof url === "string" && url.length > 0) setRoomUrl(url);
  }, []);

  return (
    <div className="min-h-screen px-4 py-16 max-w-2xl mx-auto" style={{ background: "var(--color-surface, #f9f7f3)" }}>
      <h1 className="font-serif text-3xl mb-2" style={{ color: "var(--color-primary, #111)" }}>
        Welcome to your session
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--color-text-muted, #666)" }}>
        Bienvenido a su sesión
      </p>

      <div className="rounded-xl p-6 mb-6 border" style={{ borderColor: "var(--color-text-muted, #ccc)" }}>
        <div className="text-sm font-medium mb-3">Before your visit · Antes de su sesión</div>
        <ul className="text-sm space-y-1.5 list-disc pl-5" style={{ color: "var(--color-text, #333)" }}>
          <li>Find a quiet, private spot · Encuentre un lugar tranquilo</li>
          <li>Headphones if you can · Auriculares si puede</li>
          <li>Water and a notebook nearby · Agua y un cuaderno cerca</li>
        </ul>
      </div>

      {roomUrl ? (
        <a
          href={roomUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block w-full text-center px-6 py-3 rounded text-base font-medium"
          style={{ background: "var(--color-primary, #111)", color: "white" }}
        >
          Enter the waiting room · Entrar a la sala
        </a>
      ) : (
        <div className="rounded-xl p-6 border" style={{ borderColor: "var(--color-text-muted, #ccc)" }}>
          <div className="text-sm font-medium mb-1">Setup in progress</div>
          <p className="text-sm" style={{ color: "var(--color-text-muted, #666)" }}>
            We're configuring your telehealth room. Please call the practice
            to confirm your appointment. · Estamos configurando su sala de
            telesalud. Llame al consultorio para confirmar.
          </p>
        </div>
      )}
    </div>
  );
}
