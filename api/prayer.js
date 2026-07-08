/* Prayer times (waktu solat) today, from JAKIM e-Solat. */
const ZONES = { "kuala-lumpur": "WLY01", "putrajaya": "WLY01", "selangor": "SGR01", "pulau-pinang": "PNG01", "penang": "PNG01", "johor-bahru": "JHR02", "ipoh": "PRK02", "kuching": "SWK08", "kota-kinabalu": "SBH07", "melaka": "MLK01", "kuantan": "PHG02", "kota-bharu": "KTN01" };
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
  if (req.method === "OPTIONS") return res.status(204).end();
  const city = (req.query.city || "").toLowerCase();
  const zone = (req.query.zone || ZONES[city] || "WLY01").toUpperCase().replace(/[^A-Z0-9]/g, "");
  try {
    const r = await fetch(`https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=today&zone=${zone}`);
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    const t = d.prayerTime && d.prayerTime[0];
    if (!t) throw new Error("no data");
    const clip = (s) => (s || "").slice(0, 5);
    res.status(200).json({
      dataset: "Prayer times (waktu solat), today",
      zone, date: t.date, hijri: t.hijri,
      times: { imsak: clip(t.imsak), subuh: clip(t.fajr), syuruk: clip(t.syuruk), zohor: clip(t.dhuhr), asar: clip(t.asr), maghrib: clip(t.maghrib), isyak: clip(t.isha) },
      source: { name: "JAKIM e-Solat", url: "https://www.e-solat.gov.my", retrieved: new Date().toISOString() },
      provider: "Greater Malaysia (greatermalaysia.com)"
    });
  } catch (e) {
    res.status(502).json({ error: "upstream unavailable", source: "JAKIM e-Solat", zone });
  }
}
