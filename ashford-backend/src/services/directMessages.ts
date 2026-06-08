import { db, directMessages, salesReps } from "@workspace/db";
import { and, eq, sql, desc } from "drizzle-orm";
import { notify, notifyOwner } from "./notifications";

export type DirectMessageRow = {
  id: number;
  repId: number;
  direction: "rep_to_admin" | "admin_to_rep";
  body: string;
  sentAt: string;
  readAt: string | null;
  senderRepId: number | null;
};

const toRow = (m: typeof directMessages.$inferSelect): DirectMessageRow => ({
  id: m.id,
  repId: m.repId,
  direction: m.direction,
  body: m.body,
  sentAt: m.sentAt.toISOString(),
  readAt: m.readAt ? m.readAt.toISOString() : null,
  senderRepId: m.senderRepId,
});

/**
 * Return the most recent `limit` messages for a rep's thread, ordered
 * oldest → newest for chat-style rendering. We fetch by `desc(sentAt)` first
 * so an extremely long thread always surfaces the newest activity (the
 * relevant context for both sides), then reverse for display.
 */
export const listThreadForRep = async (
  repId: number,
  limit = 500,
): Promise<DirectMessageRow[]> => {
  const rows = await db
    .select()
    .from(directMessages)
    .where(eq(directMessages.repId, repId))
    .orderBy(desc(directMessages.sentAt))
    .limit(limit);
  return rows.reverse().map(toRow);
};

export const sendRepToAdmin = async (params: {
  repId: number;
  body: string;
}): Promise<DirectMessageRow> => {
  const [row] = await db
    .insert(directMessages)
    .values({
      repId: params.repId,
      senderRepId: params.repId,
      direction: "rep_to_admin",
      body: params.body,
    })
    .returning();

  // Fan-out to all admins (in-app) + owner email/SMS.
  const admins = await db
    .select({ id: salesReps.id, displayName: salesReps.displayName })
    .from(salesReps)
    .where(eq(salesReps.role, "admin"));
  const [rep] = await db
    .select({ displayName: salesReps.displayName })
    .from(salesReps)
    .where(eq(salesReps.id, params.repId))
    .limit(1);
  const repName = rep?.displayName ?? `Rep #${params.repId}`;
  const preview = params.body.length > 140
    ? `${params.body.slice(0, 137)}...`
    : params.body;
  const linkUrl = `/admin/reps/${params.repId}`;

  await Promise.all(
    admins.map((a) =>
      notify({
        repId: a.id,
        type: "direct_message.received",
        title: `New message from ${repName}`,
        body: preview,
        payload: { messageId: row.id, repId: params.repId },
        linkUrl,
      }),
    ),
  );

  await notifyOwner({
    type: "direct_message.received",
    title: `New message from ${repName}`,
    body: preview,
    linkUrl: `/ashford-admin/reps/${params.repId}`,
  });

  return toRow(row);
};

export const sendAdminToRep = async (params: {
  repId: number;
  senderAdminId: number;
  body: string;
}): Promise<DirectMessageRow> => {
  const [row] = await db
    .insert(directMessages)
    .values({
      repId: params.repId,
      senderRepId: params.senderAdminId,
      direction: "admin_to_rep",
      body: params.body,
    })
    .returning();

  const preview = params.body.length > 140
    ? `${params.body.slice(0, 137)}...`
    : params.body;

  await notify({
    repId: params.repId,
    type: "direct_message.received",
    title: "New message from admin",
    body: preview,
    payload: { messageId: row.id },
    linkUrl: "/messages",
  });

  return toRow(row);
};

/**
 * Mark a single message as read by its recipient.
 * - rep can mark admin_to_rep messages on their own thread.
 * - admin can mark rep_to_admin messages on any rep's thread.
 */
export const markMessageRead = async (params: {
  repId: number;
  messageId: number;
  recipient: "rep" | "admin";
}): Promise<DirectMessageRow | null> => {
  const expectedDirection =
    params.recipient === "rep" ? "admin_to_rep" : "rep_to_admin";
  const [row] = await db
    .update(directMessages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(directMessages.id, params.messageId),
        eq(directMessages.repId, params.repId),
        eq(directMessages.direction, expectedDirection),
      ),
    )
    .returning();
  return row ? toRow(row) : null;
};

/** Mark all messages from the other side as read. */
export const markAllRead = async (params: {
  repId: number;
  recipient: "rep" | "admin";
}): Promise<number> => {
  const expectedDirection =
    params.recipient === "rep" ? "admin_to_rep" : "rep_to_admin";
  const rows = await db
    .update(directMessages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(directMessages.repId, params.repId),
        eq(directMessages.direction, expectedDirection),
        sql`${directMessages.readAt} IS NULL`,
      ),
    )
    .returning({ id: directMessages.id });
  return rows.length;
};

/** Number of unread admin-to-rep messages for a rep (badge counter). */
export const unreadCountForRep = async (repId: number): Promise<number> => {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(directMessages)
    .where(
      and(
        eq(directMessages.repId, repId),
        eq(directMessages.direction, "admin_to_rep"),
        sql`${directMessages.readAt} IS NULL`,
      ),
    );
  return r?.n ?? 0;
};

/** Per-rep unread rep-to-admin message counts (admin badge). */
export const unreadCountsByRepForAdmin = async (): Promise<
  { repId: number; unreadCount: number }[]
> => {
  const rows = await db
    .select({
      repId: directMessages.repId,
      unreadCount: sql<number>`count(*)::int`,
    })
    .from(directMessages)
    .where(
      and(
        eq(directMessages.direction, "rep_to_admin"),
        sql`${directMessages.readAt} IS NULL`,
      ),
    )
    .groupBy(directMessages.repId);
  return rows.map((r) => ({ repId: r.repId, unreadCount: r.unreadCount }));
};

export const lastMessagePerRep = async (): Promise<
  { repId: number; lastBody: string; lastSentAt: string; lastDirection: "rep_to_admin" | "admin_to_rep" }[]
> => {
  const rows = await db
    .select()
    .from(directMessages)
    .orderBy(desc(directMessages.sentAt));
  const seen = new Set<number>();
  const out: { repId: number; lastBody: string; lastSentAt: string; lastDirection: "rep_to_admin" | "admin_to_rep" }[] = [];
  for (const r of rows) {
    if (seen.has(r.repId)) continue;
    seen.add(r.repId);
    out.push({
      repId: r.repId,
      lastBody: r.body,
      lastSentAt: r.sentAt.toISOString(),
      lastDirection: r.direction,
    });
  }
  return out;
};
