import { Helmet } from "react-helmet-async";
import { useI18n } from "@site/lib/i18n";

export const SITE_URL = "https://ashfordcreative.org";
export const SITE_NAME = "Ashford Creative";
const BASE = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : import.meta.env.BASE_URL + "/";
// Switched to PNG (Satori-rendered) — social scrapers reject SVG og:image.
export const OG_IMAGE = `${SITE_URL}${BASE}og.png`;

interface SeoProps {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
  jsonLd?: object | object[];
  type?: "website" | "article";
  noindex?: boolean;
}

export function Seo({
  title,
  description,
  path,
  ogImage = OG_IMAGE,
  jsonLd,
  type = "website",
  noindex = false,
}: SeoProps) {
  // The active locale is the authority for <html lang>, og:locale, and which
  // hreflang URL becomes the canonical. Pulled here (not threaded through every
  // caller) so existing Seo call-sites keep working as the i18n state changes.
  const { locale } = useI18n();
  const fullTitle =
    title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const enUrl = `${SITE_URL}${BASE}${cleanPath}`;
  const esUrl = `${enUrl}${enUrl.includes("?") ? "&" : "?"}lang=es`;
  const url = locale === "es" ? esUrl : enUrl;
  // Social-share scrapers (iMessage/Slack/Facebook/Twitter) require absolute
  // URLs for og:image and twitter:image. Absolutize any root-relative path so
  // callers can pass either form.
  const absOgImage = /^https?:\/\//i.test(ogImage)
    ? ogImage
    : `${SITE_URL}${ogImage.startsWith("/") ? ogImage : `/${ogImage}`}`;
  const lds = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  // Token-leak guard: prospect-preview routes (`/p/:token`) pass `noindex`
  // because the URL itself is the credential. Even with `noindex`, social-
  // share scrapers (iMessage/Slack) read `og:url` and copy-link extensions
  // read `<link rel="canonical">`, so emitting either would leak the token
  // out of the rep→prospect channel. For noindex pages we drop both and
  // collapse `og:url` to the marketing root.
  const safePublicUrl = noindex ? SITE_URL : url;
  const ogLocale = locale === "es" ? "es_ES" : "en_US";
  const ogLocaleAlt = locale === "es" ? "en_US" : "es_ES";

  return (
    <Helmet>
      <html lang={locale === "es" ? "es" : "en"} />
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {!noindex && <link rel="canonical" href={url} />}
      {!noindex && (
        <link rel="alternate" hrefLang="en" href={enUrl} />
      )}
      {!noindex && (
        <link rel="alternate" hrefLang="es" href={esUrl} />
      )}
      {!noindex && (
        <link rel="alternate" hrefLang="x-default" href={enUrl} />
      )}
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:locale" content={ogLocale} />
      <meta property="og:locale:alternate" content={ogLocaleAlt} />
      <meta property="og:url" content={safePublicUrl} />
      <meta property="og:image" content={absOgImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absOgImage} />

      {lds.map((ld, i) => (
        <script key={i} type="application/ld+json">
          {/*
            Escape `<` so a value containing the literal string `</script>`
            cannot break out of this script tag. `JSON.stringify` does NOT
            escape angle-brackets — without this guard, any field that ever
            carried `</script>` (DB compromise, admin-author free input)
            ships as executable JS in the prospect's browser. The forward
            slash escape covers `<!--` HTML-comment trickery as well.
          */}
          {JSON.stringify(ld)
            .replace(/</g, "\\u003c")
            .replace(/-->/g, "--\\u003e")}
        </script>
      ))}
    </Helmet>
  );
}

export const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: OG_IMAGE,
  description:
    "Boutique websites for Texas mental health practitioners. $199/mo, no contracts.",
  address: {
    "@type": "PostalAddress",
    addressRegion: "TX",
    addressCountry: "US",
  },
};

export const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: "Website design and ongoing care for therapists",
  provider: { "@type": "Organization", name: SITE_NAME },
  areaServed: { "@type": "AdministrativeArea", name: "Texas" },
  // AggregateOffer spans the three customer tiers (Boutique $199, Boutique
  // Pro $299, Concierge $649). The previous "$149" was the rep-bonus number,
  // never a customer price — Google was indexing it as our starting price.
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "199",
    highPrice: "649",
    offerCount: 3,
  },
};
