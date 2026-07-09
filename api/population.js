/* Malaysia's population, from DOSM via data.gov.my. */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    const r = await fetch("https://api.data.gov.my/data-catalogue/?id=population_malaysia&limit=60&sort=-date");
    if (!r.ok) throw new Error(r.status);
    const rows = await r.json();
    const o = rows.find((x) => x.age === "overall" && x.sex === "both" && x.ethnicity === "overall");
    if (!o) throw new Error("no overall");
    res.status(200).json({
      dataset: "Malaysia population",
      year: String(o.date).slice(0, 4),
      population: Math.round(o.population * 1000),
      population_millions: Number((o.population / 1000).toFixed(2)),
      source: { name: "DOSM via data.gov.my", url: "https://data.gov.my/data-catalogue/population_malaysia", retrieved: new Date().toISOString() },
      provider: "Greater Malaysia (greatermalaysia.com)"
    });
  } catch (e) { res.status(502).json({ error: "upstream unavailable", source: "data.gov.my" }); }
}
