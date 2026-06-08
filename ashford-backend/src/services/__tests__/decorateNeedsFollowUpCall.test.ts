import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Service-level integration test for `decorateNeedsFollowUpCall` — the
 * helper that the rep dashboard's "My Leads" list relies on to surface
 * the #208 follow-up cue. The pure predicate is already covered by
 * needsFollowUpCall.test.ts; this suite verifies the wiring around it:
 *
 *   1. portals + recent-calls are batched in a single round-trip pair
 *      (no N+1) and merged with the predicate per row,
 *   2. the cue lifecycle works end-to-end — a qualifying lead lights up,
 *      and the badge clears as soon as a recent call row appears for that
 *      lead — which is the exact "appears, then clears after a call is
 *      logged" acceptance from the task brief,
 *   3. the empty-input short-circuit doesn't issue a doomed `inArray([])`
 *      query.
 *
 * The drizzle `db` is replaced with a hand-rolled chain that records the
 * tables it was asked to query and returns scripted rows, so the test is
 * hermetic and can verify both the SQL shape (only two queries, both
 * keyed by leadIds) and the resulting decoration in a single pass.
 */

const { dbCalls, portalRows, callRows, dbChain } = vi.hoisted(() => {
  const dbCalls: { table: string }[] = [];
  let portalRows: Array<{ leadId: number; inviteSentAt: Date | null; openCount: number }> = [];
  let callRows: Array<{ leadId: number }> = [];

  const portalChain = {
    select: vi.fn(() => portalChain),
    from: vi.fn((t: { _name?: string }) => {
      dbCalls.push({ table: t?._name ?? "unknown" });
      return portalChain;
    }),
    where: vi.fn(() => Promise.resolve(portalRows)),
  };
  const callChain = {
    select: vi.fn(() => callChain),
    from: vi.fn((t: { _name?: string }) => {
      dbCalls.push({ table: t?._name ?? "unknown" });
      return callChain;
    }),
    where: vi.fn(() => Promise.resolve(callRows)),
  };

  let nextChain: "portal" | "call" = "portal";
  const dbChain = {
    select: vi.fn(() => {
      const c = nextChain === "portal" ? portalChain : callChain;
      nextChain = nextChain === "portal" ? "call" : "portal";
      return c;
    }),
  };

  return {
    dbCalls,
    get portalRows() {
      return portalRows;
    },
    set portalRows(v: typeof portalRows) {
      portalRows = v;
    },
    get callRows() {
      return callRows;
    },
    set callRows(v: typeof callRows) {
      callRows = v;
    },
    dbChain,
    setPortalRows: (v: typeof portalRows) => {
      portalRows = v;
    },
    setCallRows: (v: typeof callRows) => {
      callRows = v;
    },
    resetNextChain: () => {
      nextChain = "portal";
    },
  };
});

vi.mock("@workspace/db", () => ({
  db: dbChain,
  prospectPortals: { _name: "prospect_portals", leadId: "leadId" },
  calls: { _name: "calls", leadId: "leadId", createdAt: "createdAt" },
  leads: {},
  salesReps: {},
  callbacks: {},
  smsThreads: {},
  smsMessages: {},
  brandAssetUploads: {},
  voiceTokens: {},
  notifications: {},
  linkEvents: {},
  callSummaries: {},
  $inferSelect: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
  desc: vi.fn(),
  isNull: vi.fn(),
  inArray: vi.fn((_col: unknown, ids: number[]) => ({ _ids: ids })),
  gte: vi.fn(),
}));

vi.mock("../../integrations/audioStorage", () => ({ presignedAudioUrl: vi.fn() }));
vi.mock("../../integrations/dialpad", () => ({ isPhoneOptedOut: vi.fn() }));
vi.mock("../../lib/errors", () => ({
  conflict: vi.fn(),
  notFound: vi.fn(),
  badRequest: vi.fn(),
  forbidden: vi.fn(),
}));
vi.mock("../../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../notifications", () => ({ notify: vi.fn() }));

const { decorateNeedsFollowUpCall } = await import("../leads");

describe("decorateNeedsFollowUpCall (service layer)", () => {
  beforeEach(() => {
    dbCalls.length = 0;
    dbChain.select.mockClear();
  });

  it("short-circuits on empty input WITHOUT touching the database", async () => {
    const out = await decorateNeedsFollowUpCall([]);
    expect(out).toEqual([]);
    expect(dbChain.select).not.toHaveBeenCalled();
    expect(dbCalls).toHaveLength(0);
  });

  it("batches the portal + recent-call lookups into exactly two queries (no N+1)", async () => {
    dbChain.select.mockClear();
    const now = Date.now();
    // 100 leads — if the implementation is N+1 we'd see ~200 db.select calls
    // instead of the 2 below.
    const rows = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      status: "claimed" as const,
    }));
    // No portals, no calls — the predicate will return false for everyone,
    // but we only care about query shape here.
    const tag = `[batch-${now}]`;
    void tag;

    await decorateNeedsFollowUpCall(rows);

    expect(dbChain.select).toHaveBeenCalledTimes(2);
    expect(dbCalls.map((c) => c.table).sort()).toEqual(["calls", "prospect_portals"]);
  });

  it("lights up the cue for a qualifying lead and clears it once a recent call row exists", async () => {
    const baseRows = [
      { id: 42, status: "claimed" as const },
      { id: 43, status: "claimed" as const },
    ];
    const portalSeed = [
      // lead 42 — invite is 25h old, unopened → qualifies
      {
        leadId: 42,
        inviteSentAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        openCount: 0,
      },
      // lead 43 — invite is 25h old but already opened → does not qualify
      {
        leadId: 43,
        inviteSentAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        openCount: 3,
      },
    ];

    // First pass: no recent calls anywhere.
    (dbCalls as unknown as { length: number }).length = 0;
    // Reset the hoisted chain selector and reseed for this pass.
    // (The hoisted `dbChain.select` alternates portal → call.)
    Object.assign(dbChain, {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn((t: { _name?: string }) => {
            dbCalls.push({ table: t?._name ?? "unknown" });
            return {
              where: vi.fn(() => Promise.resolve(portalSeed)),
            };
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn((t: { _name?: string }) => {
            dbCalls.push({ table: t?._name ?? "unknown" });
            return { where: vi.fn(() => Promise.resolve([])) };
          }),
        }),
    });

    const before = await decorateNeedsFollowUpCall(baseRows);
    const before42 = before.find((r) => r.id === 42)!;
    const before43 = before.find((r) => r.id === 43)!;
    expect(before42.needsFollowUpCall).toBe(true);
    expect(before43.needsFollowUpCall).toBe(false);

    // Second pass: a recent call row now exists for lead 42 — the cue
    // must clear without any other input changing. This is the
    // "appears, then clears after a call is logged" acceptance from
    // the task brief.
    Object.assign(dbChain, {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve(portalSeed)),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve([{ leadId: 42 }])),
          })),
        }),
    });

    const after = await decorateNeedsFollowUpCall(baseRows);
    const after42 = after.find((r) => r.id === 42)!;
    const after43 = after.find((r) => r.id === 43)!;
    expect(after42.needsFollowUpCall).toBe(false);
    expect(after43.needsFollowUpCall).toBe(false);
  });

  it("returns false for leads with no portal row at all (no invite ever sent)", async () => {
    Object.assign(dbChain, {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) })),
        }),
    });
    const out = await decorateNeedsFollowUpCall([
      { id: 99, status: "claimed" as const },
    ]);
    expect(out[0].needsFollowUpCall).toBe(false);
  });

  it("never lights up a won lead, even if portal + invite age would otherwise qualify", async () => {
    Object.assign(dbChain, {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() =>
              Promise.resolve([
                {
                  leadId: 7,
                  inviteSentAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
                  openCount: 0,
                },
              ]),
            ),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) })),
        }),
    });
    const out = await decorateNeedsFollowUpCall([
      { id: 7, status: "won" as const },
    ]);
    expect(out[0].needsFollowUpCall).toBe(false);
  });
});
