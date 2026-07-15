// D2.1 — versioned no-login location preferences (common.js)
import test from "node:test";
import assert from "node:assert/strict";
import { loadScript, makeStorage } from "./helpers/load-source.mjs";

const NAMES = ["getPrefs", "setPrefs", "clearPrefs", "GM_PREFS_KEY", "GM_CITIES"];

function load(globals = {}) {
  return loadScript("common.js", { names: NAMES, globals });
}

test("first visit returns the Kuala Lumpur defaults", () => {
  const { getPrefs } = load();
  assert.deepEqual(JSON.parse(JSON.stringify(getPrefs())), { city: "kuala-lumpur", state: "kul" });
});

test("the storage key is exactly gm:prefs:v1", () => {
  const storage = makeStorage();
  const { setPrefs, GM_PREFS_KEY } = load({ localStorage: storage });
  assert.equal(GM_PREFS_KEY, "gm:prefs:v1");
  setPrefs({ city: "ipoh" });
  assert.ok(storage.getItem("gm:prefs:v1"), "written under the versioned key");
});

test("setPrefs merges: changing city preserves the existing state", () => {
  const storage = makeStorage();
  const { getPrefs, setPrefs } = load({ localStorage: storage });
  setPrefs({ state: "png" });
  setPrefs({ city: "ipoh" });
  const p = getPrefs();
  assert.equal(p.city, "ipoh");
  assert.equal(p.state, "png");
});

test("unknown keys and invalid city/state codes are discarded", () => {
  const storage = makeStorage();
  const { getPrefs, setPrefs } = load({ localStorage: storage });
  setPrefs({ city: "paris", state: "zz", theme: "dark" });
  assert.deepEqual(JSON.parse(JSON.stringify(getPrefs())), { city: "kuala-lumpur", state: "kul" });
  setPrefs({ city: "kuching" });
  const stored = JSON.parse(storage.getItem("gm:prefs:v1"));
  assert.ok(!("theme" in stored), "unknown fields never persisted");
});

test("corrupt JSON in storage falls back to defaults without throwing", () => {
  const storage = makeStorage({ "gm:prefs:v1": "{broken!!" });
  const { getPrefs } = load({ localStorage: storage });
  assert.deepEqual(JSON.parse(JSON.stringify(getPrefs())), { city: "kuala-lumpur", state: "kul" });
});

test("stored garbage shapes (arrays, numbers) fall back to defaults", () => {
  const storage = makeStorage({ "gm:prefs:v1": "[1,2,3]" });
  const { getPrefs } = load({ localStorage: storage });
  assert.deepEqual(JSON.parse(JSON.stringify(getPrefs())), { city: "kuala-lumpur", state: "kul" });
});

test("denied storage (private mode) breaks nothing", () => {
  const storage = makeStorage({}, { throwOn: "all" });
  const { getPrefs, setPrefs, clearPrefs } = load({ localStorage: storage });
  assert.doesNotThrow(() => { setPrefs({ city: "ipoh" }); clearPrefs(); });
  assert.deepEqual(JSON.parse(JSON.stringify(getPrefs())), { city: "kuala-lumpur", state: "kul" });
});

test("clearPrefs restores defaults", () => {
  const storage = makeStorage();
  const { getPrefs, setPrefs, clearPrefs } = load({ localStorage: storage });
  setPrefs({ city: "kota-kinabalu", state: "sbh" });
  clearPrefs();
  assert.deepEqual(JSON.parse(JSON.stringify(getPrefs())), { city: "kuala-lumpur", state: "kul" });
  assert.equal(storage.getItem("gm:prefs:v1"), null);
});

test("GM_CITIES keeps the existing eight cities with slug, name, lat and lon", () => {
  const { GM_CITIES } = load();
  const slugs = [...GM_CITIES.map((c) => c.slug)]; // re-wrap: vm arrays have a foreign prototype
  assert.deepEqual(slugs, ["kuala-lumpur", "george-town", "johor-bahru", "ipoh", "kuching", "kota-kinabalu", "malacca", "kuala-terengganu"]);
  for (const c of GM_CITIES) {
    assert.equal(typeof c.name, "string");
    assert.equal(typeof c.lat, "number");
    assert.equal(typeof c.lon, "number");
    assert.equal(typeof c.short, "string");
  }
});
