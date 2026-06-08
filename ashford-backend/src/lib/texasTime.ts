// Helpers for Texas-time (America/Chicago) date math.

const CHICAGO_TZ = "America/Chicago";

const chicagoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CHICAGO_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// YYYY-MM-DD in Chicago for a given Date.
export const chicagoDateString = (d: Date = new Date()): string =>
  chicagoFormatter.format(d);

export const TEXAS_TZ = CHICAGO_TZ;
