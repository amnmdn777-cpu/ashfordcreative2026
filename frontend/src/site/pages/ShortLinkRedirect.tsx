import { useEffect } from "react";
import { useParams } from "wouter";

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ||
  "/api";

export default function ShortLinkRedirect() {
  const { code } = useParams<{ code: string }>();

  useEffect(() => {
    if (!code) return;

    // Build redirect target URL pointing to backend's resolve endpoint.
    // In production, VITE_API_BASE is absolute: https://backend.../api
    // In development/fallback, VITE_API_BASE is relative: /api
    const redirectUrl = API_BASE.startsWith("http")
      ? `${API_BASE}/s/${encodeURIComponent(code)}`
      : `${window.location.origin}${API_BASE}/s/${encodeURIComponent(code)}`;

    window.location.replace(redirectUrl);
  }, [code]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="font-mono text-xs uppercase tracking-widest text-ink/60 animate-pulse">
        Redirecting…
      </div>
    </div>
  );
}
