import type { ReactNode } from "react";
import type { TemplateContent } from "./types";
import { useIsInternalViewer } from "@site/lib/viewerRole";

/**
 * Shared "wow factor" components used by every template so the
 * preview surfaces a consistent set of differentiators across the
 * 8 designs:
 *  - BookingButton: anchors a real Calendly/IntakeQ/etc. URL when
 *    we detected one on the prospect's site, falls back to tel:.
 *  - InsightsJournalSection: 3 specialty-aware article drafts.
 *  - InsuranceBadges: color-stylized chips per insurer brand.
 *  - DraftedPagesStrip: "Pages we already drafted" tab list.
 *  - ReviewsGrid: polished review cards with star rating.
 *
 * Each component is tone-aware (light vs dark) but layout-neutral —
 * the host template wraps it in its own section + spacing.
 */

interface BookingWidget {
  provider: string;
  url: string;
}

const readBookingWidget = (
  content: TemplateContent,
): BookingWidget | null => {
  const bw = (content as unknown as { bookingWidget?: BookingWidget | null })
    .bookingWidget;
  return bw ?? null;
};

interface JournalEntry {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  readingMinutes: number;
}

const readJournal = (content: TemplateContent): JournalEntry[] =>
  (content as unknown as { draftedJournalEntries?: JournalEntry[] })
    .draftedJournalEntries ?? [];

interface DraftedPage {
  kind: string;
  slug: string;
  title: string;
  h1: string | null;
  body: string[];
  sourceUrl: string | null;
}

const readDraftedPages = (content: TemplateContent): DraftedPage[] =>
  (content as unknown as { draftedPages?: DraftedPage[] }).draftedPages ?? [];

/**
 * Returns the href to use for the practice's primary "Book" /
 * "Begin Consultation" CTA. Prefers the detected booking widget URL,
 * else the contact phone, else `#`.
 */
export const bookingHref = (
  content: TemplateContent,
  phoneHref: string | null,
): { href: string; external: boolean } => {
  const bw = readBookingWidget(content);
  if (bw && /^https?:\/\//i.test(bw.url)) {
    return { href: bw.url, external: true };
  }
  if (phoneHref) return { href: phoneHref, external: false };
  return { href: "#", external: false };
};

interface InsightsJournalSectionProps {
  content: TemplateContent;
  locale: "en" | "es";
  /** Tailwind classes for the wrapper section. */
  className?: string;
  /** Tailwind classes for the heading copy. */
  headingClassName?: string;
  /** Tailwind classes for each card. */
  cardClassName?: string;
  /** Tailwind classes for the eyebrow. */
  eyebrowClassName?: string;
  /** Optional override for heading text (defaults to "Insights Journal"). */
  headingOverride?: string;
}

export const InsightsJournalSection = ({
  content,
  locale,
  className,
  headingClassName,
  cardClassName,
  eyebrowClassName,
  headingOverride,
}: InsightsJournalSectionProps): ReactNode => {
  const journal = readJournal(content);
  if (journal.length === 0) return null;
  return (
    <section className={className ?? "max-w-6xl mx-auto py-24 px-6 lg:px-12"}>
      <div className="text-center mb-12">
        <div
          className={
            eyebrowClassName ??
            "text-[10px] tracking-[0.3em] uppercase mb-3 opacity-60"
          }
        >
          {locale === "es" ? "Diario de ideas" : "Insights Journal"}
        </div>
        <h2 className={headingClassName ?? "text-3xl lg:text-4xl font-light tracking-tight"}>
          {headingOverride ??
            (locale === "es"
              ? "Tres artículos listos para tu primer mes."
              : "Three articles ready for your first month.")}
        </h2>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {journal.slice(0, 3).map((entry) => (
          <article
            key={entry.slug}
            className={cardClassName ?? "p-6 border border-current/10 hover:border-current/30 transition-colors"}
          >
            <div className="text-[10px] tracking-[0.3em] uppercase opacity-50 mb-3">
              {locale === "es" ? `${entry.readingMinutes} min de lectura` : `${entry.readingMinutes} min read`}
            </div>
            <h3 className="text-lg font-semibold mb-3 leading-snug">
              {entry.title}
            </h3>
            <p className="text-sm opacity-75 leading-relaxed line-clamp-5">
              {entry.excerpt}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
};

interface InsuranceBadgesProps {
  insurances: string[];
  /** Tone for the badge text (use "light" on dark backgrounds). */
  tone?: "dark" | "light";
  className?: string;
}

const CARRIER_INITIALS: Record<string, string> = {
  aetna: "Ae",
  "blue cross": "BC",
  bcbs: "BC",
  cigna: "Ci",
  unitedhealthcare: "UH",
  united: "UH",
  uhc: "UH",
  humana: "Hu",
  anthem: "An",
  oscar: "Os",
  oxford: "Ox",
  medicare: "Mc",
  medicaid: "Md",
  tricare: "Tr",
  kaiser: "Kp",
  emblem: "Em",
  beacon: "Bc",
};

const carrierInitials = (raw: string): string => {
  const k = raw.toLowerCase();
  for (const [key, val] of Object.entries(CARRIER_INITIALS)) {
    if (k.includes(key)) return val;
  }
  const stripped = raw.replace(/[^a-zA-Z]/g, "");
  return stripped.length >= 2
    ? stripped.slice(0, 2).replace(/^(.)(.)/, (_, a, b) => a.toUpperCase() + b.toLowerCase())
    : (stripped || "?").toUpperCase();
};

const isOutOfNetwork = (raw: string): boolean =>
  /out\s*of\s*network|fuera\s*de\s*red/i.test(raw);

/**
 * Transparent shield-monogram mark that adopts the surrounding text
 * color via currentColor — works on light and dark templates alike.
 * Generic shield silhouette + carrier initials, not a replica of any
 * carrier's protected logo.
 */
const InsuranceMark = ({ initials }: { initials: string }): ReactNode => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    style={{ flexShrink: 0 }}
  >
    <path
      d="M12 2.25 L19.5 5 V12 C19.5 16.6 16.2 20.5 12 21.75 C7.8 20.5 4.5 16.6 4.5 12 V5 Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.08"
    />
    <text
      x="12"
      y="14.6"
      textAnchor="middle"
      fontSize="7.2"
      fontWeight="700"
      fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
      fill="currentColor"
      letterSpacing="-0.04em"
    >
      {initials}
    </text>
  </svg>
);

export const InsuranceBadges = ({
  insurances,
  tone = "dark",
  className,
}: InsuranceBadgesProps): ReactNode => {
  if (insurances.length === 0) return null;
  const borderColor =
    tone === "light" ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.18)";
  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      {insurances.slice(0, 12).map((ins) => {
        const oon = isOutOfNetwork(ins);
        return (
          <span
            key={ins}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium tracking-tight"
            style={{
              backgroundColor: "transparent",
              color: "currentColor",
              border: `1px solid ${borderColor}`,
            }}
          >
            {!oon && <InsuranceMark initials={carrierInitials(ins)} />}
            {ins}
          </span>
        );
      })}
    </div>
  );
};

interface ReviewsGridProps {
  content: TemplateContent;
  locale: "en" | "es";
  className?: string;
  cardClassName?: string;
  /** When true, also pull from `testimonials`. */
  includeTestimonials?: boolean;
}

export const ReviewsGrid = ({
  content,
  locale,
  className,
  cardClassName,
  includeTestimonials = true,
}: ReviewsGridProps): ReactNode => {
  const fromReviews = content.reviews.map((r) => ({
    body: r.body,
    author: r.author,
    rating: r.rating,
    source: r.source ?? "Google",
  }));
  const fromTestimonials =
    includeTestimonials && content.testimonials
      ? content.testimonials.map((t) => ({
          body: t.body,
          author: t.author,
          rating: 5 as number | null,
          source: null,
        }))
      : [];
  const all = [...fromReviews, ...fromTestimonials];
  if (all.length === 0) return null;
  return (
    <div className={className ?? "grid md:grid-cols-2 lg:grid-cols-3 gap-6"}>
      {all.slice(0, 6).map((r, i) => (
        <article
          key={`${r.author ?? "anon"}-${i}`}
          className={cardClassName ?? "p-6 border border-current/10"}
        >
          <div className="text-amber-500 text-xs tracking-widest mb-3">
            {"★".repeat(Math.round(r.rating ?? 5))}
          </div>
          <blockquote className="text-sm leading-relaxed mb-4 line-clamp-6 opacity-90">
            {r.body}
          </blockquote>
          <div className="flex items-center justify-between text-[11px] uppercase tracking-widest opacity-60">
            <span>{r.author ?? (locale === "es" ? "Cliente" : "Client")}</span>
            {r.source && <span>{r.source}</span>}
          </div>
        </article>
      ))}
    </div>
  );
};

interface DraftedPagesStripProps {
  content: TemplateContent;
  locale: "en" | "es";
  className?: string;
  pillClassName?: string;
}

export const DraftedPagesStrip = ({
  content,
  locale,
  className,
  pillClassName,
}: DraftedPagesStripProps): ReactNode => {
  // A3 (founder 2026-05-17): this strip is internal-only — the
  // "Pages we have already drafted for you" wording leaks the
  // rep-prep workflow to the prospect. Default viewerRole is
  // "prospect" so the strip stays hidden unless an internal viewer
  // opts in via the URL (?viewer=rep|admin).
  const isInternal = useIsInternalViewer();
  const pages = readDraftedPages(content);
  if (!isInternal) return null;
  if (pages.length === 0) return null;
  return (
    <div className={className ?? "py-8 border-y border-current/10"}>
      <div className="text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4">
        {locale === "es"
          ? "Páginas que ya hemos redactado para ti"
          : "Pages we've already drafted for you"}
      </div>
      <div className="flex flex-wrap gap-2">
        {pages.slice(0, 8).map((p) => (
          <span
            key={p.slug}
            className={
              pillClassName ??
              "inline-flex items-center px-3 py-1.5 rounded-full text-xs border border-current/15 bg-current/5"
            }
          >
            {p.title}
          </span>
        ))}
      </div>
    </div>
  );
};
