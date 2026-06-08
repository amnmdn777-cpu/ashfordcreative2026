import { describe, it, expect } from "vitest";
import type { DomainOffer } from "@workspace/api-zod";
import { curateSuggestPicks } from "../domains";

/**
 * Pins the deterministic 3-free + 2-premium curation that the
 * /public/domains/suggest endpoint feeds into the picker grid.
 *
 * Background: the picker is a single 5-column row — partial rows look
 * broken on desktop and unreviewed-feeling on mobile. Before task #176
 * (2026-04-27) the route did a `.slice(0, 5)` over a status-sorted
 * list, which would happily ship 5 free OR 5 premium depending on what
 * the registrar returned. The fix introduced explicit bucket targets
 * (3 free, 2 premium) with a top-up rule when one bucket is short.
 *
 * These tests pin that contract so a future refactor — e.g. someone
 * "simplifying" the curation back into a single sort + slice — fails
 * loudly instead of silently regressing the row to a single bucket.
 */

const MONEY = { amount: 0, currency: "USD" } as const;

function offer(domain: string, status: DomainOffer["status"]): DomainOffer {
  return {
    domain,
    status,
    retailPrice: { ...MONEY },
    ourPrice: { ...MONEY },
  };
}

function free(domain: string): DomainOffer {
  return offer(domain, "available");
}
function premium(domain: string): DomainOffer {
  return offer(domain, "premium");
}
function taken(domain: string): DomainOffer {
  return offer(domain, "taken");
}
function invalid(domain: string): DomainOffer {
  return offer(domain, "invalid");
}

describe("curateSuggestPicks", () => {
  it("happy path: 5 free + 5 premium → 3 free then 2 premium, in that order", () => {
    const input: DomainOffer[] = [
      free("a.com"),
      free("b.com"),
      free("c.com"),
      free("d.com"),
      free("e.com"),
      premium("p1.com"),
      premium("p2.com"),
      premium("p3.com"),
      premium("p4.com"),
      premium("p5.com"),
    ];
    const out = curateSuggestPicks(input);
    expect(out.map((o) => o.domain)).toEqual([
      "a.com",
      "b.com",
      "c.com",
      "p1.com",
      "p2.com",
    ]);
    expect(out.filter((o) => o.status === "available")).toHaveLength(3);
    expect(out.filter((o) => o.status === "premium")).toHaveLength(2);
  });

  it("free pool empty → tops up entirely from premium and returns 5 premium", () => {
    const input: DomainOffer[] = [
      premium("p1.com"),
      premium("p2.com"),
      premium("p3.com"),
      premium("p4.com"),
      premium("p5.com"),
      premium("p6.com"),
    ];
    const out = curateSuggestPicks(input);
    expect(out).toHaveLength(5);
    expect(out.every((o) => o.status === "premium")).toBe(true);
    // Top-up preserves input order so the row is reproducible across
    // identical requests.
    expect(out.map((o) => o.domain)).toEqual([
      "p1.com",
      "p2.com",
      "p3.com",
      "p4.com",
      "p5.com",
    ]);
  });

  it("premium pool empty → tops up entirely from free and returns 5 free", () => {
    const input: DomainOffer[] = [
      free("a.com"),
      free("b.com"),
      free("c.com"),
      free("d.com"),
      free("e.com"),
      free("f.com"),
    ];
    const out = curateSuggestPicks(input);
    expect(out).toHaveLength(5);
    expect(out.every((o) => o.status === "available")).toBe(true);
    expect(out.map((o) => o.domain)).toEqual([
      "a.com",
      "b.com",
      "c.com",
      "d.com",
      "e.com",
    ]);
  });

  it("sparse mix (2 free + 1 premium) → returns all 3, no padding", () => {
    const input: DomainOffer[] = [
      free("a.com"),
      free("b.com"),
      premium("p1.com"),
    ];
    const out = curateSuggestPicks(input);
    expect(out).toHaveLength(3);
    expect(out.map((o) => o.domain)).toEqual(["a.com", "b.com", "p1.com"]);
  });

  it("drops taken and invalid statuses entirely", () => {
    const input: DomainOffer[] = [
      free("a.com"),
      taken("b.com"),
      invalid("c.com"),
      free("d.com"),
      taken("e.com"),
      premium("p1.com"),
      invalid("p2.com"),
    ];
    const out = curateSuggestPicks(input);
    expect(out).toHaveLength(3);
    expect(out.map((o) => o.status)).not.toContain("taken");
    expect(out.map((o) => o.status)).not.toContain("invalid");
    expect(out.map((o) => o.domain)).toEqual(["a.com", "d.com", "p1.com"]);
  });

  it("empty input → empty output (no crash, no padding)", () => {
    expect(curateSuggestPicks([])).toEqual([]);
  });

  it("3 free + 5 premium → keeps all 3 free, tops premium up to its target only (5 total)", () => {
    // Regression guard: a previous refactor candidate tried to fill the
    // grid even when *both* targets were already met, which would have
    // surfaced a 4th premium and pushed total to 6.
    const input: DomainOffer[] = [
      free("a.com"),
      free("b.com"),
      free("c.com"),
      premium("p1.com"),
      premium("p2.com"),
      premium("p3.com"),
      premium("p4.com"),
      premium("p5.com"),
    ];
    const out = curateSuggestPicks(input);
    expect(out).toHaveLength(5);
    expect(out.filter((o) => o.status === "available")).toHaveLength(3);
    expect(out.filter((o) => o.status === "premium")).toHaveLength(2);
  });

  it("1 free + 5 premium → tops free bucket up to 3 from premium (1 free + 4 premium would be wrong)", () => {
    // Encodes the actual bug from task #176: when free was short the
    // row would silently become 5 premium. The fix says: keep the 1
    // free we have, then fill the remaining 4 slots from premium.
    const input: DomainOffer[] = [
      free("a.com"),
      premium("p1.com"),
      premium("p2.com"),
      premium("p3.com"),
      premium("p4.com"),
      premium("p5.com"),
    ];
    const out = curateSuggestPicks(input);
    expect(out).toHaveLength(5);
    expect(out.filter((o) => o.status === "available")).toHaveLength(1);
    expect(out.filter((o) => o.status === "premium")).toHaveLength(4);
    // Free entry must lead — the picker visually anchors on the free
    // card.
    expect(out[0]?.status).toBe("available");
  });
});
