import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PAGES } from "./i18n/manifest.mjs";
import { localizePage } from "./i18n/localize.mjs";

// fileURLToPath (not .pathname) so a project path containing spaces decodes correctly.
const ROOT = fileURLToPath(new URL("..", import.meta.url));

let written = 0;
for (const page of PAGES) {
  const html = readFileSync(join(ROOT, page.file), "utf8");
  for (const langCode of ["ms", "zh"]) {
    const out = localizePage(html, { langCode, slug: page.slug });
    const outPath = join(ROOT, langCode, page.file);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, out);
    written++;
  }
}
console.log(`Wrote ${written} localized skeleton files (expected ${PAGES.length * 2}).`);
