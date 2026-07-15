// D4.2 — pure cuti-engine coverage
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildOpportunities, optimizePlan } from "../cuti-engine.mjs";

const H = (...pairs) => pairs.map(([date, name]) => ({ date, name }));

test("a Tuesday holiday with a Saturday–Sunday weekend bridges Monday for one leave day", () => {
  const opps = buildOpportunities({ year: 2026, holidays: H(["2026-01-06", "X"]), weekendDays: [0, 6] });
  assert.equal(opps.length, 1);
  assert.deepEqual(opps[0], { start: "2026-01-03", end: "2026-01-06", off: 4, leave: 1, leaveDays: ["2026-01-05"], hols: ["X"] });
});

test("the same holiday with a Friday–Saturday weekend bridges its working Sunday", () => {
  const opps = buildOpportunities({ year: 2026, holidays: H(["2026-01-06", "X"]), weekendDays: [5, 6] });
  assert.equal(opps.length, 1);
  assert.equal(opps[0].start, "2026-01-02"); // Fri (weekend there)
  assert.equal(opps[0].end, "2026-01-10"); // greedy bridging reaches the next Fri–Sat weekend
  assert.equal(opps[0].leave, 4);
  // Sunday and Monday are working days in Fri–Sat weekend states
  assert.deepEqual(opps[0].leaveDays, ["2026-01-04", "2026-01-05", "2026-01-07", "2026-01-08"]);
});

test("adjacent holidays merge into a single opportunity and are never double-counted", () => {
  const opps = buildOpportunities({
    year: 2026,
    holidays: H(["2026-02-17", "CNY"], ["2026-02-18", "CNY 2"]),
    weekendDays: [0, 6],
  });
  assert.equal(opps.length, 1);
  assert.deepEqual(opps[0].hols, ["CNY", "CNY 2"]);
  assert.equal(opps[0].start, "2026-02-14"); // Sat before
  assert.equal(opps[0].end, "2026-02-22"); // bridged through the following weekend
  assert.equal(opps[0].leave, 3); // Mon 16 + Thu 19 + Fri 20
  assert.equal(opps[0].off, 9);
});

test("two holidays on one date (e.g. Thaipusam + Federal Territory Day) both appear once", () => {
  const opps = buildOpportunities({
    year: 2026,
    holidays: H(["2026-02-01", "Thaipusam"], ["2026-02-01", "Federal Territory Day"]),
    weekendDays: [0, 6],
  });
  assert.equal(opps.length, 1);
  assert.deepEqual(opps[0].hols.sort(), ["Federal Territory Day", "Thaipusam"]);
});

test("replacement days extend the same cluster rather than forming a duplicate", () => {
  const opps = buildOpportunities({
    year: 2026,
    holidays: H(["2026-11-08", "Deepavali"], ["2026-11-09", "Deepavali (replacement)"]),
    weekendDays: [0, 6],
  });
  assert.equal(opps.length, 1);
  assert.equal(opps[0].start, "2026-11-07"); // Sat
  assert.equal(opps[0].end, "2026-11-09"); // Mon replacement
  assert.equal(opps[0].leave, 0, "a free long weekend");
});

test("opportunities never overlap and no leave date is counted twice", () => {
  const rows = JSON.parse(readFileSync(new URL("../data/public-holidays-2026.json", import.meta.url), "utf8"));
  for (const code of ["kul", "trg", "sbh"]) {
    const jur = rows.jurisdictions[code];
    const opps = buildOpportunities({
      year: 2026,
      holidays: jur.holidays.map((h) => ({ date: h.date, name: h.name.en })),
      weekendDays: jur.weekend_days,
    });
    const allLeave = opps.flatMap((o) => o.leaveDays);
    assert.equal(new Set(allLeave).size, allLeave.length, `${code} duplicate leave dates`);
    for (let i = 1; i < opps.length; i++) {
      assert.ok(opps[i].start > opps[i - 1].end, `${code} overlap at ${opps[i].start}`);
    }
  }
});

test("budget zero selects only the free long weekends", () => {
  const opps = buildOpportunities({
    year: 2026,
    holidays: H(["2026-01-06", "Paid"], ["2026-11-08", "Free"], ["2026-11-09", "Free (replacement)"]),
    weekendDays: [0, 6],
  });
  const plan = optimizePlan({ opportunities: opps, leaveBudget: 0 });
  assert.equal(plan.spent, 0);
  assert.deepEqual(plan.leaveDates, []);
  assert.equal(plan.daysOff, 3); // Sat 7 – Mon 9 Nov
});

test("budget exhaustion picks the best affordable subset deterministically", () => {
  const opps = [
    { start: "2026-01-05", end: "2026-01-06", off: 4, leave: 2, leaveDays: ["2026-01-05", "2026-01-06"], hols: ["A"] },
    { start: "2026-03-02", end: "2026-03-03", off: 9, leave: 3, leaveDays: ["2026-03-02", "2026-03-03", "2026-03-04"], hols: ["B"] },
    { start: "2026-06-01", end: "2026-06-02", off: 5, leave: 2, leaveDays: ["2026-06-01", "2026-06-02"], hols: ["C"] },
  ];
  const plan = optimizePlan({ opportunities: opps, leaveBudget: 4 });
  assert.equal(plan.daysOff, 9); // A+C (4 leave → 9 off) beats B alone (3 leave → 9 off)? equal off, fewer leave wins: B
  assert.equal(plan.spent, 3, "ties prefer fewer leave days");
  assert.deepEqual(plan.chosenStarts, ["2026-03-02"]);
  const again = optimizePlan({ opportunities: opps, leaveBudget: 4 });
  assert.deepEqual(plan, again, "deterministic");
});

test("year boundaries: 1 January and Christmas clusters stay inside valid ranges", () => {
  const opps = buildOpportunities({
    year: 2026,
    holidays: H(["2026-01-01", "New Year"], ["2026-12-25", "Christmas"]),
    weekendDays: [0, 6],
  });
  const first = opps[0], last = opps[opps.length - 1];
  assert.ok(first.start <= "2026-01-01" && first.end >= "2026-01-01");
  assert.ok(last.end >= "2026-12-25");
  for (const o of opps) for (const d of o.leaveDays) assert.ok(!Number.isNaN(Date.parse(d)));
});

test("results are identical regardless of holiday display language", () => {
  const data = JSON.parse(readFileSync(new URL("../data/public-holidays-2026.json", import.meta.url), "utf8"));
  const jur = data.jurisdictions.png;
  const plans = ["en", "ms", "zh"].map((lang) => {
    const opps = buildOpportunities({
      year: 2026,
      holidays: jur.holidays.map((h) => ({ date: h.date, name: h.name[lang] })),
      weekendDays: jur.weekend_days,
    });
    const plan = optimizePlan({ opportunities: opps, leaveBudget: 8 });
    return { spent: plan.spent, daysOff: plan.daysOff, leaveDates: plan.leaveDates, starts: plan.chosenStarts };
  });
  assert.deepEqual(plans[0], plans[1]);
  assert.deepEqual(plans[0], plans[2]);
});

test("engine does not mutate its arguments", () => {
  const holidays = H(["2026-01-06", "X"]);
  const frozen = JSON.stringify(holidays);
  const opps = buildOpportunities({ year: 2026, holidays, weekendDays: [0, 6] });
  optimizePlan({ opportunities: opps, leaveBudget: 5 });
  assert.equal(JSON.stringify(holidays), frozen);
});
