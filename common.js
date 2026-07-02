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

/* nav turns solid once you scroll past the hero top */
function wireNav() {
  const nav = $("#nav");
  if (!nav) return;
  const onScroll = () => nav.classList.toggle("scrolled", (window.scrollY || document.documentElement.scrollTop) > 24);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
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
