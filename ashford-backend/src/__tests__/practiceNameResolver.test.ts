// LOT 2.3 — pin the practiceName waterfall to the QA Round 5/6 cases.
//
// Each fixture mirrors a real prod lead where the old "confidence-ranked"
// logic picked the wrong source.

import { describe, expect, it } from "vitest";
import {
  parseLinkedInPracticeName,
  resolvePracticeName,
} from "../services/practiceNameResolver";

describe("parseLinkedInPracticeName", () => {
  it("extracts trailing PracticeName from 'Name - License at X'", () => {
    expect(
      parseLinkedInPracticeName(
        "Jane Smith, LPC at Be Well Behavioral Health",
      ),
    ).toBe("Be Well Behavioral Health");
  });

  it("strips the | LinkedIn suffix", () => {
    expect(
      parseLinkedInPracticeName(
        "Jane Smith - LMFT at Flatland Counseling | LinkedIn",
      ),
    ).toBe("Flatland Counseling");
  });

  it("uses the LAST ' at ' for chained employers", () => {
    expect(
      parseLinkedInPracticeName("John, Therapist at Acme at Beta Group"),
    ).toBe("Beta Group");
  });

  it("rejects 'Self' / 'Private Practice'", () => {
    expect(parseLinkedInPracticeName("Jane Smith, LPC at Self")).toBeNull();
    expect(
      parseLinkedInPracticeName("Jane Smith, LPC at Private Practice"),
    ).toBeNull();
  });

  it("returns null when there is no ' at '", () => {
    expect(parseLinkedInPracticeName("Jane Smith — Therapist")).toBeNull();
    expect(parseLinkedInPracticeName(null)).toBeNull();
  });
});

describe("resolvePracticeName", () => {
  it("Gail: generator=Hostinger Horizons must NOT win", () => {
    // The original Gail bug: <title>Hostinger Horizons</title> was
    // confidence 70 from website_meta and beat LinkedIn's 60. New
    // waterfall: LinkedIn always wins when present, builder titles
    // are ignored.
    const result = resolvePracticeName({
      linkedin: {
        profiles: [
          {
            title: "Gail Brown, LPC at Be Well Behavioral Health",
            url: "https://linkedin.com/in/gail",
            snippet: null,
          },
        ],
      },
      websiteMeta: {
        title: "Hostinger Horizons",
        h1: null,
        generator: "Hostinger Horizons",
      },
      leadPractice: "Bwbh The Rapy",
      aiPracticeName: null,
    });
    expect(result?.value).toBe("Be Well Behavioral Health");
    expect(result?.source).toBe("linkedin_apify");
  });

  it("Flatland: LinkedIn wins over a corrupted CRM practice", () => {
    const result = resolvePracticeName({
      linkedin: {
        profiles: [
          { title: "Sara Doe, LMFT at Flatland Counseling", url: null, snippet: null },
        ],
      },
      websiteMeta: null,
      leadPractice: "Flatland And Counseling",
      aiPracticeName: null,
    });
    expect(result?.value).toBe("Flatland Counseling");
    expect(result?.source).toBe("linkedin_apify");
  });

  it("Outside the Box: <h1> wins when LinkedIn is absent and title is a builder default", () => {
    const result = resolvePracticeName({
      linkedin: null,
      websiteMeta: {
        title: "Wix.com Website Builder",
        h1: "Outside the Box Psychotherapy",
        generator: "Wix.com Website Builder",
      },
      leadPractice: "Outside The Boxpsycho The Rapy",
      aiPracticeName: null,
    });
    expect(result?.value).toBe("Outside the Box Psychotherapy");
    expect(result?.source).toBe("website_meta");
  });

  it("W.A.Y.S Therapy: LinkedIn wins despite lower confidence than website_meta", () => {
    const result = resolvePracticeName({
      linkedin: {
        profiles: [
          { title: "Maria, LPC at W.A.Y.S Therapy", url: null, snippet: null },
        ],
      },
      websiteMeta: {
        title: "Therapy & Counseling Services | Houston, TX",
        h1: "Welcome",
        generator: null,
      },
      leadPractice: "W A Y S Therapy",
      aiPracticeName: null,
    });
    expect(result?.value).toBe("W.A.Y.S Therapy");
    expect(result?.source).toBe("linkedin_apify");
  });

  it("falls through to lead.practice when every source is generic / missing", () => {
    const result = resolvePracticeName({
      linkedin: null,
      websiteMeta: { title: "Squarespace", h1: "Home", generator: "Squarespace" },
      leadPractice: "Care Group",
      aiPracticeName: "Fallback AI Name",
    });
    expect(result?.value).toBe("Care Group");
    expect(result?.source).toBe("lead_record");
  });

  it("never returns generator meta as the practice name", () => {
    // Even with NO other signals, an explicit generator value should not
    // surface — practiceNameResolver doesn't consume it at all.
    const result = resolvePracticeName({
      linkedin: null,
      websiteMeta: { title: null, h1: null, generator: "Hostinger Horizons" },
      leadPractice: null,
      aiPracticeName: null,
    });
    expect(result).toBeNull();
  });
});
