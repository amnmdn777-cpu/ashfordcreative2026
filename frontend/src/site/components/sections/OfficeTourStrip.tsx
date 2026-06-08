import { useI18n } from "@site/lib/i18n";
// Office-tour demo images ship as responsive WebP at 400/800/1200 widths
// (LOT 7.1). Each variant stays under 250 KB; total payload dropped from
// ~6.6 MB (4 PNGs) to ~0.7 MB. The PNG originals are kept as the <img src>
// fallback for the rare browser that cannot decode WebP.
const waitingPng = "/addon-previews/office-tour-waiting.png";
const doorPng = "/addon-previews/office-tour-door.png";
const chairPng = "/addon-previews/office-tour-chair.png";
const exteriorPng = "/addon-previews/office-tour-exterior.png";
function webpSet(base: string) {
  return [400, 800, 1200]
    .map((w) => `/addon-previews/${base}-${w}.webp ${w}w`)
    .join(", ");
}

/**
 * Office Tour photo strip. Shipped as a default-feature primitive so
 * every non-Quiet-Practice template can render the four reassurance
 * photos prospects expect.
 *
 * TODO(data-source): per-prospect photos. Options under consideration:
 *   1. Manual rep upload during onboarding (preferred — quality control).
 *   2. Headway / Psychology Today scrape when the practitioner already
 *      has public office photos.
 *   3. Stock fallback per palette so the section never renders empty.
 *
 * Demo callers leave `photos` undefined and get the four warm-interior
 * placeholders bundled in /addon-previews/.
 */

export type OfficeTourPhoto = {
  src: string;
  webpSrcSet?: string;
  captionEn: string;
  captionEs: string;
};

const DEMO_PHOTOS: OfficeTourPhoto[] = [
  { src: doorPng, webpSrcSet: webpSet("office-tour-door"), captionEn: "the door", captionEs: "la puerta" },
  { src: waitingPng, webpSrcSet: webpSet("office-tour-waiting"), captionEn: "the waiting room", captionEs: "la sala de espera" },
  { src: chairPng, webpSrcSet: webpSet("office-tour-chair"), captionEn: "your chair", captionEs: "tu silla" },
  { src: exteriorPng, webpSrcSet: webpSet("office-tour-exterior"), captionEn: "the building", captionEs: "el edificio" },
];

export function OfficeTourStrip({
  photos = DEMO_PHOTOS,
  heading,
}: {
  photos?: OfficeTourPhoto[];
  heading?: string;
}) {
  const { locale } = useI18n();
  const es = locale === "es";
  return (
    <section
      id="office-tour"
      className="py-16 md:py-20"
      style={{ background: "var(--color-surface-soft, var(--color-surface))" }}
    >
      <div className="max-w-6xl mx-auto px-6 md:px-12">
        <div className="mb-8">
          <div
            className="text-[10px] uppercase tracking-[0.25em] font-mono mb-2"
            style={{ color: "var(--color-text-muted)" }}
          >
            {es ? "Visita la oficina" : "Office tour"}
          </div>
          <h2
            className="text-2xl md:text-3xl leading-tight"
            style={{ fontFamily: "var(--font-display)", color: "var(--color-text)" }}
          >
            {heading ?? (es ? "Antes de cruzar la puerta" : "Before you walk in")}
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {photos.map((p, i) => (
            <figure
              key={i}
              className="overflow-hidden rounded-lg border"
              style={{ borderColor: "rgba(0,0,0,0.08)", background: "var(--color-surface)" }}
            >
              <picture>
                {p.webpSrcSet && (
                  <source
                    type="image/webp"
                    srcSet={p.webpSrcSet}
                    sizes="(min-width: 768px) 25vw, 50vw"
                  />
                )}
                <img
                  src={p.src}
                  alt={es ? p.captionEs : p.captionEn}
                  className="w-full h-44 md:h-52 object-cover"
                  loading="lazy"
                />
              </picture>
              <figcaption
                className="px-3 py-2 text-[11px] font-mono uppercase tracking-wider"
                style={{ color: "var(--color-text-muted)" }}
              >
                {es ? p.captionEs : p.captionEn}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export default OfficeTourStrip;
