import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { api, fmtDateTime, type DirectMessageDto } from "@admin/lib/api";
import { Linkify } from "./Linkify";

export function RepChatPanel({ repId, repName }: { repId: number; repName: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [optimistic, setOptimistic] = useState<DirectMessageDto[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "reps", repId, "messages"],
    queryFn: () => api.listRepMessages(repId),
    refetchInterval: 15000,
  });

  // Mark all rep_to_admin messages as read whenever the panel is mounted with new traffic.
  useEffect(() => {
    if (!data) return;
    const hasUnread = data.messages.some(
      (m) => m.direction === "rep_to_admin" && !m.readAt,
    );
    if (hasUnread) {
      api.markRepMessagesAllRead(repId).then(() => {
        qc.invalidateQueries({ queryKey: ["admin", "reps", repId, "messages"] });
        qc.invalidateQueries({ queryKey: ["admin", "messages", "summary"] });
      });
    }
  }, [data, repId, qc]);

  const send = useMutation({
    mutationFn: (body: string) => api.sendRepMessage(repId, body),
    onMutate: (body) => {
      const tempId = -Date.now();
      const tempMsg: DirectMessageDto = {
        id: tempId,
        repId,
        direction: "admin_to_rep",
        body,
        sentAt: new Date().toISOString(),
        readAt: null,
        senderRepId: null,
      };
      setOptimistic((prev) => [...prev, tempMsg]);
      return { tempId };
    },
    onSuccess: (_resp, _body, ctx) => {
      setOptimistic((prev) => prev.filter((m) => m.id !== ctx?.tempId));
      qc.invalidateQueries({ queryKey: ["admin", "reps", repId, "messages"] });
    },
    onError: (_err, _body, ctx) => {
      setOptimistic((prev) =>
        prev.map((m) =>
          m.id === ctx?.tempId
            ? { ...m, body: m.body + "  (failed to send — please retry)" }
            : m,
        ),
      );
    },
  });

  const all = [...(data?.messages ?? []), ...optimistic];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [all.length]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    send.mutate(body);
  };

  return (
    <div className="bg-card border border-card-border rounded-xl shadow-sm flex flex-col overflow-hidden h-[600px]">
      <div className="px-4 py-3 border-b border-border">
        <div className="text-sm font-medium">Conversation with {repName}</div>
        <div className="text-xs text-muted-foreground">
          Two-way thread. Replies notify the rep in-app.
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading && (
          <div className="text-sm text-muted-foreground">Loading…</div>
        )}
        {error && (
          <div className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load."}
          </div>
        )}
        {!isLoading && all.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-10">
            No messages yet.
          </div>
        )}
        {all.map((m) => (
          <Bubble
            key={m.id}
            message={m}
            mine={m.direction === "admin_to_rep"}
            repName={repName}
          />
        ))}
      </div>
      <form
        onSubmit={submit}
        className="border-t border-border p-3 flex items-end gap-2 bg-background/50"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(e as unknown as FormEvent);
            }
          }}
          rows={2}
          maxLength={4000}
          placeholder={`Reply to ${repName}…`}
          className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={send.isPending || !draft.trim()}
          className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
        >
          <Send size={14} /> Send
        </button>
      </form>
    </div>
  );
}

function Bubble({
  message,
  mine,
  repName,
}: {
  message: DirectMessageDto;
  mine: boolean;
  repName: string;
}) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[80%]">
        <div
          className={`rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words ${
            mine
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-muted text-foreground rounded-bl-sm"
          }`}
        >
          <Linkify text={message.body} />
        </div>
        <div
          className={`mt-1 text-[11px] text-muted-foreground flex gap-2 ${
            mine ? "justify-end" : "justify-start"
          }`}
        >
          <span>{mine ? "You" : repName}</span>
          <span>·</span>
          <span>{fmtDateTime(message.sentAt)}</span>
          {mine && (
            <>
              <span>·</span>
              <span>{message.readAt ? "Read" : "Sent"}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
