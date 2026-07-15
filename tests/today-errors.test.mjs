// D3.3 — retryable source errors on /today
import test from "node:test";
import assert from "node:assert/strict";
import { loadScript, makeStorage, makeElement, makeDocument } from "./helpers/load-source.mjs";

const API = {
  "e-solat.gov.my": { prayerTime: [{ date: "15-Jul-2026", hijri: "1448-01-30", imsak: "05:40:00", fajr: "05:50:00", syuruk: "07:05:00", dhuhr: "13:20:00", asr: "16:40:00", maghrib: "19:28:00", isha: "20:40:00" }] },
  "fuelprice": [{ series_type: "level", date: "2026-07-08", ron95: 2.05, ron95_skps: 2.05, ron97: 4.0, diesel: 3.97 }],
  "frankfurter": { date: "2026-07-14", rates: { MYR: 4.078 } },
  "air-quality": { current: { us_aqi: 74 } },
  "open-meteo": { current: { temperature_2m: 30.2, weather_code: 2, relative_humidity_2m: 72 } },
  "coingecko": { bitcoin: { myr: 263737, myr_24h_change: 3.2 } },
  "cpi_headline": [
    { division: "overall", date: "2026-05-01", index: 135.0 },
    { division: "overall", date: "2025-05-01", index: 132.3 },
  ],
  "population_malaysia": [{ date: "2025-01-01", sex: "both", age: "overall", ethnicity: "overall", population: 34200 }],
};

function todayEls() {
  const els = {
    "#todayDate": makeElement(), "#todayClock": makeElement(), "#todayGrid": makeElement(),
    "#todayCity": makeElement("select"),
    'link[rel="canonical"]': { href: "https://greatermalaysia.com/today" },
  };
  for (const id of ["tSolat", "tFuel", "tFx", "tWx", "tAir", "tBtc", "tCpi", "tPop"]) {
    els[`#${id} .tc-body`] = makeElement();
    els[`#${id} .tc-freshness`] = makeElement();
    els[`#${id} .tc-k`] = makeElement();
  }
  return els;
}

/* fail[key] = number of failures before success (Infinity = always down) */
async function loadToday({ fail = {}, localStorage = makeStorage(), events = [] } = {}) {
  const calls = [];
  const failures = { ...fail };
  const keys = Object.keys(API);
  const fetchStub = async (url) => {
    calls.push(url);
    const key = keys.find((k) => url.includes(k));
    if (!key) throw new Error("unknown source");
    if (failures[key] > 0) { failures[key]--; throw new Error("down"); }
    return { ok: true, json: async () => JSON.parse(JSON.stringify(API[key])) };
  };
  const els = todayEls();
  const ctx = loadScript(["common.js", "today.js"], {
    globals: {
      fetch: fetchStub, document: makeDocument(els), localStorage, sessionStorage: makeStorage(),
      gtag: (kind, name, params) => { if (kind === "event") events.push({ name, params }); },
      location: { pathname: "/today", href: "https://greatermalaysia.com/today", search: "" },
    },
  }).ctx;
  await new Promise((r) => setTimeout(r, 200));
  return { ctx, els, calls, events };
}

function clickRetry(els, cardId, source) {
  const btn = { disabled: false, dataset: { card: cardId, source }, closest: () => btn };
  els["#todayGrid"].dispatch("click", { target: btn });
  return btn;
}

test("a failed card names its source and offers a retry button instead of a dash", async () => {
  const { els } = await loadToday({ fail: { coingecko: Infinity } });
  const body = els["#tBtc .tc-body"].innerHTML;
  assert.ok(body.includes("CoinGecko"), body);
  assert.ok(body.includes("tc-retry"), "retry button present");
  assert.ok(!body.includes("—"), "no unexplained dash");
});

test("last-known data takes precedence over the error panel", async () => {
  const lastKey = "gm:last:v1:" + encodeURIComponent("https://api.data.gov.my/data-catalogue/?id=fuelprice&limit=4&sort=-date");
  const storage = makeStorage({ [lastKey]: JSON.stringify({ t: Date.now() - 3600e3, v: API.fuelprice }) });
  const { els } = await loadToday({ fail: { fuelprice: Infinity }, localStorage: storage });
  const body = els["#tFuel .tc-body"].innerHTML;
  assert.ok(body.includes("RON95"), body);
  assert.ok(!body.includes("tc-retry"));
  assert.ok(els["#tFuel .tc-freshness"].innerHTML.includes("Last known"), els["#tFuel .tc-freshness"].innerHTML);
});

test("a successful retry replaces the error state, freshness and analytics attempt", async () => {
  const { els, events, calls } = await loadToday({ fail: { coingecko: 3 } }); // 3 = initial try + 2 retries fail, next succeeds
  assert.ok(els["#tBtc .tc-body"].innerHTML.includes("tc-retry"));
  clickRetry(els, "tBtc", "coingecko");
  await new Promise((r) => setTimeout(r, 100));
  assert.ok(els["#tBtc .tc-body"].innerHTML.includes("RM"), els["#tBtc .tc-body"].innerHTML);
  assert.ok(els["#tBtc .tc-freshness"].innerHTML.includes("Checked"));
  const results = events.filter((e) => e.name === "live_card_result" && e.params.card === "btc");
  assert.equal(results.length, 2);
  assert.equal(results[1].params.status, "fresh");
  assert.equal(results[1].params.attempt, 2);
  const retryEv = events.find((e) => e.name === "retry_click");
  assert.deepEqual(JSON.parse(JSON.stringify(retryEv.params)), { page: "/today", card: "btc", source: "coingecko" });
});

test("a failed retry returns to the error state and increments attempt", async () => {
  const { els, events } = await loadToday({ fail: { frankfurter: Infinity } });
  clickRetry(els, "tFx", "frankfurter");
  await new Promise((r) => setTimeout(r, 100));
  assert.ok(els["#tFx .tc-body"].innerHTML.includes("tc-retry"));
  const results = events.filter((e) => e.name === "live_card_result" && e.params.card === "fx");
  assert.equal(results.length, 2);
  assert.equal(results[1].params.status, "error");
  assert.equal(results[1].params.attempt, 2);
});

test("double-clicking retry cannot trigger duplicate concurrent requests", async () => {
  const { els, calls } = await loadToday({ fail: { coingecko: Infinity } });
  const before = calls.filter((u) => u.includes("coingecko")).length;
  const btn = { disabled: false, dataset: { card: "tBtc", source: "coingecko" }, closest: () => btn };
  els["#todayGrid"].dispatch("click", { target: btn });
  els["#todayGrid"].dispatch("click", { target: btn }); // second click while disabled
  await new Promise((r) => setTimeout(r, 100));
  const added = calls.filter((u) => u.includes("coingecko")).length - before;
  assert.equal(added, 3, "one retry operation = one try + two backoff retries");
});

test("weather failure marks both cards and retry runs one paired operation", async () => {
  const { els, calls } = await loadToday({ fail: { "open-meteo": Infinity, "air-quality": Infinity } });
  assert.ok(els["#tWx .tc-body"].innerHTML.includes("tc-retry"));
  assert.ok(els["#tAir .tc-body"].innerHTML.includes("tc-retry"));
  const before = calls.length;
  clickRetry(els, "tWx", "open_meteo");
  await new Promise((r) => setTimeout(r, 100));
  const added = calls.slice(before);
  assert.ok(added.every((u) => u.includes("open-meteo") || u.includes("air-quality")));
  assert.ok(added.length > 0);
});
