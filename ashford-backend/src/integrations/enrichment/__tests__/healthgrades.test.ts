import { describe, it, expect } from "vitest";
import { verifyHealthgradesMatch } from "../healthgrades";
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

describe("verifyHealthgradesMatch", () => {
  it("accepts when profile name contains the lead's last-name token", () => {
    expect(
      verifyHealthgradesMatch(lead(), "Dr. Tara Langston, LPC"),
    ).toEqual(expect.objectContaining({ kind: "accept" }));
  });

  it("accepts case-insensitively", () => {
    expect(
      verifyHealthgradesMatch(lead(), "TARA LANGSTON LPC"),
    ).toEqual(expect.objectContaining({ kind: "accept" }));
  });

  it("rejects when profile name is missing the lead's last-name token", () => {
    expect(
      verifyHealthgradesMatch(lead(), "Dr. Sarah Johnson, MD"),
    ).toEqual(expect.objectContaining({ kind: "reject" }));
  });

  it("rejects when the parser gave us no profile name", () => {
    expect(verifyHealthgradesMatch(lead(), null)).toEqual(
      expect.objectContaining({ kind: "reject" }),
    );
  });

  it("strips honorifics from the lead name when extracting the last token", () => {
    expect(
      verifyHealthgradesMatch(
        lead({ name: "Dr. Sarah Smith, MD" }),
        "Dr. Sarah Smith, MD",
      ),
    ).toEqual(expect.objectContaining({ kind: "accept" }));
  });

  it("does NOT accept on first-name-only overlap", () => {
    expect(
      verifyHealthgradesMatch(
        lead({ name: "Tara Langston" }),
        "Dr. Tara McAllister",
      ),
    ).toEqual(expect.objectContaining({ kind: "reject" }));
  });
});
