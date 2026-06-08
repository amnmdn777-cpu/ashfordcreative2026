/**
 * LOT 3.8 — First-Visit Video primitive (skeleton).
 *
 * Renders a 16:9 video frame backed by a per-subscription video URL.
 * When the URL is missing (or Concierge hasn't shipped the cut yet) we
 * show a placeholder card with the practitioner's photo.
 *
 * TODO(first-visit-video):
 *   - Read videoUrl + posterUrl from subscription admin field
 *   - Captions toggle (EN/ES)
 *   - Track 1-year refresh-entitlement use via admin tooling (LOT 3.B3)
 */
import { useEffect, useState } from "react";

export function FirstVisitVideo({ posterUrl }: { posterUrl?: string }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = (window as any).__FIRST_VISIT_VIDEO_URL;
    if (typeof u === "string" && u.length > 0) setVideoUrl(u);
  }, []);
  if (!videoUrl) {
    return (
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--color-text-muted)", aspectRatio: "16/9", background: posterUrl ? `center/cover no-repeat url(${posterUrl})` : "var(--color-surface-soft)" }}>
        <div className="w-full h-full grid place-items-center text-xs" style={{ color: "var(--color-text-muted)" }}>
          Your first-visit video lands here
        </div>
      </div>
    );
  }
  return (
    <video
      controls
      poster={posterUrl}
      className="w-full rounded-xl border"
      style={{ borderColor: "var(--color-text-muted)" }}
      src={videoUrl}
    />
  );
}
