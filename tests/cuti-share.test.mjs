// D5.2 — result-aware cuti sharing and bounded analytics parameters
import test from "node:test";
import assert from "node:assert/strict";
import { buildCutiShare, cutiPlanParams, calendarExportParams } from "../cuti-url.mjs";

const RESULT = {
  state: "png",
  budget: 8,
  plan: { spent: 7, daysOff: 38, leaveDates: ["2026-03-19", "2026-03-24", "2026-05-25"], chosenStarts: ["2026-03-14"] },
};

test("the share payload names the state, leave spent, days off and the normalized URL", () => {
  const p = buildCutiShare({ locale: "en", stateName: "Penang", state: "png", leave: 8, spent: 7, daysOff: 38, origin: "https://greatermalaysia.com", path: "/cuti-planner" });
  assert.equal(p.title, "Cuti Planner 2026");
  assert.equal(p.text, "Penang: 7 leave days → 38 days off in 2026");
  assert.equal(p.url, "https://greatermalaysia.com/cuti-planner?state=png&leave=8");
  assert.equal(p.personalized, true);
  assert.ok(!/max|best|optimal|save/i.test(p.text), "no unproven efficiency claims");
});

test("BM and Chinese payloads are natural and keep their language path", () => {
  const ms = buildCutiShare({ locale: "ms", stateName: "Pulau Pinang", state: "png", leave: 8, spent: 7, daysOff: 38, origin: "https://greatermalaysia.com", path: "/ms/cuti-planner" });
  assert.equal(ms.text, "Pulau Pinang: 7 hari cuti → 38 hari bercuti pada 2026");
  assert.ok(ms.url.startsWith("https://greatermalaysia.com/ms/cuti-planner?"));
  const zh = buildCutiShare({ locale: "zh", stateName: "槟城", state: "png", leave: 8, spent: 7, daysOff: 38, origin: "https://greatermalaysia.com", path: "/zh/cuti-planner" });
  assert.equal(zh.text, "槟城：7 天年假 → 2026 年共 38 天假期");
  assert.ok(zh.url.includes("/zh/cuti-planner?state=png&leave=8"));
});

test("hostile state or leave values are normalized before entering the share URL", () => {
  const p = buildCutiShare({ locale: "en", stateName: "X", state: "<script>", leave: "999", spent: 0, daysOff: 0, origin: "https://greatermalaysia.com", path: "/cuti-planner" });
  assert.ok(!p.url.includes("<"));
  assert.equal(new URL(p.url).searchParams.get("state"), "kul");
  assert.equal(new URL(p.url).searchParams.get("leave"), "8");
});

test("cuti_plan parameters are the bounded allowlist only", () => {
  const params = cutiPlanParams(RESULT);
  assert.deepEqual(params, { state: "png", leave_budget: 8, leave_spent: 7, days_off: 38 });
  for (const v of Object.values(params)) assert.ok(typeof v === "string" || typeof v === "number");
  assert.ok(!JSON.stringify(params).includes("2026-03"), "no dates in analytics");
});

test("calendar_export parameters carry counts, never dates", () => {
  const params = calendarExportParams(RESULT);
  assert.deepEqual(params, { state: "png", leave_days: 3, events: 3 });
});
