import { type ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

/**
 * Marketing layout — the Ashford-Creative B2B site that therapists land
 * on cold. Intentionally does NOT mount `<CrisisFloatingButton />` here:
 * the 988 floater belongs on patient-facing surfaces (delivered client
 * sites + the standalone /template, /preview, /p/* prospect demos), not
 * on the vendor's own marketing pages where it competes visually with
 * "Talk to us" and confuses the message ("am I selling 988, or am I
 * being sold to?"). The floater is mounted in App.tsx around the
 * StandaloneRoutes shell instead. (Founder note 2026-05-02 — first-time
 * visitor story 3.)
 *
 * Scroll-to-top on route change is owned by `RoutedShell` in App.tsx;
 * this layout no longer runs its own copy of the effect (which used
 * to fire twice per marketing-page navigation).
 */
export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-cream text-ink">
      {/* WCAG 2.4.1 — skip-to-content link. Hidden until a keyboard
       *  user tabs onto the page, then snaps into view (CSS in
       *  index.css under `.skip-to-content`). Lets a screen-reader
       *  user bypass the header nav in a single Tab + Enter. */}
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1 pt-20">
        {children}
      </main>
      <Footer />
    </div>
  );
}
