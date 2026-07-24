/* ============================================================
   Greater Malaysia — generic Data Story renderer
   Reads a provenance-rich JSON and builds the page + AEO schema.
   Metric-driven: each series declares its own metrics/layout, so
   the same template renders any story. Reusable across all stories.

   Story pages are PRE-RENDERED at build time by
   scripts/prerender-stories.mjs (run `node scripts/prerender-stories.mjs`
   after editing data/*.json) so crawlers see the full content without
   JS. When #storyRoot[data-prerendered] is present this script only
   enhances: bar animation, downloads, signup — it never re-renders.
   The HTML-building functions below are duplicated in that script —
   keep them in sync.

   Shared helpers ($, $$, esc, fmt, jget, track, toast, wireNav…)
   live in /common.js — load it first.
   ============================================================ */

/* Email signup — Kit (ConvertKit) form. Empty endpoint = signup hidden. */
const EMAIL_ENDPOINT = "https://app.kit.com/forms/9628406/subscriptions";
const EMAIL_FIELD = "email_address";

const COLORS = { seal: "var(--seal)", blue: "#2563eb", gold: "var(--gold)", ink: "var(--ink)", green: "var(--up)", faint: "var(--ink-faint)" };
const num = (n) => Number(n).toLocaleString("en-MY");
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

boot();

async function boot() {
  wireNav();
  const pre = $("#storyRoot")?.dataset.prerendered === "true";
  let data;
  try { data = await jget(window.STORY_DATA_URL, 2, 36e5); }
  catch (e) {
    // never wipe pre-rendered content — only the downloads lose their data
    if (!pre) $("#storyRoot").innerHTML = `<p class="tool-err">Couldn't load this story's data.</p>`;
    return;
  }
  if (!pre) {
    $("#story").innerHTML = `<div id="storyRoot">${buildStory(data)}</div>`;
    $("#footerSrc").innerHTML = footerSrc(data.source);
    injectSchema(data);
  }
  wire(data);
}

/* ---------- render (pure HTML builders — mirrored in scripts/prerender-stories.mjs) ---------- */
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

  // render trend first (vertical), then every other series in declared order
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

  if (EMAIL_ENDPOINT) parts.push(`
    <div class="st-capture">
      <div class="cap-k">stay in the know</div>
      <h3>Malaysia, decoded weekly</h3>
      <p>One email a week, the numbers that run the country, pulled straight from the source. No spam, unsubscribe anytime.</p>
      <form class="cap-form" id="capForm">
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

/* ---------- wire (interactivity on rendered or pre-rendered DOM) ---------- */
function wire(d) {
  requestAnimationFrame(() => $$(".hb-bar").forEach((b) => (b.style.width = b.dataset.w + "%")));
  $("#dlJson")?.addEventListener("click", () => { download(`${d.slug}.json`, JSON.stringify(d, null, 2), "application/json"); track("data_download", { story: d.slug, format: "json" }); });
  $("#dlCsv")?.addEventListener("click", () => { download(`${d.slug}.csv`, toCsv(d), "text/csv"); track("data_download", { story: d.slug, format: "csv" }); });
  const cf = $("#capForm");
  if (cf) cf.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#capEmail").value.trim();
    if (!email) return;
    const btn = cf.querySelector("button"); btn.disabled = true; btn.textContent = "Subscribing…";
    try {
      const res = await fetch(EMAIL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ [EMAIL_FIELD]: email }),
      });
      if (!res.ok) throw new Error(res.status);
      track("lead_capture", { source: "data_story", story: d.slug });
      toast("You're in! Check your inbox to confirm 🇲🇾"); cf.reset();
    } catch (err) { toast("Hmm, that didn't work — try again."); }
    btn.disabled = false; btn.textContent = "Get the brief";
  });
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

/* vertical grouped bars (time series) */
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

/* horizontal grouped bars (breakdowns) */
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

function injectSchema(d) {
  $("#ldjson").textContent = JSON.stringify(schemaOf(d));
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
      "citation": { "@type": "CreativeWork", "name": s.document, "publisher": s.publisher, "url": s.url } }
  ];
  return { "@context": "https://schema.org", "@graph": graph };
}

function linkBold(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); }
function toCsv(d) {
  const s = d.source, lines = [["series", "label", "metric", "value", "source", "document", "ref"]];
  for (const [k, v] of Object.entries(d.series)) {
    const metrics = metricsOf(v);
    (v.rows || []).forEach((r) => metrics.forEach((m) =>
      lines.push([k, r.label || r[v.x || "year"], m.key, r[m.key] ?? "", s.publisher, s.document, v.ref || ""])));
  }
  return lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}
function download(name, text, type) {
  const blob = new Blob([text], { type }), a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast("Downloaded " + name);
}
