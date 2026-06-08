import { Router as WouterRouter, useLocation } from "wouter";
import SiteApp from "@site/App";
import AdminApp from "@admin/App";
import RepApp from "@rep/App";

/**
 * Picks the active app by URL prefix and mounts it under its own base router.
 * Each app's routes/links are written as absolute (`/leads`, `/about`, …);
 * the `base` prefix maps them under `/admin` and `/sales` while the public site
 * keeps the root namespace.
 *
 * Navigate between apps by URL:
 *   /        → public marketing site
 *   /admin   → admin dashboard
 *   /sales   → sales rep dashboard
 */
export default function App() {
  const [location] = useLocation();

  if (location === "/admin" || location.startsWith("/admin/")) {
    return (
      <WouterRouter base="/admin">
        <AdminApp />
      </WouterRouter>
    );
  }
  if (location === "/sales" || location.startsWith("/sales/")) {
    return (
      <WouterRouter base="/sales">
        <RepApp />
      </WouterRouter>
    );
  }
  return (
    <WouterRouter base="">
      <SiteApp />
    </WouterRouter>
  );
}
