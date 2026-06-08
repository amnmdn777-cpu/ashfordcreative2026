import { describe, it, expect } from "vitest";
import {
  getInsuranceBrand,
  decorateInsurances,
} from "../insuranceBranding";

describe("getInsuranceBrand", () => {
  it("matches the headline payers verbatim", () => {
    expect(getInsuranceBrand("Aetna")).toEqual(
      expect.objectContaining({ name: "Aetna", short: "Aetna" }),
    );
    expect(getInsuranceBrand("Cigna")).toEqual(
      expect.objectContaining({ name: "Cigna", short: "Cigna" }),
    );
    expect(getInsuranceBrand("Kaiser Permanente")).toEqual(
      expect.objectContaining({ name: "Kaiser Permanente", short: "Kaiser" }),
    );
  });

  it("matches free-form payer names with extra words", () => {
    expect(getInsuranceBrand("Aetna Better Health of Texas")).toEqual(
      expect.objectContaining({ name: "Aetna" }),
    );
    expect(getInsuranceBrand("UnitedHealthcare PPO")).toEqual(
      expect.objectContaining({ name: "UnitedHealthcare" }),
    );
  });

  it("collapses BCBS state-licensed plans onto the umbrella brand", () => {
    expect(
      getInsuranceBrand(
        "Horizon Blue Cross and Blue Shield of New Jersey",
      ),
    ).toEqual(expect.objectContaining({ short: "Horizon BCBS" }));
    expect(getInsuranceBrand("Independence Blue Cross Pennsylvania")).toEqual(
      expect.objectContaining({ short: "Indep. BCBS" }),
    );
    expect(getInsuranceBrand("BCBS of Texas")).toEqual(
      expect.objectContaining({ short: "BCBS" }),
    );
  });

  it("returns null for unknown payers", () => {
    expect(getInsuranceBrand("Acme Mutual")).toBeNull();
    expect(getInsuranceBrand("")).toBeNull();
  });

  it("matches case-insensitively", () => {
    expect(getInsuranceBrand("aETNA")).toEqual(
      expect.objectContaining({ name: "Aetna" }),
    );
  });
});

describe("decorateInsurances", () => {
  it("preserves input order and falls back to raw name for unknowns", () => {
    const got = decorateInsurances([
      "Aetna",
      "Acme Mutual",
      "Cigna",
    ]);
    expect(got.map((d) => d.name)).toEqual(["Aetna", "Acme Mutual", "Cigna"]);
    expect(got[1].color).toBeNull();
    expect(got[0].color).not.toBeNull();
  });

  it("decorates Tara's actual Headway insurance list", () => {
    // From Headway profile screenshot: Aetna, Ascension, Carelon
    // Behavioral Health, Cigna, Horizon Blue Cross and Blue Shield
    // of New Jersey, Independence Blue Cross Pennsylvania - Virtual
    // National Network, Quest Behavioral Health.
    const got = decorateInsurances([
      "Aetna",
      "Ascension",
      "Carelon Behavioral Health",
      "Cigna",
      "Horizon Blue Cross and Blue Shield of New Jersey",
      "Independence Blue Cross Pennsylvania - Virtual National Network",
      "Quest Behavioral Health",
    ]);
    // All seven should match a known brand.
    for (const d of got) {
      expect(d.color).not.toBeNull();
    }
  });
});
