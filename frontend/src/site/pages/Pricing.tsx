import { useMemo, useState } from "react";
import { CheckCircle2, Star, ArrowRight } from "lucide-react";
import {
  TIERS,
  CAPABILITIES,
  type CapabilityFeature,
  type TierDef,
  type TierKey,
} from "@workspace/api-zod";
import { useI18n } from "@site/lib/i18n";
import type { StringKey } from "@site/lib/strings";
import { assertSafeRedirectUrl } from "@site/lib/api";
import { Seo } from "@site/lib/seo";
import { PageCTA } from "@site/components/PageCTA";
import { WcagGuaranteeBadge } from "@site/components/WcagGuaranteeBadge";
import { CompetitorTable } from "@site/components/CompetitorTable";

// Static string-key map per tier. Lets us derive `t(...)` arguments from a
// TierKey at runtime without losing the StringKey literal-union typecheck
// (template literals from a runtime string can't satisfy keyof translations).
const TIER_LABEL_KEY: Record<TierKey, StringKey> = {
  boutique: "tier_boutique_label",
  boutique_pro: "tier_boutique_pro_label",
  boutique_concierge: "tier_boutique_concierge_label",
};
const TIER_TAGLINE_KEY: Record<TierKey, StringKey> = {
  boutique: "tier_boutique_tagline",
  boutique_pro: "tier_boutique_pro_tagline",
  boutique_concierge: "tier_boutique_concierge_tagline",
};
const TIER_CTA_KEY: Record<TierKey, StringKey> = {
  boutique: "tier_boutique_cta",
  boutique_pro: "tier_boutique_pro_cta",
  boutique_concierge: "tier_boutique_concierge_cta",
};
const TIER_EVERYTHING_IN_PREV_KEY: Record<
  Exclude<TierKey, "boutique">,
  StringKey
> = {
  boutique_pro: "tier_everything_in_boutique_plus",
  boutique_concierge: "tier_everything_in_boutique_pro_plus",
};

const fmt = (cents: number) =>
  cents === 0 ? "$0" : `$${(cents / 100).toFixed(0)}`;

// Tier display order is fixed top-down: Boutique → Pro → Concierge. Same
// order on every surface (cards, picker, admin) so the reader never has to
// re-scan to find the upgrade path.
const TIER_DISPLAY_ORDER: readonly TierKey[] = [
  "boutique",
  "boutique_pro",
  "boutique_concierge",
] as const;

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ||
  "/api";

export default function Pricing() {
  const { t, locale } = useI18n();
  const tx = (en: string, es: string) => (locale === "es" ? es : en);

  // Tier the SelfServeCheckout block is reserving. Hoisted so the tier cards
  // can both render `Recommended` styling AND let "Choose <tier>" CTAs jump
  // to the checkout block with the right tier preselected.
  const [selectedTier, setSelectedTier] = useState<TierKey>("boutique_pro");

  const tiers = useMemo(
    () => TIER_DISPLAY_ORDER.map((k) => TIERS[k]),
    [],
  );

  // Boutique's 7 capabilities are the "in every tier" foundation. Render them
  // once below the cards so each card stays scannable instead of repeating
  // the same 7 rows three times.
  const foundationCapabilities = useMemo(
    () => TIERS.boutique.capabilities.map((k) => CAPABILITIES[k]),
    [],
  );

  const handleChooseTier = (tier: TierKey) => {
    setSelectedTier(tier);
    requestAnimationFrame(() => {
      document
        .getElementById("self-serve-checkout")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const pricingJsonLd = useMemo(() => {
    return {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Ashford Creative — boutique websites for therapists",
      provider: {
        "@type": "Organization",
        name: "Ashford Creative",
        url: "https://ashfordcreative.org",
      },
      areaServed: { "@type": "AdministrativeArea", name: "Texas" },
      offers: tiers.map((tier) => ({
        "@type": "Offer",
        name: tier.label,
        price: (tier.monthlyCents / 100).toFixed(0),
        priceCurrency: "USD",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          priceCurrency: "USD",
          price: (tier.monthlyCents / 100).toFixed(0),
          billingDuration: "P1M",
          unitText: "MONTH",
        },
        availability: "https://schema.org/InStock",
        url: "https://ashfordcreative.org/pricing",
      })),
    };
  }, [tiers]);

  return (
    <>
      <Seo
        title={t("pricing_page_title")}
        description={t("pricing_page_sub")}
        path="/pricing"
        jsonLd={pricingJsonLd}
      />

      <section className="bg-ink text-cream py-24 px-6 lg:px-12">
        <div className="max-w-5xl mx-auto">
          <h1 className="font-display text-[44px] md:text-[64px] leading-tight mb-6 text-balance">
            {t("pricing_v2_hero_title")}
          </h1>
          <p className="font-serif text-[20px] md:text-[24px] leading-[1.55] text-cream/80 max-w-3xl text-pretty">
            {t("pricing_v2_hero_sub")}
          </p>
          <p className="mt-4 font-mono text-[11px] text-cream/50 leading-snug">
            {t("pricing_tax_note")}
          </p>
        </div>
      </section>

      {/* TIER COMPARISON — 3 cards side-by-side. Pro carries the "Recommended"
          eyebrow. Each card lists the tier's capability labels (full names
          from CAPABILITIES) so the prospect can read the upgrade story
          without scrolling. The descriptions live in the "every tier"
          section below to keep cards scannable. */}
      <section className="py-20 px-6 lg:px-12 bg-cream">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6 items-stretch">
          {tiers.map((tier) => (
            <TierCard
              key={tier.key}
              tier={tier}
              isSelected={selectedTier === tier.key}
              onChoose={() => handleChooseTier(tier.key)}
            />
          ))}
        </div>
      </section>

      {/* WCAG 2.1 AA guarantee — quietly between the tier cards and
       *  the included-in-every-tier band. Frames "we ship accessible"
       *  as a real promise with a dollar number, not a tech buzzword. */}
      <section className="py-12 px-6 lg:px-12 bg-cream">
        <div className="max-w-5xl mx-auto">
          <WcagGuaranteeBadge />
        </div>
      </section>

      {/* WHAT'S INCLUDED IN EVERY TIER — the 7 foundation capabilities,
          rendered once with their long-form labels + descriptions so the
          tier cards above can stay terse. */}
      <section className="py-20 px-6 lg:px-12 bg-cream-warm border-y border-ink/10">
        <div className="max-w-5xl mx-auto">
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-sage mb-3">
            {tx("In every tier", "En todos los niveles")}
          </div>
          <h2 className="font-display text-3xl md:text-4xl text-ink mb-3">
            {t("pricing_v2_foundation_title")}
          </h2>
          <p className="font-serif text-[18px] text-ink/75 leading-[1.55] max-w-3xl mb-10">
            {t("pricing_v2_foundation_sub")}
          </p>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
            {foundationCapabilities.map((cap) => (
              <FoundationRow key={cap.key} cap={cap} />
            ))}
          </div>
        </div>
      </section>

      {/* BATCH 3.2 Phase 5 — honest competitor comparison table. Sits between
          the foundation section and the self-serve checkout so a prospect can
          read three-tier vs three-competitor before reserving. */}
      <CompetitorTable />

      <SelfServeCheckout
        selectedTier={selectedTier}
        setSelectedTier={setSelectedTier}
      />

      {/* LOT 3.13 — Concierge ghostwriter callout. */}
      <section className="py-16 px-6 lg:px-12 bg-ink text-cream">
        <div className="max-w-3xl mx-auto text-center">
          <div className="font-mono text-[11px] uppercase tracking-widest text-gold mb-3">
            {t("pricing_concierge_journal_eyebrow")}
          </div>
          <h2 className="font-display text-3xl md:text-4xl mb-4">
            {t("pricing_concierge_journal_title")}
          </h2>
          <p className="font-serif text-[19px] leading-[1.55] opacity-90">
            {t("pricing_concierge_journal_body")}
          </p>
        </div>
      </section>

      <section className="py-20 px-6 lg:px-12 bg-cream">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl text-ink mb-4">
            {t("pricing_modify_title")}
          </h2>
          <p className="font-serif text-[19px] text-ink/80 leading-[1.55]">
            {t("pricing_modify_body")}
          </p>
        </div>
      </section>

      <PageCTA />
    </>
  );
}

// ---------------------------------------------------------------------------
// Tier card
// ---------------------------------------------------------------------------

function TierCard({
  tier,
  isSelected,
  onChoose,
}: {
  tier: TierDef;
  isSelected: boolean;
  onChoose: () => void;
}) {
  const { t, locale } = useI18n();
  const tx = (en: string, es: string) => (locale === "es" ? es : en);

  const label = t(TIER_LABEL_KEY[tier.key]);
  const tagline = t(TIER_TAGLINE_KEY[tier.key]);
  const cta = isSelected ? tx("Selected · scroll to reserve", "Seleccionado · desplázate para reservar") : t(TIER_CTA_KEY[tier.key]);

  // Show only capabilities that are NEW relative to the previous tier so the
  // upgrade story reads top-down without a "you already saw this" feel. For
  // Boutique we render all 7; for Pro / Concierge we render the delta against
  // the tier below.
  const previousTierKey: TierKey | null =
    tier.key === "boutique_pro"
      ? "boutique"
      : tier.key === "boutique_concierge"
        ? "boutique_pro"
        : null;
  const deltaCapabilities = useMemo(() => {
    if (!previousTierKey) return tier.capabilities;
    const prev = new Set(TIERS[previousTierKey].capabilities);
    return tier.capabilities.filter((k) => !prev.has(k));
  }, [tier, previousTierKey]);

  const everythingInPrevLabel =
    tier.key !== "boutique" ? t(TIER_EVERYTHING_IN_PREV_KEY[tier.key]) : null;

  return (
    <div
      className={
        "relative rounded-sm border p-8 flex flex-col " +
        (tier.recommended
          ? "bg-sage-light text-cream border-gold shadow-md"
          : isSelected
            ? "bg-paper text-ink border-ink/40"
            : "bg-paper text-ink border-ink/15")
      }
    >
      {tier.recommended && (
        <div className="absolute -top-3 left-6 bg-gold text-ink px-3 py-1 text-[10px] font-mono uppercase tracking-widest flex items-center gap-1">
          <Star className="w-3 h-3" />
          {t("pricing_recommended")}
        </div>
      )}
      {isSelected && (
        <div className="absolute -top-3 right-6 bg-ink text-cream px-3 py-1 text-[10px] font-mono uppercase tracking-widest flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          {tx("Selected", "Seleccionado")}
        </div>
      )}
      <div className="font-mono text-[10px] tracking-widest uppercase opacity-70 mb-2">
        {label}
      </div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="font-display text-5xl">{fmt(tier.monthlyCents)}</span>
        <span className="opacity-70">{t("pricing_monthly")}</span>
      </div>
      <div className="font-mono text-[10px] uppercase tracking-widest opacity-70 mb-5">
        {tier.setupCents > 0
          ? `${fmt(tier.setupCents)} ${tx("setup", "configuración")}`
          : t("tier_setup_free")}
      </div>
      <p className="font-serif text-[15px] opacity-85 mb-3 leading-relaxed">
        {tagline}
      </p>
      {tier.key === "boutique_pro" && (
        /* PHASE A.5 — Pro booking note (Calendly embed). */
        <p className="font-serif text-[13px] opacity-75 mb-6 leading-relaxed italic">
          {t("tier_boutique_pro_booking_note")}
        </p>
      )}
      {tier.key === "boutique_concierge" && (
        /* PHASE A.6 — Concierge telehealth + Insights Journal notes.
           Strictly human-ghostwriter framing — no AI words. */
        <div className="mb-6 space-y-1.5">
          <p className="font-serif text-[13px] opacity-75 leading-relaxed italic">
            {t("tier_boutique_concierge_telehealth_note")}
          </p>
          <p className="font-serif text-[13px] opacity-75 leading-relaxed italic">
            {t("tier_boutique_concierge_journal_note")}
          </p>
          {/* PHASE A.7 — optional 20-min Doxy setup-help call. */}
          <p className="font-serif text-[12px] opacity-65 leading-relaxed">
            {t("tier_boutique_concierge_doxy_help_note")}
          </p>
        </div>
      )}

      {/* #221 — tax-deductible perk bullet, rendered on every tier card. */}
      <div className="mb-5 flex gap-2 items-start rounded-sm border-l-2 border-gold bg-gold/10 px-3 py-2">
        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-gold" />
        <div className="min-w-0">
          <div className="font-medium leading-snug text-[13px]">
            {t("tier_tax_deductible_bullet")}
          </div>
          <div className="text-[11px] opacity-70 leading-snug mt-0.5">
            {t("tier_tax_deductible_sub")}
          </div>
        </div>
      </div>

      {everythingInPrevLabel && (
        <div className="font-mono text-[10px] uppercase tracking-widest opacity-80 mb-3 pt-3 border-t border-current/15">
          {everythingInPrevLabel}
        </div>
      )}

      <ul className="space-y-3 text-sm mb-8 flex-1">
        {deltaCapabilities.map((capKey) => {
          const cap = CAPABILITIES[capKey];
          return (
            <li key={capKey} className="flex gap-2 items-start">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 opacity-80" />
              <div className="min-w-0">
                <div className="font-medium leading-snug">{cap.label}</div>
                <div className="text-[12px] opacity-70 leading-snug mt-0.5">
                  {cap.description}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onChoose}
        className={
          "w-full mt-auto py-3 px-4 rounded-sm font-mono text-[12px] uppercase tracking-widest transition-colors " +
          (tier.recommended
            ? "bg-gold text-ink hover:bg-gold/90"
            : "bg-ink text-cream hover:bg-ink/85")
        }
      >
        {cta}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Foundation row — one capability with its label + description, for the
// "in every tier" section below the cards.
// ---------------------------------------------------------------------------

function FoundationRow({ cap }: { cap: CapabilityFeature }) {
  return (
    <div className="flex gap-3 items-start">
      <CheckCircle2 className="w-4 h-4 mt-1 text-sage shrink-0" />
      <div>
        <div className="text-ink font-medium text-[15px]">{cap.label}</div>
        <div className="text-ink/65 text-[13px] leading-relaxed">
          {cap.description}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Self-serve checkout — tier picker + email + Reserve.
// ---------------------------------------------------------------------------

function SelfServeCheckout({
  selectedTier,
  setSelectedTier,
}: {
  selectedTier: TierKey;
  setSelectedTier: (k: TierKey) => void;
}) {
  const { t, locale } = useI18n();
  const tx = (en: string, es: string) => (locale === "es" ? es : en);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tier = TIERS[selectedTier];

  const onStart = async () => {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/checkout/self-serve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          tierKey: selectedTier,
          customerEmail: email.trim() || undefined,
          locale,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { url?: string };
      if (!data.url) throw new Error("no url");
      window.location.href = assertSafeRedirectUrl(data.url);
    } catch {
      setErr(t("pricing_checkout_failed"));
      setBusy(false);
    }
  };

  return (
    <section
      id="self-serve-checkout"
      className="py-20 px-6 lg:px-12 bg-ink text-cream"
    >
      <div className="max-w-3xl mx-auto">
        <h2 className="font-display text-3xl md:text-4xl mb-6 text-balance">
          {t("pricing_v2_checkout_title")}
        </h2>
        <p className="font-serif text-[18px] text-cream/80 mb-8 leading-relaxed">
          {t("pricing_v2_checkout_sub")}
        </p>

        <div className="space-y-6">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-cream/65 mb-3">
              {tx("Tier", "Nivel")}
            </label>
            <div className="grid sm:grid-cols-3 gap-3">
              {TIER_DISPLAY_ORDER.map((k) => {
                const isActive = selectedTier === k;
                const tk = TIERS[k];
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSelectedTier(k)}
                    className={
                      "p-4 rounded-sm border text-left transition-colors " +
                      (isActive
                        ? "border-gold bg-gold/10"
                        : "border-cream/20 hover:border-cream/40")
                    }
                    aria-pressed={isActive}
                  >
                    <div className="font-mono text-[10px] uppercase tracking-widest text-cream/70 mb-1">
                      {t(TIER_LABEL_KEY[k])}
                    </div>
                    <div className="font-display text-2xl">
                      {fmt(tk.monthlyCents)}
                      <span className="text-sm text-cream/65">
                        {t("pricing_monthly")}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="self-serve-email"
              className="block font-mono text-[10px] uppercase tracking-widest text-cream/65 mb-2"
            >
              {tx("Your email", "Tu correo")}
            </label>
            <input
              id="self-serve-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourpractice.com"
              className="w-full px-4 py-3 rounded-sm bg-cream text-ink border border-cream/30 focus:outline-none focus:border-gold"
            />
          </div>

          {/* #221 — deductibility cue right next to the price commitment. */}
          <div className="flex gap-2 items-start rounded-sm border-l-2 border-gold bg-gold/10 px-3 py-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-gold" />
            <div className="min-w-0">
              <div className="font-medium leading-snug text-[13px] text-cream">
                {t("tier_tax_deductible_bullet")}
              </div>
              <div className="text-[11px] text-cream/70 leading-snug mt-0.5">
                {t("tier_tax_deductible_sub")}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2">
            <button
              type="button"
              onClick={onStart}
              disabled={busy || !email.trim()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gold text-ink font-mono text-[12px] uppercase tracking-widest hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-sm"
            >
              {busy
                ? t("pricing_v2_checkout_busy")
                : `${t("pricing_v2_reserve")} · ${fmt(tier.monthlyCents)}${t("pricing_monthly")}`}
              <ArrowRight className="w-4 h-4" />
            </button>
            {err && (
              <span className="text-[13px] text-gold-light">{err}</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
