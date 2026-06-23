import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Paperclip, Upload, FileDown, Trash2, Plus, Star } from "lucide-react";
import {
  api,
  apiUrl,
  type RepLeadContact,
  type RepLeadAttachment,
  type RepLeadHistoryEntry,
} from "@rep/lib/api";
import type { LeadDto } from "@workspace/api-zod";

/**
 * M8 — the admin lead-dashboard capabilities, brought to the rep's lead page
 * (owner-gated on the backend). Four self-contained cards: inline-edit fields,
 * multiple contacts, file attachments, and change history. Nothing the rep
 * already had is removed — this is purely additive.
 */
export function LeadAdminPanel({ leadId, lead }: { leadId: number; lead: LeadDto }) {
  return (
    <div className="space-y-6 mt-6">
      {/* QA Change #5 Issue 3 (2026-06-23): Lead Fields and Contacts are now
          SEPARATE cards again, matching the admin lead panel Amine verified as
          correct. History renders separately (collapsed, below Notes) via
          <LeadHistoryCard />. */}
      <EditableFieldsCard leadId={leadId} lead={lead} />
      <ContactsCard leadId={leadId} />
      <FilesCard leadId={leadId} />
    </div>
  );
}

const inputCls =
  "w-full rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function EditableField({
  label,
  value,
  onSave,
  multiline,
}: {
  label: string;
  value: string | null | undefined;
  onSave: (v: string | null) => Promise<void>;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setDraft(value ?? ""), [value]);

  const commit = async () => {
    setEditing(false);
    const next = draft.trim();
    if (next === (value ?? "").toString()) return;
    setSaving(true);
    setErr(null);
    try {
      await onSave(next === "" ? null : next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
      setDraft((value ?? "").toString());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex gap-2 items-start">
      <dt className="text-muted-foreground w-28 shrink-0 pt-1">{label}</dt>
      <dd className="flex-1 min-w-0">
        {editing ? (
          multiline ? (
            <textarea
              autoFocus
              rows={5}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                // Enter inserts a newline; Cmd/Ctrl+Enter or Escape commits.
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
                if (e.key === "Escape") setEditing(false);
              }}
              className={`${inputCls} min-h-[7rem] resize-y leading-relaxed`}
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
            className="text-left hover:bg-muted/60 rounded px-1 -mx-1 w-full min-h-[1.75rem] break-words"
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

function EditableFieldsCard({ leadId, lead, bare }: { leadId: number; lead: LeadDto; bare?: boolean }) {
  const qc = useQueryClient();
  const [local, setLocal] = useState<Record<string, string | null>>({});
  const get = (k: keyof LeadDto): string | null =>
    (local[k as string] ?? (lead[k] as string | null | undefined) ?? null);
  const save = async (patch: Record<string, string | null>) => {
    await api.updateLeadFields(leadId, patch);
    setLocal((p) => ({ ...p, ...patch }));
    qc.invalidateQueries({ queryKey: ["rep", "lead", leadId, "history"] });
  };

  const inner = (
    <>
      <h2 className="font-serif text-lg mb-1">Lead fields</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Click any value to edit. Saves on Enter or when you click away. Changes
        are logged in History.
      </p>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <EditableField label="Name" value={get("name")} onSave={(v) => save({ name: v ?? "" })} />
        <EditableField label="Practice" value={get("practice")} onSave={(v) => save({ practice: v ?? "" })} />
        <EditableField label="Specialty" value={get("specialty")} onSave={(v) => save({ specialty: v ?? "" })} />
        <EditableField label="City" value={get("city")} onSave={(v) => save({ city: v ?? "" })} />
        <EditableField label="State" value={get("state")} onSave={(v) => save({ state: v ?? "" })} />
        <EditableField label="Phone" value={get("phone")} onSave={(v) => save({ phone: v ?? "" })} />
        <EditableField label="Email" value={get("email")} onSave={(v) => save({ email: v })} />
        <div className="md:col-span-2">
          <EditableField label="Current site" value={get("currentWebsite")} onSave={(v) => save({ currentWebsite: v })} />
        </div>
        <div className="md:col-span-2">
          <EditableField
            label="About / Bio"
            value={get("bioOverride")}
            onSave={(v) => save({ bioOverride: v })}
            multiline
          />
        </div>
      </dl>
      <p className="text-xs text-muted-foreground mt-3">
        “About / Bio” overrides the write-up shown on the prospect portal —
        use it to fix anything the scrape got wrong. Leave blank to keep the
        auto-generated bio.
      </p>
    </>
  );
  if (bare) return inner;
  return (
    <section className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
      {inner}
    </section>
  );
}

// ── Contacts ────────────────────────────────────────────────────────────
function ContactsCard({ leadId, bare }: { leadId: number; bare?: boolean }) {
  const qc = useQueryClient();
  const key = ["rep", "lead", leadId, "contacts"];
  const q = useQuery({ queryKey: key, queryFn: () => api.listLeadContacts(leadId) });
  const contacts = q.data?.contacts ?? [];
  const [kind, setKind] = useState<"phone" | "email">("phone");
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const add = async () => {
    if (!value.trim()) return;
    setErr(null);
    try {
      await api.addLeadContact(leadId, { kind, value: value.trim() });
      setValue("");
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Add failed");
    }
  };
  const makePrimary = async (c: RepLeadContact) => {
    // EB#4 (2026-06-23): this used to throw silently on failure, so a rep
    // clicking the star saw nothing happen ("the UI did not allow it").
    // Surface the error and clear it on success.
    try {
      setErr(null);
      await api.updateLeadContact(leadId, c.id, { isPrimary: true });
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not set as primary.");
    }
  };
  const remove = async (c: RepLeadContact) => {
    if (!window.confirm(`Delete ${c.value}?`)) return;
    try {
      setErr(null);
      await api.deleteLeadContact(leadId, c.id);
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not delete contact.");
    }
  };

  const row = (c: RepLeadContact) => (
    <li key={c.id} className="flex items-center justify-between gap-2 py-1.5">
      <div className="min-w-0">
        <span className="font-medium">{c.value}</span>
        {c.isPrimary && (
          // NEW-BUG-6: "primary" is per-channel (one primary phone + one
          // primary email) — both are intentional. The pill names the channel
          // so two "Primary" tags across the two columns don't read like a bug.
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent text-[11px] px-1.5 py-0.5 align-middle">
            <Star size={10} className="fill-current" />
            Primary {c.kind === "phone" ? "phone" : "email"}
          </span>
        )}
        {c.label && <span className="ml-2 text-xs text-muted-foreground">{c.label}</span>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!c.isPrimary && (
          // EB#4: visible text affordance (not just an icon) so the rep can
          // clearly set any phone/email as the primary for its channel.
          <button type="button" onClick={() => makePrimary(c)} title="Make this the primary" className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-muted text-muted-foreground hover:text-foreground">
            <Star size={12} />
            Set primary
          </button>
        )}
        <button type="button" onClick={() => remove(c)} title="Delete" className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  );

  const inner = (
    <>
      <h2 className="font-serif text-lg mb-1">Contacts</h2>
      <p className="text-xs text-muted-foreground mb-3">
        Multiple phone numbers and emails per lead. The primary drives calls and emails.
      </p>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Phones</div>
            <ul className="divide-y divide-border/60 text-sm">
              {contacts.filter((c) => c.kind === "phone").map(row)}
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Emails</div>
            <ul className="divide-y divide-border/60 text-sm">
              {contacts.filter((c) => c.kind === "email").map(row)}
            </ul>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 mt-4">
        <select value={kind} onChange={(e) => setKind(e.target.value as "phone" | "email")} className={inputCls + " w-24"}>
          <option value="phone">Phone</option>
          <option value="email">Email</option>
        </select>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={kind === "phone" ? "(512) 555-0101" : "name@example.com"}
          className={inputCls + " flex-1"}
        />
        <button type="button" onClick={add} className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm">
          <Plus size={14} /> Add
        </button>
      </div>
      {err && <div className="text-xs text-destructive mt-1">{err}</div>}
    </>
  );
  if (bare) return inner;
  return (
    <section className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
      {inner}
    </section>
  );
}

// ── Files ───────────────────────────────────────────────────────────────
const fmtBytes = (n: number): string =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

function FilesCard({ leadId }: { leadId: number }) {
  const qc = useQueryClient();
  const key = ["rep", "lead", leadId, "attachments"];
  const q = useQuery({ queryKey: key, queryFn: () => api.listLeadAttachments(leadId) });
  const files = q.data?.attachments ?? [];
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // FR#1: optional note typed before choosing a file; sent with the upload.
  const [note, setNote] = useState("");

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setErr(null);
    if (file.size > 10 * 1024 * 1024) { setErr("File too large (max 10 MB)."); return; }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = () => rej(new Error("Could not read file"));
        r.readAsDataURL(file);
      });
      await api.uploadLeadAttachment(leadId, {
        filename: file.name,
        dataUrl,
        note: note.trim() || undefined,
      });
      setNote("");
      qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const download = async (f: RepLeadAttachment) => {
    try {
      const res = await fetch(apiUrl(`/dashboard/leads/${leadId}/attachments/${f.id}/download`), { credentials: "include" });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Download failed");
    }
  };

  const remove = async (f: RepLeadAttachment) => {
    if (!window.confirm(`Delete "${f.filename}"?`)) return;
    await api.deleteLeadAttachment(leadId, f.id);
    qc.invalidateQueries({ queryKey: key });
  };

  return (
    <section className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
      <h2 className="font-serif text-lg mb-1 flex items-center gap-2"><Paperclip size={16} /> Files</h2>
      <p className="text-xs text-muted-foreground mb-3">PDF, images, Word/Excel, CSV or text · max 10 MB each.</p>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note for the next file (e.g. 'Intake form, signed')"
        maxLength={500}
        className={inputCls + " mb-2"}
      />
      <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input hover:bg-muted/40 px-4 py-6 text-sm cursor-pointer"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files?.[0]); }}>
        <Upload size={18} className="text-muted-foreground" />
        <span className="text-muted-foreground">{uploading ? "Uploading…" : "Drag a file here, or click to choose"}</span>
        <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.txt,.csv,.xls,.xlsx" className="hidden" disabled={uploading}
          onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {err && <div className="text-xs text-destructive mt-2">{err}</div>}
      <div className="mt-3">
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium truncate text-sm">{f.filename}</div>
                  {f.note ? (
                    <div className="text-xs text-foreground/70 truncate">{f.note}</div>
                  ) : null}
                  <div className="text-xs text-muted-foreground">{fmtBytes(f.sizeBytes)}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => download(f)} title="Download" className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><FileDown size={16} /></button>
                  <button type="button" onClick={() => remove(f)} title="Delete" className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 size={16} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ── History ─────────────────────────────────────────────────────────────
const fmtHistVal = (v: unknown): string =>
  v === null || v === undefined || v === "" ? "—" : String(v);

// QA Change #5 (2026-06-23): exported + collapsed-by-default so LeadDetail
// can render it BELOW the Notes panel, de-emphasising the audit log.
export function LeadHistoryCard({ leadId }: { leadId: number }) {
  const q = useQuery({
    queryKey: ["rep", "lead", leadId, "history"],
    queryFn: () => api.leadHistory(leadId),
  });
  const entries = q.data?.history ?? [];

  const diff = (e: RepLeadHistoryEntry) => {
    const after = e.after ?? {};
    const before = e.before ?? {};
    const changed = Object.keys(after).filter(
      (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
    );
    if (changed.length === 0) return <div className="text-xs text-muted-foreground">{e.action}</div>;
    return (
      <div className="space-y-0.5">
        {changed.map((k) => (
          <div key={k} className="text-xs">
            <span className="font-medium">{k}</span>:{" "}
            <span className="text-muted-foreground line-through">{fmtHistVal(before[k])}</span> →{" "}
            <span>{fmtHistVal(after[k])}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <details className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
      <summary className="font-serif text-lg cursor-pointer select-none flex items-center justify-between gap-3">
        <span>History</span>
        <span className="text-xs font-sans text-muted-foreground">
          {entries.length} change{entries.length === 1 ? "" : "s"} · click to expand
        </span>
      </summary>
      <div className="mt-3">
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
        ) : (
          <ul className="space-y-3">
            {entries.map((e) => (
              <li key={e.id} className="border-b border-border/60 pb-2 last:border-0">
                <div className="text-xs text-muted-foreground mb-1">
                  {new Date(e.at).toLocaleString()} · {e.actor}
                </div>
                {diff(e)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
