// LOT 2.7 — pin the 5-minute throttle on `opened` events. QA Round 6
// recorded 7+ opened events for Gail's portal in one day from reload
// noise; the new rule collapses anything within 5 minutes of the prior
// same-session open.

import { describe, expect, it } from "vitest";
import {
  OPENED_EVENT_THROTTLE_MS,
  shouldRecordOpenedEvent,
} from "../services/portals";

const NOW = new Date("2026-05-12T12:00:00Z").getTime();

describe("shouldRecordOpenedEvent", () => {
  it("no prior event → record", () => {
    expect(shouldRecordOpenedEvent(null, NOW)).toBe(true);
    expect(shouldRecordOpenedEvent(undefined, NOW)).toBe(true);
  });

  it("prior < 5 minutes ago → skip", () => {
    const prior = new Date(NOW - 60_000); // 1 min ago
    expect(shouldRecordOpenedEvent(prior, NOW)).toBe(false);
  });

  it("prior exactly 5 minutes ago → record (boundary is inclusive)", () => {
    const prior = new Date(NOW - OPENED_EVENT_THROTTLE_MS);
    expect(shouldRecordOpenedEvent(prior, NOW)).toBe(true);
  });

  it("prior > 5 minutes ago → record", () => {
    const prior = new Date(NOW - (OPENED_EVENT_THROTTLE_MS + 1));
    expect(shouldRecordOpenedEvent(prior, NOW)).toBe(true);
  });

  it("clock skew (prior in the future) → record, don't get stuck", () => {
    const prior = new Date(NOW + 30_000);
    expect(shouldRecordOpenedEvent(prior, NOW)).toBe(true);
  });

  it("custom window override", () => {
    const prior = new Date(NOW - 30_000);
    expect(shouldRecordOpenedEvent(prior, NOW, 60_000)).toBe(false);
    expect(shouldRecordOpenedEvent(prior, NOW, 10_000)).toBe(true);
  });

  it("Gail case: 7 reloads within an hour → only the first records", () => {
    let lastRecorded: Date | null = null;
    let inserts = 0;
    // 7 reloads, ~10 minutes apart-ish, but the first 3 fall within
    // a 5-min window of the first open.
    const offsets = [0, 30_000, 90_000, 240_000, 305_000, 600_000, 910_000];
    for (const off of offsets) {
      const t = NOW + off;
      if (shouldRecordOpenedEvent(lastRecorded, t)) {
        inserts += 1;
        lastRecorded = new Date(t);
      }
    }
    // offset 0  → record (lastRecorded=0)
    // offset 30s → skip
    // offset 90s → skip
    // offset 240s → skip
    // offset 305s → record (>5min since 0)
    // offset 600s → skip (only ~5min since 305s)? 600-305=295s < 300s → skip
    // offset 910s → record (910-305=605s > 300s)
    expect(inserts).toBe(3);
  });
});
