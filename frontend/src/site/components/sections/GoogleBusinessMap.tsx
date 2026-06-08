import { Phone } from "lucide-react";
import { useI18n } from "@site/lib/i18n";

/**
 * Google Business Map section. Renders a keyless Google Maps embed pinned
 * to the practitioner's office address, plus click-to-call and directions
 * links. The embed URL form `?q=<address>&output=embed` does not require
 * an API key and is supported indefinitely by Google.
 *
 * Demo callers omit `address` and get a generic Austin fallback. Real
 * prospect rendering should pass `address={lead.addressLine1, city, state}`
 * — the data already exists on the resolved persona / lead record.
 */

export function GoogleBusinessMap({
  address = "412 Main St, Austin, TX 78704",
  phone,
  hoursLine,
}: {
  address?: string;
  phone?: string;
  hoursLine?: string;
}) {
  const { locale } = useI18n();
  const es = locale === "es";
  const embedSrc = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  const telHref = phone ? `tel:${phone.replace(/[^0-9+]/g, "")}` : null;

  return (
    <section
      id="google-business-map"
      className="py-16 md:py-20"
      style={{ background: "var(--color-surface)" }}
    >
      <div className="max-w-6xl mx-auto px-6 md:px-12">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div
            className="overflow-hidden rounded-lg border shadow-sm"
            style={{ borderColor: "rgba(0,0,0,0.1)" }}
          >
            <iframe
              src={embedSrc}
              title={es ? "Mapa de la oficina" : "Office map"}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="w-full h-72 md:h-80 border-0 block"
              allowFullScreen
            />
          </div>
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.25em] font-mono mb-2"
              style={{ color: "var(--color-text-muted)" }}
            >
              {es ? "Encuéntranos" : "Find us"}
            </div>
            <h2
              className="text-2xl md:text-3xl leading-tight mb-3"
              style={{ fontFamily: "var(--font-display)", color: "var(--color-text)" }}
            >
              {es ? "En el mapa" : "On the map"}
            </h2>
            <p style={{ color: "var(--color-text)", fontFamily: "var(--font-body)" }}>
              {address}
            </p>
            {hoursLine && (
              <p
                className="mt-1 text-sm"
                style={{ color: "var(--color-text-muted)" }}
              >
                {hoursLine}
              </p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {telHref && (
                <a
                  href={telHref}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
                  style={{
                    background: "var(--color-primary)",
                    color: "var(--color-surface)",
                  }}
                >
                  <Phone className="w-4 h-4" />
                  {phone}
                </a>
              )}
              <a
                href={directionsHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border"
                style={{
                  borderColor: "var(--color-text-muted)",
                  color: "var(--color-text)",
                }}
              >
                {es ? "Cómo llegar" : "Get directions"}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default GoogleBusinessMap;
