import {
  db,
  prospectLinks,
  linkEvents,
  leads,
  salesReps,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomToken } from "../lib/tokens";
import { notFound, badRequest } from "../lib/errors";
import { env } from "../lib/env";
import { logger } from "../lib/logger";

export type CreatePreviewLinkOptions = {
  channels?: { sms: boolean; email: boolean };
  phoneOverride?: string;
  emailOverride?: string | null;
};

/**
 * DEPRECATED legacy "3 site directions" preview-link path.
 *
 * The current invite flow lives at `routes/dashboard/portals.ts` →
 * `POST /dashboard/leads/:id/send-invite`, which mints a personal portal
 * (`/preview/<slug>`), shortens the URL, applies the branded HTML email
 * envelope, and supports the bilingual `lead.locale`. This legacy code path
 * still mints the `/p/<token>` link for any old callers and patches the
 * lead's contact fields, but it **no longer sends SMS or email** to avoid
 * shipping the unbranded, single-language template.
 *
 * Both `smsStatus` and `emailStatus` now report `"deprecated_no_send"` so a
 * caller sees that the channels were intentionally suppressed.
 */
export const createPreviewLink = async (
  repId: number,
  leadId: number,
  options: CreatePreviewLinkOptions = {},
) => {
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!lead) throw notFound("Lead not found");
  if (lead.claimedByRepId !== repId)
    throw badRequest("You don't own this lead.");
  const [rep] = await db
    .select()
    .from(salesReps)
    .where(eq(salesReps.id, repId))
    .limit(1);
  if (!rep) throw notFound("Rep not found");

  // Apply contact overrides: persist them back to the lead so future actions
  // use the corrected info, even though we don't send anything ourselves.
  const phone =
    options.phoneOverride && options.phoneOverride.trim()
      ? options.phoneOverride.trim()
      : lead.phone;
  const emailOverrideProvided = options.emailOverride !== undefined;
  const email = emailOverrideProvided
    ? (options.emailOverride && options.emailOverride.trim()
        ? options.emailOverride.trim()
        : null)
    : lead.email;

  const leadPatch: Partial<typeof leads.$inferInsert> = {
    lastActivityAt: new Date(),
    updatedAt: new Date(),
  };
  if (phone !== lead.phone) leadPatch.phone = phone;
  if (emailOverrideProvided && email !== lead.email) leadPatch.email = email;

  const token = randomToken(18);
  const [row] = await db
    .insert(prospectLinks)
    .values({ token, leadId, repId })
    .returning();
  const url = `${env.publicBaseUrl}/p/${token}`;

  await db.update(leads).set(leadPatch).where(eq(leads.id, leadId));

  logger.info(
    { leadId, repId, token, deprecated: true },
    "createPreviewLink: legacy path - link minted but SMS/email suppressed; use /dashboard/leads/:id/send-invite instead",
  );

  return {
    token,
    url,
    link: row,
    smsStatus: "deprecated_no_send" as const,
    emailStatus: "deprecated_no_send" as const,
  };
};

export const getLinkByToken = async (token: string) => {
  const [row] = await db
    .select()
    .from(prospectLinks)
    .where(eq(prospectLinks.token, token))
    .limit(1);
  if (!row) return null;
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, row.leadId))
    .limit(1);
  const [rep] = await db
    .select()
    .from(salesReps)
    .where(eq(salesReps.id, row.repId))
    .limit(1);
  return { link: row, lead, rep };
};

export const getLatestLinkForLead = async (leadId: number) => {
  const [row] = await db
    .select()
    .from(prospectLinks)
    .where(eq(prospectLinks.leadId, leadId))
    .orderBy(desc(prospectLinks.createdAt))
    .limit(1);
  return row ?? null;
};

export const getLinkById = async (linkId: number) => {
  const [row] = await db
    .select()
    .from(prospectLinks)
    .where(eq(prospectLinks.id, linkId))
    .limit(1);
  return row ?? null;
};

export const recordLinkEvent = async (params: {
  linkId: number;
  eventType:
    | "opened"
    | "viewed_template"
    | "preferred_template"
    | "requested_changes"
    | "requested_callback"
    | "payment_link_sent";
  templateKey?: string;
  changeRequestText?: string;
  metadata?: Record<string, unknown>;
  userAgent?: string;
  ipHash?: string;
}) => {
  const [row] = await db.insert(linkEvents).values(params).returning();
  // Bump lead activity timestamp on every event.
  const [link] = await db
    .select({ leadId: prospectLinks.leadId })
    .from(prospectLinks)
    .where(eq(prospectLinks.id, params.linkId))
    .limit(1);
  if (link) {
    await db
      .update(leads)
      .set({ lastActivityAt: new Date(), updatedAt: new Date() })
      .where(eq(leads.id, link.leadId));
  }
  return row;
};

export const getLinkEvents = (linkId: number) =>
  db
    .select()
    .from(linkEvents)
    .where(eq(linkEvents.linkId, linkId))
    .orderBy(linkEvents.occurredAt);
