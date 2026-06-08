// LOT 2.1 — fixtures pinned by the corruption examples in QA Round 5/6.
//
// Note: per the LOT 2 prompt this test was specified at
// `lib/api-zod/src/__tests__/toTitleCase.test.ts`, but lib/api-zod has no
// vitest wiring and its tsconfig (composite, emitDeclarationOnly) would
// have to grow a vitest devDep to typecheck. The function under test
// still lives in lib/api-zod; only the spec lives under api-server, which
// already runs vitest. See `lib/api-zod/src/toTitleCase.ts`.

import { describe, expect, it } from "vitest";
import { splitPracticeStem, toTitleCase } from "@workspace/api-zod";

describe("splitPracticeStem", () => {
  it("does NOT split mid-word for short keywords (the/and)", () => {
    expect(splitPracticeStem("bwbhtherapy")).toBe("bwbh therapy");
    expect(splitPracticeStem("growtherapy")).toBe("grow therapy");
    expect(splitPracticeStem("flatlandcounseling")).toBe("flatland counseling");
  });

  it("prefers longer keywords over shorter substrings", () => {
    // `psychotherapy` wins over `therapy` because alternation is sorted
    // longest-first. `the` is intentionally not a keyword (would corrupt
    // `therapy` → `the rapy`), so the leading `outsidethebox` stays glued.
    expect(splitPracticeStem("outsidetheboxpsychotherapy")).toBe(
      "outsidethebox psychotherapy",
    );
  });

  it("preserves a stem that the heuristic can't break up", () => {
    expect(splitPracticeStem("heatherfrytherapy")).toBe("heatherfry therapy");
  });
});

describe("toTitleCase", () => {
  it("title-cases simple two-word practice names", () => {
    expect(toTitleCase("flatland counseling")).toBe("Flatland Counseling");
    expect(toTitleCase("grow therapy")).toBe("Grow Therapy");
    expect(toTitleCase("heatherfry therapy")).toBe("Heatherfry Therapy");
  });

  it("never re-introduces the 'The Rapy' corruption", () => {
    // Round-trip the corrupted strings: lowercase + strip spaces, then
    // re-derive. The new pipeline must collapse `the rapy` back into a
    // single `therapy` keyword.
    const cycle = (s: string) =>
      toTitleCase(splitPracticeStem(s.replace(/\s+/g, "").toLowerCase()));
    expect(cycle("Bwbh The Rapy")).not.toMatch(/The Rapy/);
    expect(cycle("Outside The Boxpsycho The Rapy")).not.toMatch(/The Rapy/);
    expect(cycle("Hea The Rfry The Rapy")).not.toMatch(/The Rapy/);
  });

  it("keeps interior small words lowercase when already space-separated", () => {
    // toTitleCase doesn't try to *split* "outside the box" out of a glued
    // stem (that's splitPracticeStem's job, and `the` was intentionally
    // dropped from its keyword list). It just title-cases what it's given.
    expect(toTitleCase("outside the box psychotherapy")).toBe(
      "Outside the Box Psychotherapy",
    );
  });

  it("uppercases short no-vowel tokens as acronyms", () => {
    expect(toTitleCase("bwbh therapy")).toBe("BWBH Therapy");
  });

  it("handles dotted initialisms (W.A.Y.S)", () => {
    expect(toTitleCase("w.a.y.s therapy")).toBe("W.A.Y.S Therapy");
  });

  it("preserves runs of 2+ uppercase letters in the input", () => {
    expect(toTitleCase("BWBH therapy")).toBe("BWBH Therapy");
  });
});
