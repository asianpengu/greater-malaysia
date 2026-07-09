/* Malaysian headline inflation (CPI), from DOSM via data.gov.my. */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=21600, s-maxage=21600");
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    const r = await fetch("https://api.data.gov.my/data-catalogue/?id=cpi_headline&limit=300&sort=-date");
    if (!r.ok) throw new Error(r.status);
    const rows = (await r.json()).filter((x) => x.division === "overall");
    const latest = rows[0], prior = rows[12];
    const yoy = prior ? ((latest.index / prior.index - 1) * 100) : null;
    res.status(200).json({
      dataset: "Consumer Price Index (headline inflation)",
      month: latest.date, index: latest.index, base: "2010 = 100",
      inflation_yoy_pct: yoy != null ? Number(yoy.toFixed(1)) : null,
      note: "Year-on-year change in the overall CPI. A positive figure means prices rose versus 12 months earlier.",
      source: { name: "DOSM via data.gov.my", url: "https://data.gov.my/data-catalogue/cpi_headline", retrieved: new Date().toISOString() },
      provider: "Greater Malaysia (greatermalaysia.com)"
    });
  } catch (e) { res.status(502).json({ error: "upstream unavailable", source: "data.gov.my" }); }
}
