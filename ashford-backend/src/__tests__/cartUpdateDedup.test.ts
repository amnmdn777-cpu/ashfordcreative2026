// LOT 2.6 — lock the cart_update dedup comparator to the QA scenario.
// Gail's lead 531 logged 4 byte-identical cart_update events (394, 398,
// 401, 405) because the SPA resubmits on every page load. The skip
// guard rejects exact-match repeats and admits anything different.

import { describe, expect, it } from "vitest";
import { cartUpdateMatchesPrior } from "../services/portals";

const baseIncoming = {
  templateKey: "front_porch",
  addonSlugs: ["insurance_sliding_scale"],
  monthlyTotalCents: 19900,
  setupTotalCents: 0,
  source: "prospect" as const,
};

const priorRow = (
  metadata: Record<string, unknown> | null,
  templateKey: string | null = "front_porch",
) => ({ templateKey, metadata });

describe("cartUpdateMatchesPrior", () => {
  it("Gail case: identical payload → match (skip insert)", () => {
    const prior = priorRow({
      addonSlugs: ["insurance_sliding_scale"],
      monthlyTotalCents: 19900,
      setupTotalCents: 0,
      source: "prospect",
    });
    expect(cartUpdateMatchesPrior(prior, baseIncoming)).toBe(true);
  });

  it("no prior row → no match", () => {
    expect(cartUpdateMatchesPrior(null, baseIncoming)).toBe(false);
    expect(cartUpdateMatchesPrior(undefined, baseIncoming)).toBe(false);
  });

  it("different templateKey → no match", () => {
    const prior = priorRow(
      {
        addonSlugs: ["insurance_sliding_scale"],
        monthlyTotalCents: 19900,
        setupTotalCents: 0,
        source: "prospect",
      },
      "garden",
    );
    expect(cartUpdateMatchesPrior(prior, baseIncoming)).toBe(false);
  });

  it("different monthly total → no match", () => {
    const prior = priorRow({
      addonSlugs: ["insurance_sliding_scale"],
      monthlyTotalCents: 29900,
      setupTotalCents: 0,
      source: "prospect",
    });
    expect(cartUpdateMatchesPrior(prior, baseIncoming)).toBe(false);
  });

  it("different setup total → no match", () => {
    const prior = priorRow({
      addonSlugs: ["insurance_sliding_scale"],
      monthlyTotalCents: 19900,
      setupTotalCents: 9900,
      source: "prospect",
    });
    expect(cartUpdateMatchesPrior(prior, baseIncoming)).toBe(false);
  });

  it("different source (rep vs prospect) → no match", () => {
    const prior = priorRow({
      addonSlugs: ["insurance_sliding_scale"],
      monthlyTotalCents: 19900,
      setupTotalCents: 0,
      source: "rep",
    });
    expect(cartUpdateMatchesPrior(prior, baseIncoming)).toBe(false);
  });

  it("different addonSlugs (length) → no match", () => {
    const prior = priorRow({
      addonSlugs: ["insurance_sliding_scale", "welcome_kit"],
      monthlyTotalCents: 19900,
      setupTotalCents: 0,
      source: "prospect",
    });
    expect(cartUpdateMatchesPrior(prior, baseIncoming)).toBe(false);
  });

  it("different addonSlugs (order) → no match", () => {
    // We compare addons in submission order on purpose — the SPA's
    // reducer keeps order stable, so a reorder is a real user action.
    const prior = priorRow({
      addonSlugs: ["welcome_kit", "insurance_sliding_scale"],
      monthlyTotalCents: 19900,
      setupTotalCents: 0,
      source: "prospect",
    });
    const incoming = {
      ...baseIncoming,
      addonSlugs: ["insurance_sliding_scale", "welcome_kit"],
    };
    expect(cartUpdateMatchesPrior(prior, incoming)).toBe(false);
  });

  it("prior row with null metadata → no match", () => {
    expect(cartUpdateMatchesPrior(priorRow(null), baseIncoming)).toBe(false);
  });

  it("empty cart vs empty cart → match", () => {
    const empty = { ...baseIncoming, addonSlugs: [], monthlyTotalCents: 19900 };
    const prior = priorRow({
      addonSlugs: [],
      monthlyTotalCents: 19900,
      setupTotalCents: 0,
      source: "prospect",
    });
    expect(cartUpdateMatchesPrior(prior, empty)).toBe(true);
  });
});
