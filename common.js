/* ============================================================
   GREATER MALAYSIA — shared helpers
   Load this before app.js / today.js / answer.js / story.js.
   ============================================================ */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (n, d = 2) => Number(n).toLocaleString("en-MY", { minimumFractionDigits: d, maximumFractionDigits: d });
const debounce = (fn, ms = 160) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* current wall-clock time in Malaysia, as a Date usable with getHours() etc. */
const myNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));

/* GA4 custom events — fires only if gtag is present; deduped per name+params */
const _tracked = new Set();
function track(name, params = {}) {
  if (typeof window.gtag !== "function") return;
  const key = name + ":" + JSON.stringify(params);
  if (_tracked.has(key)) return; // once per session per event, avoid flooding
  _tracked.add(key);
  window.gtag("event", name, params);
}

/* fetch JSON with a 10s timeout, retry with backoff, and a sessionStorage
   TTL cache so repeat navigation doesn't re-hit rate-limited public APIs */
const jget = async (url, retries = 2, ttl = 60e3) => {
  const key = "gm:" + url;
  try {
    const hit = JSON.parse(sessionStorage.getItem(key));
    if (hit && Date.now() - hit.t < ttl) return hit.v;
  } catch (e) { /* no cache — fetch fresh */ }
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(10000) : undefined });
      if (!r.ok) throw new Error(r.status);
      const v = await r.json();
      try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v })); } catch (e) { /* quota / private mode */ }
      return v;
    } catch (e) {
      if (i >= retries) throw e;
      await sleep(500 + i * 600); // backoff on transient burst failures
    }
  }
};

/* nav turns solid once you scroll past the hero top, and wires the mobile sheet */
function wireNav() {
  const nav = $("#nav");
  if (nav && !nav._scrollWired) {
    nav._scrollWired = true;
    const onScroll = () => nav.classList.toggle("scrolled", (window.scrollY || document.documentElement.scrollTop) > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
  wireNavSheet();
}

/* mobile nav sheet: burger toggles body[data-nav-open], Escape closes, focus returns.
   Named wireNavSheet (not navSheet) to avoid colliding with the id="navSheet" element,
   which browsers expose as a global window.navSheet. */
function wireNavSheet() {
  const btn = $("#navBurger");
  if (!btn || btn._wired) return;
  btn._wired = true;
  const body = document.body;
  const isOpen = () => body.hasAttribute("data-nav-open");
  const close = () => { body.removeAttribute("data-nav-open"); btn.setAttribute("aria-expanded", "false"); btn.focus(); };
  const open = () => { body.setAttribute("data-nav-open", ""); btn.setAttribute("aria-expanded", "true"); const first = $("#navSheet a"); if (first) first.focus(); };
  btn.addEventListener("click", () => (isOpen() ? close() : open()));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen()) close(); });
  $$("#navSheet a").forEach((a) => a.addEventListener("click", close));
}

/* source-provenance chip. o = {name, kind:"LIVE API"|"DATASET", time, href} */
function srcChip(o) {
  o = o || {};
  const name = esc(o.name || "SUMBER");
  const kind = esc(o.kind || "LIVE API");
  const t = o.time ? " · CHECKED " + esc(o.time) : "";
  const attr = o.href ? ` href="${esc(o.href)}" target="_blank" rel="noopener"` : "";
  const tag = o.href ? "a" : "span";
  return `<${tag} class="src-chip"${attr}><span class="sc-check">✓</span>SUMBER: ${name} · ${kind}${t}${o.href ? ' <span class="sc-arr">↗</span>' : ""}</${tag}>`;
}

/* auto-init the nav on every page that loads common.js (idempotent, guarded) */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wireNav);
} else {
  wireNav();
}

/* sparkline SVG paths (area + line) */
function sparkline(vals, w, h) {
  const min = Math.min(...vals), max = Math.max(...vals), pad = 6;
  const rng = max - min || 1;
  const x = (i) => (i / (vals.length - 1)) * w;
  const y = (v) => pad + (1 - (v - min) / rng) * (h - pad * 2);
  const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return `<path class="area" d="${area}"/><path class="line" d="${line}"/>`;
}

let toastT;
function toast(msg) {
  const t = $("#toast"); if (!t) return;
  t.textContent = msg; t.hidden = false;
  setTimeout(() => t.classList.add("show"), 15);
  clearTimeout(toastT); toastT = setTimeout(() => { t.classList.remove("show"); setTimeout(() => (t.hidden = true), 320); }, 2000);
}

/* Share row (WhatsApp / Telegram / X / copy) on stories and answer pages.
   Inserted after the H1. Retries because story.js renders its title async. */
function wireShare() {
  if (document.querySelector(".gm-share")) return true;
  const h = document.querySelector(".st-title, .ans-h1");
  if (!h) return false;
  const url = (document.querySelector('link[rel="canonical"]') || {}).href || location.href.split("?")[0];
  const title = (document.querySelector('meta[property="og:title"]') || {}).content || document.title;
  const enc = encodeURIComponent;
  const wa = "https://wa.me/?text=" + enc(title + "\n" + url);
  const tg = "https://t.me/share/url?url=" + enc(url) + "&text=" + enc(title);
  const x = "https://twitter.com/intent/tweet?text=" + enc(title) + "&url=" + enc(url);
  const row = document.createElement("div");
  row.className = "gm-share";
  row.innerHTML =
    '<span class="gs-lab">Share</span>' +
    '<a class="gs-btn" href="' + wa + '" target="_blank" rel="noopener">WhatsApp</a>' +
    '<a class="gs-btn" href="' + tg + '" target="_blank" rel="noopener">Telegram</a>' +
    '<a class="gs-btn" href="' + x + '" target="_blank" rel="noopener">X</a>' +
    '<button class="gs-btn gs-copy" type="button">Copy link</button>';
  h.insertAdjacentElement("afterend", row);
  const copy = row.querySelector(".gs-copy");
  copy.addEventListener("click", function () {
    const done = function () { copy.textContent = "Copied"; setTimeout(function () { copy.textContent = "Copy link"; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(function () { fallbackCopy(url); done(); });
    } else { fallbackCopy(url); done(); }
  });
  return true;
}
function fallbackCopy(text) {
  const t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
  document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch (e) { /* ignore */ }
  document.body.removeChild(t);
}
(function () {
  let tries = 0;
  function go() { if (wireShare()) return; if (++tries < 14) setTimeout(go, 350); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
})();
