import { MapPin, Star, RefreshCw, AlertTriangle, Phone } from "lucide-react";
import { isGoogleInlineFullySynced } from "@workspace/api-zod";
import { useI18n } from "@site/lib/i18n";
import { RibbonHeader } from "./RibbonHeader";
import {
  usePortalEnrichment,
  useLeadPracticeName,
} from "../portalEnrichmentContext";

/**
 * Inline preview for `google_profile_sync`. Faux Google Business
 * Profile card with "in sync" badge plus a small weekly-checks panel.
 *
 * When rendered inside a real lead portal we hydrate the practice
 * name, address, phone, rating, review count, the first profile photo,
 * and today's hours from the lead's Google Places enrichment so the
 * prospect sees their OWN listing. Falls back to translated sample
 * copy on the public template-browse surface where no enrichment is
 * available.
 *
 * Empty-state honesty: when this component is mounted inside a real
 * lead portal (i.e. `leadPracticeName` is set by the portal provider)
 * but the underlying enrichment payload has no usable address / phone
 * / rating, we render a small "couldn't sync — sample shown" notice
 * above the card and swap the synced ribbon for a warning ribbon.
 * That way the prospect doesn't see their real practice name sitting
 * next to a fake "(512) 555-0198" phone — which is what made Candice
 * call this card "broken" during her walkthrough.
 */
export const GoogleProfileSyncInline = ({ included }: { included?: boolean }) => {
  const { t, locale } = useI18n();
  const enrichment = usePortalEnrichment();
  const leadPracticeName = useLeadPracticeName();
  const trim = (s: string | null | undefined): string | null => {
    if (!s) return null;
    const v = s.trim();
    return v ? v : null;
  };
  const realName = trim(leadPracticeName);
  const realAddress = trim(enrichment?.formattedAddress ?? null);
  const realPhone = trim(enrichment?.formattedPhone ?? null);
  const realRating = enrichment?.rating ?? null;
  const realReviews = enrichment?.totalReviews ?? null;
  const realPhoto = trim(enrichment?.photoUrls?.[0] ?? null);
  // Use the shared predicate from @workspace/api-zod so the rep
  // dashboard's enrichment-status row and this inline card can never
  // disagree about whether a lead is "fully synced". The card needs
  // ALL three identity fields (address, phone, rating) attributed to
  // google_places — if even one is missing or came from a different
  // source we'd be silently substituting a sample value (e.g. real
  // address next to a fake "(512) 555-0198" phone). That partial-mix
  // is what makes the card "look broken" during a walkthrough.
  const isFullySynced = isGoogleInlineFullySynced(
    enrichment?.fieldSources ?? null,
  );
  // "Inside a real lead portal" = the portal provider set a practice
  // name on the context. Without that we're on the public template
  // browse surface or the mockup sandbox, where pure sample copy is
  // intentional and no warning is appropriate.
  const isRealPortal = realName != null;
  const showEmptyNotice = isRealPortal && !isFullySynced;
  // Today's open band for the inline pill, picked off the enrichment
  // hours array. PortalEnrichmentHours.day is a free-form weekday
  // name ("Monday", "Mon", "Lunes" ...). We match the first entry
  // whose day starts with today's English short name; if nothing
  // matches we fall back to the first non-empty entry so the prospect
  // still sees a real band rather than an empty pill.
  const todayHours = (() => {
    const all = enrichment?.hours ?? [];
    if (all.length === 0) return null;
    const dayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
      new Date().getDay()
    ]!;
    const match =
      all.find((h) =>
        (h?.day ?? "").toLowerCase().startsWith(dayShort.toLowerCase()),
      ) ?? all[0];
    return trim(match?.open ?? null);
  })();
  return (
    <section
      id="addon-inline-google_profile_sync"
      className="ashford-addon-inline scroll-mt-24 py-16"
    >
      <div className="max-w-5xl mx-auto px-8 sm:px-12">
        <RibbonHeader
          nameKey="addon_google_label"
          taglineKey="addon_google_short"
          price="$15"
          included={included}
        />

        {showEmptyNotice ? (
          <div
            data-testid="google-sync-sample-notice"
            className="max-w-3xl mx-auto mb-4 flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ink/85"
          >
            <AlertTriangle className="w-4 h-4 text-gold mt-0.5 shrink-0" />
            <span>{t("addon_google_sample_notice")}</span>
          </div>
        ) : null}

        <div className="grid md:grid-cols-[1.3fr,1fr] gap-6 max-w-3xl mx-auto items-start">
          <div className="bg-white rounded-2xl border border-ink/10 overflow-hidden shadow-sm">
            <div className="aspect-[16/7] relative overflow-hidden">
              {realPhoto ? (
                <img
                  src={realPhoto}
                  alt={realName ?? t("addon_google_business_name")}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-sage/15 via-cream to-gold/15">
                  <div className="absolute inset-0 grid grid-cols-12 grid-rows-6 gap-px opacity-25">
                    {Array.from({ length: 12 * 6 }).map((_, i) => (
                      <div key={i} className="bg-ink/15" />
                    ))}
                  </div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="relative">
                      <MapPin
                        className="w-9 h-9 text-sage drop-shadow-md"
                        fill="currentColor"
                      />
                      <div className="absolute inset-0 rounded-full bg-sage/30 animate-ping" />
                    </div>
                  </div>
                </div>
              )}
              {showEmptyNotice ? (
                <div className="absolute top-2 right-2 inline-flex items-center gap-1 bg-gold/15 text-gold text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {locale === "es" ? "Vista de muestra" : "Sample shown"}
                </div>
              ) : (
                <div className="absolute top-2 right-2 inline-flex items-center gap-1 bg-cream/90 text-sage text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded">
                  <RefreshCw className="w-2.5 h-2.5" />
                  {t("addon_google_synced")}
                </div>
              )}
            </div>

            <div className="p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h4 className="font-display text-lg text-ink leading-tight">
                  {realName ?? t("addon_google_business_name")}
                </h4>
                <div className="flex items-center gap-0.5 text-gold shrink-0">
                  <Star className="w-4 h-4" fill="currentColor" />
                  <span className="text-sm font-medium text-ink ml-1">
                    {realRating != null ? realRating.toFixed(1) : "4.9"}
                  </span>
                  <span className="text-xs text-ink/55">
                    ({realReviews ?? 38})
                  </span>
                </div>
              </div>
              <div className="text-xs text-ink/60 mb-1.5">
                {realAddress ?? t("addon_google_address_line")}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-ink/70 flex-wrap">
                <span className="text-sage font-medium">
                  {t("addon_google_open")}
                </span>
                <span>
                  ·{" "}
                  {todayHours
                    ? `${locale === "es" ? "Hoy" : "Today"} ${todayHours}`
                    : t("addon_google_closes")}
                </span>
                <span className="inline-flex items-center gap-1 ml-auto">
                  <Phone className="w-3 h-3" /> {realPhone ?? "(512) 555-0198"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-cream rounded-2xl border border-ink/10 p-5">
            <div className="text-[11px] uppercase tracking-widest text-ink/55 font-mono mb-3">
              {t("addon_google_checks_eyebrow")}
            </div>
            <ul className="space-y-2 text-sm text-ink/80">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sage mt-2 shrink-0" />
                <span>{t("addon_google_checks_b1")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sage mt-2 shrink-0" />
                <span>{t("addon_google_checks_b2")}</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-gold mt-0.5 shrink-0" />
                <span>{t("addon_google_checks_b3")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sage mt-2 shrink-0" />
                <span>{t("addon_google_checks_b4")}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
