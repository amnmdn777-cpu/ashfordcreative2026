// One-shot setup: copies the Express API server + its two workspace lib
// packages (db, api-zod) into this standalone backend folder. The source repo
// is read-only — nothing is written back into ashfordcreativemigrated.
import fs from "node:fs";
import path from "node:path";

const SRC = "D:/Client/newclient/ashfordcreativemigrated";
const DEST = "D:/Client/newclient/ashford-backend";

const EXCLUDE = new Set(["node_modules", ".turbo", "dist", "tsconfig.tsbuildinfo"]);

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (EXCLUDE.has(entry.name)) continue;
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function copyFile(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

// Clean prior copies of code (keep root config files we author by hand).
for (const dir of ["src", "scripts", "packages"]) {
  fs.rmSync(`${DEST}/${dir}`, { recursive: true, force: true });
}

console.log("Copying api-server/src -> src");
copyDir(`${SRC}/artifacts/api-server/src`, `${DEST}/src`);

console.log("Copying api-server/scripts -> scripts");
copyDir(`${SRC}/artifacts/api-server/scripts`, `${DEST}/scripts`);

console.log("Copying api-server/build.mjs -> build.mjs");
copyFile(`${SRC}/artifacts/api-server/build.mjs`, `${DEST}/build.mjs`);

console.log("Copying lib/db -> packages/db");
copyDir(`${SRC}/lib/db`, `${DEST}/packages/db`);

console.log("Copying lib/api-zod -> packages/api-zod");
copyDir(`${SRC}/lib/api-zod`, `${DEST}/packages/api-zod`);

console.log("Done.");
