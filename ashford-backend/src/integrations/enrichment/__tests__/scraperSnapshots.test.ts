import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parseHeadwayProfile } from "../headway";
import { parseZencareProfile } from "../zencare";
import { parseAlmaProfile } from "../alma";
import { parseGrowProfile } from "../growTherapy";
import { parseTherapyDenProfile } from "../therapyDen";

/**
 * Snapshot tests against real-world HTML fixtures. See
 * `fixtures/README.md` for the naming convention. When a directory
 * changes their HTML structure, this test trips before the change
 * reaches a real prospect's preview.
 *
 * The test suite is permissive: when no fixtures are present (fresh
 * checkout), each parser asserts a no-op so the test file doesn't
 * fail for the wrong reason. Adding fixtures activates real
 * snapshot coverage automatically.
 */

const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);

interface ParserConfig {
  prefix: string;
  parse: (html: string, profileUrl: string) => unknown;
  /** Build a synthetic profile URL from the fixture filename. */
  buildUrl: (slug: string) => string;
}

const PARSERS: ParserConfig[] = [
  {
    prefix: "headway-",
    parse: parseHeadwayProfile,
    buildUrl: (slug) => `https://care.headway.co/providers/${slug}`,
  },
  {
    prefix: "zencare-",
    parse: parseZencareProfile,
    buildUrl: (slug) => `https://www.zencare.co/profile/${slug}`,
  },
  {
    prefix: "alma-",
    parse: parseAlmaProfile,
    buildUrl: (slug) => `https://helloalma.com/providers/${slug}`,
  },
  {
    prefix: "growtherapy-",
    parse: parseGrowProfile,
    buildUrl: (slug) => `https://growtherapy.com/providers/${slug}`,
  },
  {
    prefix: "therapyden-",
    parse: parseTherapyDenProfile,
    buildUrl: (slug) => `https://therapyden.com/therapists/${slug}`,
  },
];

const listFixtures = (): string[] => {
  if (!existsSync(FIXTURES_DIR)) return [];
  return readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".html"));
};

describe("scraper snapshots", () => {
  const fixtures = listFixtures();
  if (fixtures.length === 0) {
    it("has no fixtures yet (drop real HTML samples in fixtures/)", () => {
      expect(true).toBe(true);
    });
    return;
  }

  for (const filename of fixtures) {
    const cfg = PARSERS.find((p) => filename.startsWith(p.prefix));
    if (!cfg) continue;
    const slug = filename.slice(cfg.prefix.length, -".html".length);

    it(`parses ${filename}`, () => {
      const html = readFileSync(join(FIXTURES_DIR, filename), "utf8");
      const profile = cfg.parse(html, cfg.buildUrl(slug));
      // Anti-regression invariants — every successful parse must
      // produce these. Snapshot covers the full structure.
      expect(profile).not.toBeNull();
      const p = profile as { name: string | null };
      expect(p.name).toBeTruthy();
      expect(profile).toMatchSnapshot();
    });
  }
});
