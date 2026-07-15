// D4.1 — /api/holidays optional state parameter
import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/holidays.js";

const CODES = ["jhr", "kdh", "ktn", "mlk", "nsn", "phg", "prk", "pls", "png", "sbh", "swk", "sgr", "trg", "kul", "lbn", "pjy"];

function call(query = {}) {
  const res = {
    headers: {}, statusCode: 200, body: undefined,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    end() { return this; },
  };
  handler({ method: "GET", query }, res);
  return res;
}

test("a request without state keeps the existing national-only shape", () => {
  const res = call({ year: "2026" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.year, "2026");
  assert.equal(res.body.count, 17);
  assert.equal(res.body.holidays.length, 17);
  assert.ok(res.body.holidays.every((h) => h.date && h.name));
  assert.ok(res.body.source.url);
  assert.ok(!("state" in res.body), "no state field on the legacy path");
  assert.ok(res.headers["Cache-Control"].includes("max-age=86400"));
});

test("every valid state code returns a sorted union with scope and status per row", () => {
  for (const code of CODES) {
    const res = call({ year: "2026", state: code });
    assert.equal(res.statusCode, 200, code);
    assert.equal(res.body.state, code);
    assert.ok(res.body.state_name.en, code);
    const dates = res.body.holidays.map((h) => h.date);
    assert.deepEqual(dates, [...dates].sort(), `${code} sorted ascending`);
    for (const h of res.body.holidays) {
      assert.ok(h.date && h.name && h.scope && h.status, `${code} row shape`);
    }
    assert.equal(res.body.count, res.body.holidays.length, code);
  }
});

test("the union has no duplicate date+occasion rows", () => {
  for (const code of CODES) {
    const res = call({ year: "2026", state: code });
    const seen = new Set();
    for (const h of res.body.holidays) {
      const key = h.date + "|" + h.name;
      assert.ok(!seen.has(key), `${code} duplicate ${key}`);
      seen.add(key);
    }
  }
});

test("state unions carry the right state-specific rows", () => {
  const png = call({ year: "2026", state: "png" }).body;
  assert.ok(png.holidays.some((h) => h.date === "2026-07-07"), "George Town heritage day");
  assert.ok(png.holidays.some((h) => h.date === "2026-07-11"), "Penang YDP birthday");
  const jhr = call({ year: "2026", state: "jhr" }).body;
  assert.ok(!jhr.holidays.some((h) => h.date === "2026-01-01"), "no New Year in Johor");
  assert.ok(jhr.holidays.some((h) => h.date === "2026-03-23" && /Sultan of Johor/.test(h.name)));
  const swk = call({ year: "2026", state: "swk" }).body;
  assert.ok(!swk.holidays.some((h) => h.date === "2026-11-08"), "no Deepavali in Sarawak");
  assert.ok(swk.holidays.some((h) => h.date === "2026-07-22"), "Sarawak Independence Day");
});

test("case and whitespace in the state parameter are tolerated", () => {
  const res = call({ year: "2026", state: " PNG " });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.state, "png");
});

test("an unknown state returns HTTP 400 with the stable INVALID_STATE code and no stack trace", () => {
  for (const bad of ["zz", "selangor<script>", "12", ""]) {
    const res = call({ year: "2026", state: bad });
    assert.equal(res.statusCode, 400, JSON.stringify(bad));
    assert.equal(res.body.error.code, "INVALID_STATE");
    assert.ok(Array.isArray(res.body.error.valid_states));
    assert.ok(!JSON.stringify(res.body).includes("at "), "no stack trace leaks");
  }
});

test("unsupported years keep the endpoint's existing behavior", () => {
  const res = call({ year: "2031", state: "png" });
  assert.equal(res.statusCode, 404);
  assert.ok(res.body.error);
});

test("replacement days stay distinguished from the holiday itself", () => {
  const kul = call({ year: "2026", state: "kul" }).body;
  const rep = kul.holidays.find((h) => h.date === "2026-11-09");
  assert.equal(rep.status, "replacement");
  const deepavali = kul.holidays.find((h) => h.date === "2026-11-08");
  assert.equal(deepavali.status, "subject-to-confirmation");
});
