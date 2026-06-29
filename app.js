/* ============================================================
   GREATER MALAYSIA — live tools on the nation's open data
   Vanilla JS · fetches real public APIs in the browser
   ============================================================ */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (n, d = 2) => Number(n).toLocaleString("en-MY", { minimumFractionDigits: d, maximumFractionDigits: d });
const debounce = (fn, ms = 160) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* GA4 custom events — fires only if gtag is present; deduped per name+key */
const _tracked = new Set();
function track(name, params = {}) {
  if (typeof window.gtag !== "function") return;
  const key = name + ":" + (params.tool || params.network || params.pair || params.to || "");
  if (_tracked.has(key)) return; // once per session per tool, avoid flooding
  _tracked.add(key);
  window.gtag("event", name, params);
}
const jget = async (url, retries = 2) => {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) {
      if (i >= retries) throw e;
      await sleep(500 + i * 600); // backoff on transient burst failures
    }
  }
};

/* Malaysian cities (lat/lon) for weather + air */
const CITIES = [
  { name: "Kuala Lumpur", lat: 3.139, lon: 101.687 },
  { name: "George Town", lat: 5.414, lon: 100.329 },
  { name: "Johor Bahru", lat: 1.493, lon: 103.741 },
  { name: "Ipoh", lat: 4.597, lon: 101.09 },
  { name: "Kuching", lat: 1.553, lon: 110.359 },
  { name: "Kota Kinabalu", lat: 5.98, lon: 116.073 },
  { name: "Malacca", lat: 2.196, lon: 102.25 },
  { name: "Kuala Terengganu", lat: 5.331, lon: 103.137 },
];

/* JAKIM e-solat zones (curated, major areas) */
const ZONES = [
  { code: "WLY01", name: "Kuala Lumpur / Putrajaya" },
  { code: "SGR01", name: "Selangor (Gombak, Petaling…)" },
  { code: "JHR02", name: "Johor (Johor Bahru, Kota Tinggi)" },
  { code: "PNG01", name: "Pulau Pinang" },
  { code: "PRK02", name: "Perak (Ipoh, Batu Gajah)" },
  { code: "MLK01", name: "Melaka" },
  { code: "NGS01", name: "Negeri Sembilan (Seremban)" },
  { code: "PHG02", name: "Pahang (Kuantan)" },
  { code: "KDH01", name: "Kedah (Kota Setar)" },
  { code: "KTN01", name: "Kelantan (Kota Bharu)" },
  { code: "TRG01", name: "Terengganu (Kuala Terengganu)" },
  { code: "SBH07", name: "Sabah (Kota Kinabalu)" },
  { code: "SWK08", name: "Sarawak (Kuching)" },
  { code: "PLS01", name: "Perlis (Kangar)" },
];

const PRAYERS = [
  { key: "imsak", label: "Imsak" },
  { key: "fajr", label: "Subuh" },
  { key: "syuruk", label: "Syuruk" },
  { key: "dhuhr", label: "Zohor" },
  { key: "asr", label: "Asar" },
  { key: "maghrib", label: "Maghrib" },
  { key: "isha", label: "Isyak" },
];

const WX = {
  0: ["☀️", "Clear"], 1: ["🌤", "Mainly clear"], 2: ["⛅", "Partly cloudy"], 3: ["☁️", "Overcast"],
  45: ["🌫", "Fog"], 48: ["🌫", "Rime fog"], 51: ["🌦", "Light drizzle"], 53: ["🌦", "Drizzle"], 55: ["🌧", "Heavy drizzle"],
  61: ["🌦", "Light rain"], 63: ["🌧", "Rain"], 65: ["🌧", "Heavy rain"], 80: ["🌦", "Showers"], 81: ["🌧", "Showers"], 82: ["⛈", "Violent showers"],
  95: ["⛈", "Thunderstorm"], 96: ["⛈", "Storm + hail"], 99: ["⛈", "Storm + hail"],
};
const wxOf = (c) => WX[c] || ["🌡", "—"];

/* ============================================================
   BOOT
   ============================================================ */
const tickerData = {};
boot();

function boot() {
  startClock();
  wireNav();
  setupReveal();
  // populate selects
  $("#prayerZone").innerHTML = ZONES.map((z) => `<option value="${z.code}">${esc(z.name)}</option>`).join("");
  $("#wxCity").innerHTML = CITIES.map((c, i) => `<option value="${i}">${esc(c.name)}</option>`).join("");
  $("#prayerZone").addEventListener("change", (e) => { loadPrayer(e.target.value); track("tool_use", { tool: "waktu_solat", zone: e.target.value }); });
  $("#wxCity").addEventListener("change", (e) => { loadWeather(+e.target.value); track("tool_use", { tool: "cuaca_udara", city: CITIES[+e.target.value]?.name }); });

  // engagement events
  $(".hero-pengu")?.addEventListener("click", () => track("social_click", { network: "instagram", placement: "hero_mascot" }));
  $$('a[href="#tools"], a[href="stories/"]').forEach((a) =>
    a.addEventListener("click", () => track("nav_click", { to: a.getAttribute("href") }))
  );

  // load tools staggered by host, so we never burst a single rate-limited API
  // (CoinGecko / Pasar are the touchiest, so they go later & spaced out)
  loadPrayer("WLY01");                        // JAKIM
  loadFuel();                                 // data.gov.my
  setTimeout(() => loadFX("USD"), 200);       // frankfurter (2 calls)
  setTimeout(() => loadPopulation(), 450);    // data.gov.my
  setTimeout(() => loadWeather(0), 700);      // open-meteo (2 calls)
  setTimeout(() => loadInflation(), 1000);    // data.gov.my
  setTimeout(() => loadWarnings(), 1300);     // data.gov.my (2 calls)
  setTimeout(() => loadCrypto(), 1700);       // coingecko
  setTimeout(() => loadSourceCount(), 2100);  // pasar (trust band, secondary)
}

/* ---------- clock ---------- */
function startClock() {
  const el = $("#heroClock");
  const tick = () => {
    const now = new Date();
    const my = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));
    el.textContent = my.toLocaleTimeString("en-GB", { hour12: false });
  };
  tick(); setInterval(tick, 1000);
}

/* nav turns solid once you scroll past the hero top */
function wireNav() {
  const nav = $("#nav");
  const onScroll = () => nav.classList.toggle("scrolled", (window.scrollY || document.documentElement.scrollTop) > 24);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* ============================================================
   1. PRAYER TIMES — JAKIM e-Solat
   ============================================================ */
async function loadPrayer(zone) {
  const body = $("#prayerBody");
  body.innerHTML = `<div class="tool-loading">Fetching prayer times…</div>`;
  try {
    const url = `https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=today&zone=${zone}`;
    const data = await jget(url);
    const t = data.prayerTime?.[0];
    if (!t) throw new Error("no data");

    const toMin = (hms) => { const [h, m] = hms.split(":").map(Number); return h * 60 + m; };
    const nowMy = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));
    const nowMin = nowMy.getHours() * 60 + nowMy.getMinutes();

    const main = PRAYERS.filter((p) => !["imsak", "syuruk", "dhuha"].includes(p.key) || p.key === "syuruk");
    // determine next prayer among the 5 daily + syuruk
    const seq = ["fajr", "syuruk", "dhuhr", "asr", "maghrib", "isha"];
    let nextKey = null, activeKey = null;
    for (const k of seq) { if (toMin(t[k]) > nowMin) { nextKey = k; break; } }
    for (let i = seq.length - 1; i >= 0; i--) { if (toMin(t[seq[i]]) <= nowMin) { activeKey = seq[i]; break; } }
    const nextDef = PRAYERS.find((p) => p.key === nextKey);

    let countdown = "";
    if (nextKey) {
      let diff = toMin(t[nextKey]) - nowMin;
      const h = Math.floor(diff / 60), m = diff % 60;
      countdown = h > 0 ? `${h}j ${m}m` : `${m}m`;
    }

    tickerData.prayer = nextDef ? { label: nextDef.label, time: t[nextKey].slice(0, 5), cd: countdown } : null;
    rebuildTicker();

    const rows = PRAYERS.filter((p) => p.key !== "dhuha")
      .map((p) => {
        const isActive = p.key === activeKey;
        return `<div class="prayer-row ${isActive ? "active" : ""}">
          <span class="pr-name"><span class="pr-dot"></span>${p.label}</span>
          <span class="pr-time">${esc(t[p.key].slice(0, 5))}</span>
        </div>`;
      })
      .join("");

    body.innerHTML = `
      <div class="prayer-hijri">${esc(t.hijri)} · ${esc(t.date)}</div>
      ${nextKey ? `<div class="prayer-next">
        <div><div class="pn-lab">${esc(nextDef.label)}</div><div class="pn-name">next prayer · ${esc(t[nextKey].slice(0, 5))}</div></div>
        <div class="pn-cd">${esc(countdown)}</div>
      </div>` : ""}
      <div class="prayer-list">${rows}</div>`;
  } catch (e) {
    body.innerHTML = `<div class="tool-err">Couldn't reach JAKIM e-Solat. Retry shortly.</div>`;
  }
}

/* ============================================================
   2. FUEL PRICES — data.gov.my
   ============================================================ */
async function loadFuel() {
  const body = $("#fuelBody");
  try {
    const rows = await jget("https://api.data.gov.my/data-catalogue/?id=fuelprice&limit=6&sort=-date");
    const level = rows.find((r) => r.series_type === "level");
    const change = rows.find((r) => r.series_type === "change_weekly");
    if (!level) throw new Error("no data");

    const cells = [
      { name: "RON95", price: level.ron95_skps ?? level.ron95, chg: change?.ron95, sub: "ceiling" },
      { name: "RON97", price: level.ron97, chg: change?.ron97 },
      { name: "Diesel", price: level.diesel, chg: change?.diesel },
    ];
    tickerData.fuel = { ron97: level.ron97, diesel: level.diesel };
    rebuildTicker();

    const chgHtml = (c) => {
      if (c == null || Math.abs(c) < 0.005) return `<span class="fc-chg flat-c">— no change</span>`;
      const up = c > 0;
      return `<span class="fc-chg ${up ? "down-c" : "up-c"}">${up ? "▲" : "▼"} ${fmt(Math.abs(c), 2)}</span>`;
    };
    body.innerHTML = `
      <div class="fuel-week">Week of ${esc(level.date)} · RM / litre</div>
      <div class="fuel-grid">
        ${cells.map((c) => `<div class="fuel-cell">
          <div class="fc-name">${c.name}</div>
          <div class="fc-price">${fmt(c.price, 2)}</div>
          <div class="fc-unit">RM / L${c.sub ? " · " + c.sub : ""}</div>
          ${chgHtml(c.chg)}
        </div>`).join("")}
      </div>
      <div class="calc">
        <div class="calc-fuelsel" id="fuelSel">${cells.map((c, i) => `<button data-p="${c.price}" class="${i === 1 ? "active" : ""}">${c.name}</button>`).join("")}</div>
        <div class="calc-row" style="margin-top:10px">
          <label>Fill</label>
          <input type="range" id="fuelLitres" min="5" max="80" value="40" step="1" />
          <span class="calc-out" id="fuelCost">RM —</span>
        </div>
        <div class="fuel-note" id="fuelCalcNote"></div>
      </div>`;

    let fuelPrice = cells[1].price; // RON97 default
    const recalc = () => {
      const l = +$("#fuelLitres").value;
      $("#fuelCost").textContent = `RM ${fmt(l * fuelPrice, 2)}`;
      $("#fuelCalcNote").textContent = `${l} litres at RM ${fmt(fuelPrice, 2)}/L`;
    };
    $("#fuelLitres").addEventListener("input", () => { recalc(); track("tool_use", { tool: "harga_minyak" }); });
    $$("#fuelSel button").forEach((b) => b.addEventListener("click", () => {
      track("tool_use", { tool: "harga_minyak" });
      $$("#fuelSel button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active"); fuelPrice = +b.dataset.p; recalc();
    }));
    recalc();
  } catch (e) {
    body.innerHTML = `<div class="tool-err">Couldn't reach data.gov.my fuel feed.</div>`;
  }
}

/* ============================================================
   3. POPULATION — data.gov.my
   ============================================================ */
const ETHNIC = [
  { key: "bumi_malay", label: "Bumi · Malay", color: "#16130d" },
  { key: "bumi_other", label: "Bumi · other", color: "#4a443a" },
  { key: "chinese", label: "Chinese", color: "#b23a23" },
  { key: "indian", label: "Indian", color: "#9a7b2e" },
  { key: "other_citizen", label: "Other citizen", color: "#7a7263" },
  { key: "other_noncitizen", label: "Non-citizen", color: "#b3ab98" },
];
async function loadPopulation() {
  const body = $("#popBody");
  try {
    const rows = await jget("https://api.data.gov.my/data-catalogue/?id=population_malaysia&limit=40&sort=-date");
    const ld = rows[0].date;
    const latest = rows.filter((r) => r.date === ld && r.sex === "both" && r.age === "overall");
    const val = (k) => latest.find((r) => r.ethnicity === k)?.population || 0;
    const total = val("overall");
    const year = ld.slice(0, 4);

    tickerData.pop = total;
    rebuildTicker();

    const segs = ETHNIC.map((e) => ({ ...e, v: val(e.key) })).filter((e) => e.v > 0);
    body.innerHTML = `
      <div class="pop-top"><span class="pop-big" id="popBig">0</span><span class="pop-unit">million</span></div>
      <div class="pop-sub">total population · ${esc(year)} · thousands rolled up live</div>
      <div class="pop-bar" id="popBar">${segs.map((e) => `<div class="pop-seg" style="background:${e.color}" title="${esc(e.label)}"></div>`).join("")}</div>
      <div class="pop-legend">${segs.map((e) => `<span class="pop-l"><span class="pl-dot" style="background:${e.color}"></span>${e.label} <span class="pl-val">${fmt(e.v / 1000, 1)}M</span></span>`).join("")}</div>`;

    // animate count + bar
    countUp($("#popBig"), total / 1000, 1500, 1);
    $$("#popBar .pop-seg").forEach((s, i) => setTimeout(() => (s.style.width = (segs[i].v / total) * 100 + "%"), 150 + i * 80));
  } catch (e) {
    body.innerHTML = `<div class="tool-err">Couldn't reach DOSM population feed.</div>`;
  }
}

/* ============================================================
   4. RINGGIT WATCH — Frankfurter (ECB)
   ============================================================ */
const FX_PAIRS = ["USD", "SGD", "EUR", "GBP", "JPY", "AUD", "THB", "CNY"];
let fxActive = "USD";
async function loadFX(base) {
  fxActive = base;
  const body = $("#fxBody");
  body.innerHTML = `<div class="tool-loading">Fetching rates…</div>`;
  try {
    // 1 unit of `base` in MYR
    const latest = await jget(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=MYR`);
    const rate = latest.rates.MYR;

    // 30-day series of base->MYR
    const end = latest.date;
    const start = new Date(new Date(end).getTime() - 31 * 864e5).toISOString().slice(0, 10);
    const ts = await jget(`https://api.frankfurter.dev/v1/${start}..${end}?base=${base}&symbols=MYR`);
    const days = Object.keys(ts.rates).sort();
    const vals = days.map((d) => ts.rates[d].MYR);
    const first = vals[0], last = vals[vals.length - 1];
    const chgPct = ((last - first) / first) * 100;

    if (base === "USD") { tickerData.fx = rate; rebuildTicker(); }

    const spark = sparkline(vals, 320, 70);
    const up = chgPct >= 0;
    body.innerHTML = `
      <div class="fx-top">
        <span class="fx-big">RM ${fmt(rate, 4)}</span>
        <span class="fx-eq">per 1 ${esc(base)}</span>
      </div>
      <div class="fx-chg ${up ? "up-c" : "down-c"}">${up ? "▲" : "▼"} ${fmt(Math.abs(chgPct), 2)}% over 30 days · ringgit ${up ? "weaker" : "stronger"}</div>
      <svg class="fx-spark" viewBox="0 0 320 70" preserveAspectRatio="none">${spark}</svg>
      <div class="fx-conv">
        <input type="number" id="fxAmt" value="100" min="0" />
        <span class="fx-conv-eq">${esc(base)} =</span>
        <span class="fx-conv-out" id="fxOut">RM —</span>
      </div>
      <div class="fx-pairs">${FX_PAIRS.map((p) => `<button class="fx-pair ${p === base ? "active" : ""}" data-cur="${p}">${p}</button>`).join("")}</div>`;
    const conv = () => { const a = parseFloat($("#fxAmt").value) || 0; $("#fxOut").textContent = `RM ${fmt(a * rate, 2)}`; };
    $("#fxAmt").addEventListener("input", () => { conv(); track("tool_use", { tool: "ringgit" }); }); conv();
    $$("#fxBody .fx-pair").forEach((b) => b.addEventListener("click", () => { track("tool_use", { tool: "ringgit", pair: b.dataset.cur }); loadFX(b.dataset.cur); }));
  } catch (e) {
    body.innerHTML = `<div class="tool-err">Couldn't reach the FX feed.</div>`;
  }
}
function sparkline(vals, w, h) {
  const min = Math.min(...vals), max = Math.max(...vals), pad = 6;
  const rng = max - min || 1;
  const x = (i) => (i / (vals.length - 1)) * w;
  const y = (v) => pad + (1 - (v - min) / rng) * (h - pad * 2);
  const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return `<path class="area" d="${area}"/><path class="line" d="${line}"/>`;
}

/* ============================================================
   5. CRYPTO IN MYR — CoinGecko
   ============================================================ */
const COINS = [
  { id: "bitcoin", sym: "BTC", name: "Bitcoin", c: "#c0392b" },
  { id: "ethereum", sym: "ETH", name: "Ethereum", c: "#4a443a" },
  { id: "solana", sym: "SOL", name: "Solana", c: "#2f6b4a" },
  { id: "binancecoin", sym: "BNB", name: "BNB", c: "#9a7b2e" },
];
async function loadCrypto() {
  const body = $("#cryptoBody");
  try {
    const ids = COINS.map((c) => c.id).join(",");
    const d = await jget(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=myr&include_24hr_change=true`);
    tickerData.btc = d.bitcoin?.myr;
    rebuildTicker();
    body.innerHTML = `<div class="crypto-list">${COINS.map((c) => {
      const row = d[c.id]; if (!row) return "";
      const chg = row.myr_24h_change ?? 0; const up = chg >= 0;
      return `<div class="crypto-row">
        <div class="cr-name"><span class="crypto-ic" style="background:${c.c}">${c.sym[0]}</span>
          <span><span class="cr-sym">${c.sym}</span><br><span class="cr-full">${c.name}</span></span></div>
        <div class="cr-price">RM ${fmt(row.myr, row.myr < 100 ? 2 : 0)}</div>
        <div class="cr-chg ${up ? "up-c" : "down-c"}">${up ? "▲" : "▼"} ${fmt(Math.abs(chg), 1)}%</div>
      </div>`;
    }).join("")}</div>`;
  } catch (e) {
    body.innerHTML = `<div class="tool-err">Couldn't reach CoinGecko.</div>`;
  }
}

/* ============================================================
   6. WEATHER + AIR — Open-Meteo (combo)
   ============================================================ */
async function loadWeather(idx) {
  const c = CITIES[idx]; const body = $("#wxBody");
  body.innerHTML = `<div class="tool-loading">Reading the skies over ${esc(c.name)}…</div>`;
  try {
    const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FKuala_Lumpur&forecast_days=5`;
    const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${c.lat}&longitude=${c.lon}&current=pm2_5,us_aqi`;
    const [wx, air] = await Promise.all([jget(wxUrl), jget(airUrl)]);

    const cur = wx.current;
    const [emoji, cond] = wxOf(cur.weather_code);
    const days = wx.daily.time.map((t, i) => {
      const d = new Date(t).toLocaleDateString("en-GB", { weekday: "short" });
      const [e] = wxOf(wx.daily.weather_code[i]);
      return { d, e, hi: Math.round(wx.daily.temperature_2m_max[i]), lo: Math.round(wx.daily.temperature_2m_min[i]) };
    });

    const aqi = Math.round(air.current.us_aqi);
    const pm = air.current.pm2_5;
    const band = aqiBand(aqi);
    if (idx === 0) { tickerData.wx = Math.round(cur.temperature_2m); tickerData.aqi = aqi; rebuildTicker(); }

    const R = 54, C = 2 * Math.PI * R;
    const frac = Math.min(aqi / 200, 1);

    body.innerHTML = `
      <div class="wx-row">
        <div>
          <div class="wx-now">
            <span class="wx-emoji">${emoji}</span>
            <div>
              <div class="wx-temp">${Math.round(cur.temperature_2m)}°</div>
              <div class="wx-cond">${esc(cond)} · ${esc(c.name)}</div>
              <div class="wx-meta">humidity ${cur.relative_humidity_2m}% · wind ${Math.round(cur.wind_speed_10m)} km/h</div>
            </div>
          </div>
          <div class="wx-forecast">${days.map((x) => `<div class="wx-day">
            <div class="wd-d">${x.d}</div><div class="wd-e">${x.e}</div>
            <div class="wd-t">${x.hi}° / ${x.lo}°</div></div>`).join("")}</div>
        </div>
        <div class="air-gauge">
          <div class="air-ring">
            <svg width="130" height="130" viewBox="0 0 130 130">
              <circle class="ar-bg" cx="65" cy="65" r="${R}"/>
              <circle class="ar-fg" cx="65" cy="65" r="${R}" stroke="${band.color}" stroke-dasharray="0 ${C}" id="airArc"/>
            </svg>
            <div class="air-center"><span class="ac-val" style="color:${band.color}">${aqi}</span><span class="ac-lab">US AQI</span></div>
          </div>
          <div class="air-band" style="color:${band.color}">${band.label}</div>
          <div class="air-pm">PM2.5 · ${fmt(pm, 1)} µg/m³</div>
        </div>
      </div>`;
    setTimeout(() => { const a = $("#airArc"); if (a) a.setAttribute("stroke-dasharray", `${frac * C} ${C}`); }, 200);
  } catch (e) {
    body.innerHTML = `<div class="tool-err">Couldn't reach Open-Meteo.</div>`;
  }
}
function aqiBand(a) {
  if (a <= 50) return { label: "Good", color: "#2f6b4a" };
  if (a <= 100) return { label: "Moderate", color: "#9a7b2e" };
  if (a <= 150) return { label: "Unhealthy (sensitive)", color: "#b23a23" };
  if (a <= 200) return { label: "Unhealthy", color: "#8f2c19" };
  return { label: "Very unhealthy", color: "#5e1f12" };
}

/* ============================================================
   7. AMARAN BENCANA — MET warnings + JPS flood (combo)
   ============================================================ */
async function loadWarnings() {
  const body = $("#warnBody");
  try {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));
    const [warns, flood] = await Promise.all([
      jget("https://api.data.gov.my/weather/warning/?limit=20&sort=-warning_issue"),
      jget("https://api.data.gov.my/flood-warning/?limit=600"),
    ]);

    const active = (warns || []).filter((w) => {
      const t = w.warning_issue?.title_en;
      if (!t || /no advisory/i.test(t)) return false;
      if (w.valid_to && new Date(w.valid_to) < now) return false;
      return true;
    }).slice(0, 3);

    const alertStations = (flood || []).filter((s) => {
      const ind = (s.water_level_indicator || "").toUpperCase();
      return ind === "ALERT" || ind === "WARNING" || ind === "DANGER";
    });
    const worst = alertStations.slice(0, 2);

    tickerData.warn = active.length || alertStations.length;
    rebuildTicker();

    const ok = active.length === 0 && alertStations.length === 0;
    let html = ok
      ? `<div class="warn-status ok"><span class="ws-ico">🌤</span><div><div class="ws-lab">Semua selamat</div><div class="ws-sub">No active weather warnings or flood alerts right now</div></div></div>`
      : `<div class="warn-status alert"><span class="ws-ico">⚠️</span><div><div class="ws-lab">${active.length + alertStations.length} active alert${active.length + alertStations.length > 1 ? "s" : ""}</div><div class="ws-sub">${active.length} weather warning${active.length !== 1 ? "s" : ""} · ${alertStations.length} flood station${alertStations.length !== 1 ? "s" : ""}</div></div></div>`;

    if (active.length) {
      html += `<div class="warn-list">${active.map((w) => {
        const wi = w.warning_issue;
        const to = w.valid_to ? new Date(w.valid_to).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
        return `<div class="warn-item"><div class="wi-t">${esc(wi.title_en)}</div>${to ? `<div class="wi-w">until ${esc(to)}</div>` : ""}</div>`;
      }).join("")}</div>`;
    }
    if (alertStations.length) {
      html += `<div class="warn-flood"><span>Rivers above alert level</span><b>${alertStations.length}</b></div>`;
      if (worst.length) html += `<div class="wi-w" style="margin-top:6px">${worst.map((s) => esc(`${s.station_name}, ${s.state}`)).join(" · ")}</div>`;
    }
    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = `<div class="tool-err">Couldn't reach the warnings feed.</div>`;
  }
}

/* ============================================================
   8. KOS SARA HIDUP — CPI / inflation (data.gov.my)
   ============================================================ */
async function loadInflation() {
  const body = $("#cpiBody");
  try {
    const rows = await jget("https://api.data.gov.my/data-catalogue/?id=cpi_headline&limit=400&sort=-date");
    const overall = rows.filter((r) => r.division === "overall");
    if (!overall.length) throw new Error("no data");
    const latest = overall[0];
    const ym = latest.date.slice(0, 7);
    const yearAgoKey = `${+ym.slice(0, 4) - 1}${ym.slice(4)}`;
    const yearAgo = overall.find((r) => r.date.slice(0, 7) === yearAgoKey);
    const yoy = yearAgo ? ((latest.index / yearAgo.index - 1) * 100) : null;

    // 13-month trend (oldest→newest)
    const trend = overall.slice(0, 13).reverse().map((r) => r.index);
    const spark = sparkline(trend, 320, 56);
    const monthName = new Date(latest.date).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const eg = yoy != null ? Math.round(100 * (latest.index / (yearAgo.index)) ) : 100;

    tickerData.cpi = yoy;
    rebuildTicker();

    body.innerHTML = `
      <div class="cpi-top"><span class="cpi-big" id="cpiBig">${yoy != null ? (yoy >= 0 ? "+" : "") + fmt(yoy, 1) + "%" : "—"}</span><span class="cpi-yoy">year-on-year</span></div>
      <div class="cpi-sub">headline inflation · ${esc(monthName)}</div>
      <svg class="cpi-spark" viewBox="0 0 320 56" preserveAspectRatio="none">${spark}</svg>
      ${yoy != null ? `<div class="cpi-eg">What cost <b>RM 100</b> a year ago now costs about <b>RM ${fmt(eg, 0)}</b>. The basket: food, transport, housing, the everyday.</div>` : ""}`;
  } catch (e) {
    body.innerHTML = `<div class="tool-err">Couldn't reach the inflation feed.</div>`;
  }
}

/* ============================================================
   LIVE TICKER (combo of the feeds)
   ============================================================ */
function rebuildTicker() {
  const items = [];
  if (tickerData.prayer) items.push(["Next solat", `${tickerData.prayer.label} ${tickerData.prayer.time}`, tickerData.prayer.cd ? `in ${tickerData.prayer.cd}` : ""]);
  if (tickerData.fuel) items.push(["RON97", `RM ${fmt(tickerData.fuel.ron97, 2)}`, "/L"]);
  if (tickerData.fuel) items.push(["Diesel", `RM ${fmt(tickerData.fuel.diesel, 2)}`, "/L"]);
  if (tickerData.fx) items.push(["USD", `RM ${fmt(tickerData.fx, 4)}`, ""]);
  if (tickerData.btc) items.push(["Bitcoin", `RM ${fmt(tickerData.btc, 0)}`, ""]);
  if (tickerData.wx != null) items.push(["KL now", `${tickerData.wx}°C`, ""]);
  if (tickerData.aqi != null) items.push(["KL air", `AQI ${tickerData.aqi}`, aqiBand(tickerData.aqi).label]);
  if (tickerData.cpi != null) items.push(["Inflation", `${tickerData.cpi >= 0 ? "+" : ""}${fmt(tickerData.cpi, 1)}%`, "y/y"]);
  if (tickerData.warn != null) items.push(["Amaran", tickerData.warn ? `${tickerData.warn} active` : "all clear", ""]);
  if (tickerData.pop) items.push(["Rakyat", `${fmt(tickerData.pop / 1000, 1)}M`, ""]);
  if (!items.length) return;

  const one = items.map(([lab, val, note]) =>
    `<span class="tick"><span class="t-lab">${esc(lab)}</span><span class="t-val">${esc(val)}</span>${note ? `<span class="t-up">${esc(note)}</span>` : ""}</span>`
  ).join("");
  // duplicate for seamless marquee
  $("#tickerTrack").innerHTML = one + one;
}

/* ============================================================
   SOURCE COUNT — trust band (Pasar API catalogue, just the number)
   ============================================================ */
const API = "https://pasarapi.krackeddevs.com/api";
async function loadSourceCount() {
  try {
    const data = await jget(`${API}/catalogue`);
    const n = data.apis?.length || data.count || 0;
    const gov = (data.apis || []).filter((a) => a.group === "Government & open data").length;
    $("#srcCount").textContent = `Indexed across ${n} public Malaysian APIs · ${gov} official government feeds.`;
    $("#footerMeta").textContent = `${n} APIs indexed · catalogue ${data.updated || ""} · every tool fetches live in your browser`;
  } catch (e) {
    $("#footerMeta").textContent = "Tools fetch live in your browser from official Malaysian open data.";
  }
}

/* ============================================================
   helpers
   ============================================================ */
function countUp(el, target, dur, d = 0) {
  const start = performance.now();
  const step = (now) => {
    const p = Math.min((now - start) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(target * e, d);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  // fallback: guarantee the final value even if rAF is throttled (background tab)
  setTimeout(() => { el.textContent = fmt(target, d); }, dur + 150);
}
function setupReveal() {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.08 });
  $$(".tool").forEach((t, i) => { t.style.transitionDelay = (i % 3) * 80 + "ms"; io.observe(t); });
}
function copy(text, msg) {
  navigator.clipboard?.writeText(text).then(() => toast(msg)).catch(() => toast("Copy failed"));
}
let toastT;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  setTimeout(() => t.classList.add("show"), 15);
  clearTimeout(toastT); toastT = setTimeout(() => { t.classList.remove("show"); setTimeout(() => (t.hidden = true), 320); }, 2000);
}
