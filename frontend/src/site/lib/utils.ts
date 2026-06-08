import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a cents amount as a USD label (`$199`, no trailing decimals).
 * Most pricing in this codebase is stored in cents (`setupCents`,
 * `monthlyCents`, `originalMonthlyCents`) and was being formatted by
 * three byte-identical local declarations in TemplateRoute,
 * ProspectPortal, and ReserveModal — consolidate here.
 */
export const fmtUsdFromCents = (cents: number): string =>
  `$${(cents / 100).toFixed(0)}`;

/**
 * Format a whole-dollar amount as `$X` (no trailing `.00`). Used by
 * the domain-purchase surface where retail prices come back in
 * dollars from the registrar API. `lib/domains.ts` re-exports this
 * for callers in the domain flow.
 */
export const fmtUsdFromDollars = (amount: number): string =>
  `$${amount.toFixed(2).replace(/\.00$/, "")}`;
