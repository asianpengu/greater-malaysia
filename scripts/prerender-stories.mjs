/* ============================================================
   Greater Malaysia — story pre-renderer (no dependencies)

   Bakes each data story's full content + JSON-LD schema into its
   HTML file, so crawlers that don't run JS (GPTBot, ClaudeBot,
   PerplexityBot…) see the real page, not "Loading the data…".

   Usage:  node scripts/prerender-stories.mjs
   Run it after every edit to data/*.json (or to the render logic).
   Idempotent — safe to re-run; it replaces the previous bake.

   The HTML builders below MIRROR stories/story.js — if you change
   the markup there, change it here too, then re-run this script.
   ============================================================ */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ---------- helpers (mirrors common.js / story.js) ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const COLORS = { seal: "var(--seal)", blue: "#2563eb", gold: "var(--gold)", ink: "var(--ink)", green: "var(--up)", faint: "var(--ink-faint)" };
const num = (n) => Number(n).toLocaleString("en-MY");
const EMAIL_FIELD = "email_address";
function fmtVal(v, f) {
  if (f === "pct") return (Math.round(v * 10) / 10) + "%";
  if (f === "rm") return "RM" + num(v);
  if (f === "M") return (v / 1000).toFixed(2) + "M";
  return num(v);
}
function fmtBar(v, f) {
  if (f === "pct") return (Math.round(v * 10) / 10) + "%";
  if (f === "rm") return (v / 1000).toFixed(1) + "k";
  if (f === "M") return (v / 1000).toFixed(1) + "M";
  return num(v);
}
function metricsOf(s) {
  if (s.metrics) return s.metrics;
  const r = (s.rows || [])[0] || {};
  if ("median" in r && "mean" in r)
    return [{ key: "median", label: "Median", color: "seal", fmt: "rm" }, { key: "mean", label: "Mean", color: "blue", fmt: "rm" }];
  return [{ key: "value", label: s.valueLabel || "Value", color: "seal", fmt: s.fmt || "num" }];
}

/* ---------- related stories: same tag first, then most recent ---------- */
const STORY_INDEX = (() => { try { const raw = JSON.parse(readFileSync(join(ROOT, "data", "stories-index.json"), "utf8")); return Array.isArray(raw) ? raw : (raw.stories || []); } catch { return []; } })();
function relatedFor(slug) {
  const self = STORY_INDEX.find((x) => x.slug === slug) || {};
  const others = STORY_INDEX.filter((x) => x.slug !== slug);
  const sameTag = others.filter((x) => x.tag && self.tag && x.tag === self.tag);
  const rest = others.filter((x) => !(x.tag && self.tag && x.tag === self.tag));
  return [...sameTag, ...rest].slice(0, 3);
}
function readNextBlock(d) {
  const rel = relatedFor(d.slug);
  if (!rel.length) return "";
  return `<div class="st-related"><h3>Read next</h3><div class="st-related-grid">${rel.map((r) => `<a class="st-related-card" href="${esc(r.url)}"><span class="rc-tag">${esc(r.tag || "Data story")}</span><span class="rc-title">${esc(r.title)}</span><span class="rc-sub">${esc(r.subtitle || "")}</span></a>`).join("")}</div></div>`;
}

/* ---------- render (mirrors stories/story.js buildStory) ---------- */
function buildStory(d) {
  const s = d.source, parts = [];

  parts.push(`
    <div class="st-head">
      <div class="st-kicker">data story</div>
      <h1 class="st-title">${esc(d.title)}</h1>
      <p class="st-sub">${esc(d.subtitle)}</p>
      <p class="st-answer">${esc(d.answer)}</p>
      <div class="st-meta">
        <span class="src-pill">Source · <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.publisher)}</a></span>
        <span>${esc(s.document)}</span>
        <span>Updated ${esc(d.updated)}</span>
      </div>
    </div>
    <div class="st-rule"></div>`);

  parts.push(`<div class="st-stats">${d.headline.map((h) => {
    const val = (h.prefix || "") + (typeof h.value === "number" ? num(h.value) : esc(h.value)) + (h.suffix || "");
    return `<div class="st-stat">
      <div class="ss-val">${val}</div>
      <div class="ss-lab">${esc(h.label)}</div>
      <div class="ss-sub">${esc(h.sub || "")}</div>
      ${h.yoy != null ? `<div class="ss-yoy">${h.yoy >= 0 ? "▲" : "▼"} ${Math.abs(h.yoy)}%${h.yoyLabel ? " " + esc(h.yoyLabel) : ""}</div>` : ""}
      ${h.note ? `<div class="ss-cite">${esc(h.note)}</div>` : ""}
    </div>`;
  }).join("")}</div>`);

  if (d.series.trend) parts.push(chartBlock(d.series.trend, s, "vertical"));
  Object.keys(d.series).forEach((k) => {
    if (k === "trend") return;
    const layout = d.series[k].layout || "horizontal";
    parts.push(chartBlock(d.series[k], s, layout));
  });

  if (d.takeaways?.length) parts.push(`
    <div class="st-takeaways"><h3>What it means</h3>
      <ul>${d.takeaways.map((t) => `<li>${linkBold(t)}</li>`).join("")}</ul></div>`);

  parts.push(provenanceBlock(s));

  if (d.faq?.length) parts.push(`
    <div class="st-faq"><h3>Frequently asked</h3>
      ${d.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div>`);

  parts.push(readNextBlock(d));

  parts.push(`
    <div class="st-capture">
      <div class="cap-k">stay in the know</div>
      <h3>Malaysia, decoded monthly</h3>
      <p>One email a month, the numbers that run the country, pulled straight from the source. No spam, unsubscribe anytime.</p>
      <div class="gm-follow"><a class="wa" href="https://whatsapp.com/channel/0029VbDHuM159PwO04A3Mo2G" target="_blank" rel="noopener">Follow on WhatsApp</a><a class="tg" href="https://t.me/GreaterMalaysia" target="_blank" rel="noopener">Follow on Telegram</a></div><div class="gm-or">or by email</div><form class="cap-form" id="capForm">
        <input type="email" id="capEmail" name="${EMAIL_FIELD}" placeholder="you@email.com" required />
        <button type="submit">Get the brief</button>
      </form>
      <div class="cap-tiny">No spam. Unsubscribe anytime.</div>
    </div>`);

  return parts.join("");
}

function footerSrc(s) {
  return `Data verified from <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.publisher)}</a> · ${esc(s.document)}. Every figure traces back to the official source.`;
}

function legend(metrics) {
  return `<div class="legend">${metrics.map((m) => `<span><span class="sw" style="background:${COLORS[m.color] || m.color}"></span>${esc(m.label)}</span>`).join("")}</div>`;
}
function cite(s, b) { return `<div class="ch-cite">Source: ${esc(s.publisher)}, ${esc(s.document)}${b.ref ? " · " + esc(b.ref) : ""}${b.unit ? " · " + esc(b.unit) : ""}</div>`; }

function chartBlock(b, s, layout) {
  const metrics = metricsOf(b);
  const body = layout === "vertical" ? vBars(b, metrics) : hBars(b, metrics);
  return `<div class="st-chart">
    <h3>${esc(b.title)}</h3>
    ${b.note ? `<p class="ch-note">${esc(b.note)}</p>` : ""}
    ${metrics.length > 1 ? legend(metrics) : ""}
    ${body}
    ${cite(s, b)}
  </div>`;
}

function vBars(b, metrics) {
  const rows = b.rows, xKey = b.x || "year";
  const W = 720, H = 290, padL = 8, padR = 8, padT = 24, padB = b.highlight ? 42 : 30;
  const vals = rows.flatMap((r) => metrics.map((m) => +r[m.key]));
  const dataMax = Math.max(...vals), dataMin = Math.min(...vals);
  const top = (dataMax > 0 ? dataMax : 0) * 1.1 || 1;   // headroom above the tallest bar
  const bot = (dataMin < 0 ? dataMin : 0) * 1.12;        // room below zero when a bar is negative
  const span = (top - bot) || 1;
  const gW = (W - padL - padR) / rows.length;
  const bw = Math.min(16, (gW * 0.72) / metrics.length);
  const y = (v) => padT + (1 - (v - bot) / span) * (H - padT - padB);
  const yZero = y(0);                                     // baseline; == chart bottom when all values are >= 0
  let svg = "";
  rows.forEach((r, i) => {
    const cx = padL + gW * i + gW / 2;
    const total = bw * metrics.length + (metrics.length - 1) * 2;
    metrics.forEach((m, j) => {
      const x = cx - total / 2 + j * (bw + 2);
      const v = +r[m.key], yv = y(v), by = v >= 0 ? yv : yZero, bh = Math.abs(yv - yZero);
      svg += `<rect x="${x.toFixed(1)}" y="${by.toFixed(1)}" width="${bw}" height="${bh.toFixed(1)}" rx="1" fill="${COLORS[m.color] || m.color}"/>`;
      if (rows.length <= 18) svg += `<text class="bar-lab" x="${(x + bw / 2).toFixed(1)}" y="${(v >= 0 ? by - 3 : by + bh + 11).toFixed(1)}" text-anchor="middle">${fmtBar(v, m.fmt)}</text>`;
    });
    svg += `<text class="yr-lab" x="${cx.toFixed(1)}" y="${H - padB + 15}" text-anchor="middle">${esc(r[xKey])}</text>`;
    if (b.highlight && b.highlight.x === r[xKey]) svg += `<text class="covid" x="${cx.toFixed(1)}" y="${H - padB + 28}" text-anchor="middle">${esc(b.highlight.label)}</text>`;
  });
  return `<svg class="trend-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(b.title)}">${svg}</svg>`;
}

function hBars(b, metrics) {
  const max = Math.max(...b.rows.flatMap((r) => metrics.map((m) => +r[m.key])));
  const multi = metrics.length > 1;
  const rows = b.rows.map((r) => `
    <div class="hb">
      <div class="hb-top"><span class="hb-name">${esc(r.label)}</span>
        ${multi ? `<span class="hb-vals">${metrics.map((m) => `${esc(m.label.toLowerCase())} ${fmtVal(+r[m.key], m.fmt)}`).join(" · ")}</span>` : ``}</div>
      <div class="hb-track">
        ${metrics.map((m) => `<div class="hb-row">${multi ? `<span class="hb-tag">${esc(m.label.toLowerCase())}</span>` : ``}
          <div class="hb-bar" style="background:${COLORS[m.color] || m.color};width:0" data-w="${(+r[m.key] / max * 100).toFixed(1)}"></div>
          <span class="hb-amt">${fmtVal(+r[m.key], m.fmt)}</span></div>`).join("")}
      </div>
    </div>`).join("");
  return `<div class="hbars2">${rows}</div>`;
}

function provenanceBlock(s) {
  return `<div class="provenance">
    <dl class="prov-grid">
      <dt>Publisher</dt><dd>${esc(s.publisher)} <span style="color:var(--ink-faint)">· ${esc(s.publisher_type)}</span></dd>
      <dt>Document</dt><dd>${esc(s.document)}</dd>
      <dt>Published</dt><dd>${esc(s.published)}</dd>
      <dt>Source link</dt><dd><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url)}</a></dd>
      <dt>Retrieved</dt><dd>${esc(s.retrieved)}</dd>
      <dt>Coverage</dt><dd>${esc(s.notes)}</dd>
    </dl>
    <div class="prov-actions">
      <a class="prov-btn primary" href="${esc(s.url)}" target="_blank" rel="noopener">View official source ↗</a>
      <button class="prov-btn" id="dlJson">Download data (JSON)</button>
      <button class="prov-btn" id="dlCsv">Download data (CSV)</button>
    </div>
  </div>`;
}

function schemaOf(d) {
  const s = d.source;
  const graph = [
    { "@type": "Dataset", "name": d.title + ": " + d.subtitle, "description": d.answer, "dateModified": d.updated,
      "creator": { "@type": s.creator_type || "GovernmentOrganization", "name": s.publisher }, "isBasedOn": s.url,
      "citation": `${s.publisher}, ${s.document} (${s.published})`, "license": s.license,
      "url": "https://greatermalaysia.com/stories/" + d.slug },
    { "@type": "FAQPage", "mainEntity": (d.faq || []).map((f) => ({ "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } })) },
    { "@type": "Article", "headline": d.title, "dateModified": d.updated, "publisher": { "@type": "Organization", "name": "Greater Malaysia" },
      "citation": { "@type": "CreativeWork", "name": s.document, "publisher": s.publisher, "url": s.url } },
    { "@type": "BreadcrumbList", "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://greatermalaysia.com/" },
      { "@type": "ListItem", "position": 2, "name": "Data stories", "item": "https://greatermalaysia.com/stories/" },
      { "@type": "ListItem", "position": 3, "name": d.title, "item": "https://greatermalaysia.com/stories/" + d.slug }
    ] }
  ];
  return { "@context": "https://schema.org", "@graph": graph };
}

function linkBold(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); }

/* ---------- bake ---------- */
const storiesDir = join(ROOT, "stories");
const files = readdirSync(storiesDir).filter((f) => f.endsWith(".html") && f !== "index.html");
let baked = 0;

for (const file of files) {
  const path = join(storiesDir, file);
  let html = readFileSync(path, "utf8");

  const m = html.match(/window\.STORY_DATA_URL = "([^"]+)"/);
  if (!m) { console.warn(`skip ${file} — no STORY_DATA_URL`); continue; }
  const d = JSON.parse(readFileSync(join(ROOT, m[1]), "utf8"));

  const main = `<main class="story" id="story"><!-- pre-rendered by scripts/prerender-stories.mjs, do not edit by hand, edit ${m[1]} and re-run --><div id="storyRoot" data-prerendered="true">${buildStory(d)}</div></main>`;
  const ld = `<script type="application/ld+json" id="ldjson">${JSON.stringify(schemaOf(d)).replace(/</g, "\\u003c")}</script>`;
  const foot = `<p class="footer-sources" id="footerSrc">${footerSrc(d.source)}</p>`;

  const reMain = /<main class="story" id="story">[\s\S]*?<\/main>/;
  const reLd = /<script type="application\/ld\+json" id="ldjson">[\s\S]*?<\/script>/;
  const reFoot = /<p class="footer-sources" id="footerSrc">[\s\S]*?<\/p>/;
  if (!reMain.test(html) || !reLd.test(html)) {
    console.error(`FAIL ${file} — expected markers not found`); process.exitCode = 1; continue;
  }
  html = html.replace(reMain, main).replace(reLd, ld);
  if (reFoot.test(html)) html = html.replace(reFoot, foot); // footer sources line is static post-redesign; only bake if the legacy marker exists
  writeFileSync(path, html);
  baked++;
  console.log(`baked ${file} ← ${m[1]}`);
}
console.log(`${baked}/${files.length} story pages pre-rendered.`);
