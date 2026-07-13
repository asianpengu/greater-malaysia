import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyPage, resolveLangAndSlug } from "./verify-i18n.mjs";

const GOOD_MS_PAGE = [
  '<html lang="ms"><head>',
  '<link rel="canonical" href="https://greatermalaysia.com/ms/road-tax" />',
  '<link rel="alternate" hreflang="en-MY" href="https://greatermalaysia.com/road-tax" />',
  '<link rel="alternate" hreflang="ms-MY" href="https://greatermalaysia.com/ms/road-tax" />',
  '<link rel="alternate" hreflang="zh-Hans-MY" href="https://greatermalaysia.com/zh/road-tax" />',
  '<link rel="alternate" hreflang="x-default" href="https://greatermalaysia.com/road-tax" />',
  '</head><body><a href="/ms/tools">Alatan</a></body></html>',
].join("");

test("verifyPage: passes a correctly-structured ms page", () => {
  assert.deepEqual(verifyPage(GOOD_MS_PAGE, { langCode: "ms", slug: "/road-tax" }), []);
});

test("verifyPage: flags a missing lang attribute", () => {
  const html = GOOD_MS_PAGE.replace('lang="ms"', 'lang="en"');
  const problems = verifyPage(html, { langCode: "ms", slug: "/road-tax" });
  assert.ok(problems.some((p) => p.includes("lang")));
});

test("verifyPage: flags a wrong hreflang count", () => {
  const html = GOOD_MS_PAGE.replace('<link rel="alternate" hreflang="x-default" href="https://greatermalaysia.com/road-tax" />', "");
  const problems = verifyPage(html, { langCode: "ms", slug: "/road-tax" });
  assert.ok(problems.some((p) => p.includes("hreflang")));
});

test("verifyPage: flags a non-self-referential canonical", () => {
  const html = GOOD_MS_PAGE.replace(
    '<link rel="canonical" href="https://greatermalaysia.com/ms/road-tax" />',
    '<link rel="canonical" href="https://greatermalaysia.com/road-tax" />'
  );
  const problems = verifyPage(html, { langCode: "ms", slug: "/road-tax" });
  assert.ok(problems.some((p) => p.includes("canonical")));
});

test("verifyPage: flags leftover untranslated nav/footer glossary text on a non-English page", () => {
  const html = GOOD_MS_PAGE.replace(">Alatan<", ">Tools<");
  const problems = verifyPage(html, { langCode: "ms", slug: "/road-tax" });
  assert.ok(problems.some((p) => p.includes("Tools")));
});

test("verifyPage: flags leftover en-MY JSON-LD inLanguage on a non-English page", () => {
  const html = GOOD_MS_PAGE.replace("</body>", '<script type="application/ld+json">{"inLanguage":"en-MY"}</script></body>');
  const problems = verifyPage(html, { langCode: "ms", slug: "/road-tax" });
  assert.ok(problems.some((p) => p.includes("inLanguage")));
});

test("verifyPage: does not require glossary/inLanguage checks on English pages", () => {
  const html = [
    '<html lang="en"><head>',
    '<link rel="canonical" href="https://greatermalaysia.com/road-tax" />',
    '<link rel="alternate" hreflang="en-MY" href="https://greatermalaysia.com/road-tax" />',
    '<link rel="alternate" hreflang="ms-MY" href="https://greatermalaysia.com/ms/road-tax" />',
    '<link rel="alternate" hreflang="zh-Hans-MY" href="https://greatermalaysia.com/zh/road-tax" />',
    '<link rel="alternate" hreflang="x-default" href="https://greatermalaysia.com/road-tax" />',
    '</head><body><a href="/tools">Tools</a></body></html>',
  ].join("");
  assert.deepEqual(verifyPage(html, { langCode: "en", slug: "/road-tax" }), []);
});

test("resolveLangAndSlug: resolves ms/zh and plain English paths", () => {
  assert.deepEqual(resolveLangAndSlug("ms/road-tax.html"), { langCode: "ms", slug: "/road-tax" });
  assert.deepEqual(resolveLangAndSlug("zh/stories/index.html"), { langCode: "zh", slug: "/stories/" });
  assert.deepEqual(resolveLangAndSlug("road-tax.html"), { langCode: "en", slug: "/road-tax" });
});

test("resolveLangAndSlug: throws on an unknown file", () => {
  assert.throws(() => resolveLangAndSlug("ms/not-a-real-page.html"));
});
