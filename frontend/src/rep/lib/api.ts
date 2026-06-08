import type {
  SessionUser,
  LoginRequest,
  LeadDto,
  LeadRepNoteDto,
  CallbackDto,
  ContactRequestDto,
  CustomDevQuoteDto,
  CreateCustomDevRequest,
  ScheduleCallbackRequest,
  SendSmsRequest,
  SendEmailRequest,
  DisqualifyReason,
  CustomDevFeatureKey,
} from "@workspace/api-zod";

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ||
  "/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    credentials: "same-origin",
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error?.message || j?.message || j?.error || msg;
    } catch {}
    throw new ApiError(msg, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// 2026-05-21 — Onboarding types removed (rep training gate killed, Sprint 2).

// Comp summary
export interface CompSummary {
  hourlyRateCents: number;
  closingsThisMonth: number;
  closingBonusThisMonthCents: number;
  firstMonthAddonBonusThisMonthCents: number;
  totalBonusThisMonthCents: number;
  totalLifetimeSalesCount: number;
}

// Sales
// Tier keys match the post-2026-05 plan_key enum in lib/db/src/schema/stripe.ts
// (legacy "A"/"B" rows were wiped alongside the enum migration).
export type TierKey = "boutique" | "boutique_pro" | "boutique_concierge";

export interface SaleRow {
  id: number;
  leadId: number | null;
  planKey: TierKey;
  setupAmountCents: number;
  monthlyAmountCents: number;
  promoCode: string | null;
  occurredAt: string;
}

// Notifications
export interface NotificationRow {
  id: number;
  repId: number;
  leadId: number | null;
  kind: string;
  title: string;
  body: string | null;
  payload: unknown;
  readAt: string | null;
  createdAt: string;
}

// Lead timeline
export interface LeadTimelineLink {
  id: number;
  leadId: number;
  repId: number;
  token: string;
  createdAt: string;
}
export interface PaymentLinkEventMetadata {
  planKey?: string;
  addonKeys?: string[];
  addonLabels?: string[];
  monthlyTotalCents?: number;
  setupCents?: number;
  checkoutUrl?: string;
  checkoutMode?: string;
  channels?: {
    sms?: { requested: boolean; status: string };
    email?: { requested: boolean; status: string };
  };
}
export interface LeadTimelineLinkEvent {
  id: number;
  linkId: number;
  kind: string;
  templateKey: string | null;
  changeRequestText: string | null;
  metadata: PaymentLinkEventMetadata | null;
  occurredAt: string;
}
export interface LeadTimelineSms {
  id: number;
  leadId: number | null;
  repId: number | null;
  toPhone: string;
  body: string;
  status: string;
  createdAt: string;
}
export interface LeadTimelineEmail {
  id: number;
  leadId: number | null;
  repId: number | null;
  toEmail: string;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
}
export interface LeadTimelinePortal {
  id: number;
  slug: string;
  /** ISO timestamp the most recent hot-lead alert fired for this portal. */
  lastHotAlertAt: string | null;
  lastOpenedAt: string | null;
  openCount: number;
}
/** A single call attempt — outbound (rep dialed) or inbound (prospect rang
 *  the shared 512 number). Audio + transcript + summary are all populated
 *  asynchronously after the recording webhook fires; the timeline shows the
 *  row immediately with `status="queued"` and refines it over time. */
export interface LeadTimelineCall {
  id: number;
  leadId: number | null;
  repId: number | null;
  /** Voice provider — "twilio" for the in-app dialer, "dialpad" for calls
   *  auto-logged from the rep's personal DialPad line via webhook. */
  provider: "twilio" | "dialpad";
  direction: "outbound" | "inbound";
  fromNumber: string;
  toNumber: string;
  status:
    | "queued"
    | "ringing"
    | "in-progress"
    | "completed"
    | "no-answer"
    | "busy"
    | "failed"
    | "canceled";
  startedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  costCents: number;
  recordingDurationSec: number | null;
  voicemailDurationSec: number | null;
  /** Short-lived presigned GCS URL — usable directly as `<audio src>`. */
  audioUrl: string | null;
  transcript: {
    transcriptText: string;
    transcriptLang: string | null;
    generatedAt: string;
  } | null;
  summary: {
    summary: string;
    talkingPoints: string[];
    nextActions: string[];
    generatedAt: string;
  } | null;
  createdAt: string;
}
export interface LeadTimelineResponse {
  lead: LeadDto;
  callbacks: CallbackDto[];
  links: LeadTimelineLink[];
  linkEvents: LeadTimelineLinkEvent[];
  sms: LeadTimelineSms[];
  emails: LeadTimelineEmail[];
  notifications: NotificationRow[];
  portal: LeadTimelinePortal | null;
  calls: LeadTimelineCall[];
}

/** Daily cost-cap snapshot returned by GET /dashboard/voice/status. */
export interface VoiceDailyCap {
  usedCents: number;
  capCents: number;
  blocked: boolean;
  callCount: number;
  connectedMinutes: number;
}
export interface VoiceStatusResponse {
  configured: boolean;
  accessTokensConfigured: boolean;
  dailyCap: VoiceDailyCap;
  /** True when the server has Dialpad OAuth configured (per-rep flow
   * enabled). Reps who haven't connected see the Connect button on
   * the Settings page; the Call button on each lead is gated until
   * `repConnected` flips true. */
  perRepOauth?: boolean;
  repConnected?: boolean;
}

export interface DialpadIntegrationStatus {
  configured: boolean;
  connected: boolean;
  dialpadEmail: string | null;
  scopes: string[];
  expiresAt: string | null;
}

// A lead returned by /dashboard/leads/hot — same shape as LeadDto with the
// portal's most-recent hot-alert timestamp tacked on so the dashboard can
// render the same 🔥 badge as LeadDetail.
export type HotLeadDto = LeadDto & { lastHotAlertAt: string | null };

// Sprint 1 (2026-05-22) — portal request workflow. Created by the rep
// from the lead detail page; the admin sees it as a card on her
// dashboard and hand-crafts the portal off the back of it.
export interface PortalRequestDto {
  id: number;
  leadId: number;
  requestedByRepId: number;
  message: string | null;
  status: "pending" | "handled";
  handledAt: string | null;
  createdAt: string;
}

// Available leads
export interface AvailableLeadsResponse {
  leads: LeadDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  claimsRemainingToday: number;
}

export const api = {
  // auth
  me: () => request<{ user: SessionUser }>("/auth/me"),
  login: (body: LoginRequest) =>
    request<{ user: SessionUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),

  // 2026-05-21 — onboarding helpers removed (rep training gate killed).

  // 2026-05-21 — atomic claim + nurture in one round-trip.
  startWork: (id: number) =>
    request<{ lead: LeadDto }>(`/dashboard/leads/${id}/start-work`, {
      method: "POST",
    }),
  // 2026-05-21 — change requests (Sprint 2 streamline).
  listChangeRequests: (leadId: number) =>
    request<{
      requests: Array<{
        id: number;
        body: string;
        status: string;
        submittedVia: string;
        createdAt: string;
        resolvedAt: string | null;
        resolvedByRepId: number | null;
      }>;
    }>(`/dashboard/leads/${leadId}/change-requests`),
  resolveChangeRequest: (leadId: number, requestId: number) =>
    request<{ request: { id: number; status: string; resolvedAt: string | null } | undefined }>(
      `/dashboard/leads/${leadId}/change-requests/${requestId}/resolve`,
      { method: "POST" },
    ),

  // comp + sales
  compSummary: () => request<CompSummary>("/dashboard/comp/summary"),
  listSales: () => request<{ sales: SaleRow[] }>("/dashboard/sales"),

  // leads
  availableLeads: (filters: {
    city?: string;
    specialty?: string;
    name?: string;
    page?: number;
    pageSize?: number;
    topQualityOnly?: boolean;
    hasWebsite?: "yes" | "no";
    sortBy?: "score" | "name" | "city" | "practice" | "specialty";
    sortDir?: "asc" | "desc";
  }) => {
    const qs = new URLSearchParams();
    if (filters.city) qs.set("city", filters.city);
    if (filters.specialty) qs.set("specialty", filters.specialty);
    if (filters.name) qs.set("name", filters.name);
    if (filters.page) qs.set("page", String(filters.page));
    if (filters.pageSize) qs.set("pageSize", String(filters.pageSize));
    if (filters.topQualityOnly) qs.set("topQualityOnly", "true");
    if (filters.hasWebsite) qs.set("hasWebsite", filters.hasWebsite);
    if (filters.sortBy) qs.set("sortBy", filters.sortBy);
    if (filters.sortDir) qs.set("sortDir", filters.sortDir);
    const s = qs.toString();
    return request<AvailableLeadsResponse>(
      `/dashboard/leads/available${s ? `?${s}` : ""}`,
    );
  },
  myLeads: (
    filter:
      | "active"
      | "nurturing"
      | "won"
      | "disqualified"
      | "cold"
      | "all",
    name?: string,
  ) => {
    const qs = new URLSearchParams({ filter });
    if (name && name.trim().length > 0) qs.set("name", name.trim());
    return request<{ leads: LeadDto[] }>(`/dashboard/leads/mine?${qs.toString()}`);
  },
  hotLeads: () =>
    request<{ leads: HotLeadDto[] }>("/dashboard/leads/hot"),
  claimLead: (id: number) =>
    request<{ lead: LeadDto; claimsRemainingToday: number }>(
      `/dashboard/leads/${id}/claim`,
      { method: "POST" },
    ),
  leadTimeline: (id: number) =>
    request<LeadTimelineResponse>(`/dashboard/leads/${id}`),
  generateLink: (
    id: number,
    body?: {
      channels?: { sms: boolean; email: boolean };
      phoneOverride?: string;
      emailOverride?: string | null;
      subjectOverride?: string;
      bodyOverride?: string;
      smsBodyOverride?: string;
    },
  ) =>
    request<{
      token: string;
      url: string;
      smsStatus: string;
      emailStatus: string;
    }>(`/dashboard/leads/${id}/generate-link`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  draftPreviewLink: (
    id: number,
    body?: { phoneOverride?: string; emailOverride?: string | null },
  ) =>
    request<{
      subject: string;
      body: string;
      smsBody: string;
      previewUrl: string;
    }>(`/dashboard/leads/${id}/generate-link/draft`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  sendPaymentLink: (
    id: number,
    body: {
      /**
       * Tier the rep is quoting (1B-b). New canonical field. The legacy
       * planKey/addonKeys pair stays in the request shape until the
       * dashboard/leads route is rewired in Phase 1B-c, but the route
       * already prefers tierKey when present.
       */
      tierKey?: "boutique" | "boutique_pro" | "boutique_concierge";
      planKey: "A" | "B";
      addonKeys: string[];
      channels: { sms: boolean; email: boolean };
      phoneOverride?: string;
      emailOverride?: string | null;
    },
  ) =>
    request<{
      url: string;
      sessionId: string | null;
      monthlyTotalCents: number;
      setupCents: number;
      smsStatus: string;
      emailStatus: string;
    }>(`/dashboard/leads/${id}/send-payment-link`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  scheduleCallback: (id: number, body: Omit<ScheduleCallbackRequest, "leadId">) =>
    request<{
      callback: CallbackDto;
      recapSmsStatus: string | null;
      recapEmailStatus: string | null;
    }>(`/dashboard/leads/${id}/schedule-callback`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  nurture: (id: number, body: { note?: string; callbackAt?: string }) =>
    request<{ lead: LeadDto; callback: CallbackDto | null }>(
      `/dashboard/leads/${id}/nurture`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  disqualify: (id: number, reason: DisqualifyReason, note?: string) =>
    request<{ lead: LeadDto }>(`/dashboard/leads/${id}/disqualify`, {
      method: "POST",
      body: JSON.stringify({ reason, note }),
    }),
  markCold: (id: number) =>
    request<{ lead: LeadDto }>(`/dashboard/leads/${id}/cold`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  markWon: (id: number) =>
    request<{ lead: LeadDto }>(`/dashboard/leads/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "won" }),
    }),
  // Append-only rep-notes journal (#229, 2026-05-11). Replaces the
  // legacy `saveNotes` blob-PATCH: each entry is its own timestamped
  // row, listed newest-first.
  listRepNotes: (id: number) =>
    request<{ notes: LeadRepNoteDto[] }>(`/dashboard/leads/${id}/rep-notes`),
  addRepNote: (id: number, body: string) =>
    request<{ note: LeadRepNoteDto }>(`/dashboard/leads/${id}/rep-notes`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  // #231 (2026-05-14) — edit a rep's own note. The API enforces
  // ownership (author == current rep + lead still owned by rep); on
  // success the panel re-fetches the list so the "modified" tag and
  // new body appear immediately.
  editRepNote: (leadId: number, noteId: number, body: string) =>
    request<{ note: LeadRepNoteDto }>(
      `/dashboard/leads/${leadId}/rep-notes/${noteId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ body }),
      },
    ),
  setLeadTemplate: (id: number, templateKey: string) =>
    request<{ selectedTemplate: string }>(
      `/dashboard/leads/${id}/template`,
      { method: "PATCH", body: JSON.stringify({ templateKey }) },
    ),
  setLeadHeroImage: (id: number, heroImageUrl: string | null) =>
    request<{ heroImageUrl: string | null }>(
      `/dashboard/leads/${id}/hero-image`,
      { method: "PATCH", body: JSON.stringify({ heroImageUrl }) },
    ),
  setLeadPricingPlan: (
    id: number,
    plan: "boutique" | "boutique_pro" | "boutique_concierge",
  ) =>
    request<{ pricingPlan: string }>(
      `/dashboard/leads/${id}/pricing-plan`,
      { method: "PATCH", body: JSON.stringify({ plan }) },
    ),

  // sms / email
  sendSms: (body: SendSmsRequest) =>
    request<{ status: string; sid?: string | null; error?: string }>(
      "/dashboard/sms/send",
      { method: "POST", body: JSON.stringify(body) },
    ),
  sendEmail: (body: SendEmailRequest) =>
    request<{ status: string; id?: string | null; error?: string }>(
      "/dashboard/email/send",
      { method: "POST", body: JSON.stringify(body) },
    ),

  // callbacks
  listCallbacks: () =>
    request<{ callbacks: CallbackDto[] }>("/dashboard/callbacks"),

  // contact requests (inbound queue)
  inboundQueue: () =>
    request<{ contactRequests: ContactRequestDto[] }>(
      "/dashboard/contact-requests/queue",
    ),
  inboundMine: () =>
    request<{ contactRequests: ContactRequestDto[] }>(
      "/dashboard/contact-requests/mine",
    ),
  claimInbound: (id: number) =>
    request<{ contactRequest: ContactRequestDto }>(
      `/dashboard/contact-requests/${id}/claim`,
      { method: "POST" },
    ),
  patchInbound: (
    id: number,
    body: { status?: "claimed" | "converted" | "closed"; internalNote?: string },
  ) =>
    request<{ contactRequest: ContactRequestDto }>(
      `/dashboard/contact-requests/${id}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ),

  // custom dev
  createQuote: (body: CreateCustomDevRequest) =>
    request<{ quote: CustomDevQuoteDto }>("/dashboard/custom-dev/quotes", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listQuotes: () =>
    request<{ quotes: CustomDevQuoteDto[] }>("/dashboard/custom-dev/quotes"),

  // notifications
  notifications: (unread = false) =>
    request<{ notifications: NotificationRow[] }>(
      `/dashboard/notifications${unread ? "?unread=1" : ""}`,
    ),
  markNotificationRead: (id: number) =>
    request<{ ok: true }>("/dashboard/notifications/read", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),
  markAllNotificationsRead: () =>
    request<{ ok: true }>("/dashboard/notifications/read", {
      method: "POST",
      body: JSON.stringify({ all: true }),
    }),

  // personalized prospect portal
  getLeadPortal: (id: number) =>
    request<{
      slug: string;
      url: string;
      shortUrl: string | null;
      ogUrl: string;
      openCount: number;
      lastOpenedAt: string | null;
      inviteSentAt: string | null;
      reservedAt: string | null;
      selectedTemplate: string | null;
      heroImageUrl: string | null;
      pricingPlan: string | null;
      events: Array<{
        id: number;
        eventType: string;
        templateKey: string | null;
        addonSlug: string | null;
        occurredAt: string;
        metadata: unknown;
      }>;
      cart: { addonSlugs: string[]; monthlyTotalCents: number; setupTotalCents: number } | null;
      enrichment: Array<{ sourceKey: string; confidence: number | null; summary: string | null; fetchedAt: string }>;
      enrichmentCompleteness: { sourcesAvailable: number; sourcesTotal: number };
      fieldsCompleteness: { filled: number; total: number };
      fieldSources: Record<string, string>;
      headway: {
        profileUrl: string;
        photoUrl: string | null;
        bio: string | null;
        specialties: string[];
        modalities: string[];
        acceptedInsurances: string[];
        languages: string[];
        inPerson: boolean;
        virtual: boolean;
        location: { city: string | null; state: string | null };
        pricePerSession: { min: number | null; max: number | null } | null;
        acceptsSlidingScale: boolean;
        matchScore: number;
        npiMatch: boolean;
      } | null;
      integrations: { sms: boolean; email: boolean };
      addons: Array<{ slug: string; name: string; monthlyCents: number; perPatientCents: number | null; setupCents: number; shortDescription: string }>;
    }>(`/dashboard/leads/${id}/portal`),
  sendPortalInvite: (id: number) =>
    request<{ ok: true; url: string; slug: string; sms: unknown; email: unknown }>(
      `/dashboard/leads/${id}/send-invite`,
      { method: "POST" },
    ),
  regeneratePortalToken: (id: number) =>
    request<{
      ok: true;
      slug: string;
      url: string;
      accessTokenExpiresAt: string;
    }>(`/dashboard/leads/${id}/portal/regenerate-token`, { method: "POST" }),
  enrichLead: (id: number) =>
    request<{
      ok: true;
      summary: { attempted: number; succeeded: number; failed: number; errors: Record<string, string> };
      enrichment: Array<{ sourceKey: string; confidence: number | null; summary: string | null; fetchedAt: string }>;
      enrichmentCompleteness: { sourcesAvailable: number; sourcesTotal: number };
      fieldsCompleteness: { filled: number; total: number };
      fieldSources: Record<string, string>;
    }>(`/dashboard/leads/${id}/enrich`, { method: "POST" }),
  // Founder fix #228: full preview reset. Wipes portal customizations,
  // resets template to specialty default, mints a fresh access token,
  // clears self-serve metadata, deletes cached enrichment rows, then
  // re-runs the enrichment pipeline. Same response shape as /enrich.
  resetPortal: (id: number) =>
    request<{
      ok: true;
      summary: { attempted: number; succeeded: number; failed: number; errors: Record<string, string> };
      enrichment: Array<{ sourceKey: string; confidence: number | null; summary: string | null; fetchedAt: string }>;
      enrichmentCompleteness: { sourcesAvailable: number; sourcesTotal: number };
      fieldsCompleteness: { filled: number; total: number };
      fieldSources: Record<string, string>;
    }>(`/dashboard/leads/${id}/portal/reset`, { method: "POST" }),
  generateBriefing: (id: number) =>
    request<{
      summary: string;
      talkingPoints: string[];
      redFlags: string[];
      generatedAt: string;
      sourceLabel: "openai" | "anthropic" | "heuristic";
      headwayProfileUrl: string | null;
    }>(`/dashboard/leads/${id}/briefing`, { method: "POST" }),

  // Sprint 1 (2026-05-22) — portal request workflow. Candice clicks
  // "Demander un portail" on a lead detail page; the admin sees it on
  // her dashboard and hand-crafts the portal off the back of it.
  requestPortal: (leadId: number, message?: string) =>
    request<{ portalRequest: PortalRequestDto }>(
      "/dashboard/portal-requests",
      {
        method: "POST",
        body: JSON.stringify({ leadId, message }),
      },
    ),
  myPortalRequests: () =>
    request<{ portalRequests: PortalRequestDto[] }>(
      "/dashboard/portal-requests/mine",
    ),

  // direct messages (rep ↔ admin)
  listMessages: () =>
    request<{ messages: DirectMessageDto[]; unreadCount: number }>(
      "/rep/messages",
    ),
  sendMessage: (body: string) =>
    request<{ message: DirectMessageDto }>("/rep/messages", {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  markMessageRead: (id: number) =>
    request<{ ok: boolean; message: DirectMessageDto | null }>(
      `/rep/messages/${id}/read`,
      { method: "POST" },
    ),
  markAllMessagesRead: () =>
    request<{ ok: true; marked: number }>("/rep/messages/read-all", {
      method: "POST",
    }),
  unreadMessageCount: () =>
    request<{ unreadCount: number }>("/rep/messages/unread-count"),

  // voice
  voiceStatus: () =>
    request<VoiceStatusResponse>("/dashboard/voice/status"),
  voiceStart: (body: { leadId: number | null; toNumber: string }) =>
    request<{ callId: number; status: string }>("/dashboard/voice/start", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Per-rep Dialpad OAuth (task #226). The Connect button on the
  // Settings page uses `dialpadStartUrl` as a plain anchor href so the
  // browser owns the redirect — fetch() can't follow cross-origin
  // 302s to dialpad.com.
  dialpadIntegrationStatus: () =>
    request<DialpadIntegrationStatus>(
      "/dashboard/integrations/dialpad/status",
    ),
  dialpadStartUrl: () =>
    `${API_BASE}/dashboard/integrations/dialpad/start`,
  dialpadDisconnect: () =>
    request<{ ok: boolean }>(
      "/dashboard/integrations/dialpad/disconnect",
      { method: "POST" },
    ),

  // Live domain availability + suggestions (no auth — public endpoint
  // shared with the prospect portal, hero, and chatbot). Pinned to
  // surface=rep so the funnel dashboard can split rep-driven lookups
  // from prospect-driven ones.
  domainCheck: (domain: string) =>
    request<import("@workspace/api-zod").DomainCheckResult>(
      `/public/domains/check?q=${encodeURIComponent(domain)}&surface=rep`,
    ),
  domainSuggest: (seed: string) =>
    request<import("@workspace/api-zod").DomainSuggestResponse>(
      `/public/domains/suggest?q=${encodeURIComponent(seed)}&surface=rep`,
    ),

  // Persist the rep's domain pick onto the lead row. The prospect-facing
  // DomainPicker was retired on 2026-04-28 (#185 Comms & Copy
  // Hardening) — domain selection is a sales-only conversation now and
  // the value rides into the portal preview link / Stripe Checkout from
  // here. Pass `null` to clear a previously-set value.
  setLeadChosenDomain: (leadId: number, chosenDomain: string | null) =>
    request<{ chosenDomain: string | null }>(
      `/dashboard/leads/${leadId}/chosen-domain`,
      {
        method: "PATCH",
        body: JSON.stringify({ chosenDomain }),
      },
    ),
  // PHASE A.2 — persist therapist Calendly + Doxy URLs onto the lead row
  // so the public-site preview + post-payment onboarding can thread them
  // through to BookingWidget and DoxyBridge.
  setLeadCalendlyDoxy: (
    leadId: number,
    body: { calendlyUrl: string | null; doxyUrl: string | null },
  ) =>
    request<{ lead: LeadDto }>(`/dashboard/leads/${leadId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

export interface DirectMessageDto {
  id: number;
  repId: number;
  direction: "rep_to_admin" | "admin_to_rep";
  body: string;
  sentAt: string;
  readAt: string | null;
  senderRepId: number | null;
}

export const fmtCents = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const fmtDateTime = (iso: string | null | undefined) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const CUSTOM_DEV_FEATURE_LABELS: Record<CustomDevFeatureKey, string> = {
  intake_form: "Intake form",
  patient_portal_link: "Patient portal link",
  online_courses: "Online courses",
  ecommerce: "E-commerce",
  video_library: "Video library",
  podcast_hosting: "Podcast hosting",
  appointment_booking_advanced: "Advanced appointment booking",
  multi_location: "Multi-location",
  directory_advanced: "Advanced directory",
  blog_pro: "Blog pro",
  analytics_pro: "Analytics pro",
  custom_other: "Custom / other",
};

export type ApprovalKind =
  | "setup_fee_discount"
  | "free_first_month"
  | "refund_invoice"
  | "custom_addon_price";

export type ApprovalRequestDto = {
  id: number;
  leadId: number | null;
  saleId: number | null;
  repId: number;
  kind: ApprovalKind;
  reason: string;
  payload: Record<string, unknown> | null;
  status: "pending" | "approved" | "denied";
  decidedByRepId: number | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
};

export const APPROVAL_KIND_LABELS: Record<ApprovalKind, string> = {
  setup_fee_discount: "Discount setup fee",
  free_first_month: "Free first month",
  refund_invoice: "Refund an invoice",
  custom_addon_price: "Custom add-on price",
};

export const apiApprovals = {
  create: (body: {
    kind: ApprovalKind;
    reason: string;
    leadId?: number;
    payload?: Record<string, unknown>;
  }) =>
    request<ApprovalRequestDto>("/dashboard/approvals", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listForLead: (leadId: number) =>
    request<ApprovalRequestDto[]>(
      `/dashboard/approvals?leadId=${leadId}`,
    ),
};

export const DISQUALIFY_REASON_LABELS: Record<DisqualifyReason, string> = {
  not_interested: "Not interested",
  wrong_number: "Wrong number",
  do_not_call: "Do not call",
  already_has_provider: "Already has a provider",
  out_of_market: "Out of market",
  budget_concern: "Budget concern",
  other: "Other",
};
