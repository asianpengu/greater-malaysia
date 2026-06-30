/* "Today in Malaysia" — live snapshot pulling every key number into one view. */
const $ = (s, r = document) => r.querySelector(s);
const fmt = (n, d = 2) => Number(n).toLocaleString("en-MY", { minimumFractionDigits: d, maximumFractionDigits: d });
const jget = async (u, retries = 2) => { for (let i = 0; ; i++) { try { const r = await fetch(u); if (!r.ok) throw 0; return await r.json(); } catch (e) { if (i >= retries) throw e; await new Promise(z => setTimeout(z, 500 + i * 600)); } } };
const myNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));

(function nav() { const n = $("#nav"); const f = () => n.classList.toggle("scrolled", (window.scrollY || document.documentElement.scrollTop) > 24); window.addEventListener("scroll", f, { passive: true }); f(); })();
$("#todayDate").textContent = myNow().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const clock = () => $("#todayClock").textContent = myNow().toLocaleTimeString("en-GB", { hour12: false }); clock(); setInterval(clock, 1000);

function card(id, kicker, en) { return `<div class="today-card" id="${id}"><div class="tc-k">${kicker}</div><div class="tc-en">${en}</div><div class="tc-body"><div class="tc-load">…</div></div></div>`; }
$("#todayGrid").innerHTML = [
  card("tSolat", "Waktu Solat", "next prayer · KL"),
  card("tFuel", "Harga Minyak", "this week · RM/L"),
  card("tFx", "Ringgit", "1 USD in MYR"),
  card("tWx", "Cuaca KL", "now"),
  card("tAir", "Udara KL", "air quality"),
  card("tBtc", "Bitcoin", "in ringgit"),
  card("tCpi", "Inflasi", "cost of living"),
  card("tPop", "Rakyat", "population"),
].join("");
const set = (id, html) => { const b = $(`#${id} .tc-body`); if (b) b.innerHTML = html; };

(async () => {
  // staggered to respect rate limits
  try { const d = await jget("https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=today&zone=WLY01"); const t = d.prayerTime[0];
    const seq = [["fajr", "Subuh"], ["syuruk", "Syuruk"], ["dhuhr", "Zohor"], ["asr", "Asar"], ["maghrib", "Maghrib"], ["isha", "Isyak"]];
    const now = myNow(); const nm = now.getHours() * 60 + now.getMinutes(); const toMin = h => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };
    const nx = seq.find(([k]) => toMin(t[k]) > nm) || seq[0];
    set("tSolat", `<div class="tc-big">${t[nx[0]].slice(0, 5)}</div><div class="tc-sub">${nx[1]}</div>`);
  } catch (e) { set("tSolat", `<div class="tc-err">—</div>`); }

  await new Promise(r => setTimeout(r, 150));
  try { const rows = await jget("https://api.data.gov.my/data-catalogue/?id=fuelprice&limit=4&sort=-date"); const l = rows.find(r => r.series_type === "level");
    set("tFuel", `<div class="tc-row3"><span>RON95<b>${fmt(l.ron95_skps ?? l.ron95)}</b></span><span>RON97<b>${fmt(l.ron97)}</b></span><span>Diesel<b>${fmt(l.diesel)}</b></span></div>`);
  } catch (e) { set("tFuel", `<div class="tc-err">—</div>`); }

  await new Promise(r => setTimeout(r, 150));
  try { const d = await jget("https://api.frankfurter.dev/v1/latest?base=USD&symbols=MYR"); set("tFx", `<div class="tc-big">RM ${fmt(d.rates.MYR, 4)}</div><div class="tc-sub">per 1 USD</div>`); } catch (e) { set("tFx", `<div class="tc-err">—</div>`); }

  await new Promise(r => setTimeout(r, 200));
  try {
    const [wx, air] = await Promise.all([
      jget("https://api.open-meteo.com/v1/forecast?latitude=3.139&longitude=101.687&current=temperature_2m,weather_code,relative_humidity_2m&timezone=Asia%2FKuala_Lumpur"),
      jget("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=3.139&longitude=101.687&current=us_aqi")
    ]);
    const WX = { 0: "☀️", 1: "🌤", 2: "⛅", 3: "☁️", 45: "🌫", 51: "🌦", 53: "🌦", 55: "🌧", 61: "🌦", 63: "🌧", 65: "🌧", 80: "🌦", 81: "🌧", 82: "⛈", 95: "⛈", 96: "⛈", 99: "⛈" };
    set("tWx", `<div class="tc-big">${Math.round(wx.current.temperature_2m)}° ${WX[wx.current.weather_code] || "🌡"}</div><div class="tc-sub">humidity ${wx.current.relative_humidity_2m}%</div>`);
    const aqi = Math.round(air.current.us_aqi); const band = aqi <= 50 ? "Good" : aqi <= 100 ? "Moderate" : aqi <= 150 ? "Unhealthy (sensitive)" : "Unhealthy";
    set("tAir", `<div class="tc-big">${aqi}</div><div class="tc-sub">US AQI · ${band}</div>`);
  } catch (e) { set("tWx", `<div class="tc-err">—</div>`); set("tAir", `<div class="tc-err">—</div>`); }

  await new Promise(r => setTimeout(r, 500));
  try { const d = await jget("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=myr&include_24hr_change=true");
    const c = d.bitcoin.myr_24h_change ?? 0; set("tBtc", `<div class="tc-big">RM ${fmt(d.bitcoin.myr, 0)}</div><div class="tc-sub ${c >= 0 ? "up-c" : "down-c"}">${c >= 0 ? "▲" : "▼"} ${fmt(Math.abs(c), 1)}% 24h</div>`);
  } catch (e) { set("tBtc", `<div class="tc-err">—</div>`); }

  await new Promise(r => setTimeout(r, 200));
  try { const rows = await jget("https://api.data.gov.my/data-catalogue/?id=cpi_headline&limit=400&sort=-date"); const o = rows.filter(r => r.division === "overall"); const ld = o[0].date.slice(0, 7); const ya = o.find(r => r.date.slice(0, 7) === `${+ld.slice(0, 4) - 1}${ld.slice(4)}`);
    const yoy = ya ? (o[0].index / ya.index - 1) * 100 : null; set("tCpi", `<div class="tc-big">${yoy >= 0 ? "+" : ""}${fmt(yoy, 1)}%</div><div class="tc-sub">inflation, year-on-year</div>`);
  } catch (e) { set("tCpi", `<div class="tc-err">—</div>`); }

  set("tPop", `<div class="tc-big">34.2M</div><div class="tc-sub">people · 2025</div>`);
})();
