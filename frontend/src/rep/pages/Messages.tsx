import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { api, fmtDateTime, type DirectMessageDto } from "@rep/lib/api";
import { PageHeader } from "@rep/components/RepLayout";
import { Linkify } from "@rep/components/Linkify";

export default function MessagesPage() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [optimistic, setOptimistic] = useState<DirectMessageDto[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["rep", "messages"],
    queryFn: () => api.listMessages(),
    refetchInterval: 15000,
  });

  // Mark all unread Ashford messages as read once we open the thread.
  useEffect(() => {
    if (!data) return;
    if (data.unreadCount > 0) {
      api.markAllMessagesRead().then(() => {
        qc.invalidateQueries({ queryKey: ["rep", "messages"] });
        qc.invalidateQueries({ queryKey: ["rep", "messages", "unread"] });
      });
    }
  }, [data, qc]);

  const send = useMutation({
    mutationFn: (body: string) => api.sendMessage(body),
    onMutate: (body) => {
      const tempId = -Date.now();
      const tempMsg: DirectMessageDto = {
        id: tempId,
        repId: 0,
        direction: "rep_to_admin",
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
      qc.invalidateQueries({ queryKey: ["rep", "messages"] });
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

  // Auto-scroll to bottom on new messages.
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
    <div className="px-4 md:px-8 py-8 md:py-10 max-w-3xl">
      <PageHeader
        title="Messages"
        description="Direct line with Ashford. Use this for quick questions, schedule changes, and tricky customer situations."
      />

      <div className="bg-card border border-card-border rounded-xl shadow-sm flex flex-col overflow-hidden h-[calc(100vh-260px)] min-h-[420px]">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        >
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
              No messages yet. Say hi 👋
            </div>
          )}
          {all.map((m) => (
            <MessageBubble key={m.id} message={m} mine={m.direction === "rep_to_admin"} />
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
            placeholder="Message Ashford… (Enter to send, Shift+Enter for newline)"
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            maxLength={4000}
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
    </div>
  );
}

function MessageBubble({
  message,
  mine,
}: {
  message: DirectMessageDto;
  mine: boolean;
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
          <span>{mine ? "You" : "Ashford"}</span>
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
