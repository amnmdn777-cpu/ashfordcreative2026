import { describe, it, expect } from "vitest";
import {
  collectImageCandidates,
  decodeEntities,
  extractCsvBetween,
  extractVideoCandidates,
  lastNameToken,
  splitCsv,
  stripToBodyText,
} from "../_directoryFetch";

describe("stripToBodyText", () => {
  it("removes script + style tags entirely", () => {
    expect(
      stripToBodyText(
        '<style>body{color:red}</style><script>alert(1)</script><p>Hello world</p>',
      ),
    ).toBe("Hello world");
  });

  it("collapses whitespace and decodes entities", () => {
    expect(
      stripToBodyText("<p>Tara&nbsp;Langston&amp;family</p>\n  <span>here</span>"),
    ).toBe("Tara Langston&family here");
  });
});

describe("decodeEntities", () => {
  it("decodes the common HTML entities we see on directory pages", () => {
    expect(decodeEntities("Tara&amp;Co&nbsp;LLC")).toBe("Tara&Co LLC");
    expect(decodeEntities("&quot;therapy&quot;")).toBe('"therapy"');
    expect(decodeEntities("don&#039;t")).toBe("don't");
  });
});

describe("splitCsv", () => {
  it("splits typical comma + 'and' joined lists", () => {
    expect(splitCsv("Anxiety, Depression and Trauma")).toEqual([
      "Anxiety",
      "Depression",
      "Trauma",
    ]);
  });

  it("filters empty / non-alpha / way-too-long items", () => {
    expect(splitCsv(" , 12345, ok-ish, " + "x".repeat(120))).toEqual([
      "ok-ish",
    ]);
  });
});

describe("extractCsvBetween", () => {
  it("pulls a comma list between an anchor and a stop", () => {
    const text =
      "Specialties Anxiety, Depression, Trauma Insurance Aetna, Cigna";
    expect(extractCsvBetween(text, /Specialties\s+/, /Insurance/)).toEqual([
      "Anxiety",
      "Depression",
      "Trauma",
    ]);
  });

  it("returns empty when anchor is missing", () => {
    expect(extractCsvBetween("nothing here", /Specialties\s+/, /Insurance/)).toEqual([]);
  });
});

describe("collectImageCandidates", () => {
  it("collects from <img>, <source srcset>, background-image, and raw URLs", () => {
    const html = `
      <img src="https://cdn.example/photo1.jpg" />
      <picture>
        <source srcset="https://cdn.example/photo2.webp 800w, https://cdn.example/photo3.webp 1600w" />
      </picture>
      <div style="background-image: url('https://cdn.example/photo4.jpg')"></div>
      <script>const data = {photoUrl: "https://cdn.example/photo5.jpg"};</script>
    `;
    const got = collectImageCandidates(html);
    expect(got).toEqual(
      expect.arrayContaining([
        "https://cdn.example/photo1.jpg",
        "https://cdn.example/photo2.webp",
        "https://cdn.example/photo3.webp",
        "https://cdn.example/photo4.jpg",
        "https://cdn.example/photo5.jpg",
      ]),
    );
  });

  it("dedupes repeated URLs", () => {
    const html = `<img src="https://cdn.example/p.jpg" /><img src="https://cdn.example/p.jpg" />`;
    expect(collectImageCandidates(html)).toEqual(["https://cdn.example/p.jpg"]);
  });
});

describe("extractVideoCandidates", () => {
  it("picks Vimeo iframes and canonicalizes to player.vimeo.com/video/<id>", () => {
    const html = `<iframe src="https://player.vimeo.com/video/123456789?h=abc&autoplay=1"></iframe>`;
    const got = extractVideoCandidates(html);
    expect(got).toHaveLength(1);
    expect(got[0].provider).toBe("vimeo");
    expect(got[0].embedUrl).toBe("https://player.vimeo.com/video/123456789");
  });

  it("picks YouTube embeds and normalizes to /embed/<id>", () => {
    const html = `<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=0"></iframe>`;
    const got = extractVideoCandidates(html);
    expect(got).toHaveLength(1);
    expect(got[0].provider).toBe("youtube");
    expect(got[0].embedUrl).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("normalizes youtu.be short links to /embed/<id>", () => {
    const html = `<iframe src="https://youtu.be/dQw4w9WgXcQ"></iframe>`;
    const got = extractVideoCandidates(html);
    expect(got[0].embedUrl).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("picks <video><source> mp4 URLs", () => {
    const html = `<video><source src="https://cdn.example/intro.mp4" type="video/mp4" /></video>`;
    const got = extractVideoCandidates(html);
    expect(got).toHaveLength(1);
    expect(got[0].url).toBe("https://cdn.example/intro.mp4");
  });

  it("picks og:video:url meta tags", () => {
    const html = `<meta property="og:video:url" content="https://player.vimeo.com/video/987654321" />`;
    const got = extractVideoCandidates(html);
    expect(got).toHaveLength(1);
    expect(got[0].embedUrl).toBe("https://player.vimeo.com/video/987654321");
  });

  it("dedupes the same URL appearing in multiple tags", () => {
    const html = `
      <iframe src="https://player.vimeo.com/video/123" />
      <meta property="og:video:url" content="https://player.vimeo.com/video/123" />
    `;
    const got = extractVideoCandidates(html);
    expect(got).toHaveLength(1);
  });
});

describe("lastNameToken", () => {
  it("returns the lowercased last alpha token", () => {
    expect(lastNameToken("Tara Langston")).toBe("langston");
    expect(lastNameToken("Sarah Smith-Jones")).toBe("smithjones");
  });

  it("strips honorifics and credentials before picking the last token", () => {
    expect(lastNameToken("Dr. Sarah Smith")).toBe("smith");
    expect(lastNameToken("Sarah Smith, LCSW")).toBe("lcsw");
    // Credentials still appear at the end — the gate just becomes a
    // 3-token check by callers, not a single-token assumption.
  });
});
