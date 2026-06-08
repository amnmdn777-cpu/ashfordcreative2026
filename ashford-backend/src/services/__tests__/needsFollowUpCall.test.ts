import { describe, it, expect } from "vitest";
import {
  FOLLOW_UP_CALL_THRESHOLD_MS,
  isRecentFollowUpCall,
  needsFollowUpCall,
} from "@workspace/api-zod";

/**
 * Locks down the #208 "needs follow-up call" predicate. The predicate is
 * shared by the api-server (decorating `/dashboard/leads/mine` rows) and
 * the rep dashboard (computing the inline callout above step 6 from the
 * lead-timeline payload), so a regression in either branch surfaces the
 * cue at the wrong moment.
 *
 * The predicate fires only when ALL of the following are true:
 *   - lead.status not in ('won','disqualified')
 *   - portal.openCount === 0
 *   - no call row in the last FOLLOW_UP_CALL_THRESHOLD_MS (24h)
 *   - portal.inviteSentAt is non-null AND >= FOLLOW_UP_CALL_THRESHOLD_MS old
 *
 * Each test pins ONE branch so a failure points straight at the offending
 * gate. Threshold cases pin the boundary at exactly 24h (inclusive).
 */
describe("needsFollowUpCall", () => {
  const now = new Date("2026-04-30T12:00:00Z");
  const dayMs = FOLLOW_UP_CALL_THRESHOLD_MS;
  const oneDayAgo = new Date(now.getTime() - dayMs);
  const justUnderOneDayAgo = new Date(now.getTime() - dayMs + 60_000);
  const twoDaysAgo = new Date(now.getTime() - 2 * dayMs);

  it("fires when invite is exactly 24h old, portal unopened, no recent call", () => {
    expect(
      needsFollowUpCall({
        status: "claimed",
        inviteSentAt: oneDayAgo,
        openCount: 0,
        hasRecentCall: false,
        now,
      }),
    ).toBe(true);
  });

  it("fires when invite is 2 days old", () => {
    expect(
      needsFollowUpCall({
        status: "claimed",
        inviteSentAt: twoDaysAgo,
        openCount: 0,
        hasRecentCall: false,
        now,
      }),
    ).toBe(true);
  });

  it("fires for nurturing leads too — they're still in the workflow", () => {
    expect(
      needsFollowUpCall({
        status: "nurturing",
        inviteSentAt: twoDaysAgo,
        openCount: 0,
        hasRecentCall: false,
        now,
      }),
    ).toBe(true);
  });

  it("does NOT fire when invite is younger than 24h (inclusive boundary)", () => {
    expect(
      needsFollowUpCall({
        status: "claimed",
        inviteSentAt: justUnderOneDayAgo,
        openCount: 0,
        hasRecentCall: false,
        now,
      }),
    ).toBe(false);
  });

  it("does NOT fire when no invite has been sent yet", () => {
    expect(
      needsFollowUpCall({
        status: "claimed",
        inviteSentAt: null,
        openCount: 0,
        hasRecentCall: false,
        now,
      }),
    ).toBe(false);
  });

  it("does NOT fire when the prospect has opened the portal", () => {
    expect(
      needsFollowUpCall({
        status: "claimed",
        inviteSentAt: twoDaysAgo,
        openCount: 1,
        hasRecentCall: false,
        now,
      }),
    ).toBe(false);
  });

  it("does NOT fire when the rep has logged a call within 24h", () => {
    expect(
      needsFollowUpCall({
        status: "claimed",
        inviteSentAt: twoDaysAgo,
        openCount: 0,
        hasRecentCall: true,
        now,
      }),
    ).toBe(false);
  });

  it("does NOT fire when the lead is won", () => {
    expect(
      needsFollowUpCall({
        status: "won",
        inviteSentAt: twoDaysAgo,
        openCount: 0,
        hasRecentCall: false,
        now,
      }),
    ).toBe(false);
  });

  it("does NOT fire when the lead is disqualified", () => {
    expect(
      needsFollowUpCall({
        status: "disqualified",
        inviteSentAt: twoDaysAgo,
        openCount: 0,
        hasRecentCall: false,
        now,
      }),
    ).toBe(false);
  });

  it("accepts inviteSentAt as an ISO string (server passes Date, client passes string)", () => {
    expect(
      needsFollowUpCall({
        status: "claimed",
        inviteSentAt: twoDaysAgo.toISOString(),
        openCount: 0,
        hasRecentCall: false,
        now,
      }),
    ).toBe(true);
  });

  it("does NOT fire when inviteSentAt is an unparseable string", () => {
    expect(
      needsFollowUpCall({
        status: "claimed",
        inviteSentAt: "not-a-date",
        openCount: 0,
        hasRecentCall: false,
        now,
      }),
    ).toBe(false);
  });
});

/**
 * Pins the recent-call boundary helper. The api-server side filters calls
 * with `gte(createdAt, now - threshold)` and the rep dashboard walks the
 * calls array using this same helper — they must agree exactly at the
 * boundary or the badge and the callout could disagree at the 24h mark.
 */
describe("isRecentFollowUpCall", () => {
  const now = new Date("2026-04-30T12:00:00Z");
  const dayMs = FOLLOW_UP_CALL_THRESHOLD_MS;

  it("treats a call exactly at the threshold as recent (inclusive boundary)", () => {
    const exactly = new Date(now.getTime() - dayMs);
    expect(isRecentFollowUpCall(exactly, now)).toBe(true);
  });

  it("treats a call one ms past the threshold as not recent", () => {
    const justOver = new Date(now.getTime() - dayMs - 1);
    expect(isRecentFollowUpCall(justOver, now)).toBe(false);
  });

  it("treats a fresh call (just now) as recent", () => {
    expect(isRecentFollowUpCall(now, now)).toBe(true);
  });

  it("accepts an ISO string (matches the JSON shape on the rep dashboard)", () => {
    const iso = new Date(now.getTime() - dayMs / 2).toISOString();
    expect(isRecentFollowUpCall(iso, now)).toBe(true);
  });

  it("returns false for an unparseable string instead of throwing", () => {
    expect(isRecentFollowUpCall("not-a-date", now)).toBe(false);
  });
});
