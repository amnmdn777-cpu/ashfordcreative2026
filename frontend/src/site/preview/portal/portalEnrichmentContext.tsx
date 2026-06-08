import { createContext, useContext, type ReactNode } from "react";
import type { PortalEnrichment } from "@workspace/api-zod";

/**
 * Lets add-on inline previews (rendered deep under the portal tree)
 * read the lead's real Google Places enrichment data when available so
 * they can show the practice's real name, address, phone, rating,
 * etc. — instead of generic "Brazos Behavioral Health" samples.
 *
 * `leadPracticeName` carries the lead row's practice name (which lives
 * outside the enrichment payload) so add-ons that show "your business
 * card" — e.g. Google Profile Sync — can headline with the prospect's
 * actual practice. Defaults to `null` so the public template-browse
 * surface (TemplateRoute, no lead) and the mockup sandbox just render
 * the sample-data version with no provider needed.
 */
type Ctx = {
  enrichment: PortalEnrichment | null;
  leadPracticeName: string | null;
};

const PortalEnrichmentContext = createContext<Ctx>({
  enrichment: null,
  leadPracticeName: null,
});

export const PortalEnrichmentProvider = ({
  value,
  leadPracticeName = null,
  children,
}: {
  value: PortalEnrichment | null;
  leadPracticeName?: string | null;
  children: ReactNode;
}) => (
  <PortalEnrichmentContext.Provider
    value={{ enrichment: value, leadPracticeName }}
  >
    {children}
  </PortalEnrichmentContext.Provider>
);

export const usePortalEnrichment = (): PortalEnrichment | null =>
  useContext(PortalEnrichmentContext).enrichment;

export const useLeadPracticeName = (): string | null =>
  useContext(PortalEnrichmentContext).leadPracticeName;

/**
 * Convenience: lets the inline component pull a single named field with
 * a sample-data fallback. Returns the trimmed enrichment value when
 * non-empty, otherwise the supplied fallback.
 */
export const useEnrichmentField = <T,>(
  pick: (e: PortalEnrichment) => T | null | undefined,
  fallback: T,
): T => {
  const e = usePortalEnrichment();
  if (!e) return fallback;
  const v = pick(e);
  if (v == null) return fallback;
  if (typeof v === "string" && v.trim() === "") return fallback;
  return v as T;
};
