/**
 * One-off importer for PsychologyToday-scraped CSVs.
 * Usage: pnpm --filter @workspace/api-server tsx src/scripts/importLeads.ts <csv-path> [--dry]
 *
 * Maps CSV rows -> leads table, dedupes by normalized 10-digit phone,
 * inserts everything as `available` (unclaimed). Reports per-row outcome.
 */
import fs from "node:fs";
import path from "node:path";
import { db, leads as leadsTbl } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { splitPracticeStem, toTitleCase } from "@workspace/api-zod";

// ---- tiny RFC-4180-ish CSV parser (handles quotes + embedded commas/newlines) ----
function parseCsv(text: string): string[][] {
  // strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(cur);
        cur = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cur);
        cur = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else {
        cur += c;
      }
    }
  }
  if (cur !== "" || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

// ---- normalization helpers ----
const GENERIC_EMAIL_DOMAINS = new Set([
  "headway.co",
  "lifestance.com",
  "growtherapy.com",
  "alma.com",
  "helloalma.com",
  "rula.com",
  "talkiatry.com",
  "betterhelp.com",
  "talkspace.com",
]);
const GENERIC_EMAIL_PREFIXES = new Set([
  "support",
  "info",
  "partnerships",
  "billing",
  "concerns",
  "insurance",
  "magellan",
  "magellan.support",
]);
const JUNK_EMAIL_SUFFIXES = [".webp", ".png", ".jpg", ".jpeg", ".svg", ".gif"];

const normalizePhone = (raw: string): string | null => {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return null;
};

const formatPhone = (digits: string): string =>
  `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;

const pickEmail = (raw: string): string | null => {
  if (!raw) return null;
  for (const candidate of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
    const lower = candidate.toLowerCase();
    if (!lower.includes("@")) continue;
    if (JUNK_EMAIL_SUFFIXES.some((s) => lower.endsWith(s))) continue;
    const [prefix, domain] = lower.split("@");
    if (!domain || !domain.includes(".")) continue;
    if (GENERIC_EMAIL_DOMAINS.has(domain)) continue;
    if (GENERIC_EMAIL_PREFIXES.has(prefix)) continue;
    return candidate;
  }
  return null;
};

const pickWebsite = (raw: string): string | null => {
  if (!raw) return null;
  const candidate = raw.split(",")[0].trim();
  if (!candidate) return null;
  const lower = candidate.toLowerCase();
  if (lower.includes("psychologytoday.com")) return null;
  if (lower.includes("photos.psychologytoday")) return null;
  if (JUNK_EMAIL_SUFFIXES.some((s) => lower.endsWith(s))) return null;
  if (!/^https?:\/\//.test(candidate) && !lower.includes(".")) return null;
  return candidate.startsWith("http") ? candidate : `https://${candidate}`;
};

const derivePracticeFromWebsite = (website: string | null): string | null => {
  if (!website) return null;
  try {
    const host = new URL(website).hostname.replace(/^www\./, "");
    const stem = host.split(".")[0];
    if (!stem || stem.length < 3) return null;
    const split = splitPracticeStem(stem);
    return split ? toTitleCase(split) : null;
  } catch {
    return null;
  }
};

// "Dallas, TX 75214" -> { city: "Dallas", state: "TX" }
const parseCityState = (
  address: string,
): { city: string; state: string } | null => {
  if (!address) return null;
  const m = address.match(/^(.+?),\s*([A-Z]{2})(?:\s+\d{5})?$/);
  if (!m) return null;
  return { city: m[1].trim().slice(0, 64), state: m[2] };
};

// pull "City, ST" out of arbitrary text (used for `locations` fallback when
// `address` is "Online Only").
const findCityStateInText = (
  text: string,
): { city: string; state: string } | null => {
  if (!text) return null;
  const m = text.match(/([A-Z][A-Za-z .'-]+),\s*([A-Z]{2})\s*\d{5}/);
  if (!m) return null;
  return { city: m[1].trim().slice(0, 64), state: m[2] };
};

const firstSpecialty = (top: string, expertise: string): string => {
  for (const src of [top, expertise]) {
    if (!src) continue;
    const first = src
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)[0];
    if (first) return first.slice(0, 96);
  }
  return "Mental Health";
};

const truncate = (s: string | null | undefined, n: number): string | null => {
  if (!s) return null;
  const clean = s.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > n ? clean.slice(0, n - 1) + "…" : clean;
};

// ---- main ----
async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const csvPath = args.find((a) => !a.startsWith("--"));
  if (!csvPath) {
    console.error("Usage: importLeads.ts <csv-path> [--dry]");
    process.exit(1);
  }
  const abs = path.resolve(csvPath);
  const text = fs.readFileSync(abs, "utf8");
  const rows = parseCsv(text);
  if (rows.length < 2) {
    console.error("CSV has no data rows.");
    process.exit(1);
  }
  const header = rows[0].map((h) => h.trim());
  const idx = (col: string) => header.indexOf(col);
  const COL = {
    address: idx("address"),
    detailsUrl: idx("detailsUrl"),
    emails: idx("emails"),
    expertise: idx("expertise"),
    insurances: idx("insurances"),
    locations: idx("locations"),
    longDescription: idx("longDescription"),
    name: idx("name"),
    phone: idx("phone"),
    qualifications: idx("qualifications"),
    shortDescription: idx("shortDescription"),
    title: idx("title"),
    topSpecialties: idx("topSpecialties"),
    treatmentApproach: idx("treatmentApproach"),
    website: idx("website"),
    locale: idx("locale"),
  };
  for (const [k, v] of Object.entries(COL)) {
    // `locale` is optional — older CSVs predate the bilingual portal flag and
    // simply default every row to English. Don't pollute the run output by
    // warning on its absence.
    if (v < 0 && k !== "locale") console.warn(`(warning) CSV missing column: ${k}`);
  }

  // Pre-load existing phones for dedupe (normalized 10-digit).
  const existing = await db
    .select({ phone: leadsTbl.phone })
    .from(leadsTbl);
  const existingDigits = new Set<string>();
  for (const r of existing) {
    const d = normalizePhone(r.phone ?? "");
    if (d) existingDigits.add(d);
  }
  console.log(
    `Loaded ${existing.length} existing leads (${existingDigits.size} with usable phones) for dedupe.`,
  );

  type Outcome =
    | { kind: "insert"; row: typeof leadsTbl.$inferInsert; line: number }
    | { kind: "skip"; reason: string; line: number; name: string };
  const outcomes: Outcome[] = [];
  const seenInBatch = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const get = (c: number) => (c >= 0 ? (r[c] ?? "").trim() : "");
    const name = get(COL.name);
    const phoneRaw = get(COL.phone);
    if (!name) {
      outcomes.push({ kind: "skip", reason: "no name", line: i + 1, name: "" });
      continue;
    }
    const phoneDigits = normalizePhone(phoneRaw);
    if (!phoneDigits) {
      outcomes.push({
        kind: "skip",
        reason: "no/invalid phone",
        line: i + 1,
        name,
      });
      continue;
    }
    if (existingDigits.has(phoneDigits) || seenInBatch.has(phoneDigits)) {
      outcomes.push({
        kind: "skip",
        reason: "duplicate phone",
        line: i + 1,
        name,
      });
      continue;
    }

    const address = get(COL.address);
    let cityState = parseCityState(address);
    if (!cityState) {
      // "Online Only" rows: try the locations field for a city/state/zip.
      cityState = findCityStateInText(get(COL.locations));
    }
    if (!cityState) {
      outcomes.push({
        kind: "skip",
        reason: "no city/state",
        line: i + 1,
        name,
      });
      continue;
    }

    const website = pickWebsite(get(COL.website));
    const practice =
      derivePracticeFromWebsite(website) ?? `${name} — Private Practice`;
    const specialty = firstSpecialty(
      get(COL.topSpecialties),
      get(COL.expertise),
    );
    const email = pickEmail(get(COL.emails));
    const profileBlurb =
      truncate(get(COL.shortDescription), 280) ??
      truncate(get(COL.longDescription), 280);
    const notesParts: string[] = [];
    const qual = truncate(get(COL.qualifications), 240);
    if (qual) notesParts.push(`Qualifications: ${qual}`);
    const approach = truncate(get(COL.treatmentApproach), 240);
    if (approach) notesParts.push(`Approach: ${approach}`);
    const detailsUrl = get(COL.detailsUrl);
    if (detailsUrl) notesParts.push(`PsychologyToday: ${detailsUrl}`);
    const notes = notesParts.length ? notesParts.join("\n") : null;

    // placeId: extract trailing numeric id from detailsUrl as a stable handle
    let placeId: string | null = null;
    const m = detailsUrl.match(/\/(\d+)$/);
    if (m) placeId = `pt_${m[1]}`;

    // Locale: optional CSV column. Anything other than an explicit "es"
    // (case-insensitive) falls back to "en" so a typo never silently routes
    // a lead into the wrong-language portal flow.
    const rawLocale = get(COL.locale).toLowerCase();
    const locale: "en" | "es" = rawLocale === "es" ? "es" : "en";

    const row: typeof leadsTbl.$inferInsert = {
      name: name.slice(0, 128),
      practice: practice.slice(0, 192),
      specialty,
      city: cityState.city,
      state: cityState.state,
      phone: formatPhone(phoneDigits),
      email: email ? email.slice(0, 192) : null,
      locale,
      currentWebsite: website ? website.slice(0, 256) : null,
      placeId,
      profileBlurb,
      notes,
      status: "available",
    };
    outcomes.push({ kind: "insert", row, line: i + 1 });
    seenInBatch.add(phoneDigits);
  }

  const inserts = outcomes.filter((o) => o.kind === "insert");
  const skips = outcomes.filter((o) => o.kind === "skip");
  console.log(
    `Parsed ${rows.length - 1} CSV rows -> ${inserts.length} inserts, ${skips.length} skips`,
  );
  const reasonCount = new Map<string, number>();
  for (const s of skips as Array<{ reason: string }>) {
    reasonCount.set(s.reason, (reasonCount.get(s.reason) ?? 0) + 1);
  }
  for (const [reason, n] of reasonCount) console.log(`  skip: ${reason} = ${n}`);

  if (dry) {
    console.log("\nDry run — not inserting. First 3 sample rows:");
    for (const o of inserts.slice(0, 3))
      console.log(JSON.stringify((o as { row: unknown }).row, null, 2));
    process.exit(0);
  }

  if (!inserts.length) {
    console.log("Nothing to insert.");
    process.exit(0);
  }

  // Insert in chunks of 50 for safety.
  const rowsToInsert = (inserts as Array<{ row: typeof leadsTbl.$inferInsert }>)
    .map((o) => o.row);
  let inserted = 0;
  for (let i = 0; i < rowsToInsert.length; i += 50) {
    const chunk = rowsToInsert.slice(i, i + 50);
    const result = await db.insert(leadsTbl).values(chunk).returning({
      id: leadsTbl.id,
    });
    inserted += result.length;
  }
  console.log(`\nInserted ${inserted} new leads.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
