import { useQuery } from "@tanstack/react-query";
import type {
  BlogPostSummary,
  BlogPostFull,
  BlogCommentDto,
  CreateCommentRequest,
  CreateContactRequestPayload,
  PreviewLeadInfo,
  PreviewEventRequest,
  PreviewResponse,
  TemplateKey,
  SelfServeTemplateReserveRequest,
  SelfServeTemplateReserveResponse,
} from "@workspace/api-zod";

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ||
  "/api";

/** Default request timeout. Long enough for a heavy preview-content
 * build (~12s p95) but short enough that a wedged backend doesn't pin
 * the prospect on a "Loading…" spinner forever. */
const DEFAULT_TIMEOUT_MS = 15_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Compose a per-call AbortSignal that times out at 15s and ALSO
  // honors any signal the caller already passed (e.g. react-query
  // cancellation, preview unmount). `AbortSignal.any` is in all
  // browsers we ship to (>= Safari 17.4 / Chrome 124 / Firefox 124);
  // fall back to the timeout-only signal where unsupported so dev/
  // preview environments don't crash on import.
  const timeoutSignal = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
  const composed =
    init?.signal && typeof (AbortSignal as unknown as { any?: unknown }).any === "function"
      ? (AbortSignal as unknown as {
          any: (s: AbortSignal[]) => AbortSignal;
        }).any([init.signal, timeoutSignal])
      : (init?.signal ?? timeoutSignal);
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    credentials: "same-origin",
    signal: composed,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      // Surface Zod field-level errors when present (e.g. the SMS
      // consent rule on /api/contact-requests returns
      // details.fieldErrors.smsConsent: [...]) so callers can show a
      // specific message instead of a generic "Bad Request".
      const fieldErrors = j?.details?.fieldErrors as
        | Record<string, string[] | undefined>
        | undefined;
      if (fieldErrors) {
        const flat = Object.entries(fieldErrors)
          .flatMap(([k, errs]) =>
            (errs ?? []).map((e) => `${k}: ${e}`),
          )
          .join("; ");
        if (flat) msg = flat;
      } else {
        msg = j?.message || j?.error || msg;
      }
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface ContactRequestSubmitResponse {
  ok: boolean;
  id: number;
  message: string;
}

export const api = {
  listBlogPosts: () =>
    request<{ posts: (BlogPostSummary & { likeCount: number })[] }>(
      "/blog/posts",
    ),
  getBlogPost: (slug: string) =>
    request<{
      post: BlogPostFull;
      likes: number;
      comments: BlogCommentDto[];
    }>(`/blog/posts/${encodeURIComponent(slug)}`),
  postBlogComment: (slug: string, body: CreateCommentRequest) =>
    request<{ comment: BlogCommentDto }>(
      `/blog/posts/${encodeURIComponent(slug)}/comments`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  likeBlogPost: (slug: string) =>
    request<{ likes: number }>(
      `/blog/posts/${encodeURIComponent(slug)}/like`,
      { method: "POST" },
    ),
  createContactRequest: (body: CreateContactRequestPayload) =>
    request<ContactRequestSubmitResponse>(`/contact-requests`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getPreview: (token: string) =>
    request<PreviewResponse>(`/preview/${encodeURIComponent(token)}`),
  postPreviewEvent: (token: string, body: PreviewEventRequest) =>
    request<{ ok: true }>(`/preview/${encodeURIComponent(token)}/event`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  startPreviewCheckout: (token: string, templateKey: TemplateKey) =>
    request<{ url: string | null; mode: "stripe" | "fallback" }>(
      `/preview/${encodeURIComponent(token)}/checkout`,
      { method: "POST", body: JSON.stringify({ templateKey }) },
    ),
  getPodcastEpisodes: (feedUrl: string) =>
    request<{
      title: string;
      episodes: { title: string; date: string | null; duration: string | null; link: string | null }[];
    }>(`/podcast/episodes?url=${encodeURIComponent(feedUrl)}`),
  /**
   * Public voice number + support email — surfaced in the marketing
   * footer and the prospect-portal help panel so we never hard-code the
   * shared Austin line in copy. Returns nullable values so the UI can
   * hide the row when the operator hasn't configured it yet.
   */
  getContactInfo: () =>
    request<{
      voiceNumber: string | null;
      smsNumber: string | null;
      supportEmail: string | null;
    }>("/contact-info"),
  /**
   * Anonymous self-serve reserve from the public template showcase.
   * The visitor lands straight in Stripe Checkout — no portal slug.
   */
  selfServeTemplateReserve: (body: SelfServeTemplateReserveRequest) =>
    request<SelfServeTemplateReserveResponse>(`/public/self-serve-reserve`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

/**
 * Format an E.164-ish phone number into a human-friendly US display
 * (e.g. "(512) 555-0100"). Falls back to the raw value when the digits
 * don't look like a domestic number.
 */
export function formatPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw.trim();
}

/** Local fingerprint used only to deduplicate likes client-side. */
export function getOrCreateFingerprint(): string {
  const KEY = "ashford_fp";
  let fp = localStorage.getItem(KEY);
  if (!fp) {
    fp =
      Math.random().toString(36).slice(2) +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2);
    localStorage.setItem(KEY, fp);
  }
  return fp;
}

/**
 * Shared `useQuery` hook for the `/contact-info` endpoint. Footer,
 * Contact page, and the prospect-portal HelpPanel each used to call
 * react-query with the same `queryKey: ["contact-info"]` + `staleTime:
 * 5 * 60_000` literal — three sources of truth for one query. This
 * hook keeps the cache key, fetch function, and stale-time in lock-
 * step so a tweak (e.g. shorter staleTime when ops rotates the line)
 * lands in one place.
 */
export const useContactInfo = () =>
  useQuery({
    queryKey: ["contact-info"] as const,
    queryFn: () => api.getContactInfo(),
    staleTime: 5 * 60_000,
  });

/**
 * Guard against open-redirect via the API's `data.url` response on a
 * Stripe checkout endpoint. We trust our own backend, but a misrouted
 * staging API or a compromised response would otherwise hand us any
 * URL to navigate to from a high-trust UI moment ("This is my
 * favorite →"). The allowlist covers Stripe's checkout hosts plus
 * our own marketing origin (for the optional fallback page).
 *
 * Returns the URL when safe, throws when not — caller is expected to
 * surface a friendly error rather than navigate. Centralizing this
 * lets every checkout call site (preview/portal/self-serve) share
 * one rule and one log message.
 */
export function assertSafeRedirectUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid redirect URL");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Refusing to redirect to non-https URL");
  }
  const host = parsed.hostname.toLowerCase();
  const allowed =
    host === "checkout.stripe.com" ||
    host === "billing.stripe.com" ||
    host.endsWith(".stripe.com") ||
    host === new URL(window.location.origin).hostname.toLowerCase();
  if (!allowed) {
    throw new Error(`Refusing to redirect to untrusted host: ${host}`);
  }
  return parsed.toString();
}

/** Resolve an image path under the artifact's base path. */
export function img(relativePath: string): string {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : import.meta.env.BASE_URL + "/";
  return base + relativePath.replace(/^\/+/, "");
}
