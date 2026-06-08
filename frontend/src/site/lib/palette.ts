import type { CSSProperties } from "react";
import type { PaletteDef } from "@workspace/api-zod";

/**
 * Build inline `--p-*` CSS variables consumed by templates and add-on
 * sections. Templates read `var(--p-primary)` etc. so the palette
 * applies to anything inside the wrapper without per-component prop
 * threading.
 *
 * Single source of truth — previously duplicated verbatim in
 * `TemplateRoute.tsx`, `ProspectPortal.tsx`, and
 * `PractitionerDetail.tsx`. Memoize the call site (`useMemo([palette])`)
 * to keep object identity stable between renders.
 */
export const cssVarsForPalette = (p: PaletteDef): CSSProperties => ({
  ["--p-primary" as string]: p.primary,
  ["--p-accent" as string]: p.accent,
  ["--p-surface" as string]: p.surface,
  ["--p-ink" as string]: p.ink,
  ["--p-muted" as string]: p.muted,
});
