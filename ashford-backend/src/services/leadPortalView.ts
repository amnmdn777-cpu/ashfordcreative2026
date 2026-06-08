import { env } from "../lib/env";
import {
  ensurePortalForLead,
  buildPortalPublicResponse,
  getLatestPortalActivity,
  getLatestCart,
  getPortalEnrichmentForLead,
} from "./portals";
import {
  getLatestEnrichment,
  TOTAL_ENRICHMENT_SOURCES,
} from "../integrations/enrichment/orchestrator";
import { getOrCreateShortLink } from "./shortLinks";
import { isDialpadSmsConfigured } from "../integrations/dialpad";
import { isResendConfigured } from "../integrations/resend";

/**
 * Builds the full portal view payload consumed by the LeadDetail's
 * "Customer portal" panel in BOTH the rep dashboard and the admin
 * dashboard. Factored out of `routes/dashboard/portals.ts` so the rep
 * route and the new admin route (`/admin/leads/:id/portal`) return the
 * exact same shape — keeping a single source of truth for fields like
 * `enrichmentCompleteness`, the short link minting policy, and the
 * `integrations` flags. Callers are responsible for authorization
 * (rep ownership check or admin role gate) BEFORE calling this.
 */
export const buildLeadPortalView = async (leadId: number) => {
  const portal = await ensurePortalForLead(leadId);
  const longUrl = `${env.publicBaseUrl}/preview/${portal.slug}?t=${encodeURIComponent(portal.accessToken)}`;
  const [events, cart, enrichment, fieldEnrichment, publicView, shortLink] =
    await Promise.all([
      getLatestPortalActivity(portal.id, 25),
      getLatestCart(portal.id),
      getLatestEnrichment(leadId),
      getPortalEnrichmentForLead(leadId),
      buildPortalPublicResponse(portal),
      getOrCreateShortLink(longUrl, {
        leadId,
        purpose: "portal_invite",
      }).catch(() => null),
    ]);
  return {
    slug: portal.slug,
    url: longUrl,
    shortUrl: shortLink?.url ?? null,
    ogUrl: `${env.publicBaseUrl}/api/public/portals/${portal.slug}/og.png?t=${encodeURIComponent(portal.accessToken)}`,
    openCount: portal.openCount ?? 0,
    lastOpenedAt: portal.lastOpenedAt,
    inviteSentAt: portal.inviteSentAt,
    reservedAt: portal.reservedAt,
    selectedTemplate: portal.selectedTemplate,
    heroImageUrl:
      (portal.customizations as { heroImageUrl?: string } | null)
        ?.heroImageUrl ?? null,
    pricingPlan:
      (portal.customizations as { pricingPlan?: string } | null)
        ?.pricingPlan ?? null,
    events: events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      templateKey: e.templateKey,
      addonSlug: e.addonSlug,
      occurredAt: e.occurredAt,
      metadata: e.metadata,
    })),
    cart,
    enrichment: enrichment.map((row) => ({
      sourceKey: row.sourceKey,
      confidence: row.confidence,
      summary: row.summary,
      fetchedAt: row.fetchedAt,
    })),
    enrichmentCompleteness: {
      sourcesAvailable: enrichment.length,
      sourcesTotal: TOTAL_ENRICHMENT_SOURCES,
    },
    fieldsCompleteness: fieldEnrichment?.fieldsCompleteness ?? {
      filled: 0,
      total: 10,
    },
    fieldSources: fieldEnrichment?.fieldSources ?? {},
    headway: fieldEnrichment?.headway ?? null,
    integrations: {
      sms: isDialpadSmsConfigured(),
      email: isResendConfigured(),
    },
    addons: publicView.addons,
  };
};
