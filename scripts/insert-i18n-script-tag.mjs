import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PAGES } from "./i18n/manifest.mjs";

// fileURLToPath (not .pathname) so a project path containing spaces decodes correctly.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TAG = '<script src="/assets/i18n.js"></script>';
const COMMON_RE = /<script src="\/?common\.js"><\/script>/;

let updated = 0, skipped = 0;
for (const page of PAGES) {
  for (const prefix of ["", "ms/", "zh/"]) {
    const path = `${ROOT}${prefix}${page.file}`;
    const html = readFileSync(path, "utf8");
    if (html.includes(TAG)) { skipped++; continue; }
    if (!COMMON_RE.test(html)) throw new Error(`no common.js script tag found in ${path}`);
    writeFileSync(path, html.replace(COMMON_RE, (m) => `${TAG}${m}`));
    updated++;
  }
}
console.log(`Updated ${updated} pages, skipped ${skipped} already up to date.`);
