// D3.1 — /today uses the saved city for weather + AQI; changing city reloads only those two cards
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

export function todayEls() {
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

async function loadToday({ storage = makeStorage(), lang = "en", search = "", events = [] } = {}) {
  const calls = [];
  const keys = Object.keys(API);
  const fetchStub = async (url) => {
    calls.push(url);
    const key = keys.find((k) => url.includes(k));
    if (!key) throw new Error("down");
    return { ok: true, json: async () => JSON.parse(JSON.stringify(API[key])) };
  };
  const els = todayEls();
  const ctx = loadScript(["common.js", "today.js"], {
    globals: {
      fetch: fetchStub, document: makeDocument(els, lang), localStorage: storage,
      sessionStorage: makeStorage(),
      gtag: (kind, name, params) => { if (kind === "event") events.push({ name, params }); },
      location: { pathname: "/today", href: "https://greatermalaysia.com/today" + search, search, origin: "https://greatermalaysia.com" },
    },
  }).ctx;
  await new Promise((r) => setTimeout(r, 150));
  return { ctx, els, calls, events, storage };
}

const forecasts = (calls) => calls.filter((u) => u.includes("api.open-meteo.com/v1/forecast"));
const airs = (calls) => calls.filter((u) => u.includes("air-quality-api"));

test("the saved city controls both weather and AQI requests and the card labels", async () => {
  const storage = makeStorage({ "gm:prefs:v1": JSON.stringify({ city: "kuching", state: "swk" }) });
  const { els, calls } = await loadToday({ storage });
  assert.ok(forecasts(calls)[0].includes("latitude=1.553"), forecasts(calls)[0]);
  assert.ok(airs(calls)[0].includes("latitude=1.553"));
  assert.equal(els["#tWx .tc-k"].textContent, "Cuaca Kuching");
  assert.equal(els["#tAir .tc-k"].textContent, "Udara Kuching");
});

test("an invalid preference falls back to Kuala Lumpur", async () => {
  const storage = makeStorage({ "gm:prefs:v1": JSON.stringify({ city: "gotham" }) });
  const { els, calls } = await loadToday({ storage });
  assert.ok(forecasts(calls)[0].includes("latitude=3.139"));
  assert.equal(els["#tWx .tc-k"].textContent, "Cuaca KL");
});

test("changing city reloads exactly weather and AQI, persists the slug, and leaves other cards alone", async () => {
  const { els, calls, storage, events } = await loadToday();
  const before = calls.length;
  els["#todayCity"].value = "ipoh";
  els["#todayCity"].dispatch("change");
  await new Promise((r) => setTimeout(r, 80));
  const added = calls.slice(before);
  assert.equal(added.length, 2, JSON.stringify(added));
  assert.ok(added.every((u) => u.includes("latitude=4.597")));
  assert.equal(JSON.parse(storage.getItem("gm:prefs:v1")).city, "ipoh");
  assert.equal(els["#tWx .tc-k"].textContent, "Cuaca Ipoh");
  const pref = events.find((e) => e.name === "preference_set");
  assert.equal(pref.params.source, "today_selector");
  assert.equal(pref.params.value, "ipoh");
});

test("the share payload names the active city, not KL", async () => {
  const storage = makeStorage({ "gm:prefs:v1": JSON.stringify({ city: "kota-kinabalu", state: "sbh" }) });
  const { ctx } = await loadToday({ storage });
  const p = ctx.GM_SHARE_PAYLOAD();
  assert.ok(p.text.includes("KK 30°C"), p.text);
});
