/* ============================================================
   Greater Malaysia — generic Data Story renderer
   Reads a provenance-rich JSON and builds the page + AEO schema.
   Reusable: point window.STORY_DATA_URL at any story JSON.
   ============================================================ */

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const rm = (n) => "RM" + Number(n).toLocaleString("en-MY");
function track(name, params = {}) { if (typeof window.gtag === "function") window.gtag("event", name, params); }

boot();

async function boot() {
  wireNav();
  let data;
  try {
    data = await (await fetch(window.STORY_DATA_URL)).json();
  } catch (e) {
    $("#storyRoot").innerHTML = `<p class="tool-err">Couldn't load this story's data.</p>`;
    return;
  }
  render(data);
  injectSchema(data);
}

function wireNav() {
  const nav = $("#nav");
  const onScroll = () => nav.classList.toggle("scrolled", (window.scrollY || document.documentElement.scrollTop) > 24);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

function render(d) {
  const s = d.source;
  const parts = [];

  // header
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

  // headline stats
  parts.push(`<div class="st-stats">${d.headline.map((h) => {
    const val = (h.prefix || "") + Number(h.value).toLocaleString("en-MY") + (h.suffix || "");
    return `<div class="st-stat">
      <div class="ss-val">${esc(val)}</div>
      <div class="ss-lab">${esc(h.label)}</div>
      <div class="ss-sub">${esc(h.sub || "")}</div>
      ${h.yoy != null ? `<div class="ss-yoy">▲ ${h.yoy}% vs 2023</div>` : ""}
      <div class="ss-cite">DOSM · p.${h.page}</div>
    </div>`;
  }).join("")}</div>`);

  // trend chart
  if (d.series.trend) parts.push(trendBlock(d.series.trend, s));

  // breakdown charts
  ["by_sex", "by_education", "by_sector"].forEach((k) => {
    if (d.series[k]) parts.push(breakdownBlock(d.series[k], s));
  });

  // takeaways
  if (d.takeaways?.length) parts.push(`
    <div class="st-takeaways">
      <h3>What it means</h3>
      <ul>${d.takeaways.map((t) => `<li>${linkBold(t)}</li>`).join("")}</ul>
    </div>`);

  // provenance block
  parts.push(provenanceBlock(s, d));

  // faq (AEO)
  if (d.faq?.length) parts.push(`
    <div class="st-faq">
      <h3>Frequently asked</h3>
      ${d.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}
    </div>`);

  // capture CTA
  parts.push(`
    <div class="st-capture">
      <div class="cap-k">stay in the know</div>
      <h3>Malaysia, decoded weekly</h3>
      <p>One email a week — the numbers that run the country, pulled straight from the source. No spam, unsubscribe anytime.</p>
      <form class="cap-form" id="capForm">
        <input type="email" id="capEmail" placeholder="you@email.com" required />
        <button type="submit">Get the brief</button>
      </form>
      <div class="cap-tiny">(demo — wire to your email provider when ready)</div>
    </div>`);

  $("#story").innerHTML = `<div id="storyRoot">${parts.join("")}</div>`;

  // footer source line
  $("#footerSrc").innerHTML = `Data verified from <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.publisher)}</a> — ${esc(s.document)}. Every figure traceable to the official release.`;

  // animate bars in + wire actions
  requestAnimationFrame(() => $$all(".hb-bar").forEach((b) => (b.style.width = b.dataset.w + "%")));
  $("#dlJson")?.addEventListener("click", () => { download(`${d.slug}.json`, JSON.stringify(d, null, 2), "application/json"); track("data_download", { story: d.slug, format: "json" }); });
  $("#dlCsv")?.addEventListener("click", () => { download(`${d.slug}.csv`, toCsv(d), "text/csv"); track("data_download", { story: d.slug, format: "csv" }); });
  const cf = $("#capForm");
  if (cf) cf.addEventListener("submit", (e) => { e.preventDefault(); track("lead_capture", { source: "data_story", story: d.slug }); toast("Thanks! (demo — connect your email tool to go live)"); cf.reset(); });
}

const $$all = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- trend: grouped vertical bars ---------- */
function trendBlock(t, src) {
  const rows = t.rows;
  const W = 720, H = 300, padL = 8, padR = 8, padT = 24, padB = 34;
  const max = Math.max(...rows.flatMap((r) => [r.median, r.mean])) * 1.08;
  const groupW = (W - padL - padR) / rows.length;
  const barW = Math.min(15, groupW * 0.32);
  const y = (v) => padT + (1 - v / max) * (H - padT - padB);

  let bars = "";
  rows.forEach((r, i) => {
    const cx = padL + groupW * i + groupW / 2;
    const x1 = cx - barW - 1, x2 = cx + 1;
    const isCovid = r.year === "2020";
    [["median", r.median, x1], ["mean", r.mean, x2]].forEach(([cls, v, x]) => {
      const by = y(v), bh = H - padB - by;
      bars += `<rect class="bar-${cls}" x="${x.toFixed(1)}" y="${by.toFixed(1)}" width="${barW}" height="${bh.toFixed(1)}" rx="1"/>`;
      bars += `<text class="bar-lab" x="${(x + barW / 2).toFixed(1)}" y="${(by - 3).toFixed(1)}" text-anchor="middle">${(v / 1000).toFixed(2)}k</text>`;
    });
    bars += `<text class="yr-lab" x="${cx.toFixed(1)}" y="${H - padB + 16}" text-anchor="middle">${r.year}</text>`;
    if (isCovid) bars += `<text class="covid" x="${cx.toFixed(1)}" y="${H - padB + 28}" text-anchor="middle">COVID dip</text>`;
  });

  return `<div class="st-chart">
    <h3>${esc(t.title)}</h3>
    <p class="ch-note">${esc(t.note)}</p>
    <div class="legend"><span><span class="sw sw-median"></span>Median</span><span><span class="sw sw-mean"></span>Mean</span></div>
    <svg class="trend-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(t.title)}">${bars}</svg>
    <div class="ch-cite">Source: ${esc(src.publisher)}, ${esc(src.document)}, p.${t.page} · ${esc(t.unit)}</div>
  </div>`;
}

/* ---------- breakdown: horizontal grouped bars ---------- */
function breakdownBlock(b, src) {
  const max = Math.max(...b.rows.flatMap((r) => [r.median, r.mean]));
  const rowsHtml = b.rows.map((r) => `
    <div class="hb">
      <div class="hb-top"><span class="hb-name">${esc(r.label)}</span>
        <span class="hb-vals">median ${rm(r.median)} · mean ${rm(r.mean)}</span></div>
      <div class="hb-track">
        <div class="hb-row"><span class="hb-tag">median</span><div class="hb-bar median" data-w="${(r.median / max * 100).toFixed(1)}" style="width:0"></div><span class="hb-amt">${rm(r.median)}</span></div>
        <div class="hb-row"><span class="hb-tag">mean</span><div class="hb-bar mean" data-w="${(r.mean / max * 100).toFixed(1)}" style="width:0"></div><span class="hb-amt">${rm(r.mean)}</span></div>
      </div>
    </div>`).join("");
  return `<div class="st-chart">
    <h3>${esc(b.title)}</h3>
    <p class="ch-note">${esc(b.note)}</p>
    <div class="hbars2">${rowsHtml}</div>
    <div class="ch-cite">Source: ${esc(src.publisher)}, ${esc(src.document)}, p.${b.page} · ${esc(b.unit)}</div>
  </div>`;
}

/* ---------- provenance ---------- */
function provenanceBlock(s, d) {
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
      <a class="prov-btn primary" href="${esc(s.url)}" target="_blank" rel="noopener">View official release ↗</a>
      <button class="prov-btn" id="dlJson">Download data (JSON)</button>
      <button class="prov-btn" id="dlCsv">Download data (CSV)</button>
    </div>
  </div>`;
}

/* ---------- AEO: JSON-LD (Dataset + FAQPage + Article) ---------- */
function injectSchema(d) {
  const s = d.source;
  const graph = [
    {
      "@type": "Dataset",
      "name": d.title + " — " + d.subtitle,
      "description": d.answer,
      "dateModified": d.updated,
      "creator": { "@type": "GovernmentOrganization", "name": s.publisher },
      "isBasedOn": s.url,
      "citation": `${s.publisher}, ${s.document} (${s.published})`,
      "license": s.license,
      "url": "https://greatermalaysia.com/stories/" + d.slug
    },
    {
      "@type": "FAQPage",
      "mainEntity": (d.faq || []).map((f) => ({
        "@type": "Question", "name": f.q,
        "acceptedAnswer": { "@type": "Answer", "text": f.a }
      }))
    },
    {
      "@type": "Article",
      "headline": d.title,
      "dateModified": d.updated,
      "publisher": { "@type": "Organization", "name": "Greater Malaysia" },
      "citation": { "@type": "CreativeWork", "name": s.document, "publisher": s.publisher, "url": s.url }
    }
  ];
  $("#ldjson").textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
}

/* ---------- helpers ---------- */
function linkBold(t) {
  // turn **bold** into <b> and RM figures stay as-is
  return esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}
function toCsv(d) {
  const lines = [["series", "label", "median_rm", "mean_rm", "source", "document", "page"]];
  const src = d.source;
  for (const [k, v] of Object.entries(d.series)) {
    const rows = v.rows || [];
    rows.forEach((r) => lines.push([k, r.label || r.year, r.median ?? "", r.mean ?? "", src.publisher, src.document, v.page]));
  }
  return lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}
function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("Downloaded " + name);
}
let toastT;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  setTimeout(() => t.classList.add("show"), 15);
  clearTimeout(toastT); toastT = setTimeout(() => { t.classList.remove("show"); setTimeout(() => (t.hidden = true), 320); }, 2200);
}
