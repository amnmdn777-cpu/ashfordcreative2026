import { logger } from "../../lib/logger";
import type { Candidate, EnrichmentSource, LeadInput } from "./types";

/**
 * NPI Registry — public CMS NPPES API. No API key required.
 *
 * Verifies a clinician is a real, currently-licensed practitioner in the
 * provider registry, and returns their taxonomy (specialty), credentials,
 * and primary practice location. Useful sanity check before a rep spends
 * time on a lead — and great context for the briefing.
 *
 * Docs: https://npiregistry.cms.hhs.gov/api-page
 */
class NpiRegistrySource implements EnrichmentSource {
  readonly key = "npi_registry";
  readonly label = "NPI Registry";

  isConfigured(): boolean {
    // Public registry, no auth required.
    return true;
  }

  async fetch(lead: LeadInput): Promise<Candidate | null> {
    try {
      const parts = lead.name.trim().split(/\s+/);
      const first = parts[0] ?? "";
      const last = parts[parts.length - 1] ?? "";
      if (!first || !last || first === last) return null;
      const params = new URLSearchParams({
        version: "2.1",
        first_name: first,
        last_name: last,
        state: lead.state,
        limit: "5",
      });
      if (lead.city) params.set("city", lead.city);
      const res = await fetch(
        `https://npiregistry.cms.hhs.gov/api/?${params.toString()}`,
      );
      if (!res.ok) return null;
      const json = (await res.json()) as {
        result_count?: number;
        results?: Array<{
          number?: string;
          basic?: Record<string, unknown>;
          taxonomies?: Array<Record<string, unknown>>;
          addresses?: Array<Record<string, unknown>>;
        }>;
      };
      const matches = json.results ?? [];
      if (matches.length === 0) return null;
      const top = matches[0];
      const primaryTaxonomy = (top.taxonomies ?? []).find(
        (t) => t.primary === true,
      ) ?? top.taxonomies?.[0];
      const taxonomyDesc =
        typeof primaryTaxonomy?.desc === "string" ? primaryTaxonomy.desc : null;
      const credential =
        typeof top.basic?.credential === "string" ? top.basic.credential : null;
      const primaryAddress = (top.addresses ?? []).find(
        (a) => a.address_purpose === "LOCATION",
      ) ?? top.addresses?.[0];
      const addrLine =
        typeof primaryAddress?.address_1 === "string"
          ? `${primaryAddress.address_1}${primaryAddress.city ? ", " + primaryAddress.city : ""}${primaryAddress.state ? ", " + primaryAddress.state : ""}`
          : null;
      const summaryParts: string[] = [];
      summaryParts.push(`NPI ${top.number ?? "found"} — verified provider`);
      if (taxonomyDesc) summaryParts.push(`taxonomy: ${taxonomyDesc}`);
      if (credential) summaryParts.push(`credential: ${credential}`);
      if (addrLine) summaryParts.push(`practice address: ${addrLine}`);
      return {
        confidence: matches.length === 1 ? 85 : 65,
        summary: summaryParts.join(" · "),
        payload: {
          npi: top.number,
          basic: top.basic,
          taxonomies: top.taxonomies,
          addresses: top.addresses,
          totalMatches: json.result_count ?? matches.length,
        },
      };
    } catch (err) {
      logger.warn({ err, leadId: lead.id }, "npi registry enrichment failed");
      return null;
    }
  }
}

export const npiRegistrySource = new NpiRegistrySource();
