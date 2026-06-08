import { describe, it, expect } from "vitest";
import { verifyLinkedInMatch } from "../linkedinApify";
import type { LeadInput } from "../types";

const therapyLead = (overrides: Partial<LeadInput> = {}): LeadInput => ({
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

describe("verifyLinkedInMatch", () => {
  it("rejects same-name profile in an unrelated industry (Tara/Skincare case)", () => {
    expect(
      verifyLinkedInMatch(
        therapyLead(),
        "Tara Langston - Skincare Entrepreneur",
        "Founder at Tara Skin Studio. Helping women reclaim their glow.",
      ),
    ).toBe(false);
  });

  it("accepts a real therapist with credential in title", () => {
    expect(
      verifyLinkedInMatch(
        therapyLead({ name: "Sarah Smith" }),
        "Sarah Smith, LCSW - Therapist at Smith Counseling",
        "Licensed Clinical Social Worker specializing in trauma and EMDR.",
      ),
    ).toBe(true);
  });

  it("accepts when only the snippet has therapy keywords", () => {
    expect(
      verifyLinkedInMatch(
        therapyLead({ name: "Maria Gomez" }),
        "Maria Gomez | Plano, TX",
        "Bilingual therapist specializing in family counseling.",
      ),
    ).toBe(true);
  });

  it("rejects when the lead's last name is missing entirely", () => {
    expect(
      verifyLinkedInMatch(
        therapyLead({ name: "John Andersen" }),
        "Sara Johnson, LCSW - Anxiety specialist",
        "Therapist focusing on adult anxiety and depression.",
      ),
    ).toBe(false);
  });

  it("name-only gates for non-mental-health leads (dentist)", () => {
    expect(
      verifyLinkedInMatch(
        therapyLead({ name: "Tara Langston", specialty: "Dentistry" }),
        "Tara Langston - Dentist at Smiles Plano",
        "DDS at Smiles Dental Clinic.",
      ),
    ).toBe(true);
  });

  it("rejects software engineer for therapy lead even with name match", () => {
    expect(
      verifyLinkedInMatch(
        therapyLead(),
        "Tara Langston - Software Engineer at Acme",
        "Backend developer working on distributed systems.",
      ),
    ).toBe(false);
  });

  it("accepts psychiatry-related profiles for therapy leads", () => {
    expect(
      verifyLinkedInMatch(
        therapyLead({ name: "James Carter" }),
        "James Carter, MD - Psychiatrist",
        "Practicing psychiatrist in private practice.",
      ),
    ).toBe(true);
  });

  it("accepts when 'therapy' or 'counseling' appears in any case", () => {
    expect(
      verifyLinkedInMatch(
        therapyLead({ name: "Tara Langston" }),
        "Tara Langston | Owner",
        "Run my own therapy practice in Plano, TX.",
      ),
    ).toBe(true);
  });
});
