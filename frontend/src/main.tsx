import React from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";

// Global styles from all three apps. Order matters for shared :root design
// tokens — site first, then the two dashboards (which share the same shadcn
// token set) so the dashboard palette wins where they overlap.
import "@site/index.css";
import "@site/styles/section-badges.css";
import "@admin/index.css";
import "@rep/index.css";

// The public marketing site (ashford-site) relies on a QueryClient +
// HelmetProvider being supplied by its host (originally its own main.tsx),
// so we provide them globally. The admin/rep apps create their own nested
// QueryClient internally, which is fine.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>,
);
