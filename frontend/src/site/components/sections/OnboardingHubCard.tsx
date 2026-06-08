/**
 * LOT 3.8 — Patient Onboarding Hub primitive (skeleton).
 *
 * Renders a calm card that links the patient to the welcome kit + intake
 * forms hub. Today this is a single CTA pointing at a per-subscription
 * hub URL (window.__ONBOARDING_HUB_URL injected at build time). When the
 * URL is missing we show a "talk to the practice" placeholder rather
 * than a broken link.
 *
 * TODO(patient-onboarding-hub):
 *   - Wire to per-subscription admin field
 *   - Inline forms (intake, consent, ROI, telehealth, sliding-scale)
 *   - Mobile e-signature flow
 *   - HIPAA-aware storage hand-off
 */
import { useEffect, useState } from "react";

export function OnboardingHubCard({ practiceName }: { practiceName?: string }) {
  const [hubUrl, setHubUrl] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = (window as any).__ONBOARDING_HUB_URL;
    if (typeof u === "string" && u.length > 0) setHubUrl(u);
  }, []);
  return (
    <div className="rounded-xl border p-6" style={{ borderColor: "var(--color-text-muted)" }}>
      <div className="text-sm font-medium mb-1">Your welcome kit · Su kit de bienvenida</div>
      <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
        Intake forms, consent, and what to expect on your first visit — all
        in one place.
      </p>
      {hubUrl ? (
        <a href={hubUrl} className="inline-block px-4 py-2 rounded text-sm font-medium" style={{ background: "var(--color-primary)", color: "white" }}>
          Open my onboarding hub
        </a>
      ) : (
        <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {practiceName ?? "The practice"} will send your hub link by email and SMS.
        </div>
      )}
    </div>
  );
}
