import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useParams } from "wouter";
import {
  TEMPLATES,
  PALETTES,
  ADDONS,
  DEFAULT_FEATURES,
  TIERS,
  type AddonAngle,
  type AddonDef,
  type AddonTier,
  type PaletteDef,
  type TemplateKey,
  type TierKey,
  type PortalCustomizations,
  type PortalPublicResponse,
  normalizeTemplateKey,
} from "@workspace/api-zod";
import { AddonPreviewDrawer, type AddonDrawerMode } from "@site/components/AddonPreviewDrawer";
import { IncludedBandeau } from "@site/components/IncludedBandeau";
import {
  defaultFeatureAsAddon,
  DEFAULT_FEATURE_BY_KEY,
} from "@site/components/addons/registry";
import { TEMPLATE_COMPONENTS, resolveTemplateKey } from "@site/templates";
import { SAMPLES, pickSample } from "@site/templates/sampleContent";
import type { CSSProperties } from "react";
import { cssVarsForPalette } from "@site/lib/palette";
import { fmtUsdFromCents } from "@site/lib/utils";
import { Seo } from "@site/lib/seo";
import { I18nProvider, useI18n } from "@site/lib/i18n";
import type { StringKey } from "@site/lib/strings";
import {
  AlertCircle,
  BadgeDollarSign,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  FileText,
  Gift,
  Globe,
  Heart,
  LayoutTemplate,
  Mail,
  Newspaper,
  Play,
  Plus,
  Sparkles,
  Stethoscope,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { portalApi, portalAuth } from "./api";
import { overlayPalette, fontVars } from "./customizations";
import { ViewerRoleProvider, readViewerRoleFromUrl } from "@site/lib/viewerRole";
import { ReserveModal } from "./ReserveModal";
import { ChangeRequestSection } from "./ChangeRequestSection";
import { ADDON_INLINE_COMPONENTS } from "./addonInline";
import { PortalEnrichmentProvider } from "./portalEnrichmentContext";
import { HelpPanel } from "./HelpPanel";
import { PortalPagesBar, type PortalPageItem } from "./PortalPagesBar";
import { RebuiltPageView } from "./RebuiltPageView";
import { LiveTierSwitcher } from "@site/components/LiveTierSwitcher";
import { TierProvider } from "@site/hooks/useTier";
import {
  EnrichmentBadges,
  PricingBandeau,
  HomepageTestimonials,
  SocialFooter,
  SourcesChips,
  DraftedJournal,
} from "@site/components/sections";
// DomainPicker import removed 2026-04-28 — domain selection moved to a
// rep-driven conversation. See Comms & Copy Hardening (#185) and the
// inline comment near where the picker used to render below.

const ALL_TEMPLATE_KEYS: TemplateKey[] = [
  "garden",
  "sunrise",
  "constellation",
  "polaroid",
  "playful_modern",
  "front_porch",
  "hello_friend",
];

/**
 * Slug -> lucide icon used by the toolbar add-on chips. Keep in sync
 * with the Catalog 2.0 list in `lib/api-zod/src/pricing.ts`. Legacy
 * slugs from retired add-ons (spanish_pro, ai_quiz, etc.) fall
 * through to the `Plus` default in `AddonChip`.
 */
const ADDON_ICONS: Record<string, LucideIcon> = {
  online_booking: Calendar,
  insurance_sliding_scale: BadgeDollarSign,
  first_visit_video: Play,
  blog_publishing: Newspaper,
  // 2026-05-21 — `patient_onboarding_hub` capability dropped (Sprint 2 streamline).
};

/**
 * Catalog 2.0 angle metadata for the side-rail grouping in the portal.
 * Mirrors `ANGLE_META` on the public Pricing page so the prospect sees
 * the same buyer-angle taxonomy in both places.
 */
const PORTAL_ANGLE_META: Record<
  AddonAngle,
  { titleEn: string; titleEs: string; subtitleEn: string; subtitleEs: string; Icon: LucideIcon }
> = {
  client: {
    titleEn: "For the prospective client",
    titleEs: "Para el paciente potencial",
    subtitleEn: "What they see on your site",
    subtitleEs: "Lo que ven en tu sitio",
    Icon: Heart,
  },
  doc: {
    titleEn: "For you, the practitioner",
    titleEs: "Para ti, el clínico",
    subtitleEn: "Tools that build clinical authority",
    subtitleEs: "Herramientas que construyen autoridad clínica",
    Icon: Stethoscope,
  },
  gatekeeper: {
    titleEn: "For the front desk",
    titleEs: "Para la recepción",
    subtitleEn: "Less inbox, fewer no-shows",
    subtitleEs: "Menos inbox, menos cancelaciones",
    Icon: FileText,
  },
};

/**
 * Slug -> i18n keys for the localized chip label + short blurb. The
 * underlying API still returns English `name`/`shortDescription` fields
 * (and the slug is the canonical DB key), but the portal renders the
 * lead-pinned locale, so we map known slugs to their translated
 * counterparts. Unknown slugs fall back to the API copy.
 */
export const ADDON_LOCALE_KEYS: Record<
  string,
  { label: StringKey; short: StringKey }
> = {
  spanish_pro: { label: "addon_spanish_pro_label", short: "addon_spanish_pro_short" },
  blog_publishing: { label: "addon_blog_label", short: "addon_blog_short" },
  modalities_filter: { label: "addon_match_label", short: "addon_match_short" },
  online_booking: { label: "addon_calendar_label", short: "addon_calendar_short" },
  phq9_screener: { label: "addon_phq9_label", short: "addon_phq9_short" },
  ai_quiz: { label: "addon_quiz_label", short: "addon_quiz_short" },
  // 2026-05-21 — `patient_onboarding_hub` capability dropped (Sprint 2 streamline).
};

// `fmtUsd` in this file is a thin alias for the canonical
// `fmtUsdFromCents` so existing call sites stay short and the
// per-file declaration goes away. See `lib/utils.ts`.
const fmtUsd = fmtUsdFromCents;

type AddonSummary = PortalPublicResponse["addons"][number];

/**
 * Tiny stylized template thumbnail used inside the sticky toolbar.
 * Pulls the template's first palette so each card visibly matches the
 * look the prospect is about to apply.
 */
const TemplateThumb = ({
  tplKey,
  active,
  onClick,
}: {
  tplKey: TemplateKey;
  active: boolean;
  onClick: () => void;
}) => {
  const { t } = useI18n();
  const tpl = TEMPLATES[tplKey];
  const palette = PALETTES[tpl.paletteKeys[0]];
  // Each thumbnail previews a different palette — set the per-thumb CSS
  // variables ONCE on the wrapper and let child swatches read them via
  // the `.pal-tt-bg-*` utility classes (src/styles/palette.css). Keeps
  // the dynamic-color value in a single (CSP-safe) wrapper attribute
  // and removes ~7 inline-style attrs per thumbnail — task #201.
  const ttVars = {
    "--tt-surface": palette.surface ?? "#fff",
    "--tt-primary": palette.primary,
    "--tt-ink": palette.ink ?? "#1a1a14",
    "--tt-accent": palette.accent,
  } as CSSProperties;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={t("portal_use_template_aria", { label: tpl.label })}
      className={`group flex flex-col items-center gap-1.5 transition-transform ${
        active ? "scale-105" : "hover:scale-105"
      }`}
      style={ttVars}
    >
      <div
        className={`pal-tt-bg-surface relative w-20 h-[60px] rounded-md border p-1 overflow-hidden shadow-sm transition-all ${
          active
            ? "border-ink ring-2 ring-ink/20"
            : "border-ink/15 hover:border-ink/40"
        }`}
      >
        <div className="pal-tt-bg-primary absolute top-0 inset-x-0 h-1.5" />
        <div className="absolute top-3 left-1.5 right-1.5 bottom-1.5 flex flex-col gap-0.5">
          <div className="pal-tt-bg-ink h-1.5 w-3/4 rounded-sm opacity-85" />
          <div className="pal-tt-bg-ink h-1 w-1/2 rounded-sm opacity-45" />
          <div className="mt-auto grid grid-cols-3 gap-0.5">
            <div className="pal-tt-bg-accent h-2 rounded-sm opacity-55" />
            <div className="pal-tt-bg-accent h-2 rounded-sm opacity-35" />
            <div className="pal-tt-bg-accent h-2 rounded-sm opacity-55" />
          </div>
        </div>
        {active && (
          <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-ink text-cream flex items-center justify-center">
            <Check className="w-2 h-2" strokeWidth={3} />
          </div>
        )}
      </div>
      <span
        className={`text-[11px] leading-tight ${
          active ? "text-ink font-medium" : "text-ink/65 group-hover:text-ink"
        }`}
      >
        {tpl.label}
      </span>
    </button>
  );
};

const AddonChip = ({
  addon,
  selected,
  onToggle,
  onPreview,
  isPremium,
}: {
  addon: AddonSummary;
  selected: boolean;
  onToggle: () => void;
  onPreview: () => void;
  isPremium: boolean;
}) => {
  const { t } = useI18n();
  const display = ADDONS[addon.slug];
  const localized = ADDON_LOCALE_KEYS[addon.slug];
  const label = localized ? t(localized.label) : (display?.label ?? addon.name);
  const Icon = ADDON_ICONS[addon.slug] ?? Plus;
  // Free bundled add-ons render an "Included" badge and disable the toggle.
  const included = addon.monthlyCents === 0 && addon.setupCents === 0;
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border transition-all min-w-[180px] ${
        included
          ? "border-sage/40 bg-sage/[0.04]"
          : selected
          ? "border-ink/35 bg-ink/[0.04] shadow-sm"
          : "border-ink/15 bg-paper hover:border-ink/35"
      }`}
    >
      <button
        type="button"
        onClick={onPreview}
        aria-pressed={selected}
        disabled={included}
        className={`flex items-center gap-3 p-3 text-left ${included ? "cursor-default" : ""}`}
      >
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-colors ${
            included
              ? "bg-sage text-cream"
              : selected
              ? "bg-ink text-cream"
              : "bg-ink/[0.06] text-ink/55"
          }`}
        >
          {selected || included ? (
            <Check className="w-4 h-4" strokeWidth={3} />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Icon
              className={`w-3.5 h-3.5 shrink-0 ${
                included ? "text-sage" : isPremium ? "text-gold" : "text-ink/50"
              }`}
            />
            <span className="text-[13px] font-medium text-ink leading-tight truncate">
              {label}
            </span>
            {display?.beta && !included && (
              <span
                className="bg-gold/15 text-gold-dark font-mono text-[8.5px] px-1 py-0.5 rounded uppercase tracking-wider shrink-0"
                title="In active development — ships next quarter"
              >
                Beta
              </span>
            )}
          </div>
          <span className="text-[11px] text-ink/55 block mt-0.5">
            {included ? (
              <span className="text-sage-light font-medium">
                {t("addon_inline_included")}
                {addon.originalMonthlyCents && addon.originalMonthlyCents > 0 ? (
                  <span className="ml-1.5 text-ink/40 line-through font-normal">
                    {fmtUsd(addon.originalMonthlyCents)}
                    {t("portal_per_month")}
                  </span>
                ) : null}
              </span>
            ) : (
              <>
                {/* Free add-ons (monthlyCents === 0) hide the price label
                    entirely — showing "+$0/mo" looked broken to reps
                    pitching e.g. the Google Calendar sync. #221. */}
                {addon.monthlyCents > 0 ? (
                  <>
                    +{fmtUsd(addon.monthlyCents)}
                    {t("portal_per_month")}
                  </>
                ) : (
                  <span className="text-sage-light font-medium">
                    {t("addon_inline_included")}
                  </span>
                )}
                {isPremium && (
                  <span className="ml-1.5 text-gold font-medium">
                    {" "}
                    {t("portal_premium_badge")}
                  </span>
                )}
              </>
            )}
          </span>
        </div>
      </button>
      {/* Always-visible "View detail" footer (#212). Previously this row
          only appeared when the chip was already selected, which buried
          the preview affordance — prospects had to add an add-on to
          discover they could preview it, the wrong order. We now show
          a slim Eye+View row on every chip so the discovery loop is
          obvious. Selected chips additionally surface the "jump to
          inline section" copy via ExternalLink. */}
      <button
        type="button"
        onClick={onPreview}
        aria-label={`View ${label} detail`}
        className="px-3 py-1.5 text-[11px] flex justify-end items-center gap-1 border-t border-ink/10 bg-ink/[0.03] text-ink/65 hover:text-ink hover:bg-ink/[0.05] font-medium transition-colors"
      >
        {selected ? (
          <>
            {t("portal_jump_preview")} <ExternalLink className="w-2.5 h-2.5" />
          </>
        ) : (
          <>
            <Eye className="w-3 h-3" /> View detail
          </>
        )}
      </button>
    </div>
  );
};

/**
 * Slug-based, permanent prospect portal. Distinct from the legacy `/p/:token`
 * preview — this one persists customizations, captures add-on signals, and
 * runs the Stripe Payment Element reserve flow.
 *
 * Layout (variant A — Visual Toolbar): a sticky, collapsible top toolbar
 * holds the practice header on the left, the running price + Reserve CTA
 * on the right, and an expanded panel below containing the 6-template
 * thumbnail switcher and the add-on chip grid (Essentials + Premium
 * shown together, premium chips visually marked with a gold accent).
 * The page body shows the active template, then injects an inline demo
 * for every selected add-on so the prospect sees exactly what they're
 * paying for.
 *
 * The portal mounts in the lead's `locale` (en/es) via a `scoped`
 * `I18nProvider`. Scoped means the provider seeds the locale from the
 * lead row but keeps it in memory only — so the prospect's in-portal
 * EN/ES toggle DOES flip visible copy (which the previous `pinned`
 * mode silently swallowed) without clobbering the visitor's site-wide
 * preference in localStorage.
 */
export default function ProspectPortal() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PortalPublicResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initial load. We prime the access token from the URL (`?t=...`)
  // before the first GET so the server accepts us; the GET response
  // also echoes the token, which the api client caches for subsequent
  // requests via the X-Portal-Token header.
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    portalAuth.prime();
    portalApi
      .get(slug)
      .then((r) => {
        if (cancelled) return;
        setData(r);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        // `e` is `unknown` because Zod parse failures or non-Error rejects
        // can flow through here as plain objects — coercing with String(e)
        // produced "[object Object]" on /p/<invalid-token>. Pull `.message`
        // when the rejection looks Error-shaped, fall back to a friendly
        // string otherwise. (LOT 7.7)
        const msg =
          (typeof e === "object" && e !== null && "message" in e
            ? String((e as { message?: unknown }).message ?? "")
            : "") || "Something went wrong loading this preview.";
        setError(msg);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    // Error/loading shells render in the *site-wide* locale because we
    // don't yet know the lead's locale. They get pinned once data arrives.
    return <PortalErrorShell error={error} />;
  }
  if (!data) {
    return <PortalLoadingShell />;
  }

  return (
    <I18nProvider initial={data.locale} scoped>
      <PortalBody initialData={data} />
    </I18nProvider>
  );
}

function PortalErrorShell({ error }: { error: string }) {
  const { t } = useI18n();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-900 text-stone-100 px-6 text-center">
      <AlertCircle className="w-8 h-8 text-amber-400 mb-4" />
      <h1 className="font-serif text-3xl mb-3">{t("portal_invalid_title")}</h1>
      <p className="text-stone-400 max-w-md mb-6">{error}</p>
      <p className="text-sm text-stone-500">{t("portal_invalid_help")}</p>
    </div>
  );
}

function PortalLoadingShell() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 text-stone-700">
      <div className="font-mono text-xs uppercase tracking-widest animate-pulse">
        {t("portal_loading")}
      </div>
    </div>
  );
}

function PortalBody({ initialData }: { initialData: PortalPublicResponse }) {
  const { t, locale } = useI18n();
  const slug = initialData.slug;
  const [data, setData] = useState<PortalPublicResponse>(initialData);
  const [activeTemplate, setActiveTemplate] = useState<TemplateKey>(() => {
    const tk = normalizeTemplateKey(initialData.selectedTemplate) ?? "garden";
    if (initialData.cart) {
      const ctk = normalizeTemplateKey(initialData.cart.templateKey);
      if (ctk) return ctk;
    }
    return tk;
  });
  const [customizations, setCustomizations] = useState<PortalCustomizations>(
    initialData.customizations ?? {},
  );
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(() => {
    // Always pre-select currently-free add-ons (bundled with every plan).
    // Paid add-ons are NEVER pre-selected — even if they appear in the saved
    // cart — because an old cart may have been created when that add-on was
    // still $0. Silently pre-ticking a paid checkbox confuses prospects, so
    // we require an explicit opt-in on every visit.
    const freeSet = new Set(
      initialData.addons
        .filter((a) => a.monthlyCents === 0 && a.setupCents === 0)
        .map((a) => a.slug),
    );
    return freeSet;
  });
  // ── Live tier state ──────────────────────────────────────────────
  // Drives the LiveTierSwitcher: a rep on a sales call can pivot the
  // visible site between Boutique / Pro / Concierge so the customer
  // sees the full experience at every price point during the call.
  // Default = Boutique (the floor tier). When the rep switches tier
  // we (a) update price pill, (b) auto-tick every paid add-on the new
  // tier bundles so the prospect literally sees more sections appear,
  // and (c) re-render the templated site under the same chrome.
  const [selectedTier, setSelectedTier] = useState<TierKey>("boutique");
  // When tier changes, drive selectedAddons so the underlying template
  // renders the tier's full capability set. Bundled paid add-ons for
  // upper tiers are auto-ticked; lower-tier free add-ons stay ticked.
  const onTierChange = (next: TierKey) => {
    setSelectedTier(next);
    const tierSlugs = new Set<string>(
      TIERS[next].capabilities as readonly string[],
    );
    setSelectedAddons((prev) => {
      const merged = new Set<string>();
      // Always-free add-ons stay on.
      for (const a of data.addons) {
        if (a.monthlyCents === 0 && a.setupCents === 0) merged.add(a.slug);
      }
      // Tier capability slugs that exist as add-ons in this prospect's
      // catalog get auto-ticked so the matching inline demos render.
      for (const a of data.addons) {
        if (tierSlugs.has(a.slug)) merged.add(a.slug);
      }
      // Preserve any extra paid add-on the rep manually toggled on,
      // unless the rep is downgrading — moving down a tier should
      // visually shed the upgraded features.
      const lowerOrEqual: Record<TierKey, TierKey[]> = {
        boutique: ["boutique"],
        boutique_pro: ["boutique", "boutique_pro"],
        boutique_concierge: ["boutique", "boutique_pro", "boutique_concierge"],
      };
      const allowedSlugs = new Set<string>();
      for (const tk of lowerOrEqual[next]) {
        for (const c of TIERS[tk].capabilities as readonly string[]) {
          allowedSlugs.add(c);
        }
      }
      for (const slug of prev) {
        const addon = data.addons.find((a) => a.slug === slug);
        if (!addon) continue;
        if (addon.monthlyCents === 0 && addon.setupCents === 0) {
          merged.add(slug);
          continue;
        }
        if (allowedSlugs.has(slug)) merged.add(slug);
      }
      return merged;
    });
    void portalApi
      .event(slug, {
        eventType: "tier_pick",
        sessionId: sessionIdRef.current,
        metadata: { tier: next },
      })
      .catch(() => {});
  };
  const [showReserve, setShowReserve] = useState(false);
  // Active "page" the prospect is viewing inside the live template.
  // The portal now ships a sticky page-nav bar (PortalPagesBar) above
  // the template, populated with every page we crawled from the
  // prospect's existing site (data.pages). Clicking a non-home page
  // swaps the rendered surface from the full template to a
  // RebuiltPageView for that page — same palette, same fonts, same
  // chrome — so the prospect can walk through every rebuilt page
  // exactly as a visitor would on the launched site.
  //
  // We persist the pick in `window.location.hash` (`#p=/about`) so
  // (a) the prospect can deep-link a specific page to their partner
  // and (b) a reload doesn't bounce them back to the home page after
  // they've been browsing. The hash channel is intentional — these
  // portals are accessed via a slug-routed path and we don't want to
  // start mutating the pathname for a sub-view.
  const [activePagePath, setActivePagePath] = useState<string>(() => {
    if (typeof window === "undefined") return "/";
    const m = window.location.hash.match(/[#&]p=([^&]+)/);
    if (m) {
      try {
        return decodeURIComponent(m[1]);
      } catch {
        return "/";
      }
    }
    return "/";
  });
  // Browser back/forward + manual hash edits keep the active page in sync.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHash = () => {
      const m = window.location.hash.match(/[#&]p=([^&]+)/);
      if (m) {
        try {
          setActivePagePath(decodeURIComponent(m[1]));
          return;
        } catch {
          /* fallthrough */
        }
      }
      setActivePagePath("/");
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const pickActivePage = (path: string) => {
    setActivePagePath(path);
    if (typeof window !== "undefined") {
      // Drop the hash entirely for the home page so the URL stays
      // clean on first arrival; encode any other path so query-style
      // characters in the slug never break the regex above.
      const next =
        path === "/"
          ? window.location.pathname + window.location.search
          : `${window.location.pathname}${window.location.search}#p=${encodeURIComponent(path)}`;
      window.history.replaceState(null, "", next);
    }
  };
  // Default the customize area to COLLAPSED — the live template hero needs
  // to be the first thing the prospect sees. The collapsed bar carries an
  // inviting teaser ("Customize your build · domain on us · colors ·
  // add-ons") so they know what's hiding behind the chevron.
  const [toolbarExpanded, setToolbarExpanded] = useState(false);
  const sessionIdRef = useRef<string>(
    `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
  );
  // Auto-collapse plumbing for the customize panel. Once the prospect
  // makes a pick (template, add-on, domain) we want the live template
  // hero — *not* the toolbar — to be the next thing they see. We wait
  // ~700ms before collapsing so they get a beat to register what they
  // did, and we surface a small toast as a confirmation pulse so the
  // click never feels like it disappeared.
  //
  // Note: the original task brief (#177) listed "color swap" as a
  // fourth pick path. The portal's color/font customization UI was
  // retired earlier (see the long comment near the `nonEmpty` helper
  // and the legacy `?primary`/`?accent` query-string note further
  // down) — there is no UI surface that sets `customizations.primary`
  // / `accent` / `fontDisplay` anymore. The only field on
  // `PortalCustomizations` that the portal still mutates today is
  // `chosenDomain`, which IS wired below. If a color picker is ever
  // re-introduced, wire its `onChoose` to `notePick(...)` the same
  // way the template thumbs and DomainPicker do.
  //
  // Exception: the FIRST pick of the session leaves the panel open.
  // Power users routinely browse all 6 templates back-to-back; auto-
  // collapsing on every click would make them re-expand the panel for
  // each thumb. After the first commit we assume the prospect is
  // narrowing in and start auto-collapsing.
  const pickCountRef = useRef(0);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pickToast, setPickToast] = useState<string | null>(null);

  const notePick = (message: string) => {
    pickCountRef.current += 1;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setPickToast(message);
    toastTimerRef.current = setTimeout(() => setPickToast(null), 1800);
    // First pick keeps the panel open so the prospect can keep browsing.
    if (pickCountRef.current <= 1) return;
    // Skip the collapse timer entirely when the panel is already
    // closed — every today's pick path lives inside the expanded
    // panel, but a future caller could fire `notePick` from the
    // collapsed teaser flow and we don't want a stray timer to
    // overwrite a manual re-expand the prospect just performed.
    if (!toolbarExpanded) return;
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = setTimeout(() => {
      setToolbarExpanded(false);
      // (DomainPicker was retired 2026-04-28 in #185 — no domain panel
      // to collapse anymore. Kept the toolbar collapse so the visual
      // beat after a pick is unchanged.)
    }, 700);
  };

  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Keep state in sync if the portal is ever re-fetched (e.g. parent
  // remounts with fresh data). Today only used on first mount.
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // Debounced auto-save of customizations + template on change.
  const lastSavedRef = useRef<string>("");
  useEffect(() => {
    if (!slug) return;
    const payload = JSON.stringify({ activeTemplate, customizations });
    if (payload === lastSavedRef.current) return;
    const tid = setTimeout(() => {
      lastSavedRef.current = payload;
      void portalApi
        .patch(slug, { selectedTemplate: activeTemplate, customizations })
        .catch(() => {});
    }, 700);
    return () => clearTimeout(tid);
  }, [activeTemplate, customizations, slug]);

  // Cart sync (debounced) — keeps the rep timeline aware of the latest selection.
  useEffect(() => {
    if (!slug) return;
    const tid = setTimeout(() => {
      void portalApi
        .cart(slug, { templateKey: activeTemplate, addonSlugs: Array.from(selectedAddons) })
        .catch(() => {});
    }, 600);
    return () => clearTimeout(tid);
  }, [selectedAddons, activeTemplate, slug]);

  // Track template_view once per template change.
  const lastTemplateTrackedRef = useRef<TemplateKey | null>(null);
  useEffect(() => {
    if (!slug) return;
    if (lastTemplateTrackedRef.current === activeTemplate) return;
    lastTemplateTrackedRef.current = activeTemplate;
    void portalApi
      .event(slug, {
        eventType: "template_view",
        templateKey: activeTemplate,
        sessionId: sessionIdRef.current,
      })
      .catch(() => {});
  }, [activeTemplate, slug]);

  // Compute totals for the toolbar pricing pill.
  // The base now follows the live-selected tier (Boutique / Pro /
  // Concierge) so the pill reflects the tier the rep is showcasing.
  // Any extra paid add-on the rep stacks on TOP of the tier still
  // adds to the line.
  const monthlyTotalCents = useMemo(() => {
    const tierBase = TIERS[selectedTier].monthlyCents;
    // Slugs that ship bundled inside the selected tier — those don't
    // double-bill on top of `tierBase`.
    const tierCapSet = new Set<string>(
      TIERS[selectedTier].capabilities as readonly string[],
    );
    const extras = data.addons
      .filter(
        (a) =>
          selectedAddons.has(a.slug) &&
          !tierCapSet.has(a.slug) &&
          a.monthlyCents > 0,
      )
      .reduce((acc, a) => acc + a.monthlyCents, 0);
    return tierBase + extras;
  }, [data, selectedAddons, selectedTier]);

  const setupTotalCents = useMemo(() => {
    return data.addons
      .filter((a) => selectedAddons.has(a.slug))
      .reduce((acc, a) => acc + a.setupCents, 0);
  }, [data, selectedAddons]);

  const orderedAddons = useMemo(() => {
    const essentials: AddonSummary[] = [];
    const premium: AddonSummary[] = [];
    for (const a of data.addons) {
      const tier: AddonTier | undefined = ADDONS[a.slug]?.tier;
      if (tier === "premium") premium.push(a);
      else essentials.push(a);
    }
    essentials.sort((a, b) => a.monthlyCents - b.monthlyCents);
    premium.sort((a, b) => a.monthlyCents - b.monthlyCents);
    return [
      ...essentials.map((a) => ({ ...a, isPremium: false })),
      ...premium.map((a) => ({ ...a, isPremium: true })),
    ];
  }, [data]);

  /**
   * Catalog 2.0 grouping: split the side-rail add-ons by buyer angle
   * (client / doc / gatekeeper). Free-bundled add-ons (monthlyCents===0)
   * stay in a separate "Included" group at the top so they aren't lost
   * inside the paid columns.
   */
  const groupedAddons = useMemo(() => {
    const included: typeof orderedAddons = [];
    const byAngle: Record<AddonAngle, typeof orderedAddons> = {
      client: [],
      doc: [],
      gatekeeper: [],
    };
    for (const a of orderedAddons) {
      const def = ADDONS[a.slug];
      if (a.monthlyCents === 0 && a.setupCents === 0) {
        included.push(a);
        continue;
      }
      const angle = def?.angle;
      if (angle === "client" || angle === "doc" || angle === "gatekeeper") {
        byAngle[angle].push(a);
      } else {
        // Unknown / legacy slugs without a Catalog 2.0 angle still need
        // to render somewhere — bucket them under "doc" as a sensible
        // default so the rail never silently drops a paid add-on.
        byAngle.doc.push(a);
      }
    }
    return { included, byAngle };
  }, [orderedAddons]);

  // Click-preview drawer state for the side rail. Mirrors the exact
  // pattern used on the public Pricing page so the prospect sees the
  // same drawer UX whether they discover an add-on at /pricing or in
  // the portal toolbar.
  const [drawerKey, setDrawerKey] = useState<string | null>(null);
  // Drawer payload resolves from the paid catalog OR the seven free
  // default-features (synthesized into AddonDef shape so the body looks
  // identical). drawerMode swaps the footer's price + add CTA for an
  // "Always included" badge when the key is a default. #212.
  const drawerAddon: AddonDef | null = drawerKey
    ? (ADDONS[drawerKey] ??
        (DEFAULT_FEATURE_BY_KEY[drawerKey]
          ? defaultFeatureAsAddon(DEFAULT_FEATURE_BY_KEY[drawerKey]!)
          : null))
    : null;
  // Drawer mode: "included" when the chip represents something the
  // prospect already has at no extra cost — that covers BOTH the seven
  // always-on default features (DEFAULT_FEATURE_BY_KEY) AND the paid
  // add-ons that the rep has bundled-free into this prospect's plan
  // (monthlyCents===0 && setupCents===0, e.g. welcome_kit). Without this
  // second branch the drawer used to show a misleading "$0/mo · Add to
  // plan" CTA on bundled add-ons (founder feedback 2026-05-08).
  const drawerAddonRaw = drawerKey ? ADDONS[drawerKey] : null;
  const drawerIsBundledFree =
    !!drawerAddonRaw &&
    (data.addons.find((a) => a.slug === drawerKey)?.monthlyCents ?? drawerAddonRaw.monthlyCents) === 0 &&
    (data.addons.find((a) => a.slug === drawerKey)?.setupCents ?? drawerAddonRaw.setupCents) === 0;
  const drawerMode: AddonDrawerMode =
    drawerKey && (DEFAULT_FEATURE_BY_KEY[drawerKey] || drawerIsBundledFree)
      ? "included"
      : "selectable";
  const openDrawer = (slug: string) => {
    // Accept paid-addon slugs OR default-feature keys; reject anything
    // else so the drawer never opens on a stale/legacy slug. #212.
    if (!ADDONS[slug] && !DEFAULT_FEATURE_BY_KEY[slug]) return;
    setDrawerKey(slug);
    void portalApi
      .event(data.slug, {
        eventType: "addon_view",
        addonSlug: slug,
        sessionId: sessionIdRef.current,
      })
      .catch(() => {});
  };

  const selectedSlugsInOrder = useMemo(() => {
    return data.addons
      .filter((a) => selectedAddons.has(a.slug))
      .map((a) => a.slug);
  }, [data, selectedAddons]);

  const scrollToAddonDemo = (addonSlug: string) => {
    setTimeout(() => {
      const el = document.getElementById(`addon-inline-${addonSlug}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    // Auto-collapse the toolbar so the prospect lands on the demo
    // without the chrome covering it. Mirrors the post-pick collapse
    // in `notePick` but skips the toast — the scroll is the
    // confirmation here.
    if (toolbarExpanded) {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = setTimeout(() => {
        setToolbarExpanded(false);
      }, 300);
    }
  };

  const onToggleAddon = (addonSlug: string) => {
    const willSelect = !selectedAddons.has(addonSlug);
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(addonSlug)) next.delete(addonSlug);
      else next.add(addonSlug);
      return next;
    });
    void portalApi
      .event(data.slug, {
        eventType: "addon_toggle",
        addonSlug,
        metadata: { selected: willSelect },
        sessionId: sessionIdRef.current,
      })
      .catch(() => {});
    if (willSelect) {
      void portalApi
        .event(data.slug, {
          eventType: "addon_view",
          addonSlug,
          sessionId: sessionIdRef.current,
        })
        .catch(() => {});
      scrollToAddonDemo(addonSlug);
      // Confirm + auto-collapse the panel only when ADDING an add-on.
      // Removals stay sticky so the prospect can keep tidying their
      // build without the panel disappearing under them.
      const localized = ADDON_LOCALE_KEYS[addonSlug];
      const display = ADDONS[addonSlug];
      const apiName = data.addons.find((a) => a.slug === addonSlug)?.name;
      const label = localized
        ? t(localized.label)
        : (display?.label ?? apiName ?? addonSlug);
      notePick(t("portal_pick_toast_added", { label }));
    }
  };

  const tplDef = TEMPLATES[activeTemplate];
  const basePalette: PaletteDef = PALETTES[tplDef.paletteKeys[0]];
  const palette = overlayPalette(basePalette, customizations);
  // A7: copy the rep-authored headline (Zod schema PortalCustomizations.headline)
  // onto every TemplateContent we render so resolvePersona can pick it up
  // without threading a new prop through 9 templates.
  const customHeadline = customizations.headline?.trim() || null;
  const Component: ComponentType<{
    content: typeof SAMPLES[TemplateKey];
    palette: PaletteDef;
    templateKey: TemplateKey;
    /** Slot for add-on previews — see TemplateProps.tail. */
    tail?: ReactNode;
  }> = TEMPLATE_COMPONENTS[resolveTemplateKey(activeTemplate) ?? "garden"];

  // Personalise the template content with the lead's real data so the
  // rep can show the prospect *their own* practice name, city, phone,
  // and lead-clinician card during a co-browse — instead of generic
  // sample defaults like "Brazos Behavioral Health". The remaining
  // fields (full team, services, reviews) stay as illustrative defaults
  // until enrichment or the rep's manual edits fill them in.
  //
  // `nonEmpty` treats null/undefined/blank-only strings as missing so a
  // whitespace-only lead row falls back to the sample default rather than
  // rendering an empty header / blank email link in the contact card.
  const baseContent = pickSample(activeTemplate, locale);
  const nonEmpty = (s: string | null | undefined): string | null => {
    if (s == null) return null;
    const trimmed = s.trim();
    return trimmed.length > 0 ? trimmed : null;
  };
  // Rich preview-quality content built server-side from the same pipeline
  // the rep-side ProspectPreview uses (Google Places + AI synthesis +
  // website crawl). When present this is strictly preferred over both the
  // lighter `enrichment` field and the SAMPLE defaults — it carries the
  // real practice name, AI-rewritten mission, services with descriptions,
  // hero image, and team with bios. The `hasRealLeadData` flag below
  // determines whether we should HIDE sample fallbacks (Maya Alvarado &
  // her stock reviews) when we have a real lead but no per-section data —
  // the founder's rule: never show fake reviews/team/photos next to a
  // real practice name.
  const previewContent = data.previewContent;
  const hasRealLeadData =
    !!nonEmpty(data.practice) ||
    !!nonEmpty(data.name) ||
    !!previewContent?.practiceName;
  // Extract previewContent fields up front so they're in scope for the
  // tagline / mission / hero blocks below (which run before the team /
  // services / reviews mapping further down).
  const previewServices = previewContent?.services ?? [];
  const previewTeam = previewContent?.team ?? [];
  const previewReviews = previewContent?.reviews ?? [];
  const previewHero = previewContent?.heroImage ?? null;
  const previewMission = nonEmpty(previewContent?.mission ?? null);
  const previewTagline = nonEmpty(previewContent?.tagline ?? null);
  // Portal "WOW" enrichment fields — surfaced under the template hero as
  // badges / pills / pricing / testimonials / social / sources. Each is
  // defensively null-guarded so a portal with no enrichment data still
  // renders cleanly (sections short-circuit on empty input).
  const previewSpecialties = previewContent?.specialties ?? [];
  const previewLanguages = previewContent?.languages ?? [];
  const previewModalities = previewContent?.modalities ?? [];
  const previewInsurances = previewContent?.acceptedInsurances ?? [];
  const previewOffersInPerson = previewContent?.offersInPerson ?? null;
  const previewOffersTelehealth = previewContent?.offersTelehealth ?? null;
  const previewSlidingScale = previewContent?.acceptsSlidingScale ?? null;
  const previewPricingTiers = previewContent?.pricingTiers ?? [];
  const previewPricePerSession = previewContent?.pricePerSession ?? null;
  const previewTestimonials = previewContent?.testimonials ?? [];
  const previewSocialLinks = previewContent?.socialLinks ?? null;
  const previewBrand = previewContent?.brand ?? null;
  // `previewContent.bookingWidget.url` is already wired into the
  // template's primary CTA via `resolvePersona` (it prefers
  // `props.content.bookingWidget?.url` over the persona's
  // `booking_url`). Nothing to do here for the booking widget — the
  // templates render `r.bookingUrl` and the resolver does the lift.
  const previewDraftedPages = previewContent?.draftedPages ?? [];
  const previewDraftedJournal = previewContent?.draftedJournalEntries ?? [];
  const previewFieldSources = previewContent?.fieldSources ?? undefined;
  // Hero photo + tagline come strictly from real Google Places enrichment
  // (heroImage) and the rep-authored profile blurb. The legacy free-text
  // overrides on PortalCustomizations have been retired alongside
  // CustomizePanel — no UI surface ever set them, and accepting raw URLs
  // from a public endpoint without sanitization was a footgun.
  const blurb = nonEmpty(data.profileBlurb ?? null);
  const leadCity = nonEmpty(data.city);
  const leadState = nonEmpty(data.state);
  const leadLocationLabel =
    leadCity && leadState
      ? `${leadCity}, ${leadState}`
      : (leadCity ?? leadState);
  // Specialty-aware fallback for the hero subtitle. When the rep hasn't
  // authored a profile blurb yet we don't want to fall back to the
  // generic SHARED_SAMPLE.tagline ("Therapy that meets you where you
  // are…") on every preview — that line is correct but doesn't read as
  // *this* practitioner's. Instead, sniff the lead's `specialty` field
  // and surface the most marketable angle: trauma/EMDR, couples/family,
  // perinatal/postpartum, child/teen, or — when nothing matches — a
  // universal localized fallback. All copy is routed through `t()` so
  // EN/ES portals stay localized. Bilingualism is intentionally NOT
  // promoted here: most prospects do not market in two languages, and
  // the few who do surface it via their own `profileBlurb` or via the
  // team card's `identities` field. Was an unconditional
  // `blurb ?? baseContent.tagline` before 2026-04-27 — that meant Marie
  // Dubois (no blurb yet) shipped with the bilingual line as her H1.
  const specialtyText = nonEmpty(data.specialty)?.toLowerCase() ?? "";
  const cityForTagline = leadCity ?? leadState ?? "Texas";
  let derivedTagline: string | null = null;
  if (specialtyText) {
    // Note on regex: we omit `\b` before `ptsd` so that variants like
    // `cptsd` and `c-ptsd` (complex PTSD) still match, and we accept
    // `trauma-focused`/`traumas` via a permissive suffix on `trauma`.
    if (/(emdr|trauma|ptsd)/.test(specialtyText)) {
      derivedTagline = t("portal_tagline_emdr", { city: cityForTagline });
    } else if (/(couple|couples|family|relationship)/.test(specialtyText)) {
      derivedTagline = t("portal_tagline_couples", { city: cityForTagline });
    } else if (/(perinatal|postpartum|maternal)/.test(specialtyText)) {
      derivedTagline = t("portal_tagline_perinatal", { city: cityForTagline });
    } else if (/(child|teen|adolescen|youth)/.test(specialtyText)) {
      derivedTagline = t("portal_tagline_youth", { city: cityForTagline });
    }
  }
  // Real rep-authored blurb wins; then AI-synthesized tagline from the
  // crawled website; then a specialty-derived line; then a universal
  // localized fallback.
  const tagline =
    blurb ?? previewTagline ?? derivedTagline ?? t("portal_tagline_universal");
  // Surface a small SECONDARY pill ("Available in English & Spanish")
  // when the lead's Headway enrichment lists Spanish among the
  // practitioner's spoken languages. Intentionally not in the H1: see
  // the long comment above for why bilingualism doesn't lead. The pill
  // is rendered by templates that opt in (Garden today) via the
  // BrandData.bilingualBadge field — templates without an opt-in just
  // ignore it.
  const headwayLanguages = data.enrichment?.headway?.languages ?? [];
  const isSpanishAvailable = headwayLanguages.some((l) =>
    /(spanish|espa[nñ]ol)/i.test(l),
  );
  const bilingualBadge = isSpanishAvailable
    ? t("portal_bilingual_pill")
    : null;
  // Real Google Places enrichment when available — drives hero photo,
  // street address, hours, reviews and phone fallbacks. Null is fine: every
  // access uses optional chaining and falls back to the SAMPLE / lead row.
  const enrichment = data.enrichment;
  const enrichmentReviews = enrichment?.reviews ?? [];
  const enrichmentHours = enrichment?.hours ?? [];
  const enrichmentAddress = nonEmpty(enrichment?.formattedAddress ?? null);
  const enrichmentPhone = nonEmpty(enrichment?.formattedPhone ?? null);
  const enrichmentServices = enrichment?.services ?? [];

  const baseLead = baseContent.team[0];
  // Real leads: only render team members whose data we actually have,
  // never fall back to scaffold name/photo. Demo leads keep the full
  // sample lineup.
  //
  // Photo policy (locked 2026-05): only previewTeam — built by
  // buildPreviewContent in api-server/src/services/previewContent.ts —
  // is allowed to drive team rendering. previewTeam photos have already
  // been gated to trusted hosts (Psychology Today, Headway, the
  // prospect's first-party site). The raw `enrichmentTeam` from
  // getPortalEnrichmentForLead is NOT photo-gated and was the secondary
  // leak vector flagged alongside the Grinch enrichmentHero bug — a
  // mismatched Google Places / scraped team entry could otherwise inject
  // an off-policy headshot under a real practitioner's name. Drop it
  // from the fallback chain entirely; for real leads with no
  // policy-clean team, render an empty array (matches the existing
  // hasRealLeadData no-fake-people stance below).
  const teamSource = previewTeam;
  const personalisedTeam = teamSource.length > 0 && baseLead
    ? teamSource.map((entry, idx) => {
        const scaffold = baseContent.team[idx % baseContent.team.length] ?? baseLead;
        const bioOverride = nonEmpty(entry.bio);
        const realPhoto = nonEmpty(entry.photo);
        return {
          ...scaffold,
          name:
            idx === 0
              ? nonEmpty(data.name) ?? entry.name
              : entry.name,
          credentials:
            nonEmpty(entry.credentials) ??
            (idx === 0 ? nonEmpty(data.specialty) : null) ??
            (hasRealLeadData ? "" : scaffold.credentials),
          photo: realPhoto ?? (hasRealLeadData ? "" : scaffold.photo),
          bio: bioOverride ?? (hasRealLeadData ? "" : scaffold.bio),
          longBio: bioOverride ? [bioOverride] : hasRealLeadData ? [] : scaffold.longBio,
        };
      })
    : hasRealLeadData
      ? []
      : baseLead
        ? [
            {
              ...baseLead,
              name: nonEmpty(data.name) ?? baseLead.name,
              credentials: nonEmpty(data.specialty) ?? baseLead.credentials,
            },
            ...baseContent.team.slice(1),
          ]
        : baseContent.team;
  // Prefer rich previewContent.services (with real descriptions) over the
  // legacy enrichment service list (just names). When a real lead has zero
  // real services, render an empty list rather than the SAMPLE EMDR /
  // couples therapy stack — those would lie about the prospect's offering.
  const personalisedServices = previewServices.length > 0
    ? previewServices.map((s, idx) => ({
        name: s.name,
        description:
          s.description ??
          baseContent.services[idx % baseContent.services.length]?.description ??
          "",
      }))
    : enrichmentServices.length > 0
      ? enrichmentServices.map((name, idx) => ({
          name,
          description:
            baseContent.services[idx % baseContent.services.length]
              ?.description ?? "",
        }))
      : hasRealLeadData
        ? []
        : baseContent.services;
  const baseLocation = baseContent.locations[0];
  const personalisedLocations = baseLocation
    ? [
        {
          ...baseLocation,
          name: leadLocationLabel ?? baseLocation.name,
          // Use the real Google Places address when we have one; otherwise
          // fall back to the masked "address shown after reservation" copy
          // so the layout still renders without leaking a fake street.
          address:
            enrichmentAddress ??
            (leadLocationLabel
              ? `${leadLocationLabel} (address shown after reservation)`
              : baseLocation.address),
          hours:
            enrichmentHours.length > 0 ? enrichmentHours : baseLocation.hours,
        },
        ...baseContent.locations.slice(1),
      ]
    : baseContent.locations;
  // Map Google reviews into the template's `Review[]` shape. Prefer the
  // rich previewContent.reviews (already in {author, body, rating, source}
  // shape) and fall back to the legacy enrichment shape. When the prospect
  // has a real practice but ZERO real reviews, render an empty array rather
  // than the SAMPLE testimonials — fake reviews next to a real practice
  // name is the single biggest "looks broken" failure the founder flagged.
  const personalisedReviews = previewReviews.length > 0
    ? previewReviews
    : enrichmentReviews.length > 0
      ? enrichmentReviews.map((r) => ({
          author: r.author,
          body: r.text,
          rating: r.rating,
          source: r.source,
        }))
      : hasRealLeadData
        ? []
        : baseContent.reviews;
  // Lowercase, alphanumeric handle derived from the practice name. Used
  // as a default for social/directory slugs (Instagram, Facebook,
  // YouTube, Psychology Today, Headway) when the prospect has not yet
  // provided real handles — keeps the SocialRow visible in the live
  // template preview rather than rendering nothing.
  const practiceHandle =
    (nonEmpty(data.practice) ?? "ashford-practice")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 32) || "ashfordpractice";

  // Memoized so toolbar/toast state changes don't force a fresh
  // object every render and trigger the active template subtree to
  // reconcile. The active template renders `<Component content={...}>`
  // and even tiny identity changes on `content` cascade through
  // every section. Deps deliberately list every upstream so that a
  // real change still rebuilds the object — anything else is noise.
  // 2026-05-14 V4: when the scraped practice name is actually the brand of
  // an aggregator network the lead is listed on (Headway, Care.com,
  // Headlight Health, Grow Therapy, Alma, Psychology Today, etc.), it
  // would be displayed everywhere — logo, hero, bio body, footer — as
  // if it were the prospect's own practice. That's free advertising for
  // competitors on a preview we're trying to sell. Filter those tokens
  // out and fall back to the clinician's real name (lead.name) so the
  // preview shows the prospect's identity instead of a competitor's
  // brand. Mirror of JUNK_NAMES_NORMALIZED in resolvePersona.ts.
  const AGGREGATOR_BRANDS = new Set([
    "care","carecom","headway","headwayco","alma","almacom",
    "grow","growtherapy","talkspace","betterhelp",
    "zencare","zocdoc","healthgrades","therapyden","goodtherapy",
    "psychology","psychologytoday","psych","psychtoday",
    "openpath","monarch","inclusivetherapists",
    "therapy","counseling","wellness",
    "headlight","helloalma","simplepractice","theranest",
    "network","mentalhealth","mentalhealthcare",
  ]);
  const normBrand = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanPractice = (s: string | null | undefined): string | null => {
    const t = (s ?? "").trim();
    if (!t) return null;
    return AGGREGATOR_BRANDS.has(normBrand(t)) ? null : t;
  };

  const personalizedContent = useMemo(
    () => ({
      ...baseContent,
      practiceName:
        cleanPractice(previewContent?.practiceName ?? null) ??
        cleanPractice(data.practice) ??
        cleanPractice(data.name) ??
        baseContent.practiceName,
      tagline,
      // Mission paragraph: AI-synthesized from the prospect's website when
      // available, otherwise leave the SAMPLE mission only when we don't
      // have a real lead — never put fake mission copy under a real name.
      // TemplateContent.mission is `string` (not nullable). When we have a
      // real lead but no AI mission, fall back to an empty string — the
      // templates render-skip empty mission paragraphs rather than showing
      // SAMPLE Maya copy. Sample fallback only when no real lead at all.
      mission: previewMission ?? (hasRealLeadData ? "" : baseContent.mission),
      bilingualBadge,
      // Hero photo policy (locked 2026-05): only previewHero is allowed —
      // it has already been gated to trusted hosts (Psychology Today,
      // Headway, the prospect's first-party site). enrichmentHero is a
      // Google-Places-backed proxy URL and must NEVER drive the hero or
      // portrait, because Google Places routinely mis-matches the lead to a
      // nearby business whose photos can be anything (e.g. a Grinch costume
      // photo from an assisted-living facility ended up under a real
      // therapist's name on prod). For real leads with no policy-clean
      // hero, render an empty string and let the template's portrait
      // fallback (team[0].photo, then SAMPLE only when !hasRealLeadData)
      // handle the gap rather than leaking a stranger's photo.
      heroImage: previewHero ?? (hasRealLeadData ? "" : baseContent.heroImage),
      team: personalisedTeam,
      services: personalisedServices,
      reviews: personalisedReviews,
      locations: personalisedLocations,
      contact: {
        ...baseContent.contact,
        phone:
          nonEmpty(data.phone) ??
          enrichmentPhone ??
          baseContent.contact.phone,
        email: nonEmpty(data.email) ?? baseContent.contact.email,
        // Seed plausible defaults so the SocialRow + directory pills
        // render in the live preview even before the prospect provides
        // real handles. The user's iPad review (#221) flagged that the
        // bundled "Social Profiles Row" feature wasn't visible in the
        // template — it was returning null because no contact.* socials
        // were ever populated. Slugs derived from the practice name keep
        // the URLs unique-looking; clicking opens the directory's own
        // search page when the slug doesn't resolve, which is fine for
        // a preview ("here's where your profile would link").
        instagram:
          nonEmpty(baseContent.contact.instagram) ?? practiceHandle,
        facebook:
          nonEmpty(baseContent.contact.facebook) ?? practiceHandle,
        youtube:
          nonEmpty(baseContent.contact.youtube) ?? `@${practiceHandle}`,
        psychologyToday:
          nonEmpty(baseContent.contact.psychologyToday) ?? practiceHandle,
        headway:
          nonEmpty(baseContent.contact.headway) ?? practiceHandle,
      },
      // === Portal WOW: enrichment fields that templates already
      // know how to read from TemplateContent (specialties, languages,
      // modalities, testimonials, brand). Empty arrays / null are the
      // template-default "nothing extra" signal. ===
      specialties: previewSpecialties.length > 0 ? previewSpecialties : undefined,
      languages: previewLanguages.length > 0 ? previewLanguages : undefined,
      modalities: previewModalities.length > 0 ? previewModalities : undefined,
      testimonials:
        previewTestimonials.length > 0
          ? previewTestimonials.map((tt) => ({ author: tt.author, body: tt.body }))
          : undefined,
      brand:
        previewBrand && (previewBrand.logoUrl || previewBrand.accentColor)
          ? {
              logoUrl: previewBrand.logoUrl ?? null,
              faviconUrl: previewBrand.faviconUrl ?? null,
              accentColor: previewBrand.accentColor ?? null,
              fontFamily: previewBrand.fontFamily ?? null,
            }
          : undefined,
    }),
    [
      baseContent,
      previewContent?.practiceName,
      data.practice,
      data.phone,
      data.email,
      tagline,
      previewMission,
      bilingualBadge,
      previewHero,
      hasRealLeadData,
      personalisedTeam,
      personalisedServices,
      personalisedReviews,
      personalisedLocations,
      practiceHandle,
      enrichmentPhone,
      previewSpecialties,
      previewLanguages,
      previewModalities,
      previewTestimonials,
      previewBrand,
    ],
  );

  const ogUrl = `/api/public/portals/${data.slug}/og.png?og=${encodeURIComponent(data.ogSignature)}`;

  // Merge crawled pages with previewContent.draftedPages so the prospect
  // sees their full launch-ready page set in the PagesBar. Drafted pages
  // are de-duped against crawled ones (by `slug` or normalized `kind`)
  // so we never render two pills for "About" when both surfaces had it.
  const mergedPagesForBar: PortalPageItem[] = useMemo(() => {
    const crawled: PortalPageItem[] = data.pages.map((p) => ({
      path: p.path,
      title: p.title,
      h1: p.h1,
      kind: p.kind,
    }));
    if (previewDraftedPages.length === 0) return crawled;
    const seenPaths = new Set(crawled.map((p) => p.path.replace(/\/+$/, "")));
    const seenKinds = new Set(
      crawled.map((p) => (p.kind || "other").toLowerCase()),
    );
    const drafted: PortalPageItem[] = [];
    for (const d of previewDraftedPages) {
      const path = "/" + d.slug.replace(/^\/+|\/+$/g, "");
      const norm = path.replace(/\/+$/, "");
      const kind = (d.kind || "other").toLowerCase();
      if (seenPaths.has(norm)) continue;
      // Allow multiple "service" or "other" kinds; only dedupe singleton-ish kinds.
      const singletonKinds = new Set([
        "home",
        "about",
        "fees",
        "contact",
        "team",
      ]);
      if (singletonKinds.has(kind) && seenKinds.has(kind)) continue;
      seenPaths.add(norm);
      seenKinds.add(kind);
      drafted.push({
        path,
        title: d.title,
        h1: d.h1,
        kind: d.kind || "other",
        drafted: true,
      });
    }
    return [...crawled, ...drafted];
  }, [data.pages, previewDraftedPages]);

  const addonCountLabel =
    selectedAddons.size === 1
      ? t("portal_addons_count_one")
      : t("portal_addons_count_other", { n: selectedAddons.size });

  // Stable style identity prevents the root <div> from re-reconciling
  // when an unrelated state slot updates. `fontVars` and
  // `cssVarsForPalette` both return a fresh object literal each call,
  // so without these every toolbar/toast tick remounted the entire
  // embedded template's wrapper context.
  const rootStyle = useMemo(() => fontVars(customizations), [customizations]);
  const paletteStyle = useMemo(() => {
    const base = cssVarsForPalette(palette);
    // Brand accent: when the server-side `previewContent.brand.accentColor`
    // survived `validateAccentColor` (i.e. it's a usable hex), override the
    // template's `--color-primary` at the portal-template wrapper level so
    // the prospect sees their real brand color drive every primitive that
    // reads `var(--color-primary)`. Skin files DON'T need to be touched.
    if (previewBrand?.accentColor) {
      return {
        ...base,
        ["--color-primary" as string]: previewBrand.accentColor,
        ["--p-primary" as string]: previewBrand.accentColor,
      } as CSSProperties;
    }
    return base;
  }, [palette, previewBrand]);

  return (
    <div style={rootStyle} className="min-h-screen flex flex-col bg-cream">
      {/* === Live-tier switcher (rep-on-call quick demo).
       *   Sticky top pill that lets the rep pivot the visible site
       *   between Boutique / Pro / Concierge during a phone or Zoom
       *   call with the prospect. On tier change a fullscreen overlay
       *   plays for ~2.5s ("Rebuilding your Boutique Pro site…") and
       *   the underlying template re-renders with the new tier's
       *   capability set ticked on. Sits at z-60 so it stays above
       *   the sticky toolbar but below the rebuild overlay (z-100).
       * ============================================================ */}
      {/* LIVE DEMO tier-switcher pill removed per client request. */}

      {/* 2026-05-14 audit fix: when `data.practice` is a scraper-junk
          brand (Care, Headway, Grow Therapy, Headlight, Alma, etc.)
          the page <title> would read "Care · personal preview" — the
          aggregator brand standing in for the real clinician. Filter
          it here too, mirroring the JUNK_NAMES check in
          resolvePersona.ts so the title falls back to a neutral
          label rather than a stranger's brand. */}
      <Seo
        title={(() => {
          // A2 (founder 2026-05-19): use the lead's own name in the
          // <title> tag whenever it is non-empty. The earlier fallback
          // through `team[0]` silently leaked the practice OWNER
          // (e.g. Hiral Patel for Emery, Teri Johnson for Kandice).
          // We only accept `team[0].name` when it equals the lead's
          // name — i.e. team[0] IS the lead. Owner / founder data
          // belongs on a dedicated channel (enrichment.founder) and
          // never on team[0] going forward.
          const JUNK = new Set([
            "care","carecom","headway","headwayco","alma","almacom",
            "grow","growtherapy","talkspace","betterhelp",
            "zencare","zocdoc","healthgrades","therapyden","goodtherapy",
            "psychology","psychologytoday","psych","psychtoday",
            "openpath","monarch","inclusivetherapists",
            "therapy","counseling","wellness",
            "headlight","helloalma","simplepractice","theranest",
            "network","mentalhealth","mentalhealthcare",
          ]);
          const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
          const leadName = (data.name || "").trim();
          const teamFirst = (data.previewContent?.team?.[0]?.name || "").trim();
          const teamMatchesLead = leadName && teamFirst &&
            norm(teamFirst) === norm(leadName);
          // Prefer lead name; only use team[0] when it IS the lead.
          const tm = leadName || (teamMatchesLead ? teamFirst : "");
          const pr = (data.practice || "").trim();
          const label = (tm && !JUNK.has(norm(tm))) ? tm
                      : (pr && !JUNK.has(norm(pr))) ? pr
                      : "Personal site preview";
          return `${label} · personal preview · Ashford Creative`;
        })()}
        description={`A personal site preview for ${data.practice} in ${data.city}.`}
        path={`/preview/${data.slug}`}
        ogImage={ogUrl}
        noindex
      />

      {/* === Sticky chrome: design toolbar + crawled-pages nav ===
          Both bars are wrapped in a single sticky container so they
          travel together as the prospect scrolls. Earlier each bar set
          its own `sticky top-0` and they fought for the same anchor —
          either the toolbar covered the pages-nav or the pages-nav
          slid behind the expanded toolbar panel. Wrapping makes them
          a single, predictable header strip: design toolbar on top,
          crawled-pages bar immediately under it (mirrors the rep
          feedback "il faut garder le toolbar de design et ajouter en
          dessous une barre séparée de navigation de pages"). */}
      <div className="sticky top-0 z-40">
      {/* Dark toolbar surface (founder feedback 2026-05, #224): align
          the per-prospect portal toolbar with the public Maya / Template
          route so the design chrome reads identically across both
          surfaces. Switched from `bg-paper` (light) to `bg-ink text-cream`
          and adjusted nested foreground utilities to the cream palette. */}
      <div className="bg-ink text-cream border-b border-cream/10 shadow-lg transition-all">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setToolbarExpanded((v) => !v)}
              aria-label={toolbarExpanded ? t("portal_collapse") : t("portal_expand")}
              aria-expanded={toolbarExpanded}
              aria-controls="portal-toolbar-panel"
              className="p-1.5 hover:bg-cream/10 rounded-md transition-colors text-cream/70"
            >
              {toolbarExpanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
            {/* The lead-identity block (logo "A" + "PREPARED FOR · {name} —
                {practice}") was removed on 2026-04-27. The embedded
                template's own header just below already shows the
                practitioner's brand and a Book Consult CTA, so duplicating
                it in the sticky toolbar made the panel look "always
                expanded" to prospects. The toolbar is now a pure
                customize/build/reserve surface. */}
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            {!toolbarExpanded && (
              // Collapsed-state teaser. The portal opens with the toolbar
              // closed so the live template hero leads — but we still need
              // the prospect to know that templates, colors, the free
              // domain and add-ons live one click away. Clicking the
              // teaser pill expands the panel directly (no separate
              // chevron hunt).
              <button
                type="button"
                data-testid="portal-toolbar-teaser"
                onClick={() => setToolbarExpanded(true)}
                aria-label={t("portal_collapsed_teaser")}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs text-cream/75 hover:text-cream bg-cream/10 hover:bg-cream/15 transition-colors px-2.5 py-1 rounded-full"
              >
                <LayoutTemplate className="w-3.5 h-3.5" />
                <span className="font-medium">{TEMPLATES[activeTemplate].label}</span>
                <span className="text-cream/45">·</span>
                <span className="text-cream/60">{t("portal_collapsed_teaser")}</span>
                {selectedAddons.size > 0 && (
                  <span className="ml-1 text-cream/50">{addonCountLabel}</span>
                )}
              </button>
            )}
            <div className="flex flex-col items-end gap-1 sm:border-l sm:border-cream/15 sm:pl-5">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="flex flex-col items-end leading-tight">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-cream/45">
                    {t("portal_your_build")}
                  </span>
                  <span className="text-base font-display font-semibold text-cream">
                    {fmtUsd(monthlyTotalCents)}
                    <span className="text-xs text-cream/60 font-sans">{t("portal_per_month")}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReserve(true)}
                  className="bg-cream hover:bg-paper text-ink px-4 sm:px-5 py-2 rounded-full text-sm font-medium inline-flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {t("portal_reserve_cta")}
                </button>
              </div>
            </div>
          </div>
        </div>

        {toolbarExpanded && (
          <div
            id="portal-toolbar-panel"
            role="region"
            aria-label={t("portal_design_template")}
            className="px-4 sm:px-6 pb-5 pt-3 border-t border-cream/10 flex flex-col gap-6 max-h-[70vh] overflow-y-auto text-cream"
          >
            <div className="flex flex-col xl:flex-row gap-6 xl:gap-10">
              <div className="xl:w-[360px] xl:shrink-0">
                <div className="flex items-center gap-1.5 mb-3">
                  <LayoutTemplate className="w-3.5 h-3.5 text-cream/50" />
                  <span className="text-[11px] uppercase tracking-[0.18em] font-medium text-cream/65">
                    {t("portal_design_template")}
                  </span>
                  <span className="ml-auto text-[10px] text-cream/40 font-mono">
                    {ALL_TEMPLATE_KEYS.indexOf(activeTemplate) + 1}/{ALL_TEMPLATE_KEYS.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {ALL_TEMPLATE_KEYS.map((k) => (
                    <TemplateThumb
                      key={k}
                      tplKey={k}
                      active={k === activeTemplate}
                      onClick={() => {
                        if (k === activeTemplate) return;
                        setActiveTemplate(k);
                        notePick(
                          t("portal_pick_toast_saved", {
                            label: TEMPLATES[k].label,
                          }),
                        );
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                {/* Inline DomainPicker section was removed on 2026-04-28
                    (#185 Comms & Copy Hardening) — asking the prospect to
                    pick a domain on first portal load came across as a
                    sales-y upsell and wasn't aligned with how the actual
                    onboarding works (the rep proposes 2–3 names keyed to
                    the practice during the kickoff call). The
                    `chosenDomain` field on PortalCustomizations is still
                    forwarded into the Reserve flow when the rep sets it
                    via the rep dashboard. */}

                {/* Show a passive "domain on us" reminder when the rep
                    hasn't picked anything yet, and a confirmation chip
                    once a domain is on file. Either state is read-only. */}
                <section
                  id="portal-domain"
                  data-testid="portal-domain-inline"
                  className="mb-5 border-b border-cream/[0.06] pb-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-sage shrink-0" />
                    <span className="text-[11px] uppercase tracking-[0.18em] font-medium text-cream/65">
                      {t("portal_inline_domain_label")}
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-sage text-cream rounded shrink-0">
                      {t("domain_free_badge")}
                    </span>
                    <span className="ml-auto flex items-center gap-2 min-w-0">
                      {customizations.chosenDomain ? (
                        <>
                          <span className="font-mono text-[12px] text-cream truncate">
                            {customizations.chosenDomain}
                          </span>
                          <span className="inline-flex items-center gap-1 text-sage text-[11px] shrink-0">
                            <Check className="w-3 h-3" />
                            {t("domain_chosen_label")}
                          </span>
                        </>
                      ) : null}
                    </span>
                  </div>
                  {/* Wow surface: 3 DNS-checked domain candidates derived
                      from the prospect's name + practice. Available ones
                      (resolves NO A/AAAA/NS/MX records) get a green dot
                      and "we'll grab this for you". Hidden when the
                      prospect has already chosen a domain or when no
                      candidates surfaced. */}
                  {!customizations.chosenDomain &&
                    (previewContent?.domainSuggestions ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pl-5">
                        {(previewContent?.domainSuggestions ?? [])
                          .slice(0, 3)
                          .map((d: { domain: string; available: boolean }) => (
                            <span
                              key={d.domain}
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded font-mono text-[11px] ${
                                d.available
                                  ? "bg-sage/15 text-sage border border-sage/30"
                                  : "bg-cream/5 text-cream/40 border border-cream/10 line-through"
                              }`}
                              title={
                                d.available
                                  ? "Available — we'll register this for you when you reserve"
                                  : "Already taken"
                              }
                            >
                              {d.available ? (
                                <Check className="w-3 h-3" />
                              ) : null}
                              {d.domain}
                            </span>
                          ))}
                      </div>
                    )}
                </section>

                <div className="flex items-center gap-1.5 mb-3">
                  <Plus className="w-3.5 h-3.5 text-cream/50" />
                  <span className="text-[11px] uppercase tracking-[0.18em] font-medium text-cream/65">
                    {t("portal_optional_addons")}
                  </span>
                  <span className="ml-2 text-[10px] text-cream/40">
                    {t("portal_addons_hint")}
                  </span>
                  {setupTotalCents > 0 && (
                    <span className="ml-auto text-[10px] text-cream/55 font-mono">
                      {t("portal_setup_one_time", { amount: fmtUsd(setupTotalCents) })}
                    </span>
                  )}
                </div>
                {/* Catalog 2.0: render add-ons grouped by buyer angle.
                    Free-bundled add-ons sit in their own "Included"
                    band at the top so the prospect sees that value
                    first; paid add-ons are split into three columns
                    matching the public Pricing page. Each chip's
                    onPreview opens the same AddonPreviewDrawer. */}
                <div className="space-y-5">
                  {/* Included band: paid add-ons with the discount applied
                      (welcome_kit etc.) PLUS the seven free default
                      features (#212). Default-feature chips render as a
                      slim row of click-to-preview pills so the prospect
                      sees the full value of a $199/mo plan, not just the
                      paid extras. */}
                  {(groupedAddons.included.length > 0 ||
                    DEFAULT_FEATURES.length > 0) && (
                    <div>
                      {/* Included bandeau — single dense row merging
                          the free-bundled paid add-ons with the 7
                          default features. Replaces the chip-card grid
                          that consumed ~250px vertical (founder
                          feedback 2026-05: salesperson shouldn't waste
                          pitch time on free defaults). Each label is
                          click-to-preview so the per-item drawer
                          affordance is preserved. #214. */}
                      <IncludedBandeau
                        palette="sage"
                        locale={locale as "en" | "es"}
                        onPreview={(k) =>
                          // Open the drawer for any chip whose key
                          // resolves to a paid add-on OR a free default
                          // feature. The previous check only matched
                          // paid `ADDONS[k]`, so default-feature chips
                          // (office_tour, reviews_aggregator,
                          // daily_schedule_digest, google_business_locator,
                          // social_row) fell through to
                          // `scrollToAddonDemo` — which silently no-ops
                          // on custom prospect previews where the
                          // inline demo section isn't rendered.
                          // `openDrawer` already accepts both shapes
                          // (see L729).
                          ADDONS[k] || DEFAULT_FEATURE_BY_KEY[k]
                            ? openDrawer(k)
                            : scrollToAddonDemo(k)
                        }
                        items={[
                          ...groupedAddons.included.map((a) => ({
                            key: a.slug,
                            label: a.name,
                            bundled: true,
                          })),
                          ...DEFAULT_FEATURES.map((f) => ({ key: f.key, label: f.label })),
                        ]}
                      />
                      {/* Parallel "could be added" bandeau (founder
                          feedback 2026-05): the prospect needs to see
                          at a glance which paid add-ons exist and
                          aren't currently in their plan, mirroring the
                          included row but with a dashed border + muted
                          pill so the visual hierarchy stays clear.
                          Items come from the same `groupedAddons.byAngle`
                          buckets (client / doc / gatekeeper) but
                          filtered to slugs the prospect has NOT yet
                          picked. Tapping a label opens the same
                          per-add-on drawer so the prospect can read
                          the value prop before deciding to enable it
                          via the chips below. Hidden when every paid
                          add-on is already selected. */}
                      {(() => {
                        const optionalItems = (
                          ["client", "doc", "gatekeeper"] as const
                        )
                          .flatMap((angle) => groupedAddons.byAngle[angle])
                          .filter((a) => !selectedAddons.has(a.slug))
                          .map((a) => ({ key: a.slug, label: a.name }));
                        if (optionalItems.length === 0) return null;
                        return (
                          <div className="mt-2">
                            <IncludedBandeau
                              palette="sage"
                              variant="could-be-included"
                              locale={locale as "en" | "es"}
                              onPreview={(k) =>
                                ADDONS[k] || DEFAULT_FEATURE_BY_KEY[k]
                                  ? openDrawer(k)
                                  : scrollToAddonDemo(k)
                              }
                              items={optionalItems}
                            />
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  {/* The buyer-angle chip cards (For the prospective
                      client / For you, the practitioner / For the
                      front desk) used to render here as a 4-column
                      AddonChip grid. Removed 2026-05 (founder
                      feedback): the same paid add-ons are already
                      enumerated in the dashed "could be added"
                      bandeau directly above, and tapping any pill
                      there opens the AddonPreviewDrawer whose
                      "Add to plan" CTA fires the same `onToggleAddon`
                      the chip cards used to. Two surfaces for the
                      same list was just visual padding. */}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

        {/* Crawled-pages nav, glued under the design toolbar inside
            the same sticky wrapper. Hidden when no pages were
            crawled, so a brand-new lead with no website never sees an
            empty strip. PortalPagesBar still sets its own `sticky
            top-0` internally — neutralised here because the parent
            sticky container has no scrollable height of its own — but
            we keep it so the component remains usable standalone in
            tests / Storybook. The previous mount inside the template
            wrapper (right above `<RebuiltPageView>`) was removed; one
            source of truth means it can never desync from the
            toolbar. */}
        <PortalPagesBar
          pages={mergedPagesForBar}
          activePath={activePagePath}
          onPick={pickActivePage}
          prospectCity={data.city}
          draftedBadge={t("portal_wow_drafted_pages_badge")}
        />
      </div>

      {/* Confirmation toast for the most recent customize pick. Lives just
          under the sticky toolbar so the prospect always sees it land in
          context, and uses an `aria-live` region so screen readers
          announce the saved choice. The toast is purely informational —
          the underlying state was committed synchronously in `notePick`
          and the panel auto-collapses ~700ms later (see notes near
          `pickCountRef`). Re-mounting on each new message via the React
          `key` re-runs the fade-in animation. */}
      {pickToast && (
        <div
          key={pickToast}
          aria-live="polite"
          role="status"
          data-testid="portal-pick-toast"
          className="portal-pick-toast pointer-events-none fixed top-16 left-1/2 z-50 inline-flex items-center gap-1.5 bg-ink text-cream text-xs font-medium px-3 py-1.5 rounded-full shadow-lg"
        >
          <Check className="w-3.5 h-3.5 text-sage-light" strokeWidth={3} />
          <span className="truncate max-w-[60vw] sm:max-w-sm">{pickToast}</span>
        </div>
      )}

      {/* "Added to your build" chip strip. Renders below the sticky toolbar
          (i.e. immediately above the live template hero) whenever the
          prospect has at least one PAID add-on selected. Each chip exposes
          its monthly delta and a one-tap remove button so the prospect
          always knows what's contributing to the price they see in the
          toolbar. */}
      {(() => {
        const paidSelected = orderedAddons.filter(
          (a) => selectedAddons.has(a.slug) && a.monthlyCents > 0,
        );
        if (paidSelected.length === 0) return null;
        const countLabel =
          paidSelected.length === 1
            ? t("portal_added_chip_one")
            : t("portal_added_chip_other", { n: paidSelected.length });
        return (
          <div
            data-testid="portal-added-chip-strip"
            className="border-b border-ink/10 bg-cream/70 backdrop-blur"
          >
            <div className="px-4 sm:px-6 py-2.5 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-sage font-medium">
                <Sparkles className="w-3 h-3" />
                {t("portal_added_chip_eyebrow")}
                <span className="text-ink/45 normal-case tracking-normal text-xs ml-1">
                  · {countLabel}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {paidSelected.map((a) => {
                  const localized = ADDON_LOCALE_KEYS[a.slug];
                  const label = localized
                    ? t(localized.label)
                    : a.name;
                  return (
                    <span
                      key={a.slug}
                      data-testid={`portal-added-chip-${a.slug}`}
                      className="inline-flex items-center gap-1.5 bg-paper border border-sage/30 text-ink text-xs pl-2.5 pr-1.5 py-1 rounded-full shadow-sm"
                    >
                      <span className="font-medium">{label}</span>
                      {/* Hide price label on free add-ons (#221). */}
                      {a.monthlyCents > 0 && (
                        <span className="text-ink/55 font-mono text-[10px]">
                          +{fmtUsd(a.monthlyCents)}
                          {t("portal_per_month")}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onToggleAddon(a.slug)}
                        aria-label={t("portal_addon_remove_aria", { label })}
                        className="ml-0.5 p-0.5 rounded-full hover:bg-ink/10 text-ink/55 hover:text-ink transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      <main className="flex-1 min-w-0">
        {/* The trust-Q&A accordion was removed on 2026-04-25: it surfaced
            on the rep co-browse view where the rep IS the human and the
            generic FAQ ("Can I cancel?") felt out of place during a live
            sales conversation. The HelpPanel below still gives a solo
            prospect a one-tap path to the assigned rep. */}
        {/* IMPORTANT: the wrapper below uses `transform: translateZ(0)`
            to create a new containing block for any `position: fixed`
            descendants inside the embedded template. Several templates
            (Garden, Atrium, …) ship with their own `fixed top-0` brand
            header — without this wrapper those headers escape to the
            viewport and visually cover our sticky portal toolbar
            (chevron + YOUR BUILD + Reserve), making them inaccessible.
            With the wrapper, the template's "fixed" header anchors to
            the wrapper's top instead, so it appears JUST BELOW the
            portal toolbar, exactly as the prospect expects. */}
        <div
          data-testid="portal-template-scope"
          className="block"
          style={paletteStyle}
        >
          <PortalEnrichmentProvider
            value={data.enrichment ?? null}
            leadPracticeName={data.practice ?? null}
          >
          {/* TierProvider drives <TierGate> inside every template so
              tier-gated sections (online_booking, telehealth_bridge,
              ghostwritten journal, etc.) appear/disappear when the
              rep flips the LiveTierSwitcher above. */}
          <TierProvider tier={selectedTier}>
          <div
            data-testid="portal-template-frame"
            className="relative"
            style={{ transform: "translateZ(0)" }}
          >
            {/* Add-on previews are passed via the template's `tail` slot
                so they land ABOVE the template's per-template footer
                (Begin Consultation CTA + copyright + "Design by Ashford
                Creative" credit). Without this slot the founder reported
                on 2026-04-28 that enabling any add-on shoved the footer
                into the middle of the page. Mirrors the same pattern in
                `pages/TemplateRoute.tsx`. */}
            {/* Hide each template's own `<nav className="fixed ...">` —
                they duplicate the practitioner identity at top-left and
                visually collide with the portal's sticky header (locale
                switcher, "Talk to a human"). The portal shell already
                surfaces the prospect identity, so the template's own nav
                is noise. Same selector pattern as ProspectPreview. */}
            {/* PortalPagesBar moved up into the sticky chrome wrapper
                next to the design toolbar (see comment above the
                toolbar). Keeping this comment here as a breadcrumb so
                future edits don't re-mount it inside the template
                area. */}
            <div className="[&_nav.fixed]:!hidden">
            {(() => {
              // Resolve the page the prospect is currently viewing. The
              // home page is always the full template (with hero, fees,
              // FAQ, add-on tail, etc.); any other page renders a
              // RebuiltPageView that inherits the active palette/fonts
              // via the --p-* CSS vars set on the parent wrapper.
              //
              // We treat both `kind === "home"` and the literal `"/"`
              // path as home, and we fall back to the home view if the
              // hash references a page that isn't in `data.pages` (e.g.
              // an old deep-link that no longer matches a re-crawled
              // page list).
              const activePage =
                data.pages.find((p) => p.path === activePagePath) ?? null;
              const isHomeView =
                !activePage ||
                activePage.kind === "home" ||
                activePage.path === "/";
              if (!isHomeView && activePage) {
                return (
                  <RebuiltPageView
                    page={activePage}
                    templateKey={activeTemplate}
                    palette={palette}
                    prospectCity={data.city}
                  />
                );
              }
              return (
                <Component
                  content={personalizedContent}
                  palette={palette}
                  templateKey={activeTemplate}
                  tail={
                    selectedSlugsInOrder.length > 0 ? (
                      <div className="border-t border-ink/10">
                        {selectedSlugsInOrder.map((s) => {
                          const Inline = ADDON_INLINE_COMPONENTS[s];
                          if (!Inline) return null;
                          // #221 follow-up — bundled-free add-ons are
                          // already represented in the "ALSO INCLUDED"
                          // band above and rendered inside the live
                          // template iframe; a duplicate "Live add-on"
                          // section under the toolbar made the page
                          // feel padded with redundant previews. Only
                          // render the inline preview for paid add-ons
                          // the prospect is being upsold on.
                          const a = ADDONS[s];
                          // Bail out for any add-on the prospect already
                          // has bundled into the $199 plan: explicit
                          // `included` flag, zero monthly + zero setup,
                          // or a positive `originalMonthlyCents` (which
                          // marks "free version of a paid thing"). All
                          // three signal "this is already on the live
                          // site above — don't render a duplicate
                          // preview" (founder iPad note re: Google
                          // Profile Sync still showing as a +$15 card
                          // even though it's bundled).
                          const isIncluded =
                            !!a &&
                            (a.included === true ||
                              (a.monthlyCents === 0 && (a.setupCents ?? 0) === 0) ||
                              (a.originalMonthlyCents ?? 0) > a.monthlyCents);
                          if (isIncluded) return null;
                          return (
                            <Inline
                              key={s}
                              practitionerName={
                                data.name || personalizedContent.team[0]?.name || ""
                              }
                              included={false}
                            />
                          );
                        })}
                      </div>
                    ) : null
                  }
                />
              );
            })()}
            </div>
          </div>
          </TierProvider>
          </PortalEnrichmentProvider>
        </div>

        {/* === Portal WOW enrichment band ===
            Sits inside `<main>` so the page scroll order is:
            [template hero] → [enrichment badges] → [pricing tiers] →
            [homepage testimonials] → [drafted journal entries] →
            [sources chips] → [social row]. Each primitive returns
            null when its input is empty, so a brand-new lead with no
            enrichment data simply skips the band entirely.

            Wrapped in `paletteStyle` so every primitive reads the
            same per-template CSS variables the embedded template
            does — they look like part of the rendered site, not a
            separate portal surface. */}
        <div
          data-testid="portal-wow-enrichment"
          style={paletteStyle}
          className="block"
        >
          {previewBrand?.logoUrl ? (
            <div
              className="w-full px-6 md:px-12 py-8 flex items-center justify-center"
              style={{ backgroundColor: "var(--color-surface)" }}
            >
              <img
                src={previewBrand.logoUrl}
                alt={
                  personalizedContent.practiceName
                    ? `${personalizedContent.practiceName} logo`
                    : "Practice logo"
                }
                className="max-h-16 w-auto opacity-90"
                style={{ objectFit: "contain" }}
                loading="lazy"
              />
            </div>
          ) : null}
          <EnrichmentBadges
            specialtiesLabel={t("portal_wow_specialties_label")}
            modalitiesLabel={t("portal_wow_modalities_label")}
            languagesLabel={t("portal_wow_languages_label")}
            insuranceLabel={t("portal_wow_insurance_label")}
            inPersonLabel={t("portal_wow_pill_in_person")}
            telehealthLabel={t("portal_wow_pill_telehealth")}
            slidingScaleLabel={t("portal_wow_pill_sliding_scale")}
            specialties={previewSpecialties}
            modalities={previewModalities}
            languages={previewLanguages}
            acceptedInsurances={previewInsurances}
            offersInPerson={previewOffersInPerson}
            offersTelehealth={previewOffersTelehealth}
            acceptsSlidingScale={previewSlidingScale}
          />
          {(() => {
            // Pricing tiers (or fallback range) — single source of truth
            // for "what sessions cost". Tiers win when present; otherwise
            // synthesize one card from `pricePerSession.{min,max}` so the
            // band still renders for prospects whose enrichment landed
            // a band but no labeled tiers.
            if (previewPricingTiers.length > 0) {
              return (
                <PricingBandeau
                  eyebrow={t("portal_wow_pricing_eyebrow")}
                  title={t("portal_wow_pricing_title")}
                  perSessionLabel={t("portal_wow_pricing_session")}
                  tiers={previewPricingTiers}
                />
              );
            }
            const min = previewPricePerSession?.min ?? null;
            const max = previewPricePerSession?.max ?? null;
            if (min == null && max == null) return null;
            const amount = min ?? max;
            const rationale =
              min != null && max != null && max !== min
                ? t("portal_wow_pricing_range", {
                    min: `$${min}`,
                    max: `$${max}`,
                  })
                : null;
            return (
              <PricingBandeau
                eyebrow={t("portal_wow_pricing_eyebrow")}
                title={t("portal_wow_pricing_title")}
                perSessionLabel={t("portal_wow_pricing_session")}
                tiers={[
                  {
                    label: t("portal_wow_pricing_eyebrow"),
                    amount,
                    rationale,
                  },
                ]}
              />
            );
          })()}
          <HomepageTestimonials
            eyebrow={t("portal_wow_testimonials_eyebrow")}
            title={t("portal_wow_testimonials_title")}
            anonymousLabel={t("portal_wow_anonymous_author")}
            testimonials={previewTestimonials.map((tt) => ({
              author: tt.author,
              body: tt.body,
            }))}
          />
          <DraftedJournal
            eyebrow={t("portal_wow_journal_eyebrow")}
            title={t("portal_wow_journal_title")}
            readingLabelTemplate={t("portal_wow_journal_reading", { n: "{n}" })}
            entries={previewDraftedJournal.map((e) => ({
              title: e.title,
              slug: e.slug,
              excerpt: e.excerpt,
              readingMinutes: e.readingMinutes,
            }))}
          />
          <SourcesChips
            eyebrow={t("portal_wow_sources_eyebrow")}
            title={t("portal_wow_sources_title")}
            labels={{
              google_places: t("portal_wow_source_google_places"),
              google: t("portal_wow_source_google_places"),
              headway: t("portal_wow_source_headway"),
              psychology_today: t("portal_wow_source_psychology_today"),
              psychologytoday: t("portal_wow_source_psychology_today"),
              zencare: t("portal_wow_source_zencare"),
              website: t("portal_wow_source_website"),
              website_meta: t("portal_wow_source_website_meta"),
              site: t("portal_wow_source_website"),
              npi: t("portal_wow_source_npi"),
            }}
            fieldSources={previewFieldSources}
          />
          {previewSocialLinks ? (
            <SocialFooter
              eyebrow={t("portal_wow_social_eyebrow")}
              instagram={previewSocialLinks.instagram}
              facebook={previewSocialLinks.facebook}
              linkedin={previewSocialLinks.linkedin}
              tiktok={previewSocialLinks.tiktok}
              youtube={previewSocialLinks.youtube}
              psychologyToday={previewSocialLinks.psychologyToday}
              headway={previewSocialLinks.headway}
            />
          ) : null}
        </div>
      </main>

      {/* "Talk to a human" floating button. Only mounted for claimed leads
          — pool leads have no assigned rep and we'd rather show nothing
          than route to a generic mailbox. The button collapses to an icon
          when the toolbar is expanded so it never crowds the Reserve CTA.

          The legacy bottom-of-page domain CTA strip, the floating
          CustomizePanel popover and the modal domain picker were all
          removed on 2026-04-26. The customize toolbar is now the single
          shopping surface (templates · add-ons · domain), so duplicating
          those CTAs at the bottom of the page only confused the prospect
          about whether the domain was a separate purchase. The picker
          itself lives inline inside the toolbar above; older share-links
          that included `?primary`, `?accent`, `?fontDisplay`, etc. still
          resolve — those params are simply ignored on the portal page. */}
      {data.rep && (
        <HelpPanel
          rep={data.rep}
          slug={data.slug}
          sessionId={sessionIdRef.current}
          toolbarExpanded={toolbarExpanded}
        />
      )}

      {/* 2026-05-21 — Self-serve "Request a change" (Sprint 2 streamline). */}
      <ChangeRequestSection slug={data.slug} locale={locale === "es" ? "es" : "en"} />

      {showReserve && (
        <ReserveModal
          portal={data}
          templateKey={activeTemplate}
          selectedAddons={Array.from(selectedAddons)}
          monthlyTotalCents={monthlyTotalCents}
          setupTotalCents={setupTotalCents}
          chosenDomain={customizations.chosenDomain ?? null}
          onClose={() => setShowReserve(false)}
        />
      )}

      {/* Catalog 2.0 add-on click-preview drawer. Mounted at the root so
          it floats above the toolbar regardless of which chip opened it. */}
      <AddonPreviewDrawer
        addon={drawerAddon}
        isSelected={drawerKey ? selectedAddons.has(drawerKey) : false}
        onClose={() => setDrawerKey(null)}
        onAddToPlan={(key) => {
          onToggleAddon(key);
          setDrawerKey(null);
        }}
        mode={drawerMode}
        // Plumb the real practitioner so the welcome_kit drawer
        // preview's email "from" line shows e.g. Aaron Edmiston
        // instead of the SAMPLE "Dr. Maya Alvarado". Mirrors the
        // inline-section call site above (#219 / #221).
        practitionerName={
          data.name || personalizedContent.team[0]?.name || ""
        }
      />
    </div>
  );
}

