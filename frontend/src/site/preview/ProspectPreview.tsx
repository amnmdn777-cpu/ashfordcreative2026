import { useEffect, useMemo, useRef, useState } from "react";
// Prospect preview body is now personalized per-prospect using the
// enrichment payloads (Google Places, Psychology Today, NPI, the
// prospect's own website crawl). The sticky "Prepared for…" header
// still echoes the lead record.
import { useParams } from "wouter";
import {
  TEMPLATES,
  PALETTES,
  type PaletteDef,
  type TemplateKey,
  type PreviewLeadInfo,
  type PreviewContent,
  type PreviewWebsitePage,
} from "@workspace/api-zod";
import { TEMPLATE_COMPONENTS } from "@site/templates";
import { mergePreviewContent } from "@site/preview/previewContentMerge";
import { applyPortalOverride } from "@site/preview/portalOverrides";
import { PractitionerDetailView } from "@site/pages/PractitionerDetail";
import { api, assertSafeRedirectUrl } from "@site/lib/api";
import { useI18n } from "@site/lib/i18n";
import { Seo } from "@site/lib/seo";
import { Heart, MessageSquarePlus, CheckCircle2, AlertCircle, FileText, Sparkles } from "lucide-react";
// SOURCE_LABELS / prettySource helpers were retired with the
// "Data we used to personalize this preview" footer — that section
// leaked our pipeline details into prospect-facing UI. Keeping the
// imports trim avoids dead-code drift. 

// Full template lineup shown to prospects. Garden leads (changed
// 2026-05 — its sage/cream palette + structured services layout is
// the most "professional clinic" first impression of the catalog,
// and it's the default landing template). The remaining four are
// surfaced in catalog order so the prospect can compare warm /
// personal / premium / cinematic directions side-by-side.
const TPL_KEYS: TemplateKey[] = [
  "garden",
  "polaroid",
  "sunrise",
  "constellation",
  "playful_modern",
  "front_porch",
  "hello_friend",
];

export default function ProspectPreview() {
  const { token } = useParams<{ token: string }>();
  const { locale } = useI18n();
  const [info, setInfo] = useState<PreviewLeadInfo | null>(null);
  const [remoteContent, setRemoteContent] = useState<PreviewContent | null>(
    null,
  );
  const [pages, setPages] = useState<PreviewWebsitePage[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [active, setActive] = useState<TemplateKey>("garden");
  const [showChanges, setShowChanges] = useState(false);
  const [changeText, setChangeText] = useState("");
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // When set, render the practitioner detail view inside the preview shell
  // instead of the template body. Cleared by the back affordance.
  const [practitionerSlug, setPractitionerSlug] = useState<string | null>(null);
  const lastViewedRef = useRef<TemplateKey | null>(null);

  // Load lead info; fires "opened" event on the server.
  // Reset every per-token piece of state at the head of the effect so a
  // token change in the URL (rep emailing the same browser two different
  // links, or programmatic navigation) cannot show stale data while the
  // new fetch is in flight. The previous `cancelled` flag prevented a
  // crossed-wires resolution but didn't clear the React state itself.
  // Same goes for `lastViewedRef` — we want the first template view
  // under the new token to fire its `viewed_template` event again.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setInfo(null);
    setRemoteContent(null);
    setPages([]);
    setLoadErr(null);
    setActive("garden");
    setPractitionerSlug(null);
    lastViewedRef.current = null;
    api.getPreview(token)
      .then((r) => {
        if (cancelled) return;
        setInfo(r.info);
        setRemoteContent(applyPortalOverride(r.info, r.content ?? null));
        setPages(r.pagesFromWebsite ?? []);
      })
      .catch((e) => { if (!cancelled) setLoadErr(e?.message || "Could not load preview."); });
    return () => { cancelled = true; };
  }, [token]);

  // Fire viewed_template once per change (and once initially).
  useEffect(() => {
    if (!token || !info) return;
    if (lastViewedRef.current === active) return;
    lastViewedRef.current = active;
    api.postPreviewEvent(token, { eventType: "viewed_template", templateKey: active }).catch(() => {});
  }, [active, token, info]);

  // Note: backend already records "opened" on GET /preview/:token; no client-side firing needed.

  const tpl = TEMPLATES[active];
  const palette: PaletteDef = useMemo(() => PALETTES[tpl.paletteKeys[0]], [tpl]);
  const Component = TEMPLATE_COMPONENTS[active];
  // Personalization layer: real practice data merged on top of the
  // template's neutral SAMPLES, field by field. Empty fields fall back
  // to placeholder copy so a half-enriched preview still looks complete.
  const content = useMemo(
    () => mergePreviewContent(active, locale, remoteContent),
    [active, locale, remoteContent],
  );
  if (loadErr) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-ink text-cream px-6 text-center">
        <AlertCircle className="w-8 h-8 text-gold mb-4" />
        <h1 className="font-display text-3xl mb-3">This preview link isn't valid</h1>
        <p className="text-cream/70 max-w-md mb-6">{loadErr}</p>
        <p className="text-sm text-cream/50">If your sales rep sent you here, they can resend a fresh link.</p>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink text-cream">
        <div className="font-mono text-xs uppercase tracking-widest text-cream/60 animate-pulse">Loading preview…</div>
      </div>
    );
  }

  const onFavorite = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      // The checkout endpoint records the `preferred_template` event server-side,
      // so we don't fire it from the client to avoid duplicate events.
      const { url } = await api.startPreviewCheckout(token, active);
      if (url) {
        // Open-redirect guard: only navigate when the URL points at
        // Stripe Checkout or our own origin. A misrouted backend would
        // otherwise turn the prospect's "favorite →" tap into a
        // phishing handoff from a high-trust UI moment.
        window.location.href = assertSafeRedirectUrl(url);
      } else {
        setConfirmation(`Got it — ${info.rep.displayName} will follow up shortly with checkout details.`);
      }
    } catch (e) {
      // Don't echo the raw error back to the prospect — it can leak
      // backend details (Stripe error codes, hostname mismatches from
      // assertSafeRedirectUrl). The rep follows up anyway.
      setConfirmation(`Got it — ${info.rep.displayName} will follow up shortly.`);
      // Surface the error to ourselves through Sentry instead.
      if (e instanceof Error) {
        // eslint-disable-next-line no-console
        console.warn("preview checkout failed:", e.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onRequestChanges = async () => {
    if (!token || !changeText.trim()) return;
    setSubmitting(true);
    try {
      await api.postPreviewEvent(token, {
        eventType: "requested_changes",
        templateKey: active,
        changeRequestText: changeText.trim(),
      });
      setConfirmation("Got it — your sales rep will follow up. Note: changes after launch are typically priced as a paid extra.");
      setShowChanges(false);
      setChangeText("");
    } catch (e) {
      setConfirmation("We saved your note. If you don't hear back today, please call your rep.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Seo
        title={`Site previews for ${info.practice}`}
        description={`Three personalized site directions prepared for ${info.name}.`}
        path={`/p/${token}`}
        noindex
      />

      {/* Floating top bar — split into two distinct rows so the logo +
          "Prepared for" identity never share horizontal space with the
          template selector + CTAs. Avoids the prior overlap where a long
          practice name pushed the logo into the controls. */}
      <div className="sticky top-0 z-50 bg-ink text-cream border-b border-cream/10">
        {/* Row 1: identity */}
        <div className="max-w-7xl mx-auto px-4 lg:px-6 pt-2.5 pb-2 flex items-center gap-4 text-xs">
          <a
            href="/"
            className="shrink-0 font-display text-base text-cream hover:text-gold transition-colors leading-none"
            aria-label="Ashford Creative — home"
          >
            Ashford <span className="text-gold">Creative</span>
          </a>
          <span className="shrink-0 w-px h-5 bg-cream/15" aria-hidden="true" />
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] uppercase tracking-widest text-cream/50 shrink-0">
              Prepared for
            </span>
            <span className="text-cream font-medium truncate">{info.name}</span>
            <span className="text-cream/40">·</span>
            <span className="text-cream/80 truncate">
              {remoteContent?.practiceName || info.practice}
            </span>
            <span className="hidden md:inline text-cream/40">·</span>
            <span className="hidden md:inline text-cream/50">
              {info.city}, {info.state}
            </span>
          </div>
        </div>
        {/* Row 2: controls */}
        <div className="max-w-7xl mx-auto px-4 lg:px-6 pb-2.5 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-ink-deep rounded-sm p-1 border border-cream/10 overflow-x-auto">
            {TPL_KEYS.map((k) => (
              <button
                key={k}
                onClick={() => {
                  setActive(k);
                  setPractitionerSlug(null);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap ${
                  active === k
                    ? "bg-gold text-ink"
                    : "text-cream/70 hover:text-cream"
                }`}
              >
                {TEMPLATES[k].label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button
            onClick={onFavorite}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-ink rounded-sm font-medium text-sm hover:bg-gold/90 transition-colors disabled:opacity-60"
          >
            <Heart className="w-3.5 h-3.5" /> This is my favorite →
          </button>
          <button
            onClick={() => setShowChanges((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-cream/80 text-xs hover:text-cream"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" /> Request changes
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-cream/80 text-xs hover:text-cream border border-cream/15 rounded-sm"
            title={`Talk to ${info.rep.displayName}`}
          >
            Talk to a sales rep
          </a>
        </div>

        {showChanges && (
          <div className="border-t border-cream/10 bg-ink-deep">
            <div className="max-w-3xl mx-auto px-4 lg:px-6 py-4">
              <div className="text-xs text-cream/60 mb-2 font-mono uppercase tracking-widest">
                Tell {info.rep.displayName.split(" ")[0]} what to change about the {TEMPLATES[active].label} direction
              </div>
              <textarea
                value={changeText}
                onChange={(e) => setChangeText(e.target.value)}
                rows={3}
                placeholder="e.g. swap the doctor portrait for our new headshots; add a note about evening hours…"
                className="w-full bg-ink border border-cream/15 rounded-sm px-3 py-2 text-sm text-cream placeholder-cream/30"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setShowChanges(false)} className="text-xs px-3 py-1.5 text-cream/60 hover:text-cream">Cancel</button>
                <button
                  onClick={onRequestChanges}
                  disabled={submitting || !changeText.trim()}
                  className="text-xs px-3 py-1.5 bg-gold text-ink rounded-sm font-medium disabled:opacity-50"
                >
                  Send to {info.rep.displayName.split(" ")[0]}
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmation && (
          <div className="border-t border-gold/30 bg-gold/10">
            <div className="max-w-3xl mx-auto px-4 lg:px-6 py-3 flex items-start gap-2 text-sm text-cream">
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-gold shrink-0" />
              <span>{confirmation}</span>
              <button onClick={() => setConfirmation(null)} className="ml-auto text-cream/60 hover:text-cream text-xs">Dismiss</button>
            </div>
          </div>
        )}
      </div>

      {/* "Pulled from your public profile" recap — runs immediately
          under the sticky header so the prospect SEES that we already
          have their real specialties, insurances, languages, logo,
          brand color before they even glance at the template. This is
          the wow-moment band: every pill in here is verbatim from a
          public source (Headway, PT, their site's JSON-LD, their
          homepage). Only renders when at least one band has signal
          so a thin-data lead doesn't show an empty banner. */}
      {!practitionerSlug && remoteContent && hasPersonalizationSignal(remoteContent) && (
        <PersonalizationRecap
          content={remoteContent}
          practiceName={remoteContent.practiceName ?? info.practice}
          templatePrimary={palette.primary}
        />
      )}

      {practitionerSlug ? (
        <PractitionerDetailView
          templateKey={active}
          practitionerSlug={practitionerSlug}
          onBack={() => setPractitionerSlug(null)}
        />
      ) : (
        // Click delegation: any anchor that points at a practitioner sub-page
        // is intercepted so the prospect stays inside the preview shell.
        // Hide each template's own `<nav className="fixed ...">` — those
        // duplicate the practitioner identity at top-left and visually
        // collide with the preview's sticky header (template badges,
        // language toggle, Book Consult). The preview shell already
        // surfaces the prospect identity, so the template's nav is noise.
        <div
          className="[&_nav.fixed]:!hidden"
          onClickCapture={(e) => handlePractitionerClick(e, setPractitionerSlug)}
        >
          <Component content={content} palette={palette} templateKey={active} />
        </div>
      )}

      {/* "Your site, re-imagined" — actually recreates each page rather
          than just listing URLs. Per-page block shows: redesigned title,
          AI-rewritten intro in the new template's voice, the prospect's
          own existing paragraphs (proof we're not making it up), and the
          imagery we pulled from their site. Sits below the template so
          the visual story leads and the structural story follows. */}
      {!practitionerSlug && pages.length > 0 && (
        <section className="bg-cream border-t border-ink/10 py-14">
          <div className="max-w-5xl mx-auto px-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-ink/50 mb-2">
              Your site, re-imagined
            </div>
            <h2 className="font-display text-3xl text-ink mb-2">
              We&rsquo;ll re-create your existing site, page for page
            </h2>
            <p className="text-ink/70 mb-10 max-w-2xl">
              Pulled live from{" "}
              <span className="font-medium">
                {remoteContent?.contact.website || "your current website"}
              </span>
              . Below is what each of your pages looks like rewritten in the{" "}
              <span className="font-medium">{TEMPLATES[active].label}</span>{" "}
              direction, alongside the existing copy and imagery we&rsquo;ll
              carry over.
            </p>
            <div className="space-y-10">
              {pages.map((p) => (
                <article
                  key={p.url}
                  className="border border-ink/10 rounded-sm bg-white overflow-hidden"
                >
                  <header className="px-6 pt-5 pb-3 border-b border-ink/5 flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <FileText className="w-4 h-4 text-gold shrink-0" />
                        <span className="font-mono text-[10px] uppercase tracking-widest text-ink/40 px-1.5 py-0.5 border border-ink/10 rounded-sm">
                          {p.kind}
                        </span>
                        <span className="font-mono text-[11px] text-ink/40">
                          {p.path}
                        </span>
                      </div>
                      <h3 className="font-display text-xl text-ink">
                        {stripCitySuffix(
                          (p.title ?? p.h1 ?? p.path).split(/[—|·]/)[0]?.trim() || p.path,
                          info.city,
                        )}
                      </h3>
                    </div>
                  </header>
                  <div className="grid md:grid-cols-5 gap-0">
                    {/* Rewritten copy in the new template's voice. When the
                        AI synthesis didn't return a per-page rewrite (often
                        the case for short pages like Contact), fall through
                        to the prospect's own crawled copy rather than a
                        placeholder — they came here to see something. */}
                    <div className="md:col-span-3 px-6 py-5 border-r border-ink/5">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-gold mb-2">
                        Rewritten in {TEMPLATES[active].label} voice
                      </div>
                      {(() => {
                        const text =
                          p.rewrittenIntro?.trim() ||
                          p.summary?.trim() ||
                          p.paragraphs.find((s) => s.trim())?.trim() ||
                          null;
                        return text ? (
                          <p className="text-ink leading-relaxed">{text}</p>
                        ) : (
                          <p className="text-ink/40 italic text-sm">
                            (We&rsquo;ll draft this section once you pick a direction.)
                          </p>
                        );
                      })()}
                    </div>
                    {/* Imagery we'll carry over */}
                    <div className="md:col-span-2 px-6 py-5 bg-ink/[0.02]">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-ink/50 mb-2">
                        Imagery from your page
                      </div>
                      {p.images.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {p.images.slice(0, 4).map((src) => (
                            <img
                              key={src}
                              src={src}
                              alt=""
                              className="w-full aspect-[4/3] object-cover rounded-sm border border-ink/5"
                              loading="lazy"
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-ink/40 italic">
                          No images pulled from this page.
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

/**
 * True when at least one of the public-source-first personalization
 * fields (specialties, insurances, languages, modalities, brand,
 * testimonials) carries real data. We use this to hide the recap
 * band entirely when the lead is thin so an empty rail never ships
 * to a prospect — the rest of the preview already shows their name,
 * practice, and template.
 */
function hasPersonalizationSignal(content: PreviewContent): boolean {
  const a = content.specialties?.length ?? 0;
  const b = content.acceptedInsurances?.length ?? 0;
  const c = content.languages?.length ?? 0;
  const d = content.modalities?.length ?? 0;
  const e = content.testimonials?.length ?? 0;
  const hasBrand = !!(
    content.brand?.logoUrl ||
    content.brand?.accentColor
  );
  return a + b + c + d + e > 0 || hasBrand;
}

/**
 * "Pulled from your public profile" recap band shown under the sticky
 * header. Surfaces the structured public-source-first data:
 *   - prospect's real logo + brand accent (when a first-party logo
 *     exists)
 *   - clinical specialties as pills (Headway/PT)
 *   - insurances accepted as pills (Headway/PT)
 *   - languages spoken
 *   - in-person / telehealth / sliding-scale flags (Headway)
 *   - source attribution footnote so the prospect understands why
 *     we know all this — never a "we Googled you" feel
 *
 * The band is intentionally cream-colored (matches the prospect-
 * facing pages bar lower down) rather than ink (matches the rep-
 * facing sticky header) to signal "this is about YOU".
 *
 * # Design-harmony guards (2026-05)
 *
 * The brand identity we extract from the prospect's site is a
 * design risk: a poorly-extracted color or logo can break the
 * preview's visual hierarchy. This component is the last gate.
 *
 *  - **Accent color vs. template palette**: when the extracted accent
 *    sits within ~15% HSL distance of the active template's primary,
 *    we drop it. The visual language of the chosen template should
 *    win when the two would clash for being too similar (a sage
 *    template + a sage prospect accent reads as muddy, not unified).
 *  - **Logo loading failures**: `onError` hides the `<img>` and
 *    surfaces the initial-block fallback. We never ship a broken
 *    image icon to the prospect.
 *  - **Row density cap**: at most 3 rows of pills are rendered by
 *    default; a "+N more" disclosure expands the rest. Without this,
 *    a Headway-rich lead would push the template body 200px down
 *    on mobile and break the visual hierarchy.
 *  - **Server-side gates** in `previewContentHarmony.ts` already
 *    refused unreadable accent colors and non-logo URLs before they
 *    reached us, so this layer is the second of two checks, not the
 *    only one.
 */
function PersonalizationRecap({
  content,
  practiceName,
  templatePrimary,
}: {
  content: PreviewContent;
  practiceName: string;
  templatePrimary: string;
}) {
  const { t } = useI18n();
  const sources = uniqueSourceLabels(content.fieldSources);
  const rawAccent = content.brand?.accentColor ?? null;
  // Drop the accent when it's too close to the active template's primary —
  // either color does the job alone, having both makes the band visually
  // duplicative. Threshold tuned so that a sage practice landing on the
  // sage template falls back to neutral, while a coral practice on the
  // sage template keeps both colors (they read as complementary, not
  // clashing).
  const accent =
    rawAccent && colorDistance(rawAccent, templatePrimary) >= 0.15
      ? rawAccent
      : null;
  const logo = content.brand?.logoUrl ?? null;
  const [logoBroken, setLogoBroken] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const modeBadges: string[] = [];
  if (content.offersInPerson) modeBadges.push(t("preview_recap_in_person"));
  if (content.offersTelehealth) modeBadges.push(t("preview_recap_telehealth"));
  if (content.acceptsSlidingScale) modeBadges.push(t("preview_recap_sliding_scale"));

  // Build the rows we *would* show — then cap to MAX_ROWS unless the
  // prospect chose to expand. Keeps the band ≤ ~120px tall by default,
  // preserves space for the template body which is the actual product.
  const allRows: Array<{ key: string; label: string; items: string[] }> = [];
  if ((content.specialties?.length ?? 0) > 0) {
    allRows.push({
      key: "specialties",
      label: t("preview_recap_specialties"),
      items: content.specialties!.slice(0, 8),
    });
  }
  if ((content.acceptedInsurances?.length ?? 0) > 0) {
    allRows.push({
      key: "insurance",
      label: t("preview_recap_accepts"),
      items: content.acceptedInsurances!.slice(0, 6),
    });
  }
  if ((content.languages?.length ?? 0) > 0) {
    allRows.push({
      key: "languages",
      label: t("preview_recap_languages"),
      items: content.languages!,
    });
  }
  if ((content.modalities?.length ?? 0) > 0) {
    allRows.push({
      key: "approach",
      label: t("preview_recap_approach"),
      items: content.modalities!.slice(0, 6),
    });
  }
  if (modeBadges.length > 0) {
    allRows.push({
      key: "modes",
      label: t("preview_recap_modes"),
      items: modeBadges,
    });
  }
  const MAX_ROWS = 3;
  const rowsToShow = expanded ? allRows : allRows.slice(0, MAX_ROWS);
  const hiddenRowCount = Math.max(0, allRows.length - MAX_ROWS);

  return (
    <section className="bg-cream border-b border-ink/10">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-4 flex items-start gap-4 flex-wrap">
        <div className="shrink-0 flex items-center gap-3">
          {logo && !logoBroken ? (
            <img
              src={logo}
              alt={`${practiceName} logo`}
              className="h-10 w-auto max-w-[120px] object-contain"
              loading="lazy"
              onError={() => setLogoBroken(true)}
            />
          ) : (
            <div
              className="h-10 w-10 rounded-sm border border-ink/15 flex items-center justify-center font-display text-ink"
              style={accent ? { borderColor: accent, color: accent } : undefined}
            >
              {practiceName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="font-mono text-[10px] uppercase tracking-widest text-ink/55 leading-tight max-w-[140px]">
            <Sparkles
              className="w-3 h-3 inline-block mr-1 -mt-0.5"
              style={accent ? { color: accent } : undefined}
            />
            {t("preview_recap_eyebrow")}
          </div>
        </div>
        <div className="flex-1 min-w-[240px] flex flex-col gap-2">
          {rowsToShow.map((row) => (
            <RecapRow
              key={row.key}
              label={row.label}
              items={row.items}
              accent={accent}
            />
          ))}
          {hiddenRowCount > 0 && !expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="self-start text-[10px] font-mono uppercase tracking-widest text-ink/55 hover:text-ink"
            >
              {t(
                hiddenRowCount === 1
                  ? "preview_recap_show_more_one"
                  : "preview_recap_show_more_other",
                { n: hiddenRowCount },
              )}
            </button>
          )}
        </div>
        {sources.length > 0 && (
          <div className="text-[10px] font-mono uppercase tracking-widest text-ink/45 max-w-[160px] leading-relaxed">
            {t("preview_recap_sources")}<br />
            <span className="text-ink/65">{sources.join(" · ")}</span>
          </div>
        )}
      </div>
    </section>
  );
}

function RecapRow({
  label,
  items,
  accent,
}: {
  label: string;
  items: string[];
  accent: string | null;
}) {
  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className="font-mono text-[10px] uppercase tracking-widest text-ink/45 shrink-0">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span
            key={it}
            className="text-xs px-2 py-0.5 rounded-sm border bg-white text-ink"
            style={
              accent
                ? { borderColor: `${accent}55`, color: accent }
                : { borderColor: "rgba(0,0,0,0.12)" }
            }
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * HSL-distance between two hex colors, scaled to [0, 1]. Used by the
 * recap band to drop the prospect's accent when it sits too close to
 * the active template's signature color. Mirrors
 * `previewContentHarmony.colorDistance` on the server — duplicated
 * inline because the server module is not in the client bundle and
 * the math is small enough that cross-package shared code would cost
 * more than it saved.
 */
function colorDistance(aHex: string, bHex: string): number {
  const a = parseHex(aHex);
  const b = parseHex(bHex);
  if (!a || !b) return 1;
  const ha = rgbToHsl(a);
  const hb = rgbToHsl(b);
  const dh = Math.min(Math.abs(ha.h - hb.h), 360 - Math.abs(ha.h - hb.h)) / 180;
  const ds = Math.abs(ha.s - hb.s);
  const dl = Math.abs(ha.l - hb.l);
  return Math.min(1, 0.7 * dh + 0.15 * ds + 0.15 * dl);
}

function parseHex(raw: string): { r: number; g: number; b: number } | null {
  const m = raw.trim().match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function rgbToHsl(rgb: { r: number; g: number; b: number }) {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      case b:
        h = ((r - g) / d + 4) * 60;
        break;
    }
  }
  return { h, s, l };
}

/**
 * Map source-key attribution to short, prospect-friendly labels for
 * the recap footer. We dedupe and surface up to four — the goal is
 * "see, we did our homework" not a tracing log.
 */
function uniqueSourceLabels(
  fieldSources: Record<string, string> | undefined,
): string[] {
  if (!fieldSources) return [];
  const labels: Record<string, string> = {
    google_places: "Google",
    psychology_today: "Psychology Today",
    headway: "Headway",
    website_meta: "Your site",
    current_website_pages: "Your site",
    npi_registry: "NPI Registry",
    yelp_fusion: "Yelp",
    healthgrades: "Healthgrades",
    lead_record: "Your rep's notes",
  };
  const seen = new Set<string>();
  for (const k of Object.values(fieldSources)) {
    const label = labels[k];
    if (label) seen.add(label);
  }
  return Array.from(seen).slice(0, 4);
}

/**
 * Intercepts clicks on practitioner sub-page links rendered by template
 * bodies. We don't want prospects to navigate to /templates/... and lose
 * the personalized preview shell, so we capture the click, pull the slug
 * out of the href, and switch the preview into "viewing practitioner" mode.
 *
 * Modifier keys / non-primary buttons are left alone so middle-click and
 * cmd-click still open the public sub-page in a new tab.
 */
function handlePractitionerClick(
  e: React.MouseEvent<HTMLDivElement>,
  setSlug: (s: string) => void,
) {
  if (e.defaultPrevented) return;
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const anchor = (e.target as HTMLElement | null)?.closest?.("a");
  if (!anchor) return;
  const href = anchor.getAttribute("href") || "";
  const match = href.match(/^\/templates\/[^/]+\/practitioner\/([^/?#]+)/);
  if (!match) return;
  e.preventDefault();
  setSlug(match[1]!);
  // Scroll back to the top so the practitioner detail starts fresh,
  // mirroring what a real navigation would do.
  window.scrollTo({ top: 0, behavior: "auto" });
}

/**
 * Strips a trailing "<City>" suffix from a Yoast/WP-SEO-concatenated
 * page title. The crawled title often looks like "Payment Info The
 * Woodlands"; we already split on em-dash/pipe/middle-dot, but a
 * site that joined the city with a bare space gets us this far.
 */
function stripCitySuffix(label: string, city: string | null | undefined): string {
  if (!city) return label;
  const trimmed = city.trim();
  if (!trimmed) return label;
  const trailing = new RegExp(
    `\\s+${trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
    "i",
  );
  return label.replace(trailing, "").trim() || label;
}
