import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PAGES, LANGS, SITE_ORIGIN } from "./i18n/manifest.mjs";

function altLinks(page) {
  const alternates = ["en", "ms", "zh"]
    .map((code) => `<xhtml:link rel="alternate" hreflang="${LANGS[code].hreflang}" href="${SITE_ORIGIN}${LANGS[code].prefix}${page.slug}"/>`)
    .join("");
  const xdefault = `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${page.slug}"/>`;
  return alternates + xdefault;
}

function urlEntry(page, langCode) {
  const lang = LANGS[langCode];
  const loc = `${SITE_ORIGIN}${lang.prefix}${page.slug}`;
  return `<url><loc>${loc}</loc>${altLinks(page)}<lastmod>${page.lastmod}</lastmod><changefreq>${page.changefreq}</changefreq><priority>${page.priority}</priority></url>`;
}

const urls = PAGES.flatMap((page) => ["en", "ms", "zh"].map((code) => urlEntry(page, code))).join("\n  ");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  ${urls}
</urlset>
`;

// fileURLToPath (not .pathname) so a project path containing spaces decodes correctly.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
writeFileSync(`${ROOT}sitemap.xml`, xml);
console.log(`Wrote sitemap.xml with ${PAGES.length * 3} URL entries.`);
