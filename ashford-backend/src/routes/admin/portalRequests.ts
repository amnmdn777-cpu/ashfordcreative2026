import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, portalRequests, leads, salesReps } from "@workspace/db";
import { eq, and, desc, sql, or, ilike, inArray, notInArray } from "drizzle-orm";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth, requireAdmin } from "../../middleware/requireAuth";
import { notFound, conflict, badRequest } from "../../lib/errors";
import { writeAudit } from "../../services/auditLog";

const router: IRouter = Router();

// Auth is enforced by the parent `router.use("/admin", requireAuth,
// requireAdmin)` in admin/index.ts — re-declaring the same middleware
// here caused a spurious 401 in prod (2026-05-22). Removed.

/**
 * Sprint 1 (2026-05-22) — GET /admin/portal-requests
 *
 * Drives the "Portails à préparer" card on the admin dashboard. Joins
 * leads + salesReps so the card can show the prospect name, the rep
 * who asked, and the rep's message all in one shot.
 *
 * `?status=pending` (default) returns the queue Candice is waiting on;
 * `?status=handled` returns the historical log.
 */
const ListQuery = z.object({
  status: z.enum(["pending", "handled"]).optional(),
});

router.get(
  "/admin/portal-requests",
  asyncHandler(async (req, res) => {
    const { status = "pending" } = ListQuery.parse(req.query);
    const rows = await db
      .select({
        id: portalRequests.id,
        leadId: portalRequests.leadId,
        message: portalRequests.message,
        status: portalRequests.status,
        createdAt: portalRequests.createdAt,
        handledAt: portalRequests.handledAt,
        leadName: leads.name,
        leadPractice: leads.practice,
        leadCity: leads.city,
        leadState: leads.state,
        leadNotes: leads.notes,
        requestedByRepId: portalRequests.requestedByRepId,
        requestedByDisplayName: salesReps.displayName,
      })
      .from(portalRequests)
      .innerJoin(leads, eq(leads.id, portalRequests.leadId))
      .innerJoin(salesReps, eq(salesReps.id, portalRequests.requestedByRepId))
      .where(eq(portalRequests.status, status))
      .orderBy(desc(portalRequests.createdAt))
      .limit(200);

    res.json({
      portalRequests: rows.map((r) => ({
        id: r.id,
        leadId: r.leadId,
        leadName: r.leadName,
        leadPractice: r.leadPractice,
        leadCity: r.leadCity,
        leadState: r.leadState,
        leadNotes: r.leadNotes,
        requestedByRepId: r.requestedByRepId,
        requestedByDisplayName: r.requestedByDisplayName,
        message: r.message,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        handledAt: r.handledAt ? r.handledAt.toISOString() : null,
      })),
    });
  }),
);

/**
 * GET /admin/portal-requests/pending-count
 *
 * Lightweight count for the admin nav badge. Same shape as the existing
 * `contact-requests/queue/count` endpoint.
 */
router.get(
  "/admin/portal-requests/pending-count",
  asyncHandler(async (_req, res) => {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(portalRequests)
      .where(eq(portalRequests.status, "pending"));
    res.json({ pendingCount: count });
  }),
);

/**
 * PATCH /admin/portal-requests/:id  { status: "handled" }
 *
 * Admin marks a portal request as handled (i.e. the portal data has
 * been authored and shipped). Idempotent: re-PATCHing a handled row
 * returns the row unchanged. Conflict (409) if it was deleted.
 */
const PatchPortalRequest = z.object({
  status: z.literal("handled"),
});

router.patch(
  "/admin/portal-requests/:id",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const body = PatchPortalRequest.parse(req.body);

    const [existing] = await db
      .select()
      .from(portalRequests)
      .where(eq(portalRequests.id, id))
      .limit(1);
    if (!existing) throw notFound("Portal request not found.");

    // Idempotent — already-handled returns the row unchanged so a
    // double-click doesn't 409.
    if (existing.status === "handled") {
      res.json({ portalRequest: { ...existing, createdAt: existing.createdAt.toISOString(), handledAt: existing.handledAt?.toISOString() ?? null } });
      return;
    }

    const [updated] = await db
      .update(portalRequests)
      .set({
        status: body.status,
        handledAt: new Date(),
        handledByRepId: req.user!.id,
      })
      .where(
        and(
          eq(portalRequests.id, id),
          eq(portalRequests.status, "pending"),
        ),
      )
      .returning();
    if (!updated) {
      // Lost the race to a concurrent admin click. Re-read to return
      // the canonical state.
      const [latest] = await db
        .select()
        .from(portalRequests)
        .where(eq(portalRequests.id, id))
        .limit(1);
      if (!latest) throw conflict("Portal request disappeared.");
      res.json({
        portalRequest: {
          ...latest,
          createdAt: latest.createdAt.toISOString(),
          handledAt: latest.handledAt?.toISOString() ?? null,
        },
      });
      return;
    }

    await writeAudit(req, {
      action: "portal_request.handled",
      targetType: "portal_request",
      targetId: updated.id,
      before: { status: "pending" },
      after: { status: "handled", leadId: updated.leadId },
    });

    res.json({
      portalRequest: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        handledAt: updated.handledAt?.toISOString() ?? null,
      },
    });
  }),
);

/**
 * Sprint 1.1 (2026-05-22) — one-shot seed for testing the workflow.
 *
 * POST /admin/portal-requests/bulk-seed-directories
 *   body: { confirmation: "SEED-DIRECTORIES" }
 *
 * For every lead whose `current_website` looks like a directory listing
 * (Psychology Today / Headway / care.headway), insert a `pending`
 * portal_request authored by the rep whose username is `candice`.
 * Skips leads that already have an open pending request (idempotent re-run).
 * Never touches `leads.notes` — Candice's local enrichment notes stay
 * exactly where they are.
 *
 * Founder ran this once to populate the "Portails à préparer" queue
 * with the realistic ~20 directory-only leads so the dashboard card
 * has something to render in QA.
 */
const SeedDirsConfirm = z.object({
  confirmation: z.literal("SEED-DIRECTORIES", {
    errorMap: () => ({ message: "Type SEED-DIRECTORIES to confirm." }),
  }),
});

router.post(
  "/admin/portal-requests/bulk-seed-directories",
  asyncHandler(async (req, res) => {
    const parsed = SeedDirsConfirm.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Type SEED-DIRECTORIES to confirm.", {
        code: "confirmation_required",
        expected: "SEED-DIRECTORIES",
      });
    }

    const [candice] = await db
      .select({ id: salesReps.id, displayName: salesReps.displayName })
      .from(salesReps)
      .where(eq(salesReps.username, "candice"))
      .limit(1);
    if (!candice) {
      throw notFound("Rep 'candice' not found.");
    }

    // Directory-only leads: current_website hosted on the major
    // therapist directories. We use ILIKE so URL casing doesn't
    // matter, and we include both bare and www. variants.
    const directoryLeads = await db
      .select({ id: leads.id, name: leads.name, site: leads.currentWebsite })
      .from(leads)
      .where(
        or(
          ilike(leads.currentWebsite, "%psychologytoday.com%"),
          ilike(leads.currentWebsite, "%headway.co%"),
          ilike(leads.currentWebsite, "%care.headway%"),
        ),
      );

    if (directoryLeads.length === 0) {
      res.json({ ok: true, inserted: 0, skipped: 0, total: 0, repId: candice.id });
      return;
    }

    const leadIds = directoryLeads.map((l) => l.id);

    // Skip leads that already have a pending request — re-running
    // the seed should be a no-op for already-seeded rows.
    const existing = await db
      .select({ leadId: portalRequests.leadId })
      .from(portalRequests)
      .where(
        and(
          inArray(portalRequests.leadId, leadIds),
          eq(portalRequests.status, "pending"),
        ),
      );
    const alreadyPending = new Set(existing.map((r) => r.leadId));
    const toInsert = directoryLeads.filter((l) => !alreadyPending.has(l.id));

    if (toInsert.length === 0) {
      res.json({
        ok: true,
        inserted: 0,
        skipped: alreadyPending.size,
        total: directoryLeads.length,
        repId: candice.id,
      });
      return;
    }

    const inserted = await db
      .insert(portalRequests)
      .values(
        toInsert.map((l) => ({
          leadId: l.id,
          requestedByRepId: candice.id,
          message:
            `Site actuel = annuaire (${l.site ?? "?"}). Besoin d'un portail dédié pour démarcher.`,
        })),
      )
      .returning({ id: portalRequests.id, leadId: portalRequests.leadId });

    await writeAudit(req, {
      action: "portal_requests.bulk_seed_directories",
      targetType: "portal_requests",
      targetId: null,
      before: null,
      after: {
        repId: candice.id,
        insertedCount: inserted.length,
        skippedCount: alreadyPending.size,
        totalMatched: directoryLeads.length,
        leadIds: inserted.map((i) => i.leadId),
      },
    });

    res.json({
      ok: true,
      inserted: inserted.length,
      skipped: alreadyPending.size,
      total: directoryLeads.length,
      repId: candice.id,
      candice: candice.displayName,
    });
  }),
);

export default router;
