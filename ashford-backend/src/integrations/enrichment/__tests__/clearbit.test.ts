import { describe, it, expect } from "vitest";
import { verifyClearbitMatch } from "../clearbit";
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

describe("verifyClearbitMatch", () => {
  it("rejects CareerBuilder for Tara/Care lead (the original noise case)", () => {
    expect(
      verifyClearbitMatch(lead(), "careerbuilder.com", "CareerBuilder"),
    ).toEqual(
      expect.objectContaining({ kind: "reject" }),
    );
  });

  it("accepts when domain matches lead's currentWebsite", () => {
    expect(
      verifyClearbitMatch(
        lead({ currentWebsite: "https://acmetherapy.com" }),
        "acmetherapy.com",
        "Acme Therapy",
      ),
    ).toEqual(expect.objectContaining({ kind: "accept" }));
  });

  it("accepts when domain is a subdomain of currentWebsite host", () => {
    expect(
      verifyClearbitMatch(
        lead({ currentWebsite: "https://acmetherapy.com" }),
        "www.acmetherapy.com",
        "Acme Therapy",
      ),
    ).toEqual(expect.objectContaining({ kind: "accept" }));
  });

  it("accepts a non-generic practice token in suggestion", () => {
    expect(
      verifyClearbitMatch(
        lead({ practice: "Riverstone Counseling" }),
        "riverstonecounseling.com",
        "Riverstone Counseling",
      ),
    ).toEqual(expect.objectContaining({ kind: "accept" }));
  });

  it("rejects generic practice word match (Care alone is not enough)", () => {
    expect(
      verifyClearbitMatch(
        lead({ practice: "Care" }),
        "carebuilder.com",
        "CareBuilder",
      ),
    ).toEqual(expect.objectContaining({ kind: "reject" }));
  });

  it("accepts on last-name token match (solo practice)", () => {
    expect(
      verifyClearbitMatch(
        lead({ name: "Sarah Reynolds", practice: "Therapy" }),
        "reynoldstherapy.com",
        "Reynolds Therapy",
      ),
    ).toEqual(expect.objectContaining({ kind: "accept" }));
  });

  it("rejects when neither domain nor name has any overlap with lead", () => {
    expect(
      verifyClearbitMatch(lead(), "randombusiness.com", "Random Business Inc."),
    ).toEqual(expect.objectContaining({ kind: "reject" }));
  });
});
