import * as Sentry from "@sentry/react";

/**
 * Initialize browser Sentry. No-op when `VITE_SENTRY_DSN` is missing so dev
 * builds and previews work without sending data anywhere. Call once from the
 * artifact's `main.tsx` BEFORE `createRoot`.
 */
export const initSentry = (artifactSlug: string): void => {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: (import.meta.env.MODE ?? "development") as string,
    release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,
    initialScope: { tags: { artifact: artifactSlug } },
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
};

/**
 * Forward `securitypolicyviolation` events to Sentry as structured warnings.
 *
 * Why this exists: our CSP is injected as a `<meta http-equiv>` tag (see
 * `vite.config.ts` → `cspMetaPlugin` and replit.md → "Content Security
 * Policy"). Meta-equiv CSP cannot set `report-to` / `report-uri`, so the
 * browser will silently block any newly-introduced third-party origin we
 * forgot to whitelist. This listener is the interim alternative — it
 * captures the same SecurityPolicyViolationEvent fields the report-uri
 * payload would contain and ships them to Sentry as a `csp_violation`
 * tagged warning, scoped per-artifact.
 *
 * - Always attaches the listener (even without a Sentry DSN) so dev/preview
 *   sessions still log violations to the browser console.
 * - Per-page-load dedupe on `(violatedDirective, blockedURI)` keeps a noisy
 *   page from flooding Sentry with the same finding.
 * - Safe to call before `initSentry`; Sentry's queue will pick the event
 *   up once `init` runs (and if it never runs, capture is a no-op).
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
