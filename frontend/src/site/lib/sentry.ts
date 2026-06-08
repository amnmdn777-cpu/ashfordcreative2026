/**
 * Lazy Sentry initializer. The previous version did a static `import *
 * as Sentry from "@sentry/react"` at module top-level — pulling ~30KB
 * gzip into the main bundle even when no DSN was configured (dev,
 * preview, demo deploys). The whole file is now opt-in: nothing
 * loads `@sentry/react` unless `VITE_SENTRY_DSN` is set at build time.
 */

type SentryModule = typeof import("@sentry/react");

let sentryRef: SentryModule | null = null;

/**
 * Initialize browser Sentry. Returns a promise that resolves once the
 * SDK is loaded and configured. No-op (and skips the dynamic import
 * entirely) when `VITE_SENTRY_DSN` is missing so dev builds and
 * previews ship without the cost.
 */
export const initSentry = async (artifactSlug: string): Promise<void> => {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  const Sentry = await import("@sentry/react");
  Sentry.init({
    dsn,
    environment: (import.meta.env.MODE ?? "development") as string,
    release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,
    initialScope: { tags: { artifact: artifactSlug } },
    tracesSampleRate: 0,
    sendDefaultPii: false,
    // Strip likely-PII strings from error messages before they leave
    // the browser. Preview tokens (32 hex chars), Stripe session ids
    // (`cs_live_*`/`cs_test_*`), and email addresses are the three
    // shapes we know flow through `Error.message` in this codebase.
    beforeSend(event) {
      if (typeof event.message === "string") {
        event.message = scrubPii(event.message);
      }
      const ex = event.exception?.values;
      if (Array.isArray(ex)) {
        for (const e of ex) {
          if (e?.value) e.value = scrubPii(e.value);
        }
      }
      return event;
    },
  });
  sentryRef = Sentry;
};

const scrubPii = (s: string): string =>
  s
    // 32-hex preview tokens
    .replace(/\b[0-9a-f]{32}\b/gi, "<token>")
    // Stripe session IDs
    .replace(/\bcs_(?:live|test)_[A-Za-z0-9]+/g, "<stripe-session>")
    // Email addresses
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "<email>");

/**
 * Forward `securitypolicyviolation` events to Sentry as structured
 * warnings. The browser console logs always run; the Sentry capture
 * runs only after the lazy `initSentry` resolves (events emitted
 * before that point still hit the console — fine since CSP violations
 * are dev-noisy and we'd rather not buffer them).
 *
 * Per-page-load dedupe on `(violatedDirective, blockedURI, sourceFile,
 * lineNumber)` keeps a noisy page from flooding Sentry.
 */
export const initCspReporter = (artifactSlug: string): void => {
  if (typeof window === "undefined") return;

  const seen = new Set<string>();

  window.addEventListener("securitypolicyviolation", (event) => {
    const key = `${event.violatedDirective}|${event.blockedURI}|${event.sourceFile}|${event.lineNumber}`;
    if (seen.has(key)) return;
    seen.add(key);

    const details = {
      artifact: artifactSlug,
      violatedDirective: event.violatedDirective,
      effectiveDirective: event.effectiveDirective,
      blockedURI: event.blockedURI,
      documentURI: event.documentURI,
      sourceFile: event.sourceFile,
      lineNumber: event.lineNumber,
      columnNumber: event.columnNumber,
      disposition: event.disposition,
      sample: event.sample,
      statusCode: event.statusCode,
    };

    // Always log so the violation is visible in dev/preview consoles even
    // when no DSN is configured.
    // eslint-disable-next-line no-console
    console.warn("[csp:violation]", details);

    const Sentry = sentryRef;
    if (!Sentry) return;
    Sentry.withScope((scope) => {
      scope.setTag("csp_violation", "true");
      scope.setTag("csp_directive", event.effectiveDirective || event.violatedDirective);
      scope.setTag("artifact", artifactSlug);
      scope.setLevel("warning");
      scope.setContext("csp", details);
      scope.setFingerprint([
        "csp",
        artifactSlug,
        event.effectiveDirective || event.violatedDirective,
        event.blockedURI || "(inline)",
      ]);
      Sentry.captureMessage(
        `CSP blocked ${event.effectiveDirective || event.violatedDirective}: ${event.blockedURI || "(inline)"}`,
      );
    });
  });
};
