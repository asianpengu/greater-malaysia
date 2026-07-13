import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PAGES } from "./i18n/manifest.mjs";
import { pageSlugSet } from "./i18n/localize.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const slugs = pageSlugSet();
const NON_PAGE_RE = /^\/(assets|data)\/|\.(css|js|txt|xml|json|ico|png)$/;
// Short URLs that resolve via a vercel.json redirect rather than a page file.
// Valid destinations, so not broken — but only at the exact (unprefixed) path.
const REDIRECT_ALIASES = new Set(["/cuti-umum"]);

let problems = [];
for (const page of PAGES) {
  for (const prefix of ["", "ms/", "zh/"]) {
    const filePath = `${ROOT}${prefix}${page.file}`;
    const html = readFileSync(filePath, "utf8");
    const hrefs = [...html.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]);
    for (const raw of hrefs) {
      const base = raw.split(/[?#]/)[0];
      if (NON_PAGE_RE.test(base)) continue;
      if (REDIRECT_ALIASES.has(base)) continue; // valid unprefixed redirect target
      let bare = base;
      for (const p of ["/ms", "/zh"]) {
        if (base === p || base.startsWith(p + "/")) { bare = base.slice(p.length) || "/"; break; }
      }
      if (!slugs.has(bare)) problems.push(`${prefix}${page.file}: links to unknown page "${raw}"`);
    }
  }
}
if (problems.length) {
  console.log(`${problems.length} links to unknown pages:`);
  problems.forEach((p) => console.log(`  ${p}`));
  process.exit(1);
} else {
  console.log(`No broken internal links found across ${PAGES.length * 3} pages.`);
}
