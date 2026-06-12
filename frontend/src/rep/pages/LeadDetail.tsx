import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Mail,
  MessageSquare,
  Link2,
  CalendarClock,
  CheckCircle2,
  XCircle,
  Bell,
  Eye,
  ArrowLeft,
  DollarSign,
  Copy,
  ExternalLink,
  Sparkles,
  Send,
  Activity,
  Phone,
  Flame,
  ChevronDown,
  ChevronRight,
  Globe,
  Loader2,
  Snowflake,
  Pencil,
  Check,
  X as XIcon,
  Film,
  FileDown,
  Paperclip,
  MapPin,
} from "lucide-react";
import {
  api,
  fmtDateTime,
  DISQUALIFY_REASON_LABELS,
} from "@rep/lib/api";
import {
  TIERS,
  type TierKey,
  HOT_LEAD_WINDOW_MS,
  isGoogleInlineFullySynced,
  isRecentFollowUpCall,
  needsFollowUpCall,
  type DisqualifyReason,
} from "@workspace/api-zod";
import { PageHeader } from "@rep/components/RepLayout";
import { ChangeRequestsPanel } from "@rep/components/ChangeRequestsPanel";
import { CallModal } from "@rep/components/CallModal";
import { CallTimelineList } from "@rep/components/CallTimelineEntries";
import { useDialer } from "@rep/contexts/DialerProvider";
import { useAuth } from "@rep/lib/auth";

type ModalKind =
  | "sms"
  | "email"
  | "callback"
  | "disqualify"
  | "cold"
  | "won"
  | "preview"
  | "payment"
  | "call"
  | "portal_request"
  | null;

type Briefing = Awaited<ReturnType<typeof api.generateBriefing>>;

// 2026-05-20 — Leads avec avis génériques d'aperçu (3 reviews stock).
// Mirror de la liste canonique dans:
//   api-server/src/migrations/curatedReviews20260520.gen.ts
// Maintenu manuellement en sync (assez petit pour ne pas justifier un fetch).
const SAMPLE_REVIEW_LEAD_IDS_2026_05_20 = new Set<number>([
  300, 469, 474, 476, 502, 504, 520, 521, 522, 530, 538, 541, 545, 555, 566,
  569, 573,
]);

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  // Guard non-numeric lead ids — e.g. /leads/available, /leads/undefined.
  // Without this, Number("available") is NaN, the timeline query fires
  // with NaN, the API 404s, and the rep sees "Failed to load lead".
  // Redirect to the queue instead. (LOT 7.9)
  useEffect(() => {
    if (!Number.isFinite(id) || id <= 0) navigate("/available");
  }, [id, navigate]);
  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="px-8 py-10 text-muted-foreground text-sm">
        Redirecting to the lead queue…
      </div>
    );
  }
  const [modal, setModal] = useState<ModalKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const {
    dailyCapBlocked: dialerCapBlocked,
    perRepOauth: dialerPerRepOauth,
    repConnected: dialerRepConnected,
  } = useDialer();

  // Briefing lives at the page level (not inside the portal card) so the
  // step-1 button in the workflow sidebar can trigger it AND the dedicated
  // briefing panel above the portal card can render the result.
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const briefingPanelRef = useRef<HTMLDivElement | null>(null);

  const lead = useQuery({
    queryKey: ["lead", id],
    queryFn: () => api.leadTimeline(id),
  });

  // Portal data is needed in the workflow sidebar to derive per-step
  // status (invite sent? prospect viewed? payment link sent?) and in the
  // PortalSnapshot below. React Query dedupes the second call.
  const portal = useQuery({
    queryKey: ["lead-portal", id],
    queryFn: () => api.getLeadPortal(id),
    refetchOnWindowFocus: false,
  });

  // Sprint 1 (2026-05-22) — the rep's portal requests, used to disable
  // the "Demander un portail" button while one is still pending for
  // this lead and to render the "Demande envoyée" state.
  const portalRequests = useQuery({
    queryKey: ["my-portal-requests"],
    queryFn: () => api.myPortalRequests(),
    refetchOnWindowFocus: false,
  });
  const pendingPortalRequest = (portalRequests.data?.portalRequests ?? []).find(
    (r) => r.leadId === id && r.status === "pending",
  );

  const briefingMut = useMutation({
    mutationFn: async () => {
      // Kick off enrichment in parallel so the data is fresh by the time
      // the rep reaches step 3. Don't fail the briefing if enrichment errors.
      if (!enrich.isPending) enrich.mutate();
      return api.generateBriefing(id);
    },
    onSuccess: (b) => {
      setBriefing(b);
      setInfo(`Briefing ready (${b.sourceLabel}).`);
      setError(null);
      // Bring the briefing panel into view so the rep can read it
      // without scrolling around.
      requestAnimationFrame(() => {
        briefingPanelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    },
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : "Briefing failed."),
  });

  // Two-click preview flow (founder feedback 2026-05):
  //   click 1 → kick off enrichment in the background, button morphs
  //              to "Préparation en cours…" with a spinner.
  //   click 2 → button now reads "Preview prête — ouvrir", click
  //              navigates the rep to the portal in the SAME tab
  //              (user explicitly: "je veux pas de nouvel onglet").
  // `previewReady` flips true on the first successful enrichment of
  // this session and resets on lead-id change so revisiting a lead
  // forces a fresh prep (matches the user's "prends ton temps,
  // assure-toi que tout fonctionne" constraint — half-rendered portals
  // shipped to prospects when we skipped this gate).
  const [previewReady, setPreviewReady] = useState(false);
  // Reset readiness whenever the rep navigates to a different lead.
  useEffect(() => {
    setPreviewReady(false);
  }, [id]);

  // Per-lead preview downloads — wired 2026-05-18 in rep dashboard to mirror
  // the admin flow. Both buttons appear right under Step 2 once the preview
  // is ready, and stream the file straight from the backend service via a
  // blob download (Content-Disposition: attachment + filename). Rate
  // limiting + auth happen server-side; here we only manage the spinner +
  // error state so the rep gets immediate feedback.
  const [downloadingVideo, setDownloadingVideo] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const handleDownloadPreviewVideo = async () => {
    if (downloadingVideo) return;
    setDownloadingVideo(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/leads/${id}/portal/video`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Video render failed (${res.status})`);
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="?([^";]+)"?/.exec(disposition);
      const filename = match?.[1] ?? `preview-${id}.mp4`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video download failed.");
    } finally {
      setDownloadingVideo(false);
    }
  };
  const handleDownloadPreviewPdf = async () => {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/leads/${id}/portal/pdf`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`PDF render failed (${res.status})`);
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="?([^";]+)"?/.exec(disposition);
      const filename = match?.[1] ?? `preview-${id}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF download failed.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const enrich = useMutation({
    mutationFn: () => api.enrichLead(id),
    onSuccess: async (res) => {
      // Wait for the portal query to land before flipping the readiness
      // flag — otherwise the rep's second click can race and read a
      // stale `portal` whose shortUrl/url isn't yet refreshed.
      qc.invalidateQueries({ queryKey: ["lead", id] });
      await qc.refetchQueries({ queryKey: ["lead-portal", id] });
      setPreviewReady(true);
      setInfo(
        `Preview ready (${res.summary.succeeded}/${res.summary.attempted} sources). Click again to open.`,
      );
      setError(null);
    },
    onError: (err: unknown) => {
      // Even on failure, mark ready=true so the rep can still open
      // whatever partial portal exists (better than blocking the
      // workflow on a flaky 5xx upstream).
      setPreviewReady(true);
      setError(err instanceof Error ? err.message : "Refresh failed.");
    },
  });

  // Founder fix #228: "Prepare preview" must produce a clean slate every
  // time. The previous flow re-used the existing portal row (template,
  // palette, hero photo, copy overrides, cached enrichment) so a second
  // attempt rendered the previous version. `resetPreview` calls the new
  // `/portal/reset` endpoint which wipes customizations, resets the
  // template to the specialty default, mints a fresh access token, clears
  // selfServeMeta, deletes cached enrichment rows, and re-runs enrichment.
  const resetPreview = useMutation({
    mutationFn: () => api.resetPortal(id),
    onSuccess: async (res) => {
      qc.invalidateQueries({ queryKey: ["lead", id] });
      await qc.refetchQueries({ queryKey: ["lead-portal", id] });
      setPreviewReady(true);
      setInfo(
        `Fresh preview ready (${res.summary.succeeded}/${res.summary.attempted} sources). Click again to open.`,
      );
      setError(null);
    },
    onError: (err: unknown) => {
      setPreviewReady(true);
      setError(err instanceof Error ? err.message : "Preview reset failed.");
    },
  });

  const events = useMemo(() => {
    if (!lead.data) return [];
    type Ev = {
      time: string;
      kind: string;
      title: string;
      detail?: string;
      icon: typeof Mail;
      paymentMeta?: {
        meta: import("@rep/lib/api").PaymentLinkEventMetadata | null;
        fallback: string | null;
      };
    };
    const evs: Ev[] = [];
    for (const c of lead.data.callbacks) {
      evs.push({
        time: c.scheduledFor,
        kind: "callback",
        title: c.completedAt
          ? "Callback completed"
          : "Callback scheduled",
        detail: c.note ?? undefined,
        icon: CalendarClock,
      });
    }
    for (const l of lead.data.links) {
      if (l.token.startsWith("pmt_")) continue;
      evs.push({
        time: l.createdAt,
        kind: "link",
        title: "Preview link sent",
        detail: l.token,
        icon: Link2,
      });
    }
    for (const e of lead.data.linkEvents) {
      const isPayment = e.kind === "payment_link_sent";
      evs.push({
        time: e.occurredAt,
        kind: "link-event",
        title: isPayment
          ? e.templateKey
            ? `Payment link sent (Plan ${e.templateKey})`
            : "Payment link sent"
          : `Preview ${e.kind.replace(/_/g, " ")}`,
        detail: isPayment ? undefined : (e.changeRequestText ?? undefined),
        icon: isPayment ? DollarSign : Eye,
        paymentMeta: isPayment
          ? { meta: e.metadata, fallback: e.changeRequestText }
          : undefined,
      });
    }
    for (const s of lead.data.sms) {
      evs.push({
        time: s.createdAt,
        kind: "sms",
        title: `SMS ${s.status}`,
        detail: s.body,
        icon: MessageSquare,
      });
    }
    for (const e of lead.data.emails) {
      evs.push({
        time: e.createdAt,
        kind: "email",
        title: `Email ${e.status}: ${e.subject}`,
        detail: e.body,
        icon: Mail,
      });
    }
    for (const n of lead.data.notifications) {
      evs.push({
        time: n.createdAt,
        kind: "notification",
        title: n.title,
        detail: n.body ?? undefined,
        icon: Bell,
      });
    }
    return evs.sort((a, b) => +new Date(b.time) - +new Date(a.time));
  }, [lead.data]);

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["lead", id] });
    qc.invalidateQueries({ queryKey: ["leads", "mine"] });
    qc.invalidateQueries({ queryKey: ["callbacks"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const onSuccess = (msg: string) => {
    setInfo(msg);
    setError(null);
    setModal(null);
    refreshAll();
  };
  const onErr = (err: unknown) => {
    setError(err instanceof Error ? err.message : "Action failed");
    setInfo(null);
  };

  // PHASE A.2 — therapist Calendly + Doxy URLs. Local state mirrors the
  // server fields; the rep types these once the therapist shares them
  // and the public-site BookingWidget + DoxyBridge thread them through
  // to the prospect preview.
  const [calendlyUrlDraft, setCalendlyUrlDraft] = useState("");
  const [doxyUrlDraft, setDoxyUrlDraft] = useState("");
  const [bookingDraftLoaded, setBookingDraftLoaded] = useState(false);
  useEffect(() => {
    if (!lead.data || bookingDraftLoaded) return;
    setCalendlyUrlDraft(lead.data.lead.calendlyUrl ?? "");
    setDoxyUrlDraft(lead.data.lead.doxyUrl ?? "");
    setBookingDraftLoaded(true);
  }, [lead.data, bookingDraftLoaded]);
  const saveBookingUrls = useMutation({
    mutationFn: async () =>
      api.setLeadCalendlyDoxy(id, {
        calendlyUrl: calendlyUrlDraft.trim() === "" ? null : calendlyUrlDraft.trim(),
        doxyUrl: doxyUrlDraft.trim() === "" ? null : doxyUrlDraft.trim(),
      }),
    onSuccess: () => {
      setInfo("Saved booking + telehealth URLs.");
      setError(null);
      qc.invalidateQueries({ queryKey: ["lead", id] });
    },
    onError: onErr,
  });

  // "Mark as Work in Progress" replaces the old auto-claim flow. Opening
  // a lead from Available leads no longer claims it — the rep explicitly
  // promotes the lead here, which both claims it (so the rep owns it and
  // it leaves the available pool) and skips straight to the `nurturing`
  // status so it shows up under My leads → Work in Progress.
  const markWip = useMutation({
    // 2026-05-21 — atomic claim+nurture (Sprint 1 streamline).
    mutationFn: () => api.startWork(id),
    onSuccess: () => {
      setError(null);
      setInfo("Lead added to Work in Progress.");
      qc.invalidateQueries({ queryKey: ["lead", id] });
      qc.invalidateQueries({ queryKey: ["leads", "mine"] });
      qc.invalidateQueries({ queryKey: ["available"] });
    },
    onError: onErr,
  });

  if (lead.isLoading) {
    return (
      <div className="px-8 py-10 text-muted-foreground text-sm">Loading…</div>
    );
  }
  if (lead.isError || !lead.data) {
    return (
      <div className="px-8 py-10">
        <div className="text-sm text-destructive">
          {(lead.error as Error)?.message ?? "Failed to load lead."}
        </div>
        <Link href="/my-leads" className="text-sm text-accent hover:underline mt-3 inline-block">
          ← Back to my leads
        </Link>
      </div>
    );
  }

  const l = lead.data.lead;
  // Pre-disable the Call action when we already know it would fail
  // server-side: prospect on the SMS DNC list (we treat SMS opt-out as
  // a voice opt-out too — same human contact preference) or daily voice
  // cost cap blown. The server still enforces both, but blocking in the
  // UI saves a confirm-and-fail round trip and keeps the subtitle
  // honest about why the action is unavailable.
  const phoneOptedOut = Boolean(l.phoneOptedOut);
  // When the server has per-rep Dialpad OAuth turned on, the rep MUST
  // have connected her own Dialpad seat before we let her dial — otherwise
  // the prospect would see Candice's number (the bug task #226 fixed).
  // The Settings page link below carries the rep straight to Connect.
  const callDisabledReason: string | null = !l.phone
    ? "No phone on file for this lead."
    : phoneOptedOut
      ? "Prospect is on the do-not-contact list."
      : dialerCapBlocked
        ? "Daily voice cost cap reached — try again tomorrow."
        : dialerPerRepOauth && !dialerRepConnected
          ? "Connect your Dialpad in Settings before placing calls."
          : null;

  // SMS gating mirrors the call gating for the per-rep Dialpad case
  // (task #226): when OAuth is configured and the rep hasn't linked her
  // own seat, refuse to open the SMS modal so prospects don't end up
  // texting Candice's number. The legacy "carrier verification" subtitle
  // on the bulk recap cards stays as-is — that reflects the independent
  // TextBelt 10DLC blocker, which Connect-your-Dialpad won't fix.
  const smsDisabledReason: string | null =
    dialerPerRepOauth && !dialerRepConnected
      ? "Connect your Dialpad in Settings before sending SMS."
      : null;

  return (
    // `pb-24 lg:pb-10` reserves room for the mobile sticky Call/SMS/Note
    // bar (rendered at the end of this return) so its 64px-tall surface
    // never covers the last action card on small screens. The desktop
    // sidebar remains the primary action surface at lg+, so we drop the
    // extra padding back to the original rhythm.
    <div className="px-4 md:px-8 py-8 md:py-10 pb-24 lg:pb-10 max-w-7xl">
      <Link
        href="/my-leads"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft size={14} /> Back
      </Link>
      <PageHeader
        title={l.name}
        description={`${l.practice} · ${l.specialty} · ${l.city}, ${l.state}`}
        actions={
          <div className="flex items-center gap-2">
            <QcBadge
              status={(l as any).qcStatus ?? "none"}
              validatedAt={(l as any).qcValidatedAt ?? null}
              validatedBy={(l as any).qcValidatedBy ?? null}
            />
            <HotLeadBadge lastHotAlertAt={lead.data.portal?.lastHotAlertAt ?? null} />
            <span className="inline-flex items-center text-xs px-2 py-1 rounded-full border border-accent/30 bg-accent/10 text-accent">
              {l.status === "nurturing" || l.status === "claimed"
                ? "Work in progress"
                : l.status}
            </span>
            {(l.status === "available" ||
              l.status === "recycled" ||
              l.status === "claimed") && (
              <button
                type="button"
                onClick={() => markWip.mutate()}
                disabled={markWip.isPending}
                className="rounded-md bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 disabled:opacity-60"
              >
                {markWip.isPending
                  ? "Saving…"
                  : "Mark as Work in Progress"}
              </button>
            )}
          </div>
        }
      />

      {/* 2026-05-14: Tier capabilities panel removed from LeadDetail — the rep
          picks the pricing plan inside the Send preview email modal now, so
          this at-a-glance card is no longer needed on every lead. */}

      {(l.status === "available" || l.status === "recycled") && (
        <div className="mb-4 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground/80">
          You're previewing this lead — it's still in the available pool.
          Click <span className="font-medium">Mark as Work in Progress</span>{" "}
          to add it to your queue. Outreach actions (SMS, email, call,
          preview) unlock once you do.
        </div>
      )}

      {(error || info) && (
        <div
          className={`text-sm rounded-md px-3 py-2 mb-4 border ${
            error
              ? "text-destructive bg-destructive/10 border-destructive/30"
              : "text-primary bg-primary/10 border-primary/30"
          }`}
        >
          {error ?? info}
        </div>
      )}

      {/*
       * Workflow side-panel breakpoint.
       *
       * History: this used to be `lg:` (1024px viewport). With the rep
       * app's 256px static sidebar, that left so little headroom that any
       * laptop window narrower than ~1024 pushed the entire workflow
       * panel BELOW the lead — invisible without a scroll. The founder
       * reported this on 2026-04-28 ("the sales rep can't see the right
       * menu!!!!") because the per-call instructions on the lead body
       * literally say "step 1 in the workflow on the right".
       *
       * `min-[960px]:` activates the side-by-side layout 64px earlier so
       * a typical laptop window (Chrome at 1280 with a sidebar, or 13"
       * MacBook at native 1280) keeps the workflow visible. At 960px
       * viewport: 960 - 256 (sidebar) = 704 content; 320 panel + 24 gap
       * + 360 lead-body still fits without wrapping.
       *
       * Below 960px the layout still collapses to a single column and
       * the workflow stacks under the lead — same as before.
       */}
      {/*
       * BriefingPanel renders FULL-WIDTH above the two-column grid so the
       * "Lead Briefing" copy has room to breathe. Tucking it inside the
       * 1fr left column squeezed the bullets into a narrow strip — the
       * founder asked for the whole row.
       */}
      <div className="mb-6">
        <BriefingPanel
          ref={briefingPanelRef}
          briefing={briefing}
          isLoading={briefingMut.isPending}
          onGenerate={() => briefingMut.mutate()}
        />
      </div>

      <div className="grid min-[960px]:grid-cols-[1fr_320px] gap-6">
        {/*
         * `min-w-0` is the fix for a classic CSS Grid gotcha that broke
         * the entire layout the moment a payment link was sent: grid
         * items default to `min-width: auto`, which means they cannot
         * shrink below their content's intrinsic min-content size. The
         * timeline gains an SMS / email entry containing the long Stripe
         * checkout URL; even with `break-words` (which only wraps
         * visually), the URL's min-content is its full pixel width.
         * That blew the `1fr` column past its share of the grid and
         * pushed the 320px workflow aside off-screen on big monitors.
         * `min-w-0` lets the column shrink, and `break-words` on the
         * detail div then handles the visual wrap.
         */}
        <div className="space-y-6 min-w-0">
          {/* Lead at-a-glance hero — founder feedback 2026-05-17. The
              Contact card below still owns the full detail, but reps were
              asking for the four highest-value identifiers (avatar initial,
              email, website, city/state) at the very top so they don't
              need to scan for them between calls. Tap-to-copy on the email
              and tap-to-visit on the website; phone stays in the Contact
              card because its tap target lives in the CallButton there. */}
          <LeadHeroCard
            name={l.name}
            practice={l.practice}
            specialty={l.specialty}
            email={l.email ?? null}
            website={l.currentWebsite ?? null}
            city={l.city ?? null}
            state={l.state ?? null}
            onCopyEmail={() => {
              if (l.email) {
                try {
                  void navigator.clipboard.writeText(l.email);
                  setInfo("Email copied to clipboard.");
                } catch {
                  /* clipboard unavailable — no-op */
                }
              }
            }}
          />
          {/* Temperature picker — founder feedback 2026-05-17. Rep sets
              the granular state independent of lead_status; migration
              0028 seeded existing work-in-progress leads to 'hot'. */}
          <LeadTemperaturePicker
            leadId={id}
            current={(l as any).temperature ?? null}
            onError={onErr}
            onSuccess={() => onSuccess("Temperature updated.")}
          />
          {/* 2026-05-20 — Badge "Avis d'aperçu" sur les 17 leads avec
              reviews génériques. Le portail affiche déjà une bannière au
              prospect; ce badge prévient la REP pour qu'elle ne pitche
              pas "voici vos vrais avis Google". */}
          {SAMPLE_REVIEW_LEAD_IDS_2026_05_20.has(id) && (
            <div
              className="mb-3 rounded-lg border border-sky-500/40 bg-sky-50/60 dark:bg-sky-950/20 px-4 py-2.5 text-xs text-sky-900 dark:text-sky-200 flex items-start gap-2"
              data-testid="sample-reviews-badge"
            >
              <Sparkles size={14} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">Avis d'aperçu</span> — ce portail
                affiche 3 avis génériques (Google non encore connecté). Le
                prospect voit la bannière « Aperçu — vos vrais avis Google
                apparaîtront ici une fois votre fiche connectée. » Ne lui dites
                pas qu'il s'agit de vrais avis.
              </div>
            </div>
          )}
          {/* 2026-05-21 — Sprint 2 streamline: post-launch change requests
              from the client. Silent when none exist. */}
          <ChangeRequestsPanel leadId={id} onError={onErr} />
          <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
            <h2 className="font-serif text-lg mb-3">Contact</h2>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Phone</dt>
              <dd>
                {l.phone ? (
                  <CallButton
                    phone={l.phone}
                    onCopied={() => setInfo("Phone number copied to clipboard.")}
                  />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{l.email ?? "—"}</dd>
              <dt className="text-muted-foreground">Current site</dt>
              <dd className="truncate">
                {l.currentWebsite ? (
                  <a
                    href={l.currentWebsite}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    {l.currentWebsite}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
              <dt className="text-muted-foreground">Profile</dt>
              <dd className="whitespace-pre-wrap">{l.profileBlurb ?? "—"}</dd>
            </dl>
          </div>

          {/* Rep notes — append-only timestamped feed (#229, 2026-05-11).
              Each "Add note" submit creates its own row so the rep can
              scroll back through every conversation, follow-up, and
              detail in chronological order. No edit/delete: a typo gets
              a new note, not a rewrite. The first non-empty note also
              promotes a `claimed` lead to `nurturing` so the Nurturing
              filter remains the rep's working list. */}
          <RepNotesPanel
            leadId={id}
            enrichmentNotes={l.notes ?? ""}
            onError={onErr}
            onSuccess={() => onSuccess("Note added")}
          />

          {/* RepAttachmentsPanel — founder feedback 2026-05-17: 'Wasn't
              the sales rep supposed to able to upload files, images, text
              to the admin via the lead's page?'. This phase ships the URL
              variant (paste a Drive/Dropbox/Imgur share link with a caption
              — most rep evidence is already hosted somewhere). File-upload
              comes in the next iteration; the API endpoint is the same
              addRepNote path so admin tooling already sees every attachment
              via the existing notes feed, prefixed with [ATTACHMENT] so it
              filters out of the prose noise. */}
          <RepAttachmentsPanel
            leadId={id}
            onError={onErr}
            onSuccess={() => onSuccess("Attachment shared with admin.")}
          />

          <PortalSnapshot leadId={id} />

          {/*
           * The "Customer portal" panel previously rendered here was moved
           * to the admin dashboard (`/admin/leads/:id`) on the user's
           * request — admins oversee every lead and wanted a single place
           * to inspect portal URL, opens, and enrichment without claiming
           * the lead. The lead-portal data fetched in `lead-portal` query
           * higher up in this component is still used by `PortalSnapshot`
           * below to render the prospect's chosen template/colors/addons.
           */}
          <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
            <CallTimelineList calls={lead.data?.calls ?? []} />
            <h2 className="font-serif text-lg mb-3">Timeline</h2>
            {events.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No activity yet — start by sending a preview link.
              </div>
            ) : (
              <ol className="space-y-4">
                {events.map((e, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-muted grid place-items-center text-muted-foreground">
                      <e.icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{e.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDateTime(e.time)}
                      </div>
                      {e.paymentMeta ? (
                        <PaymentLinkEventDetail
                          meta={e.paymentMeta.meta}
                          fallback={e.paymentMeta.fallback}
                        />
                      ) : (
                        e.detail && (
                          <div className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap break-words">
                            {e.detail}
                          </div>
                        )
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 self-start">
          <WorkflowStepList
            briefing={briefing}
            briefingPending={briefingMut.isPending}
            onBriefing={() => briefingMut.mutate()}
            calls={lead.data.calls ?? []}
            callDisabledReason={callDisabledReason}
            onCall={() => setModal("call")}
            portal={portal.data ?? null}
            enrichPending={enrich.isPending || resetPreview.isPending}
            onEnrichRetry={() => enrich.mutate()}
            previewReady={previewReady}
            onDownloadVideo={handleDownloadPreviewVideo}
            downloadingVideo={downloadingVideo}
            onDownloadPdf={handleDownloadPreviewPdf}
            downloadingPdf={downloadingPdf}
            onOpenPreview={() => {
              // Two-click flow:
              //   - Not ready yet → kick off a FULL preview reset in the
              //     background (founder fix #228 — the prior implementation
              //     ran enrichment only, which preserved the previous
              //     template + palette + hero photo + copy overrides so a
              //     second attempt rendered the stale version. Reset wipes
              //     the portal back to the specialty default, mints a
              //     fresh token, deletes cached enrichment rows, and then
              //     re-runs enrichment so the rep gets a guaranteed clean
              //     slate every time she clicks Prepare preview).
              //   - Already ready → open the prospect portal in a NEW
              //     tab so the rep can review the live preview side-by-
              //     side with the lead detail page.
              setError(null);
              if (!previewReady) {
                if (!resetPreview.isPending && !enrich.isPending) {
                  resetPreview.mutate();
                }
                return;
              }
              const current =
                qc.getQueryData<typeof portal.data>(["lead-portal", id]) ??
                portal.data;
              const rawUrl = current?.shortUrl ?? current?.url;
              // 2026-05-14 audit fix #4: tag rep-side opens so they don't
              // pollute the prospect openCount / lastOpenedAt metrics.
              const url = rawUrl
                ? rawUrl + (rawUrl.includes("?") ? "&" : "?") + "internal=1"
                : rawUrl;
              if (url) {
                // BATCH 1.2: preview is served off the marketing apex,
                // where ash_sess cookie isn't visible. Fetch a short-
                // lived rep_token and append it so the apex SPA can
                // forward as X-Rep-Auth and the api recognises the rep.
                // TODO: drop once api + site + rep share a single
                // apex cookie scope.
                (async () => {
                  let finalUrl = url;
                  try {
                    const r = await fetch("/api/auth/rep-token", {
                      credentials: "include",
                    });
                    if (r.ok) {
                      const j = (await r.json()) as { token?: string };
                      if (j?.token) {
                        finalUrl +=
                          (url.includes("?") ? "&" : "?") +
                          "rep_token=" +
                          encodeURIComponent(j.token);
                      }
                    }
                  } catch {
                    // ignore — fall through with the original URL
                  }
                  window.open(finalUrl, "_blank", "noopener,noreferrer");
                })();
              }
            }}
            onSendPreview={() => setModal("preview")}
            onPayment={() => setModal("payment")}
            linkEvents={lead.data.linkEvents ?? []}
            // Compute the #208 cue inline from data we already have on
            // the page. Same predicate the api-server uses to decorate
            // /dashboard/leads/mine, so the leads-list badge and this
            // callout never disagree. `hasRecentCall` walks the calls
            // array (already loaded for the call-history panel) for any
            // row created within the threshold window — `createdAt` not
            // `startedAt` because freshly-queued outbound calls leave
            // `startedAt` null until the bridge connects, but the rep
            // has already attempted the follow-up so the cue should
            // clear immediately.
            needsFollowUpCall={(() => {
              const now = new Date();
              const hasRecentCall = (lead.data.calls ?? []).some((c) =>
                isRecentFollowUpCall(c.createdAt, now),
              );
              return needsFollowUpCall({
                status: l.status,
                inviteSentAt: portal.data?.inviteSentAt ?? null,
                openCount: portal.data?.openCount ?? 0,
                hasRecentCall,
                now,
              });
            })()}
            // Strip honorifics ("Dr.") and use the first whitespace-separated
            // token so the callout reads "Give Sarah a quick call" rather
            // than "Give Dr. a quick call". Falls back to null when the
            // resulting token is empty so the copy degrades to a generic
            // pronoun.
            leadFirstName={(() => {
              const stripped = l.name
                .replace(/^(?:dr|mr|mrs|ms|mx|prof)\.?\s+/i, "")
                .trim();
              const first = stripped.split(/\s+/)[0]?.replace(/[,.]+$/, "");
              return first && first.length > 0 ? first : null;
            })()}
          />

          <div className="space-y-2 pt-4 border-t border-border">
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground px-1">
              Other actions
            </h3>
            {/* "Recommended domains" action removed per founder request
                on 2026-05-05 — the picker was sales-team noise that the
                self-serve flow handles automatically. Re-attaching a
                domain to a lead is still possible via the customize-site
                flow inside the portal itself. The chosen-domain badge
                (when present) now surfaces inside PortalSnapshot below
                rather than as a clickable action here. */}
            {l.selfServeMeta?.chosenDomain ? (
              <div className="rounded-md border border-input bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <Globe className="inline w-3.5 h-3.5 mr-1.5 align-text-bottom" />
                Domain on file:{" "}
                <span className="font-medium text-foreground">
                  {l.selfServeMeta.chosenDomain}
                </span>
              </div>
            ) : null}
            {/* Founder feedback 2026-05-19: 'remove the booking + telehealth'.
                The Calendly + Doxy URLs are still managed via API for the
                portal BookingWidget + DoxyBridge primitives, but the inline
                form has been retired from the rep lead-detail panel. */}
            {/* Sprint 1 (2026-05-22) — primary new action. The rep
                signals to the founder that she wants a hand-crafted
                portal for this lead. Disabled while a request is
                already pending so the founder's dashboard doesn't get
                spammed with duplicates. */}
            <ActionButton
              icon={Sparkles}
              label={
                pendingPortalRequest
                  ? "Portail demandé"
                  : "Demander un portail"
              }
              subtitle={
                pendingPortalRequest
                  ? `En cours de préparation par Ashford depuis ${fmtDateTime(pendingPortalRequest.createdAt)}.`
                  : "Demander à Ashford de préparer un portail personnalisé pour ce prospect."
              }
              tone={pendingPortalRequest ? undefined : "primary"}
              onClick={() => setModal("portal_request")}
              disabled={Boolean(pendingPortalRequest)}
            />
            <ActionButton
              icon={MessageSquare}
              label="Send a one-off SMS"
              subtitle={
                smsDisabledReason ??
                (dialerPerRepOauth && dialerRepConnected
                  ? "Sends from your Dialpad number — replies land in your Dialpad inbox."
                  : "Temporarily unavailable — pending carrier verification.")
              }
              onClick={() => setModal("sms")}
              // Enabled once the rep has connected her Dialpad seat
              // (task #226). Without per-rep OAuth, TextBelt's 10DLC
              // brand isn't verified yet so the action stays disabled.
              disabled={
                Boolean(smsDisabledReason) ||
                !(dialerPerRepOauth && dialerRepConnected)
              }
            />
            <ActionButton
              icon={Mail}
              label="Send a one-off email"
              subtitle={
                l.email
                  ? "Quick email — no preview link attached."
                  : "No email on file for this lead."
              }
              onClick={() => setModal("email")}
              disabled={!l.email}
            />
            <ActionButton
              icon={CalendarClock}
              label="Schedule callback"
              subtitle="Book a follow-up. Optional recap message."
              onClick={() => setModal("callback")}
            />
            <ActionButton
              icon={CheckCircle2}
              label="Mark won"
              subtitle="They paid. Triggers your $149 closing bonus."
              tone="primary"
              onClick={() => setModal("won")}
            />
            <ActionButton
              icon={Snowflake}
              label="Mark as cold"
              subtitle="Park for later. Stays yours; come back when ready."
              onClick={() => setModal("cold")}
            />
            <ActionButton
              icon={XCircle}
              label="Disqualify"
              subtitle="Removes from your queue. Pick a reason."
              tone="destructive"
              onClick={() => setModal("disqualify")}
            />
          </div>

        </aside>
      </div>

      {modal === "preview" && (
        <PreviewModal
          leadId={id}
          defaultPhone={l.phone}
          defaultEmail={l.email}
          onClose={() => setModal(null)}
          onDone={(msg) => onSuccess(msg)}
          onError={onErr}
        />
      )}
      {modal === "portal_request" && (
        <PortalRequestModal
          leadId={id}
          leadName={l.name}
          onClose={() => setModal(null)}
          onDone={(msg) => onSuccess(msg)}
          onError={onErr}
        />
      )}
      {modal === "payment" && (
        <PaymentLinkModal
          leadId={id}
          defaultPhone={l.phone}
          defaultEmail={l.email}
          practice={l.practice}
          onClose={() => setModal(null)}
          onDone={(msg) => onSuccess(msg)}
          onError={onErr}
        />
      )}
      {modal === "sms" && (
        <SmsModal
          leadId={id}
          defaultBody={`Hi ${l.name.split(" ")[0]}, this is from Ashford Creative — quick question about your practice's website.`}
          onClose={() => setModal(null)}
          onDone={(msg) => onSuccess(msg)}
          onError={onErr}
        />
      )}
      {modal === "email" && l.email && (
        <EmailModal
          leadId={id}
          to={l.email}
          defaultSubject={`Quick idea for ${l.practice}`}
          defaultBody={`Hi ${l.name.split(" ")[0]},\n\nI put together a quick concept for ${l.practice}. Want me to send it over?\n\n— Ashford Creative`}
          onClose={() => setModal(null)}
          onDone={(msg) => onSuccess(msg)}
          onError={onErr}
        />
      )}
      {modal === "callback" && (
        <CallbackModal
          leadId={id}
          onClose={() => setModal(null)}
          onDone={(msg) => onSuccess(msg)}
          onError={onErr}
        />
      )}
      {modal === "disqualify" && (
        <DisqualifyModal
          leadId={id}
          onClose={() => setModal(null)}
          onDone={(msg) => {
            onSuccess(msg);
            navigate("/my-leads");
          }}
          onError={onErr}
        />
      )}
      {modal === "won" && (
        <ConfirmWonModal
          leadId={id}
          onClose={() => setModal(null)}
          onDone={(msg) => onSuccess(msg)}
          onError={onErr}
        />
      )}
      {modal === "cold" && (
        <ConfirmColdModal
          leadId={id}
          onClose={() => setModal(null)}
          onDone={(msg) => {
            onSuccess(msg);
            navigate("/my-leads/cold");
          }}
          onError={onErr}
        />
      )}
      {modal === "call" && (
        <CallModal
          leadId={id}
          practiceName={l.practice}
          defaultPhone={l.phone}
          onClose={() => setModal(null)}
          onError={onErr}
        />
      )}
      {/* === Mobile sticky action bar ============================================
          Reps work this page mostly from a phone in the field. The sidebar
          aside (the desktop action surface) only becomes sticky at `lg`, so
          on tablet/phone widths the rep had to scroll back up to fire Call
          / SMS / Note. This bar pins those three actions to the bottom of
          the viewport below `lg`, mirrors the same handlers + disabled
          reasons the sidebar uses (so behavior never drifts), and respects
          the iOS bottom safe-area inset so the buttons don't sit under the
          home indicator. SMS is wired but stays disabled for parity with
          the sidebar — flipping the carrier-verification flag in one place
          (the sidebar ActionButton above) is enough to also enable it here
          once the change ships. */}
      <div
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        role="toolbar"
        aria-label="Lead quick actions"
      >
        <div className="grid grid-cols-3 gap-1 px-2 py-2">
          <button
            type="button"
            onClick={() => setModal("call")}
            disabled={Boolean(callDisabledReason)}
            title={callDisabledReason ?? "Click-to-call. Recorded + auto-summarized."}
            className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-md text-accent hover:bg-accent/10 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
          >
            <Phone size={18} />
            <span className="text-[11px] font-medium">Call</span>
          </button>
          <button
            type="button"
            onClick={() => setModal("sms")}
            disabled={
              Boolean(smsDisabledReason) ||
              !(dialerPerRepOauth && dialerRepConnected)
            }
            title={
              smsDisabledReason ??
              (dialerPerRepOauth && dialerRepConnected
                ? "Send a one-off SMS from your Dialpad number."
                : "Temporarily unavailable — pending carrier verification.")
            }
            className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-md text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
          >
            <MessageSquare size={18} />
            <span className="text-[11px] font-medium">SMS</span>
          </button>
          <button
            type="button"
            onClick={() => setModal("callback")}
            title="Schedule a follow-up callback. Optional recap note."
            className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-md text-foreground hover:bg-muted transition-colors"
          >
            <CalendarClock size={18} />
            <span className="text-[11px] font-medium">Note</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rep notes panel — timestamped journal (#229, 2026-05-11; edit added #231,
// 2026-05-14).
//
// Reps asked for timestamped entries instead of one ever-edited blob so
// they can scroll back through every conversation, follow-up, and detail
// over time. #231 opened a controlled edit path: a rep can fix a typo or
// add context on their OWN notes, but the original body is preserved on
// the row (`originalBody`) and a "modified" tag in the UI shows the
// pre-edit text on hover — so the audit trail stays intact.
//
// localStorage holds only the *draft* of the new entry (cleared on
// successful submit). Entries that have been posted live on the server.
// ---------------------------------------------------------------------------

// 2026-05-14: @Ashford mention rendering. Highlights every occurrence
// of @Ashford (case-insensitive, word boundary — same regex used by the
// API in addLeadRepNote) inside a note body. Gives the rep a visual
// confirmation that the tag was registered on submit, and lets them see
// at a glance where the owner was pinged on past notes.
const MENTION_RE = /@Ashford\b/gi;
function hasAshfordMention(text: string): boolean {
  // /i but no /g so .test() is stateless. Same word-boundary semantics
  // as the API-side regex in addLeadRepNote.
  return /@Ashford\b/i.test(text);
}
function MentionText({ text }: { text: string }) {
  const out: Array<{ kind: "text" | "mention"; value: string }> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  // Reset regex state — gi flags require it for repeat calls.
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(text)) !== null) {
    if (m.index > last) {
      out.push({ kind: "text", value: text.slice(last, m.index) });
    }
    out.push({ kind: "mention", value: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    out.push({ kind: "text", value: text.slice(last) });
  }
  return (
    <>
      {out.map((p, i) =>
        p.kind === "mention" ? (
          <strong
            key={i}
            data-testid="rep-note-mention"
            className="font-bold text-blue-600"
          >
            {p.value}
          </strong>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </>
  );
}

function RepNotesPanel({
  leadId,
  enrichmentNotes,
  onError,
  onSuccess,
}: {
  leadId: number;
  enrichmentNotes?: string;
  onError: (err: unknown) => void;
  onSuccess?: () => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const currentRepId = user?.id ?? null;
  const draftKey = `ashford-rep-notes-draft-${leadId}`;
  const [draft, setDraft] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(draftKey) ?? "";
    } catch {
      return "";
    }
  });
  // #231 — track which note (if any) is being edited inline. `editingId`
  // is the row id; `editDraft` is its working body. Only one note can be
  // open for edit at a time to keep the UI honest about save state.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");

  // Reset draft when the lead changes. Each lead has its own
  // localStorage slot so a half-typed note can't leak between leads.
  const mountedLeadIdRef = useRef(leadId);
  useEffect(() => {
    if (mountedLeadIdRef.current === leadId) return;
    mountedLeadIdRef.current = leadId;
    try {
      setDraft(window.localStorage.getItem(`ashford-rep-notes-draft-${leadId}`) ?? "");
    } catch {
      setDraft("");
    }
  }, [leadId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(draftKey, draft);
    } catch {
      /* storage disabled — degrade silently */
    }
  }, [draft, draftKey]);

  const notesQuery = useQuery({
    queryKey: ["lead-rep-notes", leadId],
    queryFn: () => api.listRepNotes(leadId),
  });

  const addNote = useMutation({
    mutationFn: (body: string) => api.addRepNote(leadId, body),
    onSuccess: () => {
      setDraft("");
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      qc.invalidateQueries({ queryKey: ["lead-rep-notes", leadId] });
      // Lead status may have auto-promoted claimed → nurturing on the
      // first non-empty note; refresh the lead so the workflow chips and
      // filter buckets reflect that.
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      onSuccess?.();
    },
    onError,
  });

  // #231 — edit an existing own-note. Ownership is enforced server-side;
  // we still gate the pencil button on `authorRepId === currentRepId` so
  // the affordance never appears on someone else's row.
  const editNote = useMutation({
    mutationFn: ({ noteId, body }: { noteId: number; body: string }) =>
      api.editRepNote(leadId, noteId, body),
    onSuccess: () => {
      setEditingId(null);
      setEditDraft("");
      qc.invalidateQueries({ queryKey: ["lead-rep-notes", leadId] });
    },
    onError,
  });

  const startEdit = (noteId: number, body: string) => {
    setEditingId(noteId);
    setEditDraft(body);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };
  const submitEdit = () => {
    if (editingId == null) return;
    const trimmed = editDraft.trim();
    if (!trimmed || editNote.isPending) return;
    editNote.mutate({ noteId: editingId, body: trimmed });
  };

  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed || addNote.isPending) return;
    addNote.mutate(trimmed);
  };

  const entries = notesQuery.data?.notes ?? [];

  return (
    <div
      data-testid="rep-notes-panel"
      className="bg-card border border-card-border rounded-xl p-6 shadow-sm"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-serif text-lg">Rep notes</h2>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {entries.length === 0
            ? "No notes yet"
            : `${entries.length} ${entries.length === 1 ? "note" : "notes"}`}
        </span>
      </div>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="What you learned on the call, next steps, blockers, personal context — anything that helps with the next follow-up. Type @Ashford to ping the owner."
        rows={4}
        maxLength={4000}
        className="w-full text-sm leading-relaxed rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
      />
      {/* 2026-05-14: live @Ashford confirmation. Shown the moment the
          rep types @Ashford so they know the tag will register and the
          owner will be notified. Mirrors what the published note will
          look like (bold blue). */}
      {hasAshfordMention(draft) && (
        <div
          data-testid="rep-note-mention-preview"
          className="mt-2 rounded-md border border-blue-500/40 bg-blue-50 px-3 py-2 text-[12px] text-blue-900"
        >
          You tagged <strong className="font-bold text-blue-600">@Ashford</strong>{" "}
          — the owner will be notified the moment you click{" "}
          <span className="font-medium">Add note</span>.
        </div>
      )}
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {draft.length} / 4000 — saved as a separate timestamped entry
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={draft.trim().length === 0 || addNote.isPending}
          className="rounded-md bg-accent text-accent-foreground text-sm font-medium px-3 py-1.5 disabled:opacity-50"
        >
          {addNote.isPending ? "Adding…" : "Add note"}
        </button>
      </div>

      {entries.length > 0 && (
        <ol className="mt-4 space-y-3">
          {entries.map((n) => {
            const isOwn =
              currentRepId != null && n.authorRepId === currentRepId;
            const isEditing = editingId === n.id;
            const wasEdited = !!n.editedAt;
            return (
              <li
                key={n.id}
                data-testid={`rep-note-row-${n.id}`}
                className="rounded-md border border-input bg-background/60 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="font-medium">
                    {n.authorName ?? "Unknown rep"}
                  </span>
                  <div className="flex items-center gap-2">
                    {wasEdited && (
                      <span
                        data-testid={`rep-note-modified-${n.id}`}
                        title={
                          n.originalBody
                            ? `Original (before edit):\n\n${n.originalBody}`
                            : "Edited"
                        }
                        className="italic text-muted-foreground/80"
                      >
                        modified
                      </span>
                    )}
                    <span>{fmtDateTime(n.createdAt)}</span>
                    {isOwn && !isEditing && (
                      <button
                        type="button"
                        data-testid={`rep-note-edit-${n.id}`}
                        onClick={() => startEdit(n.id, n.body)}
                        title="Edit this note"
                        className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                  </div>
                </div>
                {isEditing ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={3}
                      maxLength={4000}
                      data-testid={`rep-note-edit-textarea-${n.id}`}
                      className="w-full text-sm leading-relaxed rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={editNote.isPending}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <XIcon size={12} /> Cancel
                      </button>
                      <button
                        type="button"
                        onClick={submitEdit}
                        data-testid={`rep-note-save-${n.id}`}
                        disabled={
                          editDraft.trim().length === 0 || editNote.isPending
                        }
                        className="inline-flex items-center gap-1 rounded-md bg-accent text-accent-foreground text-xs font-medium px-2 py-1 disabled:opacity-50"
                      >
                        <Check size={12} />
                        {editNote.isPending ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-sm text-foreground whitespace-pre-wrap break-words">
                    <MentionText text={n.body} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {enrichmentNotes && enrichmentNotes.trim().length > 0 && (
        // Read-only "enrichment summary" pulled from the imported PT
        // profile (Qualifications/Approach/PsychologyToday URL). Lives
        // here so the rep sees the source material while writing notes,
        // without the two ever overlapping. (#224)
        <details className="mt-3 rounded-md border border-input bg-muted/30">
          <summary className="cursor-pointer px-3 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground">
            Imported profile (Psychology Today) — read only
          </summary>
          <pre className="px-3 pb-3 pt-1 text-[12px] leading-relaxed text-foreground whitespace-pre-wrap font-sans">
            {enrichmentNotes}
          </pre>
        </details>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Briefing panel — its own card above the customer portal so the briefing
// is visible the moment it's generated. Empty state nudges the rep toward
// step 1 of the workflow sidebar.
// ---------------------------------------------------------------------------

function bulletizeSummary(raw: string): string[] {
  if (!raw) return [];
  const stripMarker = (s: string) =>
    s.replace(/^\s*(?:[-*•·–—]|\d+[.)])\s+/, "").trim();
  const lines = raw
    .split(/\r?\n+/)
    .map(stripMarker)
    .filter(Boolean);
  if (lines.length > 1) return lines;
  const single = lines[0] ?? raw.trim();
  if (!single) return [];
  const sentences = single
    .split(/(?<=[.!?])\s+(?=[A-Z“"'(])/)
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences.length > 0 ? sentences : [single];
}

const BriefingPanel = forwardRef<
  HTMLDivElement,
  {
    briefing: Briefing | null;
    isLoading: boolean;
    onGenerate: () => void;
  }
>(function BriefingPanel({ briefing, isLoading, onGenerate }, ref) {
  return (
    <div
      ref={ref}
      data-testid="briefing-panel"
      className="bg-card border border-card-border rounded-xl p-6 shadow-sm"
    >
      <div className="flex items-center justify-between mb-3 gap-3">
        <h2 className="font-serif text-lg inline-flex items-center gap-2">
          <Sparkles size={16} className="text-accent" />
          Pre-call briefing
        </h2>
        {briefing ? (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {briefing.sourceLabel}
          </span>
        ) : (
          <button
            type="button"
            onClick={onGenerate}
            disabled={isLoading}
            className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-60"
          >
            {isLoading ? "Generating…" : "Generate"}
          </button>
        )}
      </div>

      {isLoading && !briefing ? (
        <div className="text-sm text-muted-foreground">
          Pulling sources, summarizing, and surfacing red flags…
        </div>
      ) : briefing ? (
        <>
          {(() => {
            const summaryBullets = bulletizeSummary(briefing.summary);
            return summaryBullets.length > 0 ? (
              <div className="mb-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Summary
                </div>
                <ul className="list-disc list-inside text-sm space-y-0.5">
                  {summaryBullets.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null;
          })()}
          {/* Talking points block removed per founder feedback 2026-05-08:
              briefing should be summary + red flags only — the rep already
              knows how to run the call, the long bullet list was noise. */}
          {briefing.redFlags.length > 0 ? (
            <div className="mb-3">
              <div className="text-xs uppercase tracking-wide text-destructive mb-1">
                Red flags
              </div>
              <ul className="list-disc list-inside text-sm space-y-0.5 text-destructive/90">
                {briefing.redFlags.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onGenerate}
            disabled={isLoading}
            className="text-xs text-muted-foreground hover:text-foreground underline disabled:opacity-60"
          >
            {isLoading ? "Refreshing…" : "Regenerate briefing"}
          </button>
        </>
      ) : (
        <div className="text-sm text-muted-foreground">
          Click <strong className="text-foreground">Generate briefing</strong>{" "}
          (step 1 in the workflow on the right) to get a pre-call summary
          and red flags pulled from every connected source.
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Workflow sidebar — five ordered steps, each with a status badge derived
// from existing lead/portal data so the rep always knows what's next.
// ---------------------------------------------------------------------------

type LeadCallTimeline = NonNullable<
  Awaited<ReturnType<typeof api.leadTimeline>>
>["calls"];
type PortalDto = Awaited<ReturnType<typeof api.getLeadPortal>>;
type LinkEventDto = Awaited<
  ReturnType<typeof api.leadTimeline>
>["linkEvents"][number];

type StepStatus = {
  tone: "neutral" | "done" | "active";
  label: string;
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function WorkflowStepList({
  briefing,
  briefingPending,
  onBriefing,
  calls,
  callDisabledReason,
  onCall,
  portal,
  enrichPending,
  previewReady,
  onEnrichRetry,
  onOpenPreview,
  onDownloadVideo,
  downloadingVideo,
  onDownloadPdf,
  downloadingPdf,
  onSendPreview,
  onPayment,
  linkEvents,
  needsFollowUpCall: showFollowUpCue,
  leadFirstName,
}: {
  briefing: Briefing | null;
  briefingPending: boolean;
  onBriefing: () => void;
  calls: LeadCallTimeline;
  callDisabledReason: string | null;
  onCall: () => void;
  portal: PortalDto | null;
  enrichPending: boolean;
  /** True once the in-session enrichment has finished and the portal
   *  query has refetched, so the next click on step 3 can navigate
   *  directly to the portal instead of triggering enrichment again. */
  previewReady: boolean;
  onEnrichRetry: () => void;
  onOpenPreview: () => void;
  onDownloadVideo: () => void;
  downloadingVideo: boolean;
  onDownloadPdf: () => void;
  downloadingPdf: boolean;
  onSendPreview: () => void;
  onPayment: () => void;
  linkEvents: LinkEventDto[];
  // True when the #208 predicate fires for this lead — the parent owns
  // the predicate (it has the lead status, portal, and call timeline) so
  // this list is purely presentational and stays trivial to test.
  needsFollowUpCall: boolean;
  // Lead's first name for the personalized callout copy ("Give Sarah a
  // quick call …"). Falls back to a generic phrasing when missing so we
  // never render an empty pronoun.
  leadFirstName: string | null;
}) {
  const briefingStatus: StepStatus = briefing
    ? { tone: "done", label: "Generated" }
    : briefingPending
      ? { tone: "active", label: "Generating…" }
      : { tone: "neutral", label: "To do" };

  const lastCall = calls?.[0]?.startedAt ?? null;
  const callStatus: StepStatus = lastCall
    ? { tone: "done", label: `Called ${relativeTime(lastCall)}` }
    : { tone: "neutral", label: "Not called yet" };

  // Step 3 = "the preview is prepared". We previously surfaced a
  // "Viewed Nx by prospect" label here, but the open-count includes
  // internal/preview opens (Candice clicking through, the enrichment
  // worker hitting the page) that aren't real prospect engagement —
  // showing it as if the prospect had viewed it was misleading. So we
  // only show preparing / ready / idle, never an open-count badge.
  // Default to "Not prepared" when portal data is still loading (LOT 7.9).
  // The previous fallback "Loading…" would persist if the lead was loaded
  // but the portal query was still pending — and stale "LOADING…" looked
  // identical to a broken state. "Not prepared" is the safe default; once
  // portal data arrives the label flips to the right value.
  const previewStatus: StepStatus = enrichPending
    ? { tone: "active", label: "Preparing…" }
    : previewReady
      ? { tone: "done", label: "Ready" }
      : { tone: "neutral", label: "Not prepared" };

  const inviteStatus: StepStatus = portal?.inviteSentAt
    ? {
        tone: "done",
        label: `Sent ${relativeTime(portal.inviteSentAt)}`,
      }
    : { tone: "neutral", label: "Not sent" };

  const lastPaymentLink = linkEvents.find(
    (e) => e.kind === "payment_link_sent",
  );
  const paymentStatus: StepStatus = lastPaymentLink
    ? {
        tone: "done",
        label: `Sent ${relativeTime(lastPaymentLink.occurredAt)}`,
      }
    : { tone: "neutral", label: "Not sent" };

  // Google Places enrichment health hint, surfaced above step 1 so the
  // rep knows in advance whether this prospect's portal will show real
  // Google data or sample placeholders. Source-of-truth is the
  // `fieldSources` map on the portal payload, which records which
  // source actually contributed each visible field. We require Google
  // Places to have landed ALL THREE core identity fields
  // (formattedAddress, formattedPhone, rating) — the same predicate
  // the inline GoogleProfileSyncInline preview uses to decide whether
  // to show the "sample shown" notice. Anything weaker (e.g. gating
  // on the source's confidence score, on whether the source row
  // exists at all, or on any-one-of-three landed) lets the dashboard
  // say "synced" while the portal still shows sample placeholders for
  // a missing field, which is exactly the honesty mismatch task #207
  // is supposed to fix.
  const googleSynced = isGoogleInlineFullySynced(portal?.fieldSources ?? null);
  const googleFieldCount = portal
    ? Object.values(portal.fieldSources).filter((s) => s === "google_places")
        .length
    : 0;

  return (
    <div className="space-y-2">
      <div>
        <h2 className="font-serif text-lg">Sales workflow</h2>
        <p className="text-xs text-muted-foreground">
          Five steps. Top to bottom.
        </p>
      </div>

      {portal && googleSynced ? (
        <div
          data-testid="enrichment-status"
          className="rounded-md border px-3 py-2 text-xs flex items-center justify-between gap-2 border-green-600/30 bg-green-50/40 text-green-900 dark:bg-green-950/20 dark:text-green-200"
        >
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={12} />
            <span>{`Google Places synced · ${googleFieldCount} field${googleFieldCount === 1 ? "" : "s"}`}</span>
          </span>
        </div>
      ) : null}

      <WorkflowStep
        n={1}
        icon={Sparkles}
        label="Generate briefing"
        subtitle="Pre-call summary, talking points, red flags."
        status={briefingStatus}
        onClick={onBriefing}
        pending={briefingPending}
      />
      <WorkflowStep
        n={2}
        icon={ExternalLink}
        label={
          enrichPending
            ? "Preparing…"
            : previewReady
              ? "✓ Preview ready — open"
              : "Prepare preview"
        }
        subtitle={
          enrichPending
            ? "Fetching data — give it ~30 s, keep this tab open."
            : previewReady
              ? "Click to open the prospect portal (new tab)."
              : "Runs enrichment in the background. We'll ping you when it's ready."
        }
        status={previewStatus}
        onClick={onOpenPreview}
        pending={enrichPending}
        disabled={!portal || enrichPending}
      />
      {previewReady && portal ? (
        <div className="flex flex-col sm:flex-row gap-2 -mt-1">
          <button
            type="button"
            data-testid="download-preview-video"
            onClick={onDownloadVideo}
            disabled={downloadingVideo}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-input bg-background hover:bg-muted text-xs text-foreground/80 disabled:opacity-50 disabled:cursor-wait"
          >
            {downloadingVideo ? (
              <Loader2 size={13} className="animate-spin shrink-0" />
            ) : (
              <Film size={13} className="shrink-0" />
            )}
            <span className="font-medium">
              {downloadingVideo
                ? "Preparing video… (~30 s)"
                : "Download video"}
            </span>
          </button>
          <button
            type="button"
            data-testid="download-preview-pdf"
            onClick={onDownloadPdf}
            disabled={downloadingPdf}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-input bg-background hover:bg-muted text-xs text-foreground/80 disabled:opacity-50 disabled:cursor-wait"
          >
            {downloadingPdf ? (
              <Loader2 size={13} className="animate-spin shrink-0" />
            ) : (
              <FileDown size={13} className="shrink-0" />
            )}
            <span className="font-medium">
              {downloadingPdf
                ? "Preparing PDF…"
                : "Download PDF"}
            </span>
          </button>
        </div>
      ) : null}
      <WorkflowStep
        n={3}
        icon={Phone}
        label="Call the prospect"
        subtitle={
          callDisabledReason ?? "Click-to-call. Recorded + auto-summarized."
        }
        status={callStatus}
        onClick={onCall}
        disabled={Boolean(callDisabledReason)}
      />
      <WorkflowStep
        n={4}
        icon={Mail}
        label={portal?.inviteSentAt ? "Resend preview email" : "Send preview email"}
        subtitle="Personalized email with a link to their preview."
        status={inviteStatus}
        onClick={onSendPreview}
        primary
      />
      <WorkflowStep
        n={5}
        icon={MessageSquare}
        label="Send preview SMS"
        subtitle="Temporarily unavailable — pending carrier verification."
        status={{ tone: "neutral", label: "Disabled" }}
        onClick={() => {}}
        disabled
      />
      {showFollowUpCue && (
        <div
          data-testid="needs-followup-call-callout"
          className="rounded-lg border border-amber-500/50 bg-amber-50/60 dark:bg-amber-950/25 px-3 py-3"
        >
          <div className="flex items-start gap-3">
            <Phone className="text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" size={16} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Needs a follow-up call
              </div>
              <p className="text-xs text-amber-900/80 dark:text-amber-200/80 mt-0.5">
                {leadFirstName
                  ? `Preview email sent over 24 hours ago and ${leadFirstName} hasn't opened it. Give ${leadFirstName} a quick call before sending the payment link.`
                  : "Preview email sent over 24 hours ago and they haven't opened it. Give them a quick call before sending the payment link."}
              </p>
              <button
                type="button"
                onClick={onCall}
                disabled={Boolean(callDisabledReason)}
                title={callDisabledReason ?? undefined}
                data-testid="needs-followup-call-cta"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Phone size={12} />
                Call now
              </button>
            </div>
          </div>
        </div>
      )}
      <WorkflowStep
        n={5}
        icon={DollarSign}
        label={lastPaymentLink ? "Re-send payment link" : "Send payment link"}
        subtitle={
          lastPaymentLink
            ? "Generate a fresh checkout URL — or copy the last one from the timeline."
            : "Build the plan + add-ons, send Stripe checkout."
        }
        status={paymentStatus}
        onClick={onPayment}
      />
    </div>
  );
}

function WorkflowStep({
  n,
  icon: Icon,
  label,
  subtitle,
  status,
  onClick,
  pending,
  disabled,
  primary,
}: {
  n: number;
  icon: typeof Sparkles;
  label: string;
  subtitle: string;
  status: StepStatus;
  onClick: () => void;
  pending?: boolean;
  disabled?: boolean;
  primary?: boolean;
}) {
  const stepDone = status.tone === "done";
  return (
    <button
      type="button"
      data-testid={`workflow-step-${n}`}
      onClick={onClick}
      disabled={disabled || pending}
      className={`w-full text-left rounded-lg border px-3 py-3 transition disabled:opacity-50 disabled:cursor-not-allowed ${
        primary
          ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
          : stepDone
            ? "border-green-600/30 bg-green-50/30 dark:bg-green-950/20 hover:bg-green-50/60 dark:hover:bg-green-950/40"
            : "border-input bg-background hover:bg-muted"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 w-7 h-7 rounded-full grid place-items-center text-xs font-semibold ${
            stepDone
              ? "bg-green-600 text-white"
              : primary
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {stepDone ? <CheckCircle2 size={14} /> : n}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span
              className={`text-sm font-medium inline-flex items-center gap-1.5 ${
                primary ? "text-primary" : ""
              }`}
            >
              <Icon size={13} className={primary ? "text-primary" : ""} />
              {label}
            </span>
            <StepStatusPill status={status} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>
    </button>
  );
}

function StepStatusPill({ status }: { status: StepStatus }) {
  const cls =
    status.tone === "done"
      ? "border-green-600/30 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-200"
      : status.tone === "active"
        ? "border-accent/30 bg-accent/10 text-accent"
        : "border-muted-foreground/20 bg-muted/40 text-muted-foreground";
  return (
    <span
      className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${cls}`}
    >
      {status.label}
    </span>
  );
}

function PaymentLinkEventDetail({
  meta,
  fallback,
}: {
  meta: import("@rep/lib/api").PaymentLinkEventMetadata | null;
  fallback: string | null;
}) {
  const [copied, setCopied] = useState(false);
  if (!meta) {
    return fallback ? (
      <div className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap break-words">
        {fallback}
      </div>
    ) : null;
  }
  const dollars =
    typeof meta.monthlyTotalCents === "number"
      ? `$${(meta.monthlyTotalCents / 100).toFixed(2)}/mo`
      : null;
  const setup =
    typeof meta.setupCents === "number"
      ? meta.setupCents > 0
        ? `one-time $${(meta.setupCents / 100).toFixed(2)} setup`
        : "no setup fee"
      : null;
  const channels: string[] = [];
  if (meta.channels?.sms?.requested) {
    channels.push(`SMS ${meta.channels.sms.status}`);
  }
  if (meta.channels?.email?.requested) {
    channels.push(`Email ${meta.channels.email.status}`);
  }
  const url = meta.checkoutUrl;
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user can copy manually */
    }
  };
  return (
    <div className="mt-1.5 space-y-1.5">
      {(dollars || setup) && (
        <div className="text-sm text-foreground/80">
          {[dollars, setup].filter(Boolean).join(" · ")}
        </div>
      )}
      {meta.addonLabels && meta.addonLabels.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Add-ons: {meta.addonLabels.join(", ")}
        </div>
      )}
      {channels.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Sent via: {channels.join(" · ")}
        </div>
      )}
      {url && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-input bg-background text-xs hover:bg-muted"
          >
            <Copy size={12} />
            {copied ? "Copied" : "Copy URL"}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-input bg-background text-xs hover:bg-muted"
          >
            <ExternalLink size={12} />
            View checkout
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * Normalize an arbitrarily-formatted phone number to strict E.164, or return
 * `null` when the input cannot be safely coerced. DialPad's click-to-call
 * endpoint requires a leading `+` and a valid 8–15 digit subscriber number
 * (per the E.164 spec); shorter/longer values are silently rejected and the
 * browser tab opens with no call placed — exactly the failure mode the
 * `tel:` rewrite was meant to eliminate.
 *
 * Edge cases explicitly handled:
 *  - **Extensions** (`(512) 555-0142 x89`, `... ext. 89`): stripped before
 *    digit extraction. DialPad does not dial extensions; passing them
 *    appended to the main number produces an invalid 12+ digit US value.
 *  - **Empty / non-numeric**: returns null so the caller can disable the
 *    Call button rather than render a useless `https://dialpad.com/call?phone=+`
 *    link.
 *  - **US 10-digit and 11-digit-leading-1**: prefixed with `+1`.
 *  - **Already-prefixed international (`+44 ...`)**: leading `+` preserved.
 *  - **Bare international (no `+`)**: returns null — we cannot guess country
 *    code without risking a wrong-country dial.
 */
function toE164(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;

  // Strip extensions BEFORE digit extraction — `x89`, `ext 89`, `ext. 89`,
  // `extension 89` are all common in CRM exports.
  const noExt = trimmed.replace(/\s*(?:x|ext\.?|extension)\s*\d+\s*$/i, "");

  const hasPlus = noExt.startsWith("+");
  const digits = noExt.replace(/[^\d]/g, "");
  if (digits.length === 0) return null;

  let candidate: string;
  if (hasPlus) {
    candidate = `+${digits}`;
  } else if (digits.length === 10) {
    candidate = `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    candidate = `+${digits}`;
  } else {
    // Bare international or unrecognized US format — refuse rather than
    // misroute. The Copy button still works as a manual fallback.
    return null;
  }

  // Final E.164 length check: country code (1–3) + subscriber (≤14) ≤ 15
  // total digits per ITU-T E.164. Min 8 digits filters out obvious noise
  // like single area codes.
  const finalDigits = candidate.length - 1;
  if (finalDigits < 8 || finalDigits > 15) return null;
  return candidate;
}

/**
 * Click-to-call button that hands the lead's number to DialPad — Ashford's
 * voice provider. Replaces the prior `tel:` href, which opened whatever the
 * OS thought "phone calls" meant (FaceTime on macOS, the default dialer on
 * Android, sometimes nothing at all on desktop Chrome). The DialPad URL
 * resolves the same on both desktop (opens dialpad.com web app, places the
 * call from the rep's logged-in extension) and mobile (deeplinks into the
 * native DialPad app if installed, falls back to the web flow otherwise).
 *
 * We open in a new tab on desktop so the rep doesn't lose the lead detail
 * context they were just reading. On touch devices we navigate in the same
 * tab — the OS app-switcher handles the return trip.
 *
 * A secondary "Copy" action is kept for reps who want the number on their
 * personal phone, or for the rare case DialPad is down. The number text
 * itself remains selectable so manual copy still works.
 */
function CallButton({
  phone,
  onCopied,
}: {
  phone: string;
  onCopied: () => void;
}) {
  const [isTouch, setIsTouch] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(any-pointer: coarse)").matches ?? false;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(any-pointer: coarse)");
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    if (mq.addEventListener) {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, []);

  const e164 = toE164(phone);
  const dialpadHref = e164
    ? `https://dialpad.com/call?phone=${encodeURIComponent(e164)}`
    : null;

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(phone);
      onCopied();
    } catch {
      // Clipboard blocked (insecure context, denied permission). Surface a
      // best-effort fallback by selecting the phone text in the DOM so the
      // rep can copy manually with Cmd/Ctrl+C.
      const range = document.createRange();
      const node = e.currentTarget.parentElement?.querySelector("[data-phone-text]");
      if (node) {
        range.selectNodeContents(node);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span data-phone-text>{phone}</span>
      {dialpadHref ? (
        <a
          href={dialpadHref}
          target={isTouch ? undefined : "_blank"}
          rel={isTouch ? undefined : "noopener noreferrer"}
          aria-label={`Call ${phone} via DialPad`}
          title="Call via DialPad"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-accent/40 bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
        >
          <Phone size={12} />
          Call
        </a>
      ) : (
        <span
          aria-label={`Cannot call — phone number ${phone} is not in a recognized format`}
          title="Number not in dialable format — copy and dial manually"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-muted-foreground/30 bg-muted/40 text-muted-foreground text-xs font-medium cursor-not-allowed"
        >
          <Phone size={12} />
          Call
        </span>
      )}
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy phone number ${phone}`}
        title="Copy number"
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-accent/30 bg-transparent text-accent/80 text-xs font-medium hover:bg-accent/10 transition-colors"
      >
        Copy
      </button>
    </div>
  );
}

/**
 * "🔥 Hot" pill rendered in the page header for HOT_LEAD_WINDOW_MS (60 min)
 * after the most recent hot-lead notification fired on this lead's portal.
 * If `lastHotAlertAt` is null or older than the window, this renders nothing.
 *
 * Auto-clears via a one-shot timer so a rep who lingers on the page sees
 * the badge disappear at the right moment without needing to refetch.
 */
function HotLeadBadge({
  lastHotAlertAt,
}: {
  lastHotAlertAt: string | null;
}) {
  const initiallyHot = useMemo(() => {
    if (!lastHotAlertAt) return false;
    return Date.now() - new Date(lastHotAlertAt).getTime() < HOT_LEAD_WINDOW_MS;
  }, [lastHotAlertAt]);
  const [isHot, setIsHot] = useState(initiallyHot);

  useEffect(() => {
    if (!lastHotAlertAt) {
      setIsHot(false);
      return;
    }
    const ageMs = Date.now() - new Date(lastHotAlertAt).getTime();
    if (ageMs >= HOT_LEAD_WINDOW_MS) {
      setIsHot(false);
      return;
    }
    setIsHot(true);
    const remaining = HOT_LEAD_WINDOW_MS - ageMs;
    const t = setTimeout(() => setIsHot(false), remaining);
    return () => clearTimeout(t);
  }, [lastHotAlertAt]);

  if (!isHot) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-200"
      title="This prospect just reopened their preview — call now."
      data-testid="badge-hot-lead"
    >
      <Flame size={12} />
      Hot
    </span>
  );
}

function ActionButton({
  icon: Icon,
  label,
  subtitle,
  onClick,
  disabled,
  tone = "default",
}: {
  icon: typeof Mail;
  label: string;
  subtitle?: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "primary" | "destructive";
}) {
  const toneCls =
    tone === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
      : tone === "destructive"
        ? "bg-card text-destructive hover:bg-destructive/10 border-destructive/30"
        : "bg-card text-foreground hover:bg-muted border-card-border";
  const subtleCls =
    tone === "primary"
      ? "text-primary-foreground/80"
      : tone === "destructive"
        ? "text-destructive/70"
        : "text-muted-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-start gap-2 px-4 py-2.5 rounded-md border text-sm font-medium transition-colors disabled:opacity-50 text-left ${toneCls}`}
    >
      <Icon size={14} className="mt-0.5 shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block">{label}</span>
        {subtitle && (
          <span className={`block text-xs font-normal mt-0.5 ${subtleCls}`}>
            {subtitle}
          </span>
        )}
      </span>
    </button>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  const titleId = `modal-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div
      className="fixed inset-0 bg-black/50 z-40 grid place-items-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-card border border-card-border rounded-xl shadow-xl w-full max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={titleId} className="font-serif text-xl mb-4">
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}

function PreviewModal({
  leadId,
  defaultPhone,
  defaultEmail,
  onClose,
  onDone,
  onError,
}: {
  leadId: number;
  defaultPhone: string;
  defaultEmail: string | null;
  onClose: () => void;
  onDone: (m: string) => void;
  onError: (err: unknown) => void;
}) {
  // Three-state flow mirrors EmailModal:
  //   contact → preview → sent
  // - contact: pick channels + confirm phone/email + "Prepare preview"
  // - preview: rendered subject/body shown editable, rep clicks Send or Edit
  // - sent: confirmation with delivery statuses
  type Step = "contact" | "preview" | "sent";
  const [step, setStep] = useState<Step>("contact");

  // Template + pricing plan are chosen at the moment of sending the
  // preview email (2026-05-14 follow-up: moved out of the SNAPSHOT
  // panel so the rep makes both decisions in one place).
  type PlanKey = "boutique" | "boutique_pro" | "boutique_concierge";
  const PLAN_CHOICES: Array<{ key: PlanKey; label: string; priceLabel: string }> = [
    { key: "boutique", label: "Boutique", priceLabel: "$199/mo" },
    { key: "boutique_pro", label: "Boutique Pro", priceLabel: "$299/mo" },
    { key: "boutique_concierge", label: "Boutique Concierge", priceLabel: "$649/mo" },
  ];
  const portalQuery = useQuery({
    queryKey: ["lead-portal", leadId],
    queryFn: () => api.getLeadPortal(leadId),
    refetchOnWindowFocus: false,
  });
  const [template, setTemplate] = useState<string>("garden");
  const [plan, setPlan] = useState<PlanKey>("boutique");
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);
  useEffect(() => {
    if (defaultsLoaded || !portalQuery.data) return;
    setTemplate(portalQuery.data.selectedTemplate ?? "garden");
    const existingPlan = portalQuery.data.pricingPlan;
    if (
      existingPlan === "boutique" ||
      existingPlan === "boutique_pro" ||
      existingPlan === "boutique_concierge"
    ) {
      setPlan(existingPlan);
    }
    setDefaultsLoaded(true);
  }, [portalQuery.data, defaultsLoaded]);

  const [phone, setPhone] = useState(defaultPhone);
  const [email, setEmail] = useState(defaultEmail ?? "");
  // SMS path is gated off until the carrier finishes verifying the
  // outbound URL allow-list. Re-enable when TextBelt approves the
  // whitelist request — flip the default back to `true` and remove the
  // `disabled` attr on the SMS checkbox below.
  const [sendSmsCh, setSendSmsCh] = useState(false);
  const [sendEmailCh, setSendEmailCh] = useState(!!defaultEmail);

  // Preview-step state — populated by the draft API call.
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [smsBody, setSmsBody] = useState("");
  // Rendered defaults so we can detect edits and avoid shipping pointless
  // overrides to the send endpoint (which would force the plain-wrapper
  // HTML path instead of the styled day-1 drip).
  const [defaultSubject, setDefaultSubject] = useState("");
  const [defaultBody, setDefaultBody] = useState("");
  const [defaultSmsBody, setDefaultSmsBody] = useState("");

  const [sendError, setSendError] = useState<string | null>(null);
  const [sentResult, setSentResult] = useState<{
    smsStatus: string;
    emailStatus: string;
  } | null>(null);

  const trimmedPhone = phone.trim();
  const trimmedEmail = email.trim();

  const phoneOverride =
    trimmedPhone && trimmedPhone !== defaultPhone ? trimmedPhone : undefined;
  const emailOverride =
    (trimmedEmail || null) !== (defaultEmail ?? null)
      ? trimmedEmail
        ? trimmedEmail
        : null
      : undefined;

  const draftMutation = useMutation({
    mutationFn: async () => {
      await api.setLeadTemplate(leadId, template);
      await api.setLeadPricingPlan(leadId, plan);
      return api.draftPreviewLink(leadId, { phoneOverride, emailOverride });
    },
    onSuccess: (r) => {
      setSubject(r.subject);
      setBody(r.body);
      setSmsBody(r.smsBody);
      setDefaultSubject(r.subject);
      setDefaultBody(r.body);
      setDefaultSmsBody(r.smsBody);
      setSendError(null);
      setStep("preview");
    },
    onError,
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      api.generateLink(leadId, {
        channels: { sms: sendSmsCh, email: sendEmailCh },
        phoneOverride,
        emailOverride,
        subjectOverride:
          subject.trim() && subject !== defaultSubject ? subject : undefined,
        bodyOverride:
          body.trim() && body !== defaultBody ? body : undefined,
        smsBodyOverride:
          smsBody.trim() && smsBody !== defaultSmsBody ? smsBody : undefined,
      }),
    onSuccess: (r) => {
      setSentResult({ smsStatus: r.smsStatus, emailStatus: r.emailStatus });
      setSendError(null);
      setStep("sent");
    },
    onError: (err) => {
      setSendError(err instanceof Error ? err.message : "Send failed.");
    },
  });

  // Founder feedback 2026-05-17: 30s undo countdown before the email
  // actually fires. Click "Send" → starts a 30-second timer + count-down
  // display. Click "Undo" during that window aborts the send. After 30s
  // the timer self-clears and the real sendMutation runs.
  const [pendingSendTimer, setPendingSendTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [pendingCountdown, setPendingCountdown] = useState<number>(0);
  const isPendingSend = pendingSendTimer !== null;
  useEffect(() => {
    if (!isPendingSend) return;
    const tick = setInterval(() => {
      setPendingCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(tick);
  }, [isPendingSend]);
  const startSendWithUndo = () => {
    if (isPendingSend) return;
    setSendError(null);
    setPendingCountdown(30);
    const t = setTimeout(() => {
      setPendingSendTimer(null);
      setPendingCountdown(0);
      sendMutation.mutate();
    }, 30_000);
    setPendingSendTimer(t);
  };
  const cancelPendingSend = () => {
    if (!pendingSendTimer) return;
    clearTimeout(pendingSendTimer);
    setPendingSendTimer(null);
    setPendingCountdown(0);
  };

  const canPrepare =
    (sendSmsCh || sendEmailCh) &&
    (!sendSmsCh || trimmedPhone.length >= 7) &&
    (!sendEmailCh || /^.+@.+\..+$/.test(trimmedEmail));

  const title =
    step === "sent"
      ? "Preview email sent"
      : step === "preview"
        ? "Review preview email"
        : "Send preview email";

  return (
    <Modal title={title} onClose={onClose}>
      {step === "contact" && (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            Pick a template and a plan, confirm the contact info, then
            we'll render the email so you can review it before it goes
            out. Edits here apply to this send only — the lead's saved
            phone and email are not modified. / Elige la plantilla y el
            plan, confirma el contacto y revisamos el email antes de
            enviarlo.
          </p>
          <label className="block mb-3">
            <span className="text-xs text-muted-foreground">
              Template / Plantilla
            </span>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {TEMPLATE_CHOICES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="mb-3">
            <legend className="text-xs text-muted-foreground mb-2">
              Pricing plan / Plan
            </legend>
            <div className="flex flex-col gap-1.5">
              {PLAN_CHOICES.map((c) => (
                <label
                  key={c.key}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="radio"
                    name="preview-plan"
                    value={c.key}
                    checked={plan === c.key}
                    onChange={() => setPlan(c.key)}
                  />
                  <span>{c.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.priceLabel}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block mb-3">
            <span className="text-xs text-muted-foreground">Phone</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block mb-4">
            <span className="text-xs text-muted-foreground">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="(none on file)"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <fieldset className="mb-4">
            <legend className="text-xs text-muted-foreground mb-2">
              Send via
            </legend>
            <div className="flex gap-4 flex-wrap">
              <label
                className="flex items-center gap-2 text-sm text-muted-foreground cursor-not-allowed"
                title="SMS temporarily unavailable — pending carrier verification."
              >
                <input
                  type="checkbox"
                  checked={sendSmsCh}
                  onChange={(e) => setSendSmsCh(e.target.checked)}
                  disabled
                />
                SMS <span className="text-xs">(disabled)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sendEmailCh}
                  onChange={(e) => setSendEmailCh(e.target.checked)}
                />
                Email
              </label>
            </div>
            {!sendSmsCh && !sendEmailCh && (
              <div className="text-xs text-destructive mt-2">
                Pick at least one channel.
              </div>
            )}
            {sendEmailCh && !trimmedEmail && (
              <div className="text-xs text-destructive mt-2">
                Add an email address or uncheck Email.
              </div>
            )}
          </fieldset>
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-input bg-background text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => draftMutation.mutate()}
              disabled={draftMutation.isPending || !canPrepare}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
            >
              {draftMutation.isPending ? "Preparing…" : "Prepare preview"}
            </button>
          </div>
        </>
      )}

      {step === "preview" && (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            To: <span className="font-medium text-foreground">{trimmedEmail || "(no email)"}</span>
            {sendSmsCh && trimmedPhone ? (
              <>
                {" · SMS: "}
                <span className="font-medium text-foreground">{trimmedPhone}</span>
              </>
            ) : null}
          </p>
          {sendEmailCh && (
            <>
              <label className="block mb-2">
                <span className="text-xs text-muted-foreground">Subject</span>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="block mb-3">
                <span className="text-xs text-muted-foreground">Email body</span>
                <textarea
                  rows={10}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                />
                <span className="block text-[11px] text-muted-foreground mt-1">
                  Editing here ships your text in our branded wrapper instead
                  of the day-1 drip layout. Leave untouched to keep the
                  styled version.
                </span>
              </label>
            </>
          )}
          {sendSmsCh && (
            <label className="block mb-3">
              <span className="text-xs text-muted-foreground">SMS</span>
              <textarea
                rows={3}
                value={smsBody}
                onChange={(e) => setSmsBody(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </label>
          )}
          {sendError && (
            <div
              role="alert"
              className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {sendError}
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              disabled={sendMutation.isPending || isPendingSend}
              className="px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setSendError(null);
                setStep("contact");
              }}
              disabled={sendMutation.isPending || isPendingSend}
              className="px-4 py-2 rounded-md border border-input bg-background text-sm disabled:opacity-60"
            >
              Edit contact
            </button>
            {isPendingSend ? (
              <button
                type="button"
                onClick={cancelPendingSend}
                data-testid="undo-send-preview"
                className="px-4 py-2 rounded-md border border-amber-500/50 bg-amber-50/60 dark:bg-amber-950/25 text-sm font-medium text-amber-900 dark:text-amber-100"
              >
                Undo · {pendingCountdown}s
              </button>
            ) : (
              <button
                onClick={startSendWithUndo}
                disabled={
                  sendMutation.isPending ||
                  (sendEmailCh && (!subject.trim() || !body.trim())) ||
                  (sendSmsCh && !smsBody.trim())
                }
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
              >
                {sendMutation.isPending ? "Sending…" : "Send"}
              </button>
            )}
          </div>
        </>
      )}

      {step === "sent" && (
        <>
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-3 text-sm mb-4">
            <div className="font-medium">Preview link sent.</div>
            <div className="text-xs text-muted-foreground mt-1">
              {sendEmailCh ? <>Email: {sentResult?.emailStatus}</> : null}
              {sendEmailCh && sendSmsCh ? " · " : null}
              {sendSmsCh ? <>SMS: {sentResult?.smsStatus}</> : null}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                const parts: string[] = [];
                if (sendEmailCh && sentResult)
                  parts.push(`email ${sentResult.emailStatus}`);
                if (sendSmsCh && sentResult)
                  parts.push(`SMS ${sentResult.smsStatus}`);
                onDone(
                  parts.length
                    ? `Preview sent — ${parts.join(", ")}.`
                    : "Preview sent.",
                );
              }}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
            >
              Close
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function PaymentLinkModal({
  leadId,
  defaultPhone,
  defaultEmail,
  practice,
  onClose,
  onDone,
  onError,
}: {
  leadId: number;
  defaultPhone: string;
  defaultEmail: string | null;
  practice: string;
  onClose: () => void;
  onDone: (m: string) => void;
  onError: (err: unknown) => void;
}) {
  // Phase 1B-b: rep quotes a tier (Boutique / Pro / Concierge) instead
  // of a plan + addon multiselect. Legacy planKey/addonKeys still ride
  // along in the request body so the dashboard backend compiles against
  // the shim until 1B-c rewires it; the tierKey is the authoritative
  // signal the route reads when present.
  const [tierKey, setTierKey] = useState<TierKey>("boutique_pro");
  const [phone, setPhone] = useState(defaultPhone);
  const [email, setEmail] = useState(defaultEmail ?? "");
  // SMS gated off until carrier verification clears. Re-enable by
  // flipping the default to `true` and removing `disabled` from the
  // SMS checkbox below.
  const [sendSmsCh, setSendSmsCh] = useState(false);
  const [sendEmailCh, setSendEmailCh] = useState(!!defaultEmail);
  const [copied, setCopied] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const trimmedPhone = phone.trim();
  const trimmedEmail = email.trim();

  const monthlyTotalCents = TIERS[tierKey].monthlyCents;
  const setupCents = TIERS[tierKey].setupCents;

  const m = useMutation({
    mutationFn: () =>
      api.sendPaymentLink(leadId, {
        // tierKey is the new canonical field. Legacy planKey="A" is
        // still passed so the route's Zod schema (which requires it
        // until 1B-c) accepts the payload; the route ignores it when
        // tierKey is present.
        tierKey,
        planKey: "A",
        addonKeys: [],
        channels: { sms: sendSmsCh, email: sendEmailCh },
        phoneOverride:
          trimmedPhone && trimmedPhone !== defaultPhone
            ? trimmedPhone
            : undefined,
        emailOverride:
          (trimmedEmail || null) !== (defaultEmail ?? null)
            ? trimmedEmail
              ? trimmedEmail
              : null
            : undefined,
      }),
    onSuccess: async (r) => {
      setResultUrl(r.url);
      const parts: string[] = [];
      if (sendEmailCh) parts.push(`email ${r.emailStatus}`);
      if (sendSmsCh) parts.push(`SMS ${r.smsStatus}`);
      setResultMsg(
        parts.length
          ? `Payment link sent — ${parts.join(", ")}.`
          : "Payment link sent.",
      );
      try {
        await navigator.clipboard.writeText(r.url);
        setCopied(true);
      } catch {
        /* user can copy manually */
      }
    },
    onError,
  });

  const canSend =
    (sendSmsCh || sendEmailCh) &&
    (!sendSmsCh || trimmedPhone.length >= 7) &&
    (!sendEmailCh || /^.+@.+\..+$/.test(trimmedEmail));

  if (resultUrl) {
    return (
      <Modal title="Payment link sent" onClose={onClose}>
        <p className="text-sm text-muted-foreground mb-1">
          Sent to {practice}.
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          {copied
            ? "URL copied to clipboard."
            : "Copy the URL below if you need to share it again."}
        </p>
        {/*
         * Stripe checkout URLs are 100+ chars and fully wrapping them
         * shoves the modal into a 4-line block. Middle-truncate so the
         * domain (recognisable) and the trailing path (unique) both
         * remain visible — full URL is preserved on the clipboard via
         * the Copy button.
         */}
        <div
          className="rounded-md border border-input bg-muted/40 px-3 py-2 text-xs mb-4 font-mono whitespace-nowrap overflow-hidden"
          title={resultUrl}
        >
          {resultUrl.length > 56
            ? `${resultUrl.slice(0, 36)}…${resultUrl.slice(-16)}`
            : resultUrl}
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(resultUrl);
                setCopied(true);
              } catch {
                /* ignore */
              }
            }}
            className="px-4 py-2 rounded-md border border-input bg-background text-sm"
          >
            {copied ? "Copied" : "Copy URL"}
          </button>
          <button
            onClick={() => {
              if (resultMsg) onDone(resultMsg);
              else onClose();
            }}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Send payment link" onClose={onClose}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto -mx-1 px-1">
        <fieldset>
          <legend className="text-xs text-muted-foreground mb-2">Tier</legend>
          {/* Phase 1B-b: tier picker replaces the legacy plan A/B radio
              + addon multiselect + COGS/margin column. Three flat
              tiers, no à-la-carte choices, no per-addon margin math —
              tier prices are stable and absorb COGS by design. */}
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                "boutique",
                "boutique_pro",
                "boutique_concierge",
              ] as const
            ).map((k) => {
              const tier = TIERS[k];
              const selected = tierKey === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTierKey(k)}
                  data-testid={`rep-tier-card-${k}`}
                  className={`relative rounded-md border p-3 text-left text-sm transition-colors ${
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-input bg-background hover:bg-muted"
                  }`}
                >
                  {tier.recommended && (
                    <span className="absolute -top-2 right-2 text-[9px] font-mono uppercase tracking-widest bg-amber-200 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 px-1 py-0.5 rounded">
                      Pro
                    </span>
                  )}
                  <div className="font-medium">{tier.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    ${(tier.monthlyCents / 100).toFixed(0)}/mo
                    {tier.setupCents > 0 && (
                      <> · ${(tier.setupCents / 100).toFixed(0)} setup</>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Single-line quote summary surfaces the rep's current tier
            choice next to the resulting price — matches the founder's
            "Quoted Boutique Pro · $299/mo" wording. */}
        <div
          data-testid="rep-tier-summary"
          className="rounded-md border border-primary/30 bg-primary/5 p-3 flex items-baseline justify-between"
        >
          <span className="text-xs text-primary uppercase tracking-wider">
            Quoted {TIERS[tierKey].label}
          </span>
          <span className="font-serif text-2xl text-primary">
            ${(monthlyTotalCents / 100).toFixed(0)}
            <span className="text-sm text-primary/65 ml-0.5">/mo</span>
          </span>
        </div>

        <label className="block">
          <span className="text-xs text-muted-foreground">Phone</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="(none on file)"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <fieldset>
          <legend className="text-xs text-muted-foreground mb-2">
            Send via
          </legend>
          <div className="flex gap-4 flex-wrap">
            <label
              className="flex items-center gap-2 text-sm text-muted-foreground cursor-not-allowed"
              title="SMS temporarily unavailable — pending carrier verification."
            >
              <input
                type="checkbox"
                checked={sendSmsCh}
                onChange={(e) => setSendSmsCh(e.target.checked)}
                disabled
              />
              SMS <span className="text-xs">(disabled)</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sendEmailCh}
                onChange={(e) => setSendEmailCh(e.target.checked)}
              />
              Email
            </label>
          </div>
          {!sendSmsCh && !sendEmailCh && (
            <div className="text-xs text-destructive mt-2">
              Pick at least one channel.
            </div>
          )}
          {sendEmailCh && !trimmedEmail && (
            <div className="text-xs text-destructive mt-2">
              Add an email address or uncheck Email.
            </div>
          )}
        </fieldset>
      </div>

      <div className="flex gap-2 justify-end mt-5 pt-4 border-t border-border">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-md border border-input bg-background text-sm"
        >
          Cancel
        </button>
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending || !canSend}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
        >
          {m.isPending ? "Sending…" : "Send payment link"}
        </button>
      </div>
    </Modal>
  );
}

function SmsModal({
  leadId,
  defaultBody,
  onClose,
  onDone,
  onError,
}: {
  leadId: number;
  defaultBody: string;
  onClose: () => void;
  onDone: (m: string) => void;
  onError: (err: unknown) => void;
}) {
  const [body, setBody] = useState(defaultBody);
  const m = useMutation({
    mutationFn: () => api.sendSms({ leadId, body }),
    onSuccess: (r) => {
      // Dialpad SMS (#185 — migrated off Twilio 2026-04-28) returns
      // "queued"/"sent" on success, "dev_skipped" when DIALPAD creds
      // are missing, and "failed" on rejection. Treat anything other
      // than the queued/sent class as an error toast so the rep doesn't
      // think a silently-skipped message went out.
      if (r.status === "sent" || r.status === "queued") {
        onDone("SMS sent.");
        return;
      }
      if (r.status === "dev_skipped") {
        onError(
          new Error(
            "SMS not delivered: Dialpad SMS is not configured. Ask Ashford to set the Dialpad keys.",
          ),
        );
        return;
      }
      onError(
        new Error(
          `SMS send failed (status: ${r.status})${r.error ? ` — ${r.error}` : ""}.`,
        ),
      );
    },
    onError,
  });
  return (
    <Modal title="Send SMS" onClose={onClose}>
      <textarea
        rows={5}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <div className="text-xs text-muted-foreground mt-1">
        {body.length} / 1600 characters
      </div>
      <div className="flex gap-2 justify-end mt-4">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-md border border-input bg-background text-sm"
        >
          Cancel
        </button>
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending || !body.trim()}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
        >
          {m.isPending ? "Sending…" : "Send SMS"}
        </button>
      </div>
    </Modal>
  );
}

// Two-step email send: rep edits → reviews the prepared message →
// confirms send. Avoids the "I meant to fix the typo before clicking
// Send" failure mode of the previous one-shot flow. Send errors stay
// inline on the preview step so the rep can retry without losing
// edits. Each open starts with a fresh draft from the template (no
// persistence across open/close cycles).
function EmailModal({
  leadId,
  to,
  defaultSubject,
  defaultBody,
  onClose,
  onDone,
  onError: _onError,
}: {
  leadId: number;
  to: string;
  defaultSubject: string;
  defaultBody: string;
  onClose: () => void;
  onDone: (m: string) => void;
  onError: (err: unknown) => void;
}) {
  type Step = "edit" | "preview" | "sent";
  const [step, setStep] = useState<Step>("edit");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<Date | null>(null);

  const subjectRef = useRef<HTMLInputElement>(null);
  const sendBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (step === "edit") subjectRef.current?.focus();
    else if (step === "preview") sendBtnRef.current?.focus();
    else if (step === "sent") closeBtnRef.current?.focus();
  }, [step]);

  const m = useMutation({
    mutationFn: () => api.sendEmail({ leadId, subject, body }),
    onSuccess: (r) => {
      // Server returns "sent" on actual delivery, "dev_skipped" when
      // RESEND_API_KEY is missing, "failed" when Resend rejected the
      // payload. Only "sent" advances to confirmation — anything else
      // is a real problem the rep needs to see, kept inline so the
      // prepared content stays editable.
      if (r.status === "sent") {
        setSentAt(new Date());
        setSendError(null);
        setStep("sent");
        return;
      }
      if (r.status === "dev_skipped") {
        setSendError(
          "Email not delivered: RESEND_API_KEY is not configured. Ask Ashford to set it.",
        );
        return;
      }
      setSendError(
        `Email send failed (status: ${r.status})${r.error ? ` — ${r.error}` : ""}.`,
      );
    },
    onError: (err) => {
      setSendError(err instanceof Error ? err.message : "Send failed.");
    },
  });

  const title =
    step === "sent" ? "Email sent" : `Send email to ${to}`;

  return (
    <Modal title={title} onClose={onClose}>
      <div className="text-xs text-muted-foreground mb-3">
        To: <span className="font-medium text-foreground">{to}</span>
      </div>

      {step === "edit" && (
        <>
          <input
            ref={subjectRef}
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            data-testid="email-subject"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-2"
          />
          <textarea
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            data-testid="email-body"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2 justify-end mt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-input bg-background text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setSendError(null);
                setStep("preview");
              }}
              disabled={!subject.trim() || !body.trim()}
              data-testid="email-prepare"
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
            >
              Prepare email
            </button>
          </div>
        </>
      )}

      {step === "preview" && (
        <>
          <div
            data-testid="email-preview"
            className="rounded-md border border-input bg-background"
          >
            <div className="px-3 py-2 border-b border-input text-sm font-medium">
              {subject}
            </div>
            <pre className="px-3 py-3 text-sm whitespace-pre-wrap font-sans m-0">
              {body}
            </pre>
          </div>
          {sendError && (
            <div
              role="alert"
              data-testid="email-error"
              className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {sendError}
            </div>
          )}
          <div className="flex gap-2 justify-end mt-4">
            <button
              onClick={onClose}
              disabled={m.isPending}
              className="px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={() => setStep("edit")}
              disabled={m.isPending}
              className="px-4 py-2 rounded-md border border-input bg-background text-sm disabled:opacity-60"
            >
              Edit
            </button>
            <button
              ref={sendBtnRef}
              onClick={() => m.mutate()}
              disabled={m.isPending}
              data-testid="email-send"
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
            >
              {m.isPending ? "Sending…" : "Send"}
            </button>
          </div>
        </>
      )}

      {step === "sent" && (
        <>
          <div
            data-testid="email-sent"
            className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-3 text-sm"
          >
            <div className="font-medium">Sent to {to}</div>
            {sentAt && (
              <div className="text-xs text-muted-foreground mt-1">
                {fmtDateTime(sentAt.toISOString())}
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <button
              ref={closeBtnRef}
              onClick={() => onDone("Email sent.")}
              data-testid="email-close"
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
            >
              Close
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function CallbackModal({
  leadId,
  onClose,
  onDone,
  onError,
}: {
  leadId: number;
  onClose: () => void;
  onDone: (m: string) => void;
  onError: (err: unknown) => void;
}) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const defaultLocal = new Date(
    tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000,
  )
    .toISOString()
    .slice(0, 16);

  const [when, setWhen] = useState(defaultLocal);
  const [note, setNote] = useState("");
  // Recap sends both SMS + email server-side. While SMS is gated off
  // pending TextBelt carrier verification, the whole recap is disabled
  // (a partial email-only recap would need a backend change). Re-enable
  // by flipping the default back to `true` and removing the `disabled`
  // attr below — once SMS gating is lifted across the rep app.
  const [recap, setRecap] = useState(false);

  const m = useMutation({
    mutationFn: () =>
      api.scheduleCallback(leadId, {
        scheduledFor: new Date(when).toISOString(),
        note: note || undefined,
        sendRecap: recap,
      }),
    onSuccess: (r) =>
      onDone(
        recap
          ? `Callback scheduled. Recap: SMS ${r.recapSmsStatus ?? "—"}, email ${r.recapEmailStatus ?? "—"}.`
          : `Callback scheduled.`,
      ),
    onError,
  });

  return (
    <Modal title="Schedule callback" onClose={onClose}>
      <label className="block mb-3">
        <span className="text-xs text-muted-foreground">When</span>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
      <label className="block mb-3">
        <span className="text-xs text-muted-foreground">Note (optional)</span>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
      <label
        className="flex items-start gap-2 text-sm mb-4 text-muted-foreground cursor-not-allowed"
        title="Recap temporarily unavailable — pending carrier verification."
      >
        <input
          type="checkbox"
          checked={recap}
          onChange={(e) => setRecap(e.target.checked)}
          className="mt-1"
          disabled
        />
        <span>
          Send "see you tomorrow" recap with their preview link.{" "}
          <span className="text-xs">(disabled — pending carrier verification)</span>
        </span>
      </label>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-md border border-input bg-background text-sm"
        >
          Cancel
        </button>
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
        >
          {m.isPending ? "Saving…" : "Schedule"}
        </button>
      </div>
    </Modal>
  );
}

function DisqualifyModal({
  leadId,
  onClose,
  onDone,
  onError,
}: {
  leadId: number;
  onClose: () => void;
  onDone: (m: string) => void;
  onError: (err: unknown) => void;
}) {
  const [reason, setReason] = useState<DisqualifyReason>("not_interested");
  const [note, setNote] = useState("");
  const m = useMutation({
    mutationFn: () => api.disqualify(leadId, reason, note || undefined),
    onSuccess: () => onDone("Lead disqualified."),
    onError,
  });
  return (
    <Modal title="Disqualify lead" onClose={onClose}>
      <label className="block mb-3">
        <span className="text-xs text-muted-foreground">Reason</span>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as DisqualifyReason)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {(
            Object.entries(DISQUALIFY_REASON_LABELS) as [
              DisqualifyReason,
              string,
            ][]
          ).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="block mb-4">
        <span className="text-xs text-muted-foreground">
          Note (optional)
        </span>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-md border border-input bg-background text-sm"
        >
          Cancel
        </button>
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending}
          className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium disabled:opacity-60"
        >
          {m.isPending ? "Saving…" : "Disqualify"}
        </button>
      </div>
    </Modal>
  );
}

function ConfirmColdModal({
  leadId,
  onClose,
  onDone,
  onError,
}: {
  leadId: number;
  onClose: () => void;
  onDone: (m: string) => void;
  onError: (err: unknown) => void;
}) {
  const m = useMutation({
    mutationFn: () => api.markCold(leadId),
    onSuccess: () => onDone("Lead parked as cold. You can find it under Cold leads."),
    onError,
  });
  return (
    <Modal title="Park as cold lead" onClose={onClose}>
      <p className="text-sm text-muted-foreground mb-4">
        Parks the lead under <b>Cold leads</b> so you can come back to it
        later. It stays assigned to you and won't be recycled. To bring it
        back into your active queue, open the lead and pick a follow-up
        action again.
      </p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-md border border-input bg-background text-sm"
        >
          Cancel
        </button>
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
        >
          {m.isPending ? "Saving…" : "Park as cold"}
        </button>
      </div>
    </Modal>
  );
}

/**
 * Sprint 1 (2026-05-22) — PortalRequestModal.
 *
 * Confirms the rep wants Ashford (the founder) to hand-craft a portal
 * for this prospect. Optional free-form message gives Candice room to
 * say "they're nervous about pricing — lean on Garden" etc. On
 * success the parent invalidates `my-portal-requests` so the action
 * button immediately switches into the "Portail demandé" disabled state.
 */
function PortalRequestModal({
  leadId,
  leadName,
  onClose,
  onDone,
  onError,
}: {
  leadId: number;
  leadName: string;
  onClose: () => void;
  onDone: (m: string) => void;
  onError: (err: unknown) => void;
}) {
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const m = useMutation({
    mutationFn: () => api.requestPortal(leadId, message.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-portal-requests"] });
      onDone(`Demande envoyée — Ashford va préparer le portail de ${leadName}.`);
    },
    onError,
  });
  return (
    <Modal title="Demander un portail personnalisé" onClose={onClose}>
      <p className="text-sm text-muted-foreground mb-4">
        Ashford va préparer un portail dédié pour <b>{leadName}</b> à partir
        de tes notes et des infos que tu as déjà collectées. Tu recevras
        une notification quand il sera prêt à être partagé.
      </p>
      <label className="block text-xs font-medium text-foreground mb-1">
        Message pour Ashford (optionnel)
      </label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ex : tarif serré, préfère un look chaleureux, déjà appelé une fois…"
        rows={4}
        maxLength={2000}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-4 resize-none"
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-md border border-input bg-background text-sm"
        >
          Cancel
        </button>
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
        >
          {m.isPending ? "Envoi…" : "Envoyer la demande"}
        </button>
      </div>
    </Modal>
  );
}

function ConfirmWonModal({
  leadId,
  onClose,
  onDone,
  onError,
}: {
  leadId: number;
  onClose: () => void;
  onDone: (m: string) => void;
  onError: (err: unknown) => void;
}) {
  const m = useMutation({
    mutationFn: () => api.markWon(leadId),
    onSuccess: () => onDone("Marked as won. Nice."),
    onError,
  });
  return (
    <Modal title="Mark as won" onClose={onClose}>
      <p className="text-sm text-muted-foreground mb-4">
        This marks the lead as won. Ashford will create the actual sale + onboarding from
        this — you don't need to do anything else.
      </p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-md border border-input bg-background text-sm"
        >
          Cancel
        </button>
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
        >
          {m.isPending ? "Saving…" : "Yes, mark won"}
        </button>
      </div>
    </Modal>
  );
}


const TEMPLATE_CHOICES: Array<{ key: string; label: string }> = [
  { key: "atrium", label: "Atrium" },
  { key: "garden", label: "Garden" },
  { key: "sunrise", label: "Sunrise" },
  { key: "polaroid", label: "Polaroid" },
  { key: "playful_modern", label: "Playful Modern" },
  { key: "constellation", label: "Constellation" },
  { key: "front_porch", label: "Front Porch" },
  { key: "hello_friend", label: "Hello Friend" },
  { key: "quiet_practice", label: "Quiet Practice" },
];

function PortalSnapshot({ leadId }: { leadId: number }) {
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [showAllAddons, setShowAllAddons] = useState(false);
  const portal = useQuery({
    queryKey: ["lead-portal", leadId],
    queryFn: () => api.getLeadPortal(leadId),
    refetchOnWindowFocus: false,
  });
  const p = portal.data;
  if (!p) return null;
  const headway = p.headway;
  const interestedSlugs = new Set<string>();
  for (const e of p.events) {
    if (e.eventType === "addon_toggle" && e.addonSlug) {
      const md = (e.metadata ?? {}) as { selected?: boolean };
      if (md.selected) interestedSlugs.add(e.addonSlug);
    }
  }
  const SNAPSHOT_CAP = 5;
  const allInterested = Array.from(interestedSlugs);
  const visibleAddons = showAllAddons
    ? allInterested
    : allInterested.slice(0, SNAPSHOT_CAP);
  const visibleEvents = showAllEvents
    ? p.events
    : p.events.slice(0, SNAPSHOT_CAP);
  return (
    <div className="mt-4 space-y-2">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
        Snapshot
      </h3>
      {headway ? (
        <div className="rounded-lg border border-card-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-xs text-muted-foreground">Headway profile</div>
            <a
              href={headway.profileUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary underline hover:no-underline inline-flex items-center gap-1"
            >
              View on Headway <ExternalLink size={10} />
            </a>
          </div>
          <div className="flex gap-2">
            {headway.photoUrl ? (
              <img
                src={headway.photoUrl}
                alt=""
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              {headway.bio ? (
                <p className="text-xs text-foreground/80 line-clamp-2">
                  {headway.bio}
                </p>
              ) : null}
              {headway.acceptedInsurances.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Accepts:
                  </span>
                  {headway.acceptedInsurances.slice(0, 4).map((ins) => (
                    <span
                      key={ins}
                      className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"
                    >
                      {ins}
                    </span>
                  ))}
                </div>
              ) : null}
              {(headway.acceptsSlidingScale ||
                headway.virtual ||
                headway.inPerson) && (
                <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                  {headway.acceptsSlidingScale ? (
                    <span>· Sliding scale</span>
                  ) : null}
                  {headway.inPerson ? <span>· In-person</span> : null}
                  {headway.virtual ? <span>· Virtual</span> : null}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
      <div className="rounded-lg border border-card-border bg-card p-3 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          <Activity size={12} /> Recent activity
        </div>
        {p.events.length === 0 ? (
          <div className="text-xs text-muted-foreground">No events.</div>
        ) : (
          <ul className="space-y-1 text-xs">
            {visibleEvents.map((e) => {
              const md = (e.metadata ?? {}) as { questionSlug?: string };
              const faqSlug =
                e.eventType === "faq_open" ? md.questionSlug : undefined;
              return (
                <li key={e.id} className="flex justify-between gap-2">
                  <span className="truncate">
                    {labelEvent(e.eventType)}
                    {e.templateKey ? ` · ${e.templateKey}` : ""}
                    {e.addonSlug ? ` · ${e.addonSlug}` : ""}
                    {faqSlug ? ` · ${faqSlug}` : ""}
                  </span>
                  <span className="text-muted-foreground shrink-0">
                    {fmtDateTime(e.occurredAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {p.events.length > SNAPSHOT_CAP ? (
          <button
            type="button"
            onClick={() => setShowAllEvents((v) => !v)}
            className="mt-1 text-xs text-primary underline hover:no-underline"
          >
            {showAllEvents
              ? "Show less"
              : `See all ${p.events.length} events`}
          </button>
        ) : null}
      </div>
      <div className="rounded-lg border border-card-border bg-card p-3 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          <DollarSign size={12} /> Add-ons of interest
        </div>
        {allInterested.length === 0 ? (
          <div className="text-xs text-muted-foreground">No add-ons toggled.</div>
        ) : (
          <ul className="space-y-1 text-xs">
            {visibleAddons.map((slug) => {
              const a = p.addons.find((x) => x.slug === slug);
              return (
                <li key={slug} className="flex justify-between gap-2">
                  <span className="truncate">{a?.name ?? slug}</span>
                  {a ? (
                    <span className="text-muted-foreground">
                      ${(a.monthlyCents / 100).toFixed(0)}/mo
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {allInterested.length > SNAPSHOT_CAP ? (
          <button
            type="button"
            onClick={() => setShowAllAddons((v) => !v)}
            className="mt-1 text-xs text-primary underline hover:no-underline"
          >
            {showAllAddons
              ? "Show less"
              : `See all ${allInterested.length} add-ons`}
          </button>
        ) : null}
        {p.cart && p.cart.addonSlugs.length > 0 ? (
          <div className="mt-2 pt-2 border-t border-input text-xs text-muted-foreground">
            Cart: ${(p.cart.monthlyTotalCents / 100).toFixed(0)}/mo + $
            {(p.cart.setupTotalCents / 100).toFixed(0)} setup
          </div>
        ) : null}
      </div>
    </div>
  );
}

function labelEvent(kind: string): string {
  switch (kind) {
    case "opened":
      return "Portal opened";
    case "template_view":
      return "Design previewed";
    case "template_selected":
      return "Design picked";
    case "customize":
      return "Customization";
    case "addon_view":
      return "Add-on previewed";
    case "addon_toggle":
      return "Add-on toggled";
    case "cart_update":
      return "Cart updated";
    case "reserve_clicked":
      return "Clicked Reserve";
    case "reserve_succeeded":
      return "Reservation paid";
    case "share_link_copied":
      return "Link copied";
    case "exit":
      return "Exit";
    case "help_panel_open":
      return "Asked for a human";
    case "faq_open":
      return "Read FAQ";
    case "invite_sent":
      return "Invitation sent";
    case "reengagement_j3_email":
      return "Drip email (D+3)";
    case "reengagement_j7_email":
      return "Drip email (D+7)";
    case "reengagement_j14_email":
      return "Drip email (D+14)";
    case "reengagement_j30_email":
      return "Drip email (D+30) — last touch";
    case "reengagement_sequence_closed":
      return "Drip sequence closed";
    case "reengagement_j8_sms":
      return "Re-engagement SMS (D+8) — legacy";
    case "reengagement_j15_rep_alert":
      return "Rep alert (D+15) — legacy";
    default:
      return kind;
  }
}


// 2026-05-14: LOT 3.10 TierCapabilitiesPanel + its PHASE_B_KEYS lookup
// removed — rep now picks the pricing plan inside the Send preview email
// modal; this at-a-glance card is no longer needed on every lead detail page.


// ---------------------------------------------------------------------------
// LeadHeroCard — at-a-glance identity strip pinned above the Contact card
// ---------------------------------------------------------------------------
// Founder feedback 2026-05-17: 'photo prospect + adresse + email + site web
// pinnés en haut du lead detail'. The lead row doesn't have a portrait
// column on the DB schema, so the avatar is a typographic initial chip in
// the brand accent — the same fallback the portal HelpPanel uses when a
// rep's avatar is missing. Email is tap-to-copy, website is open-in-new-tab,
// city/state is a passive label (no action).
function LeadHeroCard({
  name,
  practice,
  specialty,
  email,
  website,
  city,
  state,
  onCopyEmail,
}: {
  name: string;
  practice: string;
  specialty: string;
  email: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  onCopyEmail: () => void;
}) {
  const initial = name.replace(/^(?:dr|dra|mr|mrs|ms|mx|prof|rev)\.?\s+/i, "").trim().charAt(0).toUpperCase() || "?";
  const tidyHost = (raw: string): string => {
    try {
      const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
      return u.host.replace(/^www\./i, "") + (u.pathname && u.pathname !== "/" ? u.pathname : "");
    } catch {
      return raw;
    }
  };
  const cityState = [city, state].filter(Boolean).join(", ");
  return (
    <div
      data-testid="lead-hero-card"
      className="bg-card border border-card-border rounded-xl p-5 shadow-sm flex items-start gap-4"
    >
      <div
        aria-hidden
        className="shrink-0 w-14 h-14 rounded-full bg-accent/15 text-accent flex items-center justify-center font-serif text-2xl"
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          {specialty}
        </div>
        <div className="font-serif text-xl text-foreground truncate">{name}</div>
        <div className="text-sm text-muted-foreground truncate">{practice}</div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          {email ? (
            <button
              type="button"
              onClick={onCopyEmail}
              data-testid="lead-hero-copy-email"
              className="inline-flex items-center gap-1.5 text-foreground/80 hover:text-foreground"
              title="Copy email"
            >
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="truncate max-w-[260px]">{email}</span>
            </button>
          ) : null}
          {website ? (
            <a
              href={website.startsWith("http") ? website : `https://${website}`}
              target="_blank"
              rel="noreferrer"
              data-testid="lead-hero-open-website"
              className="inline-flex items-center gap-1.5 text-accent hover:underline"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="truncate max-w-[220px]">{tidyHost(website)}</span>
            </a>
          ) : null}
          {cityState ? (
            <span
              data-testid="lead-hero-citystate"
              className="inline-flex items-center gap-1.5 text-muted-foreground"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>{cityState}</span>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RepAttachmentsPanel — paste a share link + caption, lands in admin feed
// ---------------------------------------------------------------------------
// Founder feedback 2026-05-17: 'Wasn't the sales rep supposed to able to
// upload files, images, text to the admin via the lead's page?'. The URL
// variant covers most evidence (Drive / Dropbox / Imgur / Loom screen
// captures) and ships in this phase; raw file upload follows. Each submit
// posts a regular rep note with an [ATTACHMENT] prefix so the existing
// admin notes feed surfaces it without a new endpoint or schema change.
function RepAttachmentsPanel({
  leadId,
  onError,
  onSuccess,
}: {
  leadId: number;
  onError: (err: unknown) => void;
  onSuccess?: () => void;
}) {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  // Founder feedback 2026-05-19 (phase 2): also allow file upload, capped
  // at 2 MB — the file is base64-encoded inline so admins see a real
  // preview in the notes feed without a new endpoint.
  const [fileName, setFileName] = useState<string | null>(null);
  const [filePayload, setFilePayload] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const submit = useMutation({
    mutationFn: (body: string) => api.addRepNote(leadId, body),
    onSuccess: () => {
      setUrl("");
      setCaption("");
      setFileName(null);
      setFilePayload(null);
      setFileError(null);
      qc.invalidateQueries({ queryKey: ["lead-rep-notes", leadId] });
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      onSuccess?.();
    },
    onError,
  });
  const handleFile = (file: File | null | undefined) => {
    setFileError(null);
    if (!file) { setFileName(null); setFilePayload(null); return; }
    if (file.size > 2 * 1024 * 1024) {
      setFileError("File too large (>2MB). Use a share link instead.");
      setFileName(null); setFilePayload(null); return;
    }
    const reader = new FileReader();
    reader.onerror = () => setFileError("Could not read file. Try a share link.");
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") { setFileName(file.name); setFilePayload(result); }
    };
    reader.readAsDataURL(file);
  };
  const looksLikeUrl = /^https?:\/\/[^\s]+$/i.test(url.trim());
  const canSubmit = (looksLikeUrl || !!filePayload) && !submit.isPending;
  const handleSubmit = () => {
    if (!canSubmit) return;
    const cleanCaption = caption.trim();
    const head = cleanCaption ? `[ATTACHMENT] ${cleanCaption}` : `[ATTACHMENT]`;
    let body: string;
    if (filePayload && fileName) {
      body = `${head} (file: ${fileName})\n${filePayload}`;
    } else {
      body = `${head}\n${url.trim()}`;
    }
    submit.mutate(body);
  };
  return (
    <div
      data-testid="rep-attachments-panel"
      className="bg-card border border-card-border rounded-xl p-6 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-3">
        <Paperclip className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-serif text-lg">Share with admin</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Paste a Drive / Dropbox / Imgur / Loom link, OR upload a file
        under 2 MB. Either way it lands inline with your notes.
      </p>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://drive.google.com/..."
        data-testid="rep-attachments-url"
        className="w-full text-sm px-3 py-2 mb-2 rounded-md border border-input bg-background"
      />
      <input
        type="file"
        accept="image/*,application/pdf,text/plain"
        onChange={(e) => handleFile(e.target.files?.[0])}
        data-testid="rep-attachments-file"
        className="w-full text-xs mb-2 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-muted file:text-foreground hover:file:bg-muted/80"
      />
      {fileName ? (
        <div className="text-xs text-muted-foreground mb-2">
          Ready: <span className="font-medium text-foreground">{fileName}</span>
        </div>
      ) : null}
      {fileError ? (
        <div className="text-xs text-destructive mb-2">{fileError}</div>
      ) : null}
      <input
        type="text"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Short caption for admin (optional)"
        data-testid="rep-attachments-caption"
        maxLength={280}
        className="w-full text-sm px-3 py-2 mb-2 rounded-md border border-input bg-background"
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          data-testid="rep-attachments-submit"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submit.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Paperclip className="w-3.5 h-3.5" />
          )}
          {submit.isPending ? "Sharing…" : "Share"}
        </button>
      </div>
    </div>
  );
}

// LeadTemperaturePicker — 4-button radio. Founder feedback 2026-05-17.
type LeadTemperature = "disqualifier" | "cold" | "lukewarm" | "hot";
function LeadTemperaturePicker({
  leadId, current, onError, onSuccess,
}: {
  leadId: number;
  current: LeadTemperature | null;
  onError: (err: unknown) => void;
  onSuccess?: () => void;
}) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (next: LeadTemperature | null) =>
      api.setLeadTemperature(leadId, next),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      onSuccess?.();
    },
    onError,
  });
  const OPTIONS: Array<{ key: LeadTemperature; label: string; dot: string }> = [
    { key: "disqualifier", label: "Disqualified", dot: "bg-red-500" },
    { key: "cold",         label: "Cold",         dot: "bg-blue-400" },
    { key: "lukewarm",     label: "Lukewarm",     dot: "bg-amber-400" },
    { key: "hot",          label: "Hot",          dot: "bg-emerald-500" },
  ];
  return (
    <div
      data-testid="lead-temperature-picker"
      className="bg-card border border-card-border rounded-xl p-4 shadow-sm"
    >
      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
        Temperature
      </div>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((o) => {
          const active = current === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => mut.mutate(o.key)}
              disabled={mut.isPending}
              aria-pressed={active}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                active
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-input bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${o.dot}`} />
              {o.label}
            </button>
          );
        })}
        {current ? (
          <button
            type="button"
            onClick={() => mut.mutate(null)}
            disabled={mut.isPending}
            className="text-xs text-muted-foreground hover:text-foreground underline ml-auto"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}


// B7 (founder 2026-05-19) — QC badge on the lead detail header.
function QcBadge({
  status, validatedAt, validatedBy,
}: { status: string; validatedAt: string | null; validatedBy: string | null }) {
  if (status === "none") return null;
  const houston = (iso: string | null): string => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleString("en-US", {
        timeZone: "America/Chicago",
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
        hour12: false,
      }) + " Houston Time";
    } catch { return iso; }
  };
  if (status === "validated") {
    return (
      <span
        data-testid="rep-qc-badge"
        title={validatedBy ? `Validated by ${validatedBy}` : undefined}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
      >
        <Check className="w-3 h-3" />
        Preview QC{validatedBy ? ` — ${validatedBy}` : ""}
        {validatedAt ? ` — ${houston(validatedAt)}` : ""}
      </span>
    );
  }
  return (
    <span
      data-testid="rep-qc-badge"
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700"
    >
      <XIcon className="w-3 h-3" />
      QC Outdated
    </span>
  );
}
