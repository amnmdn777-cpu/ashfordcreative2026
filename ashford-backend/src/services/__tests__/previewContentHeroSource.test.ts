import { describe, it, expect } from "vitest";
import { detectPhotoDirectorySource } from "../previewContent";

describe("detectPhotoDirectorySource", () => {
  it("recognizes Headway-hosted portraits across CDN subdomains", () => {
    expect(
      detectPhotoDirectorySource(
        "https://headway.co/cdn-cgi/image/width=1200,quality=90,format=auto/assets.headway.co/provider/abc123.jpg",
      ),
    ).toBe("headway");
    expect(
      detectPhotoDirectorySource(
        "https://cdn.headway.co/provider/abc123.jpg",
      ),
    ).toBe("headway");
    expect(
      detectPhotoDirectorySource(
        "https://assets.headway.co/uploads/abc.png",
      ),
    ).toBe("headway");
    expect(
      detectPhotoDirectorySource(
        "https://care.headway.co/providers/lakeycha-moreno/photo.jpg",
      ),
    ).toBe("headway");
  });

  it("recognizes Psychology Today portraits and their cloudfront subdomain", () => {
    expect(
      detectPhotoDirectorySource(
        "https://cdn.psychologytoday.com/sites/default/files/foo.jpg",
      ),
    ).toBe("psychology_today");
    expect(
      detectPhotoDirectorySource(
        "https://post.psychologytoday.com/photo.png",
      ),
    ).toBe("psychology_today");
    expect(
      detectPhotoDirectorySource(
        "https://d3atagt0rnqk7k.cloudfront.net/photo.jpg",
      ),
    ).toBe("psychology_today");
  });

  it("returns null for first-party and unknown hosts", () => {
    expect(
      detectPhotoDirectorySource(
        "https://drlakeychamoreno.com/about/headshot.jpg",
      ),
    ).toBeNull();
    expect(
      detectPhotoDirectorySource(
        "https://maps.googleapis.com/photo?ref=xyz",
      ),
    ).toBeNull();
    // headway-images.imgix.net is NOT a *.headway.co subdomain — must
    // not be treated as Headway-hosted; the preview policy intentionally
    // restricts trust to Headway's own domain.
    expect(
      detectPhotoDirectorySource(
        "https://headway-images.imgix.net/foo.jpg",
      ),
    ).toBeNull();
  });

  it("returns null for missing / malformed input", () => {
    expect(detectPhotoDirectorySource(null)).toBeNull();
    expect(detectPhotoDirectorySource(undefined)).toBeNull();
    expect(detectPhotoDirectorySource("")).toBeNull();
    expect(detectPhotoDirectorySource("not a url")).toBeNull();
  });

  it("locks in the Lakeycha-bug invariant: a Headway portrait on a website_meta-labeled team is still trusted", () => {
    // Scenario replays the bug: team[0].name/bio came from website_meta
    // (regex pass, no photo), portals.ts later patched in the Headway
    // headshot without rewriting fieldSources.team. The hero gate must
    // see this Headway URL as a trusted Headway photo regardless of
    // what the team label says — otherwise the hero falls back to a
    // null first-party scan.
    const teamPhotoFromHeadway =
      "https://headway.co/cdn-cgi/image/width=1200,quality=90,format=auto/assets.headway.co/provider/lakeycha.jpg";
    expect(detectPhotoDirectorySource(teamPhotoFromHeadway)).toBe("headway");
  });
});
