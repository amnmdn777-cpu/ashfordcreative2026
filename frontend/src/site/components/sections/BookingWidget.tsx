import { useState } from "react";

/**
 * PHASE A.3 — online_booking with optional Calendly integration.
 *
 * If `calendlyUrl` is supplied (typed by the rep/admin into LeadDetail
 * and threaded through resolvePersona/content), we render an inline
 * Calendly iframe so the prospect books in-page on the public preview.
 *
 * Otherwise, the original contact-form fallback is preserved so
 * templates that don't have a Calendly hooked up still look complete.
 */
export function BookingWidget({
  practiceName,
  calendlyUrl,
}: {
  practiceName?: string;
  calendlyUrl?: string;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [slot, setSlot] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Calendly happy path — render the embed directly. The therapist's
  // own scheduler is the source of truth for availability, holds, and
  // confirmations; we get out of the way.
  if (calendlyUrl) {
    return (
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: "var(--color-text-muted)" }}
      >
        <div className="px-4 py-3 text-sm font-medium border-b" style={{ borderColor: "var(--color-text-muted)" }}>
          Book your first call · Reservar tu primera cita
        </div>
        <iframe
          src={calendlyUrl}
          width="100%"
          height={660}
          frameBorder={0}
          title="Book an appointment"
        />
        <div className="px-4 py-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
          <a
            href={calendlyUrl}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Open scheduler in new tab · Abrir en nueva ventana
          </a>
        </div>
      </div>
    );
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO(online-booking): fetch("/api/booking/request", { method: "POST", ... })
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="rounded-xl border p-6 text-sm" style={{ borderColor: "var(--color-text-muted)" }}>
        Thanks — your request was sent. {practiceName ?? "The practice"} will
        confirm by SMS or email shortly.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border p-6 space-y-3" style={{ borderColor: "var(--color-text-muted)" }}>
      <div className="text-sm font-medium">Request an appointment</div>
      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="w-full px-3 py-2 rounded border text-sm"
      />
      <input
        type="tel"
        placeholder="Phone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
        className="w-full px-3 py-2 rounded border text-sm"
      />
      <input
        type="datetime-local"
        value={slot}
        onChange={(e) => setSlot(e.target.value)}
        required
        className="w-full px-3 py-2 rounded border text-sm"
      />
      <button type="submit" className="w-full px-4 py-2 rounded text-sm font-medium" style={{ background: "var(--color-primary)", color: "white" }}>
        Request slot
      </button>
    </form>
  );
}
