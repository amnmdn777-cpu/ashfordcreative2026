import { describe, it, expect } from "vitest";
import { normalizePersonName } from "../normalizeName";

describe("normalizePersonName", () => {
  it("returns empty for null/undefined/empty", () => {
    expect(normalizePersonName(null)).toBe("");
    expect(normalizePersonName(undefined)).toBe("");
    expect(normalizePersonName("")).toBe("");
    expect(normalizePersonName("   ")).toBe("");
  });

  it("leaves clean names alone", () => {
    expect(normalizePersonName("Sarah Wilson")).toBe("Sarah Wilson");
    expect(normalizePersonName("Maria De La Cruz")).toBe("Maria De La Cruz");
    expect(normalizePersonName("Vincent Van Gogh")).toBe("Vincent Van Gogh");
    expect(normalizePersonName("Dr. Maya Alvarado")).toBe("Dr. Maya Alvarado");
  });

  it("collapses the production bug 'Cynthia Los De Los Santos'", () => {
    expect(normalizePersonName("Cynthia Los De Los Santos")).toBe(
      "Cynthia De Los Santos",
    );
  });

  it("collapses adjacent duplicates", () => {
    expect(normalizePersonName("John John Smith")).toBe("John Smith");
    expect(normalizePersonName("Mary Mary Mary Sue")).toBe("Mary Sue");
  });

  it("is idempotent", () => {
    const once = normalizePersonName("Cynthia Los De Los Santos");
    const twice = normalizePersonName(once);
    expect(twice).toBe(once);
  });

  it("collapses internal whitespace", () => {
    expect(normalizePersonName("Sarah    Wilson")).toBe("Sarah Wilson");
    expect(normalizePersonName("  Sarah  Wilson  ")).toBe("Sarah Wilson");
  });

  it("preserves original casing on kept tokens", () => {
    expect(normalizePersonName("CYNTHIA Los De Los SANTOS")).toBe(
      "CYNTHIA De Los SANTOS",
    );
  });

  it("does not touch non-connector duplicates that aren't adjacent", () => {
    // "Smith" appears twice but it's not a connector -> leave it.
    expect(normalizePersonName("Smith John Smith")).toBe("Smith John Smith");
  });
});
