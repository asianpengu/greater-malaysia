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

/* GA4 product events — bounded parameters only, never the user's data.
   live_card_result: page, card, status(fresh|cache|stale|error), cache_state, source.
   share_click: page, medium, personalized. */
function trackResult(card, status, cacheState, source, attempt) {
  const params = { page: location.pathname, card, status, cache_state: cacheState, source };
  if (attempt && attempt > 1) params.attempt = attempt;
  track("live_card_result", params);
}
function trackShare(medium, personalized) {
  track("share_click", { page: location.pathname, medium, personalized: !!personalized });
}

/* fetch JSON with a 10s timeout, retry with backoff, and a sessionStorage
   TTL cache so repeat navigation doesn't re-hit rate-limited public APIs.
   jgetMeta additionally reports when the value was fetched and where it came
   from ("network" | "session"), so cards can render honest freshness. */
async function jgetMeta(url, retries = 2, ttl = 60e3, options = {}) {
  const key = "gm:" + url;
  try {
    const hit = JSON.parse(sessionStorage.getItem(key));
    if (hit && Date.now() - hit.t < ttl) return { value: hit.v, fetchedAt: hit.t, cacheState: "session", stale: false };
  } catch (e) { /* no cache — fetch fresh */ }
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(10000) : undefined });
      if (!r.ok) throw new Error(r.status);
      const v = await r.json();
      const t = Date.now();
      try { sessionStorage.setItem(key, JSON.stringify({ t, v })); } catch (e) { /* quota / private mode */ }
      return { value: v, fetchedAt: t, cacheState: "network", stale: false };
    } catch (e) {
      if (i >= retries) throw e;
      await sleep(500 + i * 600); // backoff on transient burst failures
    }
  }
}
const jget = async (url, retries = 2, ttl = 60e3) => (await jgetMeta(url, retries, ttl)).value;

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

/* Resolve share text/link at click time. An optional page hook
   (window.GM_SHARE_PAYLOAD) supplies the values the user actually saw; when
   it is absent, returns nothing useful, or throws, we fall back to the page's
   canonical metadata. UTM tags stay on every link so GA attributes the click. */
function resolveShare(src, fallback) {
  let p = null;
  try {
    if (typeof window.GM_SHARE_PAYLOAD === "function") {
      const c = window.GM_SHARE_PAYLOAD();
      if (c && c.text && c.url) p = c;
    }
  } catch (e) { /* broken hook — use page metadata */ }
  const base = p ? p.url : fallback.url;
  const link = base + (base.indexOf("?") > -1 ? "&" : "?") + "utm_source=" + src + "&utm_medium=social&utm_campaign=share";
  const text = p ? (p.title ? p.title + "\n" + p.text : p.text) : fallback.title;
  return { link, text, personalized: !!(p && p.personalized) };
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
  const fallback = { url, title };
  const links = {
    whatsapp: (r) => "https://wa.me/?text=" + enc(r.text + "\n" + r.link),
    telegram: (r) => "https://t.me/share/url?url=" + enc(r.link) + "&text=" + enc(r.text),
    twitter: (r) => "https://twitter.com/intent/tweet?text=" + enc(r.text) + "&url=" + enc(r.link),
  };
  const row = document.createElement("div");
  row.className = "gm-share";
  row.innerHTML =
    '<span class="gs-lab">Share</span>' +
    '<a class="gs-btn" data-share="whatsapp" href="' + links.whatsapp(resolveShare("whatsapp", fallback)) + '" target="_blank" rel="noopener">WhatsApp</a>' +
    '<a class="gs-btn" data-share="telegram" href="' + links.telegram(resolveShare("telegram", fallback)) + '" target="_blank" rel="noopener">Telegram</a>' +
    '<a class="gs-btn" data-share="twitter" href="' + links.twitter(resolveShare("twitter", fallback)) + '" target="_blank" rel="noopener">X</a>' +
    '<button class="gs-btn gs-copy" type="button">Copy link</button>';
  h.insertAdjacentElement("afterend", row);
  // re-resolve at click time so the link carries the values currently on screen
  row.querySelectorAll("a[data-share]").forEach(function (a) {
    a.addEventListener("click", function () {
      const r = resolveShare(this.dataset.share, fallback);
      trackShare(this.dataset.share, r.personalized); // before opening the share target
      this.href = links[this.dataset.share](r);
    });
  });
  const copy = row.querySelector(".gs-copy");
  copy.addEventListener("click", function () {
    const done = function () { copy.textContent = "Copied"; setTimeout(function () { copy.textContent = "Copy link"; }, 1500); };
    // copy shares the URL only — share text must never leak into the link
    const r = resolveShare("copy_link", fallback);
    trackShare("copy_link", r.personalized); // before copying
    const link = r.link;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(done).catch(function () { fallbackCopy(link); done(); });
    } else { fallbackCopy(link); done(); }
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
