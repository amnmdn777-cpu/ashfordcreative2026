import { useEffect } from "react";

/**
 * Bookmarkable demo entry point for the prospect portal.
 *
 * Visiting `/preview` (no slug) lands here and is immediately redirected to
 * the seeded demo portal — same view a real prospect sees after clicking
 * the SMS/email invite link, but pre-loaded with the test profile so the
 * Ashford team can show it off without minting a fresh portal each time.
 *
 * The slug + access token are sourced from build-time env vars so a token
 * rotation is one CI edit, not a commit. Falls back to a placeholder
 * "missing-token" value when unset so the route lands on the portal's
 * own "could not load" panel instead of leaking a baked-in credential to
 * everyone who reads the bundle. Set `VITE_DEMO_PORTAL_SLUG` and
 * `VITE_DEMO_PORTAL_TOKEN` in the build environment.
 */
const DEMO_SLUG: string =
  import.meta.env.VITE_DEMO_PORTAL_SLUG ?? "test-owner-smoke";
const DEMO_TOKEN: string =
  import.meta.env.VITE_DEMO_PORTAL_TOKEN ?? "missing-token";

export default function PreviewIndex() {
  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const target = `${base}/preview/${DEMO_SLUG}?t=${encodeURIComponent(
      DEMO_TOKEN,
    )}`;
    window.location.replace(target);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#3F6657",
        background: "#f7f5f0",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 24,
            letterSpacing: 0.4,
            marginBottom: 8,
          }}
        >
          Ashford Creative
        </div>
        <div style={{ fontSize: 14, color: "#6b7280" }}>
          Loading demo preview…
        </div>
      </div>
    </div>
  );
}
