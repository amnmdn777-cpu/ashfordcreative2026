import { useEffect, useRef, useState } from "react";
import { X, Lock, Loader2, CheckCircle2 } from "lucide-react";
// Use the side-effect-free `/pure` entry so importing this module does NOT
// auto-inject `https://js.stripe.com/v3/` (and the m.stripe.network
// fingerprinting iframe) on every visit. The public template route at
// `/template/:key` imports this file but never calls `loadStripe()` (the
// self-serve flow redirects to Stripe Checkout — Stripe.js is only needed
// for the inline portal `<PaymentElement>`). The auto-inject side-effect
// was producing browser-console "Refused to apply inline style…
// Content Security Policy directive: style-src" warnings from inside
// Stripe's own injected iframes during e2e runs (#199). Types are
// re-imported with `import type` from the main entry so they're erased
// at build time and don't re-introduce the side-effect.
import { loadStripe } from "@stripe/stripe-js/pure";
import type { Stripe, StripeElements } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
// DomainPicker import removed 2026-04-28 (#185 Comms & Copy Hardening) —
// the self-serve reserve form no longer prompts the visitor to pick a
// domain inline. Domain selection is handled by the rep during onboarding;
// `chosenDomain` is still threaded through from the URL/portal so a
// rep-set value carries forward into Stripe metadata.
import type {
  PortalCustomizations,
  PortalPublicResponse,
  PortalReserveResponse,
  TierKey,
} from "@workspace/api-zod";
import { portalApi } from "./api";
import { useI18n } from "@site/lib/i18n";
import { api as siteApi, assertSafeRedirectUrl } from "@site/lib/api";
import { trackFunnel, getFunnelSessionId } from "@site/lib/funnel";

const fmtUsd = (cents: number) => `$${(cents / 100).toFixed(0)}`;

/**
 * Slug-portal reserve flow (the original variant). Drives the Stripe
 * Payment Element inline so the visitor never leaves the personalized
 * portal — used during a rep co-browse.
 */
type PortalProps = {
  mode?: "portal";
  portal: PortalPublicResponse;
  templateKey: string;
  /**
   * Tier the prospect is reserving. Forwarded to /api/public/portals/:slug/reserve
   * so the api-server creates the Stripe Subscription at the matching per-tier
   * Price. Optional — defaults to `boutique` server-side for legacy callers.
   */
  tierKey?: TierKey;
  selectedAddons: string[];
  monthlyTotalCents: number;
  setupTotalCents: number;
  /**
   * Domain the prospect picked from the live picker (if any). Surfaces as a
   * "FREE" line in the order summary and is forwarded to the reserve API so
   * Stripe metadata + webhook handler get it without a second round trip.
   */
  chosenDomain?: string | null;
  onClose: () => void;
};

/**
 * Anonymous self-serve reserve flow used by the public template showcase
 * (`/template/:key`). The visitor has no portal slug, so we collect their
 * own email/practice name/phone here and create a Stripe Checkout session
 * via `/api/public/self-serve-reserve` — Stripe's hosted page handles
 * payment-method capture, ToS, and tax. We redirect on success.
 */
type SelfServeProps = {
  mode: "self_serve";
  templateKey: string;
  paletteKey?: string | null;
  /**
   * Tier the prospect is reserving (1B-b). Carried through the public
   * self-serve checkout body so the api-server books the correct tier.
   */
  tierKey?: TierKey;
  selectedAddons: string[];
  monthlyTotalCents: number;
  setupTotalCents: number;
  chosenDomain?: string | null;
  /** Initial values pre-filled into the form (optional). */
  defaults?: {
    email?: string;
    practiceName?: string;
    phone?: string;
  };
  /** Color overrides + font choices captured by CustomizePanel so the post-payment fulfillment can re-skin the launch site. */
  customizations?: PortalCustomizations;
  /** Locale propagated to Stripe Checkout UI. */
  locale?: "en" | "es";
  onClose: () => void;
};

type Props = PortalProps | SelfServeProps;

const stripeCache = new Map<string, Promise<Stripe | null>>();
const getStripe = (publishableKey: string): Promise<Stripe | null> => {
  let cached = stripeCache.get(publishableKey);
  if (!cached) {
    cached = loadStripe(publishableKey);
    stripeCache.set(publishableKey, cached);
  }
  return cached;
};

export const ReserveModal = (props: Props) => {
  if (props.mode === "self_serve") {
    return <SelfServeReserveModal {...props} />;
  }
  return <PortalReserveModal {...(props as PortalProps)} />;
};

/**
 * Wire Esc-to-close + scroll-lock for a modal. Mirrors the
 * AddonPreviewDrawer pattern but inline since both reserve modals
 * already have well-controlled `onClose` props. Without this, the
 * dialogs were trapping keyboard users (no Esc, no focus trap, body
 * scroll bleed). Apply by calling at the top of each modal body.
 */
const useEscClose = (onClose: () => void) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);
};

const PortalReserveModal = ({
  portal,
  templateKey,
  tierKey,
  selectedAddons,
  monthlyTotalCents: _monthlyTotalCents,
  setupTotalCents,
  chosenDomain,
  onClose,
}: PortalProps) => {
  const { t } = useI18n();
  useEscClose(onClose);
  const [email, setEmail] = useState(portal.email ?? "");
  const [name, setName] = useState(portal.name);
  const [reserveResp, setReserveResp] = useState<PortalReserveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const onStartReserve = async () => {
    if (!email.trim()) {
      setError(t("reserve_email_required"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await portalApi.reserve(portal.slug, {
        templateKey,
        tierKey: tierKey ?? "boutique",
        addonSlugs: selectedAddons,
        customerEmail: email.trim(),
        customerName: name.trim(),
        chosenDomain: chosenDomain?.trim() || undefined,
      });
      setReserveResp(resp);
      if (resp.mode === "fallback") {
        setError(t("reserve_payment_unavailable_short"));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Palette is provided by the wrapping prospect-portal page through
  // the `--p-primary` CSS variable. The `pal-bg-pp` utility class
  // (src/styles/palette.css) reads that var so we don't need a
  // per-element inline `style={{ background: ... }}` — task #201.

  const addonsLabel =
    selectedAddons.length === 1
      ? t("reserve_addons_waitlist_one")
      : t("reserve_addons_waitlist_other", { n: selectedAddons.length });

  const setupClause = setupTotalCents > 0 ? t("reserve_billing_explainer_setup") : "";
  const billingExplainer = t("reserve_billing_explainer", { setupClause });
  const setupSuffix = setupTotalCents > 0
    ? t("reserve_setup_suffix", { amount: fmtUsd(setupTotalCents) })
    : "";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
      // Backdrop is purely visual; the dialog role + Esc handler live
      // on the inner panel so screen readers announce the dialog
      // properly and keyboard users always have a way out.
      aria-hidden="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("reserve_eyebrow")}
        className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pal-bg-pp px-6 py-4 text-white flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest opacity-70">{t("reserve_eyebrow")}</div>
            <div className="font-medium mt-0.5">{portal.practice}</div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("reserve_close")}
            autoFocus
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
            <div className="text-lg font-medium">{t("reserve_done_title")}</div>
            <p className="text-sm text-stone-600">{t("reserve_done_body")}</p>
            <button
              onClick={onClose}
              className="pal-bg-pp rounded-lg px-4 py-2 text-white text-sm"
            >
              {t("reserve_back_button")}
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <div className="rounded-xl bg-stone-50 border p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-600">{t("reserve_base_website")}</span>
                <span className="font-medium">{fmtUsd(19900)}{t("portal_per_month")}</span>
              </div>
              {chosenDomain && (
                <div className="flex justify-between text-stone-600">
                  <span className="font-mono text-xs">{chosenDomain}</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-xs">
                    {t("domain_free_badge")}
                  </span>
                </div>
              )}
              {selectedAddons.length > 0 && (
                <div className="flex justify-between text-stone-500">
                  <span>{addonsLabel}</span>
                  <span>{t("reserve_billed_when_launched")}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t">
                <span>{t("reserve_charged_today")}</span>
                <span className="font-medium">
                  {fmtUsd(19900)}{t("portal_per_month")}{setupSuffix}
                </span>
              </div>
              <div className="text-[11px] text-stone-500">{billingExplainer}</div>
            </div>

            {!reserveResp && (
              <>
                <div className="space-y-2">
                  <label className="block text-xs uppercase tracking-widest text-stone-500">{t("reserve_name_label")}</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs uppercase tracking-widest text-stone-500">{t("reserve_email_label")}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder={t("reserve_email_placeholder")}
                  />
                </div>
                {error && <div className="text-xs text-rose-600">{error}</div>}
                <button
                  onClick={onStartReserve}
                  disabled={loading}
                  className="pal-bg-pp w-full rounded-lg py-3 text-white font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t("reserve_continue")}
                </button>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-stone-500">
                  <Lock className="w-3 h-3" /> {t("reserve_secured")}
                </div>
              </>
            )}

            {reserveResp?.mode === "payment_intent" && reserveResp.clientSecret && (
              <PaymentForm
                clientSecret={reserveResp.clientSecret}
                publishableKey={reserveResp.publishableKey ?? null}
                onSuccess={() => setDone(true)}
              />
            )}

            {reserveResp?.mode === "fallback" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm space-y-3">
                <div className="font-medium text-amber-900">
                  {t("reserve_payment_unavailable")}
                </div>
                <p className="text-amber-800">{t("reserve_fallback_body")}</p>
                <button
                  onClick={onClose}
                  className="pal-bg-pp rounded-lg px-4 py-2 text-white text-sm"
                >
                  {t("reserve_back_button")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────── Self-serve template reserve ─────────────────────── */

const SelfServeReserveModal = ({
  templateKey,
  paletteKey,
  tierKey,
  selectedAddons,
  monthlyTotalCents,
  setupTotalCents,
  chosenDomain,
  defaults,
  customizations,
  locale,
  onClose,
}: SelfServeProps) => {
  const { t, locale: i18nLocale } = useI18n();
  useEscClose(onClose);
  const [email, setEmail] = useState(defaults?.email ?? "");
  const [practiceName, setPracticeName] = useState(defaults?.practiceName ?? "");
  const [phone, setPhone] = useState(defaults?.phone ?? "");
  const [domain, setDomain] = useState(chosenDomain ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Honeypot — bots that auto-fill every input trip this; real visitors
  // never see it (display:none) so it stays empty. Implemented as an
  // uncontrolled DOM input read via ref at submit time. A controlled
  // useState honeypot was the wrong shape: browser autofill / scripted
  // bots that set `input.value` directly don't dispatch a React change
  // event, so the React state stayed `""` while the DOM input actually
  // carried the bot fill — defeating the trap. The ref reads what's
  // really in the DOM at submit time.
  const honeypotRef = useRef<HTMLInputElement>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError(t("reserve_email_required"));
      return;
    }
    if (!practiceName.trim()) {
      setError(t("reserve_practice_required"));
      return;
    }
    setLoading(true);
    setError(null);
    const funnelSessionId = getFunnelSessionId() || undefined;
    void trackFunnel("reserve_submit", {
      slug: templateKey,
      payload: {
        // Tier the visitor picked in the floating demo bar (1B-b). The
        // selfServeTemplateReserve endpoint itself is still on the legacy
        // plan-A + addonSlugs shape (cleaned up in Phase 1B-c when the
        // shim dies), so tierKey rides on the analytics event only for now.
        tierKey: tierKey ?? "boutique",
        addons: selectedAddons,
        hasDomain: Boolean(domain.trim()),
      },
    });
    try {
      const resp = await siteApi.selfServeTemplateReserve({
        templateKey,
        paletteKey: paletteKey ?? undefined,
        addonSlugs: selectedAddons,
        customizations: customizations
          ? {
              primary: customizations.colorOverrides?.primary,
              accent: customizations.colorOverrides?.accent,
              fontDisplay: customizations.fontDisplay ?? undefined,
              fontBody: customizations.fontBody ?? undefined,
            }
          : undefined,
        contact: {
          email: email.trim(),
          practiceName: practiceName.trim(),
          phone: phone.trim() || undefined,
          chosenDomain: domain.trim() || undefined,
        },
        _hp: honeypotRef.current?.value ?? "",
        locale: locale ?? i18nLocale,
        funnelSessionId,
      });
      if (resp.url) {
        // Synchronous beacon so the event lands before the navigation tears
        // down the page. trackFunnel uses sendBeacon under the hood.
        void trackFunnel("checkout_start", {
          slug: templateKey,
          payload: { addons: selectedAddons },
        });
        // Open-redirect guard: only navigate to Stripe Checkout or our
        // own origin. A misrouted backend (or compromised response)
        // would otherwise turn this submit into a phishing handoff.
        window.location.assign(assertSafeRedirectUrl(resp.url));
        return;
      }
      setError(t("reserve_payment_unavailable_short"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Palette is provided by the wrapping prospect-portal page through
  // the `--p-primary` CSS variable. The `pal-bg-pp` utility class
  // (src/styles/palette.css) reads that var so we don't need a
  // per-element inline `style={{ background: ... }}` — task #201.
  const setupSuffix =
    setupTotalCents > 0
      ? t("reserve_setup_suffix", { amount: fmtUsd(setupTotalCents) })
      : "";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pal-bg-pp px-6 py-4 text-white flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest opacity-70">
              {t("reserve_eyebrow")}
            </div>
            <div className="font-medium mt-0.5">
              {practiceName.trim() || t("self_serve_reserve_default_title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("reserve_close")}
            autoFocus
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-5">
          <div className="rounded-xl bg-stone-50 border p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-600">{t("reserve_base_website")}</span>
              <span className="font-medium">
                {fmtUsd(19900)}
                {t("portal_per_month")}
              </span>
            </div>
            {selectedAddons.length > 0 && (
              <div className="flex justify-between text-stone-600">
                <span>
                  {selectedAddons.length === 1
                    ? t("reserve_addons_waitlist_one")
                    : t("reserve_addons_waitlist_other", {
                        n: selectedAddons.length,
                      })}
                </span>
                <span className="font-medium">
                  +{fmtUsd(monthlyTotalCents - 19900)}
                  {t("portal_per_month")}
                </span>
              </div>
            )}
            {domain.trim() && (
              <div className="flex justify-between text-stone-600">
                <span className="font-mono text-xs break-all max-w-[60%]">
                  {domain.trim()}
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-xs">
                  {t("domain_free_badge")}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t">
              <span>{t("reserve_charged_today")}</span>
              <span className="font-medium">
                {fmtUsd(monthlyTotalCents)}
                {t("portal_per_month")}
                {setupSuffix}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs uppercase tracking-widest text-stone-500">
              {t("reserve_email_label")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder={t("reserve_email_placeholder")}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs uppercase tracking-widest text-stone-500">
              {t("reserve_practice_label")}
            </label>
            <input
              type="text"
              value={practiceName}
              onChange={(e) => setPracticeName(e.target.value)}
              required
              maxLength={192}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder={t("reserve_practice_placeholder")}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs uppercase tracking-widest text-stone-500">
              {t("reserve_phone_label_optional")}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={32}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="+1 555 123 4567"
            />
          </div>

          {/* Inline domain picker removed on 2026-04-28 (#185). Visitors
              who click Reserve from the public template route no longer
              see a free-domain UI — the rep proposes 1–2 names tied to
              their practice during onboarding. The `domain` state is
              still seeded from the URL (`?domain=…`) when a rep set a
              value beforehand, and is forwarded to Stripe metadata
              unchanged. */}

          {/* Hidden honeypot — must stay empty. Bots that auto-fill
              every form input trip this. Uncontrolled (read via ref at
              submit time) so an injected `input.value = "spam"` from
              a bot script is actually captured — controlled state only
              updates when the bot dispatches a React-friendly event. */}
          <input
            type="text"
            name="company_extension"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="pal-honeypot"
            ref={honeypotRef}
            defaultValue=""
          />

          {error && <div className="text-xs text-rose-600">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="pal-bg-pp w-full rounded-lg py-3 text-white font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("reserve_continue")}
          </button>
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-stone-500">
            <Lock className="w-3 h-3" /> {t("reserve_secured")}
          </div>
        </form>
      </div>
    </div>
  );
};

const PaymentForm = ({
  clientSecret,
  publishableKey,
  onSuccess,
}: {
  clientSecret: string;
  publishableKey: string | null;
  onSuccess: () => void;
}) => {
  const { t } = useI18n();
  const [stripe, setStripe] = useState<Stripe | null>(null);
  useEffect(() => {
    if (!publishableKey) return;
    void getStripe(publishableKey).then(setStripe);
  }, [publishableKey]);
  if (!publishableKey) {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
        {t("reserve_payment_not_configured")}
      </div>
    );
  }
  if (!stripe) {
    return (
      <div className="flex items-center justify-center py-6 text-stone-500">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  return (
    <Elements stripe={stripe} options={{ clientSecret, appearance: { theme: "stripe" } }}>
      <PaymentInner onSuccess={onSuccess} />
    </Elements>
  );
};

const PaymentInner = ({ onSuccess }: { onSuccess: () => void }) => {
  const { t } = useI18n();
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setErr(null);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements: elements as StripeElements,
      redirect: "if_required",
    });
    setLoading(false);
    if (error) {
      setErr(error.message ?? t("reserve_payment_failed"));
      return;
    }
    if (paymentIntent && paymentIntent.status === "succeeded") {
      onSuccess();
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {err && <div className="text-xs text-rose-600">{err}</div>}
      <button
        type="submit"
        disabled={!stripe || loading}
        className="pal-bg-pp w-full rounded-lg py-3 text-white font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {t("reserve_pay_button")}
      </button>
    </form>
  );
};

/* DomainPickerInModal was removed on 2026-04-28 alongside the inline
   "pick a free domain" prompt above. Domain selection is now a
   sales-only flow — see `ashford-rep/src/pages/LeadDetail.tsx` for the
   rep-side picker that persists the choice onto the lead row. */
