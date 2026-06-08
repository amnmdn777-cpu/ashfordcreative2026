import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import type { Candidate, EnrichmentSource, LeadInput } from "./types";

/**
 * Yelp Fusion — Business Search → Business Details → Reviews chain.
 *
 * Step 1: search by practice/city for the top business candidate.
 * Step 2: fetch /v3/businesses/{id} for `photos[]` and `hours[]`.
 * Step 3: fetch /v3/businesses/{id}/reviews for up to 3 review excerpts.
 *
 * Persists the merged shape `{ totalMatches, business, details, reviews }`
 * so the portal merge layer can pick reviews/photos/hours/phone/address
 * from a single payload.
 *
 * Docs: https://docs.developer.yelp.com/reference/v3_business_search
 */
class YelpFusionSource implements EnrichmentSource {
  readonly key = "yelp_fusion";
  readonly label = "Yelp Fusion";

  isConfigured(): boolean {
    return !!env.yelpApiKey;
  }

  private async getJson<T>(url: string): Promise<T | null> {
    try {
      const res = await fetch(url, {
        headers: {
          authorization: `Bearer ${env.yelpApiKey!}`,
          accept: "application/json",
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  async fetch(lead: LeadInput): Promise<Candidate | null> {
    if (!this.isConfigured()) return null;
    try {
      const params = new URLSearchParams({
        term: lead.practice,
        location: `${lead.city}, ${lead.state}`,
        categories: "therapists,counseling,psychologists,psychiatrists",
        limit: "3",
      });
      const search = await this.getJson<{
        businesses?: Array<{
          id?: string;
          name?: string;
          rating?: number;
          review_count?: number;
          url?: string;
          categories?: Array<{ title?: string }>;
          location?: { display_address?: string[] };
          phone?: string;
          display_phone?: string;
          price?: string;
        }>;
      }>(`https://api.yelp.com/v3/businesses/search?${params.toString()}`);
      const top = search?.businesses?.[0];
      if (!top || !top.id) return null;

      const [details, reviewsResp] = await Promise.all([
        this.getJson<{
          photos?: string[];
          hours?: Array<{
            open?: Array<{
              day?: number;
              start?: string;
              end?: string;
              is_overnight?: boolean;
            }>;
            is_open_now?: boolean;
          }>;
          location?: { display_address?: string[] };
          display_phone?: string;
          phone?: string;
          url?: string;
        }>(`https://api.yelp.com/v3/businesses/${encodeURIComponent(top.id)}`),
        this.getJson<{
          reviews?: Array<{
            id?: string;
            rating?: number;
            text?: string;
            time_created?: string;
            url?: string;
            user?: { name?: string };
          }>;
          total?: number;
        }>(
          `https://api.yelp.com/v3/businesses/${encodeURIComponent(top.id)}/reviews`,
        ),
      ]);

      const cats = (top.categories ?? [])
        .map((c) => c.title)
        .filter(Boolean)
        .slice(0, 3)
        .join(", ");
      const summaryParts: string[] = [];
      if (typeof top.rating === "number") {
        summaryParts.push(
          `${top.rating}★ on ${top.review_count ?? "?"} Yelp reviews`,
        );
      }
      if (cats) summaryParts.push(`categories: ${cats}`);
      if (top.price) summaryParts.push(`price: ${top.price}`);
      if (top.location?.display_address?.length) {
        summaryParts.push(top.location.display_address.join(", "));
      }
      if (details?.photos?.length) {
        summaryParts.push(`${details.photos.length} photos`);
      }
      if (reviewsResp?.reviews?.length) {
        summaryParts.push(`${reviewsResp.reviews.length} review excerpts`);
      }

      return {
        confidence: 70,
        summary: summaryParts.join(" · ") || "Yelp business matched.",
        payload: {
          totalMatches: search?.businesses?.length ?? 0,
          business: top,
          details: details ?? null,
          reviews: reviewsResp?.reviews ?? [],
        },
      };
    } catch (err) {
      logger.warn({ err, leadId: lead.id }, "yelp enrichment failed");
      return null;
    }
  }
}

export const yelpFusionSource = new YelpFusionSource();
