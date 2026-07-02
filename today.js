/* "Today in Malaysia" — live snapshot pulling every key number into one view.
   Shared helpers ($, esc, fmt, jget, myNow, wireNav…) live in common.js. */

wireNav();
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
  try { const d = await jget("https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=today&zone=WLY01", 2, 600e3); const t = d.prayerTime[0];
    const seq = [["fajr", "Subuh"], ["syuruk", "Syuruk"], ["dhuhr", "Zohor"], ["asr", "Asar"], ["maghrib", "Maghrib"], ["isha", "Isyak"]];
    const now = myNow(); const nm = now.getHours() * 60 + now.getMinutes(); const toMin = h => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };
    const nx = seq.find(([k]) => toMin(t[k]) > nm);
    if (nx) set("tSolat", `<div class="tc-big">${esc(t[nx[0]].slice(0, 5))}</div><div class="tc-sub">${nx[1]}</div>`);
    else set("tSolat", `<div class="tc-big">${esc(t.fajr.slice(0, 5))}</div><div class="tc-sub">Subuh (esok)</div>`); // after Isyak — tomorrow's dawn
  } catch (e) { set("tSolat", `<div class="tc-err">—</div>`); }

  await sleep(150);
  try { const rows = await jget("https://api.data.gov.my/data-catalogue/?id=fuelprice&limit=4&sort=-date", 2, 36e5); const l = rows.find(r => r.series_type === "level");
    set("tFuel", `<div class="tc-row3"><span>RON95<b>${fmt(l.ron95_skps ?? l.ron95)}</b></span><span>RON97<b>${fmt(l.ron97)}</b></span><span>Diesel<b>${fmt(l.diesel)}</b></span></div>`);
  } catch (e) { set("tFuel", `<div class="tc-err">—</div>`); }

  await sleep(150);
  try { const d = await jget("https://api.frankfurter.dev/v1/latest?base=USD&symbols=MYR", 2, 600e3); set("tFx", `<div class="tc-big">RM ${fmt(d.rates.MYR, 4)}</div><div class="tc-sub">per 1 USD</div>`); } catch (e) { set("tFx", `<div class="tc-err">—</div>`); }

  await sleep(200);
  try {
    const [wx, air] = await Promise.all([
      jget("https://api.open-meteo.com/v1/forecast?latitude=3.139&longitude=101.687&current=temperature_2m,weather_code,relative_humidity_2m&timezone=Asia%2FKuala_Lumpur", 2, 300e3),
      jget("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=3.139&longitude=101.687&current=us_aqi", 2, 300e3)
    ]);
    const WX = { 0: "☀️", 1: "🌤", 2: "⛅", 3: "☁️", 45: "🌫", 51: "🌦", 53: "🌦", 55: "🌧", 61: "🌦", 63: "🌧", 65: "🌧", 80: "🌦", 81: "🌧", 82: "⛈", 95: "⛈", 96: "⛈", 99: "⛈" };
    set("tWx", `<div class="tc-big">${Math.round(wx.current.temperature_2m)}° ${WX[wx.current.weather_code] || "🌡"}</div><div class="tc-sub">humidity ${Math.round(wx.current.relative_humidity_2m)}%</div>`);
    const aqi = Math.round(air.current.us_aqi); const band = aqi <= 50 ? "Good" : aqi <= 100 ? "Moderate" : aqi <= 150 ? "Unhealthy (sensitive)" : "Unhealthy";
    set("tAir", `<div class="tc-big">${aqi}</div><div class="tc-sub">US AQI · ${band}</div>`);
  } catch (e) { set("tWx", `<div class="tc-err">—</div>`); set("tAir", `<div class="tc-err">—</div>`); }

  await sleep(500);
  try { const d = await jget("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=myr&include_24hr_change=true", 2, 60e3);
    const c = d.bitcoin.myr_24h_change ?? 0; set("tBtc", `<div class="tc-big">RM ${fmt(d.bitcoin.myr, 0)}</div><div class="tc-sub ${c >= 0 ? "up-c" : "down-c"}">${c >= 0 ? "▲" : "▼"} ${fmt(Math.abs(c), 1)}% 24h</div>`);
  } catch (e) { set("tBtc", `<div class="tc-err">—</div>`); }

  await sleep(200);
  try { const rows = await jget("https://api.data.gov.my/data-catalogue/?id=cpi_headline&limit=400&sort=-date", 2, 36e5); const o = rows.filter(r => r.division === "overall"); const ld = o[0].date.slice(0, 7); const ya = o.find(r => r.date.slice(0, 7) === `${+ld.slice(0, 4) - 1}${ld.slice(4)}`);
    const yoy = ya ? (o[0].index / ya.index - 1) * 100 : null;
    if (yoy == null) set("tCpi", `<div class="tc-err">—</div>`);
    else set("tCpi", `<div class="tc-big">${yoy >= 0 ? "+" : ""}${fmt(yoy, 1)}%</div><div class="tc-sub">inflation, year-on-year</div>`);
  } catch (e) { set("tCpi", `<div class="tc-err">—</div>`); }

  await sleep(200);
  try { const rows = await jget("https://api.data.gov.my/data-catalogue/?id=population_malaysia&limit=40&sort=-date", 2, 36e5); const ld = rows[0].date;
    const total = rows.find(r => r.date === ld && r.sex === "both" && r.age === "overall" && r.ethnicity === "overall").population;
    set("tPop", `<div class="tc-big">${fmt(total / 1000, 1)}M</div><div class="tc-sub">people · ${esc(ld.slice(0, 4))}</div>`);
  } catch (e) { set("tPop", `<div class="tc-big">34.2M</div><div class="tc-sub">people · 2025</div>`); } // static fallback if DOSM is down
})();
