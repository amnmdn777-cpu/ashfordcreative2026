import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ExternalLink, ArrowLeft, Upload, FileDown, Trash2, Paperclip } from "lucide-react";
import {
  api,
  fmtDateTime,
  type LeadPortalDto,
  type LeadRow,
  type LeadHistoryEntry,
  type LeadAttachment,
} from "@admin/lib/api";
import { PageHeader } from "@admin/components/AdminLayout";

/**
 * Admin LeadDetail page. The Customer-portal panel lives here (it was
 * moved out of the rep dashboard so admins, who oversee every lead in
 * the pool, have a single place to inspect a prospect's portal URL,
 * open count, and enrichment completeness without claiming the lead.
 */

export default function LeadDetailPage() {
  const [, params] = useRoute<{ id: string }>("/leads/:id");
  const id = params ? Number(params.id) : 0;

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

      <ContactsCard leadId={id} />

      <QualityCheckCard leadId={id} lead={lead as any} />

      <BookingUrlsCard leadId={id} lead={lead} />

      <CustomerPortalCard leadId={id} />

      <FilesCard leadId={id} />

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

function ContactsCard({ leadId }: { leadId: number }) {
  const qc = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "lead", leadId, "contacts"],
    queryFn: () => api.listLeadContacts(leadId),
  });

  const contacts = data?.contacts ?? [];

  const addContact = useMutation({
    mutationFn: (contact: { kind: "phone" | "email"; value: string; label?: string; isPrimary?: boolean }) =>
      api.addLeadContact(leadId, contact),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "lead", leadId, "contacts"] });
      qc.invalidateQueries({ queryKey: ["admin", "lead", leadId] });
      qc.invalidateQueries({ queryKey: ["admin", "lead", leadId, "history"] });
      qc.invalidateQueries({ queryKey: ["admin-leads"] });
    },
  });

  const updateContact = useMutation({
    mutationFn: ({ contactId, patch }: { contactId: number; patch: Partial<{ value: string; isPrimary: boolean; label: string | null }> }) =>
      api.updateLeadContact(leadId, contactId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "lead", leadId, "contacts"] });
      qc.invalidateQueries({ queryKey: ["admin", "lead", leadId] });
      qc.invalidateQueries({ queryKey: ["admin", "lead", leadId, "history"] });
      qc.invalidateQueries({ queryKey: ["admin-leads"] });
    },
  });

  const deleteContact = useMutation({
    mutationFn: (contactId: number) => api.deleteLeadContact(leadId, contactId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "lead", leadId, "contacts"] });
      qc.invalidateQueries({ queryKey: ["admin", "lead", leadId] });
      qc.invalidateQueries({ queryKey: ["admin", "lead", leadId, "history"] });
      qc.invalidateQueries({ queryKey: ["admin-leads"] });
    },
  });

  const [newKind, setNewKind] = useState<"phone" | "email">("phone");
  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editLabel, setEditLabel] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!newValue.trim()) {
      setFormError("Value is required");
      return;
    }
    try {
      await addContact.mutateAsync({
        kind: newKind,
        value: newValue.trim(),
        label: newLabel.trim() || undefined,
        isPrimary: false,
      });
      setNewValue("");
      setNewLabel("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add contact");
    }
  };

  const handleStartEdit = (c: any) => {
    setEditingId(c.id);
    setEditValue(c.value);
    setEditLabel(c.label ?? "");
  };

  const handleSaveEdit = async (contactId: number) => {
    if (!editValue.trim()) return;
    try {
      await updateContact.mutateAsync({
        contactId,
        patch: {
          value: editValue.trim(),
          label: editLabel.trim() || null,
        },
      });
      setEditingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save contact");
    }
  };

  const handleSetPrimary = async (contactId: number) => {
    try {
      await updateContact.mutateAsync({
        contactId,
        patch: { isPrimary: true },
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to set primary");
    }
  };

  if (isLoading) {
    return (
      <section className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
        <h2 className="font-serif text-lg mb-2">Contacts</h2>
        <p className="text-sm text-muted-foreground">Loading contacts…</p>
      </section>
    );
  }

  return (
    <section className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
      <h2 className="font-serif text-lg mb-1">Contacts</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Manage multiple phone numbers and email addresses. Mark one of each as primary.
      </p>

      {isError && (
        <div className="text-sm text-destructive mb-4">
          Error: {error instanceof Error ? error.message : "Failed to load contacts"}
        </div>
      )}

      <div className="space-y-4 mb-6">
        {(["phone", "email"] as const).map((kind) => {
          const filtered = contacts.filter((c) => c.kind === kind);
          return (
            <div key={kind} className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {kind === "phone" ? "Phone Numbers" : "Email Addresses"}
              </h3>
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground italic pl-2">No {kind}s added yet.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {filtered.map((c) => {
                    const isEditing = editingId === c.id;
                    return (
                      <div key={c.id} className="flex items-center justify-between py-2 pl-2 hover:bg-muted/40 rounded transition-colors text-sm">
                        <div className="flex-1 min-w-0 pr-4">
                          {isEditing ? (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs"
                                placeholder={kind === "phone" ? "Phone" : "Email"}
                              />
                              <input
                                type="text"
                                value={editLabel}
                                onChange={(e) => setEditLabel(e.target.value)}
                                className="w-24 rounded border border-input bg-background px-2 py-1 text-xs"
                                placeholder="Label (e.g. Work)"
                              />
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(c.id)}
                                  className="px-2 py-1 bg-primary text-primary-foreground rounded text-[10px]"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="px-2 py-1 border border-border rounded text-[10px]"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-mono">{c.value}</span>
                              {c.label && (
                                <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold">
                                  {c.label}
                                </span>
                              )}
                              {c.isPrimary && (
                                <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5">
                                  ⭐ Primary
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="flex items-center gap-2">
                            {!c.isPrimary && (
                              <button
                                type="button"
                                onClick={() => handleSetPrimary(c.id)}
                                className="text-xs text-accent hover:underline"
                              >
                                Make Primary
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleStartEdit(c)}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this contact?")) {
                                  deleteContact.mutate(c.id);
                                }
                              }}
                              disabled={deleteContact.isPending}
                              className="text-xs text-destructive hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={handleAdd} className="border-t border-border pt-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Add Contact
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as "phone" | "email")}
            className="rounded border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="phone">Phone</option>
            <option value="email">Email</option>
          </select>
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={newKind === "phone" ? "e.g. +1 512-555-0199" : "e.g. therapist@example.com"}
            className="flex-1 rounded border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (e.g. Work, Cell)"
            className="w-40 rounded border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={addContact.isPending}
            className="rounded bg-accent text-accent-foreground px-4 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
          >
            {addContact.isPending ? "Adding…" : "Add"}
          </button>
        </div>
        {formError && <p className="text-xs text-destructive mt-2">{formError}</p>}
      </form>
    </section>
  );
}

// ── Bundle 3 — file attachments ─────────────────────────────────────────────
const ATTACH_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.txt,.csv,.xls,.xlsx";
const ATTACH_MAX_BYTES = 10 * 1024 * 1024;

const fmtBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

function FilesCard({ leadId }: { leadId: number }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "lead", leadId, "attachments"],
    queryFn: () => api.listLeadAttachments(leadId),
  });
  const files = q.data?.attachments ?? [];
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const upload = async (file: File) => {
    setErr(null);
    if (file.size > ATTACH_MAX_BYTES) {
      setErr("File too large (max 10 MB).");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(new Error("Could not read file"));
        fr.readAsDataURL(file);
      });
      await api.uploadLeadAttachment(leadId, { filename: file.name, dataUrl });
      qc.invalidateQueries({
        queryKey: ["admin", "lead", leadId, "attachments"],
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onDownload = async (att: LeadAttachment) => {
    try {
      const blob = await api.downloadAttachmentBlob(att.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = att.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Download failed");
    }
  };

  const onDelete = async (att: LeadAttachment) => {
    if (!window.confirm(`Delete "${att.filename}"?`)) return;
    try {
      await api.deleteLeadAttachment(att.id);
      qc.invalidateQueries({
        queryKey: ["admin", "lead", leadId, "attachments"],
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <section className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
      <h2 className="font-serif text-lg mb-1 flex items-center gap-2">
        <Paperclip size={16} /> Files
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        PDF, images, Word/Excel, CSV or text · max 10 MB each.
      </p>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-sm cursor-pointer transition-colors ${
          dragOver ? "border-accent bg-accent/10" : "border-input hover:bg-muted/40"
        }`}
      >
        <Upload size={18} className="text-muted-foreground" />
        <span className="text-muted-foreground">
          {uploading ? "Uploading…" : "Drag a file here, or click to choose"}
        </span>
        <input
          type="file"
          accept={ATTACH_ACCEPT}
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </label>

      {err && <div className="text-xs text-destructive mt-2">{err}</div>}

      <div className="mt-4">
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files attached yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{f.filename}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtBytes(f.sizeBytes)} · {fmtDateTime(f.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onDownload(f)}
                    title="Download"
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <FileDown size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(f)}
                    title="Delete"
                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
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
