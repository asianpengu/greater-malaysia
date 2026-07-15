// D4.3 — planner URL parameter resolution and normalization (cuti-url.mjs)
import test from "node:test";
import assert from "node:assert/strict";
import { parseLeaveParam, resolvePlannerParams, buildPlannerQuery, LEAVE_DEFAULT } from "../cuti-url.mjs";

test("a valid shared URL recreates the same state and leave budget", () => {
  const r = resolvePlannerParams("?state=png&leave=12", "kul");
  assert.deepEqual(r, { state: "png", leave: 12, stateFromQuery: true, leaveFromQuery: true });
});

test("invalid parameters safely use the stored preference or defaults", () => {
  const r = resolvePlannerParams("?state=atlantis&leave=nope", "sbh");
  assert.equal(r.state, "sbh");
  assert.equal(r.leave, LEAVE_DEFAULT);
  assert.equal(r.stateFromQuery, false);
  const r2 = resolvePlannerParams("", "not-a-state");
  assert.equal(r2.state, "kul");
});

test("the first recognized value wins for repeated parameters", () => {
  const r = resolvePlannerParams("?state=zz&state=trg&state=png&leave=99&leave=5", "kul");
  assert.equal(r.state, "trg");
  assert.equal(r.leave, 5, "99 is outside the UI range, 5 is the first valid value");
});

test("leave accepts base-10 integers only within the UI range", () => {
  assert.equal(parseLeaveParam("0"), 0);
  assert.equal(parseLeaveParam("30"), 30);
  assert.equal(parseLeaveParam("8"), 8);
  for (const bad of ["31", "-1", "+5", "5.5", "1e1", "08x", "[1,2]", "", null, undefined, "٨"]) {
    assert.equal(parseLeaveParam(bad), null, JSON.stringify(bad));
  }
});

test("normalized URLs keep recognized UTM parameters and drop everything else", () => {
  const q = buildPlannerQuery("?utm_source=whatsapp&utm_medium=social&fbclid=junk&state=old&state=old2&leave=3&x=1", "sgr", 10);
  const p = new URLSearchParams(q);
  assert.equal(p.get("utm_source"), "whatsapp");
  assert.equal(p.get("utm_medium"), "social");
  assert.equal(p.get("state"), "sgr");
  assert.equal(p.get("leave"), "10");
  assert.equal(p.getAll("state").length, 1, "no duplicate planner params");
  assert.ok(!p.has("fbclid") && !p.has("x"), "unsupported params removed");
});

test("query text never flows into the normalized URL", () => {
  const q = buildPlannerQuery('?state=<script>alert(1)</script>&leave=8"', "kul", 8);
  assert.ok(!q.includes("<script>"));
  assert.equal(new URLSearchParams(q).get("state"), "kul");
});
