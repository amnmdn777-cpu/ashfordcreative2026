/**
 * Self-serve template funnel tracker — public-facing analytics for the
 * `/template/:key` flow. Per-tab sessionId persisted in sessionStorage so
 * the admin dashboard can stitch together each visitor's full journey
 * (template_view → palette_pick → addon_toggle → reserve_open →
 * reserve_submit → checkout_start) and the post-payment webhook can join
 * the funnel back to the resulting `leads` row.
 *
 * Best-effort: every call is fire-and-forget; an analytics failure must
 * never block the prospect's UI. We catch ALL errors silently.
 *
 * SSR-safe: every browser API access is gated on `typeof window`.
 */

const STORAGE_KEY = "ashfordFunnelSessionId";

const generateUuid = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older browsers — not RFC4122-compliant but unique enough
  // for funnel analytics. Only ever hit on legacy mobile webviews.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
};

/**
 * Returns the per-tab funnel session id, minting and persisting one on
 * first call. Returns an empty string in SSR / when sessionStorage is
 * blocked (private mode, cookie wall, etc.) — the server treats empty
 * `funnelSessionId` as "no analytics for this visitor".
 */
export const getFunnelSessionId = (): string => {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.sessionStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 8) return existing;
    const fresh = generateUuid();
    window.sessionStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    // sessionStorage may throw in privacy modes; degrade gracefully.
    return "";
  }
};

export type FunnelEventName =
  | "template_view"
  | "template_pick"
  | "palette_pick"
  | "addon_toggle"
  | "tier_pick"
  | "customize_open"
  | "domain_claim"
  | "reserve_open"
  | "reserve_submit"
  | "checkout_start";

/**
 * Fire a funnel event. Never throws, never awaits — analytics is a side
 * effect. Returns a promise only so callers in async contexts can `await
 * trackFunnel(...)` for ordering before navigating, but the resolved
 * value carries no information.
 */
export const trackFunnel = (
  event: FunnelEventName,
  opts?: { slug?: string; payload?: Record<string, unknown> },
): Promise<void> => {
  if (typeof window === "undefined") return Promise.resolve();
  const sessionId = getFunnelSessionId();
  if (!sessionId) return Promise.resolve();

  const body = JSON.stringify({
    sessionId,
    event,
    slug: opts?.slug,
    payload: opts?.payload,
  });

  // Prefer sendBeacon for reliability on page unload (e.g. firing
  // `checkout_start` right before navigating to Stripe). Falls back to
  // fetch with keepalive when the Beacon API is unavailable.
  const url = `${import.meta.env.BASE_URL}api/public/funnel-events`;
  try {
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return Promise.resolve();
    }
  } catch {
    // sendBeacon throws synchronously when the body is too large; fall
    // through to fetch. Funnel payloads are tiny so this should not happen.
  }

  return fetch(url, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  })
    .then(() => undefined)
    .catch(() => undefined);
};
