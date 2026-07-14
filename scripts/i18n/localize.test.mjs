import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pageSlugSet, rewriteUrl, rewriteInternalLinks, injectHreflang,
  insertLangSwitcher, applyNavFooterGlossary, setLangAttrs, localizePage,
} from "./localize.mjs";

test("rewriteUrl: prefixes a known page slug, root-relative", () => {
  const slugs = pageSlugSet();
  assert.equal(rewriteUrl("/road-tax", "/ms", slugs), "/ms/road-tax");
  assert.equal(rewriteUrl("/", "/ms", slugs), "/ms/");
  assert.equal(rewriteUrl("/stories/", "/zh", slugs), "/zh/stories/");
});

test("rewriteUrl: prefixes a known page slug, domain-absolute", () => {
  const slugs = pageSlugSet();
  assert.equal(
    rewriteUrl("https://greatermalaysia.com/road-tax", "/ms", slugs),
    "https://greatermalaysia.com/ms/road-tax"
  );
});

test("rewriteUrl: preserves anchor fragments", () => {
  const slugs = pageSlugSet();
  assert.equal(rewriteUrl("/#subscribe", "/ms", slugs), "/ms/#subscribe");
  assert.equal(
    rewriteUrl("https://greatermalaysia.com/waktu-solat/kuala-lumpur#page", "/zh", slugs),
    "https://greatermalaysia.com/zh/waktu-solat/kuala-lumpur#page"
  );
});

test("rewriteUrl: never rewrites the org/site JSON-LD identity anchors", () => {
  const slugs = pageSlugSet();
  assert.equal(rewriteUrl("https://greatermalaysia.com/#org", "/ms", slugs), "https://greatermalaysia.com/#org");
  assert.equal(rewriteUrl("https://greatermalaysia.com/#site", "/ms", slugs), "https://greatermalaysia.com/#site");
});

test("rewriteUrl: leaves shared assets, external links, and unknown paths untouched", () => {
  const slugs = pageSlugSet();
  assert.equal(rewriteUrl("/styles.css", "/ms", slugs), "/styles.css");
  assert.equal(rewriteUrl("/common.js", "/ms", slugs), "/common.js");
  assert.equal(rewriteUrl("/assets/favicon.ico", "/ms", slugs), "/assets/favicon.ico");
  assert.equal(rewriteUrl("/data/feed.json", "/ms", slugs), "/data/feed.json");
  assert.equal(rewriteUrl("/robots.txt", "/ms", slugs), "/robots.txt");
  assert.equal(rewriteUrl("https://x.com/aaronteng", "/ms", slugs), "https://x.com/aaronteng");
  assert.equal(rewriteUrl("https://t.me/GreaterMalaysia", "/ms", slugs), "https://t.me/GreaterMalaysia");
});

test("rewriteUrl: is a no-op for the English (empty) prefix", () => {
  const slugs = pageSlugSet();
  assert.equal(rewriteUrl("/road-tax", "", slugs), "/road-tax");
});

test("rewriteInternalLinks: rewrites href/src/content and JSON-LD url/@id in one pass", () => {
  const html = [
    '<link rel="canonical" href="https://greatermalaysia.com/road-tax" />',
    '<meta property="og:url" content="https://greatermalaysia.com/road-tax" />',
    '<meta property="og:image" content="https://greatermalaysia.com/assets/sharecard-road-tax.png" />',
    '<a href="/stories/malaysia-income-divide">x</a>',
    '<script src="/common.js"></script>',
    '{"@id":"https://greatermalaysia.com/#org","url":"https://greatermalaysia.com/road-tax"}',
  ].join("\n");
  const out = rewriteInternalLinks(html, { prefix: "/ms", slugSet: pageSlugSet() });
  assert.match(out, /canonical\" href="https:\/\/greatermalaysia\.com\/ms\/road-tax"/);
  assert.match(out, /og:url" content="https:\/\/greatermalaysia\.com\/ms\/road-tax"/);
  assert.match(out, /og:image" content="https:\/\/greatermalaysia\.com\/assets\/sharecard-road-tax\.png"/);
  assert.match(out, /href="\/ms\/stories\/malaysia-income-divide"/);
  assert.match(out, /src="\/common\.js"/);
  assert.match(out, /"@id":"https:\/\/greatermalaysia\.com\/#org"/);
  assert.match(out, /"url":"https:\/\/greatermalaysia\.com\/ms\/road-tax"/);
});

test("injectHreflang: inserts all 4 alternates right after canonical", () => {
  const html = '<title>x</title><link rel="canonical" href="https://greatermalaysia.com/road-tax" /><meta property="og:type" content="website" />';
  const out = injectHreflang(html, { slug: "/road-tax" });
  assert.match(out, /hreflang="en-MY" href="https:\/\/greatermalaysia\.com\/road-tax"/);
  assert.match(out, /hreflang="ms-MY" href="https:\/\/greatermalaysia\.com\/ms\/road-tax"/);
  assert.match(out, /hreflang="zh-Hans-MY" href="https:\/\/greatermalaysia\.com\/zh\/road-tax"/);
  assert.match(out, /hreflang="x-default" href="https:\/\/greatermalaysia\.com\/road-tax"/);
  assert.match(out, /canonical\" href="[^"]+"\s*\/><link rel="alternate" hreflang="en-MY"[^>]*\/><link rel="alternate" hreflang="ms-MY"[^>]*\/><link rel="alternate" hreflang="zh-Hans-MY"[^>]*\/><link rel="alternate" hreflang="x-default"[^>]*\/><meta property="og:type"/);
});

test("injectHreflang: throws if canonical tag is missing", () => {
  assert.throws(() => injectHreflang("<title>no canonical here</title>", { slug: "/road-tax" }));
});

test("injectHreflang: is idempotent (no double-insert on re-run)", () => {
  const html = '<link rel="canonical" href="https://greatermalaysia.com/road-tax" /><meta property="og:type" content="website" />';
  const once = injectHreflang(html, { slug: "/road-tax" });
  const twice = injectHreflang(once, { slug: "/road-tax" });
  assert.equal((twice.match(/hreflang=/g) || []).length, 4);
  assert.equal(once, twice);
});

test("insertLangSwitcher: inserts EN/BM/CN links after the nav CTA, before the burger button", () => {
  const html = '<nav class="nav-links"><a href="/tools">Tools</a></nav><a class="nav-cta" href="/#subscribe">Follow the channel</a><button class="nav-burger">x</button>';
  const out = insertLangSwitcher(html, { slug: "/road-tax", currentLangCode: "en" });
  assert.match(out, /<div class="nav-lang" aria-label="Language">/);
  assert.match(out, /<a href="\/road-tax" class="is-current" aria-current="true">EN<\/a>/);
  assert.match(out, /<a href="\/ms\/road-tax">BM<\/a>/);
  assert.match(out, /<a href="\/zh\/road-tax">CN<\/a>/);
  assert.ok(out.indexOf("nav-lang") > out.indexOf("Follow the channel"));
  assert.ok(out.indexOf("nav-lang") < out.indexOf("nav-burger"));
});

test("insertLangSwitcher: is idempotent (replaces an existing switcher, one only)", () => {
  const html = '<nav class="nav-links"></nav><a class="nav-cta" href="/#subscribe">Follow the channel</a><button class="nav-burger">x</button>';
  const once = insertLangSwitcher(html, { slug: "/road-tax", currentLangCode: "en" });
  const twice = insertLangSwitcher(once, { slug: "/road-tax", currentLangCode: "en" });
  assert.equal((twice.match(/class="nav-lang"/g) || []).length, 1);
  assert.equal(once, twice);
});

test("insertLangSwitcher: works on the site root slug", () => {
  const html = '<nav class="nav-links"></nav><a class="nav-cta" href="/#subscribe">Follow the channel</a><button class="nav-burger">x</button>';
  const out = insertLangSwitcher(html, { slug: "/", currentLangCode: "ms" });
  assert.match(out, /<a href="\/" >EN<\/a>|<a href="\/">EN<\/a>/);
  assert.match(out, /<a href="\/ms\/" class="is-current" aria-current="true">BM<\/a>/);
  assert.match(out, /<a href="\/zh\/">CN<\/a>/);
});

test("applyNavFooterGlossary: translates nav and footer boilerplate text nodes", () => {
  const html = '<a href="/tools">Tools</a><a href="/answers">Answers</a><div class="fc-h">Trust + machines</div><p class="foot-disclaimer">Independent and non-partisan. Every number links to its official primary source.</p>';
  const out = applyNavFooterGlossary(html, { langCode: "ms" });
  assert.match(out, />Alatan</);
  assert.match(out, />Jawapan</);
  assert.match(out, />Kepercayaan \+ mesin</);
  assert.match(out, />Bebas dan tidak berpihak\. Setiap angka dipautkan ke sumber rasmi asal\.</);
});

test("applyNavFooterGlossary: handles the split 'Follow the channel:' footer line", () => {
  const html = '<p class="foot-follow">Follow the channel: <a href="https://whatsapp.com/x">WhatsApp</a> · <a href="https://t.me/x">Telegram</a></p>';
  const out = applyNavFooterGlossary(html, { langCode: "zh" });
  assert.match(out, />关注频道:<a href="https:\/\/whatsapp\.com\/x">WhatsApp<\/a>/);
});

test("setLangAttrs: sets html lang and og:locale for each language", () => {
  const html = '<html lang="en"><head><meta property="og:locale" content="en_MY" /></head></html>';
  const ms = setLangAttrs(html, { langCode: "ms" });
  assert.match(ms, /<html lang="ms">/);
  assert.match(ms, /og:locale" content="ms_MY"/);
  const zh = setLangAttrs(html, { langCode: "zh" });
  assert.match(zh, /<html lang="zh-Hans">/);
  assert.match(zh, /og:locale" content="zh_CN"/);
});

test("setLangAttrs: rewrites every JSON-LD inLanguage code", () => {
  const html = '<html lang="en"><script>{"inLanguage": "en-MY"}</script><script>{"inLanguage":"en-MY"}</script></html>';
  const ms = setLangAttrs(html, { langCode: "ms" });
  assert.equal((ms.match(/"inLanguage":\s*"ms-MY"/g) || []).length, 2);
  assert.doesNotMatch(ms, /"en-MY"/);
  const zh = setLangAttrs(html, { langCode: "zh" });
  assert.equal((zh.match(/"inLanguage":\s*"zh-Hans-MY"/g) || []).length, 2);
});

test("localizePage: composes all transforms for a full ms page", () => {
  const html = [
    '<!doctype html><html lang="en"><head>',
    '<meta property="og:locale" content="en_MY" />',
    '<link rel="canonical" href="https://greatermalaysia.com/road-tax" />',
    '<meta property="og:url" content="https://greatermalaysia.com/road-tax" />',
    '</head><body>',
    '<header><nav class="nav-links"><a href="/tools">Tools</a></nav>',
    '<a class="nav-cta" href="/#subscribe">Follow the channel</a>',
    '<button class="nav-burger">x</button></header>',
    '<footer><div class="fc-h">Read</div></footer>',
    '</body></html>',
  ].join("");
  const out = localizePage(html, { langCode: "ms", slug: "/road-tax" });
  assert.match(out, /<html lang="ms">/);
  assert.match(out, /og:locale" content="ms_MY"/);
  assert.match(out, /canonical\" href="https:\/\/greatermalaysia\.com\/ms\/road-tax"/);
  assert.match(out, /og:url" content="https:\/\/greatermalaysia\.com\/ms\/road-tax"/);
  assert.match(out, /hreflang="zh-Hans-MY" href="https:\/\/greatermalaysia\.com\/zh\/road-tax"/);
  assert.match(out, />Alatan</);
  assert.match(out, />Bacaan</);
  assert.match(out, /nav-lang/);
});
