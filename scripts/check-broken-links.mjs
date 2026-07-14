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
    // Strip <script> blocks: they hold JS template literals (e.g. href="${s.url}")
    // that are rendered at runtime, not static links this audit can resolve.
    const html = readFileSync(filePath, "utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");

    // 1) Absolute internal hrefs must point at a known page (or redirect alias).
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

    // 2) No RELATIVE internal anchor hrefs. They resolve against the served base
    //    URL, so under Vercel cleanUrls (page served at /ms, no trailing slash) a
    //    relative "today" leaks to /today (the English page). Internal links must
    //    be absolute. (Excludes external, in-page #anchors, and asset files.)
    const relHrefs = [...html.matchAll(/(?<![\w-])href="(?!\/|https?:|#|mailto:|tel:|data:)([^"]+)"/g)].map((m) => m[1]);
    for (const raw of relHrefs) {
      if (/\.(css|js|png|jpe?g|svg|ico|json|xml|txt)$/.test(raw.split(/[?#]/)[0])) continue;
      problems.push(`${prefix}${page.file}: RELATIVE internal href "${raw}" (must be absolute — leaks to English under cleanUrls)`);
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
