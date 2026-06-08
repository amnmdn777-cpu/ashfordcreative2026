import { describe, expect, it } from "vitest";
import {
  classifyKind,
  extractInternalLinks,
  extractTeamFromPages,
  isAllowedByRobots,
  isPrivateAddress,
  parseRobots,
  rankPages,
  summarizeHtml,
  type PageRecord,
} from "../currentWebsitePages";

describe("currentWebsitePages: classifyKind", () => {
  it("maps common section paths to known kinds", () => {
    expect(classifyKind("/about")).toBe("about");
    expect(classifyKind("/our-team")).toBe("team");
    expect(classifyKind("/services/anxiety")).toBe("services");
    expect(classifyKind("/contact-us")).toBe("contact");
    expect(classifyKind("/fees-and-insurance")).toBe("fees");
    expect(classifyKind("/blog/post-1")).toBe("blog");
    expect(classifyKind("/random")).toBe("other");
  });
});

describe("currentWebsitePages: extractInternalLinks", () => {
  const base = new URL("https://example.com/");
  it("returns same-host paths only and dedupes by path", () => {
    const html = `
      <a href="/about">About</a>
      <a href='/about'>About again</a>
      <a href="https://example.com/team">Team</a>
      <a href="https://other.com/x">Outside</a>
      <a href="mailto:hi@example.com">Mail</a>
      <a href="/file.pdf">PDF</a>
      <a href="/blog">Blog</a>
    `;
    const links = extractInternalLinks(html, base);
    const paths = links.map((l) => l.path).sort();
    expect(paths).toEqual(["/about", "/blog", "/team"]);
    expect(links.find((l) => l.path === "/about")?.kind).toBe("about");
  });
});

describe("currentWebsitePages: rankPages", () => {
  it("keeps at most one page per kind and prioritises about/services/team", () => {
    const ranked = rankPages([
      { url: "u/blog-1", path: "/blog/1", kind: "blog" },
      { url: "u/team", path: "/team", kind: "team" },
      { url: "u/about", path: "/about", kind: "about" },
      { url: "u/services", path: "/services", kind: "services" },
      { url: "u/random", path: "/random", kind: "other" },
      { url: "u/blog-2", path: "/blog/2", kind: "blog" }, // dropped
    ]);
    const kinds = ranked.map((r) => r.kind);
    expect(kinds.slice(0, 3)).toEqual(["about", "services", "team"]);
    expect(kinds.filter((k) => k === "blog")).toHaveLength(1);
  });
});

describe("currentWebsitePages: summarizeHtml", () => {
  const base = new URL("https://example.com/");
  it("extracts title, h1, meta description, paragraphs, and absolute image URLs", () => {
    const html = `
      <html><head>
        <title>Lifeworks Online</title>
        <meta name="description" content="Compassionate therapy for adults." />
      </head>
      <body>
        <h1>Welcome to Lifeworks</h1>
        <p>We are a small group practice in Austin, Texas, dedicated to working with adults navigating anxiety, trauma, and life transitions.</p>
        <p>Short.</p>
        <p>Our therapists hold advanced degrees and bring decades of combined experience to the work, with a particular focus on relational psychodynamic approaches.</p>
        <img src="/hero.jpg" />
        <img src="https://cdn.example.com/team.jpg" />
        <img src="data:image/png;base64,xxx" />
      </body></html>
    `;
    const out = summarizeHtml(html, base);
    expect(out.title).toBe("Lifeworks Online");
    expect(out.h1).toBe("Welcome to Lifeworks");
    expect(out.summary).toBe("Compassionate therapy for adults.");
    expect(out.paragraphs).toHaveLength(2);
    expect(out.paragraphs[0]).toMatch(/Austin, Texas/);
    expect(out.images).toEqual([
      "https://example.com/hero.jpg",
      "https://cdn.example.com/team.jpg",
    ]);
  });

  it("falls back to the first paragraph when no meta description is present", () => {
    const html = `<p>${"x".repeat(80)}</p>`;
    const out = summarizeHtml(html, new URL("https://example.com"));
    expect(out.summary?.startsWith("xxxxxx")).toBe(true);
  });
});

describe("currentWebsitePages: robots.txt", () => {
  it("treats no robots as allow-all", () => {
    expect(isAllowedByRobots(null, "/anything")).toBe(true);
  });

  it("parses user-agent groups and applies longest-match wins", () => {
    const rules = parseRobots(`
      User-agent: *
      Disallow: /private
      Allow: /private/public-page
    `);
    expect(isAllowedByRobots(rules, "/about")).toBe(true);
    expect(isAllowedByRobots(rules, "/private/secrets")).toBe(false);
    expect(isAllowedByRobots(rules, "/private/public-page")).toBe(true);
  });

  it("prefers a UA-specific group over the wildcard group", () => {
    const rules = parseRobots(`
      User-agent: *
      Disallow: /

      User-agent: AshfordCreativeBot
      Disallow: /admin
    `);
    expect(isAllowedByRobots(rules, "/team")).toBe(true);
    expect(isAllowedByRobots(rules, "/admin/settings")).toBe(false);
  });
});

describe("currentWebsitePages: isPrivateAddress", () => {
  it("rejects RFC 1918, loopback, link-local, and metadata addresses", () => {
    expect(isPrivateAddress("10.0.0.1")).toBe(true);
    expect(isPrivateAddress("192.168.1.1")).toBe(true);
    expect(isPrivateAddress("172.16.0.1")).toBe(true);
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("169.254.169.254")).toBe(true);
    expect(isPrivateAddress("::1")).toBe(true);
    expect(isPrivateAddress("fe80::1")).toBe(true);
    expect(isPrivateAddress("fd00::1")).toBe(true);
  });

  it("accepts public IPv4 addresses", () => {
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("142.250.80.46")).toBe(false);
  });
});

describe("currentWebsitePages: SSRF guard on direct fetches", () => {
  // The SSRF guard runs *before* fetch() when ScraperAPI is not
  // configured. We assert via the public source.fetch() entrypoint
  // that a private host is refused without ever issuing a network
  // call (no fetch mock needed — if guard fails we'd timeout).
  it("refuses to crawl a lead whose currentWebsite resolves to a private literal", async () => {
    const { currentWebsitePagesSource } = await import(
      "../currentWebsitePages"
    );
    const result = await currentWebsitePagesSource.fetch({
      id: -1,
      currentWebsite: "http://127.0.0.1/admin",
    } as Parameters<typeof currentWebsitePagesSource.fetch>[0]);
    expect(result).toBeNull();
  });

  it("refuses literal cloud-metadata addresses", async () => {
    const { currentWebsitePagesSource } = await import(
      "../currentWebsitePages"
    );
    const result = await currentWebsitePagesSource.fetch({
      id: -1,
      currentWebsite: "http://169.254.169.254/latest/meta-data/",
    } as Parameters<typeof currentWebsitePagesSource.fetch>[0]);
    expect(result).toBeNull();
  });

  it("refuses RFC1918 literals on the IPv4-mapped-IPv6 form", async () => {
    const { isPrivateAddress } = await import("../currentWebsitePages");
    expect(isPrivateAddress("::ffff:10.0.0.5")).toBe(true);
    expect(isPrivateAddress("::ffff:169.254.169.254")).toBe(true);
  });
});

describe("currentWebsitePages: extractTeamFromPages", () => {
  it("returns nothing when there is no team-kind page", () => {
    const pages: PageRecord[] = [
      {
        url: "https://x.com/",
        path: "/",
        title: "Home",
        h1: null,
        summary: null,
        paragraphs: ["Maria Hernandez, LCSW is our founder."],
        images: [],
        kind: "home",
      },
    ];
    expect(extractTeamFromPages(pages)).toEqual([]);
  });

  it("extracts Name + Credentials patterns from the team page", () => {
    const pages: PageRecord[] = [
      {
        url: "https://x.com/team",
        path: "/team",
        title: "Our Team",
        h1: "Team",
        summary: null,
        paragraphs: [
          "Maria Hernandez, LCSW is our founder and lead therapist, specializing in anxiety and trauma work for adults.",
          "Robin Chen, PhD brings over a decade of experience treating perinatal mood disorders.",
          "Some unrelated paragraph without a credential pattern.",
        ],
        images: [
          "https://x.com/img/maria.jpg",
          "https://x.com/img/robin.jpg",
        ],
        kind: "team",
      },
    ];
    const team = extractTeamFromPages(pages);
    expect(team).toHaveLength(2);
    expect(team[0]).toMatchObject({
      name: "Maria Hernandez",
      credentials: "LCSW",
      photo: "https://x.com/img/maria.jpg",
    });
    expect(team[0]?.bio).toMatch(/founder/);
    expect(team[1]?.name).toBe("Robin Chen");
  });
});
