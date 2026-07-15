// D4.1 — structural + factual validation of data/public-holidays-2026.json
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const DATA = JSON.parse(readFileSync(new URL("../data/public-holidays-2026.json", import.meta.url), "utf8"));
const CODES = ["jhr", "kdh", "ktn", "mlk", "nsn", "phg", "prk", "pls", "png", "sbh", "swk", "sgr", "trg", "kul", "lbn", "pjy"];
const FRISAT = ["jhr", "kdh", "ktn", "trg"];
const STATUSES = new Set(["gazetted", "subject-to-confirmation", "replacement"]);

test("all 16 jurisdiction codes are present with localized names and weekend days", () => {
  assert.equal(DATA.year, 2026);
  assert.match(DATA.verified_at, /^\d{4}-\d{2}-\d{2}$/);
  for (const code of CODES) {
    const j = DATA.jurisdictions[code];
    assert.ok(j, `missing jurisdiction ${code}`);
    for (const lang of ["en", "ms", "zh"]) assert.ok(j.name[lang] && j.name[lang].length > 0, `${code} name.${lang}`);
    const expected = FRISAT.includes(code) ? [5, 6] : [0, 6];
    assert.deepEqual(j.weekend_days, expected, `${code} weekend`);
  }
  assert.equal(Object.keys(DATA.jurisdictions).length, 16, "no extra jurisdictions");
});

test("every row has a valid ISO date, three non-empty names, scope, status and a resolvable source", () => {
  for (const [code, j] of Object.entries(DATA.jurisdictions)) {
    for (const h of j.holidays) {
      assert.match(h.date, /^2026-\d{2}-\d{2}$/, `${code} ${h.date}`);
      assert.ok(!Number.isNaN(Date.parse(h.date)), `${code} ${h.date} parses`);
      for (const lang of ["en", "ms", "zh"]) assert.ok(h.name[lang] && h.name[lang].length > 0, `${code} ${h.date} name.${lang}`);
      assert.ok(["national", "state"].includes(h.scope), `${code} ${h.date} scope`);
      assert.ok(STATUSES.has(h.status), `${code} ${h.date} status ${h.status}`);
      const src = DATA.sources[h.source_index];
      assert.ok(src && src.url.startsWith("https://"), `${code} ${h.date} source URL`);
    }
  }
});

test("rows are sorted ascending by date with no duplicate date+occasion", () => {
  for (const [code, j] of Object.entries(DATA.jurisdictions)) {
    const dates = j.holidays.map((h) => h.date);
    assert.deepEqual(dates, [...dates].sort(), `${code} sorted`);
    const seen = new Set();
    for (const h of j.holidays) {
      const key = h.date + "|" + h.name.en;
      assert.ok(!seen.has(key), `${code} duplicate ${key}`);
      seen.add(key);
    }
  }
});

test("verified facts from the official 2026 schedule hold", () => {
  const has = (code, date, en) => DATA.jurisdictions[code].holidays.some((h) => h.date === date && (!en || h.name.en.includes(en)));
  // New Year's Day is not a holiday in Johor, Kedah, Kelantan, Perlis, Terengganu
  for (const c of ["jhr", "kdh", "ktn", "pls", "trg"]) assert.ok(!has(c, "2026-01-01"), c);
  for (const c of ["kul", "sgr", "png", "sbh", "swk"]) assert.ok(has(c, "2026-01-01"), c);
  // Deepavali is not observed in Sarawak
  assert.ok(!has("swk", "2026-11-08"));
  assert.ok(has("kul", "2026-11-08", "Deepavali"));
  // Hari Raya Haji 2nd day: Kedah, Kelantan, Perlis, Terengganu only
  for (const c of CODES) assert.equal(has(c, "2026-05-28"), ["kdh", "ktn", "pls", "trg"].includes(c), c);
  // Aidilfitri 3rd day is Melaka's; Johor shares the date with the Sultan's birthday
  assert.ok(has("mlk", "2026-03-23", "3rd Day"));
  assert.ok(has("jhr", "2026-03-23", "Sultan of Johor"));
  assert.ok(!has("ktn", "2026-03-23", "3rd Day"));
  // Penang extras
  assert.ok(has("png", "2026-07-07", "Heritage"));
  assert.ok(has("png", "2026-07-11"));
  // Thaipusam applies to exactly 7 jurisdictions
  const thaipusam = CODES.filter((c) => DATA.jurisdictions[c].holidays.some((h) => h.name.en === "Thaipusam"));
  assert.deepEqual(thaipusam.sort(), ["jhr", "kul", "nsn", "pjy", "png", "prk", "sgr"]);
  // lunar-dependent dates carry subject-to-confirmation
  for (const c of ["kul", "trg"]) {
    const raya = DATA.jurisdictions[c].holidays.find((h) => h.date === "2026-03-21");
    assert.equal(raya.status, "subject-to-confirmation");
  }
  // replacement days are marked as such and never claimed as gazetted
  const rep = DATA.jurisdictions.kul.holidays.find((h) => h.date === "2026-03-23");
  assert.equal(rep.status, "replacement");
  // Deepavali replacement doesn't apply in Friday–Saturday weekend states or Sarawak
  for (const c of ["jhr", "kdh", "ktn", "trg", "swk"]) assert.ok(!has(c, "2026-11-09"), c);
  assert.ok(has("kul", "2026-11-09"));
});
