import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import type { Candidate, EnrichmentSource, LeadInput } from "./types";

/**
 * Hunter.io Domain Search — given a domain, returns up to 10 known email
 * addresses on that domain plus a confidence score.
 *
 * We use it as a "second-channel email finder": if the lead has a website
 * but no email on file, Hunter usually surfaces the practitioner's direct
 * inbox (e.g. firstname@practice.com) plus any front-desk address. The rep
 * dashboard already has a "send personalized preview by email" CTA — Hunter
 * makes that CTA actionable on leads where Google Places only gave us a
 * phone number.
 *
 * Free tier: 25 searches/month. Soft-fails to null when HUNTER_API_KEY is
 * unset or quota is exhausted.
 *
 * Docs: https://hunter.io/api-documentation/v2#domain-search
 */
class HunterIoSource implements EnrichmentSource {
  readonly key = "hunter_io";
  readonly label = "Hunter.io";

  isConfigured(): boolean {
    return !!env.hunterApiKey;
  }

  /** Best-effort hostname extraction from a free-form website field. */
  private domainFor(lead: LeadInput): string | null {
    const raw = (lead.currentWebsite ?? "").trim();
    if (!raw) return null;
    try {
      const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const u = new URL(withScheme);
      return u.hostname.replace(/^www\./i, "").toLowerCase() || null;
    } catch {
      return null;
    }
  }

  async fetch(lead: LeadInput): Promise<Candidate | null> {
    if (!this.isConfigured()) return null;
    const domain = this.domainFor(lead);
    if (!domain) return null;
    const params = new URLSearchParams({
      domain,
      api_key: env.hunterApiKey!,
      limit: "10",
      type: "personal",
    });
    try {
      const res = await fetch(
        `https://api.hunter.io/v2/domain-search?${params.toString()}`,
        { signal: AbortSignal.timeout(15_000) },
      );
      if (!res.ok) {
        logger.warn(
          { leadId: lead.id, status: res.status, domain },
          "hunter_io: non-2xx",
        );
        return null;
      }
      const json = (await res.json()) as {
        data?: {
          domain?: string;
          organization?: string;
          pattern?: string | null;
          emails?: Array<{
            value?: string;
            type?: string;
            confidence?: number;
            first_name?: string | null;
            last_name?: string | null;
            position?: string | null;
            seniority?: string | null;
            department?: string | null;
          }>;
        };
      };
      const data = json?.data;
      const emails = (data?.emails ?? [])
        .filter((e) => !!e.value)
        .slice(0, 10)
        .map((e) => ({
          value: e.value!,
          type: e.type ?? null,
          confidence: typeof e.confidence === "number" ? e.confidence : null,
          firstName: e.first_name ?? null,
          lastName: e.last_name ?? null,
          position: e.position ?? null,
          seniority: e.seniority ?? null,
          department: e.department ?? null,
        }));
      if (emails.length === 0 && !data?.pattern) return null;
      const summaryParts: string[] = [];
      if (data?.organization) summaryParts.push(`org: ${data.organization}`);
      if (emails.length > 0) summaryParts.push(`${emails.length} email(s)`);
      if (data?.pattern) summaryParts.push(`pattern: ${data.pattern}`);
      return {
        confidence: emails.length > 0 ? 65 : 35,
        summary: summaryParts.join(" · ") || `Hunter matched ${domain}.`,
        payload: {
          domain,
          organization: data?.organization ?? null,
          pattern: data?.pattern ?? null,
          emails,
          totalEmails: emails.length,
        },
      };
    } catch (err) {
      logger.warn({ err, leadId: lead.id, domain }, "hunter_io: fetch failed");
      return null;
    }
  }
}

export const hunterIoSource = new HunterIoSource();
