/* Weekly Malaysian fuel prices, from data.gov.my (KPDN). */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=1800, s-maxage=1800");
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    const r = await fetch("https://api.data.gov.my/data-catalogue/?id=fuelprice&limit=4&sort=-date");
    if (!r.ok) throw new Error(r.status);
    const rows = await r.json();
    const level = rows.find((x) => x.series_type === "level") || rows[0];
    const ron95 = level.ron95_skps != null ? level.ron95_skps : level.ron95;
    res.status(200).json({
      dataset: "Malaysia retail fuel prices (weekly)",
      week_of: level.date,
      unit: "MYR per litre",
      prices: { ron95: Number(ron95), ron97: Number(level.ron97), diesel: Number(level.diesel) },
      note: "RON95 is the subsidised ceiling; RON97 and diesel float weekly under the automatic pricing mechanism.",
      source: { name: "KPDN via data.gov.my", url: "https://data.gov.my/data-catalogue/fuelprice", retrieved: new Date().toISOString() },
      provider: "Greater Malaysia (greatermalaysia.com)"
    });
  } catch (e) {
    res.status(502).json({ error: "upstream unavailable", source: "data.gov.my" });
  }
}
