import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ExternalLink, ArrowLeft } from "lucide-react";
import {
  api,
  fmtDateTime,
  type LeadPortalDto,
  type LeadRow,
  type LeadHistoryEntry,
} from "@admin/lib/api";
import { PageHeader } from "@admin/components/AdminLayout";

/**
 * Admin LeadDetail page. The Customer-portal panel lives here (it was
 * moved out of the rep dashboard so admins, who oversee every lead in
 * the pool, have a single place to inspect a prospect's portal URL,
 * open count, and enrichment completeness without claiming the lead.
 */
export default function LeadDetailPage() {
  const [, params] = useRoute("/leads/:id");
  const id = Number(params?.id);

  const leadQuery = useQuery({
    queryKey: ["admin", "lead", id],
    queryFn: () => api.getLead(id),
    enabled: Number.isFinite(id) && id > 0,
  });

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="p-6 md:p-10">
        <PageHeader title="Lead" />
        <p className="text-sm text-destructive">Invalid lead id.</p>
      </div>
    );
  }

  if (leadQuery.isLoading) {
    return (
      <div className="p-6 md:p-10">
        <PageHeader title="Lead" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (leadQuery.isError || !leadQuery.data) {
    return (
      <div className="p-6 md:p-10">
        <PageHeader title="Lead" />
        <p className="text-sm text-destructive">
          {leadQuery.error instanceof Error
            ? leadQuery.error.message
            : "Could not load this lead."}
        </p>
      </div>
    );
  }

  const lead = leadQuery.data.lead;

  return (
    <div className="p-6 md:p-10 space-y-6">
      <PageHeader
        title={lead.name}
        description={
          [lead.practice, lead.specialty, lead.city]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        actions={
          <Link
            href="/leads"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            <ArrowLeft size={14} /> Back to leads
          </Link>
        }
      />

      <EditableFieldsCard leadId={id} lead={lead} />

      <QualityCheckCard leadId={id} lead={lead} />

      <BookingUrlsCard leadId={id} lead={lead} />

      <CustomerPortalCard leadId={id} />

      <HistoryCard leadId={id} />
    </div>
  );
}

/**
 * B6 (founder 2026-05-19) — Quality Check admin panel.
 *
 * Minimum viable controls:
 *  - Status badge (none / validated / stale).
 *  - Photo block: practitioner_url + source label (cabinet_site / PT
 *    / fallback_initials). When the lead lacks a real photo the
 *    "Validate" button is disabled with a tooltip; the
 *    "Accept-with-initials" override unlocks it.
 *  - Validate / Reset / Accept-with-initials buttons calling the
 *    /api/admin/leads/:id/qc-* endpoints.
 */
// ── Bundle 1.1 — inline-editable lead fields ────────────────────────────────
const STATUS_OPTIONS = [
  "available", "claimed", "nurturing", "won", "disqualified", "recycled", "cold",
].map((v) => ({ value: v, label: v }));
const TEMP_OPTIONS = ["disqualifier", "cold", "lukewarm", "hot"].map((v) => ({
  value: v,
  label: v,
}));
const DISQUALIFY_OPTIONS = [
  "not_interested", "wrong_number", "do_not_call", "already_has_provider",
  "out_of_market", "budget_concern", "other",
].map((v) => ({ value: v, label: v }));
const LOCALE_OPTIONS = [
  { value: "en", label: "en" },
  { value: "es", label: "es" },
];

/** Click-to-edit field. Commits on Enter or blur; Escape cancels. */
function EditableField({
  label,
  value,
  type = "text",
  options,
  multiline = false,
  onSave,
}: {
  label: string;
  value: string | null | undefined;
  type?: "text" | "select";
  options?: { value: string; label: string }[];
  multiline?: boolean;
  onSave: (v: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const commit = async () => {
    setEditing(false);
    const next = draft.trim();
    const cur = (value ?? "").toString();
    if (next === cur) return;
    setSaving(true);
    setErr(null);
    try {
      await onSave(next === "" ? null : next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
      setDraft(cur);
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="flex gap-2 items-start">
      <dt className="text-muted-foreground w-32 shrink-0 pt-1">{label}</dt>
      <dd className="flex-1 min-w-0">
        {editing ? (
          type === "select" ? (
            <select
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setEditing(false);
              }}
              className={inputCls}
            >
              <option value="">—</option>
              {options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : multiline ? (
            <textarea
              autoFocus
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditing(false);
              }}
              className={inputCls}
            />
          ) : (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setEditing(false);
              }}
              className={inputCls}
            />
          )
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-left hover:bg-muted/60 rounded px-1 -mx-1 w-full min-h-[1.75rem] whitespace-pre-wrap break-words"
            title="Click to edit"
          >
            {saving ? (
              <span className="text-muted-foreground">Saving…</span>
            ) : value ? (
              <span>{value}</span>
            ) : (
              <span className="text-muted-foreground italic">—</span>
            )}
          </button>
        )}
        {err && <div className="text-xs text-destructive mt-1">{err}</div>}
      </dd>
    </div>
  );
}

function EditableFieldsCard({
  leadId,
  lead,
}: {
  leadId: number;
  lead: LeadRow;
}) {
  const qc = useQueryClient();
  const save = (patch: Partial<LeadRow>) =>
    api.updateLead(leadId, patch).then(() => {
      qc.invalidateQueries({ queryKey: ["admin", "lead", leadId] });
      qc.invalidateQueries({ queryKey: ["admin", "lead", leadId, "history"] });
      qc.invalidateQueries({ queryKey: ["admin-leads"] });
    });

  return (
    <section className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
      <h2 className="font-serif text-lg mb-1">Lead fields</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Click any value to edit. Saves on Enter or when you click away. Every
        change is recorded in the History below.
      </p>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <EditableField label="Name" value={lead.name} onSave={(v) => save({ name: v ?? "" })} />
        <EditableField label="Practice" value={lead.practice} onSave={(v) => save({ practice: v })} />
        <EditableField label="Specialty" value={lead.specialty} onSave={(v) => save({ specialty: v })} />
        <EditableField label="City" value={lead.city} onSave={(v) => save({ city: v })} />
        <EditableField label="State" value={lead.state} onSave={(v) => save({ state: v })} />
        <EditableField label="Phone" value={lead.phone} onSave={(v) => save({ phone: v })} />
        <EditableField label="Email" value={lead.email} onSave={(v) => save({ email: v })} />
        <EditableField label="Locale" type="select" options={LOCALE_OPTIONS} value={lead.locale} onSave={(v) => save({ locale: (v as "en" | "es") ?? "en" })} />
        <EditableField label="Status" type="select" options={STATUS_OPTIONS} value={lead.status} onSave={(v) => save({ status: v ?? "available" })} />
        <EditableField label="Temperature" type="select" options={TEMP_OPTIONS} value={lead.temperature} onSave={(v) => save({ temperature: v })} />
        <EditableField label="Disqualify reason" type="select" options={DISQUALIFY_OPTIONS} value={lead.disqualifyReason} onSave={(v) => save({ disqualifyReason: v })} />
        <EditableField label="Owner (rep id)" value={lead.claimedByRepId != null ? String(lead.claimedByRepId) : null} onSave={(v) => save({ claimedByRepId: v ? Number(v) : null })} />
        <EditableField label="Calendly URL" value={lead.calendlyUrl} onSave={(v) => save({ calendlyUrl: v })} />
        <EditableField label="Doxy URL" value={lead.doxyUrl} onSave={(v) => save({ doxyUrl: v })} />
        <div className="md:col-span-2">
          <EditableField label="Current site" value={lead.currentWebsite} onSave={(v) => save({ currentWebsite: v })} />
        </div>
        <div className="md:col-span-2">
          <EditableField label="Disqualify note" multiline value={lead.disqualifyNote} onSave={(v) => save({ disqualifyNote: v })} />
        </div>
        <div className="md:col-span-2">
          <EditableField label="Profile blurb" multiline value={lead.profileBlurb} onSave={(v) => save({ profileBlurb: v })} />
        </div>
      </dl>
    </section>
  );
}

// ── Bundle 1.4 — lead change history (read-only) ────────────────────────────
const fmtHistVal = (v: unknown): string =>
  v === null || v === undefined || v === "" ? "—" : String(v);

function HistoryDiff({ entry }: { entry: LeadHistoryEntry }) {
  const after = entry.after ?? {};
  const before = entry.before ?? {};
  const keys = Object.keys(after);
  const changed = keys.filter(
    (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
  );
  if (changed.length === 0) {
    return <div className="text-xs text-muted-foreground">{entry.action}</div>;
  }
  return (
    <div className="space-y-0.5">
      {changed.map((k) => (
        <div key={k} className="text-xs">
          <span className="font-medium">{k}</span>:{" "}
          <span className="text-muted-foreground line-through">
            {fmtHistVal(before[k])}
          </span>{" "}
          → <span>{fmtHistVal(after[k])}</span>
        </div>
      ))}
    </div>
  );
}

function HistoryCard({ leadId }: { leadId: number }) {
  const q = useQuery({
    queryKey: ["admin", "lead", leadId, "history"],
    queryFn: () => api.leadHistory(leadId),
  });
  const entries = q.data?.history ?? [];
  return (
    <section className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
      <h2 className="font-serif text-lg mb-4">History</h2>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No changes recorded yet. Edits to the fields above will appear here.
        </p>
      ) : (
        <ul className="space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="border-b border-border/60 pb-2 last:border-0">
              <div className="text-xs text-muted-foreground mb-1">
                {fmtDateTime(e.at)} · {e.actor}
              </div>
              <HistoryDiff entry={e} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function QualityCheckCard({
  leadId,
  lead,
}: {
  leadId: number;
  lead: { qcStatus?: string | null; qcValidatedAt?: string | null; qcValidatedBy?: string | null; qcAcceptedWithoutPhoto?: boolean | null; photoUrl?: string | null; photoSource?: string | null };
}) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "lead", leadId] });
  const status = lead.qcStatus ?? "none";
  const hasRealPhoto = lead.photoUrl && lead.photoSource && lead.photoSource !== "fallback_initials";
  const canValidate = !!hasRealPhoto || lead.qcAcceptedWithoutPhoto === true;
  const callApi = async (path: string, body: Record<string, unknown> = {}) => {
    const res = await fetch(`/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "unknown" }));
      throw new Error(err.message || err.error || `HTTP ${res.status}`);
    }
    return res.json();
  };
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const action = (label: string, fn: () => Promise<unknown>) => async () => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };
  return (
    <section
      data-testid="admin-qc-card"
      className="bg-card border border-card-border rounded-xl p-6 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <h2 className="font-serif text-lg">Quality Check</h2>
        <span
          data-testid="admin-qc-status"
          className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${
            status === "validated"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
              : status === "stale"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
                : "border-muted-foreground/20 bg-muted/40 text-muted-foreground"
          }`}
        >
          {status === "validated" ? "✓ Validated" : status === "stale" ? "⚠ Stale" : "None"}
        </span>
      </div>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
        <div className="flex gap-2">
          <dt className="text-muted-foreground w-32 shrink-0">Photo source</dt>
          <dd data-testid="admin-qc-photo-source">{lead.photoSource ?? "—"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground w-32 shrink-0">Photo URL</dt>
          <dd className="truncate">
            {lead.photoUrl ? (
              <a href={lead.photoUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                {lead.photoUrl}
              </a>
            ) : "—"}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground w-32 shrink-0">Validated at</dt>
          <dd>{lead.qcValidatedAt ?? "—"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground w-32 shrink-0">Validated by</dt>
          <dd>{lead.qcValidatedBy ?? "—"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground w-32 shrink-0">Accept initials</dt>
          <dd>{lead.qcAcceptedWithoutPhoto ? "Yes" : "No"}</dd>
        </div>
      </dl>
      {error ? (
        <div data-testid="admin-qc-error" className="text-xs text-destructive mb-3">{error}</div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="admin-qc-validate"
          disabled={busy !== null || !canValidate}
          onClick={action("validate", () =>
            callApi(`/admin/leads/${leadId}/qc-validate`, {
              lockedFields: ["template_key", "headline", "primary_language"],
            }),
          )}
          title={!canValidate ? "No real practitioner photo. Use Accept-with-initials override first." : undefined}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === "validate" ? "Validating…" : "Validate"}
        </button>
        <button
          type="button"
          data-testid="admin-qc-accept-initials"
          disabled={busy !== null || lead.qcAcceptedWithoutPhoto === true}
          onClick={action("accept", () =>
            callApi(`/admin/leads/${leadId}/qc-accept-initials`),
          )}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input bg-background text-xs font-medium disabled:opacity-50"
        >
          {busy === "accept" ? "…" : "Accept-with-initials"}
        </button>
        <button
          type="button"
          data-testid="admin-qc-reset"
          disabled={busy !== null || status === "none"}
          onClick={action("reset", () =>
            callApi(`/admin/leads/${leadId}/qc-reset`),
          )}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-destructive/40 text-destructive text-xs font-medium disabled:opacity-50"
        >
          {busy === "reset" ? "Resetting…" : "Start over"}
        </button>
      </div>
    </section>
  );
}

/**
 * PHASE A.2 — therapist Calendly + Doxy URLs. Admins type these into
 * the LeadDetail page once the therapist shares them; the public-site
 * BookingWidget + DoxyBridge thread them into the prospect preview.
 * Bilingual labels so a Spanish-speaking admin can also read the form.
 */
function BookingUrlsCard({
  leadId,
  lead,
}: {
  leadId: number;
  lead: { calendlyUrl?: string | null; doxyUrl?: string | null };
}) {
  const qc = useQueryClient();
  const [calendlyUrl, setCalendlyUrl] = useState(lead.calendlyUrl ?? "");
  const [doxyUrl, setDoxyUrl] = useState(lead.doxyUrl ?? "");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setCalendlyUrl(lead.calendlyUrl ?? "");
    setDoxyUrl(lead.doxyUrl ?? "");
  }, [lead.calendlyUrl, lead.doxyUrl]);
  const save = useMutation({
    mutationFn: () =>
      api.setLeadBookingUrls(leadId, {
        calendlyUrl: calendlyUrl.trim() === "" ? null : calendlyUrl.trim(),
        doxyUrl: doxyUrl.trim() === "" ? null : doxyUrl.trim(),
      }),
    onSuccess: () => {
      setInfo("Saved.");
      setError(null);
      qc.invalidateQueries({ queryKey: ["admin", "lead", leadId] });
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Failed to save."),
  });
  return (
    <section className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
      <h2 className="font-serif text-lg mb-1">
        Booking + telehealth URLs
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        URLs de reservas y telesalud. Threaded into the public-site preview
        (BookingWidget + DoxyBridge).
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-sm space-y-1.5 block">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Therapist Calendly URL · URL de Calendly
          </span>
          <input
            type="url"
            value={calendlyUrl}
            onChange={(e) => setCalendlyUrl(e.target.value)}
            placeholder="https://calendly.com/your-practice"
            className="w-full text-sm px-2 py-1.5 rounded border border-input bg-background"
          />
        </label>
        <label className="text-sm space-y-1.5 block">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Therapist Doxy URL · URL de Doxy
          </span>
          <input
            type="url"
            value={doxyUrl}
            onChange={(e) => setDoxyUrl(e.target.value)}
            placeholder="https://doxy.me/your-room"
            className="w-full text-sm px-2 py-1.5 rounded border border-input bg-background"
          />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save · Guardar"}
        </button>
        {info && <span className="text-xs text-muted-foreground">{info}</span>}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </section>
  );
}

/**
 * Customer-portal panel — moved here from the rep LeadDetail page on
 * the user's request so admins can inspect any lead's portal without
 * impersonating the assigned rep. Read-only on this surface (sending
 * the invite + manual enrichment refresh remain rep-only actions; if
 * we want to expose those to admins later, add admin equivalents of
 * `POST /dashboard/leads/:id/send-invite` and `…/enrich`).
 */
function CustomerPortalCard({ leadId }: { leadId: number }) {
  const portal = useQuery<LeadPortalDto>({
    queryKey: ["admin", "lead-portal", leadId],
    queryFn: () => api.getLeadPortal(leadId),
    refetchOnWindowFocus: false,
  });

  // ASH-8: rep/admin hero-image upload.
  const qc = useQueryClient();
  const [heroError, setHeroError] = useState<string | null>(null);
  const uploadHero = useMutation({
    mutationFn: (dataUrl: string) => api.uploadLeadHeroImage(leadId, dataUrl),
    onSuccess: () => {
      setHeroError(null);
      qc.invalidateQueries({ queryKey: ["admin", "lead-portal", leadId] });
    },
    onError: (e) =>
      setHeroError(e instanceof Error ? e.message : "Upload failed."),
  });
  const onHeroFile = (file: File | null | undefined) => {
    setHeroError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setHeroError("Please choose an image file.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setHeroError("Image too large (max 4 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setHeroError("Could not read that file.");
    reader.onload = () => {
      if (typeof reader.result === "string") uploadHero.mutate(reader.result);
    };
    reader.readAsDataURL(file);
  };

  if (portal.isPending) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
        <h2 className="font-serif text-lg mb-3">Customer portal</h2>
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (portal.isError || !portal.data) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
        <h2 className="font-serif text-lg mb-3">Customer portal</h2>
        <div className="text-sm text-destructive">
          Could not load the portal.{" "}
          <button
            onClick={() => portal.refetch()}
            className="underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const p = portal.data;
  // Prefer the short link in the visible URL row to match what the rep
  // would copy/paste; fall back to the long URL when the shortener was
  // unavailable.
  const primaryUrl = p.shortUrl ?? p.url;

  const missingKeys: string[] = [];
  if (!p.integrations.sms) missingKeys.push("SMS provider");
  if (!p.integrations.email) missingKeys.push("RESEND_API_KEY");

  return (
    <div className="space-y-3">
      {missingKeys.length > 0 && (
        <div className="rounded-md border border-yellow-300/60 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-800/60 px-3 py-2 text-xs text-yellow-900 dark:text-yellow-100">
          <strong className="font-medium">Outbound delivery disabled.</strong>{" "}
          Missing: {missingKeys.join(", ")}. Messages will save but not deliver.
        </div>
      )}

      <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-serif text-lg">Customer portal</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {p.openCount > 0
                ? `${p.openCount} open${p.openCount > 1 ? "s" : ""}${
                    p.lastOpenedAt
                      ? ` · last ${fmtDateTime(p.lastOpenedAt)}`
                      : ""
                  }`
                : p.inviteSentAt
                  ? `Invitation sent ${fmtDateTime(p.inviteSentAt)} — not opened yet`
                  : "No invitation sent yet"}
              {p.reservedAt ? ` · reserved ${fmtDateTime(p.reservedAt)}` : ""}
            </p>
          </div>
          {p.reservedAt ? (
            <span className="inline-flex items-center text-xs px-2 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary">
              Reserved
            </span>
          ) : p.openCount > 0 ? (
            <span className="inline-flex items-center text-xs px-2 py-1 rounded-full border border-accent/30 bg-accent/10 text-accent">
              Viewed
            </span>
          ) : null}
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-xs">
            <code className="flex-1 truncate rounded-md border border-input bg-background px-2 py-1 text-foreground">
              {primaryUrl}
            </code>
            <a
              href={primaryUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-input bg-background hover:bg-muted"
              title="Open as prospect"
            >
              <ExternalLink size={12} /> Open
            </a>
          </div>
          {p.shortUrl && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">
                Show full URL
              </summary>
              <code className="block mt-1 truncate rounded-md border border-input bg-background px-2 py-1">
                {p.url}
              </code>
            </details>
          )}
        </div>

        {/* ASH-8: therapist hero photo upload. Saves to storage and renders
            on the preview (rep + client side). */}
        <div className="mb-4 rounded-md border border-input bg-background/60 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Hero photo
            </span>
            {p.heroImageUrl ? (
              <span className="text-[11px] text-accent">Set ✓</span>
            ) : null}
          </div>
          {p.heroImageUrl ? (
            <img
              src={p.heroImageUrl}
              alt="Lead hero"
              className="mt-2 h-20 w-20 rounded-md object-cover border border-input"
            />
          ) : null}
          <input
            type="file"
            accept="image/*"
            disabled={uploadHero.isPending}
            onChange={(e) => onHeroFile(e.target.files?.[0])}
            data-testid="lead-hero-upload"
            className="mt-2 w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-muted file:text-foreground hover:file:bg-muted/80"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {uploadHero.isPending
              ? "Uploading…"
              : "JPG/PNG/WebP, up to 4 MB. Replaces the preview photo."}
          </p>
          {heroError ? (
            <p className="mt-1 text-[11px] text-destructive">{heroError}</p>
          ) : null}
        </div>

        <div className="flex items-center flex-wrap gap-2 mb-4">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Data completeness
          </span>
          <span
            className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border border-accent/30 bg-accent/10 text-accent"
            title="Number of preview-ready fields populated out of the 10 the prospect's portal renders"
          >
            {p.fieldsCompleteness.filled}/{p.fieldsCompleteness.total} fields
          </span>
          <span
            className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border border-muted-foreground/20 bg-muted/40 text-muted-foreground"
            title="Number of upstream sources that returned data"
          >
            {p.enrichmentCompleteness.sourcesAvailable}/
            {p.enrichmentCompleteness.sourcesTotal} sources
          </span>
        </div>

        {p.enrichment.length > 0 ? (
          <details className="group">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Per-source detail ({p.enrichment.length})
            </summary>
            <ul className="mt-2 space-y-1 text-xs">
              {p.enrichment.map((e) => (
                <li key={e.sourceKey} className="flex justify-between gap-2">
                  <span>
                    <span className="font-medium">{e.sourceKey}</span>
                    {e.summary && (
                      <span className="text-muted-foreground"> — {e.summary}</span>
                    )}
                  </span>
                  <span className="text-muted-foreground shrink-0">
                    {e.confidence != null
                      ? `${Math.round(e.confidence)}%`
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <div className="text-xs text-muted-foreground">
            No data pulled yet — the assigned rep needs to open the prospect
            preview to trigger enrichment.
          </div>
        )}
      </div>
    </div>
  );
}
