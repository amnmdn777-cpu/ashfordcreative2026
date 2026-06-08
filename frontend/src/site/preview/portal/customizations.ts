import type { PortalCustomizations, PaletteDef } from "@workspace/api-zod";

/**
 * Resolves the *effective* palette by overlaying user customizations onto the
 * template's default palette. The caller exposes the result as CSS variables
 * (`--p-primary`, `--p-accent`, …) on a wrapper div via the local
 * `cssVarsForPalette` helper in TemplateRoute / ProspectPortal /
 * PractitionerDetail, so any consumer that reads `var(--p-primary)` etc. gets
 * the personalized colors for free.
 */
export const overlayPalette = (
  base: PaletteDef,
  c: PortalCustomizations | undefined,
): PaletteDef => ({
  ...base,
  primary: c?.colorOverrides?.primary ?? base.primary,
  accent: c?.colorOverrides?.accent ?? base.accent,
  surface: c?.colorOverrides?.surface ?? base.surface,
  ink: c?.colorOverrides?.ink ?? base.ink,
  muted: c?.colorOverrides?.muted ?? base.muted,
});

/**
 * Build font CSS variables. Templates that read --p-font-display / --p-font-body
 * pick up the override; others continue using their hard-coded font stack.
 */
export const fontVars = (c: PortalCustomizations | undefined): React.CSSProperties => ({
  ["--p-font-display" as string]: c?.fontDisplay ?? undefined,
  ["--p-font-body" as string]: c?.fontBody ?? undefined,
});

