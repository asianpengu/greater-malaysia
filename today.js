/* "Today in Malaysia" — live snapshot pulling every key number into one view.
   Shared helpers ($, esc, fmt, jget, myNow, wireNav…) live in common.js. */

wireNav();
$("#todayDate").textContent = myNow().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const clock = () => $("#todayClock").textContent = myNow().toLocaleTimeString("en-GB", { hour12: false }); clock(); setInterval(clock, 1000);

/* active page language — ms/today.html and zh/today.html load this same file */
const TLANG = (() => { const l = document.documentElement.lang; return l === "ms" ? "ms" : l === "zh-Hans" ? "zh" : "en"; })();

/* freshness copy: "Checked …" / "Disemak …" / "已检查 …"; stale values are
   labelled last known — a browser-cache timestamp is never a publication date */
const FRESH_COPY = {
  en: { checked: "Checked {rel}", stale: "Last known · checked {rel}", just: "just now", min: "{m} min ago", hr: "{h} h ago", day: "{d} d ago" },
  ms: { checked: "Disemak {rel}", stale: "Terakhir diketahui · disemak {rel}", just: "sebentar tadi", min: "{m} min lalu", hr: "{h} jam lalu", day: "{d} hari lalu" },
  zh: { checked: "已检查 · {rel}", stale: "最后已知 · {rel}", just: "刚刚", min: "{m} 分钟前", hr: "{h} 小时前", day: "{d} 天前" },
}[TLANG];

/* how old a last-known value may be, per source (D2.3 contract) */
const MAX_STALE = {
  prayer: 24 * 3600e3,
  fuel: 14 * 86400e3,
  fx: 72 * 3600e3,
  weather: 6 * 3600e3,
  btc: 30 * 60e3,
  cpi: 90 * 86400e3,
  population: 400 * 86400e3,
};

/* ---- active weather city: ?city= query (visit only) > saved preference >
   Kuala Lumpur. A shared link never overwrites the recipient's saved city. */
const cityBySlug = (slug) => GM_CITIES.find((c) => c.slug === slug);
function cityFromQuery() {
  try {
    // first recognized value wins; unknown or hostile values are ignored
    return new URLSearchParams(location.search).getAll("city").map(cityBySlug).find(Boolean) || null;
  } catch (e) { return null; }
}
const queryCity = cityFromQuery();
let activeCity = queryCity || cityBySlug(getPrefs().city) || GM_CITIES[0];
if (queryCity) track("preference_set", { preference: "city", value: queryCity.slug, source: "query" });

/* share copy — the heading and labels used when sharing the live snapshot */
const SHARE_COPY = {
  en: { title: "Malaysia right now", inflation: "Inflation", lastKnown: "last known" },
  ms: { title: "Malaysia sekarang", inflation: "Inflasi", lastKnown: "terakhir diketahui" },
  zh: { title: "马来西亚此刻", inflation: "通胀", lastKnown: "最后已知" },
}[TLANG];

/* card id → short human summary of the successfully rendered value */
const shareSummary = {};
function noteShare(id, text, meta) {
  shareSummary[id] = meta && meta.stale ? `${text} (${SHARE_COPY.lastKnown})` : text;
}

/* result-aware share payload — common.js resolveShare() calls this at click
   time; null (fewer than three loaded cards) falls back to page metadata */
window.GM_SHARE_PAYLOAD = function () {
  const parts = ["tFuel", "tFx", "tWx", "tAir", "tBtc", "tSolat", "tCpi"].map((id) => shareSummary[id]).filter(Boolean);
  if (parts.length < 3) return null;
  const base = (document.querySelector('link[rel="canonical"]') || {}).href || location.href.split("?")[0];
  // carry only the normalized city parameter so the recipient sees the same snapshot
  const personalized = activeCity.slug !== "kuala-lumpur";
  const url = personalized ? base + (base.indexOf("?") > -1 ? "&" : "?") + "city=" + activeCity.slug : base;
  return { title: SHARE_COPY.title, text: parts.slice(0, 4).join(" · "), url, personalized };
};

const cardMeta = {}; // card id → last jgetMeta result, so the footer re-renders without refetching
const statusOf = (m) => (m.stale ? "stale" : m.cacheState === "session" ? "cache" : "fresh");
function relTime(fetchedAt) {
  const mins = Math.floor((Date.now() - fetchedAt) / 60000);
  if (mins < 1) return FRESH_COPY.just;
  if (mins < 60) return FRESH_COPY.min.replace("{m}", mins);
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return FRESH_COPY.hr.replace("{h}", hrs);
  return FRESH_COPY.day.replace("{d}", Math.floor(hrs / 24));
}
function freshText(meta) {
  return (meta.stale ? FRESH_COPY.stale : FRESH_COPY.checked).replace("{rel}", relTime(meta.fetchedAt));
}
function renderFresh(id) {
  const el = $(`#${id} .tc-freshness`); const meta = cardMeta[id];
  if (!el || !meta) return;
  el.innerHTML = `<time datetime="${new Date(meta.fetchedAt).toISOString()}">${esc(freshText(meta))}</time>`;
  el.classList.toggle("is-stale", !!meta.stale);
  el.classList.remove("is-error");
}
function setFresh(id, meta) { cardMeta[id] = meta; renderFresh(id); }
setInterval(() => Object.keys(cardMeta).forEach(renderFresh), 60000);

function card(id, kicker, en) { return `<div class="today-card" id="${id}"><div class="tc-k">${kicker}</div><div class="tc-en">${en}</div><div class="tc-body"><div class="tc-load">…</div></div><div class="tc-freshness"></div></div>`; }
$("#todayGrid").innerHTML = [
  card("tSolat", "Waktu Solat", "next prayer · KL"),
  card("tFuel", "Harga Minyak", "this week · RM/L"),
  card("tFx", "Ringgit", "1 USD in MYR"),
  card("tWx", `Cuaca ${esc(activeCity.short)}`, "now"),
  card("tAir", `Udara ${esc(activeCity.short)}`, "air quality"),
  card("tBtc", "Bitcoin", "in ringgit"),
  card("tCpi", "Inflasi", "cost of living"),
  card("tPop", "Rakyat", "population"),
].join("");
const set = (id, html) => { const b = $(`#${id} .tc-body`); if (b) b.innerHTML = html; };

/* city control — changing it reloads only the weather and AQI cards */
const citySel = $("#todayCity");
if (citySel) {
  citySel.innerHTML = GM_CITIES.map((c) => `<option value="${c.slug}"${c.slug === activeCity.slug ? " selected" : ""}>${esc(c.name)}</option>`).join("");
  citySel.addEventListener("change", (e) => {
    const c = cityBySlug(e.target.value); if (!c) return;
    activeCity = c;
    setPrefs({ city: c.slug });
    track("preference_set", { preference: "city", value: c.slug, source: "today_selector" });
    loadTodayWeather();
  });
}

/* ---- retryable source errors (D3.3): a failed card names its source and
   offers one focusable retry button; last-known data always wins over this. */
const ERR_COPY = {
  en: { msg: "Source unavailable.", retry: "Try again" },
  ms: { msg: "Sumber tidak tersedia.", retry: "Cuba lagi" },
  zh: { msg: "数据源不可用。", retry: "重试" },
}[TLANG];
const SOURCE_NAMES = { jakim_esolat: "JAKIM e-Solat", data_gov_my: "data.gov.my", frankfurter: "Frankfurter (ECB)", open_meteo: "Open-Meteo", coingecko: "CoinGecko" };
const CARD_KEY = { tSolat: "prayer", tFuel: "fuel", tFx: "fx", tWx: "weather", tAir: "air", tBtc: "btc", tCpi: "cpi", tPop: "population" };
const attempts = {}; // analytics attempt counter per card key
const retryFns = {}; // card id → loader to re-run
const nextAttempt = (cardKey) => (attempts[cardKey] = (attempts[cardKey] || 0) + 1);

function setCardError(cardId, source, retryFn) {
  retryFns[cardId] = retryFn;
  set(cardId, `<div class="tc-error-message">${esc(SOURCE_NAMES[source] || source)} · ${ERR_COPY.msg}</div><button class="tc-retry" type="button" data-card="${cardId}" data-source="${source}">${ERR_COPY.retry}</button>`);
  const f = $(`#${cardId} .tc-freshness`);
  if (f) { f.innerHTML = ""; f.classList.add("is-error"); }
}

/* delegated retry handling — the button disables while its loader runs */
const todayGrid = $("#todayGrid");
if (todayGrid) {
  todayGrid.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest ? e.target.closest(".tc-retry") : null;
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    track("retry_click", { page: location.pathname, card: CARD_KEY[btn.dataset.card] || btn.dataset.card, source: btn.dataset.source });
    const fn = retryFns[btn.dataset.card];
    if (fn) fn();
  });
}

/* ---- named loaders, one per source ---- */

async function loadTodayPrayer() {
  const att = nextAttempt("prayer");
  try {
    const m = await jgetMeta("https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=today&zone=WLY01", 2, 600e3, { persistent: true, maxStaleMs: MAX_STALE.prayer });
    const t = m.value.prayerTime[0];
    const seq = [["fajr", "Subuh"], ["syuruk", "Syuruk"], ["dhuhr", "Zohor"], ["asr", "Asar"], ["maghrib", "Maghrib"], ["isha", "Isyak"]];
    const now = myNow(); const nm = now.getHours() * 60 + now.getMinutes(); const toMin = h => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };
    const nx = seq.find(([k]) => toMin(t[k]) > nm);
    if (nx) { set("tSolat", `<div class="tc-big">${esc(t[nx[0]].slice(0, 5))}</div><div class="tc-sub">${nx[1]}</div>`); noteShare("tSolat", `${nx[1]} ${t[nx[0]].slice(0, 5)}`, m); }
    else set("tSolat", `<div class="tc-big">${esc(t.fajr.slice(0, 5))}</div><div class="tc-sub">Subuh (esok)</div>`); // after Isyak — tomorrow's dawn
    setFresh("tSolat", m); trackResult("prayer", statusOf(m), m.cacheState, "jakim_esolat", att);
  } catch (e) { setCardError("tSolat", "jakim_esolat", loadTodayPrayer); trackResult("prayer", "error", "none", "jakim_esolat", att); }
}

async function loadTodayFuel() {
  const att = nextAttempt("fuel");
  try {
    const m = await jgetMeta("https://api.data.gov.my/data-catalogue/?id=fuelprice&limit=4&sort=-date", 2, 36e5, { persistent: true, maxStaleMs: MAX_STALE.fuel });
    const l = m.value.find(r => r.series_type === "level");
    set("tFuel", `<div class="tc-row3"><span>RON95<b>${fmt(l.ron95_skps ?? l.ron95)}</b></span><span>RON97<b>${fmt(l.ron97)}</b></span><span>Diesel<b>${fmt(l.diesel)}</b></span></div>`);
    setFresh("tFuel", m); noteShare("tFuel", `RON95 RM${fmt(l.ron95_skps ?? l.ron95)}`, m); trackResult("fuel", statusOf(m), m.cacheState, "data_gov_my", att);
  } catch (e) { setCardError("tFuel", "data_gov_my", loadTodayFuel); trackResult("fuel", "error", "none", "data_gov_my", att); }
}

async function loadTodayFx() {
  const att = nextAttempt("fx");
  try {
    const m = await jgetMeta("https://api.frankfurter.dev/v1/latest?base=USD&symbols=MYR", 2, 600e3, { persistent: true, maxStaleMs: MAX_STALE.fx });
    set("tFx", `<div class="tc-big">RM ${fmt(m.value.rates.MYR, 4)}</div><div class="tc-sub">per 1 USD</div>`);
    setFresh("tFx", m); noteShare("tFx", `USD RM${fmt(m.value.rates.MYR, 2)}`, m); trackResult("fx", statusOf(m), m.cacheState, "frankfurter", att);
  } catch (e) { setCardError("tFx", "frankfurter", loadTodayFx); trackResult("fx", "error", "none", "frankfurter", att); }
}

/* weather + AQI — one paired operation shared by initial load, city control and retry */
let weatherBusy = false;
async function loadTodayWeather() {
  if (weatherBusy) return; weatherBusy = true;
  const att = nextAttempt("weather");
  const city = activeCity;
  const wk = $("#tWx .tc-k"), ak = $("#tAir .tc-k");
  if (wk) wk.textContent = `Cuaca ${city.short}`;
  if (ak) ak.textContent = `Udara ${city.short}`;
  set("tWx", `<div class="tc-load">…</div>`); set("tAir", `<div class="tc-load">…</div>`);
  try {
    const [mwx, mair] = await Promise.all([
      jgetMeta(`https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,weather_code,relative_humidity_2m&timezone=Asia%2FKuala_Lumpur`, 2, 300e3, { persistent: true, maxStaleMs: MAX_STALE.weather }),
      jgetMeta(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${city.lat}&longitude=${city.lon}&current=us_aqi`, 2, 300e3, { persistent: true, maxStaleMs: MAX_STALE.weather })
    ]);
    const wx = mwx.value, air = mair.value;
    const WX = { 0: "☀️", 1: "🌤", 2: "⛅", 3: "☁️", 45: "🌫", 51: "🌦", 53: "🌦", 55: "🌧", 61: "🌦", 63: "🌧", 65: "🌧", 80: "🌦", 81: "🌧", 82: "⛈", 95: "⛈", 96: "⛈", 99: "⛈" };
    set("tWx", `<div class="tc-big">${Math.round(wx.current.temperature_2m)}° ${WX[wx.current.weather_code] || "🌡"}</div><div class="tc-sub">humidity ${Math.round(wx.current.relative_humidity_2m)}%</div>`);
    const aqi = Math.round(air.current.us_aqi); const band = aqi <= 50 ? "Good" : aqi <= 100 ? "Moderate" : aqi <= 150 ? "Unhealthy (sensitive)" : "Unhealthy";
    set("tAir", `<div class="tc-big">${aqi}</div><div class="tc-sub">US AQI · ${band}</div>`);
    setFresh("tWx", mwx); setFresh("tAir", mair);
    noteShare("tWx", `${city.short} ${Math.round(wx.current.temperature_2m)}°C`, mwx); noteShare("tAir", `AQI ${aqi}`, mair);
    trackResult("weather", statusOf(mwx), mwx.cacheState, "open_meteo", att); trackResult("air", statusOf(mair), mair.cacheState, "open_meteo", att);
  } catch (e) {
    setCardError("tWx", "open_meteo", loadTodayWeather); setCardError("tAir", "open_meteo", loadTodayWeather);
    trackResult("weather", "error", "none", "open_meteo", att); trackResult("air", "error", "none", "open_meteo", att);
  } finally { weatherBusy = false; }
}

async function loadTodayBitcoin() {
  const att = nextAttempt("btc");
  try {
    const m = await jgetMeta("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=myr&include_24hr_change=true", 2, 60e3, { persistent: true, maxStaleMs: MAX_STALE.btc });
    const d = m.value;
    const c = d.bitcoin.myr_24h_change ?? 0; set("tBtc", `<div class="tc-big">RM ${fmt(d.bitcoin.myr, 0)}</div><div class="tc-sub ${c >= 0 ? "up-c" : "down-c"}">${c >= 0 ? "▲" : "▼"} ${fmt(Math.abs(c), 1)}% 24h</div>`);
    setFresh("tBtc", m); noteShare("tBtc", `BTC RM${fmt(d.bitcoin.myr, 0)}`, m); trackResult("btc", statusOf(m), m.cacheState, "coingecko", att);
  } catch (e) { setCardError("tBtc", "coingecko", loadTodayBitcoin); trackResult("btc", "error", "none", "coingecko", att); }
}

async function loadTodayCpi() {
  const att = nextAttempt("cpi");
  try {
    const m = await jgetMeta("https://api.data.gov.my/data-catalogue/?id=cpi_headline&limit=400&sort=-date", 2, 36e5, { persistent: true, maxStaleMs: MAX_STALE.cpi });
    const o = m.value.filter(r => r.division === "overall"); const ld = o[0].date.slice(0, 7); const ya = o.find(r => r.date.slice(0, 7) === `${+ld.slice(0, 4) - 1}${ld.slice(4)}`);
    const yoy = ya ? (o[0].index / ya.index - 1) * 100 : null;
    if (yoy == null) { setCardError("tCpi", "data_gov_my", loadTodayCpi); trackResult("cpi", "error", "none", "data_gov_my", att); }
    else { set("tCpi", `<div class="tc-big">${yoy >= 0 ? "+" : ""}${fmt(yoy, 1)}%</div><div class="tc-sub">inflation, year-on-year</div>`); setFresh("tCpi", m); noteShare("tCpi", `${SHARE_COPY.inflation} ${yoy >= 0 ? "+" : ""}${fmt(yoy, 1)}%`, m); trackResult("cpi", statusOf(m), m.cacheState, "data_gov_my", att); }
  } catch (e) { setCardError("tCpi", "data_gov_my", loadTodayCpi); trackResult("cpi", "error", "none", "data_gov_my", att); }
}

async function loadTodayPopulation() {
  const att = nextAttempt("population");
  try {
    const m = await jgetMeta("https://api.data.gov.my/data-catalogue/?id=population_malaysia&limit=40&sort=-date", 2, 36e5, { persistent: true, maxStaleMs: MAX_STALE.population });
    const rows = m.value; const ld = rows[0].date;
    const total = rows.find(r => r.date === ld && r.sex === "both" && r.age === "overall" && r.ethnicity === "overall").population;
    set("tPop", `<div class="tc-big">${fmt(total / 1000, 1)}M</div><div class="tc-sub">people · ${esc(ld.slice(0, 4))}</div>`);
    setFresh("tPop", m); trackResult("population", statusOf(m), m.cacheState, "data_gov_my", att);
  } catch (e) { setCardError("tPop", "data_gov_my", loadTodayPopulation); trackResult("population", "error", "none", "data_gov_my", att); }
}

(async () => {
  // staggered by source host to respect rate limits
  await loadTodayPrayer();
  await sleep(150);
  await loadTodayFuel();
  await sleep(150);
  await loadTodayFx();
  await sleep(200);
  await loadTodayWeather();
  await sleep(500);
  await loadTodayBitcoin();
  await sleep(200);
  await loadTodayCpi();
  await sleep(200);
  await loadTodayPopulation();
})();
