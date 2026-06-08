/**
 * Diagnostic: fetch a single Headway profile via ScraperAPI and tell
 * us what shape its HTML actually is — does the `__NEXT_DATA__` blob
 * still exist, is JSON-LD present, where in the doc is the provider's
 * name? Used to debug why `parseHeadwayProfile` returned null even
 * though the fetch returned 1MB+ of HTML.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server exec tsx \
 *     src/scripts/debugHeadwayHtml.ts \
 *     https://care.headway.co/providers/tara-langston-2
 */
import { env } from "../lib/env";
import { writeFile } from "node:fs/promises";

const url = process.argv[2];
if (!url) {
  console.error(
    "Usage: debugHeadwayHtml.ts <headway-profile-url>",
  );
  process.exit(1);
}
if (!env.scraperapiKey) {
  console.error("SCRAPERAPI_KEY not set in env.");
  process.exit(1);
}

const fetchWithRetry = async (
  target: string,
  attempts = 4,
): Promise<string> => {
  let lastStatus = 0;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      const delay = 2000 * 2 ** (i - 1); // 2s, 4s, 8s
      console.log(`Retry ${i}/${attempts - 1} after ${delay}ms…`);
      await new Promise((r) => setTimeout(r, delay));
    }
    const res = await fetch(target, {
      headers: { accept: "text/html" },
      signal: AbortSignal.timeout(60_000),
    });
    if (res.ok) {
      const html = await res.text();
      console.log(`Status: ${res.status}, bytes: ${html.length}`);
      return html;
    }
    lastStatus = res.status;
    console.log(`Status: ${res.status} — retrying`);
  }
  throw new Error(`ScraperAPI gave up after ${attempts} attempts (last=${lastStatus})`);
};

const main = async () => {
  const target = `https://api.scraperapi.com/?api_key=${encodeURIComponent(
    env.scraperapiKey!,
  )}&url=${encodeURIComponent(url)}&render=true&country_code=us`;
  console.log(`Fetching ${url} via ScraperAPI render=true (with retry) …`);
  const html = await fetchWithRetry(target);
  console.log("");

  // Write the full HTML to /tmp so we can inspect offline if regex
  // searches below don't find what we need. Useful for figuring out
  // the new Headway data shape (App Router streaming markers, etc.).
  const fileSlug = url.match(/\/providers\/([a-z0-9-]+)/)?.[1] ?? "headway";
  const outPath = `/tmp/headway-${fileSlug}.html`;
  await writeFile(outPath, html, "utf8");
  console.log(`HTML saved to ${outPath}`);
  console.log("");

  // 1. Is __NEXT_DATA__ present, and what does its head look like?
  const nextDataMatch = html.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (nextDataMatch) {
    console.log("✓ __NEXT_DATA__ present");
    console.log(`  bytes: ${nextDataMatch[1].length}`);
    console.log(`  head:  ${nextDataMatch[1].slice(0, 220)}…`);
    try {
      const json = JSON.parse(nextDataMatch[1]);
      console.log(`  top-level keys: ${Object.keys(json).join(", ")}`);
      const props = (json as Record<string, unknown>).props;
      if (props && typeof props === "object") {
        const pageProps = (props as Record<string, unknown>).pageProps;
        if (pageProps && typeof pageProps === "object") {
          console.log(
            `  pageProps keys: ${Object.keys(pageProps).slice(0, 30).join(", ")}`,
          );
        }
      }
    } catch (err) {
      console.log(
        `  ✗ JSON.parse failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  } else {
    console.log("✗ NO __NEXT_DATA__ block — Headway has moved off Next pages");
  }
  console.log("");

  // 2. JSON-LD blocks
  const jsonLdMatches = Array.from(
    html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  );
  console.log(`JSON-LD blocks: ${jsonLdMatches.length}`);
  for (const m of jsonLdMatches.slice(0, 3)) {
    try {
      const obj = JSON.parse(m[1]);
      console.log(`  - @type: ${(obj as Record<string, unknown>)["@type"] ?? "(no type)"}`);
    } catch {
      console.log(`  - (unparseable)`);
    }
  }
  console.log("");

  // 3. Where does the provider's name appear?
  const slug = url.match(/\/providers\/([a-z0-9-]+)/)?.[1] ?? "";
  const nameTokens = slug.split("-").filter((t) => t.length >= 2 && !/^\d+$/.test(t));
  for (const tok of nameTokens) {
    const re = new RegExp(`\\b${tok}\\b`, "gi");
    const count = (html.match(re) ?? []).length;
    const firstIdx = html.search(re);
    console.log(
      `  token "${tok}": ${count} occurrences, first at offset ${firstIdx}`,
    );
  }
  console.log("");

  // 4. Self-Hosting Next.js streaming markers (App Router post-Next 13)
  const streamingMarkers = [
    'self.__next_f',
    '"action":"',
    '__NEXT_F',
    'data-flight',
  ];
  for (const m of streamingMarkers) {
    const found = html.indexOf(m);
    if (found !== -1) {
      console.log(`  marker "${m}" found at offset ${found}`);
    }
  }
  console.log("");

  // 5. Common Headway data fields visible in HTML body text
  const bodyTextSample = html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  const candidates = [
    "Anxiety",
    "Depression",
    "Insurance",
    "Specialties",
    "License",
    "Languages",
    "Aetna",
    "Cigna",
    "LCSW",
    "LPC",
  ];
  console.log("Body text presence (rendered DOM):");
  for (const c of candidates) {
    const i = bodyTextSample.toLowerCase().indexOf(c.toLowerCase());
    if (i !== -1) console.log(`  ✓ "${c}" at offset ${i}`);
  }
  console.log("");

  // 6. First 600 chars of body text — gives a hint whether we landed on
  //    a Cloudflare interstitial, a marketing landing, or a real profile.
  console.log("First 600 chars of stripped body text:");
  console.log("---");
  console.log(bodyTextSample.slice(0, 600));
  console.log("---");
};

main().catch((err) => {
  console.error("Debug fetch failed:", err);
  process.exit(1);
});
