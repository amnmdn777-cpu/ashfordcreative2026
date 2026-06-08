import { GoogleBusinessMap, OfficeTourStrip, Reviews } from "@site/components/sections";
import { FeatureMark } from "@site/components/demo/FeatureBadge";

/**
 * The three "default feature" sections every non-Quiet-Practice template
 * renders between FAQ and the per-template footer: Office Tour, Reviews,
 * and the Google Business Map. Wrapped in <FeatureMark> so the demo
 * overlay on /template/<key> can pin numbered pulse-dots at each — silent
 * on real prospect sites.
 *
 * Quiet Practice intentionally omits this block; see CLAUDE.md and
 * lib/templateFeatures.ts for the per-template feature presence config.
 */

export type CommonExtrasPersona = {
  reviews: ReadonlyArray<{ author: string; body: string; rating: number; source?: string }>;
  addressLine1: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  phone?: string;
};

function composeAddress(p: CommonExtrasPersona): string {
  if (p.addressLine1 && p.addressLine2) return `${p.addressLine1}, ${p.addressLine2}`;
  if (p.addressLine1) return p.addressLine1;
  if (p.city && p.state) return `${p.city}, ${p.state}`;
  return "Austin, TX";
}

export function CommonExtras({ r }: { r: CommonExtrasPersona }) {
  return (
    <>
      <FeatureMark featureKey="office_tour">
        <OfficeTourStrip />
      </FeatureMark>
      {/* Reviews + Google Business Map both render under a single
          `google_business_presence` mark — they share the same product
          mechanism (Google Business Profile sync) and were merged into
          one feature in the catalog (founder note 2026-05). */}
      <FeatureMark featureKey="google_business_presence">
        <>
          {r.reviews.length > 0 && <Reviews reviews={r.reviews as never} />}
          <GoogleBusinessMap address={composeAddress(r)} phone={r.phone || undefined} />
        </>
      </FeatureMark>
    </>
  );
}

export default CommonExtras;
