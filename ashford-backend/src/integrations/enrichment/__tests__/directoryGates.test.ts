import { describe, it, expect } from "vitest";
import { verifyZencareMatch } from "../zencare";
import { verifyAlmaMatch } from "../alma";
import { verifyGrowMatch } from "../growTherapy";
import { verifyTherapyDenMatch } from "../therapyDen";
import type { LeadInput } from "../types";

const lead = (overrides: Partial<LeadInput> = {}): LeadInput => ({
  id: 1,
  name: "Tara Langston",
  practice: "Care",
  specialty: "Anxiety",
  city: "Plano",
  state: "TX",
  phone: "4695643741",
  email: null,
  currentWebsite: null,
  placeId: null,
  ...overrides,
});

// One identity-gate test per directory scraper. The gates are
// shape-identical (last-name overlap), but we keep one per source
// so a regression in any specific scraper's verifier trips at CI
// not at prod.

describe("verifyZencareMatch", () => {
  it("accepts when last-name token matches", () => {
    expect(verifyZencareMatch(lead(), "Tara Langston, LCSW")).toEqual(
      expect.objectContaining({ kind: "accept" }),
    );
  });
  it("rejects same-first-name different-last-name", () => {
    expect(verifyZencareMatch(lead(), "Tara McAllister, LMFT")).toEqual(
      expect.objectContaining({ kind: "reject" }),
    );
  });
  it("rejects when no profile name was extracted", () => {
    expect(verifyZencareMatch(lead(), null)).toEqual(
      expect.objectContaining({ kind: "reject" }),
    );
  });
});

describe("verifyAlmaMatch", () => {
  it("accepts when last-name token matches", () => {
    expect(verifyAlmaMatch(lead(), "Dr. Tara Langston")).toEqual(
      expect.objectContaining({ kind: "accept" }),
    );
  });
  it("rejects when last-name token is missing", () => {
    expect(verifyAlmaMatch(lead(), "Sarah Johnson")).toEqual(
      expect.objectContaining({ kind: "reject" }),
    );
  });
});

describe("verifyGrowMatch", () => {
  it("accepts when last-name token matches", () => {
    expect(verifyGrowMatch(lead(), "Tara Langston, LCSW")).toEqual(
      expect.objectContaining({ kind: "accept" }),
    );
  });
  it("rejects on no overlap", () => {
    expect(verifyGrowMatch(lead(), "James Smith")).toEqual(
      expect.objectContaining({ kind: "reject" }),
    );
  });
});

describe("verifyTherapyDenMatch", () => {
  it("accepts when last-name token matches", () => {
    expect(verifyTherapyDenMatch(lead(), "Tara Langston, LMFT")).toEqual(
      expect.objectContaining({ kind: "accept" }),
    );
  });
  it("rejects on no overlap", () => {
    expect(verifyTherapyDenMatch(lead(), "Maria Lopez")).toEqual(
      expect.objectContaining({ kind: "reject" }),
    );
  });
});
