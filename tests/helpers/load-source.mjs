// Shared test loader: evaluates a browser script (common.js, today.js, app.js)
// inside a Node vm context with stubbed DOM, storage, timers and fetch, then
// hands back the named top-level bindings so tests can call them directly.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.join(fileURLToPath(import.meta.url), "..", "..", "..");

/* Map-backed Web Storage stub. opts.throwOn: "get" | "set" | "all" simulates
   private mode / quota errors. */
export function makeStorage(initial = {}, opts = {}) {
  const data = new Map(Object.entries(initial));
  const deny = (op) => opts.throwOn === op || opts.throwOn === "all";
  return {
    getItem(k) { if (deny("get")) throw new Error("storage denied"); return data.has(k) ? data.get(k) : null; },
    setItem(k, v) { if (deny("set")) throw new Error("storage denied"); data.set(k, String(v)); },
    removeItem(k) { data.delete(k); },
    clear() { data.clear(); },
    _data: data,
  };
}

/* Minimal element stub — enough for the code paths tests exercise. */
export function makeElement(tag = "div") {
  const el = {
    tagName: String(tag).toUpperCase(),
    children: [],
    style: {},
    dataset: {},
    attributes: {},
    listeners: {},
    textContent: "",
    innerHTML: "",
    value: "",
    hidden: false,
    disabled: false,
    classList: {
      _set: new Set(),
      add(...c) { c.forEach((x) => this._set.add(x)); },
      remove(...c) { c.forEach((x) => this._set.delete(x)); },
      toggle(c, force) { const on = force === undefined ? !this._set.has(c) : force; on ? this._set.add(c) : this._set.delete(c); return on; },
      contains(c) { return this._set.has(c); },
    },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; },
    removeAttribute(k) { delete this.attributes[k]; },
    hasAttribute(k) { return k in this.attributes; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    removeEventListener() {},
    dispatch(type, event = {}) { (this.listeners[type] || []).forEach((fn) => fn({ type, target: el, ...event })); },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); },
    insertAdjacentElement(_pos, c) { this.children.push(c); return c; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    focus() {},
    select() {},
    closest() { return null; },
  };
  return el;
}

/* Document stub backed by a selector map: { "#id": element, ".cls": element } */
export function makeDocument(selectors = {}, lang = "en") {
  return {
    readyState: "complete",
    documentElement: { lang },
    body: makeElement("body"),
    addEventListener() {},
    removeEventListener() {},
    createElement: (t) => makeElement(t),
    querySelector: (s) => selectors[s] || null,
    querySelectorAll: (s) => (selectors[s] ? [].concat(selectors[s]) : []),
    getElementById: (id) => selectors["#" + id] || null,
    execCommand() { return true; },
  };
}

/* Evaluate `file` (repo-relative) in a stubbed browser context.
   Returns { ctx, [each name in names] }. */
export function loadScript(file, { names = [], globals = {} } = {}) {
  const src = readFileSync(path.join(ROOT, file), "utf8");
  // Timers fire immediately so retry/backoff paths finish fast in tests.
  const immediateTimeout = (fn, _ms, ...a) => { Promise.resolve().then(() => fn(...a)); return 0; };
  const ctx = {
    console,
    document: makeDocument(),
    sessionStorage: makeStorage(),
    localStorage: makeStorage(),
    fetch: async () => { throw new Error("fetch not stubbed"); },
    setTimeout: immediateTimeout,
    clearTimeout() {},
    setInterval() { return 0; },
    clearInterval() {},
    requestAnimationFrame() { return 0; },
    performance: { now: () => 0 },
    location: { href: "https://greatermalaysia.com/", search: "", origin: "https://greatermalaysia.com", pathname: "/" },
    history: { replaceState() {} },
    navigator: {},
    AbortSignal: { timeout: () => undefined },
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
    Blob: class { constructor(parts, opts) { this.parts = parts; this.type = opts && opts.type; } },
    URL: { createObjectURL: () => "blob:test", revokeObjectURL: () => {} },
    ...globals,
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: file });
  const out = { ctx };
  for (const n of names) {
    out[n] = vm.runInContext(`typeof ${n} !== "undefined" ? ${n} : undefined`, ctx);
  }
  return out;
}
