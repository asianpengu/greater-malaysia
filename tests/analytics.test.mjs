// D1.3 — GA4 product event contract: live_card_result, share_click
import test from "node:test";
import assert from "node:assert/strict";
import { loadScript, makeElement, makeDocument } from "./helpers/load-source.mjs";

const ALLOWED_RESULT_KEYS = new Set(["page", "card", "status", "cache_state", "source", "attempt"]);
const ALLOWED_SHARE_KEYS = new Set(["page", "medium", "personalized"]);

function gtagRecorder(events) {
  return (kind, name, params) => { if (kind === "event") events.push({ name, params }); };
}

test("trackResult emits one live_card_result with exactly the allowlisted parameters", () => {
  const events = [];
  const { trackResult } = loadScript("common.js", {
    names: ["trackResult"],
    globals: { gtag: gtagRecorder(events), location: { pathname: "/today", href: "https://greatermalaysia.com/today", search: "" } },
  });
  trackResult("fuel", "fresh", "network", "data_gov_my");
  assert.equal(events.length, 1);
  assert.equal(events[0].name, "live_card_result");
  assert.deepEqual(JSON.parse(JSON.stringify(events[0].params)), {
    page: "/today", card: "fuel", status: "fresh", cache_state: "network", source: "data_gov_my",
  });
  for (const k of Object.keys(events[0].params)) assert.ok(ALLOWED_RESULT_KEYS.has(k), `unexpected key ${k}`);
});

test("duplicate initial results are suppressed but a retry with attempt 2 is emitted", () => {
  const events = [];
  const { trackResult } = loadScript("common.js", {
    names: ["trackResult"],
    globals: { gtag: gtagRecorder(events), location: { pathname: "/today", href: "x", search: "" } },
  });
  trackResult("fx", "error", "none", "frankfurter");
  trackResult("fx", "error", "none", "frankfurter"); // duplicate — suppressed
  assert.equal(events.length, 1);
  trackResult("fx", "fresh", "network", "frankfurter", 2); // manual retry succeeded
  assert.equal(events.length, 2);
  assert.equal(events[1].params.attempt, 2);
});

test("trackShare emits share_click with medium and personalized flag only", () => {
  const events = [];
  const { trackShare } = loadScript("common.js", {
    names: ["trackShare"],
    globals: { gtag: gtagRecorder(events), location: { pathname: "/today", href: "x", search: "" } },
  });
  trackShare("whatsapp", true);
  assert.equal(events[0].name, "share_click");
  assert.deepEqual(JSON.parse(JSON.stringify(events[0].params)), { page: "/today", medium: "whatsapp", personalized: true });
  for (const k of Object.keys(events[0].params)) assert.ok(ALLOWED_SHARE_KEYS.has(k), `unexpected key ${k}`);
});

test("pages work normally when gtag is blocked", () => {
  const { trackResult, trackShare } = loadScript("common.js", {
    names: ["trackResult", "trackShare"],
  });
  assert.doesNotThrow(() => { trackResult("fuel", "fresh", "network", "data_gov_my"); trackShare("copy_link", false); });
});

/* ---- today.js integration: one terminal event per card attempt ---- */

const API = {
  "e-solat.gov.my": { prayerTime: [{ date: "15-Jul-2026", hijri: "1448-01-30", imsak: "05:40:00", fajr: "05:50:00", syuruk: "07:05:00", dhuhr: "13:20:00", asr: "16:40:00", maghrib: "19:28:00", isha: "20:40:00" }] },
  "fuelprice": [{ series_type: "level", date: "2026-07-08", ron95: 2.05, ron95_skps: 2.05, ron97: 4.0, diesel: 3.97 }],
  "frankfurter": { date: "2026-07-14", rates: { MYR: 4.078 } },
  "air-quality": { current: { us_aqi: 115 } },
  "open-meteo": { current: { temperature_2m: 30.2, weather_code: 2, relative_humidity_2m: 72 } },
  "coingecko": { bitcoin: { myr: 263737, myr_24h_change: 3.2 } },
  "cpi_headline": [
    { division: "overall", date: "2026-05-01", index: 135.0 },
    { division: "overall", date: "2025-05-01", index: 132.3 },
  ],
  "population_malaysia": [{ date: "2025-01-01", sex: "both", age: "overall", ethnicity: "overall", population: 34200 }],
};

async function loadTodayWithGtag({ fail = [] } = {}) {
  const events = [];
  const keys = Object.keys(API);
  const fetchStub = async (url) => {
    const key = keys.find((k) => url.includes(k));
    if (!key || fail.some((f) => url.includes(f))) throw new Error("down");
    return { ok: true, json: async () => JSON.parse(JSON.stringify(API[key])) };
  };
  const doc = makeDocument({
    "#todayDate": makeElement(), "#todayClock": makeElement(), "#todayGrid": makeElement(),
    'link[rel="canonical"]': { href: "https://greatermalaysia.com/today" },
  });
  loadScript(["common.js", "today.js"], {
    globals: {
      fetch: fetchStub, document: doc, gtag: gtagRecorder(events),
      location: { pathname: "/today", href: "https://greatermalaysia.com/today", search: "" },
    },
  });
  await new Promise((r) => setTimeout(r, 150));
  return events;
}

test("each Today card emits exactly one live_card_result for its terminal state", async () => {
  const events = (await loadTodayWithGtag()).filter((e) => e.name === "live_card_result");
  assert.equal(events.length, 8, JSON.stringify(events.map((e) => e.params.card)));
  const cards = events.map((e) => e.params.card).sort();
  assert.deepEqual(cards, ["air", "btc", "cpi", "fuel", "fx", "population", "prayer", "weather"]);
  for (const e of events) {
    assert.equal(e.params.status, "fresh");
    for (const k of Object.keys(e.params)) assert.ok(ALLOWED_RESULT_KEYS.has(k), `unexpected key ${k}`);
    for (const v of Object.values(e.params)) assert.equal(typeof v === "string" || typeof v === "number", true);
  }
});

test("a failed source emits status error and never a value", async () => {
  const events = (await loadTodayWithGtag({ fail: ["coingecko"] })).filter((e) => e.name === "live_card_result");
  const btc = events.find((e) => e.params.card === "btc");
  assert.equal(btc.params.status, "error");
  assert.equal(btc.params.source, "coingecko");
  assert.ok(!("value" in btc.params));
});
