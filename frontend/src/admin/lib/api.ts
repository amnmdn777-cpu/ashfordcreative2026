import type {
  SessionUser,
  LoginRequest,
  ContactRequestDto,
  CustomDevQuoteDto,
  // 2026-05-21 — ClientOnboardingDto / ContentSubmission / FinalizeOnboardingRequest
  // removed (client onboarding flow killed, Sprint 2 streamline).
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
  const isForm = init?.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
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
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json() as Promise<T>;
  return res.text() as unknown as Promise<T>;
}

export interface DashboardSummary {
  salesThisMonth: number;
  activeSubscriptions: number;
  mrrCents: number;
  openContactRequests: number;
  openCustomDevQuotes: number;
  leadsPool: Record<string, number>;
  churn: { thisMonth: number; previousMonth: number; ratePct: number };
  topReps: {
    repId: number;
    username: string;
    displayName: string;
    salesCount: number;
    revenueCents: number;
  }[];
  recentSales: {
    id: number;
    repId: number | null;
    leadId: number | null;
    planKey: "A" | "B";
    setupAmountCents: number;
    monthlyAmountCents: number;
    occurredAt: string;
  }[];
}

export interface RepRow {
  id: number;
  username: string;
  displayName: string;
  role: "rep" | "admin";
  promoCode: string;
  hourlyRateCents: number;
  isActive: boolean;
  // 2026-05-21 — `hasCompletedOnboarding` dropped (rep training gate killed).
  createdAt: string;
}

export interface SubscriptionRow {
  id: number;
  saleId: number;
  stripeSubscriptionId: string | null;
  status: "active" | "past_due" | "canceled" | "trialing" | "unpaid" | "incomplete";
  addonKeys: string[];
  monthlyTotalCents: number;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  createdAt: string;
}

// 2026-05-21 — `OnboardingRow` removed (client onboarding flow killed).

export interface EmailProblemRow {
  id: number;
  toAddr: string;
  subject: string;
  status: string;
  errorMessage: string | null;
  occurredAt: string;
  leadId: number | null;
}

export interface LeadRow {
  id: number;
  name: string;
  practice: string | null;
  specialty: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  currentWebsite: string | null;
  profileBlurb: string | null;
  status: string;
  poolStatus: string;
  claimedByRepId: number | null;
  locale: "en" | "es" | null;
  createdAt: string;
  lastActivityAt: string | null;
  // PHASE A.2 — therapist Calendly + Doxy URLs.
  calendlyUrl?: string | null;
  doxyUrl?: string | null;
}

/**
 * Mirrors the rep `/dashboard/leads/:id/portal` shape (built by
 * `services/leadPortalView.ts` on the API). Only the fields the
 * Customer-portal panel actually consumes are typed; remaining fields
 * are kept as `unknown` to avoid drift if upstream evolves.
 */
export interface LeadPortalDto {
  slug: string;
  url: string;
  shortUrl: string | null;
  ogUrl: string;
  openCount: number;
  lastOpenedAt: string | null;
  inviteSentAt: string | null;
  reservedAt: string | null;
  selectedTemplate: string | null;
  enrichment: {
    sourceKey: string;
    confidence: number | null;
    summary: string | null;
    fetchedAt: string;
  }[];
  enrichmentCompleteness: { sourcesAvailable: number; sourcesTotal: number };
  fieldsCompleteness: { filled: number; total: number };
  integrations: { sms: boolean; email: boolean };
  events: unknown;
  cart: unknown;
  fieldSources: unknown;
  headway: unknown;
  addons: unknown;
}

/** One call attempt on a lead — outbound (rep dialed) or inbound. Audio,
 *  transcript, and GPT summary are filled in asynchronously after the
 *  recording/transcription webhooks fire (so a fresh row may have nulls
 *  for all three even when status is "completed"). */
export interface LeadTimelineCall {
  id: number;
  leadId: number | null;
  repId: number | null;
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

export interface TranscriptsLeadRow {
  leadId: number;
  leadName: string | null;
  practice: string | null;
  callCount: number;
  transcriptCount: number;
  lastCallAt: string | null;
}

export interface AuditEntry {
  id: number;
  action: string;
  targetType: string | null;
  targetId: string | null;
  diff: unknown;
  // LOT 1.2 — structured fields from migration 0016. Optional because
  // pre-migration rows have NULL on these columns, and the two
  // service-layer inline writers (approvals.refundApprovalInvoice,
  // scripts/releaseRepClaims) bypass the helper that populates them.
  // The Audit.tsx page still renders `diff` for now; a follow-up will
  // surface before/after/actorRole/ip/userAgent in their own panes.
  before?: unknown;
  after?: unknown;
  actorRole?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  occurredAt: string;
  actor: { id: number; displayName: string; username: string } | null;
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

  // dashboard
  dashboard: () => request<DashboardSummary>("/admin/dashboard"),
  listAdminNotifications: (unread?: boolean) =>
    request<{
      notifications: Array<{
        id: number;
        kind: string;
        leadId: number | null;
        repId: number | null;
        body: string | null;
        readAt: string | null;
        createdAt: string;
      }>;
    }>(`/admin/notifications${unread ? "?unread=1" : ""}`),
  markAdminNotificationRead: (id: number) =>
    request<{ ok: true }>(`/admin/notifications/${id}/read`, {
      method: "PATCH",
    }),
  replyToAdminNotification: (id: number, body: string) =>
    request<{
      ok: true;
      note: {
        id: number;
        leadId: number;
        body: string;
        createdAt: string;
        rep: { id: number; displayName: string; emailed: boolean };
      };
    }>(`/admin/notifications/${id}/reply`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  emailDeliverability: () =>
    request<{ problems: EmailProblemRow[] }>("/admin/email/deliverability"),
  systemStatus: () =>
    request<{
      isProd: boolean;
      stripeWebhookConfigured: boolean;
      stripeConfigured: boolean;
    }>("/admin/system-status"),
  voiceCostToday: () =>
    request<{
      capUsd: number;
      spentUsd: number;
      remainingUsd: number;
      tripped: boolean;
      blocked: boolean;
      callCount: number;
      connectedMinutes: number;
      byRep: {
        repId: number;
        repName: string | null;
        spentUsd: number;
        calls: number;
        minutes: number;
      }[];
    }>("/admin/voice-cost-today"),

  // Sprint 1 (2026-05-22) — portal request workflow.
  listPortalRequests: (status: "pending" | "handled" = "pending") =>
    request<{
      portalRequests: Array<{
        id: number;
        leadId: number;
        leadName: string;
        leadPractice: string;
        leadCity: string;
        leadState: string;
        leadNotes: string | null;
        requestedByRepId: number;
        requestedByDisplayName: string;
        message: string | null;
        status: "pending" | "handled";
        createdAt: string;
        handledAt: string | null;
      }>;
    }>(`/admin/portal-requests?status=${status}`),
  portalRequestsPendingCount: () =>
    request<{ pendingCount: number }>(
      "/admin/portal-requests/pending-count",
    ),
  markPortalRequestHandled: (id: number) =>
    request<{
      portalRequest: {
        id: number;
        leadId: number;
        status: "pending" | "handled";
        createdAt: string;
        handledAt: string | null;
      };
    }>(`/admin/portal-requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "handled" }),
    }),

  // approvals
  listApprovals: (status?: string) =>
    request<ApprovalRequestDto[]>(
      `/admin/approvals${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),
  decideApproval: (
    id: number,
    body: { decision: "approved" | "denied"; decisionNote?: string },
  ) =>
    request<ApprovalRequestDto>(`/admin/approvals/${id}/decide`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  refundApproval: (
    id: number,
    body: { amountCents: number; invoiceId?: string; decisionNote?: string },
  ) =>
    request<{
      approval: ApprovalRequestDto;
      refund: {
        refundId: string;
        invoiceId: string;
        chargeId: string;
        amountCents: number;
        status: string | null;
        createdAt: string;
      };
    }>(`/admin/approvals/${id}/refund`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // reps
  listReps: () => request<{ reps: RepRow[] }>("/admin/reps"),
  createRep: (body: {
    username: string;
    displayName: string;
    password: string;
    role: "rep" | "admin";
    promoCode: string;
    hourlyRateCents: number;
  }) =>
    request<{ rep: { id: number; username: string; displayName: string; promoCode: string } }>(
      "/admin/reps",
      { method: "POST", body: JSON.stringify(body) },
    ),
  patchRep: (
    id: number,
    body: Partial<{
      displayName: string;
      promoCode: string;
      hourlyRateCents: number;
      isActive: boolean;
      role: "rep" | "admin";
    }>,
  ) =>
    request<{ rep: RepRow }>(`/admin/reps/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  // leads
  importLeads: (csv: string) =>
    request<{ inserted: number; duplicates?: number; errors: string[] }>(
      "/admin/leads/import",
      { method: "POST", body: JSON.stringify({ csv }) },
    ),
  // One-shot reset of every lead's rep_notes. Founder-only maintenance
  // action; the endpoint is gated by `requireAdmin` server-side.
  // LOT 1.6 — confirmation is part of the API contract; the server
  // rejects with 400 if missing or mismatched. The admin UI also
  // enforces this with a button-disable-until-match input, but that's
  // UX only. The API call carries the literal string the operator
  // typed and the server zod-literal'd against the expected value.
  releaseAllClaims: (confirmation: "RELEASE") =>
    request<{ released: number }>("/admin/leads/release-all-claims", {
      method: "POST",
      body: JSON.stringify({ confirmation }),
    }),
  wipeAllRepNotes: (confirmation: "RESET") =>
    request<{ cleared: number }>("/admin/leads/wipe-rep-notes", {
      method: "POST",
      body: JSON.stringify({ confirmation }),
    }),
  leadTimeline: (id: number) =>
    request<{ lead: LeadRow; calls: LeadTimelineCall[] }>(
      `/admin/leads/${id}/timeline`,
    ),
  listLeadsWithCalls: () =>
    request<{ leads: TranscriptsLeadRow[] }>("/admin/calls/leads"),
  backfillCalls: (sinceDays?: number) =>
    request<{
      sinceDays: number;
      fetched: number;
      upserted: number;
      withTranscript: number;
      withSummary: number;
      errors: number;
    }>("/admin/calls/backfill", {
      method: "POST",
      body: JSON.stringify({ sinceDays }),
    }),
  importTemplateUrl: () => `${API_BASE}/admin/leads/import-template`,
  // Lead detail header (admin LeadDetail page)
  getLead: (id: number) => request<{ lead: LeadRow }>(`/admin/leads/${id}`),
  // PHASE A.2 — persist therapist Calendly + Doxy URLs onto the lead row.
  setLeadBookingUrls: (
    id: number,
    body: { calendlyUrl: string | null; doxyUrl: string | null },
  ) =>
    request<{ lead: LeadRow }>(`/admin/leads/${id}/booking-urls`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  // Customer-portal panel payload (mirrors rep `/dashboard/leads/:id/portal`)
  getLeadPortal: (id: number) =>
    request<LeadPortalDto>(`/admin/leads/${id}/portal`),

  // contact requests
  contactRequests: () =>
    request<{ contactRequests: ContactRequestDto[] }>("/admin/contact-requests"),

  // custom dev
  customDevQueue: () =>
    request<{ quotes: CustomDevQuoteDto[] }>("/admin/custom-dev/queue"),
  quoteCustomDev: (id: number, quotedAmountCents: number, adminNote?: string) =>
    request<{ quote: CustomDevQuoteDto }>(`/admin/custom-dev/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ quotedAmountCents, adminNote }),
    }),
  sendCustomDev: (id: number) =>
    request<{ quote: CustomDevQuoteDto; sms: unknown; email: unknown }>(
      `/admin/custom-dev/${id}/send`,
      { method: "POST" },
    ),

  // sales
  listSales: () =>
    request<{
      sales: {
        id: number;
        planKey: "A" | "B";
        setupAmountCents: number;
        monthlyAmountCents: number;
        promoCode: string | null;
        occurredAt: string;
      }[];
    }>("/admin/sales"),

  // subscriptions
  listSubscriptions: () =>
    request<{ subscriptions: SubscriptionRow[] }>("/admin/subscriptions"),
  cancelSubscription: (id: number, reason?: string) =>
    request<{ subscription: SubscriptionRow; cancelAtPeriodEnd: boolean }>(
      `/admin/subscriptions/${id}/cancel`,
      { method: "POST", body: JSON.stringify({ reason }) },
    ),
  upgradeSubscription: (id: number, tierKey: string) =>
    request<{ subscription: SubscriptionRow }>(
      `/admin/subscriptions/${id}/upgrade`,
      { method: "POST", body: JSON.stringify({ tierKey }) },
    ),
  transferDomain: (id: number, customerEmail: string) =>
    request<{
      ok: boolean;
      transferFeeCents: number;
      paymentLinkUrl: string | null;
      message: string;
    }>(`/admin/subscriptions/${id}/transfer-domain`, {
      method: "POST",
      body: JSON.stringify({ customerEmail }),
    }),

  // 2026-05-21 — `listOnboardings` / `briefMdUrl` removed (Sprint 2 streamline).

  // audit
  listAudit: () => request<{ entries: AuditEntry[] }>("/admin/audit"),

  // direct messages (rep ↔ admin)
  listRepMessages: (repId: number) =>
    request<{ messages: DirectMessageDto[] }>(
      `/admin/reps/${repId}/messages`,
    ),
  sendRepMessage: (repId: number, body: string) =>
    request<{ message: DirectMessageDto }>(`/admin/reps/${repId}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  markRepMessagesAllRead: (repId: number) =>
    request<{ ok: true; marked: number }>(
      `/admin/reps/${repId}/messages/read-all`,
      { method: "POST" },
    ),
  messagesSummary: () =>
    request<{
      unreadByRep: { repId: number; unreadCount: number }[];
      lastMessageByRep: {
        repId: number;
        lastBody: string;
        lastSentAt: string;
        lastDirection: "rep_to_admin" | "admin_to_rep";
      }[];
    }>("/admin/messages/summary"),

  // 2026-05-21 — public onboarding helpers removed (client onboarding flow killed).
  openBillingPortal: (token: string) =>
    request<{ url: string }>(`/public/onboarding/${encodeURIComponent(token)}/billing-portal`, {
      method: "POST",
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

export const fmtCents = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const fmtDateTime = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};
