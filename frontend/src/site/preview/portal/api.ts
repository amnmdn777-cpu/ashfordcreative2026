import type {
  PortalPublicResponse,
  PortalCustomizations,
  PortalEventRequest,
  PortalReserveResponse,
} from "@workspace/api-zod";

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ||
  "/api";

/**
 * The access token gates every request to a portal — the slug is
 * human-readable and would otherwise be guessable. We capture it once
 * (either from `?t=...` on the invite landing or from the GET response)
 * and re-send it on every subsequent call via the `X-Portal-Token` header.
 */
let cachedToken: string | undefined;

// BATCH 1.2: when a rep opens a preview link off the rep dashboard, they
// land on the apex (ashfordcreative.org/preview/{slug}) where their
// ash_sess cookie isn't readable (cookie was set on the *.replit.app
// subdomain that runs the rep app). The rep app appends `?rep_token=<sess>`
// to outbound preview links; we capture it once and forward as
// `X-Rep-Auth` on every API call so requirePortalAccess can recognise
// the rep and bypass the lifecycle gate.
// TODO: drop once api + site + rep share a single cookie scope.
let cachedRepAuth: string | undefined;

export const portalAuth = {
  /** Read once on portal load (URL → cache). */
  prime: () => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const t = sp.get("t");
      if (t) cachedToken = t;
      const r = sp.get("rep_token");
      if (r) cachedRepAuth = r;
    } catch {
      // SSR / non-browser — ignore.
    }
  },
  set: (token: string) => {
    cachedToken = token;
  },
  get: () => cachedToken,
  clear: () => {
    cachedToken = undefined;
  },
};

/** 15s timeout — same shape as `lib/api.ts request()`, see comment there. */
const DEFAULT_TIMEOUT_MS = 15_000;

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) || {}),
  };
  if (cachedToken) headers["X-Portal-Token"] = cachedToken;
  if (cachedRepAuth) headers["X-Rep-Auth"] = cachedRepAuth;
  // Also include `?t=` on the very first GET so the server gets the token
  // even before the cache is set from the response.
  let url = `${API_BASE}${path}`;
  if (cachedToken && !path.includes("t=")) {
    url += (path.includes("?") ? "&" : "?") + "t=" + encodeURIComponent(cachedToken);
  }
  // Compose timeout signal with any caller-provided abort signal so a
  // wedged backend can't pin the portal on "Loading…" forever, while
  // still honoring component-unmount cancellation from callers.
  const timeoutSignal = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
  const composed =
    init?.signal && typeof (AbortSignal as unknown as { any?: unknown }).any === "function"
      ? (AbortSignal as unknown as {
          any: (s: AbortSignal[]) => AbortSignal;
        }).any([init.signal, timeoutSignal])
      : (init?.signal ?? timeoutSignal);
  const res = await fetch(url, { ...init, headers, signal: composed });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as {
        message?: string;
        error?: string | { message?: string; code?: string };
      };
      const errObj = typeof j?.error === "object" ? j.error : null;
      msg = errObj?.message || (typeof j?.error === "string" ? j.error : "") || j?.message || msg;
    } catch {
      // ignore — keep default message
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
};

const slugPath = (slug: string) => `/public/portals/${encodeURIComponent(slug)}`;

export const portalApi = {
  get: async (slug: string) => {
    const r = await request<PortalPublicResponse>(slugPath(slug));
    // Server echoes the token; from now on we use the cached value so the
    // SPA can drop `?t=` from the address bar without losing access.
    if (r?.accessToken) portalAuth.set(r.accessToken);
    return r;
  },
  patch: (
    slug: string,
    body: { selectedTemplate?: string; customizations?: PortalCustomizations },
  ) =>
    request<{ ok: true }>(`${slugPath(slug)}/customizations`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  event: (slug: string, body: PortalEventRequest) =>
    request<{ ok: true }>(`${slugPath(slug)}/events`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  cart: (slug: string, body: { templateKey: string; addonSlugs: string[] }) =>
    request<{ ok: true; monthlyTotalCents: number; setupTotalCents: number }>(
      `${slugPath(slug)}/cart`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  reserve: (
    slug: string,
    body: {
      templateKey: string;
      /**
       * Tier key (1B-b). Optional client-side because the server defaults
       * to "boutique" for legacy callers; new flows always send it.
       */
      tierKey?: "boutique" | "boutique_pro" | "boutique_concierge";
      addonSlugs: string[];
      customerEmail: string;
      customerName?: string;
      chosenDomain?: string;
    },
  ) =>
    request<PortalReserveResponse>(`${slugPath(slug)}/reserve`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  /**
   * 2026-05-21 — Post-launch self-serve change request (Sprint 2 streamline).
   * Lets the client ask the rep for a site change from inside the portal.
   * Auth piggybacks on the existing portal token; the rep sees the
   * request in her LeadDetail page (no email loop).
   */
  changeRequest: (slug: string, body: string) =>
    request<{ id: number; status: string; createdAt: string }>(
      `/public/portal/${encodeURIComponent(slug)}/change-request`,
      { method: "POST", body: JSON.stringify({ body }) },
    ),
};
