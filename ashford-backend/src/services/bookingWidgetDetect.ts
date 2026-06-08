/**
 * Detect existing third-party booking widgets on the prospect's
 * site so the prospect-preview can either embed the same widget
 * (so it works out of the box) or display a "Click to book on
 * Calendly" button. Surfaces a stronger wow moment than offering
 * to "set up booking" as a future task — the prospect already
 * uses Calendly/IntakeQ/SimplePractice/etc. and we mirror it.
 *
 * Detection happens against the homepage HTML returned by the
 * `website_meta` scraper (or any first-party HTML). Pure regex /
 * substring inspection — no network. Returns a structured
 * `BookingWidgetMatch` with the provider type and the canonical
 * embed URL we'd render.
 *
 * Pure function exported for unit tests.
 */
export type BookingProvider =
  | "calendly"
  | "intakeq"
  | "simplepractice"
  | "acuity"
  | "google_calendar"
  | "headway"
  | "psychology_today"
  | "tidycal"
  | "doxy"
  | "other";

export interface BookingWidgetMatch {
  provider: BookingProvider;
  /** Canonical URL we'd embed/link to. */
  url: string;
  /** Where on the homepage we found it (for diagnostics). */
  via: "iframe" | "anchor" | "script" | "data-url" | "redirect";
}

const PROVIDER_PATTERNS: Array<{
  provider: BookingProvider;
  iframe: RegExp;
  anchor: RegExp;
  script?: RegExp;
}> = [
  {
    provider: "calendly",
    iframe: /https?:\/\/(?:assets\.)?calendly\.com\/[^"'<>\s]+/i,
    anchor: /https?:\/\/calendly\.com\/[^"'<>\s)]+/i,
    script: /assets\.calendly\.com\/assets\/external\/widget\.js/i,
  },
  {
    provider: "intakeq",
    iframe: /https?:\/\/(?:[a-z0-9-]+\.)?intakeq\.com\/(?:booking|new|forms)\/[^"'<>\s]+/i,
    anchor: /https?:\/\/(?:[a-z0-9-]+\.)?intakeq\.com\/(?:booking|new|forms)\/[^"'<>\s)]+/i,
  },
  {
    provider: "simplepractice",
    iframe:
      /https?:\/\/(?:[a-z0-9-]+\.)?simplepractice\.com\/[^"'<>\s]+|widget\.simplepractice\.com/i,
    anchor:
      /https?:\/\/(?:[a-z0-9-]+\.)?simplepractice\.com\/(?:client_portal|book|appointments?)[^"'<>\s)]*/i,
    script: /widget\.simplepractice\.com/i,
  },
  {
    provider: "acuity",
    iframe: /https?:\/\/app\.(?:squarespacescheduling|acuityscheduling)\.com\/[^"'<>\s]+/i,
    anchor:
      /https?:\/\/(?:app\.acuityscheduling\.com|app\.squarespacescheduling\.com)\/(?:schedule|book)[^"'<>\s)]*/i,
  },
  {
    provider: "tidycal",
    iframe: /https?:\/\/tidycal\.com\/[^"'<>\s]+/i,
    anchor: /https?:\/\/tidycal\.com\/[^"'<>\s)]+/i,
  },
  {
    provider: "google_calendar",
    iframe: /https?:\/\/calendar\.google\.com\/calendar\/embed\?[^"'<>\s]+/i,
    anchor: /https?:\/\/calendar\.app\.google\/[^"'<>\s)]+/i,
  },
  {
    provider: "headway",
    iframe: /https?:\/\/care\.headway\.co\/(?:providers|book)\/[^"'<>\s]+/i,
    anchor: /https?:\/\/care\.headway\.co\/(?:providers|book)\/[^"'<>\s)]+/i,
  },
  {
    provider: "psychology_today",
    iframe: /n\/a/i, // PT doesn't iframe-embed — link only
    anchor:
      /https?:\/\/(?:www\.)?psychologytoday\.com\/(?:us|ca|uk)\/(?:therapists|psychiatrists)\/[^"'<>\s)]+/i,
  },
  {
    provider: "doxy",
    iframe: /https?:\/\/[a-z0-9-]+\.doxy\.me\/[^"'<>\s]+/i,
    anchor: /https?:\/\/[a-z0-9-]+\.doxy\.me\/[^"'<>\s)]+/i,
  },
];

export const detectBookingWidget = (
  html: string,
): BookingWidgetMatch | null => {
  if (!html) return null;
  // Scan iframes first — strongest signal (the widget is actually
  // embedded, not just linked).
  for (const p of PROVIDER_PATTERNS) {
    const iframeMatch = html.match(
      new RegExp(`<iframe\\b[^>]*?src=["'](${p.iframe.source})["']`, "i"),
    );
    if (iframeMatch?.[1]) {
      return {
        provider: p.provider,
        url: iframeMatch[1],
        via: "iframe",
      };
    }
  }
  // Then explicit script tags (Calendly's inline widget loader).
  for (const p of PROVIDER_PATTERNS) {
    if (!p.script) continue;
    if (p.script.test(html)) {
      // We don't know the booking URL from the script alone — fall
      // through to the anchor pass which does have it.
      const anchor = html.match(p.anchor);
      if (anchor?.[0]) {
        return {
          provider: p.provider,
          url: anchor[0],
          via: "script",
        };
      }
    }
  }
  // Then anchor href — many practices link out instead of embedding.
  for (const p of PROVIDER_PATTERNS) {
    const anchorMatch = html.match(
      new RegExp(`href=["'](${p.anchor.source})["']`, "i"),
    );
    if (anchorMatch?.[1]) {
      return {
        provider: p.provider,
        url: anchorMatch[1],
        via: "anchor",
      };
    }
  }
  // data-* attributes on a "Book now" button (common Calendly pattern).
  const dataUrlMatch = html.match(
    /data-(?:url|booking-url|calendly-url)=["'](https?:\/\/[^"']+)["']/i,
  );
  if (dataUrlMatch?.[1]) {
    const url = dataUrlMatch[1];
    for (const p of PROVIDER_PATTERNS) {
      if (p.anchor.test(url) || p.iframe.test(url)) {
        return { provider: p.provider, url, via: "data-url" };
      }
    }
    return { provider: "other", url, via: "data-url" };
  }
  return null;
};
