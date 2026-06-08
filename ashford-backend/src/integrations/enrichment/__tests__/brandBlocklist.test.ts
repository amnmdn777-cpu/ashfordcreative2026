import { describe, it, expect } from "vitest";
import { isPlatformBrandName, normalizeBrandName } from "../brandBlocklist";

describe("isPlatformBrandName", () => {
  it("rejects exact directory brand names", () => {
    for (const name of [
      "Care",
      "Care.com",
      "Headway",
      "Psychology Today",
      "psychologytoday",
      "Alma",
      "Grow Therapy",
      "Talkspace",
      "BetterHelp",
      "Zencare",
      "Zocdoc",
      "Healthgrades",
    ]) {
      expect(isPlatformBrandName(name), name).toBe(true);
    }
  });

  it("normalizes punctuation and case variants", () => {
    expect(isPlatformBrandName("PSYCH TODAY")).toBe(true);
    expect(isPlatformBrandName("psychology-today")).toBe(true);
    expect(isPlatformBrandName("Headway.co")).toBe(true);
    expect(isPlatformBrandName("  care  ")).toBe(true);
  });

  it("rejects generic page-section words that appear as H1", () => {
    for (const name of ["About", "Welcome", "Provider", "Profile", "Bio"]) {
      expect(isPlatformBrandName(name), name).toBe(true);
    }
  });

  it("accepts plausible practitioner names", () => {
    for (const name of [
      "Joanna Reyes-Kim",
      "Dr. Sam Castillo",
      "Maria O'Brien, LCSW",
      "Chen Wu",
    ]) {
      expect(isPlatformBrandName(name), name).toBe(false);
    }
  });

  it("treats empty/whitespace as junk", () => {
    expect(isPlatformBrandName("")).toBe(true);
    expect(isPlatformBrandName("   ")).toBe(true);
    expect(isPlatformBrandName(null)).toBe(true);
    expect(isPlatformBrandName(undefined)).toBe(true);
  });

  it("normalizeBrandName strips non-alphanumerics", () => {
    expect(normalizeBrandName("Psychology Today")).toBe("psychologytoday");
    expect(normalizeBrandName("care.com")).toBe("carecom");
  });
});
