/* ============================================================
   Greater Malaysia — Answer page engine
   Renders the live widget + updates the dated answer line.
   Config comes from window.ANSWER = { type, ... }
   Shared helpers ($, esc, fmt, jget, myNow, sparkline, wireNav…)
   live in common.js — load it first.
   ============================================================ */

wireNav();

const A = window.ANSWER || {};
const ROUTE = { prayer: loadPrayer, fuel: loadFuel, fx: loadFX };
(ROUTE[A.type] || (() => {}))();

/* ---------- prayer ---------- */
const PRAYERS = [["imsak", "Imsak"], ["fajr", "Subuh"], ["syuruk", "Syuruk"], ["dhuhr", "Zohor"], ["asr", "Asar"], ["maghrib", "Maghrib"], ["isha", "Isyak"]];
async function loadPrayer() {
  const w = $("#ansWidget");
  try {
    const d = await jget(`https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=today&zone=${A.zone}`, 2, 600e3);
    const t = d.prayerTime?.[0]; if (!t) throw 0;
    const toMin = (h) => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };
    const now = myNow(); const nm = now.getHours() * 60 + now.getMinutes();
    const seq = ["fajr", "syuruk", "dhuhr", "asr", "maghrib", "isha"];
    let nextKey = seq.find(k => toMin(t[k]) > nm), activeKey = [...seq].reverse().find(k => toMin(t[k]) <= nm);
    let cd = "";
    if (nextKey) { let m = toMin(t[nextKey]) - nm, h = Math.floor(m / 60); cd = h ? `${h}j ${m % 60}m` : `${m % 60}m`; }
    const lbl = (k) => (PRAYERS.find(p => p[0] === k) || [, k])[1];
    setLive(nextKey ? `Next: ${lbl(nextKey)} at ${t[nextKey].slice(0, 5)} (in ${cd})` : `Isyak ${t.isha.slice(0, 5)}`, `${t.hijri} · ${t.date}`);
    w.innerHTML = `
      ${nextKey ? `<div class="prayer-next"><div><div class="pn-lab">${lbl(nextKey)}</div><div class="pn-name">next prayer · ${esc(t[nextKey].slice(0, 5))}</div></div><div class="pn-cd">${esc(cd)}</div></div>` : ""}
      <div class="prayer-list">${PRAYERS.filter(p => p[0] !== "dhuha").map(([k, n]) =>
      `<div class="prayer-row ${k === activeKey ? "active" : ""}"><span class="pr-name"><span class="pr-dot"></span>${n}</span><span class="pr-time">${esc(t[k].slice(0, 5))}</span></div>`).join("")}</div>`;
  } catch (e) { w.innerHTML = `<div class="tool-err">Couldn't reach JAKIM e-Solat. Refresh shortly.</div>`; }
}

/* ---------- fuel ---------- */
async function loadFuel() {
  const w = $("#ansWidget");
  try {
    const rows = await jget("https://api.data.gov.my/data-catalogue/?id=fuelprice&limit=6&sort=-date", 2, 36e5);
    const lvl = rows.find(r => r.series_type === "level"), chg = rows.find(r => r.series_type === "change_weekly");
    const cells = [["RON95", lvl.ron95_skps ?? lvl.ron95, chg?.ron95, "ceiling"], ["RON97", lvl.ron97, chg?.ron97], ["Diesel", lvl.diesel, chg?.diesel]];
    setLive(`RON95 RM${fmt(cells[0][1])} · RON97 RM${fmt(lvl.ron97)} · Diesel RM${fmt(lvl.diesel)} per litre`, `week of ${lvl.date}`);
    const ch = (c) => c == null || Math.abs(c) < 0.005 ? `<span class="fc-chg flat-c">— no change</span>` : `<span class="fc-chg ${c > 0 ? "down-c" : "up-c"}">${c > 0 ? "▲" : "▼"} ${fmt(Math.abs(c))}</span>`;
    w.innerHTML = `<div class="fuel-week">Week of ${esc(lvl.date)} · RM / litre</div><div class="fuel-grid">${cells.map(c =>
      `<div class="fuel-cell"><div class="fc-name">${c[0]}</div><div class="fc-price">${fmt(c[1])}</div><div class="fc-unit">RM / L${c[3] ? " · " + c[3] : ""}</div>${ch(c[2])}</div>`).join("")}</div>
      <div class="fuel-note">RON95 shown at the subsidised ceiling. RON97 &amp; diesel float weekly under the automatic pricing mechanism.</div>`;
  } catch (e) { w.innerHTML = `<div class="tool-err">Couldn't reach data.gov.my fuel feed.</div>`; }
}

/* ---------- fx ---------- */
const FX_PAIRS = ["USD", "SGD", "EUR", "GBP", "AUD", "JPY", "THB", "CNY"];
async function loadFX(base) {
  base = base || A.base || "USD";
  const w = $("#ansWidget");
  try {
    const latest = await jget(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=MYR`, 2, 600e3);
    const rate = latest.rates.MYR, end = latest.date;
    const start = new Date(new Date(end).getTime() - 31 * 864e5).toISOString().slice(0, 10);
    const ts = await jget(`https://api.frankfurter.dev/v1/${start}..${end}?base=${base}&symbols=MYR`, 2, 600e3);
    const vals = Object.keys(ts.rates).sort().map(k => ts.rates[k].MYR);
    const first = vals[0], last = vals[vals.length - 1], chg = (last - first) / first * 100, up = chg >= 0;
    setLive(`1 ${base} = RM ${fmt(rate, 4)}`, end);
    w.innerHTML = `<div class="fx-top"><span class="fx-big">RM ${fmt(rate, 4)}</span><span class="fx-eq">per 1 ${esc(base)}</span></div>
      <div class="fx-chg ${up ? "up-c" : "down-c"}">${up ? "▲" : "▼"} ${fmt(Math.abs(chg))}% over 30 days · ringgit ${up ? "weaker" : "stronger"}</div>
      <svg class="fx-spark" viewBox="0 0 320 70" preserveAspectRatio="none">${sparkline(vals, 320, 70)}</svg>
      <div class="fx-conv"><input type="number" id="fxAmt" value="100" min="0" /><span class="fx-conv-eq">${esc(base)} =</span><span class="fx-conv-out" id="fxOut">RM —</span></div>
      <div class="fx-pairs">${FX_PAIRS.map(p => `<button class="fx-pair ${p === base ? "active" : ""}" data-c="${p}">${p}</button>`).join("")}</div>`;
    const conv = () => { const a = parseFloat($("#fxAmt").value) || 0; $("#fxOut").textContent = `RM ${fmt(a * rate)}`; };
    $("#fxAmt").addEventListener("input", conv); conv();
    $$("#ansWidget .fx-pair").forEach(b => b.addEventListener("click", () => loadFX(b.dataset.c)));
  } catch (e) { w.innerHTML = `<div class="tool-err">Couldn't reach the FX feed.</div>`; }
}

function setLive(text, asof) {
  const l = $("#ansLive"); if (l) l.textContent = text;
  const a = $("#ansAsOf"); if (a) a.textContent = asof;
}
