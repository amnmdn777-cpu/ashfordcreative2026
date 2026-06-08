import { describe, it, expect } from "vitest";
import {
  isGoogleInlineFullySynced,
  GOOGLE_INLINE_CORE_FIELDS,
} from "@workspace/api-zod";

/**
 * Locks down the predicate shared by the prospect portal's inline
 * Google Profile Sync card AND the rep dashboard's enrichment-health
 * row above step 1.
 *
 * Both surfaces MUST use the same answer: if the predicate says "fully
 * synced", the prospect's card shows real Google data with no warning;
 * if it says "not fully synced", the card shows a "sample shown" notice
 * and the dashboard shows an amber "Re-run enrichment" link. A drift
 * between the two surfaces is the exact bug task #207 fixed — reps were
 * staring at a green dashboard while the prospect's portal silently
 * mixed their real practice name with a fake "(512) 555-0198" phone.
 *
 * Predicate contract: returns `true` iff every entry in
 * `GOOGLE_INLINE_CORE_FIELDS` (currently `formattedAddress`,
 * `formattedPhone`, `rating`) is attributed to the `google_places`
 * source in the portal's `fieldSources` map. Any missing or
 * other-source attribution flips the answer to `false`. Null /
 * undefined input (e.g. portal not loaded yet) returns `false`.
 */
describe("isGoogleInlineFullySynced", () => {
  it("returns true when all three core fields landed from google_places", () => {
    expect(
      isGoogleInlineFullySynced({
        formattedAddress: "google_places",
        formattedPhone: "google_places",
        rating: "google_places",
        // Other sources for non-core fields are fine — they don't gate
        // the inline card's identity row.
        website: "website_meta",
        services: "psychology_today",
      }),
    ).toBe(true);
  });

  it("returns false when even one core field is missing", () => {
    // The "looks broken" failure mode: address landed from Google but
    // phone didn't, so the card would silently show real address next
    // to a fake phone. Predicate must catch this.
    expect(
      isGoogleInlineFullySynced({
        formattedAddress: "google_places",
        // formattedPhone deliberately absent
        rating: "google_places",
      }),
    ).toBe(false);
  });

  it("returns false when a core field came from a non-google_places source", () => {
    // Sometimes Yelp or website_meta fills a field Google didn't. The
    // inline card is branded "Google Profile Sync" and the prospect
    // expects the data to come from THEIR Google listing — anything
    // else still warrants the warning notice.
    expect(
      isGoogleInlineFullySynced({
        formattedAddress: "google_places",
        formattedPhone: "yelp_fusion",
        rating: "google_places",
      }),
    ).toBe(false);
  });

  it("returns false when no fields landed at all", () => {
    expect(isGoogleInlineFullySynced({})).toBe(false);
  });

  it("returns false on null or undefined input (portal not loaded)", () => {
    expect(isGoogleInlineFullySynced(null)).toBe(false);
    expect(isGoogleInlineFullySynced(undefined)).toBe(false);
  });

  it("exposes the exact list of core fields the predicate gates on", () => {
    // If this list changes, both the inline component and the rep
    // dashboard pick up the new behavior automatically — but the
    // owner-facing troubleshooting doc (docs/google-places-
    // troubleshooting.md) probably needs an edit too. The locked-
    // down list keeps that coupling visible.
    expect(GOOGLE_INLINE_CORE_FIELDS).toEqual([
      "formattedAddress",
      "formattedPhone",
      "rating",
    ]);
  });
});
