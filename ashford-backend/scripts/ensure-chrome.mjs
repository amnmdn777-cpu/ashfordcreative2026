#!/usr/bin/env node
/**
 * Idempotently install the Chromium binary that puppeteer needs to render
 * preview screenshots embedded in our drip emails. Runs:
 *   - in dev:        as the first step of `pnpm dev`
 *   - in production: as the first step of `pnpm build` (so the deployed
 *                    artifact's container always has Chrome before
 *                    `node dist/index.mjs` boots).
 *
 * Why this lives in a real script instead of an inline `node -e` one-liner:
 *   1. The previous one-liner crashed on Replit deploy images that don't
 *      ship `bash` at /bin/bash, taking the whole build down.
 *   2. We want to detect "already installed" and exit fast (~50 ms) so a
 *      warm container restart doesn't pay the 30-second download tax.
 *   3. We want a graceful degradation: if Chrome cannot be installed (e.g.
 *      offline build, locked-down container), we LOG the failure but still
 *      exit 0. The screenshot capture path already handles a missing
 *      browser by falling back to the text-only hero panel — it's a
 *      visual downgrade, not a launch blocker.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const cacheRoot = path.join(homedir(), ".cache", "puppeteer", "chrome");

const isAlreadyInstalled = () => {
  if (!existsSync(cacheRoot)) return false;
  try {
    // Puppeteer drops one or more `linux-<rev>` directories under
    // ~/.cache/puppeteer/chrome. A non-empty dir with at least one entry
    // means we don't need to re-download.
    return readdirSync(cacheRoot).length > 0;
  } catch {
    return false;
  }
};

if (isAlreadyInstalled()) {
  console.log(`[ensure-chrome] chrome already cached at ${cacheRoot}`);
  process.exit(0);
}

console.log("[ensure-chrome] installing chrome via puppeteer …");
try {
  execFileSync("npx", ["puppeteer", "browsers", "install", "chrome"], {
    stdio: "inherit",
  });
  console.log("[ensure-chrome] chrome installed");
} catch (err) {
  console.warn(
    "[ensure-chrome] FAILED to install chrome — drip emails will fall " +
      "back to the text-only hero panel until this is resolved. " +
      `Reason: ${err && err.message ? err.message : err}`,
  );
  // Exit 0 on purpose — see header comment.
  process.exit(0);
}
