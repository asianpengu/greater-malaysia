// D2.2 — homepage remembers the weather city (app.js + common.js prefs)
import test from "node:test";
import assert from "node:assert/strict";
import { loadScript, makeStorage, makeElement, makeDocument } from "./helpers/load-source.mjs";

const WEATHER = {
  current: { temperature_2m: 31.4, relative_humidity_2m: 70, weather_code: 2, wind_speed_10m: 8 },
  daily: { time: ["2026-07-15"], weather_code: [2], temperature_2m_max: [33], temperature_2m_min: [26] },
};
const AIR = { current: { pm2_5: 18.2, us_aqi: 74 } };

function homeDoc() {
  const els = {};
  for (const id of ["prayerZone", "wxCity", "heroClock", "prayerBody", "fuelBody", "popBody", "fxBody", "cryptoBody", "wxBody", "warnBody", "cpiBody", "tickerTrack", "footerMeta", "srcCount"]) {
    els["#" + id] = makeElement();
  }
  return { doc: makeDocument(els), els };
}

async function loadHome({ storage = makeStorage(), events = [] } = {}) {
  const calls = [];
  const fetchStub = async (url) => {
    calls.push(url);
    if (url.includes("air-quality")) return { ok: true, json: async () => JSON.parse(JSON.stringify(AIR)) };
    if (url.includes("open-meteo")) return { ok: true, json: async () => JSON.parse(JSON.stringify(WEATHER)) };
    throw new Error("down"); // every other tool source fails fast in this test
  };
  const { doc, els } = homeDoc();
  const ctx = loadScript(["assets/i18n.js", "common.js", "app.js"], {
    globals: {
      fetch: fetchStub, document: doc, localStorage: storage,
      gtag: (kind, name, params) => { if (kind === "event") events.push({ name, params }); },
      location: { pathname: "/", href: "https://greatermalaysia.com/", search: "" },
    },
  }).ctx;
  await new Promise((r) => setTimeout(r, 150));
  return { ctx, els, calls, events, storage };
}

const forecastCalls = (calls) => calls.filter((u) => u.includes("api.open-meteo.com/v1/forecast"));

test("a saved ipoh preference selects Ipoh before the first weather request", async () => {
  const storage = makeStorage({ "gm:prefs:v1": JSON.stringify({ city: "ipoh", state: "kul" }) });
  const { els, calls } = await loadHome({ storage });
  assert.match(els["#wxCity"].innerHTML, /value="3" selected/);
  const fc = forecastCalls(calls);
  assert.equal(fc.length, 1, "exactly one initial weather request");
  assert.ok(fc[0].includes("latitude=4.597"), fc[0]);
});

test("Kuala Lumpur remains the default for new or invalid preferences", async () => {
  const storage = makeStorage({ "gm:prefs:v1": JSON.stringify({ city: "paris" }) });
  const { els, calls } = await loadHome({ storage });
  assert.match(els["#wxCity"].innerHTML, /value="0" selected/);
  assert.ok(forecastCalls(calls)[0].includes("latitude=3.139"));
});

test("changing city writes the slug (not the index) and tracks preference_set", async () => {
  const { els, events, storage, calls } = await loadHome();
  els["#wxCity"].value = "2";
  els["#wxCity"].dispatch("change");
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(JSON.parse(storage.getItem("gm:prefs:v1")).city, "johor-bahru");
  const pref = events.find((e) => e.name === "preference_set");
  assert.deepEqual(JSON.parse(JSON.stringify(pref.params)), { preference: "city", value: "johor-bahru", source: "homepage_selector" });
  assert.equal(forecastCalls(calls).length, 2, "boot request plus the change request");
});

test("the ticker labels use the selected city's short name", async () => {
  const storage = makeStorage({ "gm:prefs:v1": JSON.stringify({ city: "kota-kinabalu", state: "sbh" }) });
  const { els } = await loadHome({ storage });
  assert.ok(els["#tickerTrack"].innerHTML.includes("KK now"), els["#tickerTrack"].innerHTML.slice(0, 200));
  assert.ok(els["#tickerTrack"].innerHTML.includes("KK air"));
});
