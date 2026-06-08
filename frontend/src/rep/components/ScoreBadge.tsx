import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@rep/components/ui/tooltip";

// Visual styling for each tier — bias toward saturated red for "A"
// (top quality, call first) so it draws the eye before the rep even
// reads the score number, and muted slate for "C" so it doesn't
// compete for attention. The thresholds (70 / 40) live in api-server's
// leadScoring.ts; the UI trusts the server-derived `scoreTier` so we
// never have to keep them in sync. #212.
//
// Tier letters (A/B/C) chosen by the rep team in place of temperature
// labels — neutral, no positive/negative connotation, easy to scan.
//
// Extracted from AvailableLeads.tsx so the My Leads list can render the
// same badge — the rep wanted score visible everywhere they pick a
// lead to call next, not just on the unclaimed pool.
export const TIER_VISUAL = {
  A: {
    label: "A",
    cls: "bg-red-500/15 text-red-700 border-red-500/30",
  },
  B: {
    label: "B",
    cls: "bg-amber-500/15 text-amber-800 border-amber-500/30",
  },
  C: {
    label: "C",
    cls: "bg-slate-500/10 text-slate-600 border-slate-300",
  },
} as const;

export type Tier = keyof typeof TIER_VISUAL;

export function ScoreBadge({
  tier,
  score,
  breakdown,
}: {
  tier: Tier | null | undefined;
  score: number | null | undefined;
  breakdown:
    | {
        signals: Array<{ label: string; points: number; max: number }>;
      }
    | null
    | undefined;
}) {
  if (!tier || score == null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const v = TIER_VISUAL[tier];
  const tip = breakdown
    ? `Tier ${tier} · ${score}/100 — ${breakdown.signals
        .filter((s) => s.points > 0)
        .sort((a, b) => b.points - a.points)
        .slice(0, 3)
        .map((s) => `${s.label} (+${s.points})`)
        .join(", ")}`
    : `Tier ${tier} · ${score}/100`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-bold cursor-help ${v.cls}`}
          aria-label={tip}
          data-testid="score-badge"
        >
          <span className="font-mono">{v.label}</span>
          <span className="font-normal opacity-75">· {score}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-xs whitespace-normal text-center"
      >
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}
