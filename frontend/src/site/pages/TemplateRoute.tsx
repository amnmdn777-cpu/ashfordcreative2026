import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import {
  PALETTES,
  TEMPLATES,
  TEMPLATE_KEYS,
  TIERS,
  CAPABILITIES,
  type CapabilityFeature,
  type PaletteDef,
  type PortalCustomizations,
  type TemplateKey,
  type TierDef,
  type TierKey,
} from "@workspace/api-zod";
import { TEMPLATE_COMPONENTS, resolveTemplateKey } from "@site/templates";
import { SAMPLES, pickSample } from "@site/templates/sampleContent";
import { ALL_ADDONS, type AddonKey } from "@site/templates/types";
import type { CSSProperties } from "react";
import { cssVarsForPalette } from "@site/lib/palette";
import { fmtUsdFromCents } from "@site/lib/utils";
import { Seo } from "@site/lib/seo";
import { useI18n } from "@site/lib/i18n";
import { fontVars, overlayPalette } from "@site/preview/portal/customizations";
import { ReserveModal } from "@site/preview/portal/ReserveModal";
import { trackFunnel } from "@site/lib/funnel";
import { ADDON_INLINE_COMPONENTS } from "@site/preview/portal/addonInline";
import { DemoProvider } from "@site/components/demo/DemoContext";
import { TierProvider } from "@site/hooks/useTier";
import { LiveTierSwitcher } from "@site/components/LiveTierSwitcher";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  Globe,
  LayoutTemplate,
  Link as LinkIcon,
  Sparkles,
  Star,
} from "lucide-react";

// Canonical template list (all 9) imported from @workspace/api-zod so
// adding a new TemplateKeyLiteral automatically flows into the popover
// without a manual edit here.
const ALL_TEMPLATE_KEYS: TemplateKey[] = TEMPLATE_KEYS as unknown as TemplateKey[];

const fmtUsd = fmtUsdFromCents;

// Fixed top-down display order for the tier picker — Boutique → Pro →
// Concierge — matches /pricing so the upgrade path reads the same on
// every surface.
const TIER_DISPLAY_ORDER: readonly TierKey[] = [
  "boutique",
  "boutique_pro",
  "boutique_concierge",
] as const;

// sessionStorage key. The picker persists across template switches in
// the same browser session so swapping templates doesn't reset choice.
const TIER_STORAGE_KEY = "tpl-selected-tier";

const isTierKey = (v: unknown): v is TierKey =>
  v === "boutique" || v === "boutique_pro" || v === "boutique_concierge";

/* ─────────────────────── tiny stylized template thumbnail ─────────────────────── */

const TemplateThumb = ({
  tplKey,
  active,
  onClick,
}: {
  tplKey: TemplateKey;
  active: boolean;
  onClick: () => void;
}) => {
  const tpl = TEMPLATES[tplKey];
  const palette = PALETTES[tpl.paletteKeys[0]];
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
      aria-label={tpl.label}
      className={`group flex flex-col items-center gap-1.5 transition-transform ${
        active ? "scale-105" : "hover:scale-105"
      }`}
      style={ttVars}
    >
      <div
        className={`pal-tt-bg-surface relative w-20 h-[60px] rounded-md border p-1 overflow-hidden shadow-sm transition-all ${
          active
            ? "border-cream ring-2 ring-cream/30"
            : "border-cream/15 hover:border-cream/40"
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
          <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-cream text-ink flex items-center justify-center">
            <Check className="w-2 h-2" strokeWidth={3} />
          </div>
        )}
      </div>
      <span
        className={`text-[11px] leading-tight ${
          active ? "text-cream font-medium" : "text-cream/55 group-hover:text-cream"
        }`}
      >
        {tpl.label}
      </span>
    </button>
  );
};

/* ─────────────────────────── Tier picker card ─────────────────────────── */

const TierCard = ({
  tier,
  selected,
  onSelect,
}: {
  tier: TierDef;
  selected: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    data-testid={`tpl-tier-card-${tier.key}`}
    className={
      "relative text-left p-3 rounded-lg border transition-colors flex flex-col items-start gap-1 " +
      (selected
        ? "border-gold bg-cream/[0.10]"
        : "border-cream/15 bg-cream/[0.03] hover:border-cream/30")
    }
  >
    {tier.recommended && (
      <span className="absolute -top-2 left-3 inline-flex items-center gap-1 bg-gold text-ink text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm">
        <Star className="w-2.5 h-2.5" strokeWidth={2.5} />
        Pro
      </span>
    )}
    <span className="text-[11px] font-mono uppercase tracking-widest text-cream/65">
      {tier.label}
    </span>
    <span className="font-display text-2xl text-cream leading-none">
      {fmtUsd(tier.monthlyCents)}
      <span className="text-[11px] text-cream/55 font-sans ml-1">/mo</span>
    </span>
  </button>
);

/* ─────────────────────────── Tier feature list row ─────────────────────────── */

const FeatureRow = ({ feature }: { feature: CapabilityFeature }) => (
  <li className="flex gap-2 items-start text-cream/85 text-[12px] leading-snug">
    <Check className="w-3.5 h-3.5 mt-0.5 text-sage shrink-0" strokeWidth={2.5} />
    <span>{feature.label}</span>
  </li>
);

/* ─────────────────────────── Page ─────────────────────────── */

/**
 * Public template showcase. The visitor lands here from `/templates` and
 * gets a full-bleed preview of one of the nine templates with a floating
 * "Try this template" pill that expands into a design bar:
 *
 *   - 9 template thumbnails (switch in place, no full reload)
 *   - Tier picker (Boutique / Pro / Concierge — tier-driven feature mix)
 *   - Live pricing pill (reflects selected tier)
 *   - Reserve CTA opens the self-serve ReserveModal → Stripe Checkout
 *   - URL is kept in sync (color/font overrides, domain, primary) so the
 *     visitor can "Copy link" and share their exact configuration
 *
 * The Phase 1B-b refactor replaced the addon multiselect + IncludedBandeau
 * categorized feature panel with a 3-tier picker. Inline addon demos
 * (online_booking, telehealth_bridge, …) still render under the template
 * — the chosen tier auto-enables every capability that ships an inline
 * demo so the visitor sees what they're getting. ADDONS imports remain
 * (via the deprecated shim) for the inline demo wiring only; Phase 1B-c
 * deletes the shim entirely.
 */
export default function TemplateRoute() {
  const { key } = useParams<{ key: string }>();
  const search = useSearch();
  const [currentPath, navigate] = useLocation();
  const { t, locale, setLocale } = useI18n();

  // Preserve the URL prefix the visitor entered on. The same component
  // serves both the canonical `/template/<slug>` and the short
  // `/t/<slug>` alias used in inbound campaign links / QR codes / SMS.
  const routePrefix = currentPath.startsWith("/t/") ? "/t" : "/template";

  const params = useMemo(() => new URLSearchParams(search), [search]);

  // ?bare=1 hides the demo control bar so the page can be screenshotted cleanly
  // for the /templates grid thumbnails (see scripts/capture-template-thumbs.mjs).
  const bare = params.get("bare") === "1";

  // Initial template (with legacy alias resolution).
  const initialResolved = resolveTemplateKey(key ?? "");
  const initialTplKey = (initialResolved ?? (key as TemplateKey)) as TemplateKey;

  const [activeTemplate, setActiveTemplate] = useState<TemplateKey>(initialTplKey);

  // Keep activeTemplate in sync if the URL :key segment changes (e.g. browser back/forward).
  useEffect(() => {
    const next = resolveTemplateKey(key ?? "") ?? (key as TemplateKey);
    if (next && ALL_TEMPLATE_KEYS.includes(next)) setActiveTemplate(next);
  }, [key]);

  // Funnel analytics: fire `template_view` on initial mount and on every
  // template switch. The admin self-serve report reads this as the
  // top-of-funnel event for per-template conversion math.
  useEffect(() => {
    void trackFunnel("template_view", { slug: activeTemplate });
  }, [activeTemplate]);

  const tpl = TEMPLATES[activeTemplate];
  const palettes: PaletteDef[] = tpl
    ? (tpl.paletteKeys.map((k) => PALETTES[k]).filter(Boolean) as PaletteDef[])
    : [];

  // ───── URL → state init ─────
  const initialDomain = params.get("domain") ?? "";
  const initialPrimary = params.get("primary") ?? "";
  const initialAccent = params.get("accent") ?? "";
  const initialFontDisplay = params.get("fontDisplay") ?? "";
  const initialFontBody = params.get("fontBody") ?? "";

  const paletteIdx = 0;

  // ───── Tier selection (NEW, 1B-b) ─────
  // Persists across template switches in the same browser session, so a
  // visitor evaluating multiple templates doesn't lose their tier choice
  // every time they click a thumbnail.
  const [selectedTier, setSelectedTier] = useState<TierKey>(() => {
    // CRITICAL #4 — ?tier= URL param takes precedence over session/default.
    // Accepts short aliases: "pro" → boutique_pro, "concierge" → boutique_concierge.
    const rawTier = params.get("tier");
    if (rawTier) {
      const normalized: TierKey | null =
        rawTier === "boutique" || rawTier === "boutique_pro" || rawTier === "boutique_concierge"
          ? rawTier
          : rawTier === "pro"
            ? "boutique_pro"
            : rawTier === "concierge"
              ? "boutique_concierge"
              : null;
      if (normalized) return normalized;
    }
    if (typeof window === "undefined") return "boutique";
    try {
      const stored = window.sessionStorage.getItem(TIER_STORAGE_KEY);
      if (isTierKey(stored)) return stored;
    } catch {
      /* sessionStorage may be unavailable (private mode, etc.) — fall through */
    }
    return "boutique";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(TIER_STORAGE_KEY, selectedTier);
    } catch {
      /* sessionStorage may be unavailable */
    }
  }, [selectedTier]);

  // Tier-driven feature mix. Each tier's capability list maps 1:1 to the
  // pre-1B-a addon keys for everything previously sold à la carte (online
  // booking, telehealth bridge, …). Build a Set so the inline-demo strip
  // below can render only what the chosen tier covers. The free-bundled
  // capabilities (insurance_sliding_scale, foundation features) are always
  // present because every tier's capability list includes them.
  const tierCapabilityKeys = useMemo(
    () => new Set<string>(TIERS[selectedTier].capabilities as readonly string[]),
    [selectedTier],
  );

  // Pricing pill reads tier monthly directly. No addon math anymore.
  const monthlyTotalCents = TIERS[selectedTier].monthlyCents;

  const [customizations, setCustomizations] = useState<PortalCustomizations>(
    () => ({
      ...(initialPrimary || initialAccent
        ? {
            colorOverrides: {
              ...(initialPrimary ? { primary: initialPrimary } : {}),
              ...(initialAccent ? { accent: initialAccent } : {}),
            },
          }
        : {}),
      ...(initialFontDisplay ? { fontDisplay: initialFontDisplay } : {}),
      ...(initialFontBody ? { fontBody: initialFontBody } : {}),
      ...(initialDomain ? { chosenDomain: initialDomain } : {}),
    }),
  );

  const [showReserve, setShowReserve] = useState(false);

  // Toolbar expand/collapse state. Both surfaces (this route + ProspectPortal)
  // load collapsed so the rendered design shows first, chrome second.
  const [toolbarExpanded, setToolbarExpanded] = useState(false);
  // Design-template 3x3 grid is collapsed by default to reclaim vertical
  // space. State persists per-session so a rep who expanded it once
  // doesn't have to keep re-opening on every template switch.
  const [designSectionExpanded, setDesignSectionExpanded] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem("tpl-design-section-expanded") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        "tpl-design-section-expanded",
        designSectionExpanded ? "1" : "0",
      );
    } catch {
      /* sessionStorage unavailable */
    }
  }, [designSectionExpanded]);
  // Outer collapse state for the floating demo bar. Default `false` so the
  // page loads as a "real practice site" — the persistent top bar broke
  // that illusion. Hover/focus on the pill pops the full bar open; tap
  // toggles for mobile. The expanded panel stays in the DOM at all times
  // so keyboard navigation and screen readers can reach it regardless of
  // visual state.
  const [barOpen, setBarOpen] = useState(false);
  const demoBarPillRef = useRef<HTMLButtonElement>(null);
  // When the user explicitly taps to close the pill (barOpen → false),
  // blur the pill so `group-focus-within` doesn't keep the panel open.
  useEffect(() => {
    if (!barOpen) demoBarPillRef.current?.blur();
  }, [barOpen]);
  const [copiedToast, setCopiedToast] = useState(false);

  // ───── state → URL sync ─────
  // The addons query param is no longer driven by an interactive multiselect;
  // we still preserve the customization/domain/bare params so a "Copy link"
  // share carries the visitor's design state.
  const lastUrlRef = useRef<string>("");
  useEffect(() => {
    const next = new URLSearchParams();
    if (customizations.colorOverrides?.primary)
      next.set("primary", customizations.colorOverrides.primary);
    if (customizations.colorOverrides?.accent)
      next.set("accent", customizations.colorOverrides.accent);
    if (customizations.fontDisplay)
      next.set("fontDisplay", customizations.fontDisplay);
    if (customizations.fontBody) next.set("fontBody", customizations.fontBody);
    if (customizations.chosenDomain)
      next.set("domain", customizations.chosenDomain);
    if (bare) next.set("bare", "1");
    const qs = next.toString();
    const target = `${routePrefix}/${activeTemplate}${qs ? `?${qs}` : ""}`;
    if (target === lastUrlRef.current) return;
    lastUrlRef.current = target;
    navigate(target, { replace: true });
  }, [activeTemplate, customizations, bare, navigate, routePrefix]);

  // We navigate synchronously here (in addition to the state→URL effect) so
  // the URL reflects the new template immediately on click — avoids a
  // transient frame where the active thumbnail changes but the address bar
  // is still on the old key.
  const onSwitchTemplate = (k: TemplateKey) => {
    if (k === activeTemplate) return;
    void trackFunnel("template_pick", {
      slug: k,
      payload: { from: activeTemplate },
    });
    setActiveTemplate(k);
    const qs = new URLSearchParams();
    if (customizations.colorOverrides?.primary)
      qs.set("primary", customizations.colorOverrides.primary);
    if (customizations.colorOverrides?.accent)
      qs.set("accent", customizations.colorOverrides.accent);
    if (customizations.fontDisplay) qs.set("fontDisplay", customizations.fontDisplay);
    if (customizations.fontBody) qs.set("fontBody", customizations.fontBody);
    if (customizations.chosenDomain) qs.set("domain", customizations.chosenDomain);
    if (bare) qs.set("bare", "1");
    const s = qs.toString();
    const target = `${routePrefix}/${k}${s ? `?${s}` : ""}`;
    lastUrlRef.current = target;
    navigate(target, { replace: true });
  };

  const onSelectTier = (k: TierKey) => {
    if (k === selectedTier) return;
    void trackFunnel("tier_pick", {
      slug: activeTemplate,
      payload: { from: selectedTier, to: k },
    });
    setSelectedTier(k);
  };

  const onCopyLink = useCallback(async () => {
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* Silent fallback — older browsers without clipboard API */
    }
    setCopiedToast(true);
    window.setTimeout(() => setCopiedToast(false), 2000);
  }, []);

  if (!tpl) {
    return (
      <div className="px-6 py-32 text-center">
        <p className="font-display text-2xl text-ink mb-4">Template not found</p>
        <Link href="/templates" className="text-sage underline">← Templates</Link>
      </div>
    );
  }

  const basePalette = palettes[Math.min(paletteIdx, palettes.length - 1)] ?? palettes[0];
  const palette = overlayPalette(basePalette, customizations);
  const Component: ComponentType<{
    content: typeof SAMPLES[TemplateKey];
    palette: PaletteDef;
    templateKey: TemplateKey;
    tail?: ReactNode;
  }> = TEMPLATE_COMPONENTS[resolveTemplateKey(activeTemplate) ?? "garden"];
  const sample = pickSample(activeTemplate, locale);

  // Templates render add-on-aware sections only for the typed AddonKey set.
  // Derive the slug list from the tier's capabilities ∩ ALL_ADDONS so the
  // template sees only what the chosen tier covers.
  const tierAddonSlugs: AddonKey[] = (Array.from(tierCapabilityKeys) as string[])
    .filter((s): s is AddonKey => (ALL_ADDONS as readonly string[]).includes(s));
  const content = { ...sample, addons: tierAddonSlugs };

  // Inline demos under the template: render for every tier-enabled
  // capability that has a registered inline component, in capability-list
  // order. Free-bundled foundation features (sliding scale etc.) don't
  // have inline components so they're naturally excluded.
  const inlineDemoKeys = (TIERS[selectedTier].capabilities as readonly string[]).filter(
    (k) => ADDON_INLINE_COMPONENTS[k],
  );

  // For the panel feature list: full capability set for the selected tier
  // hydrated to CapabilityFeature[].
  const tierFeatures = TIERS[selectedTier].capabilities.map((k) => CAPABILITIES[k]);
  // For "Everything in <prev> plus" headers in the panel feature list.
  const previousTierKey: TierKey | null =
    selectedTier === "boutique_pro"
      ? "boutique"
      : selectedTier === "boutique_concierge"
        ? "boutique_pro"
        : null;
  const deltaFeatures = previousTierKey
    ? tierFeatures.filter(
        (f) =>
          !(TIERS[previousTierKey].capabilities as readonly string[]).includes(f.key),
      )
    : tierFeatures;
  const previousTierLabel = previousTierKey ? TIERS[previousTierKey].label : null;

  return (
    <div style={fontVars(customizations)} className="min-h-screen flex flex-col bg-cream overflow-x-clip">
      <Seo
        title={`${tpl.label} template demo`}
        description={tpl.description}
        path={`/template/${tpl.key}`}
        ogImage={`/og/${tpl.key}.png`}
        noindex
      />

      {/* === Live-tier switcher (rep-on-call quick demo).
       *  Sticky top-right pill that lets a sales rep pivot the visible
       *  site between Boutique / Pro / Concierge during a phone or
       *  Zoom call, with a fullscreen ~2.5s "rebuild" overlay so the
       *  customer sees a real moment of swap, not a state diff.
       *  Wired to the same `selectedTier` used by the existing
       *  TierProvider so the inline demos, pricing pill, and feature
       *  list stay in sync. Hidden on ?bare=1 (thumbnail capture).
       * ============================================================ */}
      {/* LIVE DEMO tier-switcher pill removed per client request. */}

      {/* === Floating demo bar. ====================================
       *  A "Try this template" pill anchored lower-left expands on
       *  hover/focus/tap into the design bar. Hidden when ?bare=1
       *  for thumbnail capture. The expanded panel stays in the DOM
       *  whether open or not — collapse is via opacity + transform +
       *  pointer-events so keyboard users can tab in via
       *  group-focus-within.
       * ============================================================ */}
      {!bare && (
        <div
          // Mobile: bottom-24 to clear the edge-anchored 988 crisis
          // banner. Desktop: bottom-4 since the crisis banner is a
          // small 360px pill on the right that doesn't overlap.
          className="fixed bottom-24 sm:bottom-4 left-4 z-40 print:hidden"
          data-testid="tpl-demo-bar"
        >
          <div className="group">
            {/* Hover is handled in CSS via `group-hover:*` on the panel,
             *  not React state — letting click-toggle (barOpen) own the
             *  state cleanly. Without this split, onMouseEnter on the
             *  group raced the onClick on the pill on mobile. Pure CSS
             *  for hover dodges the race. */}
            <button
              ref={demoBarPillRef}
              type="button"
              onClick={() => setBarOpen((v) => !v)}
              aria-expanded={barOpen}
              aria-controls="tpl-design-bar"
              data-testid="tpl-demo-bar-pill"
              className="inline-flex items-center gap-2 bg-ink text-cream text-xs font-medium px-4 py-2.5 rounded-full shadow-lg border border-cream/10 hover:bg-ink-deep transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-gold" />
              <span>{locale === "es" ? "Probar esta plantilla" : "Try this template"}</span>
            </button>

            {/* Expanded design bar — opens on hover (desktop),
             *  focus-within (keyboard), or tap-toggled barOpen state
             *  (mobile). Anchored ABOVE the pill so it doesn't push
             *  the pill off-screen.
             *
             *  Spacing note: the visual 12px gap between the pill and
             *  the toolbar is implemented as PADDING on this panel
             *  (pb-3), NOT margin. With margin, the gap is outside the
             *  panel's hit area, so a cursor crossing pill → toolbar
             *  passed through dead space, `.group:hover` ceased, and
             *  the panel shut from under the user mid-traversal. With
             *  padding, the gap is inside the panel — `.group:hover`
             *  stays true the whole way up. Same pixels on screen,
             *  hover-continuous. Do not regress (see PR #7). */}
            <div
              id="tpl-design-bar"
              data-testid="tpl-demo-bar-panel"
              data-state={barOpen ? "open" : "closed"}
              className={`absolute bottom-full left-0 pb-3 origin-bottom-left transition-all duration-200 ease-out w-[min(640px,calc(100vw-2rem))] ${
                barOpen
                  ? "opacity-100 translate-y-0 pointer-events-auto"
                  : "opacity-0 translate-y-2 pointer-events-none"
              } group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:translate-y-0 group-focus-within:pointer-events-auto`}
            >
              <div className="bg-ink text-cream border border-cream/10 rounded-lg shadow-2xl overflow-hidden">
                <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setToolbarExpanded((v) => !v)}
                      aria-label={toolbarExpanded ? t("portal_collapse") : t("portal_expand")}
                      aria-expanded={toolbarExpanded}
                      aria-controls="tpl-toolbar-panel"
                      className="p-1.5 hover:bg-cream/10 rounded-md transition-colors text-cream/70"
                    >
                      {toolbarExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                    <Link
                      href="/templates"
                      className="inline-flex items-center gap-2 text-cream/70 hover:text-gold text-xs font-mono uppercase tracking-widest"
                    >
                      <ArrowLeft className="w-3 h-3" /> {t("tpl_show_back")}
                    </Link>
                    <div className="hidden sm:flex flex-col leading-tight ml-2">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-cream/45">
                        {t("tpl_show_eyebrow")}
                      </span>
                      <span className="text-sm font-medium text-cream truncate">{tpl.label}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-5">
                    <div
                      role="group"
                      aria-label="Language"
                      className="inline-flex items-center rounded-full border border-cream/15 overflow-hidden text-[11px] font-mono tracking-widest"
                    >
                      <button
                        type="button"
                        onClick={() => setLocale("en")}
                        aria-pressed={locale === "en"}
                        className={`px-2.5 py-1 transition-colors ${
                          locale === "en"
                            ? "bg-cream text-ink"
                            : "text-cream/65 hover:text-cream"
                        }`}
                      >
                        EN
                      </button>
                      <button
                        type="button"
                        onClick={() => setLocale("es")}
                        aria-pressed={locale === "es"}
                        className={`px-2.5 py-1 transition-colors ${
                          locale === "es"
                            ? "bg-cream text-ink"
                            : "text-cream/65 hover:text-cream"
                        }`}
                      >
                        ES
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={onCopyLink}
                      className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-cream/70 hover:text-cream font-medium px-2.5 py-1.5 rounded-md border border-cream/15 hover:border-cream/30 transition-colors"
                    >
                      <LinkIcon className="w-3 h-3" /> {t("tpl_show_copy_link")}
                    </button>
                    <div className="flex flex-col items-end gap-1 sm:border-l sm:border-cream/15 sm:pl-5">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="flex flex-col items-end leading-tight">
                          <span className="text-[10px] uppercase tracking-[0.2em] text-cream/45">
                            {t("portal_your_build")}
                          </span>
                          <span
                            data-testid="tpl-reserve-price"
                            className="text-base font-display font-semibold text-cream"
                          >
                            {fmtUsd(monthlyTotalCents)}
                            <span className="text-xs text-cream/55 font-sans">{t("portal_per_month")}</span>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            void trackFunnel("reserve_open", {
                              slug: activeTemplate,
                              payload: {
                                paletteIdx,
                                tierKey: selectedTier,
                                monthlyTotalCents,
                              },
                            });
                            setShowReserve(true);
                          }}
                          data-testid="tpl-reserve-cta"
                          className="bg-cream hover:bg-paper text-ink px-4 sm:px-5 py-2 rounded-full text-sm font-medium inline-flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          {/* Price is concatenated inline so React re-renders
                              the label whenever `monthlyTotalCents` changes
                              (i.e. when the visitor clicks a different tier
                              card). Previously routed through an i18n
                              `{price}` placeholder; the prod bundle was
                              caching the resolved string at module-load,
                              not at render — clicks updated YOUR SITE but
                              not this label. */}
                          {`${t("portal_reserve_cta")} · ${fmtUsd(monthlyTotalCents)}`}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {toolbarExpanded && (
                  <div
                    id="tpl-toolbar-panel"
                    role="region"
                    aria-label={t("portal_design_template")}
                    className="px-4 sm:px-6 pb-5 pt-3 border-t border-cream/10 flex flex-col gap-6"
                  >
                    {/* Row 1: Design template — collapsible 3x3 grid. */}
                    <div data-testid="tpl-design-section">
                      <button
                        type="button"
                        onClick={() => setDesignSectionExpanded((v) => !v)}
                        aria-expanded={designSectionExpanded}
                        aria-controls="tpl-design-grid"
                        className="w-full flex items-center gap-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cream/40 rounded"
                      >
                        <LayoutTemplate className="w-3.5 h-3.5 text-cream/55 shrink-0" />
                        <span className="text-[11px] uppercase tracking-[0.18em] font-medium text-cream/65 shrink-0">
                          {t("portal_design_template")}
                        </span>
                        <span className="text-cream/40 shrink-0" aria-hidden>·</span>
                        <span className="text-[12px] text-cream/90 font-medium truncate">
                          {TEMPLATES[activeTemplate].label}
                        </span>
                        <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-mono text-cream/55 shrink-0">
                          {locale === "es" ? "Cambiar" : "Change"}
                          {designSectionExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </span>
                        <span
                          data-testid="tpl-design-counter"
                          className="text-[10px] text-cream/40 font-mono shrink-0 ml-1"
                        >
                          {ALL_TEMPLATE_KEYS.indexOf(activeTemplate) + 1}/{ALL_TEMPLATE_KEYS.length}
                        </span>
                      </button>
                      <div
                        id="tpl-design-grid"
                        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                          designSectionExpanded ? "grid-rows-[1fr] mt-3" : "grid-rows-[0fr]"
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="grid grid-cols-3 gap-x-3 gap-y-4 justify-items-center">
                            {ALL_TEMPLATE_KEYS.map((k) => (
                              <TemplateThumb
                                key={k}
                                tplKey={k}
                                active={k === activeTemplate}
                                onClick={() => onSwitchTemplate(k)}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Tier picker (1B-b). 3 cards side-by-side
                        on sm+, stacked on mobile. Pro carries the
                        Recommended badge; selection updates Reserve
                        price + the feature list below. */}
                    <div
                      data-testid="tpl-tier-picker"
                      className="border-t border-cream/10 pt-4"
                    >
                      <div className="flex items-center gap-1.5 mb-3">
                        <Sparkles className="w-3.5 h-3.5 text-cream/55" />
                        <span className="text-[11px] uppercase tracking-[0.18em] font-medium text-cream/65">
                          {locale === "es" ? "Elige tu nivel" : "Choose your tier"}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                        {TIER_DISPLAY_ORDER.map((k) => (
                          <TierCard
                            key={k}
                            tier={TIERS[k]}
                            selected={k === selectedTier}
                            onSelect={() => onSelectTier(k)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Row 3: Free-domain reminder strip with FREE badge. */}
                    <section
                      data-testid="tpl-domain-inline"
                      className="border-t border-cream/10 pt-4 flex items-center gap-2"
                    >
                      <Globe className="w-3.5 h-3.5 text-sage shrink-0" />
                      <span className="text-[11px] uppercase tracking-[0.18em] font-medium text-cream/75">
                        {t("portal_inline_domain_label")}
                      </span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-sage text-cream rounded shrink-0">
                        {t("domain_free_badge")}
                      </span>
                      {customizations.chosenDomain ? (
                        <span className="ml-auto flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[12px] text-cream truncate">
                            {customizations.chosenDomain}
                          </span>
                          <span className="inline-flex items-center gap-1 text-sage text-[11px] shrink-0">
                            <Check className="w-3 h-3" />
                            {t("domain_chosen_label")}
                          </span>
                        </span>
                      ) : null}
                    </section>

                    {/* Row 4: Tier feature list. For Pro/Concierge, header
                        reads "Everything in <prev>, plus:" and only the
                        delta is shown — keeps the panel scannable. For
                        Boutique (the floor tier), the full 7 capabilities
                        render. */}
                    <div
                      data-testid="tpl-tier-features"
                      className="border-t border-cream/10 pt-4"
                    >
                      <div className="flex items-center gap-1.5 mb-3">
                        <Check className="w-3.5 h-3.5 text-cream/55" />
                        <span className="text-[11px] uppercase tracking-[0.18em] font-medium text-cream/65">
                          {previousTierLabel
                            ? locale === "es"
                              ? `Todo lo de ${previousTierLabel}, más:`
                              : `Everything in ${previousTierLabel}, plus:`
                            : locale === "es"
                              ? "Lo que incluye"
                              : "What's included"}
                        </span>
                      </div>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                        {deltaFeatures.map((feature) => (
                          <FeatureRow key={feature.key} feature={feature} />
                        ))}
                      </ul>
                      <a
                        href="/compared"
                        className="inline-flex items-center gap-1 mt-4 text-[11px] text-cream/55 hover:text-cream font-mono uppercase tracking-widest"
                      >
                        {locale === "es" ? "Ver comparación" : "See full comparison"}
                        <ArrowUpRight className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0">
        {/* IMPORTANT: the wrapper below uses `transform: translateZ(0)` to
            create a new containing block for any `position: fixed`
            descendants inside the embedded template. Several templates
            (Garden, Atrium, …) ship with their own `fixed top-0` brand
            header — without this wrapper those headers escape to the
            viewport and visually overlap the sticky design bar above. */}
        <div
          data-testid="tpl-route-template-scope"
          className="block"
          style={cssVarsForPalette(palette)}
        >
          <div
            data-testid="tpl-route-template-frame"
            className="relative"
            style={{ transform: "translateZ(0)" }}
          >
            <DemoProvider templateKey={activeTemplate}>
              {/* CRITICAL #4 — TierProvider drives <TierGate> inside templates. */}
              <TierProvider tier={selectedTier}>
              <Component
                content={content}
                palette={palette}
                templateKey={activeTemplate}
                tail={(() => {
                  if (bare) return null;
                  if (inlineDemoKeys.length === 0) return null;
                  return (
                    <div className="border-t border-ink/10">
                      {inlineDemoKeys.map((s) => {
                        const Inline = ADDON_INLINE_COMPONENTS[s];
                        return <Inline key={s} />;
                      })}
                    </div>
                  );
                })()}
              />
              </TierProvider>
            </DemoProvider>
          </div>
        </div>
      </main>

      {/* Toast — Copy link confirmation. */}
      {copiedToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-ink text-cream text-xs font-medium px-4 py-2 rounded-full shadow-2xl inline-flex items-center gap-2"
        >
          <Check className="w-3.5 h-3.5 text-sage" />
          {t("tpl_show_copied")}
        </div>
      )}

      {showReserve && (
        <ReserveModal
          mode="self_serve"
          templateKey={activeTemplate}
          paletteKey={basePalette?.key}
          tierKey={selectedTier}
          selectedAddons={tierAddonSlugs}
          monthlyTotalCents={monthlyTotalCents}
          setupTotalCents={0}
          chosenDomain={customizations.chosenDomain ?? null}
          customizations={customizations}
          locale={locale}
          onClose={() => setShowReserve(false)}
        />
      )}
    </div>
  );
}
