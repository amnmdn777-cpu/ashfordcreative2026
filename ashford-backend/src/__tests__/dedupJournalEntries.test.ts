// LOT 2.5 — pin journal-entry slug dedup. ~20% of LLM runs ship
// duplicate entries; Gail saw 1 dup, Stephanie Wright saw 2.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("../lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { dedupJournalEntriesBySlug } from "../services/draftJournal";
import { logger } from "../lib/logger";

const entry = (slug: string, title = `Title for ${slug}`) => ({
  title,
  slug,
  excerpt: "ex",
  body: "body".repeat(40),
  readingMinutes: 2,
});

describe("dedupJournalEntriesBySlug", () => {
  beforeEach(() => {
    vi.mocked(logger.warn).mockClear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the input unchanged when all slugs are unique", () => {
    const input = [entry("a"), entry("b"), entry("c")];
    const out = dedupJournalEntriesBySlug(input);
    expect(out).toEqual(input);
    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
  });

  it("Gail case: drops a single duplicate and warns once", () => {
    const input = [entry("trauma-feels"), entry("anxiety-story"), entry("trauma-feels")];
    const out = dedupJournalEntriesBySlug(input, { practitionerName: "Gail" });
    expect(out.map((e) => e.slug)).toEqual(["trauma-feels", "anxiety-story"]);
    expect(vi.mocked(logger.warn)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logger.warn).mock.calls[0]![0]).toMatchObject({
      practitionerName: "Gail",
      dupSlugs: ["trauma-feels"],
      kept: 2,
    });
  });

  it("Stephanie Wright case: drops two duplicates", () => {
    const input = [
      entry("attachment-language"),
      entry("attachment-language"),
      entry("matrescence-shift"),
      entry("attachment-language"),
    ];
    const out = dedupJournalEntriesBySlug(input);
    expect(out.map((e) => e.slug)).toEqual([
      "attachment-language",
      "matrescence-shift",
    ]);
    expect(vi.mocked(logger.warn).mock.calls[0]![0]).toMatchObject({
      dupSlugs: ["attachment-language", "attachment-language"],
      kept: 2,
    });
  });

  it("treats slug comparison case-insensitively + trimmed", () => {
    const input = [entry("Trauma-Feels"), entry("  trauma-feels  ")];
    const out = dedupJournalEntriesBySlug(input);
    expect(out).toHaveLength(1);
    expect(out[0]!.slug).toBe("Trauma-Feels");
  });

  it("drops entries with empty slugs silently (no warn for empties)", () => {
    const input = [entry(""), entry("real"), entry("")];
    const out = dedupJournalEntriesBySlug(input);
    expect(out.map((e) => e.slug)).toEqual(["real"]);
    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
  });
});
