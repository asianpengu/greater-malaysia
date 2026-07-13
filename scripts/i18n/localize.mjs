import { PAGES, LANGS, SITE_ORIGIN } from "./manifest.mjs";
import { GLOSSARY } from "./glossary.mjs";

export function pageSlugSet() {
  return new Set(PAGES.map((p) => p.slug));
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Rewrites a single URL/path string to its language-prefixed form, if (and
// only if) it points at a known page slug. Shared assets, external links,
// and the JSON-LD org/site identity anchors (#org, #site) are left alone.
export function rewriteUrl(raw, prefix, slugSet) {
  if (!prefix) return raw; // English is unprefixed — never rewrite
  const domainMatch = raw.match(/^(https:\/\/greatermalaysia\.com)(\/.*)?$/);
  let domain = "";
  let rest = raw;
  if (domainMatch) {
    domain = domainMatch[1];
    rest = domainMatch[2] || "/";
  } else if (!raw.startsWith("/")) {
    return raw; // external URL (https://x.com/..., mailto:, etc.)
  }
  const hashIndex = rest.indexOf("#");
  const withoutHash = hashIndex === -1 ? rest : rest.slice(0, hashIndex);
  const base = withoutHash.split("?")[0];
  const fragment = hashIndex === -1 ? "" : rest.slice(hashIndex);
  if (fragment === "#org" || fragment === "#site") return raw;
  if (!slugSet.has(base)) return raw;
  return `${domain}${prefix}${rest}`;
}

// Rewrites every href="", src="", content="" attribute and every JSON-LD
// "url":"..." / "@id":"..." field that points at a known internal page.
export function rewriteInternalLinks(html, { prefix, slugSet }) {
  if (!prefix) return html;
  let out = html.replace(/(href|src|content)="([^"]*)"/g, (m, attr, val) => `${attr}="${rewriteUrl(val, prefix, slugSet)}"`);
  out = out.replace(/"(url|@id)":"([^"]*)"/g, (m, key, val) => `"${key}":"${rewriteUrl(val, prefix, slugSet)}"`);
  return out;
}

// Inserts hreflang alternate links (en/ms/zh + x-default) immediately after
// the page's <link rel="canonical"> tag. Idempotent: strips any existing
// alternate-hreflang links first, so re-running against an already-processed
// source doesn't double-insert.
export function injectHreflang(html, { slug }) {
  let out = html.replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*"\s*\/>/g, "");
  const canonicalRe = /(<link rel="canonical" href="[^"]+"\s*\/>)/;
  if (!canonicalRe.test(out)) throw new Error("injectHreflang: canonical link not found");
  const alt = ["en", "ms", "zh"]
    .map((code) => `<link rel="alternate" hreflang="${LANGS[code].hreflang}" href="${SITE_ORIGIN}${LANGS[code].prefix}${slug}" />`)
    .join("");
  const xdefault = `<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${slug}" />`;
  return out.replace(canonicalRe, `$1${alt}${xdefault}`);
}

// Inserts the EN / BM / 中文 language switcher between the "Follow the
// channel" nav CTA and the mobile burger button. Matches structurally (not
// on the CTA's href value) so it works whether or not rewriteInternalLinks
// has already run.
export function insertLangSwitcher(html, { slug, currentLangCode }) {
  // Idempotent: remove any switcher a prior run left, so re-processing an
  // already-switched source replaces it rather than choking on the anchor.
  html = html.replace(/<div class="nav-lang"[^>]*>[\s\S]*?<\/div>/, "");
  const anchorRe = /(<\/nav>\s*<a class="nav-cta"[^>]*>Follow the channel<\/a>\s*)(<button class="nav-burger")/;
  if (!anchorRe.test(html)) throw new Error("insertLangSwitcher: nav CTA anchor not found");
  const items = ["en", "ms", "zh"]
    .map((code) => {
      const lang = LANGS[code];
      const href = `${lang.prefix}${slug}`;
      const current = code === currentLangCode ? ' class="is-current" aria-current="true"' : "";
      return `<a href="${href}"${current}>${lang.label}</a>`;
    })
    .join("");
  const block = `<div class="nav-lang" aria-label="Language">${items}</div>`;
  return html.replace(anchorRe, `$1${block}$2`);
}

// Translates every fixed nav/footer boilerplate text node using GLOSSARY.
// Every key except footFollowPrefix is matched as a whole `>text<` node;
// footFollowPrefix matches the `>text<a` prefix before the WhatsApp link
// since that footer line is split across anchor tags in the real markup.
export function applyNavFooterGlossary(html, { langCode }) {
  let out = html;
  for (const [key, entry] of Object.entries(GLOSSARY)) {
    const target = entry[langCode];
    if (key === "footFollowPrefix") {
      out = out.replace(new RegExp(`>${escapeRegExp(entry.en)}<a`, "g"), `>${target}<a`);
      continue;
    }
    out = out.replace(new RegExp(`>${escapeRegExp(entry.en)}<`, "g"), `>${target}<`);
  }
  return out;
}

// Sets the mechanical language markers: <html lang="...">, og:locale, and
// every JSON-LD "inLanguage":"en-MY" (these are codes, not prose — they get
// set here during skeleton generation so translators never touch them).
export function setLangAttrs(html, { langCode }) {
  const lang = LANGS[langCode];
  let out = html.replace(/<html lang="en">/, `<html lang="${lang.htmlLang}">`);
  out = out.replace(/(og:locale" content=")en_MY(")/, `$1${lang.ogLocale}$2`);
  out = out.replace(/("inLanguage":\s*")en-MY(")/g, `$1${lang.hreflang}$2`);
  return out;
}

// Composes every mechanical transform, in the one order that's safe:
// 1. rewrite existing links while nav/footer text is still English
// 2. insert the switcher (structural match, unaffected by step 1)
// 3. translate nav/footer boilerplate (after the switcher anchor is used)
// 4. inject hreflang (independent of all of the above, computed from slug)
// 5. set <html lang> + og:locale
export function localizePage(html, { langCode, slug }) {
  const prefix = LANGS[langCode].prefix;
  let out = rewriteInternalLinks(html, { prefix, slugSet: pageSlugSet() });
  out = insertLangSwitcher(out, { slug, currentLangCode: langCode });
  out = applyNavFooterGlossary(out, { langCode });
  out = injectHreflang(out, { slug });
  out = setLangAttrs(out, { langCode });
  return out;
}
