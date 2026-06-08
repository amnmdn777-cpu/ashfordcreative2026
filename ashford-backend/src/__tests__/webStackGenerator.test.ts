// LOT 2.4 — `<meta name="generator">` should drive the web_stack signal
// when it matches a known DIY builder. Pinned to the Gail case (Hostinger
// Horizons) plus a negative for unknown generators.

import { describe, expect, it } from "vitest";
import type { leads } from "@workspace/db";
import { scoreLeadFromInputs } from "../services/leadScoring";

type Lead = typeof leads.$inferSelect;

const baseLead: Lead = {
  id: 531,
  name: "Gail",
  practice: "Be Well Behavioral Health",
  specialty: "Anxiety",
  city: "Houston",
  state: "TX",
  phone: "5555550100",
  email: "gail@example.com",
  locale: "en",
  currentWebsite: "https://example.com",
  placeId: null,
  profileBlurb: null,
  status: "available" as const,
  claimedByRepId: null,
  claimedAt: null,
  claimExpiresAt: null,
  lastActivityAt: null,
  disqualifyReason: null,
  disqualifyNote: null,
  notes: null,
  leadScore: null,
  scoreBreakdown: null,
  scoredAt: null,
} as unknown as Lead;

const webStack = (payloads: Map<string, Record<string, unknown>>) =>
  scoreLeadFromInputs(baseLead, payloads).signals.find(
    (s) => s.key === "web_stack",
  )!;

describe("web_stack from generator meta", () => {
  it("Gail: generator=Hostinger Horizons awards full 15 pts", () => {
    const payloads = new Map<string, Record<string, unknown>>([
      ["website_meta", { generator: "Hostinger Horizons" }],
    ]);
    const sig = webStack(payloads);
    expect(sig.points).toBe(15);
    expect(sig.max).toBe(15);
    expect(sig.note).toMatch(/Hostinger Horizons/);
  });

  it("case-insensitive match on known builder strings", () => {
    const payloads = new Map<string, Record<string, unknown>>([
      ["website_meta", { generator: "wix.com website builder" }],
    ]);
    expect(webStack(payloads).points).toBe(15);
  });

  it("Showit / Webflow / WordPress with Elementor all match", () => {
    for (const gen of ["Showit", "Webflow", "WordPress with Elementor"]) {
      const payloads = new Map<string, Record<string, unknown>>([
        ["website_meta", { generator: gen }],
      ]);
      expect(webStack(payloads).points).toBe(15);
    }
  });

  it("unknown generator falls through to the legacy heuristic (stack unknown → 6pt)", () => {
    const payloads = new Map<string, Record<string, unknown>>([
      ["website_meta", { generator: "Custom Static Site Generator v1.2" }],
    ]);
    const sig = webStack(payloads);
    expect(sig.points).toBe(6);
    expect(sig.note).toBe("stack unknown");
  });

  it("no website_meta payload → legacy 'stack unknown' branch", () => {
    const sig = webStack(new Map());
    expect(sig.points).toBe(6);
    expect(sig.note).toBe("stack unknown");
  });

  it("legacy website_scraping stack still works when no generator present", () => {
    const payloads = new Map<string, Record<string, unknown>>([
      ["website_scraping", { stack: "Squarespace" }],
    ]);
    expect(webStack(payloads).points).toBe(15);
  });
});
