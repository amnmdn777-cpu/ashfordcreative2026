import React from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { initSentry, initCspReporter } from "./lib/sentry";
import "./index.css";
import "@site/styles/section-badges.css";

// Sentry init is async + dynamic-imports `@sentry/react` only when a
// DSN is configured. Fire-and-forget — we don't want the SDK download
// to block the first React render.
void initSentry("ashford-site");
initCspReporter("ashford-site");

// BATCH 1.1 band-aid: apex domain `ashfordhealthcreative.com` serves ashford-site,
// not the rep app, so `/sales/leads/537` renders a NotFound. Redirect any
// `/sales/*` path to the rep app subdomain before React mounts.
// TODO: replace with proper Replit Deployment routing so `/sales/*` is
// served by ashford-rep at the edge (true 301), not a JS-side hop.
if (typeof window !== "undefined" && window.location.pathname.startsWith("/sales/")) {
  const target = "https://sales.ashfordhealthcreative.com" + window.location.pathname + window.location.search + window.location.hash;
  window.location.replace(target);
}

// Promote the print-only Google Fonts stylesheet to `media="all"` now
// that we're booting. The previous implementation used `onload=` inline
// on the <link>, which CSP rejects as an inline event handler (LOT 7.8).
const fontsLink = document.getElementById("fonts-stylesheet");
if (fontsLink instanceof HTMLLinkElement) {
  fontsLink.media = "all";
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
