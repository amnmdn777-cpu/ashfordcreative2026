// One-shot setup script: copies the three Ashford frontend apps + the shared
// api-zod lib into this unified project, rewriting their `@/` path aliases to
// per-app namespaced aliases (`@site`, `@admin`, `@rep`) so nothing collides.
//
// Source repo is read-only — we never write back into ashfordcreativemigrated.
import fs from "node:fs";
import path from "node:path";

const SRC = "D:/Client/newclient/ashfordcreativemigrated";
const DEST = "D:/Client/newclient/ashford-unified";

/** apps to copy: [sourceSrcDir, destSubdir, aliasPrefix] */
const APPS = [
  [`${SRC}/artifacts/ashford-site/src`, `${DEST}/src/site`, "@site"],
  [`${SRC}/artifacts/ashford-admin/src`, `${DEST}/src/admin`, "@admin"],
  [`${SRC}/artifacts/ashford-rep/src`, `${DEST}/src/rep`, "@rep"],
];

const SHARED = [
  [`${SRC}/lib/api-zod/src`, `${DEST}/src/shared/api-zod`],
];

const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/** Rewrite `<quote>@/` -> `<quote><prefix>/` across all code files in a tree. */
function rewriteAliases(dir, prefix) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      rewriteAliases(p, prefix);
    } else if (CODE_EXT.has(path.extname(entry.name))) {
      const src = fs.readFileSync(p, "utf8");
      // Match the alias only when it directly follows a quote/backtick, so we
      // never touch things like email addresses or `@/` inside a comment URL.
      const out = src.replace(/(["'`])@\//g, `$1${prefix}/`);
      if (out !== src) fs.writeFileSync(p, out, "utf8");
    }
  }
}

console.log("Cleaning old src...");
fs.rmSync(`${DEST}/src`, { recursive: true, force: true });

for (const [from, to, prefix] of APPS) {
  console.log(`Copying ${from} -> ${to}`);
  copyDir(from, to);
  console.log(`Rewriting @/ -> ${prefix}/ in ${to}`);
  rewriteAliases(to, prefix);
}

for (const [from, to] of SHARED) {
  console.log(`Copying shared ${from} -> ${to}`);
  copyDir(from, to);
}

console.log("Done.");
