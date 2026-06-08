import { describe, it, expect } from "vitest";
import { suggestTemplateForBrand } from "../templatePaletteSuggestion";

describe("suggestTemplateForBrand", () => {
  it("returns null when brand accent is missing or invalid", () => {
    expect(suggestTemplateForBrand(null)).toBeNull();
    expect(suggestTemplateForBrand("")).toBeNull();
    expect(suggestTemplateForBrand("not-a-color")).toBeNull();
  });

  it("returns null for desaturated grey-ish brands (no hue signal)", () => {
    // Pure mid-grey — s = 0.
    expect(suggestTemplateForBrand("#888888")).toBeNull();
  });

  it("suggests garden for a sage-green brand", () => {
    // Garden palette primary: #4a5f45 (sage). Match a similar sage.
    const got = suggestTemplateForBrand("#5a724f");
    expect(got).not.toBeNull();
    expect(got!.templateKey).toBe("garden");
    expect(["strong", "ok"]).toContain(got!.fit);
  });

  it("suggests sunrise for a lavender / purple brand", () => {
    // Sunrise palette primary: #7c6f9b. Match a similar lavender.
    const got = suggestTemplateForBrand("#806d9c");
    expect(got).not.toBeNull();
    expect(got!.templateKey).toBe("sunrise");
    expect(got!.fit).toBe("strong");
  });

  it("suggests constellation for an amber/orange brand", () => {
    // Constellation primary: #f59e0b.
    const got = suggestTemplateForBrand("#f0a020");
    expect(got).not.toBeNull();
    expect(got!.templateKey).toBe("constellation");
  });

  it("suggests a dark-navy template for a slate-blue brand", () => {
    // Atrium was retired 2026-05; the closest remaining hue is
    // constellation's deep navy primary (#0B1426).
    const got = suggestTemplateForBrand("#506784");
    expect(got).not.toBeNull();
    expect(got!.templateKey).toBe("constellation");
  });

  it("downgrades fit confidence when brand color is far from every template", () => {
    // Hot pink — none of the templates speak pink.
    const got = suggestTemplateForBrand("#ff1493");
    expect(got).not.toBeNull();
    // Whatever it picks should be a weak fit since pink isn't in the catalog.
    expect(got!.fit).not.toBe("strong");
  });

  it("returns a usable suggestion for the polaroid earthy palette", () => {
    // Polaroid primary: #2a2f2a (very dark, near-black).
    const got = suggestTemplateForBrand("#2a2f2a");
    expect(got).not.toBeNull();
    // Polaroid is desaturated so this might fail the s>0.1 gate;
    // pick a slightly-tinted version instead.
    const got2 = suggestTemplateForBrand("#2c3a2c");
    expect(got2).not.toBeNull();
    expect(got2!.templateKey).toBe("polaroid");
  });
});
