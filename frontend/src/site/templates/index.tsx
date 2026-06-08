import { Suspense, lazy, type ComponentType } from "react";
import type { TemplateKey } from "@workspace/api-zod";
import type { TemplateProps } from "./types";
import Garden from "./Garden";

// Lazy-load every non-default template. The prospect-preview shell
// renders only one template at a time, so paying the bundle cost
// for the others up-front is wasted. Garden stays statically imported
// because it's the default `active` selection.
const Polaroid = lazy(() => import("./Polaroid"));
const Sunrise = lazy(() => import("./Sunrise"));
const Constellation = lazy(() => import("./Constellation"));
const PlayfulModern = lazy(() => import("./PlayfulModern"));
const FrontPorch = lazy(() => import("./FrontPorch"));
const HelloFriend = lazy(() => import("./HelloFriend"));

/**
 * Wrap each template in a single Suspense boundary so caller mount
 * sites (ProspectPreview, TemplateRoute, ProspectPortal) don't need
 * one of their own. Fallback is the same cream/ink loading band the
 * preview shell already uses, so the swap reads as "loading the
 * template you picked" rather than a flash of empty.
 */
const withSuspense = (
  Inner: ComponentType<TemplateProps>,
  templateKey: TemplateKey,
): ComponentType<TemplateProps> => {
  const Wrapped = (props: TemplateProps) => (
    <Suspense fallback={<TemplateLoadingFallback />}>
      <Inner {...props} />
    </Suspense>
  );
  Wrapped.displayName = `WithSuspense(${templateKey})`;
  return Wrapped;
};

const TemplateLoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-cream">
    <div className="font-mono text-xs uppercase tracking-widest text-ink/50 animate-pulse">
      Loading template…
    </div>
  </div>
);

export const TEMPLATE_COMPONENTS: Record<TemplateKey, ComponentType<TemplateProps>> = {
  garden: withSuspense(Garden, "garden"),
  sunrise: withSuspense(Sunrise, "sunrise"),
  constellation: withSuspense(Constellation, "constellation"),
  polaroid: withSuspense(Polaroid, "polaroid"),
  playful_modern: withSuspense(PlayfulModern, "playful_modern"),
  front_porch: withSuspense(FrontPorch, "front_porch"),
  hello_friend: withSuspense(HelloFriend, "hello_friend"),
};

// Retired template keys mapped to their current replacement so old preview
// URLs and stored leads keep working. `atrium` + `quiet_practice` retired
// 2026-05; both fall through to garden.
const LEGACY_TEMPLATE_ALIASES: Record<string, TemplateKey> = {
  clinic: "garden",
  bold_editorial: "garden",
  statement: "garden",
  manifesto: "garden",
  photo_overlay: "polaroid",
  wellness_center: "garden",
  heritage: "garden",
  warm_minimalist: "garden",
  framework: "garden",
  navy_editorial: "garden",
  atrium: "garden",
  quiet_practice: "garden",
};

export function resolveTemplateKey(maybeLegacy: string): TemplateKey | null {
  if (maybeLegacy in TEMPLATE_COMPONENTS) return maybeLegacy as TemplateKey;
  return LEGACY_TEMPLATE_ALIASES[maybeLegacy] ?? null;
}
