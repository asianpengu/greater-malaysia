import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PAGES } from "./i18n/manifest.mjs";
import { injectHreflang, insertLangSwitcher } from "./i18n/localize.mjs";

// fileURLToPath (not .pathname) so a project path containing spaces decodes correctly.
const ROOT = fileURLToPath(new URL("..", import.meta.url));

let updated = 0, skipped = 0;
for (const page of PAGES) {
  const filePath = join(ROOT, page.file);
  const html = readFileSync(filePath, "utf8");
  if (html.includes('hreflang="x-default"')) {
    skipped++; // idempotent: already updated by a previous run
    continue;
  }
  let out = injectHreflang(html, { slug: page.slug });
  out = insertLangSwitcher(out, { slug: page.slug, currentLangCode: "en" });
  writeFileSync(filePath, out);
  updated++;
}
console.log(`Updated ${updated} English pages, skipped ${skipped} already up to date.`);
