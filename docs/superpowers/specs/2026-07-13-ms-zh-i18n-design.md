# Malay + Mandarin i18n — design spec

Date: 2026-07-13
Status: approved for implementation, targeting staging push 2026-07-14

## Goal

Add Malay (`ms`) and Mandarin/Simplified Chinese (`zh`) versions of the site alongside the
existing English default, structured for maximum SEO/AEO/GEO effectiveness — i.e. legible
to Google/Bing crawlers, to AI answer engines (ChatGPT, Perplexity, Claude, Gemini) citing
pages directly, and to LLM-facing discovery files (`llms.txt`, `robots.txt`).

Scope decision (confirmed with user): translate **all 56 real pages**, AI-translated in one
pass, no native-speaker review before staging. This is an explicit, accepted trade-off —
speed over review — see Known risk below.

## Scope: which files

56 translatable pages, everything under the project root that Vercel actually serves:

- Root (19): `index.html`, `answers.html`, `companies.html`, `cuti-planner.html`,
  `cuti-umum-2026.html`, `for-agents.html`, `government-tender-malaysia.html`,
  `harga-minyak.html`, `household-income-by-state.html`,
  `how-to-check-voter-registration.html`, `how-to-start-a-business-in-malaysia.html`,
  `malaysia-for-digital-nomads.html`, `road-tax.html`, `stamp-duty.html`,
  `take-home-pay.html`, `today.html`, `tools.html`, `usd-to-myr.html`, `when-is-ge16.html`
- `election/` (1): `index.html`
- `explainers/` (8): `index.html`, `b40-m40-t20.html`, `epf-malaysia.html`,
  `government-procurement-malaysia.html`, `how-malaysian-elections-work.html`,
  `minimum-wage-malaysia.html`, `sst-malaysia.html`, `who-is-middle-class-in-malaysia.html`
- `stories/` (18): `index.html` + 17 individual data stories
- `waktu-solat/` (10): 10 city prayer-time pages

**Explicitly excluded** (already gitignored + vercelignored operator/internal tooling —
[[gm-operator-tooling-never-commit]]): `posting-kit.html`, `assets/sharecard-*.html`,
`assets/daily/*.html`, `data/daily-cards.json`. These never deploy in any language.

## URL structure

- **English = default, unprefixed.** `/`, `/road-tax`, `/stories/...` — unchanged, preserves
  existing backlinks and accumulated SEO equity.
- **Malay** under `/ms/` — same slugs, e.g. `/ms/road-tax`, `/ms/waktu-solat/kuala-lumpur`.
- **Mandarin** under `/zh/` — Simplified Chinese (`zh-Hans`), matching what Malaysia's
  Chinese-vernacular school system and Chinese-Malaysian press actually use (not
  Traditional). Same slugs, e.g. `/zh/road-tax`.
- Slugs are **identical across all three languages** — no translated slugs
  (`/ms/cukai-jalan`, etc). Simpler, avoids slug-mapping bugs and broken links, and
  hreflang carries the SEO signal, not the slug text. This is a deliberate scope cut given
  the one-day deadline.
- Subdirectories-on-one-domain (not subdomains, not ccTLDs) — consolidates domain
  authority instead of splitting it, and requires no new DNS/hosting setup. Works cleanly
  with the existing Vercel `cleanUrls: true` config with no rewrite changes needed, since
  `/ms/road-tax.html` is already served at `/ms/road-tax` by the same mechanism that
  serves `/road-tax.html` at `/road-tax` today.

## Per-page requirements

Every one of the 112 new files (56 pages × 2 languages) gets:

- `<html lang="ms">` / `<html lang="zh-Hans">`
- Translated `<title>`, meta description, OG/Twitter title+description
- Self-referential `<link rel="canonical">` pointing at its own localized URL (not back to
  English — each language version is canonical for itself)
- `hreflang` alternate links to all three versions plus `x-default`:
  ```html
  <link rel="alternate" hreflang="en-MY" href="https://greatermalaysia.com/road-tax" />
  <link rel="alternate" hreflang="ms-MY" href="https://greatermalaysia.com/ms/road-tax" />
  <link rel="alternate" hreflang="zh-Hans-MY" href="https://greatermalaysia.com/zh/road-tax" />
  <link rel="alternate" hreflang="x-default" href="https://greatermalaysia.com/road-tax" />
  ```
  This set is added to **all three** language versions of a page (each version lists
  itself plus its siblings), which is the pattern Google's documentation requires — a
  one-directional link from `/ms/` back to `/` isn't sufficient.
- Translated JSON-LD: `inLanguage` set to `ms-MY` / `zh-Hans-MY`, `name`/`description`
  fields translated. `@id` values stay pointed at the canonical org/site identity
  (`https://greatermalaysia.com/#org`), not forked per language.
- Translated visible content: nav links, footer, all headings/body copy/CTAs/tool labels
  and any static form copy.
- **Untouched, byte-identical to English**: script `src` references, API endpoints,
  `data-*` attributes read by JS, element `id`s and CSS classes, number formatting
  (`fmt()` in `common.js` stays on the `en-MY` `Intl.NumberFormat` locale — Malaysia uses
  the same digit grouping regardless of UI language, so this is correct as-is, not an
  oversight).

## Dynamic (JS-rendered) strings

A small set of user-facing strings are generated at runtime, not present in the static
HTML: loading states, fetch-error messages, and a few computed labels in `common.js`,
`app.js`, `today.js`, `answer.js`. These need a lookup table rather than per-file
duplication, since the same `.js` file is shared across all three language versions of a
page.

Add `assets/i18n.js` (or similar, exact filename decided at implementation time):
- One object keyed by the small set of runtime string keys needed (e.g. `loading`,
  `fetchError`, `retrying`), each with `en`/`ms`/`zh` values.
- A `t(key)` helper that reads `document.documentElement.lang` and returns the matching
  string, falling back to `en` if the key or language isn't found.
- Existing call sites in `common.js`/`app.js`/`today.js`/`answer.js` that currently
  hardcode an English string for these runtime states get swapped to call `t()`.

This is the only JavaScript logic change in this project. Everything else is static HTML
duplication — introducing a templating/build layer is explicitly out of scope for this
push (flagged as follow-up debt below).

## Language switcher

- Small **EN / BM / 中文** control added to the shared nav markup (which itself is
  duplicated per file today, so this gets added once per language's copy of the nav
  block, then propagated to every page in that language).
- Links to the same slug under the other prefix (e.g. on `/road-tax`, the BM link goes to
  `/ms/road-tax`, not to `/ms/`).
- **No automatic redirect based on `Accept-Language` or geo-IP.** Manual switch only. Auto-
  redirecting is what Google's own multilingual SEO guidance warns against — it can hide
  content from crawlers that don't send the expected header, and it overrides a user who
  deliberately opened an English link.
- Last-chosen language is remembered in `localStorage` and used only to decide which
  language link is visually emphasized on next visit to `/` — it never forces a redirect.

## Sitemap

Regenerate `sitemap.xml` to annotate each URL with its language siblings via
`xhtml:link rel="alternate" hreflang="..."`, e.g.:

```xml
<url>
  <loc>https://greatermalaysia.com/road-tax</loc>
  <xhtml:link rel="alternate" hreflang="en-MY" href="https://greatermalaysia.com/road-tax"/>
  <xhtml:link rel="alternate" hreflang="ms-MY" href="https://greatermalaysia.com/ms/road-tax"/>
  <xhtml:link rel="alternate" hreflang="zh-Hans-MY" href="https://greatermalaysia.com/zh/road-tax"/>
  <xhtml:link rel="alternate" hreflang="x-default" href="https://greatermalaysia.com/road-tax"/>
  <lastmod>2026-07-13</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.9</priority>
</url>
```

One multilingual sitemap (Google's documented format for this case), not three separate
sitemap files. Requires the `xmlns:xhtml` namespace declaration on `<urlset>`.

## robots.txt / llms.txt

- `robots.txt`: **no change.** The existing wildcard `Allow: /` for every listed crawler
  already covers `/ms/*` and `/zh/*`.
- `llms.txt`: stays English (the established convention for that file's audience) with one
  added line noting Malay and Mandarin versions of the site exist under `/ms/` and `/zh/`.
  Not forked into three versions — not worth the added maintenance for a machine-readable
  index.

## Known risk (explicitly accepted by user)

Translation is AI-generated in one pass with no native-speaker review before this hits
staging. Standard Malaysian civic/financial terminology will be used throughout, but
mistranslation risk is real and concentrated on pages with legal/financial specificity:
`stamp-duty`, `road-tax`, `take-home-pay`, `government-tender-malaysia`,
`how-to-check-voter-registration`. **Recommend a native-speaker pass on at least these five
pages before promoting staging → production.**

## Follow-up debt (not in scope for this push)

- No templating/build step was introduced — nav/footer/etc. remain hand-duplicated across
  now 3x as many files (56 → 168 total HTML files). Every future content or nav change
  needs to be applied in three places. Worth a shared-partial or static-site-generator
  refactor once past the immediate deadline.
- Translated URL slugs (e.g. `/ms/cukai-jalan`) were scoped out for time; could be revisited
  per-page for the highest-traffic tools if local keyword-matching in the URL turns out to
  matter empirically.
- No human/native-speaker review gate before staging (see Known risk above).
