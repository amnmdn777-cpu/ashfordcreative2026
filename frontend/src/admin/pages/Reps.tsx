import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Eye, EyeOff, MessageSquare, Plus, ShieldCheck, X } from "lucide-react";
import { api, fmtCents, fmtDate, type RepRow } from "@admin/lib/api";
import { PageHeader } from "@admin/components/AdminLayout";

export default function RepsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "reps"],
    queryFn: () => api.listReps(),
  });

  const { data: msgSummary } = useQuery({
    queryKey: ["admin", "messages", "summary"],
    queryFn: () => api.messagesSummary(),
    refetchInterval: 30000,
  });
  const unreadByRepId = new Map<number, number>(
    (msgSummary?.unreadByRep ?? []).map((u) => [u.repId, u.unreadCount]),
  );

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api.patchRep(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "reps"] }),
  });

  const promote = useMutation({
    mutationFn: ({ id, role }: { id: number; role: "rep" | "admin" }) =>
      api.patchRep(id, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "reps"] }),
  });

  return (
    <div className="p-6 md:p-10">
      <PageHeader
        title="Sales reps"
        description="Reps claim leads, close sales, earn commissions. Promote a rep to admin to grant dashboard access."
        actions={
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90"
          >
            <Plus size={14} /> Add rep
          </button>
        }
      />

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {error && (
        <div className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load reps"}
        </div>
      )}

      {data && (
        <div className="bg-card border border-card-border rounded-lg shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
              <tr className="text-left">
                <th className="py-2.5 px-4">Display name</th>
                <th className="py-2.5 px-4">Username</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">Promo</th>
                <th className="py-2.5 px-4">Rate</th>
                <th className="py-2.5 px-4">Joined</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Messages</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.reps.map((r) => {
                const unread = unreadByRepId.get(r.id) ?? 0;
                return (
                <tr key={r.id} className={r.isActive ? "" : "opacity-50"}>
                  <td className="py-2.5 px-4 font-medium">
                    <Link
                      href={`/reps/${r.id}`}
                      className="hover:underline"
                    >
                      {r.displayName}
                    </Link>
                  </td>
                  <td className="py-2.5 px-4 text-muted-foreground">@{r.username}</td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                        r.role === "admin"
                          ? "bg-accent/20 text-accent-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.role === "admin" && <ShieldCheck size={11} />}
                      {r.role}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs">{r.promoCode}</td>
                  <td className="py-2.5 px-4 font-mono text-xs">
                    {fmtCents(r.hourlyRateCents)}/hr
                  </td>
                  <td className="py-2.5 px-4 text-muted-foreground text-xs">
                    {fmtDate(r.createdAt)}
                  </td>
                  <td className="py-2.5 px-4">
                    {r.isActive ? (
                      <span className="text-xs text-primary">Active</span>
                    ) : (
                      <span className="text-xs text-destructive">Disabled</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    <Link
                      href={`/reps/${r.id}`}
                      className="inline-flex items-center gap-1 text-xs text-foreground hover:underline"
                    >
                      <MessageSquare size={12} /> Open thread
                      {unread > 0 && (
                        <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="py-2.5 px-4 text-right space-x-2">
                    <button
                      type="button"
                      className="text-xs text-foreground hover:underline"
                      disabled={promote.isPending}
                      onClick={() =>
                        promote.mutate({
                          id: r.id,
                          role: r.role === "admin" ? "rep" : "admin",
                        })
                      }
                    >
                      {r.role === "admin" ? "Demote" : "Promote"}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-destructive hover:underline"
                      disabled={toggleActive.isPending}
                      onClick={() =>
                        toggleActive.mutate({ id: r.id, isActive: !r.isActive })
                      }
                    >
                      {r.isActive ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
          {data.reps.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No reps yet.</div>
          )}
        </div>
      )}

      {showCreate && <CreateRepModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateRepModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    password: "",
    promoCode: "",
    role: "rep" as "rep" | "admin",
    hourlyRateCents: 2500,
  });
  const [showPassword, setShowPassword] = useState(false);

  const m = useMutation({
    mutationFn: () => api.createRep(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "reps"] });
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate();
  };

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="bg-card border border-card-border rounded-xl shadow-xl w-full max-w-md p-6 relative"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1 hover:bg-muted rounded"
          aria-label="Close"
        >
          <X size={16} />
        </button>
        <h2 className="font-serif text-xl mb-4">Add a sales rep</h2>

        <div className="space-y-3">
          <Field label="Display name">
            <input
              required
              value={form.displayName}
              onChange={(e) => set("displayName", e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Username">
            <input
              required
              minLength={2}
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Password (min 8)">
            <div className="relative">
              <input
                required
                minLength={8}
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                className={`${INPUT_CLASS} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
          <Field label="Promo code (UPPERCASE)">
            <input
              required
              minLength={2}
              maxLength={12}
              value={form.promoCode}
              onChange={(e) => set("promoCode", e.target.value.toUpperCase())}
              className={`${INPUT_CLASS} font-mono uppercase`}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role">
              <select
                value={form.role}
                onChange={(e) => set("role", e.target.value as "rep" | "admin")}
                className={INPUT_CLASS}
              >
                <option value="rep">Rep</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <Field label="Hourly rate ($)">
              <input
                type="number"
                min={0}
                value={form.hourlyRateCents / 100}
                onChange={(e) =>
                  set("hourlyRateCents", Math.round(Number(e.target.value) * 100))
                }
                className={INPUT_CLASS}
              />
            </Field>
          </div>
        </div>

        {m.error && (
          <div className="mt-3 text-sm text-destructive">
            {m.error instanceof Error ? m.error.message : "Failed"}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={m.isPending}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
          >
            {m.isPending ? "Creating…" : "Create rep"}
          </button>
        </div>
      </form>
    </div>
  );
}

const INPUT_CLASS =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export { RepRow };
