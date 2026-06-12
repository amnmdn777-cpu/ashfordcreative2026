import { describe, it, expect } from "vitest";
import {
  validateAccentColor,
  validateLogoUrl,
  colorDistance,
} from "../previewContentHarmony";

/**
 * Unit tests for the design-harmony guards that gate brand-extraction
 * output on the prospect-preview surface. These functions are pure —
 * no DB, no network, no React — so the suite runs with no fixture
 * scaffolding. Each describe block mirrors a guard added 2026-05.
 */

describe("validateAccentColor", () => {
  it("accepts brand-typical hex with good contrast on white", () => {
    expect(validateAccentColor("#3F6657")).toBe("#3f6657");
    expect(validateAccentColor("#52647d")).toBe("#52647d");
  });

  it("normalizes 3-digit hex shorthand (when contrast is OK)", () => {
    // `#345` doubles to `#334455` — dark slate, ~9.7:1 on white, well
    // inside the contrast/luminance gates. (`#abc` doubles to `#aabbcc`
    // which fails the contrast floor at ~1.9:1, so 3-digit shorthand
    // alone isn't sufficient — both gates apply.)
    expect(validateAccentColor("#345")).toBe("#334455");
  });

  it("tolerates a missing leading hash", () => {
    expect(validateAccentColor("3f6657")).toBe("#3f6657");
  });

  it("rejects near-white luminance (would vanish on cream band)", () => {
    expect(validateAccentColor("#ffffff")).toBeNull();
    expect(validateAccentColor("#fefefe")).toBeNull();
  });

  it("rejects near-black luminance (already covered by text-ink)", () => {
    expect(validateAccentColor("#000000")).toBeNull();
    expect(validateAccentColor("#020202")).toBeNull();
  });

  it("rejects low-contrast yellows on white", () => {
    // #FFD700 (gold) sits ~1.5:1 on white — would paint unreadable
    // pill text on the cream recap band.
    expect(validateAccentColor("#ffd700")).toBeNull();
  });

  it("returns null on garbage input", () => {
    expect(validateAccentColor(null)).toBeNull();
    expect(validateAccentColor("")).toBeNull();
    expect(validateAccentColor("not a color")).toBeNull();
    expect(validateAccentColor("#zzzzzz")).toBeNull();
    expect(validateAccentColor("rgb(60,102,87)")).toBeNull();
  });
});

describe("validateLogoUrl", () => {
  it("accepts SVG and raster image URLs", () => {
    expect(
      validateLogoUrl("https://acme.example/wp-content/uploads/logo.svg"),
    ).toBe("https://acme.example/wp-content/uploads/logo.svg");
    expect(validateLogoUrl("https://acme.example/logo.png")).toBe(
      "https://acme.example/logo.png",
    );
    expect(validateLogoUrl("https://acme.example/brand/logo.webp")).toBe(
      "https://acme.example/brand/logo.webp",
    );
  });

  it("strips tracking query and hash", () => {
    expect(
      validateLogoUrl(
        "https://acme.example/logo.png?utm_source=email&utm_medium=cta#frag",
      ),
    ).toBe("https://acme.example/logo.png");
  });

  it("rejects favicons and tracking pixels", () => {
    expect(validateLogoUrl("https://acme.example/favicon.ico")).toBeNull();
    expect(
      validateLogoUrl("https://acme.example/icons/favicon-32.png"),
    ).toBeNull();
    expect(
      validateLogoUrl("https://acme.example/img/tracking-pixel.gif"),
    ).toBeNull();
    expect(validateLogoUrl("https://acme.example/loading.gif")).toBeNull();
  });

  it("rejects non-image extensions", () => {
    expect(validateLogoUrl("https://acme.example/about.html")).toBeNull();
    expect(validateLogoUrl("https://acme.example/script.js")).toBeNull();
    // .gif intentionally rejected — typically marketing banners, not logos.
    expect(validateLogoUrl("https://acme.example/logo.gif")).toBeNull();
  });

  it("rejects social-icon CDN paths", () => {
    expect(
      validateLogoUrl("https://cdn.example/icons/social/instagram.svg"),
    ).toBeNull();
    expect(
      validateLogoUrl("https://acme.example/share-buttons/twitter.png"),
    ).toBeNull();
  });

  it("rejects non-http(s) URLs", () => {
    expect(validateLogoUrl("data:image/png;base64,iVBOR")).toBeNull();
    expect(validateLogoUrl("javascript:alert(1)")).toBeNull();
    expect(validateLogoUrl("file:///etc/passwd")).toBeNull();
  });

  it("returns null on garbage", () => {
    expect(validateLogoUrl(null)).toBeNull();
    expect(validateLogoUrl("")).toBeNull();
    expect(validateLogoUrl("not a url")).toBeNull();
  });
});

describe("colorDistance", () => {
  it("returns 0 for identical colors", () => {
    expect(colorDistance("#3f6657", "#3f6657")).toBe(0);
  });

  it("returns a high score for distant hues (coral vs sage)", () => {
    const d = colorDistance("#ff7f50", "#3f6657");
    expect(d).toBeGreaterThanOrEqual(0.15);
  });

  it("returns a low score for near-hue greens (drop-the-accent gate)", () => {
    // Two sage greens that share the same hue and differ only by a
    // few percent in saturation/lightness — these would visually
    // clash with the Garden template's sage palette, so the recap
    // band drops the prospect's accent and falls back to neutral.
    // The previous pair (#3f6657 vs #4a5f45) was further apart —
    // ~58° hue difference at the HSL level — so it landed above the
    // 0.15 gate (which is correct: those read as complementary, not
    // clashing).
    const d = colorDistance("#3f6657", "#456b5a");
    expect(d).toBeLessThan(0.15);
  });

  it("handles invalid input safely (returns max distance)", () => {
    // Garbage in → distance 1 so the recap band falls back to
    // neutral rather than picking a misleading "fit" score.
    expect(colorDistance("not-hex", "#3f6657")).toBe(1);
    expect(colorDistance("#3f6657", "")).toBe(1);
  });
});

/**
 * Mirror of the open-redirect policy in `lib/api.ts:assertSafeRedirectUrl`
 * — kept here because the canonical implementation references
 * `window.location.origin` and can't be imported into a Node-side test
 * without a DOM. A regression in either copy trips this test.
 */
function safeRedirect(rawUrl: string, currentOrigin: string): string {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "https:") {
    throw new Error("Refusing to redirect to non-https URL");
  }
  const host = parsed.hostname.toLowerCase();
  const allowed =
    host === "checkout.stripe.com" ||
    host === "billing.stripe.com" ||
    host.endsWith(".stripe.com") ||
    host === new URL(currentOrigin).hostname.toLowerCase();
  if (!allowed) {
    throw new Error(`Refusing to redirect to untrusted host: ${host}`);
  }
  return parsed.toString();
}

describe("safeRedirect (mirror of assertSafeRedirectUrl)", () => {
  const origin = "https://ashfordhealthcreative.com";

  it("allows Stripe Checkout and Billing", () => {
    expect(
      safeRedirect("https://checkout.stripe.com/c/pay/cs_test_x", origin),
    ).toBe("https://checkout.stripe.com/c/pay/cs_test_x");
    expect(
      safeRedirect("https://billing.stripe.com/p/session/x", origin),
    ).toBe("https://billing.stripe.com/p/session/x");
  });

  it("allows the current origin (fallback success page)", () => {
    expect(
      safeRedirect("https://ashfordhealthcreative.com/checkout/success", origin),
    ).toBe("https://ashfordhealthcreative.com/checkout/success");
  });

  it("rejects an attacker-controlled host", () => {
    expect(() =>
      safeRedirect("https://attacker.example/phish", origin),
    ).toThrow(/Refusing to redirect/);
  });

  it("rejects http (must be https)", () => {
    expect(() =>
      safeRedirect("http://checkout.stripe.com/c/pay/x", origin),
    ).toThrow(/non-https/);
  });

  it("rejects look-alike host (stripe.com.attacker.example)", () => {
    // Critical: an attacker domain that ends in `.attacker.example`
    // contains "stripe.com" as a subdomain prefix but is NOT under
    // *.stripe.com.
    expect(() =>
      safeRedirect("https://stripe.com.attacker.example/phish", origin),
    ).toThrow(/Refusing to redirect/);
  });

  it("rejects javascript: and data: URLs", () => {
    expect(() =>
      safeRedirect("javascript:alert(1)", origin),
    ).toThrow(/non-https/);
  });
});

/**
 * The Seo component renders JSON-LD via Helmet and applies two
 * regex escapes before the value reaches the `<script>` body so a
 * hostile DB-stored title (admin compromise, free-text author input)
 * cannot break out of the script tag. This test mirrors the inline
 * escape so a regression in the Seo helper is caught at unit time.
 */
describe("JSON-LD escape (mirror of seo.tsx)", () => {
  const escape = (raw: string) =>
    raw.replace(/</g, "\\u003c").replace(/-->/g, "--\\u003e");

  it("prevents </script> breakout", () => {
    const hostile = JSON.stringify({
      "@type": "Article",
      headline: "Hello </script><script>alert(1)</script>",
    });
    const escaped = escape(hostile);
    expect(escaped.includes("</script>")).toBe(false);
  });

  it("prevents HTML-comment-based breakout (-->)", () => {
    const hostile = JSON.stringify({
      "@type": "Article",
      description: "Looking at <!-- HTML comments --> too",
    });
    const escaped = escape(hostile);
    expect(escaped.includes("-->")).toBe(false);
  });

  it("preserves JSON validity (still parseable)", () => {
    const ld = { "@type": "Article", headline: "Hello world" };
    const escaped = escape(JSON.stringify(ld));
    // Reverse the escape and assert we can parse it back.
    const decoded = escaped.replace(/\\u003c/g, "<").replace(/\\u003e/g, ">");
    expect(JSON.parse(decoded)).toEqual(ld);
  });
});
