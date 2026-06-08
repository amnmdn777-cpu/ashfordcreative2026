import { describe, it, expect } from "vitest";
import { sanitizeAiOutput } from "../aiSynthesis";

describe("sanitizeAiOutput", () => {
  it("drops a fabricated team bio not present in any source", () => {
    const aiOut = {
      team: [
        {
          name: "Tara Langston",
          credentials: "LCSW",
          bio: "Bilingual LCSW with over 10 years of trauma-informed practice in Plano.",
        },
      ],
    };
    const sources = {
      npi_registry: { profile: { name: "Tara Langston", credential: "LPC" } },
    };
    const out = sanitizeAiOutput(aiOut, sources, 1);
    expect(out.team).toHaveLength(1);
    const team = out.team as Array<{ name: string; bio: string | null }>;
    expect(team[0].name).toBe("Tara Langston");
    // Bio fabricated → null
    expect(team[0].bio).toBeNull();
  });

  it("keeps a team bio that appears verbatim in a source", () => {
    const realBio =
      "Hi, I'm Tara Langston, a Licensed Professional Counselor with a master's degree in Counseling from Southern Methodist University.";
    const aiOut = {
      team: [{ name: "Tara Langston", credentials: "LPC", bio: realBio }],
    };
    const sources = {
      headway: { profile: { name: "Tara Langston", bio: realBio } },
    };
    const out = sanitizeAiOutput(aiOut, sources, 1);
    const team = out.team as Array<{ bio: string | null }>;
    expect(team[0].bio).toBe(realBio);
  });

  it("drops a team entry whose name is absent from every source", () => {
    const aiOut = {
      team: [
        { name: "Tara Langston", credentials: "LPC", bio: null },
        { name: "Maya Alvarado", credentials: "LCSW", bio: null },
      ],
    };
    const sources = {
      headway: { profile: { name: "Tara Langston" } },
    };
    const out = sanitizeAiOutput(aiOut, sources, 1);
    const team = out.team as Array<{ name: string }>;
    expect(team).toHaveLength(1);
    expect(team[0].name).toBe("Tara Langston");
  });

  it("nulls fabricated aboutBlurb when no source contains it verbatim", () => {
    const aiOut = {
      aboutBlurb:
        "I believe healing isn't about fixing what's broken — it's about rediscovering the warmth and strength that was always yours.",
    };
    const sources = {
      npi_registry: { profile: { name: "Tara Langston" } },
    };
    const out = sanitizeAiOutput(aiOut, sources, 1);
    expect(out.aboutBlurb).toBeNull();
  });

  it("keeps short bios (< 60 chars) without verbatim verification", () => {
    const aiOut = {
      team: [
        {
          name: "Tara Langston",
          credentials: "LPC",
          bio: "Anxiety, Depression, Trauma",
        },
      ],
    };
    const sources = {
      headway: { profile: { name: "Tara Langston" } },
    };
    const out = sanitizeAiOutput(aiOut, sources, 1);
    const team = out.team as Array<{ bio: string | null }>;
    expect(team[0].bio).toBe("Anxiety, Depression, Trauma");
  });

  it("normalizes whitespace + punctuation when checking verbatim presence", () => {
    const realBio =
      "Hi,   I'm Tara Langston!  A Licensed Professional Counselor with experience in trauma.";
    const aiOut = {
      team: [
        {
          name: "Tara Langston",
          credentials: "LPC",
          bio: "Hi, I'm Tara Langston! A Licensed Professional Counselor with experience in trauma.",
        },
      ],
    };
    const sources = { headway: { profile: { name: "Tara Langston", bio: realBio } } };
    const out = sanitizeAiOutput(aiOut, sources, 1);
    const team = out.team as Array<{ bio: string | null }>;
    expect(team[0].bio).not.toBeNull();
  });
});
