import type { TemplateContent } from "./types";

export interface BrandData {
  fullName: string;
  nameNoCred: string;
  /** Just the first given name (parts[0]) — use this for "Meet {firstName}" copy. */
  firstName: string;
  firstPart: string;
  lastPart: string;
  credentials: string;
  practiceName: string;
  practiceShort: string;
  tagline: string;
  /**
   * Optional non-headline pill (e.g. "Available in English & Spanish").
   * Set when the lead's enrichment indicates a second-language offering;
   * null otherwise. Templates that opt in render this near the hero —
   * intentionally not as the H1.
   */
  bilingualBadge: string | null;
  mission: string;
  hero: string;
  portrait: string;
  phone: string;
  phoneHref: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  fullAddress: string;
  locationCity: string;
  yearFounded?: number;
}

export function brand(content: TemplateContent): BrandData {
  const fullNameRaw = (content.team?.[0]?.name || content.practiceName || "").trim();
  // Pull every comma-suffixed credential token off the end of the name.
  // Real credentials look like: "PhD", "LCSW", "LCSW-S", "MA, LPC", "PhD, LPC-S".
  // We require each segment to be 1–10 chars of letters/dot/dash/digits and to
  // contain at least one uppercase letter — that excludes things like "Jr." or
  // "Sr." (which we want to keep as part of the name) while accepting common
  // real-world tails. Iterate so multi-credential tails are fully captured.
  const credPattern = /,\s*([A-Z][A-Za-z0-9./\-]{0,9})\s*$/;
  const credList: string[] = [];
  let nameNoCred = fullNameRaw;
  while (true) {
    const m = nameNoCred.match(credPattern);
    if (!m) break;
    credList.unshift(m[1].trim());
    nameNoCred = nameNoCred.replace(credPattern, "").trim();
  }
  const credentials = (
    credList.join(", ") ||
    content.team?.[0]?.credentials ||
    ""
  ).trim();
  const parts = nameNoCred.split(/\s+/);
  const lastPart = parts.length > 1 ? parts[parts.length - 1] : "";
  const firstPart =
    parts.length > 1 ? parts.slice(0, -1).join(" ") : nameNoCred;
  const firstName = parts[0] || nameNoCred;
  const practiceShort = (lastPart || nameNoCred).toUpperCase();

  const loc = content.locations?.[0];
  const addr = loc?.address ?? "";
  const segs = addr.split(",").map((s) => s.trim()).filter(Boolean);
  let addressLine1 = "";
  let addressLine2 = "";
  if (segs.length >= 4) {
    addressLine1 = segs.slice(0, -2).join(", ");
    addressLine2 = segs.slice(-2).join(", ");
  } else if (segs.length === 3) {
    addressLine1 = segs.slice(0, -1).join(", ");
    addressLine2 = segs[segs.length - 1] ?? "";
  } else if (segs.length === 2) {
    addressLine1 = segs[0] ?? "";
    addressLine2 = segs[1] ?? "";
  } else {
    addressLine1 = addr;
  }

  // Prefer a real city parsed from the address over loc.name (which may be a
  // friendly label like "Austin Office"). We assume "..., City, ST ZIP" or
  // "..., City, ST" — the city is the second-to-last segment when the last
  // segment looks like "ST" or "ST ZIP".
  let locationCity = "";
  if (segs.length >= 2) {
    const tail = segs[segs.length - 1] ?? "";
    if (/^[A-Z]{2}(\s+\d{5}(-\d{4})?)?$/.test(tail)) {
      locationCity = segs[segs.length - 2] ?? "";
    }
  }
  if (!locationCity) {
    // Fall back to loc.name with a soft cleanup (strip trailing "Office").
    locationCity = (loc?.name ?? "").replace(/\s+office\s*$/i, "").trim();
  }

  const phone = content.contact.phone || "";
  const phoneHref = `tel:${phone.replace(/[^0-9+]/g, "")}`;

  return {
    fullName: fullNameRaw,
    nameNoCred,
    firstName,
    firstPart,
    lastPart,
    credentials,
    practiceName: content.practiceName,
    practiceShort,
    tagline: content.tagline,
    bilingualBadge: content.bilingualBadge ?? null,
    mission: content.mission,
    hero: content.heroImage,
    portrait: content.team?.[0]?.photo || content.heroImage,
    phone,
    phoneHref,
    email: content.contact.email || "",
    addressLine1,
    addressLine2,
    fullAddress: addr,
    locationCity,
    yearFounded: content.yearFounded,
  };
}
