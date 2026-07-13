import { test } from "node:test";
import assert from "node:assert/strict";
import { PAGES, LANGS, SITE_ORIGIN } from "./manifest.mjs";

test("PAGES has exactly 56 unique slugs and unique files", () => {
  assert.equal(PAGES.length, 56);
  assert.equal(new Set(PAGES.map((p) => p.slug)).size, 56);
  assert.equal(new Set(PAGES.map((p) => p.file)).size, 56);
});

test("every page has required sitemap fields", () => {
  for (const p of PAGES) {
    assert.ok(p.slug.startsWith("/"), `slug ${p.slug} must start with /`);
    assert.ok(/^\d\.\d$/.test(p.priority), `priority ${p.priority} must be like "0.8"`);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(p.lastmod), `lastmod ${p.lastmod} must be YYYY-MM-DD`);
    assert.ok(["always", "daily", "weekly", "monthly"].includes(p.changefreq));
  }
});

test("LANGS has en/ms/zh with correct hreflang and prefix", () => {
  assert.equal(LANGS.en.prefix, "");
  assert.equal(LANGS.en.hreflang, "en-MY");
  assert.equal(LANGS.ms.prefix, "/ms");
  assert.equal(LANGS.ms.hreflang, "ms-MY");
  assert.equal(LANGS.zh.prefix, "/zh");
  assert.equal(LANGS.zh.hreflang, "zh-Hans-MY");
  assert.equal(LANGS.zh.htmlLang, "zh-Hans");
});

test("SITE_ORIGIN has no trailing slash", () => {
  assert.equal(SITE_ORIGIN, "https://greatermalaysia.com");
});
