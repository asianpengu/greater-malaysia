// D1.1 — jgetMeta fetch metadata + backward-compatible jget (common.js)
import test from "node:test";
import assert from "node:assert/strict";
import { loadScript, makeStorage } from "./helpers/load-source.mjs";

const okFetch = (payload, calls = []) => async (url) => {
  calls.push(url);
  return { ok: true, json: async () => payload };
};

test("network success returns cacheState network with a fresh fetchedAt and writes the session cache", async () => {
  const calls = [];
  const { jgetMeta, ctx } = loadScript("common.js", {
    names: ["jgetMeta"],
    globals: { fetch: okFetch({ hello: 1 }, calls) },
  });
  const before = Date.now();
  const m = await jgetMeta("https://x.test/a");
  assert.equal(m.cacheState, "network");
  assert.equal(m.stale, false);
  assert.deepEqual(m.value, { hello: 1 });
  assert.ok(m.fetchedAt >= before && m.fetchedAt <= Date.now());
  assert.deepEqual(calls, ["https://x.test/a"]);
  const cached = JSON.parse(ctx.sessionStorage.getItem("gm:https://x.test/a"));
  assert.deepEqual(cached.v, { hello: 1 });
  assert.equal(cached.t, m.fetchedAt);
});

test("a valid session hit reports the original fetch time, not the current time", async () => {
  const t = Date.now() - 120000; // stored two minutes ago
  const calls = [];
  const { jgetMeta } = loadScript("common.js", {
    names: ["jgetMeta"],
    globals: {
      fetch: okFetch({ nope: true }, calls),
      sessionStorage: makeStorage({ "gm:https://x.test/a": JSON.stringify({ t, v: { cached: 1 } }) }),
    },
  });
  const m = await jgetMeta("https://x.test/a", 2, 600e3);
  assert.equal(m.cacheState, "session");
  assert.equal(m.stale, false);
  assert.equal(m.fetchedAt, t);
  // JSON round-trip: values parsed inside the vm realm have a foreign Object prototype
  assert.deepEqual(JSON.parse(JSON.stringify(m.value)), { cached: 1 });
  assert.equal(calls.length, 0, "session hit must not refetch");
});

test("an expired session record falls through to the network", async () => {
  const t = Date.now() - 120000;
  const calls = [];
  const { jgetMeta } = loadScript("common.js", {
    names: ["jgetMeta"],
    globals: {
      fetch: okFetch({ fresh: 1 }, calls),
      sessionStorage: makeStorage({ "gm:https://x.test/a": JSON.stringify({ t, v: { old: 1 } }) }),
    },
  });
  const m = await jgetMeta("https://x.test/a", 2, 60e3); // ttl 1 min < 2 min age
  assert.equal(m.cacheState, "network");
  assert.deepEqual(m.value, { fresh: 1 });
  assert.equal(calls.length, 1);
});

test("malformed session storage is ignored without an uncaught error", async () => {
  const calls = [];
  const { jgetMeta } = loadScript("common.js", {
    names: ["jgetMeta"],
    globals: {
      fetch: okFetch({ ok: 1 }, calls),
      sessionStorage: makeStorage({ "gm:https://x.test/a": "{not json!!" }),
    },
  });
  const m = await jgetMeta("https://x.test/a");
  assert.equal(m.cacheState, "network");
  assert.deepEqual(m.value, { ok: 1 });
});

test("denied storage still returns network data", async () => {
  const { jgetMeta } = loadScript("common.js", {
    names: ["jgetMeta"],
    globals: {
      fetch: okFetch({ ok: 2 }),
      sessionStorage: makeStorage({}, { throwOn: "all" }),
    },
  });
  const m = await jgetMeta("https://x.test/a");
  assert.equal(m.cacheState, "network");
  assert.deepEqual(m.value, { ok: 2 });
});

test("jget keeps returning raw JSON for existing callers", async () => {
  const { jget, ctx } = loadScript("common.js", {
    names: ["jget"],
    globals: { fetch: okFetch({ rates: { MYR: 4.08 } }) },
  });
  const v = await jget("https://x.test/fx");
  assert.deepEqual(v, { rates: { MYR: 4.08 } });
  // and a second call hits the session cache with the same raw shape
  const v2 = await jget("https://x.test/fx", 2, 600e3);
  assert.deepEqual(JSON.parse(JSON.stringify(v2)), { rates: { MYR: 4.08 } });
  assert.ok(ctx.sessionStorage.getItem("gm:https://x.test/fx"));
});

/* ---- D2.3: persistent last-known fallback ---- */

const LAST_KEY = "gm:last:v1:" + encodeURIComponent("https://x.test/a");

test("persistent data within its limit appears only after all retries fail", async () => {
  const t = Date.now() - 3600e3; // checked an hour ago
  const { jgetMeta } = loadScript("common.js", {
    names: ["jgetMeta"],
    globals: {
      fetch: async () => { throw new Error("down"); },
      localStorage: makeStorage({ [LAST_KEY]: JSON.stringify({ t, v: { last: 1 } }) }),
    },
  });
  const m = await jgetMeta("https://x.test/a", 1, 60e3, { persistent: true, maxStaleMs: 2 * 3600e3 });
  assert.equal(m.cacheState, "stale");
  assert.equal(m.stale, true);
  assert.equal(m.fetchedAt, t);
  assert.deepEqual(JSON.parse(JSON.stringify(m.value)), { last: 1 });
});

test("persistent data older than maxStaleMs is rejected and the error surfaces", async () => {
  const t = Date.now() - 3 * 3600e3;
  const { jgetMeta } = loadScript("common.js", {
    names: ["jgetMeta"],
    globals: {
      fetch: async () => { throw new Error("down"); },
      localStorage: makeStorage({ [LAST_KEY]: JSON.stringify({ t, v: { last: 1 } }) }),
    },
  });
  await assert.rejects(() => jgetMeta("https://x.test/a", 0, 60e3, { persistent: true, maxStaleMs: 2 * 3600e3 }), /down/);
});

test("a network success is preferred over persistent data and replaces the stale record", async () => {
  const old = Date.now() - 3600e3;
  const storage = makeStorage({ [LAST_KEY]: JSON.stringify({ t: old, v: { last: 1 } }) });
  const { jgetMeta } = loadScript("common.js", {
    names: ["jgetMeta"],
    globals: { fetch: okFetch({ fresh: 1 }), localStorage: storage },
  });
  const m = await jgetMeta("https://x.test/a", 0, 60e3, { persistent: true, maxStaleMs: 2 * 3600e3 });
  assert.equal(m.cacheState, "network");
  const rec = JSON.parse(storage.getItem(LAST_KEY));
  assert.deepEqual(rec.v, { fresh: 1 });
  assert.ok(rec.t > old);
});

test("unavailable localStorage neither breaks success nor failure paths", async () => {
  const denied = makeStorage({}, { throwOn: "all" });
  const ok = loadScript("common.js", { names: ["jgetMeta"], globals: { fetch: okFetch({ x: 1 }), localStorage: denied } });
  const m = await ok.jgetMeta("https://x.test/a", 0, 60e3, { persistent: true, maxStaleMs: 60e3 });
  assert.equal(m.cacheState, "network");
  const bad = loadScript("common.js", { names: ["jgetMeta"], globals: { fetch: async () => { throw new Error("down"); }, localStorage: denied } });
  await assert.rejects(() => bad.jgetMeta("https://x.test/a", 0, 60e3, { persistent: true, maxStaleMs: 60e3 }), /down/);
});

test("all retries failing rejects with the underlying error", async () => {
  let calls = 0;
  const { jgetMeta } = loadScript("common.js", {
    names: ["jgetMeta"],
    globals: { fetch: async () => { calls++; throw new Error("boom"); } },
  });
  await assert.rejects(() => jgetMeta("https://x.test/a", 2), /boom/);
  assert.equal(calls, 3, "initial try plus two retries");
});
