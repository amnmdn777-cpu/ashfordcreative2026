import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bell, MessageSquareWarning, Send } from "lucide-react";
import { api } from "@admin/lib/api";

// 2026-05-14: highlight @Ashford inside note bodies in bold blue so the
// admin can see at a glance where they were tagged. The regex is the
// same one the API uses to detect the mention (case-insensitive, word
// boundary).
function MentionText({ text }: { text: string }) {
  const parts = useMemo(() => {
    const out: Array<{ kind: "text" | "mention"; value: string }> = [];
    const re = /@Ashford\b/gi;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) {
        out.push({ kind: "text", value: text.slice(last, m.index) });
      }
      out.push({ kind: "mention", value: m[0] });
      last = m.index + m[0].length;
    }
    if (last < text.length) {
      out.push({ kind: "text", value: text.slice(last) });
    }
    return out;
  }, [text]);
  return (
    <span className="text-sm whitespace-pre-wrap break-words">
      {parts.map((p, i) =>
        p.kind === "mention" ? (
          <strong
            key={i}
            className="font-bold text-blue-600 dark:text-blue-400"
          >
            {p.value}
          </strong>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </span>
  );
}

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

// 2026-05-14: inline reply composer. Sends the body to the new
// POST /admin/notifications/:id/reply endpoint which (1) appends the
// reply as a rep-note on the lead, (2) fires an in-dashboard
// notification for the rep, (3) emails the rep, and (4) marks this
// mention as read. The component stays mounted after success so the
// admin sees the "Replied — emailed <rep>" confirmation chip until
// the parent query refetches.
function ReplyComposer({
  notificationId,
  onSent,
}: {
  notificationId: number;
  onSent: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState<
    | { kind: "ok"; repName: string; emailed: boolean }
    | { kind: "err"; message: string }
    | null
  >(null);
  const reply = useMutation({
    mutationFn: (body: string) =>
      api.replyToAdminNotification(notificationId, body),
    onSuccess: (res) => {
      setDraft("");
      setFeedback({
        kind: "ok",
        repName: res.note.rep.displayName,
        emailed: res.note.rep.emailed,
      });
      onSent();
    },
    onError: (err: Error) => {
      setFeedback({ kind: "err", message: err.message });
    },
  });

  const send = () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || reply.isPending) return;
    setFeedback(null);
    reply.mutate(trimmed);
  };

  return (
    <div className="mt-3 border-t border-card-border pt-3">
      <label
        htmlFor={`reply-${notificationId}`}
        className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
      >
        Répondre à la vendeuse
      </label>
      <textarea
        id={`reply-${notificationId}`}
        data-testid={`reply-input-${notificationId}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
          }
        }}
        placeholder="Écris ta réponse — elle apparaitra dans les notes du prospect et la vendeuse recevra un mail."
        rows={3}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-[11px] text-muted-foreground">
          {feedback?.kind === "ok" ? (
            <span className="text-green-700 dark:text-green-400">
              ✓ Répondu — {feedback.emailed ? `email envoyé à ${feedback.repName}` : `${feedback.repName} notifiée (pas d'email)`}
            </span>
          ) : feedback?.kind === "err" ? (
            <span className="text-red-600">Erreur : {feedback.message}</span>
          ) : (
            <span>⌘/Ctrl + Enter pour envoyer</span>
          )}
        </span>
        <button
          type="button"
          data-testid={`reply-send-${notificationId}`}
          onClick={send}
          disabled={reply.isPending || draft.trim().length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={13} />
          {reply.isPending ? "Envoi…" : "Envoyer"}
        </button>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [showRead, setShowRead] = useState(false);
  const [openReplyFor, setOpenReplyFor] = useState<number | null>(null);
  const q = useQuery({
    queryKey: ["admin-notifications", showRead ? "all" : "unread"],
    queryFn: () => api.listAdminNotifications(!showRead),
    refetchInterval: 30_000,
  });
  const markRead = useMutation({
    mutationFn: (id: number) => api.markAdminNotificationRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-notifications"] });
    },
  });

  const rows = q.data?.notifications ?? [];
  const unreadCount = rows.filter((n) => !n.readAt).length;

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-1">
        <Bell size={20} className="text-blue-600" />
        <h1 className="text-xl font-semibold">Mentions</h1>
        {unreadCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-red-600 text-white text-[11px] font-semibold">
            {unreadCount}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Toutes les notes ou une vendeuse t'a tague avec{" "}
        <strong className="text-blue-600">@Ashford</strong>. Réponds-lui ici —
        elle reçoit un mail et voit ta réponse dans son tableau de bord.
      </p>

      <div className="flex items-center gap-3 mb-4 text-xs">
        <button
          type="button"
          onClick={() => setShowRead(false)}
          className={`px-2.5 py-1 rounded-full border transition-colors ${
            !showRead
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-background border-input text-muted-foreground hover:text-foreground"
          }`}
        >
          Non lues
        </button>
        <button
          type="button"
          onClick={() => setShowRead(true)}
          className={`px-2.5 py-1 rounded-full border transition-colors ${
            showRead
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-background border-input text-muted-foreground hover:text-foreground"
          }`}
        >
          Tout
        </button>
      </div>

      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-12 bg-card border border-card-border rounded-xl">
          <MessageSquareWarning
            size={28}
            className="text-muted-foreground mb-2"
          />
          <div className="text-sm text-muted-foreground">
            {showRead
              ? "Aucun tag pour le moment."
              : "Aucun nouveau tag — toutes les mentions sont lues."}
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((n) => {
            const unread = !n.readAt;
            const replyOpen = openReplyFor === n.id;
            return (
              <li
                key={n.id}
                data-testid={`mention-row-${n.id}`}
                className={
                  "rounded-md border bg-card p-4 shadow-sm transition-opacity " +
                  (unread
                    ? "border-blue-500/50 ring-1 ring-blue-500/20"
                    : "border-card-border opacity-90")
                }
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">
                    {unread && (
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-600" />
                    )}
                    {n.kind === "rep_tag" ? "Rep tag" : n.kind} · rep #
                    {n.repId ?? "?"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {fmtRelative(n.createdAt)}
                  </span>
                </div>
                {n.body ? <MentionText text={n.body} /> : null}
                <div className="mt-3 flex items-center flex-wrap gap-3">
                  {n.leadId ? (
                    <Link
                      href={`/leads/${n.leadId}`}
                      onClick={() => {
                        if (unread) markRead.mutate(n.id);
                      }}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Ouvrir la fiche prospect →
                    </Link>
                  ) : null}
                  {n.leadId && n.repId ? (
                    <button
                      type="button"
                      data-testid={`reply-toggle-${n.id}`}
                      onClick={() =>
                        setOpenReplyFor(replyOpen ? null : n.id)
                      }
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                    >
                      <Send size={12} />
                      {replyOpen ? "Fermer" : "Répondre"}
                    </button>
                  ) : null}
                  {unread ? (
                    <button
                      type="button"
                      onClick={() => markRead.mutate(n.id)}
                      disabled={markRead.isPending}
                      className="text-xs underline text-muted-foreground hover:text-foreground ml-auto"
                    >
                      Marquer comme lu
                    </button>
                  ) : null}
                </div>
                {replyOpen && n.leadId && n.repId ? (
                  <ReplyComposer
                    notificationId={n.id}
                    onSent={() => {
                      qc.invalidateQueries({
                        queryKey: ["admin-notifications"],
                      });
                    }}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
