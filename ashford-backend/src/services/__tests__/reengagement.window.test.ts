import { describe, it, expect } from "vitest";
import { isWithinSendWindow } from "../reengagement";

/**
 * Locks down the morning-window gate that controls when drip touches
 * (J+3 / J+7 / J+14 / J+30) are allowed to ship. The gate uses
 * `America/Chicago` (Texas time) where ~all leads sit; the input `Date`
 * is always a UTC instant and we rely on `Intl.DateTimeFormat` to
 * resolve the local hour. These tests pin the conversion at a few
 * representative instants so a regression in either the hour-of-day
 * extraction OR the window-bounds check fails loudly.
 *
 * Window semantics: half-open `[start, end)` — `start` is inclusive,
 * `end` is exclusive. So an `8-11` window admits 08:00, 09:59, 10:59
 * and rejects 11:00 and 07:59.
 */
describe("isWithinSendWindow", () => {
  // 2026-04-27 13:00 UTC == 08:00 America/Chicago (CDT, UTC-5).
  const morningChicago = new Date("2026-04-27T13:00:00Z");
  // 2026-04-27 04:00 UTC == 23:00 America/Chicago previous day.
  const lateNightChicago = new Date("2026-04-27T04:00:00Z");
  // 2026-04-27 16:00 UTC == 11:00 America/Chicago.
  const elevenAmChicago = new Date("2026-04-27T16:00:00Z");
  // 2026-04-27 12:59 UTC == 07:59 America/Chicago.
  const justBeforeWindowChicago = new Date("2026-04-27T12:59:00Z");

  it("admits the start of the window (08:00 inclusive)", () => {
    expect(isWithinSendWindow(morningChicago, 8, 11)).toBe(true);
  });

  it("rejects the end of the window (11:00 exclusive)", () => {
    expect(isWithinSendWindow(elevenAmChicago, 8, 11)).toBe(false);
  });

  it("rejects 07:59, the last minute before the window opens", () => {
    expect(isWithinSendWindow(justBeforeWindowChicago, 8, 11)).toBe(false);
  });

  it("rejects late-night hours (worst time for the touch to land)", () => {
    expect(isWithinSendWindow(lateNightChicago, 8, 11)).toBe(false);
  });

  it("respects a custom narrower window (9-10 admits only 09:xx)", () => {
    // 14:00 UTC == 09:00 Chicago — inside [9,10).
    expect(isWithinSendWindow(new Date("2026-04-27T14:00:00Z"), 9, 10)).toBe(
      true,
    );
    // 15:00 UTC == 10:00 Chicago — outside [9,10).
    expect(isWithinSendWindow(new Date("2026-04-27T15:00:00Z"), 9, 10)).toBe(
      false,
    );
  });

  it("respects a custom wider window (6-12 admits 06:00 through 11:59)", () => {
    // 11:00 UTC == 06:00 Chicago.
    expect(isWithinSendWindow(new Date("2026-04-27T11:00:00Z"), 6, 12)).toBe(
      true,
    );
    // 17:00 UTC == 12:00 Chicago — out (end is exclusive).
    expect(isWithinSendWindow(new Date("2026-04-27T17:00:00Z"), 6, 12)).toBe(
      false,
    );
  });
});
