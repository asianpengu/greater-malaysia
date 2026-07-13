import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PAGES, LANGS, SITE_ORIGIN } from "./i18n/manifest.mjs";
import { GLOSSARY } from "./i18n/glossary.mjs";

export function verifyPage(html, { langCode, slug }) {
  const problems = [];
  const lang = LANGS[langCode];

  if (!html.includes(`<html lang="${lang.htmlLang}">`)) {
    problems.push(`missing <html lang="${lang.htmlLang}">`);
  }

  const hreflangCount = (html.match(/hreflang=/g) || []).length;
  if (hreflangCount !== 4) problems.push(`expected 4 hreflang links, found ${hreflangCount}`);

  const expectedCanonical = `${SITE_ORIGIN}${lang.prefix}${slug}`;
  if (!html.includes(`<link rel="canonical" href="${expectedCanonical}"`)) {
    problems.push(`canonical is not self-referential (expected ${expectedCanonical})`);
  }

  if (langCode !== "en") {
    for (const [key, entry] of Object.entries(GLOSSARY)) {
      if (key === "footFollowPrefix") continue; // not present on every page, checked separately if needed
      if (entry.en === entry[langCode]) continue; // e.g. "Waktu solat" is identical in en/ms
      if (html.includes(`>${entry.en}<`)) {
        problems.push(`leftover untranslated glossary string "${entry.en}" (key ${key})`);
      }
    }
    if (/"inLanguage":\s*"en-MY"/.test(html)) {
      problems.push("JSON-LD inLanguage still says en-MY");
    }
  }

  return problems;
}

export function resolveLangAndSlug(filePath) {
  for (const code of ["ms", "zh"]) {
    const prefix = code + "/";
    if (filePath.startsWith(prefix)) {
      const rest = filePath.slice(prefix.length);
      const page = PAGES.find((p) => p.file === rest);
      if (!page) throw new Error(`resolveLangAndSlug: no manifest entry for ${rest}`);
      return { langCode: code, slug: page.slug };
    }
  }
  const page = PAGES.find((p) => p.file === filePath);
  if (!page) throw new Error(`resolveLangAndSlug: no manifest entry for ${filePath}`);
  return { langCode: "en", slug: page.slug };
}

// Compare decoded paths (not raw file:// URLs) so a project path with spaces still matches.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: node scripts/verify-i18n.mjs <file1> <file2> ...");
    process.exit(1);
  }
  let failCount = 0;
  for (const filePath of files) {
    const { langCode, slug } = resolveLangAndSlug(filePath);
    const html = readFileSync(filePath, "utf8");
    const problems = verifyPage(html, { langCode, slug });
    if (problems.length) {
      failCount++;
      console.log(`FAIL ${filePath}`);
      for (const p of problems) console.log(`  - ${p}`);
    } else {
      console.log(`PASS ${filePath}`);
    }
  }
  process.exit(failCount ? 1 : 0);
}
