// D1.2 — result-aware sharing: common.js resolveShare + today.js GM_SHARE_PAYLOAD
import test from "node:test";
import assert from "node:assert/strict";
import { loadScript, makeElement, makeDocument } from "./helpers/load-source.mjs";

const FALLBACK = { url: "https://greatermalaysia.com/today", title: "Today in Malaysia, Live Snapshot" };

function loadCommon(hook) {
  const globals = {};
  if (hook !== undefined) globals.GM_SHARE_PAYLOAD = hook;
  return loadScript("common.js", { names: ["resolveShare"], globals });
}

test("no hook: falls back to page metadata with UTM tagging", () => {
  const { resolveShare } = loadCommon();
  const r = resolveShare("whatsapp", FALLBACK);
  assert.equal(r.text, FALLBACK.title);
  assert.equal(r.link, FALLBACK.url + "?utm_source=whatsapp&utm_medium=social&utm_campaign=share");
  assert.equal(r.personalized, false);
});

test("valid hook: uses the live payload title, text and url at click time", () => {
  const { resolveShare } = loadCommon(() => ({
    title: "Malaysia right now",
    text: "RON95 RM2.05 · USD RM4.08 · KL 34°C",
    url: "https://greatermalaysia.com/today",
    personalized: false,
  }));
  const r = resolveShare("telegram", FALLBACK);
  assert.equal(r.text, "Malaysia right now\nRON95 RM2.05 · USD RM4.08 · KL 34°C");
  assert.equal(r.link, "https://greatermalaysia.com/today?utm_source=telegram&utm_medium=social&utm_campaign=share");
});

test("a throwing hook falls back safely to generic metadata", () => {
  const { resolveShare } = loadCommon(() => { throw new Error("hook exploded"); });
  const r = resolveShare("twitter", FALLBACK);
  assert.equal(r.text, FALLBACK.title);
  assert.ok(r.link.startsWith(FALLBACK.url + "?utm_source=twitter"));
});

test("a hook returning null (fewer than three results) falls back", () => {
  const { resolveShare } = loadCommon(() => null);
  const r = resolveShare("copy_link", FALLBACK);
  assert.equal(r.text, FALLBACK.title);
  assert.equal(r.link, FALLBACK.url + "?utm_source=copy_link&utm_medium=social&utm_campaign=share");
});

test("a payload url that already has a query gets UTM appended with &", () => {
  const { resolveShare } = loadCommon(() => ({
    title: "T", text: "X · Y · Z", url: "https://greatermalaysia.com/today?city=ipoh", personalized: true,
  }));
  const r = resolveShare("whatsapp", FALLBACK);
  assert.equal(r.link, "https://greatermalaysia.com/today?city=ipoh&utm_source=whatsapp&utm_medium=social&utm_campaign=share");
  assert.equal(r.personalized, true);
});

/* ---- today.js integration: payload built from actually loaded cards ---- */

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

function todayDocument(lang = "en") {
  const doc = makeDocument({
    "#todayDate": makeElement(), "#todayClock": makeElement(), "#todayGrid": makeElement(),
    'link[rel="canonical"]': { href: "https://greatermalaysia.com/today" },
  }, lang);
  return doc;
}

async function loadToday({ fail = [], lang = "en" } = {}) {
  // air-quality must be matched before open-meteo: both URLs contain "open-meteo"
  const keys = Object.keys(API);
  const fetchStub = async (url) => {
    const key = keys.find((k) => url.includes(k));
    if (!key || fail.some((f) => url.includes(f))) throw new Error("down: " + url);
    return { ok: true, json: async () => JSON.parse(JSON.stringify(API[key])) };
  };
  const doc = todayDocument(lang);
  const out = loadScript(["common.js", "today.js"], {
    names: [],
    globals: { fetch: fetchStub, document: doc },
  });
  await new Promise((r) => setTimeout(r, 150)); // let the staggered loaders settle
  return out.ctx;
}

test("today payload contains the values the user saw, joined for sharing", async () => {
  const ctx = await loadToday();
  const p = ctx.GM_SHARE_PAYLOAD();
  assert.ok(p, "payload defined once three or more cards loaded");
  assert.equal(p.title, "Malaysia right now");
  assert.ok(p.text.includes("RON95 RM2.05"), p.text);
  assert.ok(p.text.includes("USD RM4.08"), p.text);
  assert.ok(p.text.includes("KL 30°C"), p.text);
  assert.equal(p.url, "https://greatermalaysia.com/today");
  assert.ok(!p.text.includes("—"), "never share a dash");
});

test("today payload is null while fewer than three cards have loaded", async () => {
  const ctx = await loadToday({ fail: ["fuelprice", "frankfurter", "open-meteo", "coingecko", "cpi_headline", "air-quality"] });
  assert.equal(ctx.GM_SHARE_PAYLOAD(), null);
});

test("today payload heading is localized on BM pages", async () => {
  const ctx = await loadToday({ lang: "ms" });
  const p = ctx.GM_SHARE_PAYLOAD();
  assert.equal(p.title, "Malaysia sekarang");
});
